const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdf.service');

exports.getEyeTests = async (req, res) => {
  const { tenant_id } = req.user;
  const { store_id, search } = req.query;
  const where = { tenant_id };
  
  if (store_id && store_id !== 'all') where.store_id = store_id;
  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { mobile: { contains: search } } }
    ];
  }
  
  try {
    const tests = await prisma.eyeTest.findMany({ 
      where, 
      orderBy: { created_at: 'desc' },
      include: { customer: true }
    });
    
    // Flatten customer details for frontend compatibility
    const formatted = tests.map(t => ({
      ...t,
      patient_name: t.customer.name,
      mobile: t.customer.mobile
    }));
    
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createEyeTest = async (req, res) => {
  try {
    const { patient_name, mobile, ...rest } = req.body;
    const tenant_id = req.user.tenant_id;
    
    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { tenant_id_mobile: { tenant_id, mobile } }
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { tenant_id, name: patient_name, mobile }
      });
    }

    let targetStoreId = req.body.store_id || req.user.store_id;
    if (!targetStoreId || targetStoreId === 'all') {
      const defaultStore = await prisma.store.findFirst({ where: { tenant_id } });
      if (!defaultStore) throw new Error("No store found. Please create a store first.");
      targetStoreId = defaultStore.store_id;
    }

    const data = { 
      ...rest,
      age: rest.age ? parseInt(rest.age) : null,
      re_axis: rest.re_axis ? parseInt(rest.re_axis) : null,
      le_axis: rest.le_axis ? parseInt(rest.le_axis) : null,
      patient_name,
      mobile,
      tenant_id,
      customer_id: customer.id,
      store_id: targetStoreId
    };
    
    const test = await prisma.eyeTest.create({ 
      data,
      include: { customer: true, tenant: true }
    });
    
    // Generate PDF
    let pdfUrl = `/uploads/PRES-${test.id}.pdf`;
    try {
      pdfUrl = await pdfService.generatePrescriptionPDF(test, test.tenant);
      await prisma.eyeTest.update({
        where: { id: test.id },
        data: { prescription_pdf_url: pdfUrl }
      });
    } catch (err) {
      console.error('PDF Generation failed during eye test creation:', err);
    }
    
    // WhatsApp Link
    const waLink = `https://wa.me/91${mobile}?text=Hi%20${encodeURIComponent(patient_name)},%20your%20diagnostic%20prescription%20is%20ready.`;

    // Flatten customer details and match frontend expectations
    res.json({
      ...test,
      patient_name: test.customer.name,
      mobile: test.customer.mobile,
      pdfUrl,
      waLink,
      toast: "Diagnostic Prescription created successfully."
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateEyeTest = async (req, res) => {
  try {
    const data = { ...req.body };
    const test = await prisma.eyeTest.update({ where: { id: req.params.id }, data });
    res.json(test);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
