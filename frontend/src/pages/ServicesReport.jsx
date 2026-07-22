import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Download, Calendar, Printer, Search, RefreshCw, 
  Layers, Package, Star, Award, ChevronUp, ChevronDown
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { useNavigate } from 'react-router-dom';
import CurrencySymbol from '../components/CurrencySymbol';
import { getLocalDateBounds, localStrIsWithinBounds } from '../utils/dateFilters';
import { t } from '../utils/translations';
import Pagination from '../components/Pagination';
import styles from './ServicesReport.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

const COLORS = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

export default function ServicesReport() {
  const { settings } = useSettings();
  const navigate = useNavigate();

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAuthorized = user.role === 'super_admin' || user.role === 'manager';

  useEffect(() => {
    if (!isAuthorized) navigate('/');
  }, [isAuthorized, navigate]);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [dateRange, setDateRange] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Table Sorting State
  const [sortField, setSortField] = useState('revenue'); // 'name', 'category', 'qty', 'revenue'
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, customStart, customEnd, searchTerm, sortField, sortAsc]);

  const fetchOrders = async () => {
    if (!window.electronAPI?.dbQuery) return;
    try {
      setLoading(true);
      // Fetch all active orders
      const res = await window.electronAPI.dbQuery(
        "SELECT id, billNumber, totalAmount, items, status, createdAt FROM orders ORDER BY createdAt DESC",
        []
      );
      if (res.success) {
        setOrders(res.data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Failed to fetch services report orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchOrders();
    }
  }, [isAuthorized]);

  // Filter orders by date range using dateFilters helper
  const filteredOrders = useMemo(() => {
    const bounds = getLocalDateBounds(dateRange, customStart, customEnd);
    if (bounds === false) return []; // custom start/end dates are not completed yet
    
    return orders.filter(order => {
      return localStrIsWithinBounds(order.createdAt, bounds);
    });
  }, [orders, dateRange, customStart, customEnd]);

  // Aggregate all metrics and chart datasets in JavaScript
  const reportData = useMemo(() => {
    let totalItems = 0;
    let totalAddons = 0;
    const serviceMap = {};
    const categoryMap = {};
    const typeMap = {};
    const addonMap = {};

    filteredOrders.forEach(order => {
      let items = [];
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
      } catch (e) {
        console.error('Error parsing order items JSON:', e);
      }

      if (Array.isArray(items)) {
        items.forEach(item => {
          const qty = parseInt(item.qty || item.quantity || 1, 10);
          const price = parseFloat(item.price || 0);
          const name = item.name || 'Unknown Service';
          const category = item.category || 'Standard';
          const revenue = price * qty;

          totalItems += qty;

          // 1. Service Item Map
          if (!serviceMap[name]) {
            serviceMap[name] = { name, category, unitPrice: price, qty: 0, revenue: 0 };
          }
          serviceMap[name].qty += qty;
          serviceMap[name].revenue += revenue;

          // 2. Category Map
          if (!categoryMap[category]) {
            categoryMap[category] = { name: category, qty: 0, revenue: 0 };
          }
          categoryMap[category].qty += qty;
          categoryMap[category].revenue += revenue;

          // 3. Service Treatment Types
          if (item.types && Array.isArray(item.types)) {
            item.types.forEach(tType => {
              if (tType && tType.name) {
                typeMap[tType.name] = (typeMap[tType.name] || 0) + qty;
              }
            });
          } else if (item.type) {
            // Fallback for legacy split format
            const parts = item.type.split(/\s*(?:\+|\b&|and\b)\s*/i);
            parts.forEach(p => {
              const cleaned = p.trim();
              if (cleaned) {
                typeMap[cleaned] = (typeMap[cleaned] || 0) + qty;
              }
            });
          }

          // 4. Add-ons
          if (item.addons && Array.isArray(item.addons)) {
            item.addons.forEach(addon => {
              if (addon) {
                addonMap[addon] = (addonMap[addon] || 0) + qty;
                totalAddons += qty;
              }
            });
          }
        });
      }
    });

    const categoryData = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue);
    const serviceList = Object.values(serviceMap);
    const topServicesData = [...serviceList].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const addonData = Object.entries(addonMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const mostPopular = serviceList.length > 0 ? [...serviceList].sort((a, b) => b.qty - a.qty)[0] : null;
    const highestRevenue = serviceList.length > 0 ? [...serviceList].sort((a, b) => b.revenue - a.revenue)[0] : null;

    return {
      totalItems,
      totalAddons,
      categoryData,
      serviceList,
      topServicesData,
      typeData,
      addonData,
      mostPopular,
      highestRevenue
    };
  }, [filteredOrders]);

  // Search and Sort Service List for Table
  const sortedAndSearchedServices = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    let result = reportData.serviceList;

    if (q) {
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.category.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'name' || sortField === 'category') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [reportData.serviceList, searchTerm, sortField, sortAsc]);

  const paginatedServices = useMemo(() => {
    return sortedAndSearchedServices.slice((currentPage - 1) * 20, currentPage * 20);
  }, [sortedAndSearchedServices, currentPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // CSV Export helper
  const exportCSV = () => {
    const headers = ['Service Name', 'Category', 'Unit Price', 'Quantity Sold', 'Total Revenue'];
    const rows = reportData.serviceList.map(s => [
      `"${s.name}"`,
      `"${s.category}"`,
      s.unitPrice.toFixed(2),
      s.qty,
      s.revenue.toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `services_sales_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // PDF DOWNLOAD
  const handleDownloadPDF = async () => {
    const filename = `Services_Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    if (!window.electronAPI?.printToPDF) {
      if (window.appPrint) { window.appPrint(); } else { window.print(); }
      return;
    }

    try {
      let css = '';
      document.querySelectorAll('style').forEach(styleTag => {
        css += styleTag.innerHTML + '\n';
      });
      for (const sheet of document.styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          css += rules.map(r => r.cssText).join('\n') + '\n';
        } catch (_) {}
      }

      const reportContainer = document.querySelector(`.${styles.page}`);
      if (!reportContainer) throw new Error("Report content not found");

      const clone = reportContainer.cloneNode(true);
      
      // Hide non-printable elements in the clone
      const headerActions = clone.querySelector(`.${styles.headerActions}`);
      if (headerActions) headerActions.style.display = 'none';

      const toolbar = clone.querySelector(`.${styles.toolbar}`);
      if (toolbar) toolbar.style.display = 'none';

      const pagination = clone.querySelector('[class*="pagination"]');
      if (pagination) pagination.style.display = 'none';

      const html = clone.outerHTML;

      await window.electronAPI.printToPDF({
        filename,
        html,
        css,
        pdfDownloadPath: settings.pdfDownloadPath || '',
        origin: window.location.origin,
        pageSize: 'A4'
      });

      alert(`Saved to Downloads: ${filename}`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Falling back to print.");
      if (window.appPrint) { window.appPrint(); } else { window.print(); }
    }
  };

  if (!isAuthorized) return null;

  return (
    <motion.div 
      className={styles.page} 
      variants={containerVariants} 
      initial="hidden" 
      animate="visible"
    >
      {/* Header Row */}
      <motion.div className={styles.headerRow} variants={itemVariants}>
        <div className={styles.headerInfo}>
          <h1>{t('servicesreport', settings.language)}</h1>
        </div>
        <div className={styles.headerActions} data-noprint="true">
          <button className={styles.refreshBtn} onClick={fetchOrders} title="Refresh Data">
            <RefreshCw size={16} />
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#1E293B', fontWeight: '600' }} 
            onClick={exportCSV}
          >
            <Download size={18} /> Export CSV
          </button>
          <button 
            className="btn btn-primary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2563EB', border: '1px solid #2563EB', borderRadius: '8px', color: '#FFFFFF', fontWeight: '600' }} 
            onClick={() => { if (window.appPrint) { window.appPrint(); } else { window.print(); } }}
          >
            <Printer size={18} /> Print Report
          </button>
          <button 
            className="btn btn-primary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#10B981', border: '1px solid #10B981', borderRadius: '8px', color: '#FFFFFF', fontWeight: '600' }} 
            onClick={handleDownloadPDF}
          >
            <Download size={18} /> Download PDF
          </button>
        </div>
      </motion.div>
      {/* Summary Breakdown Table Card */}
      <motion.div className={styles.tableCard} variants={itemVariants}>
        <div className={styles.tableHeaderSection}>
          <h2>Service Items Sales Summary</h2>
          <div className={styles.toolbar}>
            {/* Search */}
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Filter services by name or category..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Date Selectors */}
            <div className={styles.filterControls}>
              <select
                className={styles.filterSelect}
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="This Year">This Year</option>
                <option value="Custom">Custom Range</option>
              </select>

              {dateRange === 'Custom' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="premium-date-input"
                />
                <span className="premium-range-divider">to</span>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="premium-date-input"
                />
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Table Rendering */}
        {loading ? (
          <div className={styles.tableLoader}>Loading sales records...</div>
        ) : sortedAndSearchedServices.length === 0 ? (
          <div className={styles.emptyTable}>No sales metrics found for the selected filter criteria.</div>
        ) : (
          <div className="table-container">
            <table className="base-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                    SERVICE NAME {sortField === 'name' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                  <th onClick={() => handleSort('category')} className={styles.sortableHeader}>
                    CATEGORY {sortField === 'category' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                  <th className="num-col">UNIT PRICE</th>
                  <th onClick={() => handleSort('qty')} className={`num-col ${styles.sortableHeader}`}>
                    QTY SOLD {sortField === 'qty' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                  <th onClick={() => handleSort('revenue')} className={`num-col ${styles.sortableHeader}`}>
                    REVENUE {sortField === 'revenue' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedServices.map((svc, idx) => (
                  <tr key={idx} className={styles.tableRow}>
                    <td className={styles.serviceNameCell}>{svc.name}</td>
                    <td>
                      <span className={styles.categoryBadge}>{svc.category}</span>
                    </td>
                    <td className="num-col">
                      <CurrencySymbol size={12} /> {svc.unitPrice.toFixed(2)}
                    </td>
                    <td className={`num-col ${styles.qtyCell}`}>{svc.qty}</td>
                    <td className={`num-col ${styles.revenueCell}`}>
                      <CurrencySymbol size={12} /> {svc.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.totalsRow}>
                  <td colSpan={3} className={styles.totalsLabel}>TOTAL ({reportData.serviceList.length} items)</td>
                  <td className={`num-col ${styles.totalsQty}`}>{reportData.totalItems}</td>
                  <td className={`num-col ${styles.totalsRevenue}`}>
                    <CurrencySymbol size={13} /> {reportData.serviceList.reduce((sum, s) => sum + s.revenue, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(sortedAndSearchedServices.length / 20)}
            onPageChange={setCurrentPage}
            totalItems={sortedAndSearchedServices.length}
            pageSize={20}
            itemLabel="services"
          />
        )}
      </motion.div>
    </motion.div>
  );
}
