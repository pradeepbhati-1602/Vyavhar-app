// smartImportEngine.js
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Define our application fields and their synonyms
export const APP_FIELDS = [
  { id: 'name', label: 'Customer Name', required: true, type: 'string' },
  { id: 'mobile', label: 'Mobile Number', required: true, type: 'string' },
  { id: 'birthday', label: 'Date of Birth', required: false, type: 'date' },
  { id: 'gender', label: 'Gender', required: false, type: 'string' },
  { id: 'address', label: 'Address', required: false, type: 'string' },
  { id: 'language', label: 'Language', required: false, type: 'string' },
  { id: 'referral_code_used', label: 'Referral Code', required: false, type: 'string' },
  { id: 'pending_due', label: 'Customer Old Due', required: false, type: 'number' },
  
  // Billing Fields
  { id: 'invoice_number', label: 'Bill / Invoice Number', required: false, type: 'string' },
  { id: 'bill_date', label: 'Bill Date', required: false, type: 'date' },
  { id: 'frame_details', label: 'Frame Details', required: false, type: 'string' },
  { id: 'frame_cost', label: 'Frame Cost', required: false, type: 'number' },
  { id: 'lens_details', label: 'Lens Details', required: false, type: 'string' },
  { id: 'lens_cost', label: 'Lens Cost', required: false, type: 'number' },
  { id: 'total_amount', label: 'Grand Total', required: false, type: 'number' },
  { id: 'advance_paid', label: 'Advance Paid', required: false, type: 'number' },
  { id: 'due_amount', label: 'Bill Due Amount', required: false, type: 'number' },

  // Prescription / Eye Test Fields
  { id: 're_sph', label: 'Right Eye SPH', required: false, type: 'string' },
  { id: 're_cyl', label: 'Right Eye CYL', required: false, type: 'string' },
  { id: 're_axis', label: 'Right Eye AXIS', required: false, type: 'string' },
  { id: 'le_sph', label: 'Left Eye SPH', required: false, type: 'string' },
  { id: 'le_cyl', label: 'Left Eye CYL', required: false, type: 'string' },
  { id: 'le_axis', label: 'Left Eye AXIS', required: false, type: 'string' },
  { id: 'pd', label: 'PD (Pupillary Distance)', required: false, type: 'string' },
  { id: 'add_power', label: 'ADD Power', required: false, type: 'string' },
];

const SYNONYM_DICT = {
  name: ['name', 'full name', 'customer name', 'client name', 'patient name', 'customer'],
  mobile: ['mobile', 'phone', 'contact', 'whatsapp number', 'cell number', 'phone no', 'mobile number', 'contact number', 'whatsapp', 'cell'],
  birthday: ['dob', 'date of birth', 'birth date', 'birthday', 'birthdate'],
  gender: ['gender', 'sex', 'male/female'],
  address: ['address', 'city', 'location', 'residence', 'home address', 'area'],
  language: ['language', 'lang', 'preferred language'],
  referral_code_used: ['referral code', 'referral', 'promo code', 'referred by'],
  pending_due: ['outstanding', 'balance', 'credit', 'old due', 'customer due'],
  
  invoice_number: ['bill id', 'invoice no', 'invoice number', 'bill no', 'bill number', 'receipt no', 'order id'],
  bill_date: ['bill date', 'invoice date', 'date of bill', 'date'],
  frame_details: ['frame', 'frame name', 'frame model', 'frame details', 'frame type'],
  frame_cost: ['frame cost', 'frame price', 'frame amount', 'frame rate'],
  lens_details: ['lens', 'lens name', 'lens model', 'lens details', 'lens type'],
  lens_cost: ['lens cost', 'lens price', 'lens amount', 'lens rate'],
  total_amount: ['total', 'grand total', 'total amount', 'bill total', 'net amount', 'amount'],
  advance_paid: ['advance', 'paid', 'advance paid', 'paid amount', 'deposit'],
  due_amount: ['due amount', 'pending due', 'due', 'bill due', 'balance due'],

  re_sph: ['r sph', 'right sph', 're sph', 'od sph', 'right eye sph'],
  re_cyl: ['r cyl', 'right cyl', 're cyl', 'od cyl', 'right eye cyl'],
  re_axis: ['r axis', 'right axis', 're axis', 'od axis', 'right eye axis'],
  le_sph: ['l sph', 'left sph', 'le sph', 'os sph', 'left eye sph'],
  le_cyl: ['l cyl', 'left cyl', 'le cyl', 'os cyl', 'left eye cyl'],
  le_axis: ['l axis', 'left axis', 'le axis', 'os axis', 'left eye axis'],
  pd: ['pd', 'pupillary distance'],
  add_power: ['add', 'addition', 'add power', 'reading add']
};

/**
 * Normalizes a string for comparison
 */
