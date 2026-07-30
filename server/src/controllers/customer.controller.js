const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.lookupCustomer = async (req, res) => {
  try {
    const { mobile } = req.params;
    const tenant_id = req.user.tenant_id;

    const customer = await prisma.customer.findUnique({
      where: {
        tenant_id_mobile: {
          tenant_id,
          mobile
        }
      },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { plan: true }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Customer lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup customer' });
  }
};

exports.getCustomers = async (req, res) => {
  const { search, is_paginated, page, limit } = req.query;
  const where = { tenant_id: req.user.tenant_id };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { mobile: { contains: search } }
    ];
  }
  try {
    if (is_paginated === 'true') {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 50;
      const skip = (p - 1) * l;
      
      const [data, total] = await Promise.all([
        prisma.customer.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: l, include: { memberships: true } }),
        prisma.customer.count({ where })
      ]);
      
      return res.json({
        data,
        total,
        page: p,
        pages: Math.ceil(total / l)
      });
    }

    const customers = await prisma.customer.findMany({ where, orderBy: { created_at: 'desc' }, include: { memberships: true } });
    res.json(customers);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user.tenant_id;

    const customer = await prisma.customer.findFirst({
      where: { id, tenant_id },
      include: {
        memberships: {
          include: { plan: true }
        },
        bills: {
          orderBy: { created_at: 'desc' }
        },
        eye_tests: {
          orderBy: { created_at: 'desc' }
        },
        repair_orders: {
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const { bills, eye_tests, repair_orders, memberships, ...customerData } = customer;
    customerData.customer_id = customerData.id;

    res.json({
      customer: customerData,
      bills,
      eyeTests: eye_tests,
      repairs: repair_orders,
      memberships
    });
  } catch (error) {
    console.error('getCustomerById error:', error);
    res.status(500).json({ error: 'Failed to fetch customer profile' });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const data = { ...req.body, tenant_id: req.user.tenant_id };
    if (data.birthday) data.birthday = new Date(data.birthday);
    const customer = await prisma.customer.create({ data });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateCustomer = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.birthday) data.birthday = new Date(data.birthday);
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getReferrals = async (req, res) => {
  try {
    const isPaginated = req.query.is_paginated === 'true';
    if (!isPaginated) {
      const members = await prisma.referralMember.findMany({ 
        where: { tenant_id: req.user.tenant_id },
        orderBy: { created_at: 'desc' }
      });
      return res.json(members);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      prisma.referralMember.findMany({
        where: { tenant_id: req.user.tenant_id },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.referralMember.count({ where: { tenant_id: req.user.tenant_id } })
    ]);
    
    res.json({
      data: members,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createReferral = async (req, res) => {
  try {
    const { customer_name, mobile } = req.body;
    const tenant_id = req.user.tenant_id;
    
    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { tenant_id_mobile: { tenant_id, mobile } }
    });
    
    if (!customer) {
      customer = await prisma.customer.create({
        data: { tenant_id, name: customer_name, mobile }
      });
    }

    // Generate code
    const referral_code = (customer_name.substring(0, 3).toUpperCase() + mobile.substring(mobile.length - 4)).replace(/[^A-Z0-9]/g, '');

    const referral = await prisma.referralMember.create({ 
      data: {
        tenant_id,
        customer_name,
        mobile,
        referral_code
      },
    });
    res.json(referral);
  } catch (err) { 
    if (err.code === 'P2002') return res.status(400).json({ error: 'Referral member already exists' });
    res.status(500).json({ error: err.message }); 
  }
};

exports.bulkImport = async (req, res) => {
  res.json({ message: 'Not fully implemented yet, but route is active!' });
};

exports.lookupReferral = async (req, res) => {
  try {
    const { code } = req.params;
    const referral = await prisma.referralMember.findFirst({
      where: { 
        tenant_id: req.user.tenant_id,
        referral_code: { equals: code, mode: 'insensitive' }
      }
    });

    if (!referral) return res.status(404).json({ error: 'Referral code not found' });
    res.json(referral);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.importBatch = async (req, res) => {
  const { customers, duplicateStrategy = 'skip' } = req.body;
  if (!Array.isArray(customers)) {
    return res.status(400).json({ error: 'Expected an array of customers' });
  }

  const tenant_id = req.user.tenant_id;

  try {
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const errors = [];

    for (const c of customers) {
      if (!c.name || !c.mobile) {
        skipped++;
        errors.push(`Row missing name or mobile (Mobile: ${c.mobile || 'N/A'})`);
        continue;
      }
      
      try {
        const existing = await prisma.customer.findUnique({
          where: { tenant_id_mobile: { tenant_id, mobile: c.mobile } }
        });
        
        if (existing) {
          if (duplicateStrategy === 'update') {
            await prisma.customer.update({
              where: { id: existing.id },
              data: {
                name: c.name || existing.name,
                birthday: c.birthday ? new Date(c.birthday) : existing.birthday,
                gender: c.gender || existing.gender,
                address: c.address || existing.address,
                language: c.language || existing.language,
                referral_code_used: c.referral_code_used || existing.referral_code_used,
                pending_due: c.pending_due !== undefined ? c.pending_due : existing.pending_due
              }
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          await prisma.customer.create({
            data: {
              tenant_id,
              name: c.name,
              mobile: String(c.mobile),
              birthday: c.birthday ? new Date(c.birthday) : null,
              gender: c.gender || null,
              address: c.address || null,
              language: c.language || 'English',
              referral_code_used: c.referral_code_used || null,
              pending_due: c.pending_due || 0.00
            }
          });
          imported++;
        }
      } catch (err) {
        errors.push(`Failed to process mobile ${c.mobile}: ${err.message}`);
      }
    }

    res.status(201).json({ imported, skipped, updated, errors });
  } catch (error) {
    console.error('Batch Import Error:', error);
    res.status(500).json({ error: error.message || 'Failed to import batch' });
  }
};

exports.importSmart = async (req, res) => {
  const { customers, duplicateStrategy = 'skip' } = req.body;
  if (!Array.isArray(customers)) {
    return res.status(400).json({ error: 'Expected an array of customers' });
  }

  const { tenant_id, id: user_id } = req.user;
  
  // Resolve store_id for Bills and EyeTests
  let targetStoreId = req.user.store_id;
  if (!targetStoreId || targetStoreId === 'all') {
    const defaultStore = await prisma.store.findFirst({ where: { tenant_id } });
    if (defaultStore) {
      targetStoreId = defaultStore.store_id;
    }
  }

  try {
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const errors = [];

    // V2 processing: Full Historical Import (Customer + Bill + EyeTest)
    for (const c of customers) {
      if (!c.name || !c.mobile) {
        skipped++;
        errors.push(`Row missing name or mobile (Mobile: ${c.mobile || 'N/A'})`);
        continue;
      }
      
      try {
        const cleanMobile = String(c.mobile).replace(/[^0-9]/g, '');
        
        // 1. Handle Customer Record
        let customer = await prisma.customer.findUnique({
          where: { tenant_id_mobile: { tenant_id, mobile: cleanMobile } }
        });
        
        if (customer) {
          if (duplicateStrategy === 'update') {
            customer = await prisma.customer.update({
              where: { id: customer.id },
              data: {
                name: c.name || customer.name,
                birthday: c.birthday ? new Date(c.birthday) : customer.birthday,
                gender: c.gender || customer.gender,
                address: c.address || customer.address,
                language: c.language || customer.language,
                referral_code_used: c.referral_code_used || customer.referral_code_used,
                pending_due: c.pending_due !== undefined ? c.pending_due : customer.pending_due
              }
            });
            updated++;
          } else {
            // Even if we skip customer update, we STILL want to create their Bill/EyeTest!
            // So we don't count it as a total row skip if there is bill data.
            if (!c.total_amount && !c.invoice_number && !c.re_sph && !c.le_sph) {
               skipped++;
               continue;
            }
          }
        } else {
          customer = await prisma.customer.create({
            data: {
              tenant_id,
              name: c.name,
              mobile: cleanMobile,
              birthday: c.birthday ? new Date(c.birthday) : null,
              gender: c.gender || null,
              address: c.address || null,
              language: c.language || 'English',
              referral_code_used: c.referral_code_used || null,
              pending_due: c.pending_due || 0.00
            }
          });
          imported++;
        }

        // 2. Handle Bill/Invoice Record
        // If row has grand total or an invoice number, we generate a bill.
        if (targetStoreId && (c.total_amount !== undefined || c.invoice_number)) {
          const billTotal = parseFloat(c.total_amount) || 0;
          const advancePaid = parseFloat(c.advance_paid) || 0;
          let dueAmt = parseFloat(c.due_amount);
          if (isNaN(dueAmt)) dueAmt = Math.max(0, billTotal - advancePaid);
          
          let paymentStatus = 'PAID';
          if (dueAmt > 0) {
            paymentStatus = advancePaid > 0 ? 'PARTIAL' : 'DUE';
          }
          
          const frameDetails = c.frame_details ? { name: c.frame_details, cost: c.frame_cost } : null;
          const lensDetails = c.lens_details ? { name: c.lens_details, cost: c.lens_cost } : null;

          // Generate or use invoice number
          let invNumber = c.invoice_number ? String(c.invoice_number) : `IMP-${Date.now()}-${Math.floor(Math.random()*1000)}`;

          // Create Bill
          const newBill = await prisma.bill.create({
            data: {
              tenant_id,
              store_id: targetStoreId,
              invoice_number: invNumber,
              customer_id: customer.id,
              subtotal: billTotal, // Defaulting subtotal to total for old imports
              total_amount: billTotal,
              advance_paid: advancePaid,
              due_amount: dueAmt,
              payment_status: paymentStatus,
              delivery_status: 'DELIVERED', // Historical bills are usually delivered
              bill_status: 'ACTIVE',
              lens_details: lensDetails ? [lensDetails] : [],
              power_details: null,
              created_at: c.bill_date ? new Date(c.bill_date) : new Date()
            }
          });

          // Update customer totals
          await prisma.customer.update({
            where: { id: customer.id },
            data: {
              total_bills: { increment: 1 },
              total_purchase: { increment: billTotal },
              pending_due: { increment: dueAmt }
            }
          });
        }

        // 3. Handle Eye Test / Prescription
        if (targetStoreId && (c.re_sph !== undefined || c.le_sph !== undefined)) {
          await prisma.eyeTest.create({
            data: {
              tenant_id,
              store_id: targetStoreId,
              customer_id: customer.id,
              patient_name: customer.name,
              mobile: customer.mobile,
              vision_category: 'Imported',
              re_sph: c.re_sph ? parseFloat(c.re_sph) : null,
              re_cyl: c.re_cyl ? parseFloat(c.re_cyl) : null,
              re_axis: c.re_axis ? parseInt(c.re_axis) : null,
              le_sph: c.le_sph ? parseFloat(c.le_sph) : null,
              le_cyl: c.le_cyl ? parseFloat(c.le_cyl) : null,
              le_axis: c.le_axis ? parseInt(c.le_axis) : null,
              pd: c.pd ? parseFloat(c.pd) : null,
              add_power: c.add_power ? parseFloat(c.add_power) : null,
              created_at: c.bill_date ? new Date(c.bill_date) : new Date()
            }
          });
        }
      } catch (err) {
        errors.push(`Failed to process mobile ${c.mobile}: ${err.message}`);
      }
    }

    res.status(201).json({ imported, skipped, updated, errors });
  } catch (error) {
    console.error('Smart Import Error:', error);
    res.status(500).json({ error: error.message || 'Failed to import batch smartly' });
  }
};
