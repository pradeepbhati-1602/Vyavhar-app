import React, { useState, useRef } from 'react';
import { 
  Upload, X, Check, AlertTriangle, AlertCircle, 
  ChevronRight, ArrowRight, Download, FileSpreadsheet 
} from 'lucide-react';
import { 
  APP_FIELDS, parseFile, autoDetectMapping, validateData 
} from '../utils/importEngine';
import * as XLSX from 'xlsx';

export default function CustomerImportWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [rawColumns, setRawColumns] = useState([]);
  const [rawData, setRawData] = useState([]);
  
  const [mapping, setMapping] = useState({});
  const [validationResults, setValidationResults] = useState(null);
  
  const [importOptions, setImportOptions] = useState({
    duplicateStrategy: 'skip', // skip, update
    importOnlyValid: true
  });
  
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    try {
      const { columns, data } = await parseFile(selectedFile);
      if (columns.length === 0) {
        alert("File appears to be empty.");
        setFile(null);
        return;
      }
      setRawColumns(columns);
      setRawData(data);
      
      // Auto detect
      const initialMapping = autoDetectMapping(columns);
      setMapping(initialMapping);
      setStep(2);
    } catch (error) {
      console.error(error);
      alert("Failed to read file. Please ensure it's a valid CSV or Excel file.");
      setFile(null);
    }
  };

  const handleMappingChange = (uploadedCol, newFieldId) => {
    setMapping(prev => ({
      ...prev,
      [uploadedCol]: { fieldId: newFieldId, confidence: 100 } // user selected
    }));
  };

  const goToPreview = () => {
    // Validate mapping - duplicate app fields?
    const usedFields = {};
    let hasDuplicateMapping = false;
    
    Object.keys(mapping).forEach(col => {
      const fieldId = mapping[col].fieldId;
      if (fieldId !== 'ignore') {
        if (usedFields[fieldId]) hasDuplicateMapping = true;
        usedFields[fieldId] = true;
      }
    });

    if (hasDuplicateMapping) {
      if (!window.confirm("You have mapped multiple columns to the same application field. This may cause data overwriting. Continue?")) {
        return;
      }
    }

    const results = validateData(rawData, mapping);
    setValidationResults(results);
    setStep(3);
  };

  const startImport = async () => {
    setIsImporting(true);
    setStep(4);
    
    let rowsToImport = validationResults.validatedRows;
    if (importOptions.importOnlyValid) {
      rowsToImport = rowsToImport.filter(r => r.errors.length === 0);
    }

    const BATCH_SIZE = 200;
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const finalErrors = [];

    try {
      for (let i = 0; i < rowsToImport.length; i += BATCH_SIZE) {
        const batch = rowsToImport.slice(i, i + BATCH_SIZE);
        
        // Exclude row metadata
        const cleanBatch = batch.map(b => b.data);

        const res = await fetch('/api/v1/customers/import-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ 
            customers: cleanBatch,
            duplicateStrategy: importOptions.duplicateStrategy
          })
        });

        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || "Batch import failed");
        }

        imported += data.imported || 0;
        skipped += data.skipped || 0;
        updated += data.updated || 0;
        if (data.errors) finalErrors.push(...data.errors);
        
        // Calculate original invalid rows skipped by UI choice
        const manuallySkipped = importOptions.importOnlyValid 
          ? validationResults.invalidCount 
          : 0;

        setImportProgress(Math.round(((i + batch.length) / rowsToImport.length) * 100));
      }

      setImportSummary({
        imported,
        skipped: skipped + (importOptions.importOnlyValid ? validationResults.invalidCount : 0),
        updated,
        failedRows: rowsToImport.filter(r => r.errors.length > 0) // Rows that failed UI validation
      });
      setStep(5);
    } catch (error) {
      console.error(error);
      alert(`Import failed: ${error.message}`);
      setStep(3); // Go back
    } finally {
      setIsImporting(false);
    }
  };

  const downloadErrorReport = () => {
    if (!validationResults || validationResults.invalidCount === 0) return;
    
    const errorData = validationResults.validatedRows
      .filter(r => r.errors.length > 0)
      .map(r => ({
        RowNumber: r.__originalIndex + 2, // Excel 1-based + Header
        ...r.original,
        Errors: r.errors.join('; ')
      }));

    const ws = XLSX.utils.json_to_sheet(errorData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "Import_Errors.xlsx");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-darkBg w-full max-w-5xl rounded-3xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-black text-white">Customer Import Wizard</h2>
            <p className="text-xs text-gray-400 mt-1">
              Step {step} of 5: 
              {step === 1 && " Upload File"}
              {step === 2 && " Map Columns"}
              {step === 3 && " Validate Data"}
              {step === 4 && " Importing"}
              {step === 5 && " Summary"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          
          {/* STEP 1: UPLOAD */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div 
                className="w-full max-w-2xl border-2 border-dashed border-white/20 rounded-3xl p-12 flex flex-col items-center text-center bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 bg-gold/20 text-gold rounded-full flex items-center justify-center mb-6">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Upload Spreadsheet</h3>
                <p className="text-sm text-gray-400 max-w-md">
                  Select an Excel (.xlsx, .xls) or CSV file. We'll automatically detect your columns and help you map them to the application fields.
                </p>
                <button className="mt-8 px-6 py-3 bg-white text-darkBg font-bold rounded-xl text-sm">
                  Browse Files
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                  className="hidden" 
                />
              </div>
            </div>
          )}

          {/* STEP 2: MAPPING */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-blue-400">Smart Mapping Detected</h4>
                  <p className="text-xs text-blue-400/80 mt-1">We've auto-mapped columns based on confidence scores. Please review and correct if necessary.</p>
                </div>
              </div>

              <div className="overflow-hidden border border-white/10 rounded-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-xs text-gray-400 uppercase font-bold tracking-wider">
                    <tr>
                      <th className="p-4 w-1/3">Uploaded Column</th>
                      <th className="p-4 w-1/3">Map To Application Field</th>
                      <th className="p-4 w-1/3">Confidence Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rawColumns.map(col => {
                      const currentMapping = mapping[col] || { fieldId: 'ignore', confidence: 0 };
                      const isHighConf = currentMapping.confidence >= 80;
                      
                      return (
                        <tr key={col} className="hover:bg-white/5 transition-all">
                          <td className="p-4 font-semibold text-white">{col}</td>
                          <td className="p-4">
                            <select 
                              value={currentMapping.fieldId}
                              onChange={(e) => handleMappingChange(col, e.target.value)}
                              className="w-full bg-darkBg text-white border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
                            >
                              <option value="ignore">-- Skip / Ignore --</option>
                              {APP_FIELDS.map(f => (
                                <option key={f.id} value={f.id}>
                                  {f.label} {f.required ? '*' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4">
                            {currentMapping.fieldId === 'ignore' ? (
                              <span className="text-gray-500 text-xs font-semibold">Skipped</span>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${isHighConf ? 'bg-green-500' : 'bg-yellow-500'}`} 
                                    style={{ width: `${currentMapping.confidence}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold ${isHighConf ? 'text-green-400' : 'text-yellow-400'}`}>
                                  {currentMapping.confidence}%
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 3 && validationResults && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl">
                  <span className="text-xs text-green-400/80 font-bold uppercase">Valid Rows</span>
                  <h3 className="text-2xl font-black text-green-400">{validationResults.validCount}</h3>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl">
                  <span className="text-xs text-yellow-400/80 font-bold uppercase">Warnings</span>
                  <h3 className="text-2xl font-black text-yellow-400">{validationResults.warningCount}</h3>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
                  <span className="text-xs text-red-400/80 font-bold uppercase">Invalid Rows</span>
                  <h3 className="text-2xl font-black text-red-400">{validationResults.invalidCount}</h3>
                </div>
              </div>

              {/* Import Options */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-wrap gap-6 items-center">
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="importValid"
                    checked={importOptions.importOnlyValid}
                    onChange={(e) => setImportOptions({...importOptions, importOnlyValid: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300 text-gold focus:ring-gold"
                  />
                  <label htmlFor="importValid" className="text-sm text-gray-300 font-semibold">Skip Invalid Rows</label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <label className="text-sm text-gray-300 font-semibold">If Duplicate Mobile found:</label>
                  <select 
                    value={importOptions.duplicateStrategy}
                    onChange={(e) => setImportOptions({...importOptions, duplicateStrategy: e.target.value})}
                    className="bg-darkBg border border-white/20 rounded-lg px-2 py-1 text-sm text-white"
                  >
                    <option value="skip">Skip / Ignore</option>
                    <option value="update">Update Existing Profile</option>
                  </select>
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <h4 className="text-sm font-bold text-white mb-3">Data Preview (First 20 Rows)</h4>
                <div className="overflow-x-auto border border-white/10 rounded-2xl">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-white/5 text-xs text-gray-400 uppercase font-bold tracking-wider">
                      <tr>
                        <th className="p-3">Status</th>
                        {APP_FIELDS.filter(f => Object.values(mapping).some(m => m.fieldId === f.id)).map(f => (
                          <th key={f.id} className="p-3">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {validationResults.validatedRows.slice(0, 20).map((row, i) => (
                        <tr key={i} className={`hover:bg-white/5 ${row.errors.length > 0 ? 'bg-red-500/5' : ''}`}>
                          <td className="p-3">
                            {row.errors.length > 0 ? (
                              <div className="text-red-400 flex items-center space-x-1" title={row.errors.join('\n')}>
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-xs font-bold">Error</span>
                              </div>
                            ) : row.warnings.length > 0 ? (
                              <div className="text-yellow-400 flex items-center space-x-1" title={row.warnings.join('\n')}>
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-xs font-bold">Warning</span>
                              </div>
                            ) : (
                              <div className="text-green-400 flex items-center space-x-1">
                                <Check className="w-4 h-4" />
                                <span className="text-xs font-bold">Valid</span>
                              </div>
                            )}
                          </td>
                          {APP_FIELDS.filter(f => Object.values(mapping).some(m => m.fieldId === f.id)).map(f => (
                            <td key={f.id} className="p-3 text-gray-300">
                              {row.data[f.id] || <span className="text-gray-600">-</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="64" cy="64" r="60" className="stroke-white/10 stroke-[8px] fill-transparent" />
                  <circle 
                    cx="64" cy="64" r="60" 
                    className="stroke-gold stroke-[8px] fill-transparent transition-all duration-300"
                    strokeDasharray="377" // 2*PI*r
                    strokeDashoffset={377 - (377 * importProgress) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-3xl font-black text-white">{importProgress}%</span>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white">Importing Customers...</h3>
                <p className="text-sm text-gray-400 mt-1">Please do not close this window.</p>
              </div>
            </div>
          )}

          {/* STEP 5: SUMMARY */}
          {step === 5 && importSummary && (
            <div className="space-y-8 py-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10" />
              </div>
              
              <div className="text-center">
                <h2 className="text-2xl font-black text-white">Import Completed!</h2>
                <p className="text-gray-400 mt-2 max-w-sm">
                  Your customer data has been processed. The customer list will now be updated.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl">
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-center">
                  <h4 className="text-4xl font-black text-white">{importSummary.imported}</h4>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mt-2">New Added</span>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-2xl text-center">
                  <h4 className="text-4xl font-black text-blue-400">{importSummary.updated}</h4>
                  <span className="text-xs text-blue-400/80 font-bold uppercase tracking-wider block mt-2">Updated</span>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-5 rounded-2xl text-center">
                  <h4 className="text-4xl font-black text-yellow-400">{importSummary.skipped}</h4>
                  <span className="text-xs text-yellow-400/80 font-bold uppercase tracking-wider block mt-2">Skipped</span>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl text-center">
                  <h4 className="text-4xl font-black text-red-400">{importSummary.failedRows.length}</h4>
                  <span className="text-xs text-red-400/80 font-bold uppercase tracking-wider block mt-2">Failed</span>
                </div>
              </div>

              {importSummary.failedRows.length > 0 && (
                <button 
                  onClick={downloadErrorReport}
                  className="flex items-center space-x-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold rounded-xl transition-all"
                >
                  <Download className="w-5 h-5" />
                  <span>Download Error Report</span>
                </button>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
          {step > 1 && step < 4 ? (
            <button 
              onClick={() => setStep(step - 1)} 
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
            >
              Back
            </button>
          ) : <div></div>}

          {step === 2 && (
            <button 
              onClick={goToPreview} 
              className="px-6 py-2.5 bg-gold text-darkBg font-black rounded-xl hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg shadow-gold/20"
            >
              <span>Next: Preview Data</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button 
              onClick={startImport} 
              className="px-6 py-2.5 bg-gold text-darkBg font-black rounded-xl hover:opacity-90 transition-all flex items-center space-x-2 shadow-lg shadow-gold/20"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Start Import</span>
            </button>
          )}

          {step === 5 && (
            <button 
              onClick={() => {
                onComplete();
                onClose();
              }} 
              className="px-8 py-3 bg-gold text-darkBg font-black rounded-xl hover:opacity-90 transition-all"
            >
              Finish & Close
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
