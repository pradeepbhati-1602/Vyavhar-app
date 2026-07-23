import { formatCurrency } from '../utils/formatCurrency';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  User, Phone, Calendar, MapPin, Gift, Eye, 
  Receipt, DollarSign, Barcode, HelpCircle, Save, RotateCcw, AlertCircle
} from 'lucide-react';

import { saveOfflineBill } from '../utils/offlineStore';

export default function NewBill({ activeStore, triggerToast }) {
  const location = useLocation();
  // Customer details state
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('Male');
  const [address, setAddress] = useState('');
  const [language, setLanguage] = useState('English');
  const [referralCode, setReferralCode] = useState('');
  const [referralName, setReferralName] = useState('');
  const [referralError, setReferralError] = useState('');

  // Customer lookup states
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [availableCashback, setAvailableCashback] = useState(0);
  const [activeMembership, setActiveMembership] = useState(null);

  // Products stock states
  const [frames, setFrames] = useState([]);
  const [selectedFrameId, setSelectedFrameId] = useState('');
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');

  // Lens details states
  const [lensType, setLensType] = useState('Single Vision');
  const [lensCoating, setLensCoating] = useState('Standard');
  const [lensPrice, setLensPrice] = useState('0');

  // Power details states
  const [reSph, setReSph] = useState('0.00');
  const [reCyl, setReCyl] = useState('0.00');
  const [reAxis, setReAxis] = useState('');
  const [leSph, setLeSph] = useState('0.00');
  const [leCyl, setLeCyl] = useState('0.00');
  const [leAxis, setLeAxis] = useState('');
  const [pd, setPd] = useState('');
  const [addPower, setAddPower] = useState('');

  // Finance states
  const [discount, setDiscount] = useState('0');
  const [cashbackUsed, setCashbackUsed] = useState('0');
  const [advancePaid, setAdvancePaid] = useState('0');
  const [cashbackError, setCashbackError] = useState('');

  // Process state
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Fetch frame products on mount
  useEffect(() => {
    fetchFrames();
  }, []);

  // Handle conversion from prescription / EyeTest screen
  useEffect(() => {
    if (location.state?.prescription) {
      const p = location.state.prescription;
      setName(p.name || '');
      setMobile(p.mobile || '');
      setReSph(p.reSph || '0.00');
      setReCyl(p.reCyl || '0.00');
      setReAxis(p.reAxis || '');
      setLeSph(p.leSph || '0.00');
      setLeCyl(p.leCyl || '0.00');
      setLeAxis(p.leAxis || '');
      setPd(p.pd || '');
      setAddPower(p.addPower || '');
      setLensType(p.visionCategory || 'Single Vision');
      triggerToast(`📋 Imported Prescription for ${p.name}`);
    }
  }, [location.state]);

  const fetchFrames = async () => {
    try {
      const res = await fetch('/api/products?category=Frames', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setFrames(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Live lookup for customer when mobile reaches 10 digits
  useEffect(() => {
    if (mobile.length === 10) {
      lookupCustomer(mobile);
    } else {
      setIsExistingCustomer(false);
      setAvailableCashback(0);
      setActiveMembership(null);
    }
  }, [mobile]);

  const lookupCustomer = async (num) => {
    try {
      const res = await fetch(`/api/customers/lookup/${num}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.customer.name);
        setBirthday(data.customer.birthday ? data.customer.birthday.split('T')[0] : '');
        setGender(data.customer.gender || 'Male');
        setAddress(data.customer.address || '');
        setLanguage(data.customer.language || 'English');
        setAvailableCashback(parseFloat(data.customer.current_cashback) || 0);
        setIsExistingCustomer(true);

        // Fetch active membership status
        const token = localStorage.getItem('token');
        const mRes = await fetch(`/api/memberships/active/${data.customer.customer_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (mRes.ok) {
          const mData = await mRes.json();
          setActiveMembership(mData);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Live lookup for referral code
  useEffect(() => {
    if (referralCode.trim().length >= 4) {
      lookupReferral(referralCode.trim());
    } else {
      setReferralName('');
      setReferralError('');
    }
  }, [referralCode]);

  const lookupReferral = async (code) => {
    try {
      const res = await fetch(`/api/customers/referral/${code}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReferralName(data.customer_name);
        setReferralError('');
      } else {
        const err = await res.json();
        setReferralName('');
        setReferralError(err.error || 'Invalid code');
      }
    } catch (e) {
      setReferralName('');
      setReferralError('Validation failed');
    }
  };

  // Barcode quick lookup
  const handleBarcodeSearch = async (e) => {
    e.preventDefault();
    if (!barcodeInput) return;
    setBarcodeError('');
    try {
      const res = await fetch(`/api/products/barcode/${barcodeInput.trim()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.category === 'Frames') {
          // Select this frame
          setSelectedFrameId(data.product_id);
          setSelectedFrame(data);
          setBarcodeInput('');
          triggerToast(`✅ Scanned Frame: ${data.brand} ${data.frame_name}`);
        } else {
          setBarcodeError('Product is not in the Frames category');
        }
      } else {
        setBarcodeError('Product barcode not found');
      }
    } catch (err) {
      setBarcodeError('Barcode lookup failed');
    }
  };

  // Handle manual frame selection dropdown
  const handleFrameChange = (id) => {
    setSelectedFrameId(id);
    const frame = frames.find(f => f.product_id === id);
    setSelectedFrame(frame || null);
  };

  // Real-time validations
  const validateCashback = (val) => {
    const parsed = parseFloat(val) || 0;
    if (parsed > availableCashback) {
      setCashbackError(`Cannot exceed available balance: ₹${availableCashback}`);
    } else {
      setCashbackError('');
    }
    setCashbackUsed(val);
  };

  // Compute subtotal and due in real-time
  const frameCost = selectedFrame ? parseFloat(selectedFrame.selling_price) : 0;
  const parsedLensCost = parseFloat(lensPrice) || 0;
  const subtotal = frameCost + parsedLensCost;

  const membershipDiscount = activeMembership ? (subtotal * parseFloat(activeMembership.discount_percent) / 100) : 0;
  const parsedDiscount = parseFloat(discount) || 0;
  const totalDiscount = parsedDiscount + membershipDiscount;

  const parsedCashback = parseFloat(cashbackUsed) || 0;
  const parsedAdvance = parseFloat(advancePaid) || 0;

  const totalAmount = Math.max(0, subtotal - totalDiscount - parsedCashback);
  const dueAmount = Math.max(0, totalAmount - parsedAdvance);

  const resetForm = () => {
    setMobile('');
    setName('');
    setBirthday('');
    setGender('Male');
    setAddress('');
    setLanguage('English');
    setReferralCode('');
    setReferralName('');
    setReferralError('');
    setSelectedFrameId('');
    setSelectedFrame(null);
    setBarcodeInput('');
    setLensPrice('0');
    setDiscount('0');
    setCashbackUsed('0');
    setAdvancePaid('0');
    setSuccessData(null);
    setCashbackError('');
    setActiveMembership(null);
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cashbackError || referralError) return;

    setLoading(true);
    try {
      const payload = {
        name,
        mobile,
        birthday,
        gender,
        address,
        language,
        referral_code: referralCode.trim() || null,
        frame_product_id: selectedFrameId || null,
        lens_details: {
          type: lensType,
          coating: lensCoating,
          price: parsedLensCost
        },
        power_details: {
          re_sph: reSph,
          re_cyl: reCyl,
          re_axis: reAxis,
          le_sph: leSph,
          le_cyl: leCyl,
          le_axis: leAxis,
          pd,
          add: addPower
        },
        subtotal,
        discount: totalDiscount,
        cashback_used: parsedCashback,
        advance_paid: parsedAdvance,
        store_id: activeStore || null
      };

      if (!navigator.onLine) {
        await saveOfflineBill(payload);
        triggerToast('⚠️ Offline Mode: Bill saved locally. It will sync automatically when connection returns.');
        resetForm();
        setLoading(false);
        return;
      }

      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      setSuccessData(data);
      triggerToast(data.toast, data.waLink);
      
      // Auto open generated PDF in new tab
      window.open(data.pdfUrl, '_blank');
      
      // Refresh inventory stock
      fetchFrames();
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        // Network / CORS / Server Down error!
        try {
          const payload = {
            name,
            mobile,
            birthday,
            gender,
            address,
            language,
            referral_code: referralCode.trim() || null,
            frame_product_id: selectedFrameId || null,
            lens_details: {
              type: lensType,
              coating: lensCoating,
              price: parsedLensCost
            },
            power_details: {
              re_sph: reSph,
              re_cyl: reCyl,
              re_axis: reAxis,
              le_sph: leSph,
              le_cyl: leCyl,
              le_axis: leAxis,
              pd,
              add: addPower
            },
            subtotal,
            discount: totalDiscount,
            cashback_used: parsedCashback,
            advance_paid: parsedAdvance,
            store_id: activeStore || null
          };
          await saveOfflineBill(payload);
          triggerToast('⚠️ Connection Error: Bill saved locally. It will sync when online.');
          resetForm();
        } catch (dbErr) {
          console.error(dbErr);
          alert('Network offline. Failed to save draft locally.');
        }
      } else {
        alert(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Billing Counter</h1>
          <p className="text-gray-400 text-xs mt-1">Fill fields to automate invoice, stock, referrals & WhatsApp updates.</p>
        </div>
        <button 
          onClick={resetForm}
          className="px-4 py-2 border border-white/10 hover:bg-white/5 text-gray-300 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset POS</span>
        </button>
      </div>

      {successData && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in-up">
          <div>
            <h4 className="text-green-400 font-extrabold text-sm">Invoice Created Successfully!</h4>
            <p className="text-xs text-gray-300 mt-1">Invoice number: <strong className="text-white">{successData.billId}</strong>. Stock levels decremented. Cashbacks adjusted.</p>
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <a 
              href={successData.pdfUrl} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl border border-white/5 transition-all text-center flex-1 md:flex-none"
            >
              Print Invoice PDF
            </a>
            <a 
              href={successData.waLink} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-all text-center flex-1 md:flex-none"
            >
              Share via WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Main Billing Form */}
      <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Customer details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Box 1: Customer Profile */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <User className="w-5 h-5 text-gold" />
              <span>1. Customer Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Mobile Number *</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="Enter 10 digit number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Customer Name *</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Birthday (Optional)</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full pl-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full">
                    <option>English</option>
                    <option>Hindi</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-gray-400">Address (Optional)</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-3 w-4 h-4 text-gray-500" />
                <textarea
                  placeholder="Enter contact address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-11 h-16 resize-none"
                />
              </div>
            </div>

            {/* Referral Info */}
            <div className="pt-2 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400 flex items-center space-x-1">
                  <Gift className="w-3.5 h-3.5 text-gold" />
                  <span>Referral Code (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. EYE1001"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className={`w-full ${referralError ? 'border-red-500/40 focus:border-red-500' : ''}`}
                />
                {referralName && <span className="text-[10px] text-green-400 font-bold">Referrer Confirmed: {referralName}</span>}
                {referralError && <span className="text-[10px] text-red-400 font-bold">{referralError}</span>}
              </div>

              {isExistingCustomer && (
                <div className="bg-gold/5 border border-gold/10 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-[10px] text-gold font-bold uppercase tracking-wider">Loyalty Cashback</span>
                  <span className="text-lg font-black text-white mt-0.5">{formatCurrency(availableCashback)}</span>
                  <span className="text-[9px] text-gray-500 mt-0.5">Use below to claim instant discount.</span>
                </div>
              )}
            </div>
          </div>

          {/* Box 2: Inventory & Barcode Scans */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Barcode className="w-5 h-5 text-electric" />
                <span>2. Selection & Barcode</span>
              </h3>
              
              {/* Barcode Form */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Scan product barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch(e)}
                  className="w-full md:w-56 py-1.5 px-3 text-xs"
                />
                {barcodeError && <span className="absolute right-2 top-11 bg-red-950 text-red-400 text-[8px] font-bold px-1.5 py-0.5 rounded border border-red-500/20 z-10">{barcodeError}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Select Frame *</label>
                <select
                  value={selectedFrameId}
                  onChange={(e) => handleFrameChange(e.target.value)}
                  className="w-full"
                >
                  <option value="">-- Choose Frame from Catalog --</option>
                  {frames.map(f => (
                    <option key={f.product_id} value={f.product_id} disabled={f.current_stock <= 0}>
                      {f.brand} — {f.frame_name} ({f.frame_color}) [{f.current_stock} left] {f.current_stock <= 0 ? '(Out of Stock)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedFrame && (
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Selected Item Price</span>
                  <span className="text-lg font-black text-white mt-0.5">{formatCurrency(selectedFrame.selling_price)}</span>
                  <span className="text-[9px] text-gray-400 mt-0.5">{selectedFrame.brand} • Size: {selectedFrame.size || '-'}</span>
                </div>
              )}
            </div>

            {/* Lens selection */}
            <div className="pt-2 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Lens Type</label>
                <select value={lensType} onChange={(e) => setLensType(e.target.value)} className="w-full">
                  <option>Single Vision</option>
                  <option>Bifocal</option>
                  <option>Progressive</option>
                  <option>Blue-Cut</option>
                  <option>Anti-Reflective</option>
                  <option>Photochromic</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Lens Coating</label>
                <select value={lensCoating} onChange={(e) => setLensCoating(e.target.value)} className="w-full">
                  <option>Standard</option>
                  <option>Hard Coat</option>
                  <option>Anti-Glare</option>
                  <option>Blue Block</option>
                  <option>Dust/Water Resistant</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Lens Rate (₹)</label>
                <input
                  type="text"
                  placeholder="0"
                  value={lensPrice}
                  onChange={(e) => setLensPrice(e.target.value.replace(/\D/g, ''))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Box 3: Clinic Power prescription details */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Eye className="w-5 h-5 text-gold" />
              <span>3. Lens Prescription (Power Details)</span>
            </h3>

            {/* Table layout for visual clarity */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-gray-400">
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
                    <td className="py-3 font-bold text-white">RE (Right)</td>
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
                    <td className="py-3 font-bold text-white">LE (Left)</td>
                    <td className="py-2"><input type="text" value={leSph} onChange={(e) => setLeSph(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={leCyl} onChange={(e) => setLeCyl(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={leAxis} onChange={(e) => setLeAxis(e.target.value)} className="w-16 py-1 px-2 text-xs font-mono" placeholder="-" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column: Checkout Breakdown */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl space-y-6 border border-gold/10 glow-gold/5 sticky top-6">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-gold" />
              <span>Checkout Breakdown</span>
            </h3>

            {/* Calculations items list */}
            <div className="space-y-3.5 text-sm border-b border-white/5 pb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Frame Cost:</span>
                <span className="text-white font-semibold">{formatCurrency(frameCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Lens Cost:</span>
                <span className="text-white font-semibold">{formatCurrency(parsedLensCost)}</span>
              </div>
              <div className="flex justify-between font-bold text-white pt-2 border-t border-white/5">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </div>

            {/* Adjustment Fields */}
            <div className="space-y-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Discount Amount (₹)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Redeem Cashback (₹)</label>
                <div className="relative">
                  <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={cashbackUsed}
                    onChange={(e) => validateCashback(e.target.value.replace(/\D/g, ''))}
                    className={`w-full pl-11 ${cashbackError ? 'border-red-500/40 focus:border-red-500' : ''}`}
                    disabled={!isExistingCustomer || availableCashback <= 0}
                  />
                </div>
                {cashbackError && <span className="text-[10px] text-red-400 font-bold">{cashbackError}</span>}
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Advance Paid (₹)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11"
                  />
                </div>
              </div>
            </div>

            {/* Total summary */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
              {activeMembership && (
                <div className="p-2.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-xl flex items-center justify-between font-bold">
                  <span>Membership: {activeMembership.plan_name}</span>
                  <span>-{formatCurrency(membershipDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-400">
                <span>Grand Total:</span>
                <span className="font-bold text-white">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-white border-t border-white/5 pt-2">
                <span className="text-gray-400">Balance Due:</span>
                <span className={dueAmount > 0 ? 'text-red-400' : 'text-green-400'}>{formatCurrency(dueAmount)}</span>
              </div>
            </div>

            {/* Save Submit Button */}
            <button
              type="submit"
              disabled={loading || !!cashbackError || !!referralError}
              className="w-full py-4 bg-gradient-to-r from-gold to-gold-light hover:opacity-90 active:scale-[0.98] text-darkBg font-black rounded-2xl shadow-xl shadow-gold/15 flex items-center justify-center space-x-2 transition-all"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Generate Bill & Invoice</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
