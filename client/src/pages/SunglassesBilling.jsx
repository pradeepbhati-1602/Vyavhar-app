import { formatCurrency } from '../utils/formatCurrency';
import React, { useState, useEffect } from 'react';
import { 
  Sun, User, Phone, DollarSign, Gift, Save, RotateCcw, Barcode 
} from 'lucide-react';
import { saveOfflineBill } from '../utils/offlineStore';

export default function SunglassesBilling({ activeStore, triggerToast }) {
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralName, setReferralName] = useState('');
  const [referralError, setReferralError] = useState('');

  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [availableCashback, setAvailableCashback] = useState(0);
  const [activeMembership, setActiveMembership] = useState(null);

  const [sunglasses, setSunglasses] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');

  const [discount, setDiscount] = useState('0');
  const [cashbackUsed, setCashbackUsed] = useState('0');
  const [advancePaid, setAdvancePaid] = useState('0');
  
  const [cashbackError, setCashbackError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    fetchSunglasses();
  }, [activeStore]);

  const fetchSunglasses = async () => {
    try {
      const res = await fetch(`/api/products?category=Sunglasses&store_id=${activeStore}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setSunglasses(data);
    } catch (e) {
      console.error(e);
    }
  };

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
        if (data.category === 'Sunglasses') {
          setSelectedProductId(data.product_id);
          setSelectedProduct(data);
          setBarcodeInput('');
          triggerToast(`✅ Scanned Sunglasses: ${data.brand} ${data.frame_name}`);
        } else {
          setBarcodeError('Product is not in Sunglasses category');
        }
      } else {
        setBarcodeError('Product barcode not found');
      }
    } catch (err) {
      setBarcodeError('Barcode lookup failed');
    }
  };

  const handleProductChange = (id) => {
    setSelectedProductId(id);
    const prod = sunglasses.find(p => p.product_id === id);
    setSelectedProduct(prod || null);
  };

  const validateCashback = (val) => {
    const parsed = parseFloat(val) || 0;
    if (parsed > availableCashback) {
      setCashbackError(`Cannot exceed available balance: ₹${availableCashback}`);
    } else {
      setCashbackError('');
    }
    setCashbackUsed(val);
  };

  const subtotal = selectedProduct ? parseFloat(selectedProduct.selling_price) : 0;
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
    setReferralCode('');
    setReferralName('');
    setReferralError('');
    setSelectedProductId('');
    setSelectedProduct(null);
    setBarcodeInput('');
    setDiscount('0');
    setCashbackUsed('0');
    setAdvancePaid('0');
    setSuccessData(null);
    setCashbackError('');
    setActiveMembership(null);
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!selectedProductId || cashbackError || referralError) return;

    setLoading(true);
    try {
      const payload = {
        name,
        mobile,
        referral_code: referralCode.trim() || null,
        frame_product_id: selectedProductId,
        lens_details: null,
        power_details: null,
        subtotal,
        discount: totalDiscount,
        cashback_used: parsedCashback,
        advance_paid: parsedAdvance,
        store_id: activeStore || null
      };

      if (!navigator.onLine) {
        await saveOfflineBill(payload);
        triggerToast('⚠️ Offline Mode: Sunglasses bill saved locally. It will sync automatically when connection returns.');
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
      window.open(data.pdfUrl, '_blank');
      fetchSunglasses();
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        try {
          const payload = {
            name,
            mobile,
            referral_code: referralCode.trim() || null,
            frame_product_id: selectedProductId,
            lens_details: null,
            power_details: null,
            subtotal,
            discount: totalDiscount,
            cashback_used: parsedCashback,
            advance_paid: parsedAdvance,
            store_id: activeStore || null
          };
          await saveOfflineBill(payload);
          triggerToast('⚠️ Connection Error: Sunglasses bill saved locally. It will sync when online.');
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
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Sun className="w-7 h-7 text-gold" />
            <span>Sunglasses Billing Counter</span>
          </h1>
          <p className="text-gray-400 text-xs mt-1">Simplified Walk-In Checkout counter for non-prescription Sunglasses sales.</p>
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
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-green-400 font-extrabold text-sm">Invoice Created Successfully!</h4>
            <p className="text-xs text-gray-300 mt-1">Invoice number: <strong className="text-white">{successData.billId}</strong>. Inventory stock decremented.</p>
          </div>
          <div className="flex items-center space-x-3 justify-end w-full md:w-auto">
            <a 
              href={successData.pdfUrl} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl border border-white/5 transition-all flex-1 md:flex-none text-center"
            >
              Print Invoice PDF
            </a>
            <a 
              href={successData.waLink} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-all flex-1 md:flex-none text-center"
            >
              Send WhatsApp Link
            </a>
          </div>
        </div>
      )}

      {/* Main Billing Form */}
      <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Customer details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Customer details */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <User className="w-5 h-5 text-gold" />
              <span>1. Customer details</span>
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
                <label className="text-xs font-semibold text-gray-400">Referral Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. EYE1001"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className={`w-full ${referralError ? 'border-red-500/40 focus:border-red-500' : ''}`}
                />
                {referralName && <span className="text-[10px] text-green-400 font-bold">Referrer: {referralName}</span>}
                {referralError && <span className="text-[10px] text-red-400 font-bold">{referralError}</span>}
              </div>

              {isExistingCustomer && (
                <div className="bg-gold/5 border border-gold/10 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-[10px] text-gold font-bold uppercase tracking-wider">Loyalty Cashback</span>
                  <span className="text-lg font-black text-white mt-0.5">{formatCurrency(availableCashback)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sunglasses Selection */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Sun className="w-5 h-5 text-gold" />
                <span>2. Select Sunglasses</span>
              </h3>
              
              {/* Barcode scan */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Scan sunglasses barcode..."
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
                <label className="text-xs font-semibold text-gray-400">Select Item *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full"
                  required
                >
                  <option value="">-- Choose Sunglasses --</option>
                  {sunglasses.map(p => (
                    <option key={p.product_id} value={p.product_id} disabled={p.current_stock <= 0}>
                      {p.brand} — {p.frame_name} ({p.frame_color}) [{p.current_stock} in stock]
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Sunglasses Retail Price</span>
                  <span className="text-lg font-black text-white mt-0.5">{formatCurrency(selectedProduct.selling_price)}</span>
                  <span className="text-[9px] text-gray-400 mt-0.5">Brand: {selectedProduct.brand} • Color: {selectedProduct.frame_color}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Calculations */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl space-y-6 border border-gold/10 glow-gold/5 sticky top-6">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Sun className="w-5 h-5 text-gold" />
              <span>Checkout Ledger</span>
            </h3>

            <div className="space-y-3 text-sm border-b border-white/5 pb-4">
              <div className="flex justify-between font-bold text-white">
                <span>Sunglasses Price:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Discount Amount (₹)</label>
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
                  className="w-full"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Redeem Cashback (₹)</label>
                <input
                  type="text"
                  value={cashbackUsed}
                  onChange={(e) => validateCashback(e.target.value.replace(/\D/g, ''))}
                  className="w-full"
                  disabled={!isExistingCustomer || availableCashback <= 0}
                />
                {cashbackError && <span className="text-[10px] text-red-400 font-bold">{cashbackError}</span>}
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Advance Paid (₹)</label>
                <input
                  type="text"
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(e.target.value.replace(/\D/g, ''))}
                  className="w-full"
                />
              </div>
            </div>

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

            <button
              type="submit"
              disabled={loading || !selectedProductId || !!cashbackError || !!referralError}
              className="w-full py-4 bg-gradient-to-r from-gold to-gold-light text-darkBg font-black rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-2 text-base"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Generate Invoice</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
