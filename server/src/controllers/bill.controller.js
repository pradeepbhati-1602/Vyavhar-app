const { prisma } = require('../prisma');
const pdfService = require('../services/pdf.service');// Generate an invoice number using the TenantCounter
async function getNextInvoiceNumber(tenant_id, tx) {
  const counter = await tx.tenantCounter.upsert({
    where: { tenant_id_name: { tenant_id, name: 'INVOICE_NUMBER' } },
    update: { value: { increment: 1 } },
    create: { tenant_id, name: 'INVOICE_NUMBER', value: 1 }
  });
  // Return format: INV-000001
  return `INV-${String(counter.value).padStart(6, '0')}`;
}

/**
 * Create a new bill (Atomic Transaction)
 */
exports.createBill = async (req, res) => {
  const { tenant_id, id: user_id, store_id: reqStoreId } = req.user;
  const { 
    mobile, name, customer_name, items = [], frame, frame_product_id, lens, lens_details, power, power_details,
    discount = 0, advance = 0, advance_paid = 0, cashback_used = 0, referral_code,
    subtotal: frontendSubtotal 
  } = req.body;

  const actualCustomerName = customer_name || name;
  const actualDiscount = parseFloat(discount) || 0;
  const actualAdvance = parseFloat(advance || advance_paid) || 0;
  const actualCashback = parseFloat(cashback_used) || 0;
  const actualSubtotal = parseFloat(frontendSubtotal) || items.reduce((acc, item) => acc + (item.qty * item.price), 0);

  let targetStoreId = req.body.store_id || req.user.store_id;
  if (!targetStoreId || targetStoreId === 'all') {
    const defaultStore = await prisma.store.findFirst({ where: { tenant_id } });
    if (!defaultStore) throw new Error("No store found. Please create a store first.");
    targetStoreId = defaultStore.store_id;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create customer
      let customer = await tx.customer.findUnique({
        where: { tenant_id_mobile: { tenant_id, mobile } }
      });

      const totalAmount = Math.max(0, actualSubtotal - actualDiscount - actualCashback);
      const dueAmount = Math.max(0, totalAmount - actualAdvance);
      const paymentStatus = dueAmount <= 0 ? 'PAID' : (actualAdvance > 0 ? 'PARTIAL' : 'DUE');

      if (customer) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            last_visit: new Date(),
            total_bills: { increment: 1 },
            total_purchase: { increment: totalAmount },
            pending_due: { increment: dueAmount }
          }
        });
      } else {
        customer = await tx.customer.create({
          data: {
            tenant_id,
            name: actualCustomerName,
            mobile,
            last_visit: new Date(),
            total_bills: 1,
            total_purchase: totalAmount,
            pending_due: dueAmount
          }
        });
      }

      // 2. Process Referral Code if provided
      let referralReward = 0;
      if (referral_code) {
        const referral = await tx.referralMember.findUnique({
          where: { tenant_id_referral_code: { tenant_id, referral_code } }
        });
        
        if (!referral) {
          throw new Error('Invalid referral code');
        }

        // e.g. 5% cashback reward rule (could be fetched from Settings)
        referralReward = totalAmount * 0.05;

        await tx.referralMember.update({
          where: { id: referral.id },
          data: {
            referral_count: { increment: 1 },
            cashback_earned: { increment: referralReward }
          }
        });
        
        // Also update the customer record of the referral owner
        await tx.customer.updateMany({
          where: { tenant_id, mobile: referral.mobile },
          data: { current_cashback: { increment: referralReward } }
        });
      }

      // 3. Process Cashback Used
      if (actualCashback > 0) {
        if (customer.current_cashback < actualCashback) {
          throw new Error(`Insufficient cashback. Available: ${customer.current_cashback}`);
        }
        await tx.customer.update({
          where: { id: customer.id },
          data: { current_cashback: { decrement: actualCashback } }
        });

        // Mirror subtraction if this customer is a referral member
        await tx.referralMember.updateMany({
          where: { tenant_id, mobile: customer.mobile },
          data: { cashback_used: { increment: actualCashback } }
        });
      }

      // 4. Process Inventory Items
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.product_id }
        });
        if (!product) throw new Error(`Product not found: ${item.product_id}`);

        if (product.current_stock < item.qty) {
          throw new Error(`Insufficient stock for ${product.product_name}. Available: ${product.current_stock}`);
        }

        // Deduct stock
        const updatedProd = await tx.product.update({
          where: { id: item.product_id },
          data: { 
            current_stock: { decrement: item.qty },
            last_updated_date: new Date()
          }
        });

        // Create Stock History record
        await tx.inventoryHistory.create({
          data: {
            tenant_id,
            store_id: targetStoreId,
            product_id: item.product_id,
            added_quantity: -item.qty,
            previous_stock: product.current_stock,
            new_stock: updatedProd.current_stock,
            updated_by_id: user_id,
            reason: 'Sale'
          }
        });
      }

      // 5. Generate Invoice Number
      const invoiceNumber = await getNextInvoiceNumber(tenant_id, tx);

      // 6. Create Bill
      const bill = await tx.bill.create({
        data: {
          tenant_id,
          store_id: targetStoreId,
          invoice_number: invoiceNumber,
          customer_id: customer.id,
          referral_code: referral_code || null,
          frame_product_id: frame_product_id || frame?.product_id || null,
          lens_details: lens_details || lens || null,
          power_details: power_details || power || null,
          subtotal: actualSubtotal,
          discount: actualDiscount,
          cashback_used: actualCashback,
          advance_paid: actualAdvance,
          due_amount: dueAmount,
          total_amount: totalAmount,
          payment_status: paymentStatus,
          delivery_status: 'PENDING',
          bill_type: items.some(i => i.category === 'SUNGLASSES') ? 'SUNGLASSES' : 'REGULAR'
        }
      });

      // Update Inventory History to link bill_id
      await tx.inventoryHistory.updateMany({
        where: { tenant_id, store_id: targetStoreId, reason: 'Sale', date: { gte: new Date(Date.now() - 5000) }, bill_id: null },
        data: { bill_id: bill.id }
      });
      
      // Audit Log
      await tx.auditLog.create({
        data: {
          tenant_id, store_id: targetStoreId, user_id,
          action: 'BILL_CREATED',
          entity: 'Bill',
          entity_id: bill.id,
          details: { invoiceNumber, totalAmount }
        }
      });

      return bill;
    });

    // 7. Set PDF URL (Generated dynamically via public endpoint)
    let pdfUrl = `/api/v1/public/bills/${result.id}/pdf`;
    
    await prisma.bill.update({
      where: { id: result.id },
      data: { invoice_pdf_url: pdfUrl }
    });
    result.invoice_pdf_url = pdfUrl;

    // 8. Build WhatsApp Deep Link (Can be returned to the client to launch)
    result.whatsapp_link = `https://wa.me/91${mobile}?text=Hi%20${encodeURIComponent(customer_name)},%20your%20invoice%20${result.invoice_number}%20is%20ready.%20Total:%20Rs.${result.total_amount}.`;

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Cancel a bill and reverse stock, totals, cashback
 */
