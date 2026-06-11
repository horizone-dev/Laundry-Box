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

  // Table Sorting State
  const [sortField, setSortField] = useState('revenue'); // 'name', 'category', 'qty', 'revenue'
  const [sortAsc, setSortAsc] = useState(false);

  const fetchOrders = async () => {
    if (!window.electronAPI?.dbQuery) return;
    try {
      setLoading(true);
      // Fetch all active orders (exclude Cancelled status)
      const res = await window.electronAPI.dbQuery(
        "SELECT id, billNumber, totalAmount, items, status, createdAt FROM orders WHERE status != 'Cancelled' ORDER BY createdAt DESC",
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
          <p className={styles.subtext}>Analyze laundry services sales volume, revenue breakdown, category charts, and popular treatment types.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={fetchOrders} title="Refresh Data">
            <RefreshCw size={16} />
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print Report
          </button>
        </div>
      </motion.div>

      {/* KPI Cards Grid */}
      <motion.div className={styles.kpiGrid} variants={itemVariants}>
        <div className={styles.kpiCard}>
          <div className={styles.iconBox} style={{ background: '#EFF6FF' }}>
            <Package size={20} color="#2563EB" />
          </div>
          <div className={styles.kpiLabel}>Total Items Cleaned</div>
          <div className={styles.kpiValue}>{reportData.totalItems.toLocaleString()}</div>
          <div className={styles.kpiSubtext}>Volume across active orders</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.iconBox} style={{ background: '#ECFDF5' }}>
            <Star size={20} color="#10B981" />
          </div>
          <div className={styles.kpiLabel}>Most Popular Service</div>
          <div className={styles.kpiValue} style={{ fontSize: '1.25rem', height: '2.5rem', display: 'flex', alignItems: 'center' }}>
            {reportData.mostPopular ? `${reportData.mostPopular.name} (${reportData.mostPopular.qty} sold)` : '—'}
          </div>
          <div className={styles.kpiSubtext}>Highest count in chosen date range</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.iconBox} style={{ background: '#FFFBEB' }}>
            <Award size={20} color="#F59E0B" />
          </div>
          <div className={styles.kpiLabel}>Top Revenue Generator</div>
          <div className={styles.kpiValue} style={{ fontSize: '1.25rem', height: '2.5rem', display: 'flex', alignItems: 'center' }}>
            {reportData.highestRevenue ? (
              <>
                {reportData.highestRevenue.name} 
                <span className={styles.kpiRevenueAmount}>
                  (<CurrencySymbol size={12} />{reportData.highestRevenue.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              </>
            ) : '—'}
          </div>
          <div className={styles.kpiSubtext}>Highest revenue service line</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.iconBox} style={{ background: '#F5F3FF' }}>
            <Layers size={20} color="#8B5CF6" />
          </div>
          <div className={styles.kpiLabel}>Add-ons Added</div>
          <div className={styles.kpiValue}>{reportData.totalAddons.toLocaleString()}</div>
          <div className={styles.kpiSubtext}>Fragrance, starch, special treatments</div>
        </div>
      </motion.div>

      {/* Visual Analytics Charts */}
      <motion.div className={styles.chartsGrid} variants={itemVariants}>
        {/* Revenue by Category */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Revenue & Volume by Category</h3>
          {reportData.categoryData.length === 0 ? (
            <div className={styles.emptyChart}>No category data available</div>
          ) : (
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={reportData.categoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    formatter={(value, name) => name === 'revenue' ? [`${settings.currencySymbol || 'AED'} ${value.toFixed(2)}`, 'Revenue'] : [value, 'Volume']}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="qty" name="Qty Sold" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top 5 Services */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Top 5 Services by Revenue</h3>
          {reportData.topServicesData.length === 0 ? (
            <div className={styles.emptyChart}>No service performance data available</div>
          ) : (
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={reportData.topServicesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} width={100} />
                  <Tooltip 
                    contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                    formatter={(value) => [`${settings.currencySymbol || 'AED'} ${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Treatment Types Distribution */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Service Types (Treatments)</h3>
          {reportData.typeData.length === 0 ? (
            <div className={styles.emptyChart}>No treatment options data available</div>
          ) : (
            <div className={styles.chartContainer} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportData.typeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {reportData.typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Quantity']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.pieLegendList}>
                {reportData.typeData.map((entry, index) => (
                  <div key={entry.name} className={styles.legendItem}>
                    <span className={styles.legendColorDot} style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className={styles.legendLabelText}>{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add-ons Popularity */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Add-ons Breakdown</h3>
          {reportData.addonData.length === 0 ? (
            <div className={styles.emptyChart}>No add-ons sold in this period</div>
          ) : (
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={reportData.addonData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '8px' }} />
                  <Bar dataKey="count" name="Times Sold" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
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
                <div className={styles.customDates}>
                  <input 
                    type="date" 
                    className={styles.dateInput} 
                    value={customStart} 
                    onChange={e => setCustomStart(e.target.value)} 
                  />
                  <span className={styles.dateSep}>to</span>
                  <input 
                    type="date" 
                    className={styles.dateInput} 
                    value={customEnd} 
                    onChange={e => setCustomEnd(e.target.value)} 
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
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                    SERVICE NAME {sortField === 'name' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                  <th onClick={() => handleSort('category')} className={styles.sortableHeader}>
                    CATEGORY {sortField === 'category' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                  <th className={styles.numCol}>UNIT PRICE</th>
                  <th onClick={() => handleSort('qty')} className={`${styles.numCol} ${styles.sortableHeader}`}>
                    QTY SOLD {sortField === 'qty' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                  <th onClick={() => handleSort('revenue')} className={`${styles.numCol} ${styles.sortableHeader}`}>
                    REVENUE {sortField === 'revenue' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAndSearchedServices.map((svc, idx) => (
                  <tr key={idx} className={styles.tableRow}>
                    <td className={styles.serviceNameCell}>{svc.name}</td>
                    <td>
                      <span className={styles.categoryBadge}>{svc.category}</span>
                    </td>
                    <td className={styles.numCol}>
                      <CurrencySymbol size={12} /> {svc.unitPrice.toFixed(2)}
                    </td>
                    <td className={`${styles.numCol} ${styles.qtyCell}`}>{svc.qty}</td>
                    <td className={`${styles.numCol} ${styles.revenueCell}`}>
                      <CurrencySymbol size={12} /> {svc.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.totalsRow}>
                  <td colSpan={3} className={styles.totalsLabel}>TOTAL ({reportData.serviceList.length} items)</td>
                  <td className={`${styles.numCol} ${styles.totalsQty}`}>{reportData.totalItems}</td>
                  <td className={`${styles.numCol} ${styles.totalsRevenue}`}>
                    <CurrencySymbol size={13} /> {reportData.serviceList.reduce((sum, s) => sum + s.revenue, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
