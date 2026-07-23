const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { dbRun, dbGet, dbAll, runTransaction } = require('../db');
const { authenticateToken } = require('./auth');
const { generatePrescriptionPDF } = require('../utils/pdfGenerator');

// GET all eye tests
router.get('/', authenticateToken, async (req, res) => {
  const { store_id } = req.query;
  const userStore = req.user ? req.user.store_id : null;
  const userRole = req.user ? req.user.role : 'Employee';
  let targetStore = store_id || userStore;
  if (userRole === 'Employee') {
    targetStore = userStore;
  }

  let sql = 'SELECT * FROM eye_tests';
  const params = [];
  if (targetStore && targetStore !== 'all') {
    sql += ' WHERE store_id = ?';
    params.push(targetStore);
  }
  sql += ' ORDER BY created_at DESC';

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch eye tests' });
  }
});

// POST save eye test (prescription) and auto-create customer if new
router.post('/', authenticateToken, async (req, res) => {
  const {
    patient_name,
    mobile,
    age,
    vision_category = 'Distance',
    re_sph = 0, re_cyl = 0, re_axis = 0,
    le_sph = 0, le_cyl = 0, le_axis = 0,
    pd = 0, add_power = 0,
    doctor_notes,
    store_id
  } = req.body;

  if (!patient_name || !mobile) {
    return res.status(400).json({ error: 'Patient Name and Mobile number are required' });
  }

  const userStore = req.user ? req.user.store_id : null;
  const finalStoreId = store_id || userStore || 'store-main';

  try {
    const result = await runTransaction(async () => {
      // 1. Check if customer exists by mobile. If not, create them.
      let customer = await dbGet('SELECT * FROM customers WHERE mobile = ?', [mobile]);
      let customer_id;
      if (customer) {
        customer_id = customer.customer_id;
      } else {
        customer_id = 'cust-' + Date.now();
        await dbRun(`
          INSERT INTO customers (customer_id, name, mobile, gender, language)
          VALUES (?, ?, ?, 'Other', 'English')
        `, [customer_id, patient_name, mobile]);
      }

      // 2. Insert Eye Test log
      const eyetest_id = 'eye-' + Date.now();
      await dbRun(`
        INSERT INTO eye_tests (
          eyetest_id, customer_id, patient_name, mobile, age, vision_category,
          re_sph, re_cyl, re_axis, le_sph, le_cyl, le_axis, pd, add_power, doctor_notes, store_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        eyetest_id, customer_id, patient_name, mobile, age || null, vision_category,
        re_sph, re_cyl, re_axis, le_sph, le_cyl, le_axis, pd, add_power, doctor_notes || null, finalStoreId
      ]);

      return { eyetest_id, customer_id };
    });

    // Fetch details for PDF
    const test = await dbGet('SELECT * FROM eye_tests WHERE eyetest_id = ?', [result.eyetest_id]);
    
    // Read Settings
    const settingsRows = await dbAll('SELECT * FROM settings');
    const settings = {};
    settingsRows.forEach(row => { settings[row.key] = row.value; });

    // Generate Prescription PDF
    const pdfPath = path.join(__dirname, '..', 'public', 'prescriptions', `${result.eyetest_id}.pdf`);
    await generatePrescriptionPDF(test, null, settings, pdfPath);

    const relativeUrl = `/prescriptions/${result.eyetest_id}.pdf`;
    
    // Update PDF URL in eye test record
    await dbRun('UPDATE eye_tests SET prescription_pdf_url = ? WHERE eyetest_id = ?', [relativeUrl, result.eyetest_id]);

    // Construct WhatsApp message prefilled URL
    const textMsg = `Hello *${test.patient_name}*, your eye prescription is ready. SPH SPH CYL CYL details. View PDF: http://localhost:5000${relativeUrl}`;
    const waLink = `https://wa.me/91${test.mobile}?text=${encodeURIComponent(textMsg)}`;

    res.status(201).json({
      message: 'Eye test prescription saved',
      eyetestId: result.eyetest_id,
      pdfUrl: relativeUrl,
      waLink,
      toast: `✅ Prescription for ${test.patient_name} saved. Customer record sync'd.`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save eye test' });
  }
});

// GET single eye test by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const test = await dbGet('SELECT * FROM eye_tests WHERE eyetest_id = ?', [req.params.id]);
    if (!test) return res.status(404).json({ error: 'Prescription not found' });
    res.json(test);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve prescription' });
  }
});

module.exports = router;
