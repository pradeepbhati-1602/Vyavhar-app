// importEngine.js
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
  { id: 'pending_due', label: 'Pending Due Amount', required: false, type: 'number' },
];

const SYNONYM_DICT = {
  name: ['name', 'full name', 'customer name', 'client name', 'patient name', 'customer'],
  mobile: ['mobile', 'phone', 'contact', 'whatsapp number', 'cell number', 'phone no', 'mobile number', 'contact number', 'whatsapp', 'cell'],
  birthday: ['dob', 'date of birth', 'birth date', 'birthday', 'birthdate'],
  gender: ['gender', 'sex', 'male/female'],
  address: ['address', 'city', 'location', 'residence', 'home address', 'area'],
  language: ['language', 'lang', 'preferred language'],
  referral_code_used: ['referral code', 'referral', 'promo code', 'referred by'],
  pending_due: ['outstanding', 'balance', 'credit', 'due amount', 'pending due', 'due', 'amount due']
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
  const mapping = {}; // uploadedCol -> appFieldId
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
       // Low confidence, suggest it but maybe don't auto-confirm if we had a strict UI
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

    // Required checks
    APP_FIELDS.filter(f => f.required).forEach(f => {
      if (finalData[f.id] === undefined || finalData[f.id] === null || finalData[f.id] === '') {
        processedRow.errors.push(`Missing required field: ${f.label}`);
      }
    });

    // Specific field validations
    if (finalData.mobile) {
      const cleanMobile = String(finalData.mobile).replace(/[^0-9]/g, '');
      if (!mobileRegex.test(cleanMobile)) {
        processedRow.errors.push(`Invalid mobile format: ${finalData.mobile}`);
      } else {
        finalData.mobile = cleanMobile; // Clean it up
        if (seenMobiles.has(cleanMobile)) {
          processedRow.errors.push(`Duplicate mobile number within file: ${cleanMobile}`);
        } else {
          seenMobiles.add(cleanMobile);
        }
      }
    }

    if (finalData.pending_due !== undefined && finalData.pending_due !== '') {
      if (isNaN(parseFloat(finalData.pending_due))) {
        processedRow.errors.push(`Pending Due must be a number: ${finalData.pending_due}`);
      } else {
        finalData.pending_due = parseFloat(finalData.pending_due);
      }
    }

    // Attempt to normalize dates, though just issuing a warning if it looks weird is fine.
    if (finalData.birthday && finalData.birthday !== '') {
      // Excel often passes dates as numbers (days since 1900) or pre-formatted strings
      if (typeof finalData.birthday === 'number') {
         // It's likely an excel date serial
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

    processedRow.data = finalData;

    if (processedRow.errors.length > 0) invalidCount++;
    else if (processedRow.warnings.length > 0) warningCount++;
    else validCount++;

    validatedRows.push(processedRow);
  });

  return { validatedRows, validCount, invalidCount, warningCount };
};
