import { formatCurrency } from '../utils/formatCurrency';
import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Download, Calendar, Search, 
  TrendingUp, Award, Table, Check 
} from 'lucide-react';
import { useFeatures } from '../context/FeatureContext';

export default function Reports({ user, activeStore, stores = [], triggerToast }) {
  const { hasFeature } = useFeatures();
  const [activeTab, setActiveTab] = useState('sales');
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [apiError, setApiError] = useState(null);
  const limit = 50;
  
  const [comparisonData, setComparisonData] = useState([]);
  const [loadingComparison, setLoadingComparison] = useState(false);

  useEffect(() => {
    fetchBills();
  }, [activeStore, page, search]);

  useEffect(() => {
    if (user && user.role === 'Owner' && hasFeature('multi_store') && stores.length > 1) {
      fetchComparison();
    }
  }, [stores, user]);

  const fetchComparison = async () => {
    setLoadingComparison(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/dashboard/comparison', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setComparisonData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComparison(false);
    }
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      setApiError(null);
      const res = await fetch(`/api/v1/bills?store_id=${activeStore}&is_paginated=true&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || 'Failed to fetch bills');
        setBills([]);
        return;
      }
      const actualBills = Array.isArray(data) ? data : (data.data || []);
      setBills(actualBills);
      setTotalPages(Math.ceil((data.total || 0) / (data.limit || limit)) || data.pages || 1);
    } catch (e) {
      console.error(e);
      setApiError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // CSV Exporter helper
  const exportToCSV = (filename, dataHeaders, rowsMapper, apiPath) => {
    return async () => {
      try {
        const res = await fetch(apiPath, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Add headers
        csvContent += dataHeaders.join(",") + "\n";
        
        const actualData = Array.isArray(data) ? data : (data.data || []);
        
        // Add rows
        actualData.forEach(item => {
          const row = rowsMapper(item);
          // Sanitize fields (wrap in quotes if they contain commas)
          const escapedRow = row.map(val => {
            const strVal = val === null || val === undefined ? '' : String(val);
            if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
              return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
          });
          csvContent += escapedRow.join(",") + "\n";
        });

        // Trigger download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        alert('Failed to generate report export: ' + err.message);
      }
    };
  };

  // Report configurations
  const downloadSalesReport = exportToCSV(
    "Sales_Ledger_Report",
    ["Invoice Number", "Customer Name", "Mobile", "Subtotal", "Discount", "Cashback Used", "Advance Paid", "Due Balance", "Total Bill", "Payment Status", "Bill Status", "Created Date"],
    (b) => [
      b.invoice_number || b.bill_id || b.id || 'N/A',
      b.customer_name || (b.customer ? b.customer.name : 'Unknown'),
      b.customer_mobile || (b.customer ? b.customer.mobile : 'Unknown'),
      b.subtotal,
      b.discount,
      b.cashback_used,
      b.advance_paid,
      b.due_amount,
      b.total_amount,
      b.payment_status,
      b.bill_status,
      new Date(b.created_at).toLocaleDateString()
    ],
    "/api/v1/bills"
  );

  const downloadCustomersReport = exportToCSV(
    "Customers_Registry_Report",
    ["Customer ID", "Name", "Mobile", "Birthday", "Gender", "Language", "Total Bills", "Total Spent (₹)", "Cashback Balance (₹)", "Last Visit"],
    (c) => [
      c.customer_id,
      c.name,
      c.mobile,
      c.birthday ? new Date(c.birthday).toLocaleDateString() : 'N/A',
      c.gender || 'N/A',
      c.language,
      c.total_bills,
      c.total_purchase,
      c.current_cashback,
      c.last_visit ? new Date(c.last_visit).toLocaleDateString() : 'N/A'
    ],
    "/api/v1/customers"
  );

  const downloadInventoryReport = exportToCSV(
    "Inventory_Catalog_Report",
    ["Product ID", "Barcode", "Category", "Brand", "Model Name", "Color", "Size", "Purchase Price (₹)", "Selling Price (₹)", "Stock Count", "Reorder Point"],
    (p) => [
      p.product_id,
      p.barcode,
      p.category,
      p.brand,
      p.frame_name,
      p.frame_color || '',
      p.size || '',
      p.purchase_price,
      p.selling_price,
      p.current_stock,
      p.low_stock_limit
    ],
    "/api/v1/products"
  );

  const filteredBills = bills; // API already filters by search

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Reports & Ledger Download Center</h1>
        <p className="text-gray-400 text-xs mt-1">Export transaction histories, customer registries, and inventory levels to standard Excel CSV formats.</p>
      </div>

      {/* Reports Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="glass-card p-6 rounded-3xl space-y-4 border border-white/5 hover:border-gold/20 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-gold/15 flex items-center justify-center text-gold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Sales Ledger Report</h3>
            <p className="text-xs text-gray-500 mt-1">Contains full tax invoices, subtotal sums, cashback adjustments, advances, and dues details.</p>
          </div>
          <button
            onClick={downloadSalesReport}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/5 text-xs flex items-center justify-center space-x-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV Spreadsheet</span>
          </button>
        </div>

        {/* Card 2 */}
        <div className="glass-card p-6 rounded-3xl space-y-4 border border-white/5 hover:border-electric/20 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-electric/15 flex items-center justify-center text-electric">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Customers Directory Registry</h3>
            <p className="text-xs text-gray-500 mt-1">Exports complete client profiles, telephone numbers, birthdates, visit summaries, and cashbacks.</p>
          </div>
          <button
            onClick={downloadCustomersReport}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/5 text-xs flex items-center justify-center space-x-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV Spreadsheet</span>
          </button>
        </div>

        {/* Card 3 */}
        <div className="glass-card p-6 rounded-3xl space-y-4 border border-white/5 hover:border-white/10 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-300">
            <Table className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Inventory Catalog Inventory</h3>
            <p className="text-xs text-gray-500 mt-1">Extracts active barcode SKUs, wholesale purchasing price, selling rates, and physical stock level counts.</p>
          </div>
          <button
            onClick={downloadInventoryReport}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/5 text-xs flex items-center justify-center space-x-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV Spreadsheet</span>
          </button>
        </div>
      </div>

      {/* Feature 6: Store Performance Comparison Table */}
      {user && user.role === 'Owner' && hasFeature('multi_store') && stores.length > 1 && (
        <div className="glass-card rounded-3xl p-6 flex flex-col space-y-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-gold" />
            <span>Store Performance Comparison</span>
          </h3>

          <div className="overflow-x-auto">
            {loadingComparison ? (
              <div className="h-32 flex items-center justify-center text-xs text-gray-500 animate-pulse">
                COMPILING STORE METRICS...
              </div>
            ) : comparisonData.length > 0 ? (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400">
                    <th className="pb-3 pr-2">LOCATION</th>
                    <th className="pb-3 text-right pr-2">TODAY SALES</th>
                    <th className="pb-3 text-center pr-2">TODAY ORDERS</th>
                    <th className="pb-3 text-right pr-2">THIS MONTH</th>
                    <th className="pb-3 text-center pr-2">MONTH ORDERS</th>
                    <th className="pb-3 text-right pr-2">TOTAL SALES</th>
                    <th className="pb-3 text-center pr-2">TOTAL ORDERS</th>
                    <th className="pb-3 text-right">AVG ORDER VALUE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {comparisonData.map(c => (
                    <tr key={c.store_id} className="hover:bg-white/5">
                      <td className="py-4 pr-2 font-bold text-white">{c.store_name}</td>
                      <td className="py-4 text-right pr-2 text-gold font-bold">{formatCurrency(c.today.revenue)}</td>
                      <td className="py-4 text-center pr-2 font-mono text-gray-300">{c.today.bills}</td>
                      <td className="py-4 text-right pr-2 text-white font-extrabold">{formatCurrency(c.monthly.revenue)}</td>
                      <td className="py-4 text-center pr-2 font-mono text-gray-300">{c.monthly.bills}</td>
                      <td className="py-4 text-right pr-2 text-emerald-400 font-extrabold">{formatCurrency(c.overall.revenue)}</td>
                      <td className="py-4 text-center pr-2 font-mono text-gray-300">{c.overall.bills}</td>
                      <td className="py-4 text-right font-extrabold text-white">{formatCurrency(c.overall.aov)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-500 text-xs">
                No store data logs available.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Invoices logs tracker */}
      <div className="glass-card rounded-3xl p-6 flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-gold" />
            <span>Recent Invoice Registers</span>
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search invoice number, name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-64 pl-9 py-2 px-3 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {apiError ? (
            <div className="h-32 flex items-center justify-center text-xs text-red-500 font-bold">
              API ERROR: {apiError}
            </div>
          ) : loading ? (
            <div className="h-32 flex items-center justify-center text-xs text-gray-500 animate-pulse">
              LOADING RECENT TRANSACTIONS...
            </div>
          ) : filteredBills.length > 0 ? (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-400">
                  <th className="pb-3 pr-2">INVOICE</th>
                  <th className="pb-3 pr-2">CUSTOMER</th>
                  <th className="pb-3 pr-2">DATE</th>
                  <th className="pb-3 text-right pr-2">SUBTOTAL</th>
                  <th className="pb-3 text-right pr-2">DUE AMT</th>
                  <th className="pb-3 text-right pr-2">BILL TOTAL</th>
                  <th className="pb-3 text-center pr-2">PAY STATUS</th>
                  <th className="pb-3 text-center">BILL STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {filteredBills.map(b => (
                  <tr key={b.id || b.bill_id} className="hover:bg-white/5">
                    <td className="py-3.5 pr-2 font-mono font-bold text-gold">{b.invoice_number || b.bill_id || b.id || 'N/A'}</td>
                    <td className="py-3.5 pr-2">
                      <span className="font-bold text-white block leading-tight">{b.customer_name || (b.customer ? b.customer.name : 'Unknown')}</span>
                      <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">{b.customer_mobile || (b.customer ? b.customer.mobile : 'Unknown')}</span>
                    </td>
                    <td className="py-3.5 pr-2 text-gray-400">{new Date(b.created_at).toLocaleDateString()}</td>
                    <td className="py-3.5 text-right pr-2">{formatCurrency(b.subtotal)}</td>
                    <td className="py-3.5 text-right pr-2 font-bold text-red-400">{formatCurrency(b.due_amount)}</td>
                    <td className="py-3.5 text-right pr-2 font-extrabold text-white">{formatCurrency(b.total_amount)}</td>
                    <td className="py-3.5 text-center pr-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                        b.payment_status === 'Paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        b.payment_status === 'Partial' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {b.payment_status}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                        b.bill_status === 'Active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {b.bill_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-500 text-xs">
              No bills registered in this period.
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
    </div>
  );
}
