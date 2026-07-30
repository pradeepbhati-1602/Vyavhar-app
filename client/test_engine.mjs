import { validateData, autoDetectMapping, APP_FIELDS } from './src/utils/smartImportEngine.js';

const rawData = [
  { Name: "Test User", Mobile: "" },
  { Name: "Test 2", Mobile: "9999999999" }
];

const mapping = {
  Name: { fieldId: 'name' },
  Mobile: { fieldId: 'mobile' }
};

try {
  const result = validateData(rawData, mapping);
  console.log("SUCCESS:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("ERROR:", err);
}