exports.cancelBill = async (req, res) => {
  const { tenant_id, id: user_id, store_id: reqStoreId } = req.user;
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({
        where: { id, tenant_id }
      });

      if (!bill) throw new Error('Bill not found');
      if (bill.bill_status === 'CANCELLED') throw new Error('Bill is already cancelled');

      // 1. Reverse Customer Totals
      const customer = await tx.customer.findUnique({ where: { id: bill.customer_id } });
      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            total_bills: { decrement: 1 },
            total_purchase: { decrement: bill.total_amount },
            pending_due: { decrement: bill.due_amount }
          }
        });
      }

      // 2. Reverse Cashback Used
      if (bill.cashback_used > 0) {
        await tx.customer.update({
          where: { id: bill.customer_id },
          data: { current_cashback: { increment: bill.cashback_used } }
        });
        await tx.referralMember.updateMany({
          where: { tenant_id, mobile: customer.mobile },
          data: { cashback_used: { decrement: bill.cashback_used } }
        });
      }

      // 3. Reverse Referral Earned
      if (bill.referral_code) {
        const referralReward = Number(bill.total_amount) * 0.05; // Matching the reward logic
        
        const referral = await tx.referralMember.findUnique({
          where: { tenant_id_referral_code: { tenant_id, referral_code: bill.referral_code } }
        });
        
        if (referral) {
          await tx.referralMember.update({
            where: { id: referral.id },
            data: {
              referral_count: { decrement: 1 },
              cashback_earned: { decrement: referralReward }
            }
          });
          await tx.customer.updateMany({
            where: { tenant_id, mobile: referral.mobile },
            data: { current_cashback: { decrement: referralReward } }
          });
        }
      }

      // 4. Reverse Stock
      const histories = await tx.inventoryHistory.findMany({
        where: { bill_id: bill.id }
      });

      for (const history of histories) {
        const qtyToRestore = Math.abs(history.added_quantity);
        const product = await tx.product.update({
          where: { id: history.product_id },
          data: { current_stock: { increment: qtyToRestore } }
        });

        await tx.inventoryHistory.create({
          data: {
            tenant_id, store_id: bill.store_id, product_id: product.id,
            added_quantity: qtyToRestore,
            previous_stock: product.current_stock - qtyToRestore,
            new_stock: product.current_stock,
            updated_by_id: user_id,
            reason: 'Cancellation Restore',
            bill_id: bill.id
          }
        });
      }

      // 5. Mark Bill Cancelled
      const updatedBill = await tx.bill.update({
        where: { id: bill.id },
        data: { bill_status: 'CANCELLED' }
      });
      
      // Audit Log
      await tx.auditLog.create({
        data: {
          tenant_id, store_id: bill.store_id, user_id,
          action: 'BILL_CANCELLED',
          entity: 'Bill',
          entity_id: bill.id
        }
      });

      return updatedBill;
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Mark a bill as delivered
 */
