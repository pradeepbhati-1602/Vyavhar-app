import React, { useState, useEffect } from 'react';
import { Package, Plus, Save, Edit2, Trash2, X, Check, XCircle } from 'lucide-react';
import axios from 'axios';

export default function PlanTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialForm = {
    plan_name: '',
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
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('superadmin_token');
      const res = await axios.get('http://localhost:5000/api/v1/plan-templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(res.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setFormData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('superadmin_token');
      const payload = {
        ...formData,
        max_staff_accounts: formData.max_staff_accounts ? parseInt(formData.max_staff_accounts) : null,
        max_stores: formData.max_stores ? parseInt(formData.max_stores) : null,
        max_products: formData.max_products ? parseInt(formData.max_products) : null,
        max_bills_per_month: formData.max_bills_per_month ? parseInt(formData.max_bills_per_month) : null,
      };

      if (editingId) {
        await axios.put(`http://localhost:5000/api/v1/plan-templates/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('http://localhost:5000/api/v1/plan-templates', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      setShowModal(false);
      fetchTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template. Check console.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this plan template?')) return;
    try {
      const token = localStorage.getItem('superadmin_token');
      await axios.delete(`http://localhost:5000/api/v1/plan-templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTemplates();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete template.');
    }
  };

  const openModal = (template = null) => {
    if (template) {
      setEditingId(template.id);
      setFormData({
        plan_name: template.plan_name,
        multi_store_enabled: template.multi_store_enabled,
        membership_system_enabled: template.membership_system_enabled,
        referral_system_enabled: template.referral_system_enabled,
        whatsapp_auto_send_enabled: template.whatsapp_auto_send_enabled,
        eye_test_module_enabled: template.eye_test_module_enabled,
        repair_module_enabled: template.repair_module_enabled,
        advanced_reports_enabled: template.advanced_reports_enabled,
        max_staff_accounts: template.max_staff_accounts || '',
        max_stores: template.max_stores || '',
        max_products: template.max_products || '',
        max_bills_per_month: template.max_bills_per_month || ''
      });
    } else {
      setEditingId(null);
      setFormData(initialForm);
    }
    setShowModal(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="text-gold" /> Plan Templates
          </h1>
          <p className="text-gray-400">Manage feature flags and limits for tenant subscription tiers.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-gold hover:bg-gold-light text-darkBg px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading templates...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-darkSurface border border-white/10 rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-white">{tpl.plan_name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => openModal(tpl)} className="text-gray-400 hover:text-gold"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(tpl.id)} className="text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-gray-500 font-semibold uppercase text-xs">Feature Flags</p>
                <div className="grid grid-cols-2 gap-2">
                  <span className={`flex items-center gap-1 ${tpl.multi_store_enabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {tpl.multi_store_enabled ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Multi-Store
                  </span>
                  <span className={`flex items-center gap-1 ${tpl.membership_system_enabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {tpl.membership_system_enabled ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Memberships
                  </span>
                  <span className={`flex items-center gap-1 ${tpl.referral_system_enabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {tpl.referral_system_enabled ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Referrals
                  </span>
                  <span className={`flex items-center gap-1 ${tpl.whatsapp_auto_send_enabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {tpl.whatsapp_auto_send_enabled ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} WhatsApp
                  </span>
                  <span className={`flex items-center gap-1 ${tpl.eye_test_module_enabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {tpl.eye_test_module_enabled ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Eye Tests
                  </span>
                  <span className={`flex items-center gap-1 ${tpl.repair_module_enabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {tpl.repair_module_enabled ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Repairs
                  </span>
                  <span className={`flex items-center gap-1 ${tpl.advanced_reports_enabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {tpl.advanced_reports_enabled ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Adv. Reports
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm border-t border-white/5 pt-4">
                <p className="text-gray-500 font-semibold uppercase text-xs">Usage Limits</p>
                <div className="grid grid-cols-2 gap-2 text-gray-300">
                  <div>Staff: <span className="text-white font-mono">{tpl.max_staff_accounts || '∞'}</span></div>
                  <div>Stores: <span className="text-white font-mono">{tpl.max_stores || '∞'}</span></div>
                  <div>Products: <span className="text-white font-mono">{tpl.max_products || '∞'}</span></div>
                  <div>Bills/mo: <span className="text-white font-mono">{tpl.max_bills_per_month || '∞'}</span></div>
                </div>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-xl">
              No plan templates defined yet. Click "New Template" to create one.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-darkSurface border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-darkSurface border-b border-white/5 p-6 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-white">{editingId ? 'Edit Plan Template' : 'New Plan Template'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase">Template Name</label>
                <input
                  type="text" required name="plan_name" value={formData.plan_name} onChange={handleChange}
                  className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  placeholder="e.g. Premium Plan"
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-gold font-bold text-sm uppercase">Feature Flags</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'multi_store_enabled', label: 'Multi-Store Support' },
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
              </div>

              <div className="space-y-4">
                <h3 className="text-gold font-bold text-sm uppercase">Usage Limits (Leave blank for unlimited)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Max Staff Accounts</label>
                    <input type="number" min="1" name="max_staff_accounts" value={formData.max_staff_accounts} onChange={handleChange}
                           className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Max Stores</label>
                    <input type="number" min="1" name="max_stores" value={formData.max_stores} onChange={handleChange}
                           className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Max Products</label>
                    <input type="number" min="1" name="max_products" value={formData.max_products} onChange={handleChange}
                           className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Max Bills/Month</label>
                    <input type="number" min="1" name="max_bills_per_month" value={formData.max_bills_per_month} onChange={handleChange}
                           className="w-full bg-darkBg border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 rounded-lg font-bold text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" className="bg-gold hover:bg-gold-light text-darkBg px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save Template
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
