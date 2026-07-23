import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Search, Activity, Clock, Shield, LogOut, CheckCircle2, XCircle, MoreVertical, LayoutDashboard, Package, Settings } from 'lucide-react';
import axios from 'axios';

export default function Dashboard() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const token = localStorage.getItem('superadmin_token');
      const res = await axios.get('http://localhost:5000/api/v1/superadmin/tenants', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTenants(res.data);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('superadmin_token');
        navigate('/login');
      }
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('superadmin_token');
    navigate('/login');
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const token = localStorage.getItem('superadmin_token');
      await axios.post(`http://localhost:5000/api/v1/superadmin/tenants/${id}/toggle-status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTenants();
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const markPaid = async (id) => {
    try {
      const token = localStorage.getItem('superadmin_token');
      await axios.post(`http://localhost:5000/api/v1/superadmin/tenants/${id}/mark-paid`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTenants();
    } catch (error) {
      console.error('Failed to mark paid:', error);
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.owner_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = tenants.filter(t => t.subscription_status === 'ACTIVE').length;
  const trialCount = tenants.filter(t => t.subscription_status === 'TRIAL').length;

  return (
    <div className="min-h-screen bg-darkBg text-gray-200">
      {/* Top Navigation */}
      <nav className="h-16 border-b border-white/5 bg-darkSurface/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-gold to-gold-light flex items-center justify-center font-bold text-darkBg">
            <Shield className="w-5 h-5" />
          </div>
          <span className="font-bold text-white tracking-wide">Eyevengers Admin</span>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-darkSurface border border-white/5 p-6 rounded-2xl flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Clients</p>
              <h3 className="text-2xl font-bold text-white">{tenants.length}</h3>
            </div>
          </div>
          <div className="bg-darkSurface border border-white/5 p-6 rounded-2xl flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-400 text-sm font-medium">Active Subs</p>
              <h3 className="text-2xl font-bold text-white">{activeCount}</h3>
            </div>
          </div>
          <div className="bg-darkSurface border border-white/5 p-6 rounded-2xl flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-400 text-sm font-medium">In Trial</p>
              <h3 className="text-2xl font-bold text-white">{trialCount}</h3>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-gold transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-darkSurface border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
              placeholder="Search by business or email..."
            />
          </div>
          
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-4">
            <button
              onClick={() => navigate('/plan-templates')}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-darkSurface border border-white/10 hover:bg-white/5 text-white font-bold py-2.5 px-6 rounded-xl transition-all"
            >
              <Package className="w-5 h-5" />
              <span>Plan Templates</span>
            </button>
            <button
              onClick={() => navigate('/add-client')}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-light hover:to-gold text-darkBg font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-gold/20"
            >
              <Plus className="w-5 h-5" />
              <span>Add New Client</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-darkSurface border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/20 text-gray-400 uppercase text-xs font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Business Details</th>
                  <th className="px-6 py-4">Plan & Expiry</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                      Loading clients...
                    </td>
                  </tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                      No clients found.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => (
                    <tr key={tenant.tenant_id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-darkBg border border-white/10 flex items-center justify-center font-bold text-white">
                            {tenant.business_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-white">{tenant.business_name}</p>
                            <p className="text-xs text-gray-500">{tenant.owner_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-300">{tenant.subscription_plan}</p>
                        <p className="text-xs text-gray-500 flex items-center mt-1">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(tenant.subscription_expiry_date).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                          tenant.subscription_status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' :
                          tenant.subscription_status === 'TRIAL' ? 'bg-blue-500/10 text-blue-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {tenant.subscription_status === 'ACTIVE' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {tenant.subscription_status === 'EXPIRED' && <XCircle className="w-3.5 h-3.5" />}
                          {tenant.subscription_status === 'SUSPENDED' && <XCircle className="w-3.5 h-3.5" />}
                          <span>{tenant.subscription_status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => markPaid(tenant.tenant_id)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                          >
                            Mark Paid
                          </button>
                          <button 
                            onClick={() => toggleStatus(tenant.tenant_id, tenant.subscription_status)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                          >
                            {tenant.subscription_status === 'ACTIVE' ? 'Suspend' : 'Activate'}
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
      </main>
    </div>
  );
}
