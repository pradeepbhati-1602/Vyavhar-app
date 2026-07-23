import { formatCurrency } from '../utils/formatCurrency';
import React, { useState, useEffect } from 'react';
import { Gift, Plus, User, Phone, Check, ShieldAlert, Sparkles } from 'lucide-react';

export default function Referrals() {
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/customers/referrals/all', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setMembers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || mobile.length !== 10) {
      setError('Please provide a valid name and 10-digit mobile number.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/customers/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ customer_name: name, mobile })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to register member');

      setName('');
      setMobile('');
      fetchMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch(`/api/customers/referrals/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchMembers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Referrals & Cashback Ledger</h1>
        <p className="text-gray-400 text-xs mt-1">Manage marketing partners, track referral counts, and view computed cashback balances.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Right Form: Register Member (1/3 cols) */}
        <div className="glass-card p-6 rounded-3xl h-fit space-y-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Plus className="w-5 h-5 text-gold" />
            <span>Register New Partner</span>
          </h3>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-gray-400">Partner Name *</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11"
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
                  className="w-full pl-11"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-gold to-gold-light hover:opacity-90 active:scale-[0.98] text-darkBg font-bold rounded-xl shadow-lg shadow-gold/10 transition-all flex items-center justify-center space-x-2 text-sm"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  <span>Enroll in Program</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Left Table: Members ledger (2/3 cols) */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 flex flex-col min-h-[450px]">
          <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
            <Gift className="w-5 h-5 text-gold" />
            <span>Referrals Registry Ledger</span>
          </h3>

          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <div className="h-48 flex items-center justify-center text-xs text-gray-500 animate-pulse">
                LOADING REFERRAL DATABASE...
              </div>
            ) : members.length > 0 ? (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400">
                    <th className="pb-3 pr-2">CODE</th>
                    <th className="pb-3 pr-2">PARTNER</th>
                    <th className="pb-3 text-center pr-2">COUNT</th>
                    <th className="pb-3 text-right pr-2">EARNED</th>
                    <th className="pb-3 text-right pr-2">USED</th>
                    <th className="pb-3 text-right pr-2">BALANCE</th>
                    <th className="pb-3 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {members.map(m => {
                    const balance = parseFloat(m.cashback_earned) - parseFloat(m.cashback_used);
                    return (
                      <tr key={m.referral_id} className="hover:bg-white/5">
                        <td className="py-3.5 pr-2 font-mono font-bold text-gold">{m.referral_code}</td>
                        <td className="py-3.5 pr-2">
                          <span className="font-bold text-white block leading-tight">{m.customer_name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">{m.mobile}</span>
                        </td>
                        <td className="py-3.5 text-center pr-2 font-bold text-white">{m.referral_count}</td>
                        <td className="py-3.5 text-right pr-2 font-bold text-white">{formatCurrency(m.cashback_earned)}</td>
                        <td className="py-3.5 text-right pr-2 text-gray-500">{formatCurrency(m.cashback_used)}</td>
                        <td className="py-3.5 text-right pr-2 font-extrabold text-green-400">{formatCurrency(balance)}</td>
                        <td className="py-3.5 text-center">
                          <button
                            onClick={() => toggleStatus(m.referral_id, m.status)}
                            className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all ${
                              m.status === 'Active' 
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {m.status}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <Sparkles className="w-10 h-10 text-gold/30 mb-2" />
                <p className="text-gray-500 text-xs">No referral members enrolled yet.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
