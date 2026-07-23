import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Building2, User, CreditCard, Loader2, Package, Check, XCircle } from 'lucide-react';
import axios from 'axios';

export default function ClientForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [templates, setTemplates] = useState([]);

  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    owner_email: '',
    owner_mobile: '',
    shop_address: '',
    gst_number: '',
    subscription_plan: 'MONTHLY',
    subscription_price: '0',
    trial_days: '',
    password: '',
    plan_template_id: '',
    multi_store_enabled: false,
    membership_system_enabled: true,
    referral_system_enabled: true,
    whatsapp_auto_send_enabled: true,
    eye_test_module_enabled: true,
    repair_module_enabled: true,
    advanced_reports_enabled: true,
    max_staff_accounts: '',
    max_stores: '',
    max_products: '',
    max_bills_per_month: ''
  });

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const token = localStorage.getItem('superadmin_token');
        const res = await axios.get('http://localhost:5000/api/v1/plan-templates', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTemplates(res.data);
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    };
    fetchTemplates();
  }, []);

  const handleTemplateChange = (e) => {
    const tplId = e.target.value;
    const tpl = templates.find(t => t.id === tplId);
    
    setFormData(prev => ({
      ...prev,
      plan_template_id: tplId,
      ...(tpl ? {
        multi_store_enabled: tpl.multi_store_enabled,
        membership_system_enabled: tpl.membership_system_enabled,
        referral_system_enabled: tpl.referral_system_enabled,
        whatsapp_auto_send_enabled: tpl.whatsapp_auto_send_enabled,
        eye_test_module_enabled: tpl.eye_test_module_enabled,
        repair_module_enabled: tpl.repair_module_enabled,
        advanced_reports_enabled: tpl.advanced_reports_enabled,
        max_staff_accounts: tpl.max_staff_accounts || '',
        max_stores: tpl.max_stores || '',
        max_products: tpl.max_products || '',
        max_bills_per_month: tpl.max_bills_per_month || ''
      } : {})
    }));
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleToggle = (key) => {
    setFormData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('superadmin_token');
      const payload = {
        ...formData,
        max_staff_accounts: formData.max_staff_accounts ? parseInt(formData.max_staff_accounts) : null,
        max_stores: formData.max_stores ? parseInt(formData.max_stores) : null,
        max_products: formData.max_products ? parseInt(formData.max_products) : null,
        max_bills_per_month: formData.max_bills_per_month ? parseInt(formData.max_bills_per_month) : null,
      };

      const res = await axios.post('http://localhost:5000/api/v1/superadmin/tenants', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Client created successfully!');
      setCredentials(res.data.credentials);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-darkBg text-gray-200 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-darkSurface border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Add New Client</h1>
            <p className="text-gray-500 text-sm">Provision a new Eyevengers tenant.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {success && credentials && (
          <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl">
            <h3 className="text-green-400 font-bold text-lg mb-2">{success}</h3>
            <p className="text-gray-300 text-sm mb-4">Please copy these credentials and share them with the owner securely. They will not be shown again.</p>
            
            <div className="bg-black/40 p-4 rounded-xl font-mono text-sm space-y-2 border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Login URL:</span>
                <span className="text-gold font-bold">eyevengers.com/login</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Owner Email:</span>
                <span className="text-white">{credentials.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Password:</span>
                <span className="text-white bg-white/10 px-2 py-0.5 rounded">{credentials.password}</span>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/')}
              className="mt-6 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="bg-darkSurface border border-white/5 p-8 rounded-3xl shadow-xl space-y-8">
            
            {/* Section 1: Business Details */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-gold pb-2 border-b border-white/5">
                <Building2 className="w-5 h-5" />
                <h3 className="font-bold text-lg tracking-wide">Business Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Business / Shop Name *</label>
                  <input type="text" name="business_name" value={formData.business_name} onChange={handleChange} required className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">GST Number (Optional)</label>
                  <input type="text" name="gst_number" value={formData.gst_number} onChange={handleChange} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Full Address</label>
                  <input type="text" name="shop_address" value={formData.shop_address} onChange={handleChange} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors" />
                </div>
              </div>
            </div>

            {/* Section 2: Owner Details */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-gold pb-2 border-b border-white/5">
                <User className="w-5 h-5" />
                <h3 className="font-bold text-lg tracking-wide">Owner Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Full Name *</label>
                  <input type="text" name="owner_name" value={formData.owner_name} onChange={handleChange} required className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Mobile Number *</label>
                  <input type="text" name="owner_mobile" value={formData.owner_mobile} onChange={handleChange} required className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors" />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Email Address * (Used for login)</label>
                  <input type="email" name="owner_email" value={formData.owner_email} onChange={handleChange} required className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors" />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Login Password *</label>
                  <input type="text" name="password" value={formData.password} onChange={handleChange} required className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors" />
                </div>
              </div>
            </div>

            {/* Section 3: Subscription Plan */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-gold pb-2 border-b border-white/5">
                <CreditCard className="w-5 h-5" />
                <h3 className="font-bold text-lg tracking-wide">Billing details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Plan Type</label>
                  <select name="subscription_plan" value={formData.subscription_plan} onChange={handleChange} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors appearance-none">
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Agreed Price (₹)</label>
                  <input type="number" name="subscription_price" value={formData.subscription_price} onChange={handleChange} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Free Trial (Days)</label>
                  <input type="number" name="trial_days" value={formData.trial_days} onChange={handleChange} placeholder="Optional" className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors" />
                </div>
              </div>
            </div>

            {/* Section 4: Features & Limits */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-gold pb-2 border-b border-white/5">
                <Package className="w-5 h-5" />
                <h3 className="font-bold text-lg tracking-wide">Features & Limits</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Apply Plan Template</label>
                  <select 
                    value={formData.plan_template_id} 
                    onChange={handleTemplateChange}
                    className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors appearance-none"
                  >
                    <option value="">-- Custom Settings --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.plan_name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">Selecting a template will auto-fill the limits and flags below. You can still manually override them.</p>
                </div>

                <h4 className="text-sm font-semibold text-gray-400 uppercase pt-2">Feature Flags</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: 'multi_store_enabled', label: 'Multi-Store' },
                    { key: 'membership_system_enabled', label: 'Memberships' },
                    { key: 'referral_system_enabled', label: 'Referrals' },
                    { key: 'whatsapp_auto_send_enabled', label: 'WhatsApp Auto-Send' },
                    { key: 'eye_test_module_enabled', label: 'Eye Tests' },
                    { key: 'repair_module_enabled', label: 'Repairs' },
                    { key: 'advanced_reports_enabled', label: 'Advanced Reports' }
                  ].map(f => (
                    <label key={f.key} className="flex items-center space-x-3 cursor-pointer bg-darkBg p-3 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                      <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${formData[f.key] ? 'bg-green-500' : 'bg-gray-700'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formData[f.key] ? 'translate-x-4' : ''}`} />
                      </div>
                      <input type="checkbox" className="hidden" checked={formData[f.key]} onChange={() => handleToggle(f.key)} />
                      <span className="text-sm font-medium text-gray-300">{f.label}</span>
                    </label>
                  ))}
                </div>

                <h4 className="text-sm font-semibold text-gray-400 uppercase pt-2">Usage Limits (Blank = Unlimited)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Max Staff</label>
                    <input type="number" min="1" name="max_staff_accounts" value={formData.max_staff_accounts} onChange={handleChange} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2 text-white focus:border-gold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Max Stores</label>
                    <input type="number" min="1" name="max_stores" value={formData.max_stores} onChange={handleChange} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2 text-white focus:border-gold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Max Products</label>
                    <input type="number" min="1" name="max_products" value={formData.max_products} onChange={handleChange} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2 text-white focus:border-gold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Max Bills/Mo</label>
                    <input type="number" min="1" name="max_bills_per_month" value={formData.max_bills_per_month} onChange={handleChange} className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-2 text-white focus:border-gold outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-end space-x-4 border-t border-white/5">
              <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 font-bold text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex items-center space-x-2 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-light hover:to-gold text-darkBg font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-gold/20 disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span>Provision Client</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