const normalize = (str) => {
  if (typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Calculates a confidence score between an uploaded column and an app field.
 */
export const calculateConfidence = (uploadedCol, appFieldId) => {
  const normCol = normalize(uploadedCol);
  const synonyms = SYNONYM_DICT[appFieldId] || [];
  
  if (normCol === normalize(APP_FIELDS.find(f => f.id === appFieldId)?.label)) return 100;
  if (normCol === normalize(appFieldId)) return 99;

  for (const syn of synonyms) {
    const normSyn = normalize(syn);
    if (normCol === normSyn) return 95;
    if (normCol.includes(normSyn) || normSyn.includes(normCol)) return 80;
  }
  
  return 0;
};

/**
 * Auto-detects the best mapping for an array of uploaded columns.
 */
export const autoDetectMapping = (uploadedColumns) => {
  const mapping = {};
  const usedAppFields = new Set();

  uploadedColumns.forEach(col => {
    let bestMatch = null;
    let highestConfidence = 0;

    APP_FIELDS.forEach(field => {
      const conf = calculateConfidence(col, field.id);
      if (conf > highestConfidence && conf >= 70 && !usedAppFields.has(field.id)) {
        highestConfidence = conf;
        bestMatch = field.id;
      }
    });

    if (bestMatch && highestConfidence >= 80) {
      mapping[col] = { fieldId: bestMatch, confidence: highestConfidence };
      usedAppFields.add(bestMatch);
    } else if (bestMatch) {
      mapping[col] = { fieldId: bestMatch, confidence: highestConfidence };
      usedAppFields.add(bestMatch);
    } else {
      mapping[col] = { fieldId: 'ignore', confidence: 0 };
    }
  });

  return mapping;
};

/**
 * Parses file (CSV or Excel) and returns raw data
 */
export const parseFile = (file) => {
  return new Promise((resolve, reject) => {
    const isCSV = file.name.endsWith('.csv');
    const reader = new FileReader();

    if (isCSV) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            reject(new Error('Failed to parse CSV.'));
          } else {
            resolve({ columns: results.meta.fields, data: results.data });
          }
        },
        error: (error) => reject(error)
      });
    } else {
      reader.onload = (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          if (json.length === 0) resolve({ columns: [], data: [] });
          else resolve({ columns: Object.keys(json[0]), data: json });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    }
  });
};

/**
 * Validates mapped data.
 */
export const validateData = (data, mapping) => {
  const validatedRows = [];
  let validCount = 0;
  let invalidCount = 0;
  let warningCount = 0;

  const mobileRegex = /^[0-9]{10,15}$/;
  const seenMobiles = new Set();

  data.forEach((row, index) => {
    const processedRow = { __originalIndex: index, errors: [], warnings: [], original: row };
    const finalData = {};

    // Apply mapping
    Object.keys(mapping).forEach(uploadedCol => {
      const targetField = mapping[uploadedCol].fieldId;
      if (targetField !== 'ignore') {
        let val = row[uploadedCol];
        if (typeof val === 'string') val = val.trim();
        finalData[targetField] = val;
      }
    });

    // Mobile Validation (Do this FIRST so we can auto-generate missing ones)
    if (finalData.mobile) {
      const cleanMobile = String(finalData.mobile).replace(/[^0-9]/g, '');
      if (!mobileRegex.test(cleanMobile)) {
        processedRow.errors.push(`Invalid mobile format: ${finalData.mobile}`);
      } else {
        finalData.mobile = cleanMobile; // Ensure clean string
        if (seenMobiles.has(cleanMobile)) {
          processedRow.warnings.push(`Multiple rows found for mobile: ${cleanMobile}. (Valid if importing multiple bills).`);
        } else {
          seenMobiles.add(cleanMobile);
        }
      }
    } else {
      // Auto-generate a dummy mobile number if it's completely missing
      const dummyMobile = '000' + Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
      finalData.mobile = dummyMobile;
      processedRow.warnings.push(`Mobile number was missing. Auto-generated dummy number: ${dummyMobile}`);
      seenMobiles.add(dummyMobile);
    }

    // Required checks
    APP_FIELDS.filter(f => f.required).forEach(f => {
      if (finalData[f.id] === undefined || finalData[f.id] === null || finalData[f.id] === '') {
        processedRow.errors.push(`Missing required field: ${f.label}`);
      }
    });

    // Money/Due validation
    if (finalData.pending_due !== undefined && finalData.pending_due !== '') {
      if (isNaN(parseFloat(finalData.pending_due))) {
        processedRow.errors.push(`Pending Due must be a number: ${finalData.pending_due}`);
      } else {
        finalData.pending_due = parseFloat(finalData.pending_due);
      }
    }

    // Date parsing
    if (finalData.birthday && finalData.birthday !== '') {
      if (typeof finalData.birthday === 'number') {
         const excelEpoch = new Date(1899, 11, 30);
         finalData.birthday = new Date(excelEpoch.getTime() + finalData.birthday * 86400000).toISOString().split('T')[0];
      } else {
        const d = new Date(finalData.birthday);
        if (isNaN(d.getTime())) {
          processedRow.warnings.push(`Invalid date format for Birthday: ${finalData.birthday}`);
        } else {
          finalData.birthday = d.toISOString().split('T')[0];
        }
      }
    }

    if (finalData.total_amount === undefined && finalData.invoice_number === undefined && finalData.re_sph === undefined && finalData.le_sph === undefined) {
      processedRow.warnings.push("No billing or eye test data mapped. If customer exists, this row will be SKIPPED.");
    }

    processedRow.data = finalData;

    if (processedRow.errors.length > 0) invalidCount++;
    else if (processedRow.warnings.length > 0) warningCount++;
    else validCount++;

    validatedRows.push(processedRow);
  });

  return { validatedRows, validCount, invalidCount, warningCount };
};
