import { formatCurrency } from '../utils/formatCurrency';
import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Search, Calendar, User, Phone, 
  DollarSign, CheckSquare, Send, RotateCw, X, MessageSquare 
} from 'lucide-react';

export default function Repairs({ triggerToast }) {
  const [repairs, setRepairs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add repair form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [frameDetails, setFrameDetails] = useState('');
  const [repairType, setRepairType] = useState('');
  const [charges, setCharges] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRepairs();
  }, []);

  const fetchRepairs = async () => {
    try {
      const res = await fetch('/api/v1/repairs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setRepairs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRepair = async (e) => {
    e.preventDefault();
    if (!customerName || mobile.length !== 10 || !frameDetails || !repairType || !charges || !expectedDate) {
      setError('Please fill in all mandatory fields');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/repairs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          customer_name: customerName,
          mobile,
          frame_details: frameDetails,
          repair_type: repairType,
          charges: parseFloat(charges),
          expected_date: expectedDate
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create repair order');

      setShowAddForm(false);
      resetForm();
      fetchRepairs();
      triggerToast(`✅ Repair logged for ${data.customer_name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateRepairStatus = async (id, nextStatus) => {
    try {
      const res = await fetch(`/api/repairs/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ repair_status: nextStatus })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Status update failed');

      triggerToast(data.toast, data.waLink);
      
      // If WhatsApp link is returned, open it
      if (data.waLink) {
        window.open(data.waLink, '_blank');
      }

      fetchRepairs();
    } catch (err) {
      alert(err.message);
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setMobile('');
    setFrameDetails('');
    setRepairType('');
    setCharges('');
    setExpectedDate('');
    setError('');
  };

  const filteredRepairs = repairs.filter(r => 
    r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_mobile.includes(search) ||
    r.frame_details.toLowerCase().includes(search.toLowerCase())
  );

  const stages = ['Received', 'In Progress', 'Ready', 'Delivered'];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Glasses Repairs Pipeline</h1>
          <p className="text-gray-400 text-xs mt-1">Manage lens fixing, frame welding, nose-pad swaps, and schedule pickup updates.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-gold to-gold-light text-darkBg hover:opacity-90 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-lg shadow-gold/10 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Repair Job</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by patient name, mobile, frame description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 py-2.5 text-xs rounded-xl"
        />
      </div>

      {/* Repairs Pipeline Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stages.map(stage => {
          const items = filteredRepairs.filter(r => r.repair_status === stage);
          return (
            <div key={stage} className="glass-card p-4 rounded-3xl flex flex-col min-h-[400px]">
              {/* Stage Header */}
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <span className="text-xs font-extrabold text-white uppercase tracking-wider">{stage}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  stage === 'Delivered' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                  stage === 'Ready' ? 'bg-electric/10 text-electric border border-electric/20' :
                  stage === 'In Progress' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                  'bg-gray-500/10 text-gray-400 border border-white/5'
                }`}>
                  {items.length}
                </span>
              </div>

              {/* Items in stage */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[450px] pr-1">
                {items.length > 0 ? (
                  items.map(item => (
                    <div key={item.repair_id} className="p-3 bg-darkSurface/60 border border-white/5 rounded-2xl space-y-3 hover:border-white/10 transition-all">
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">{item.customer_name}</h4>
                        <span className="text-[9px] text-gray-500 font-mono block mt-0.5">{item.customer_mobile}</span>
                      </div>
                      
                      <div className="text-[10px] text-gray-400 space-y-1">
                        <div>Frame: <strong className="text-white">{item.frame_details}</strong></div>
                        <div>Task: <strong className="text-white">{item.repair_type}</strong></div>
                        <div>Due Date: <strong className="text-white">{new Date(item.expected_date).toLocaleDateString()}</strong></div>
                        <div className="pt-1.5 border-t border-white/5 flex justify-between items-center text-xs font-bold">
                          <span className="text-gray-500">Charges:</span>
                          <span className="text-white">{formatCurrency(item.charges)}</span>
                        </div>
                      </div>

                      {/* Status advancement controls */}
                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/5">
                        {stage === 'Received' && (
                          <button
                            onClick={() => updateRepairStatus(item.repair_id, 'In Progress')}
                            className="w-full py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-[9px] font-bold rounded-lg transition-all"
                          >
                            Start Fixing
                          </button>
                        )}
                        {stage === 'In Progress' && (
                          <button
                            onClick={() => updateRepairStatus(item.repair_id, 'Ready')}
                            className="w-full py-1 bg-electric hover:bg-electric/90 text-white text-[9px] font-bold rounded-lg transition-all"
                          >
                            Mark Ready (Notify)
                          </button>
                        )}
                        {stage === 'Ready' && (
                          <button
                            onClick={() => updateRepairStatus(item.repair_id, 'Delivered')}
                            className="w-full py-1 bg-green-600 hover:bg-green-700 text-white text-[9px] font-bold rounded-lg transition-all"
                          >
                            Hand Off / Deliver
                          </button>
                        )}
                        {stage === 'Delivered' && (
                          <span className="text-[8px] text-green-400 font-bold uppercase text-center w-full block py-1 bg-green-500/5 rounded-lg border border-green-500/10">
                            Delivered
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-32 flex items-center justify-center text-gray-600 text-[10px] text-center border border-dashed border-white/5 rounded-2xl">
                    No jobs in this stage.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Repair Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-modal max-w-md w-full p-8 rounded-3xl glow-gold/5 animate-fade-in-up space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Log Glasses Repair Job</h3>
              <button 
                onClick={() => { setShowAddForm(false); resetForm(); }}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center">
                <span>{error}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleCreateRepair} className="space-y-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Customer Name *</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
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
                    placeholder="10 digit phone number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11 py-2 px-3 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Frame details *</label>
                <input
                  type="text"
                  placeholder="e.g. Titan Brown Metal Rimless"
                  value={frameDetails}
                  onChange={(e) => setFrameDetails(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Repair Task *</label>
                  <input
                    type="text"
                    placeholder="e.g. Nose-pad swap"
                    value={repairType}
                    onChange={(e) => setRepairType(e.target.value)}
                    className="w-full py-2 px-3 text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Charges (₹) *</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={charges}
                    onChange={(e) => setCharges(e.target.value.replace(/\D/g, ''))}
                    className="w-full py-2 px-3 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Expected Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full pl-11 py-2 px-3 text-xs"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-gold to-gold-light text-darkBg font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 text-sm mt-3"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    <span>Log Repair Ticket</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
