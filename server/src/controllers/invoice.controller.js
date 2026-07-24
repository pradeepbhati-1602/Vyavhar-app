const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdf.service');
const whatsappService = require('../services/whatsapp.service');

exports.generatePdf = async (req, res) => {
  try {
    const { billId } = req.params;
    const tenant_id = req.user.tenant_id;

    const bill = await prisma.bill.findUnique({
      where: { id: billId, tenant_id },
      include: {
        customer: true,
        tenant: true
      }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const pdfUrl = await pdfService.generateInvoicePDF(bill, bill.tenant);
    
    // We update the bill just to mark that PDF was generated (optional)
    const fullUrl = `http://localhost:5000${pdfUrl}`;
    res.json({ pdfUrl: fullUrl });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

exports.sendWhatsApp = async (req, res) => {
  try {
    const { billId } = req.params;
    const tenant_id = req.user.tenant_id;

    const bill = await prisma.bill.findUnique({
      where: { id: billId, tenant_id },
      include: { customer: true, tenant: true }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const pdfUrl = `http://localhost:5000/uploads/${bill.invoice_number}.pdf`;
    
    await whatsappService.sendInvoice(
      bill.customer.mobile,
      bill.customer.name,
      bill.tenant.business_name,
      bill.total_amount,
      pdfUrl
    );

    res.json({ message: 'WhatsApp message sent successfully' });
  } catch (error) {
    console.error('WhatsApp sending error:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
};
