import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, CreditCard, Activity, Search, 
  Plus, MoreVertical, ShieldAlert, CheckCircle2, 
  XCircle, Clock, Settings, Edit, LogOut, DollarSign, Download, List, Layers, Trash2
} from 'lucide-react';
import FeatureManagementPanel from '../components/FeatureManagementPanel';

export default function SuperAdminDashboard({ user, onLogout }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' or 'features'

  // Form states
  const [formData, setFormData] = useState({
    business_name: '', owner_name: '', owner_email: '', owner_mobile: '',
    password: '', subscription_plan: 'MONTHLY', trial_days: '',
    features: {}
  });

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/v1/superadmin/tenants', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/superadmin/tenants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        alert('Tenant created successfully!');
        setShowCreateModal(false);
        setFormData({
          business_name: '', owner_name: '', owner_email: '', owner_mobile: '',
          password: '', subscription_plan: 'MONTHLY', trial_days: '',
          features: {}
        });
        fetchTenants();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditTenant = async (e) => {
    e.preventDefault();
    try {
      let oldFeatures = {};
      if (typeof selectedTenant.features === 'string') {
        try { oldFeatures = JSON.parse(selectedTenant.features); } catch(e) {}
      } else if (selectedTenant.features) {
        oldFeatures = selectedTenant.features;
      }

      // Diff features
      const featureLogs = [];
      Object.keys(formData.features).forEach(key => {
        const oldVal = oldFeatures[key] !== false; // default true if undefined
        const newVal = formData.features[key];
        if (oldVal !== newVal) {
          featureLogs.push({
            feature_key: key,
            old_value: oldVal,
            new_value: newVal,
            reason: 'Super Admin UI Update'
          });
        }
      });

      const payload = {
        ...formData,
        featureLogs
      };

      const res = await fetch(`/api/v1/superadmin/tenants/${selectedTenant.tenant_id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Tenant updated successfully!');
        setShowEditModal(false);
        fetchTenants();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (tenantId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to mark this tenant as ${newStatus}?`)) return;
    
    try {
      const res = await fetch(`/api/v1/superadmin/tenants/${tenantId}/toggle-status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTenants();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTenant = async (tenantId, businessName) => {
    if (!window.confirm(`Are you sure you want to completely delete "${businessName}"? This action cannot be undone and will erase all their data.`)) return;
    
    try {
      const res = await fetch(`/api/v1/superadmin/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        alert('Tenant deleted successfully!');
        fetchTenants();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete tenant');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markPaid = async (tenantId) => {
    if (!window.confirm('Are you sure you want to mark this tenant as PAID and extend their subscription?')) return;
    
    try {
      const res = await fetch(`/api/v1/superadmin/tenants/${tenantId}/mark-paid`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        fetchTenants();
        alert('Subscription extended successfully!');
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const downloadData = async (tenant) => {
    try {
      const res = await fetch(`/api/v1/superadmin/tenants/${tenant.tenant_id}/export`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        return alert(err.error || 'Failed to export data');
      }
      
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tenant.business_name.replace(/\s+/g, '_').toLowerCase()}_export.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Error exporting data');
    }
  };

  const openEditModal = (tenant) => {
    setSelectedTenant(tenant);
    let parsedFeatures = {};
    if (typeof tenant.features === 'string') {
      try { parsedFeatures = JSON.parse(tenant.features); } catch (e) {}
    } else if (tenant.features) {
      parsedFeatures = tenant.features;
    }
    
    // Backwards compatibility with old fields
    if (tenant.multi_store_enabled && parsedFeatures.multi_store === undefined) parsedFeatures.multi_store = true;
    if (tenant.whatsapp_auto_send_enabled && parsedFeatures.whatsapp === undefined) parsedFeatures.whatsapp = true;
    if (tenant.eye_test_module_enabled && parsedFeatures.eye_test === undefined) parsedFeatures.eye_test = true;
    if (tenant.repair_module_enabled && parsedFeatures.repair_orders === undefined) parsedFeatures.repair_orders = true;
    if (tenant.membership_system_enabled && parsedFeatures.membership_system === undefined) parsedFeatures.membership_system = true;
    if (tenant.referral_system_enabled && parsedFeatures.referral_system === undefined) parsedFeatures.referral_system = true;
    if (tenant.advanced_reports_enabled && parsedFeatures.reports === undefined) parsedFeatures.reports = true;

    setFormData({
      business_name: tenant.business_name,
      owner_name: tenant.owner_name,
      owner_email: tenant.owner_email,
      owner_mobile: tenant.owner_mobile,
      subscription_plan: tenant.subscription_plan,
      features: parsedFeatures
    });
    setActiveTab('basic');
    setShowEditModal(true);
  };

  const filteredTenants = tenants.filter(t => 
    t.business_name.toLowerCase().includes(search.toLowerCase()) || 
    t.owner_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-darkBg text-gray-200 p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-red-600 to-red-400 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Super Admin Console</h1>
            <p className="text-sm text-gray-400">Manage all SaaS tenants and platform settings</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-xl transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-semibold text-sm">Sign Out</span>
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="glass-card p-6 rounded-2xl border border-white/5">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-semibold">Total Shops</p>
              <h3 className="text-2xl font-bold text-white">{tenants.length}</h3>
            </div>
          </div>
        </div>
        <div className="glass-card p-6 rounded-2xl border border-white/5">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-500/10 text-green-400 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-semibold">Active Subscribers</p>
              <h3 className="text-2xl font-bold text-white">
                {tenants.filter(t => t.subscription_status === 'ACTIVE').length}
              </h3>
            </div>
          </div>
        </div>
        <div className="glass-card p-6 rounded-2xl border border-white/5">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-semibold">Suspended / Expired</p>
              <h3 className="text-2xl font-bold text-white">
                {tenants.filter(t => t.subscription_status === 'SUSPENDED' || t.subscription_status === 'EXPIRED').length}
              </h3>
            </div>
          </div>
        </div>
        <div className="glass-card p-6 rounded-2xl border border-white/5">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gold/10 text-gold rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-semibold">On Trial</p>
              <h3 className="text-2xl font-bold text-white">
                {tenants.filter(t => t.subscription_status === 'TRIAL').length}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="glass-card border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[600px]">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-darkSurface/50">
          <div className="relative w-80">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search tenants..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-darkBg border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 transition-all"
            />
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard New Shop</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-darkSurface/30 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Business Name</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Owner Details</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan="5" className="text-center py-8 text-gray-500">Loading tenants...</td></tr>
              ) : filteredTenants.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-8 text-gray-500">No tenants found.</td></tr>
              ) : (
                filteredTenants.map(tenant => (
                  <tr key={tenant.tenant_id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-darkSurface flex items-center justify-center font-bold text-white shadow-sm border border-white/5">
                          {tenant.business_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white">{tenant.business_name}</p>
                          <p className="text-xs text-gray-500">Created: {new Date(tenant.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-white text-sm">{tenant.owner_name}</p>
                      <p className="text-xs text-gray-400 mt-1"><span className="font-semibold">Username:</span> {tenant.owner_email}</p>
                      <p className="text-xs text-gray-400"><span className="font-semibold">Phone:</span> {tenant.owner_mobile}</p>
                      <p className="text-xs text-gray-400"><span className="font-semibold">Password:</span> {tenant.settings?.find(s => s.key === '_owner_password')?.value || '*** (Hidden)'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md bg-white/5 text-xs font-bold border border-white/10 text-gray-300">
                        {tenant.subscription_plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {tenant.subscription_status === 'ACTIVE' ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          <span>ACTIVE</span>
                        </span>
                      ) : tenant.subscription_status === 'TRIAL' ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-gold/10 text-gold text-xs font-bold border border-gold/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-gold"></span>
                          <span>TRIAL</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          <span>{tenant.subscription_status}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => downloadData(tenant)}
                          className="p-1.5 hover:bg-blue-500/20 rounded-lg text-blue-500/70 hover:text-blue-400"
                          title="Export Data"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => markPaid(tenant.tenant_id)}
                          className="p-1.5 hover:bg-green-500/20 rounded-lg text-green-500/70 hover:text-green-400"
                          title="Mark Paid / Extend Subscription"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openEditModal(tenant)}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                          title="Edit Tenant"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleStatus(tenant.tenant_id, tenant.subscription_status)}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                          title="Toggle Status"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteTenant(tenant.tenant_id, tenant.business_name)}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-500/70 hover:text-red-400"
                          title="Delete Tenant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkBg/90 backdrop-blur-sm">
          <div className="bg-darkSurface border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in-up">
            <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-darkSurface/90 backdrop-blur-md z-10">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Plus className="w-5 h-5 mr-2 text-red-500" />
                Onboard New Tenant
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex border-b border-white/5 px-6">
              <button 
                className={`py-4 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'basic' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('basic')}
              >
                <div className="flex items-center space-x-2">
                  <List className="w-4 h-4" />
                  <span>Basic Information</span>
                </div>
              </button>
              <button 
                className={`py-4 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'features' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('features')}
              >
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4" />
                  <span>Feature Management</span>
                </div>
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="p-6 space-y-6 bg-darkBg/30">
              {activeTab === 'basic' ? (
                <div className="grid grid-cols-2 gap-6 animate-fade-in">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Business Name *</label>
                    <input type="text" required value={formData.business_name} onChange={e => setFormData({...formData, business_name: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Owner Name *</label>
                    <input type="text" required value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Owner Email *</label>
                    <input type="email" required value={formData.owner_email} onChange={e => setFormData({...formData, owner_email: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Owner Mobile *</label>
                    <input type="text" required value={formData.owner_mobile} onChange={e => setFormData({...formData, owner_mobile: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Password *</label>
                    <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" placeholder="Minimum 6 characters" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Trial Days</label>
                    <input type="number" placeholder="Optional (e.g., 14)" value={formData.trial_days} onChange={e => setFormData({...formData, trial_days: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" />
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className="mb-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-white">Feature Management</h3>
                      <p className="text-sm text-gray-400">Configure modules, widgets, and settings for this client.</p>
                    </div>
                  </div>
                  <FeatureManagementPanel 
                    features={formData.features} 
                    setFeatures={(f) => setFormData({ ...formData, features: f })} 
                  />
                </div>
              )}

              <div className="flex justify-between items-center pt-6 mt-6 border-t border-white/5">
                {activeTab === 'features' ? (
                  <button type="button" onClick={() => setActiveTab('basic')} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all">
                    Back to Basic Info
                  </button>
                ) : (
                  <button type="button" onClick={() => setActiveTab('features')} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all">
                    Next: Manage Features
                  </button>
                )}
                <button type="submit" className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all">
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL (Enhanced) */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkBg/90 backdrop-blur-sm">
          <div className="bg-darkSurface border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in-up">
            <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-darkSurface/90 backdrop-blur-md z-10">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Edit className="w-5 h-5 mr-2 text-red-500" />
                Edit Settings: {selectedTenant?.business_name}
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex border-b border-white/5 px-6">
              <button 
                className={`py-4 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'basic' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('basic')}
              >
                <div className="flex items-center space-x-2">
                  <List className="w-4 h-4" />
                  <span>Basic Information</span>
                </div>
              </button>
              <button 
                className={`py-4 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'features' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('features')}
              >
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4" />
                  <span>Feature Management</span>
                </div>
              </button>
            </div>
            
            <form onSubmit={handleEditTenant} className="p-6 space-y-6 bg-darkBg/30">
              {activeTab === 'basic' ? (
                <div className="grid grid-cols-2 gap-6 animate-fade-in">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Business Name *</label>
                    <input type="text" required value={formData.business_name} onChange={e => setFormData({...formData, business_name: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Owner Name *</label>
                    <input type="text" required value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Owner Email *</label>
                    <input type="email" required value={formData.owner_email} onChange={e => setFormData({...formData, owner_email: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Owner Mobile *</label>
                    <input type="text" required value={formData.owner_mobile} onChange={e => setFormData({...formData, owner_mobile: e.target.value})} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500" />
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className="mb-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-white">Feature Management</h3>
                      <p className="text-sm text-gray-400">Configure modules, widgets, and settings for this client.</p>
                    </div>
                  </div>
                  <FeatureManagementPanel 
                    features={formData.features} 
                    setFeatures={(f) => setFormData({ ...formData, features: f })} 
                  />
                </div>
              )}

              <div className="flex justify-between items-center pt-6 mt-6 border-t border-white/5">
                {activeTab === 'features' ? (
                  <button type="button" onClick={() => setActiveTab('basic')} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all">
                    Back to Basic Info
                  </button>
                ) : (
                  <button type="button" onClick={() => setActiveTab('features')} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all">
                    Next: Manage Features
                  </button>
                )}
                <button type="submit" className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
