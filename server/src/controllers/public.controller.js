const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdf.service');

exports.downloadInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { tenant_id: bill.tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const pdfBuffer = await pdfService.generateInvoicePDF(bill, tenant);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${bill.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error streaming invoice PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

exports.downloadPrescriptionPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const test = await prisma.eyeTest.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!test) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { tenant_id: test.tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const pdfBuffer = await pdfService.generatePrescriptionPDF(test, tenant);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="PRES-${test.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error streaming prescription PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};