exports.markDelivered = async (req, res) => {
  const { tenant_id, id: user_id } = req.user;
  const { id } = req.params;

  try {
    const existingBill = await prisma.bill.findFirst({
      where: { id, tenant_id },
      include: { customer: true }
    });
    
    if (!existingBill) return res.status(404).json({ error: 'Bill not found' });

    const bill = await prisma.bill.update({
      where: { id: existingBill.id },
      data: {
        delivery_status: 'DELIVERED',
        delivery_date: new Date()
      },
      include: { customer: true }
    });
    
    // Fetch tenant to get WA templates
    const tenant = await prisma.tenant.findUnique({ where: { tenant_id } });
    
    const waLinkEn = bill.customer ? `https://wa.me/91${bill.customer.mobile}?text=${encodeURIComponent(tenant?.wa_handover_msg_en || `Hi ${bill.customer.name}, your spectacles are delivered! Thanks for visiting.`)}` : null;
    const waLinkHi = bill.customer ? `https://wa.me/91${bill.customer.mobile}?text=${encodeURIComponent(tenant?.wa_handover_msg_hi || `नमस्ते ${bill.customer.name}, आपके चश्मे की डिलीवरी हो गई है! धन्यवाद।`)}` : null;
    
    res.json({ ...bill, waLinkEn, waLinkHi });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Collect remaining due payment
 */
exports.collectPayment = async (req, res) => {
  const { tenant_id, id: user_id } = req.user;
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, tenant_id } });
      if (!bill) throw new Error('Bill not found');
      if (bill.due_amount <= 0) throw new Error('No due amount left');

      // Update bill
      const updatedBill = await tx.bill.update({
        where: { id: bill.id },
        data: {
          advance_paid: { increment: bill.due_amount },
          due_amount: 0,
          payment_status: 'PAID'
        }
      });

      // Update customer pending_due
      await tx.customer.update({
        where: { id: bill.customer_id },
        data: { pending_due: { decrement: bill.due_amount } }
      });

      return updatedBill;
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getBills = async (req, res) => {
  const { tenant_id } = req.user;
  const { search, store_id, is_paginated, page, limit } = req.query;
  const where = { tenant_id };
  
  if (store_id && store_id !== 'all') where.store_id = store_id;
  if (search) {
    where.OR = [
      { invoice_number: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { mobile: { contains: search } } }
    ];
  }
  
  try {
    const mapBill = (b) => ({
      ...b,
      bill_id: b.invoice_number,
      customer_name: b.customer?.name || 'Unknown',
      customer_mobile: b.customer?.mobile || 'Unknown'
    });

    if (is_paginated === 'true') {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 50;
      const skip = (p - 1) * l;
      
      const [data, total] = await Promise.all([
        prisma.bill.findMany({ 
          where, 
          orderBy: { created_at: 'desc' },
          skip, 
          take: l, 
          include: { customer: true }
        }),
        prisma.bill.count({ where })
      ]);
      
      return res.json({
        data: data.map(mapBill),
        total,
        page: p,
        pages: Math.ceil(total / l)
      });
    }

    const bills = await prisma.bill.findMany({ 
      where, 
      orderBy: { created_at: 'desc' },
      include: { customer: true }
    });
    res.json(bills.map(mapBill));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
