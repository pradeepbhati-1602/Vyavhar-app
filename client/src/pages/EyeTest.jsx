import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Eye, User, Phone, CalendarDays, FileText, 
  ExternalLink, Receipt, RefreshCw, Send, Check 
} from 'lucide-react';

export default function EyeTest({ triggerToast }) {
  const navigate = useNavigate();

  // Directory list state
  const [tests, setTests] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [age, setAge] = useState('');
  const [visionCategory, setVisionCategory] = useState('Distance');
  const [reSph, setReSph] = useState('0.00');
  const [reCyl, setReCyl] = useState('0.00');
  const [reAxis, setReAxis] = useState('');
  const [leSph, setLeSph] = useState('0.00');
  const [leCyl, setLeCyl] = useState('0.00');
  const [leAxis, setLeAxis] = useState('');
  const [pd, setPd] = useState('');
  const [addPower, setAddPower] = useState('');
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [successResponse, setSuccessResponse] = useState(null);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const res = await fetch('/api/v1/eyetests', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setTests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  };

  const handleSaveTest = async (e) => {
    e.preventDefault();
    if (!name || mobile.length !== 10) {
      alert('Please fill name and 10-digit mobile number');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        patient_name: name,
        mobile,
        age: age ? parseInt(age) : null,
        vision_category: visionCategory,
        re_sph: parseFloat(reSph) || 0,
        re_cyl: parseFloat(reCyl) || 0,
        re_axis: reAxis ? parseInt(reAxis) : null,
        le_sph: parseFloat(leSph) || 0,
        le_cyl: parseFloat(leCyl) || 0,
        le_axis: leAxis ? parseInt(leAxis) : null,
        pd: pd ? parseFloat(pd) : null,
        add_power: addPower ? parseFloat(addPower) : null,
        doctor_notes: notes
      };

      const res = await fetch('/api/v1/eyetests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save eye test');

      setSuccessResponse(data);
      triggerToast(data.toast, data.waLink);
      
      // Auto open generated PDF in new tab
      window.open(data.pdfUrl, '_blank');
      
      // Reset form fields
      setName('');
      setMobile('');
      setAge('');
      setNotes('');
      
      // Refresh directory list
      fetchTests();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const convertToBill = (test) => {
    // Navigate to /new-bill and pass prescription as state
    navigate('/new-bill', {
      state: {
        prescription: {
          name: test.patient_name,
          mobile: test.mobile,
          reSph: String(test.re_sph),
          reCyl: String(test.re_cyl),
          reAxis: String(test.re_axis || ''),
          leSph: String(test.le_sph),
          leCyl: String(test.le_cyl),
          leAxis: String(test.le_axis || ''),
          pd: String(test.pd || ''),
          addPower: String(test.add_power || ''),
          visionCategory: test.vision_category
        }
      }
    });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Eye Testing & Refraction</h1>
        <p className="text-gray-400 text-xs mt-1">Capture clinical measurements, output clinical prescriptions, and push direct checkouts.</p>
      </div>

      {successResponse && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in-up">
          <div>
            <h4 className="text-green-400 font-extrabold text-sm">Prescription PDF Created!</h4>
            <p className="text-xs text-gray-300 mt-1">Refraction log created. Patient records auto-synchronized.</p>
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <a 
              href={successResponse.pdfUrl} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl border border-white/5 transition-all text-center flex-1 md:flex-none"
            >
              Print Prescription
            </a>
            <a 
              href={successResponse.waLink} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-all text-center flex-1 md:flex-none"
            >
              Send WhatsApp Link
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Form: Capture Logger (2/3 cols) */}
        <form onSubmit={handleSaveTest} className="lg:col-span-2 glass-card p-6 rounded-3xl space-y-6">
          <h3 className="text-base font-bold text-white flex items-center space-x-2 border-b border-white/5 pb-3">
            <Eye className="w-5 h-5 text-gold" />
            <span>Optometry Measurement Input</span>
          </h3>

          {/* Patient profile fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-gray-400">Patient Name *</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 py-2 px-3 text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-gray-400">Mobile Number *</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  maxLength={10}
                  placeholder="10 digit number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-11 py-2 px-3 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Age</label>
                <input
                  type="text"
                  placeholder="Years"
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-2 px-3 text-xs"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Vision</label>
                <select 
                  value={visionCategory} 
                  onChange={(e) => setVisionCategory(e.target.value)} 
                  className="w-full py-2 px-3 text-xs"
                >
                  <option>Distance</option>
                  <option>Reading</option>
                  <option>Progressive</option>
                  <option>Bifocal</option>
                </select>
              </div>
            </div>
          </div>

          {/* Refraction Values Grid */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase font-extrabold tracking-wider text-gold">Refraction Powers Ledger</h4>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse text-gray-400">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-2">EYE</th>
                    <th className="py-2">SPH</th>
                    <th className="py-2">CYL</th>
                    <th className="py-2">AXIS</th>
                    <th className="py-2">ADD</th>
                    <th className="py-2">PD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-3 font-bold text-white">RE (OD)</td>
                    <td className="py-2"><input type="text" value={reSph} onChange={(e) => setReSph(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={reCyl} onChange={(e) => setReCyl(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={reAxis} onChange={(e) => setReAxis(e.target.value)} className="w-16 py-1 px-2 text-xs font-mono" placeholder="-" /></td>
                    <td className="py-2" rowSpan={2}>
                      <input type="text" value={addPower} onChange={(e) => setAddPower(e.target.value)} className="w-16 py-1 px-2 text-xs mt-3" placeholder="+" />
                    </td>
                    <td className="py-2" rowSpan={2}>
                      <input type="text" value={pd} onChange={(e) => setPd(e.target.value)} className="w-16 py-1 px-2 text-xs mt-3" placeholder="mm" />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-white">LE (OS)</td>
                    <td className="py-2"><input type="text" value={leSph} onChange={(e) => setLeSph(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={leCyl} onChange={(e) => setLeCyl(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={leAxis} onChange={(e) => setLeAxis(e.target.value)} className="w-16 py-1 px-2 text-xs font-mono" placeholder="-" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Doctor clinical notes */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-gray-400">Doctor Clinical Notes</label>
            <textarea
              placeholder="Enter instructions, advice, recommended lens category, anti-glare filters, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-20 text-xs px-3 py-2 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-gold to-gold-light text-darkBg font-black rounded-2xl shadow-xl shadow-gold/10 transition-all flex items-center justify-center space-x-2 text-base"
          >
            {submitting ? (
              <div className="w-6 h-6 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                <span>Save Diagnostic Prescription</span>
              </>
            )}
          </button>
        </form>

        {/* Right Pane: Logs List (1/3 cols) */}
        <div className="glass-card p-6 rounded-3xl flex flex-col min-h-[450px]">
          <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gold" />
            <span>Prescription History logs</span>
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px] pr-1">
            {loadingList ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse"></div>
              ))
            ) : tests.length > 0 ? (
              tests.map(test => (
                <div key={test.eyetest_id} className="p-4 bg-darkSurface/50 border border-white/5 rounded-2xl space-y-3 hover:border-gold/20 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{test.patient_name}</h4>
                      <span className="text-[9px] text-gray-500 font-mono mt-0.5 block">{test.mobile} • Age: {test.age || '-'}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-white/5 border border-white/5 text-gray-400 rounded text-[8px] uppercase font-bold">
                      {test.vision_category}
                    </span>
                  </div>

                  <div className="text-[10px] text-gray-400 bg-white/5 p-2 rounded-lg grid grid-cols-2 gap-1.5 font-mono">
                    <div>RE: <strong className="text-white">{test.re_sph}/{test.re_cyl}</strong></div>
                    <div>LE: <strong className="text-white">{test.le_sph}/{test.le_cyl}</strong></div>
                  </div>

                  <div className="flex items-center gap-2 pt-1.5 border-t border-white/5">
                    <button
                      onClick={() => convertToBill(test)}
                      className="px-3 py-1.5 bg-gold hover:bg-gold-light text-darkBg font-bold text-[10px] rounded-lg flex items-center space-x-1 transition-all flex-1 justify-center"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Convert to Bill</span>
                    </button>
                    {test.prescription_pdf_url && (
                      <a
                        href={test.prescription_pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg border border-white/5 transition-all"
                        title="View PDF file"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500 text-xs">
                No diagnostic history available.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
