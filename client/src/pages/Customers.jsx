import { formatCurrency } from '../utils/formatCurrency';
import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, MapPin, Receipt, Gift, Eye, 
  Wrench, Phone, MessageSquare, ExternalLink, CalendarDays, ArrowUpDown, Users, Award, Upload 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SmartCustomerImport from '../components/SmartCustomerImport';
import { useFeatures } from '../contexts/FeatureContext';

export default function Customers({ tenant }) {
  const { hasFeature } = useFeatures();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Feature 14 Paid Membership states
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [buyingPlan, setBuyingPlan] = useState(false);
  const [activeMemb, setActiveMemb] = useState(null);
  
  // Upgrade membership state
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedUpgradePlanId, setSelectedUpgradePlanId] = useState('');
  const [upgradingPlan, setUpgradingPlan] = useState(false);

  // WA Templates state
  const [waTemplates, setWaTemplates] = useState({});

  // Bill filter state
  const [billFilter, setBillFilter] = useState('All');

  // Fetch directory list on mount or query change
  useEffect(() => {
    fetchCustomers();
  }, [search, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchPlans();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/v1/settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setWaTemplates(data);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  // Load detailed profile when customer ID changes
  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerProfile(selectedCustomerId);
    } else {
      setSelectedProfile(null);
      setActiveMemb(null);
    }
  }, [selectedCustomerId]);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/v1/memberships/plans', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlans(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomers = async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/v1/customers?search=${search}&sortBy=${sortBy}&order=${sortOrder}&is_paginated=true&page=${page}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setCustomers((data.data || []).map(c => ({ ...c, customer_id: c.id || c.customer_id })));
      setTotalPages(Math.ceil((data.total || 0) / (data.limit || limit)) || 1);
      if (data.data && data.data.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(data.data[0].id || data.data[0].customer_id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchCustomerProfile = async (id) => {
    setLoadingProfile(true);
    try {
      // Fetch profile and membership concurrently
      const [res, resM] = await Promise.all([
        fetch(`/api/v1/customers/${id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/v1/memberships/active/${id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const data = await res.json();
      
      if (data.error) {
        console.error(data.error);
        setSelectedProfile(null);
        return;
      }
      
      setSelectedProfile(data);

      if (resM.ok) {
        const mData = await resM.json();
        setActiveMemb(mData);
      } else {
        setActiveMemb(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProfile(false);
    }
  };

  const checkActiveMembership = async (id) => {
    try {
      const resM = await fetch(`/api/v1/memberships/active/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (resM.ok) {
        const mData = await resM.json();
        setActiveMemb(mData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePurchaseMembership = async () => {
    if (!selectedPlanId) return;
    setBuyingPlan(true);
    try {
      const res = await fetch('/api/v1/memberships/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          customer_id: selectedProfile.customer.id,
          plan_id: selectedPlanId
        })
      });
      if (res.ok) {
        alert('Membership activated!');
        fetchCustomerProfile(selectedProfile.customer.id); // Refresh
        checkActiveMembership(selectedProfile.customer.id);
        fetchCustomers();
        setSelectedPlanId('');
      } else {
        const error = await res.json();
        alert('Failed: ' + error.error);
      }
    } catch (error) {
      console.error(error);
      alert('Error purchasing membership');
    } finally {
      setBuyingPlan(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedProfile?.customer?.id) return;
    if (!window.confirm(`Are you sure you want to permanently delete customer ${selectedProfile.customer.name}? All their bills, eye tests, and data will be removed.`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/v1/customers/${selectedProfile.customer.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        alert('Customer deleted successfully.');
        setSelectedProfile(null);
        fetchCustomers();
      } else {
        const error = await res.json();
        alert('Failed to delete customer: ' + error.error);
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting customer');
    }
  };

  const handleUpgradeMembership = async () => {
    if (!selectedUpgradePlanId) return;
    setUpgradingPlan(true);
    try {
      const res = await fetch('/api/v1/memberships/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          customer_id: selectedProfile.customer.id,
          plan_id: selectedUpgradePlanId
        })
      });
      if (res.ok) {
        alert(`Membership assigned successfully!`);
        fetchCustomerProfile(selectedProfile.customer.id); // Refresh
        checkActiveMembership(selectedProfile.customer.id);
        fetchCustomers();
        setShowUpgrade(false);
        setSelectedUpgradePlanId('');
      } else {
        const error = await res.json();
        alert('Failed: ' + error.error);
      }
    } catch (error) {
      console.error(error);
      alert('Error upgrading membership');
    } finally {
      setUpgradingPlan(false);
    }
  };

  const handleRevokeMembership = async () => {
    if (!selectedProfile?.customer?.id) return;
    if (!window.confirm(`Are you sure you want to revoke the active membership for ${selectedProfile.customer.name}?`)) return;

    try {
      const res = await fetch(`/api/v1/memberships/active/${selectedProfile.customer.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        alert('Membership revoked successfully.');
        fetchCustomerProfile(selectedProfile.customer.id); // Refresh
        checkActiveMembership(selectedProfile.customer.id);
        fetchCustomers();
      } else {
        const error = await res.json();
        alert('Failed to revoke membership: ' + error.error);
      }
    } catch (e) {
      console.error(e);
      alert('Error revoking membership');
    }
  };
  const startMembershipRenewalReminder = (customer, planName, expiryDate) => {
    const text = `Hi *${customer.name}*, your active membership *${planName}* is expiring soon on *${new Date(expiryDate).toLocaleDateString()}*. Renew today at ${tenant?.business_name || 'our store'} to continue enjoying your exclusive discounts!`;
    const waLink = `https://api.whatsapp.com/send?phone=91${customer.mobile}&text=${encodeURIComponent(text)}`;
    window.open(waLink, '_blank');
  };
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };


  // Quick WhatsApp templates dispatcher
  const startWhatsAppChat = (customer, type, extraData = {}) => {
    let msg = '';
    
    if (type === 'general') {
      msg = waTemplates.wa_template_general || `Hi {customer_name}, hope you are doing well! This is ${tenant?.business_name || 'our store'}. We wanted to check if you are comfortable with your new eyewear. Let us know if you need any adjustments.`;
    } else if (type === 'payment') {
      msg = waTemplates.wa_template_payment || `Dear {customer_name}, this is a gentle reminder that your bill payment of {dueAmount} is pending at ${tenant?.business_name || 'our store'}. You can pay via UPI at our store. Please disregard if already paid.`;
    } else if (type === 'offer') {
      msg = waTemplates.wa_template_offer || `Hello {customer_name}, exclusive offer for you at ${tenant?.business_name || 'our store'}! Get flat 15% off on our new arrivals of designer frames this weekend. Show this message at checkout.`;
    }

    msg = msg.replace(/\{customer_name\}/g, customer.name);
    msg = msg.replace(/\{dueAmount\}/g, extraData.due ? formatCurrency(extraData.due) : '');

    const link = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(msg)}`;
    window.open(link, '_blank');
  };

  const activities = React.useMemo(() => {
    if (!selectedProfile) return [];
    let acts = [];

    if (selectedProfile.bills) {
      selectedProfile.bills.forEach(b => {
        acts.push({ ...b, _type: b.bill_type === 'Sunglasses' ? 'Sunglasses' : 'Bills', date: new Date(b.created_at) });
      });
    }

    if (selectedProfile.eyeTests) {
      selectedProfile.eyeTests.forEach(e => {
        acts.push({ ...e, _type: 'Eye Test', date: new Date(e.created_at) });
      });
    }

    if (selectedProfile.repairs) {
      selectedProfile.repairs.forEach(r => {
        acts.push({ ...r, _type: 'Repair', date: new Date(r.created_at) });
      });
    }

    if (selectedProfile.referral) {
      acts.push({ ...selectedProfile.referral, _type: 'Referral', date: new Date(selectedProfile.referral.created_at) });
    }

    if (billFilter !== 'All') {
      acts = acts.filter(a => a._type === billFilter);
    }

    return acts.sort((a, b) => b.date - a.date);
  }, [selectedProfile, billFilter]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Customer Directory</h1>
        <p className="text-gray-400 text-xs mt-1">Manage store buyers, access eye tests, repair logs, and chat notifications.</p>
      </div>

      {/* Pane Layout Container */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Pane: Search Table (2/5 cols) */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-5 flex flex-col min-h-[600px]">
          
          {/* Search bar & Import */}
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search name or mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 py-2.5 text-xs rounded-xl"
              />
            </div>
            
            <button
              onClick={() => setShowImportWizard(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-gold to-gold-light text-darkBg font-black rounded-xl text-xs flex items-center justify-center transition-all hover:opacity-90 shrink-0 shadow-lg shadow-gold/20"
              title="Smart Customer Import (v2)"
            >
              <Upload className="w-4 h-4 md:mr-1.5 text-darkBg" />
              <span className="hidden md:inline">⚡ Smart Import (v2)</span>
            </button>
          </div>

          {/* Directory list */}
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] pr-1">
            {loadingList ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse"></div>
              ))
            ) : customers.length > 0 ? (
              customers.map(c => {
                const isSelected = selectedCustomerId === c.customer_id;
                return (
                  <button
                    key={c.customer_id}
                    onClick={() => setSelectedCustomerId(c.customer_id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
                      isSelected 
                        ? 'bg-gradient-to-r from-gold/15 to-gold/5 border-gold/45 text-white glow-gold/5' 
                        : 'bg-darkSurface/50 border-white/5 text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold truncate max-w-[150px] flex items-center space-x-1">
                        <span>{c.name}</span>
                        {c.has_active_membership ? <Award className="w-3.5 h-3.5 text-gold" title="VIP Member" /> : null}
                      </h4>
                      <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">{c.mobile}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-extrabold block">{formatCurrency(c.total_purchase)}</span>
                      <span className="text-[8px] text-gray-500 uppercase font-semibold mt-0.5 block">Spent</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500 text-xs">
                No customers match query.
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-white/5 text-gray-300 rounded-lg text-xs hover:bg-white/10 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-white/5 text-gray-300 rounded-lg text-xs hover:bg-white/10 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right Pane: Profile View (3/5 cols) */}
        <div className="lg:col-span-3">
          {loadingProfile ? (
            <div className="glass-card rounded-3xl p-6 min-h-[600px] flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-gray-500 font-bold">LOADING CLIENT FILE...</span>
            </div>
          ) : selectedProfile ? (
            <div className="glass-card rounded-3xl p-6 space-y-6 min-h-[600px] flex flex-col justify-between">
              
              {/* Header profile section */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-white/5 pb-5">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-tr from-gold to-gold-light text-darkBg font-black text-xl flex items-center justify-center rounded-2xl uppercase">
                    {selectedProfile.customer.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white">{selectedProfile.customer.name}</h2>
                    <span className="text-xs text-gray-400 font-mono flex items-center space-x-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{selectedProfile.customer.mobile}</span>
                    </span>
                  </div>
                </div>

                {/* Instant Actions panel */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={handleDeleteCustomer}
                    className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl border border-red-500/10 transition-all"
                    title="Delete Customer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  <a
                    href={`tel:${selectedProfile.customer.mobile}`}
                    className="p-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl border border-white/5 transition-all"
                    title="Place Call"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => startWhatsAppChat(selectedProfile.customer, 'general')}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp Chat</span>
                  </button>
                </div>
              </div>

              {/* Stats highlights block */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Total Purchases</span>
                  <h4 className="text-lg font-black text-white mt-1">{formatCurrency(selectedProfile.customer.total_purchase)}</h4>
                </div>
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Total Bills</span>
                  <h4 className="text-lg font-black text-white mt-1">{selectedProfile.customer.total_bills}</h4>
                </div>
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Cashback Balance</span>
                  <h4 className="text-lg font-black text-gold mt-1">{formatCurrency(selectedProfile.customer.current_cashback)}</h4>
                </div>
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Last Visit</span>
                  <h4 className="text-xs font-bold text-white mt-2 truncate">
                    {selectedProfile.customer.last_visit ? new Date(selectedProfile.customer.last_visit).toLocaleDateString() : 'Never'}
                  </h4>
                </div>
              </div>

              {/* Details & Logs tabs */}
              <div className="flex-1 space-y-6 overflow-y-auto max-h-[350px] pr-1 pt-2">
                
                {/* Personal Bio */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-gold">Client Info</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>Birthday: <strong className="text-white">{selectedProfile.customer.birthday ? new Date(selectedProfile.customer.birthday).toLocaleDateString() : '-'}</strong></div>
                    <div>Gender: <strong className="text-white">{selectedProfile.customer.gender || 'Other'}</strong></div>
                    <div>Language: <strong className="text-white">{selectedProfile.customer.language}</strong></div>
                    <div>Referral Code Used: <strong className="text-white">{selectedProfile.customer.referral_code_used || '-'}</strong></div>
                    <div className="md:col-span-2">Address: <strong className="text-white">{selectedProfile.customer.address || '-'}</strong></div>
                  </div>
                </div>

                {/* Feature 14: Paid Membership Details */}
                {hasFeature('membership_system') && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-gold flex items-center space-x-2">
                    <Award className="w-4 h-4" />
                    <span>Paid Membership Status</span>
                  </h4>
                  {activeMemb ? (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>Active Plan: <strong className="text-white">{activeMemb.plan_name}</strong></div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setShowUpgrade(!showUpgrade)}
                            className="p-1 px-2 bg-gold/10 hover:bg-gold/20 text-gold rounded-lg hover:text-white transition-all text-[10px] font-bold"
                          >
                            Upgrade
                          </button>
                          <button
                            onClick={handleRevokeMembership}
                            className="p-1 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg hover:text-white transition-all text-[10px] font-bold"
                            title="Revoke Membership"
                          >
                            Revoke
                          </button>
                          <button
                            onClick={() => startMembershipRenewalReminder(selectedProfile.customer, activeMemb.plan_name, activeMemb.expiry_date)}
                            className="p-1 bg-green-600/10 hover:bg-green-600/20 text-green-400 rounded-lg hover:text-green-300 transition-all shrink-0"
                            title="WhatsApp Renewal Reminder"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px]">Benefits: {activeMemb.discount_percent}% Off automatically applied on checkout</div>
                      <div className="text-[10px]">Valid Until: {new Date(activeMemb.expiry_date).toLocaleDateString()}</div>
                      
                      {showUpgrade && (
                        <div className="mt-3 pt-3 border-t border-green-500/20 flex flex-col space-y-2">
                          <p className="text-[10px] text-gray-300">Select a new plan to upgrade to. You will only be charged the price difference.</p>
                          <div className="flex items-center space-x-2">
                            <select
                              value={selectedUpgradePlanId}
                              onChange={(e) => setSelectedUpgradePlanId(e.target.value)}
                              className="flex-1 bg-darkBg text-white border border-white/10 rounded-xl px-2 py-1.5 text-xs focus:ring-0 focus:outline-none"
                            >
                              <option value="">Select Upgrade Plan...</option>
                              {plans.filter(p => p.plan_id !== activeMemb.plan_id).map(p => (
                                <option key={p.plan_id} value={p.plan_id}>{p.plan_name} - ₹{p.price}</option>
                              ))}
                            </select>
                            <button
                              onClick={handleUpgradeMembership}
                              disabled={!selectedUpgradePlanId || upgradingPlan}
                              className="px-3 py-1.5 bg-gold text-darkBg font-bold rounded-xl text-xs hover:opacity-90 transition-all shrink-0"
                            >
                              {upgradingPlan ? 'Upgrading...' : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                      <p className="text-[10px] text-gray-400">No active club membership for this client account.</p>
                      <div className="flex items-center space-x-2">
                        <select
                          value={selectedPlanId}
                          onChange={(e) => setSelectedPlanId(e.target.value)}
                          className="flex-1 bg-darkBg text-white border border-white/10 rounded-xl px-2 py-1.5 text-xs focus:ring-0 focus:outline-none"
                        >
                          <option value="">Enroll in Club Plan...</option>
                          {plans.map(p => (
                            <option key={p.plan_id} value={p.plan_id}>{p.plan_name} - ₹{p.price}</option>
                          ))}
                        </select>
                        <button
                          onClick={handlePurchaseMembership}
                          disabled={!selectedPlanId || buyingPlan}
                          className="px-3 py-1.5 bg-gold text-darkBg font-bold rounded-xl text-xs hover:opacity-90 transition-all shrink-0 font-bold"
                        >
                          {buyingPlan ? 'Enrolling...' : 'Buy Plan'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Unified Activity Timeline */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-gold flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Receipt className="w-4 h-4" />
                      <span>Activity Timeline</span>
                    </div>
                    <select
                      value={billFilter}
                      onChange={(e) => setBillFilter(e.target.value)}
                      className="bg-darkBg text-white border border-white/10 rounded px-2 py-1 text-[10px] focus:ring-0 focus:outline-none ml-2 font-normal normal-case"
                    >
                      <option value="All">All Types</option>
                      <option value="Bills">Prescription/Regular</option>
                      <option value="Sunglasses">Sunglasses</option>
                      <option value="Eye Test">Eye Tests</option>
                      <option value="Repair">Repairs</option>
                      <option value="Referral">Referrals</option>
                    </select>
                  </h4>
                  {activities.length > 0 ? (
                    <div className="space-y-2">
                      {activities.map(act => (
                        <div key={act._type + '_' + (act.id || act.eyetest_id || act.repair_id || act.referral_id)} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                          {act._type === 'Bills' || act._type === 'Sunglasses' ? (
                            <>
                              <div>
                                <span className="font-extrabold text-white">{act.invoice_number || act.id}</span>
                                {act.store_name && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-gold/10 border border-gold/20 text-gold text-[8px] font-bold rounded">
                                    {act.store_name}
                                  </span>
                                )}
                                <span className="text-gray-500 text-[10px] ml-2">{act.date.toLocaleDateString()}</span>
                                <span className="ml-2 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-bold rounded">{act._type}</span>
                                {act.warranty_expiry_date && (
                                  <span className={`ml-2 px-1.5 py-0.5 text-[8px] font-bold rounded ${
                                    new Date(act.warranty_expiry_date) < new Date() 
                                      ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                                      : 'bg-green-500/10 border border-green-500/20 text-green-400'
                                  }`}>
                                    Warranty: {new Date(act.warranty_expiry_date).toLocaleDateString()}
                                  </span>
                                )}
                                <p className="text-[10px] text-gray-400 mt-0.5">{act.brand} {act.frame_name || 'Walk-in item'}</p>
                              </div>
                              <div className="text-right flex items-center space-x-3">
                                <div>
                                  <span className="font-bold text-white block">{formatCurrency(act.total_amount)}</span>
                                  {act.due_amount > 0 && (
                                    <button 
                                      onClick={() => startWhatsAppChat(selectedProfile.customer, 'payment', { due: act.due_amount })}
                                      className="text-[9px] text-red-400 underline font-semibold mt-0.5 hover:text-red-300"
                                    >
                                      Due: {formatCurrency(act.due_amount)} 📢
                                    </button>
                                  )}
                                </div>
                                <a 
                                  href={`https://wa.me/91${selectedProfile.customer.mobile}?text=${encodeURIComponent(`Hi ${selectedProfile.customer.name}, your bill/invoice (${act.invoice_number || act.id}) for Rs. ${act.total_amount} is available. Thank you for visiting ${tenant?.business_name || 'us'}!`)}`}
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="p-1.5 bg-green-600/20 hover:bg-green-600/40 rounded-lg text-green-400 hover:text-green-300 ml-2" 
                                  title="Share Invoice on WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                                <a href={`/api/v1/public/bills/${act.id}/pdf`} target="_blank" rel="noreferrer" className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white ml-2" title="View Invoice">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </>
                          ) : act._type === 'Eye Test' ? (
                            <>
                              <div>
                                <span className="font-bold text-white">{act.vision_category} Vision Test</span>
                                {act.store_name && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-gold/10 border border-gold/20 text-gold text-[8px] font-bold rounded">
                                    {act.store_name}
                                  </span>
                                )}
                                <span className="text-gray-500 text-[10px] ml-2">{act.date.toLocaleDateString()}</span>
                                <span className="ml-2 px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-bold rounded">Eye Test</span>
                                <p className="text-[10px] text-gray-400 mt-0.5">RE SPH: {act.re_sph || '0.00'} • LE SPH: {act.le_sph || '0.00'}</p>
                              </div>
                              {act.prescription_pdf_url && (
                                <a href={act.prescription_pdf_url} target="_blank" rel="noreferrer" className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white" title="View Prescription">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </>
                          ) : act._type === 'Repair' ? (
                            <>
                              <div>
                                <span className="font-bold text-white">{act.frame_details}</span>
                                {act.store_name && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-gold/10 border border-gold/20 text-gold text-[8px] font-bold rounded">
                                    {act.store_name}
                                  </span>
                                )}
                                <span className="text-gray-500 text-[10px] ml-2">{act.date.toLocaleDateString()}</span>
                                <span className="ml-2 px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[8px] font-bold rounded">Repair</span>
                                <p className="text-[10px] text-gray-400 mt-0.5">Exp: {new Date(act.expected_date).toLocaleDateString()} • Charges: {formatCurrency(act.charges)}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                act.repair_status === 'Delivered' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                act.repair_status === 'Ready' ? 'bg-electric/10 text-electric border border-electric/20' :
                                'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                              }`}>
                                {act.repair_status}
                              </span>
                            </>
                          ) : act._type === 'Referral' ? (
                            <>
                              <div>
                                <span className="font-bold text-white">Joined Referral Program</span>
                                <span className="text-gray-500 text-[10px] ml-2">{act.date.toLocaleDateString()}</span>
                                <span className="ml-2 px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[8px] font-bold rounded">Referral</span>
                                <p className="text-[10px] text-gray-400 mt-0.5">Code: {act.referral_code} • Referrals: {act.referral_count}</p>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-gold block">{formatCurrency(act.cashback_earned)} Earned</span>
                                <span className="text-[9px] text-gray-400 block">{formatCurrency(act.cashback_used)} Used</span>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No records found for the selected type.</p>
                  )}
                </div>

              </div>

              {/* Promo campaigns block */}
              <div className="border-t border-white/5 pt-4 flex items-center justify-between gap-4">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">SMS/Promo Tools:</span>
                <button
                  onClick={() => startWhatsAppChat(selectedProfile.customer, 'offer')}
                  className="px-3.5 py-2 border border-gold/20 hover:bg-gold/5 text-gold text-xs font-bold rounded-xl transition-all"
                >
                  Send Promo Offer
                </button>
              </div>

            </div>
          ) : (
            <div className="glass-card rounded-3xl p-6 min-h-[600px] flex flex-col items-center justify-center text-center">
              <Users className="w-12 h-12 text-gray-600 mb-3" />
              <h3 className="text-white font-bold text-base">Select Customer</h3>
              <p className="text-gray-500 text-xs mt-1">Select a customer from directory list to view ledger file.</p>
            </div>
          )}
        </div>

      </div>

      {showImportWizard && (
        <SmartCustomerImport 
          onClose={() => setShowImportWizard(false)}
          onComplete={() => {
            setSelectedCustomerId(null); // Force refresh of right pane
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}
