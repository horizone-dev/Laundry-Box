import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, Calendar, Download, Printer, 
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { useNavigate } from 'react-router-dom';
import CurrencySymbol from '../components/CurrencySymbol';
import { t } from '../utils/translations';
import styles from './DailyTaxReport.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export default function DailyTaxReport() {
  const { settings, formatDate } = useSettings();
  const navigate = useNavigate();
  
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAuthorized = user.role === 'super_admin' || user.role === 'manager';

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/');
    }
  }, [isAuthorized, navigate]);

  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [dateRange, setDateRange] = useState('This Month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const parseDateSafe = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr.endsWith('T00:00:00Z') || (dateStr.length === 10 && dateStr.includes('-') && !dateStr.includes('T'))) {
      const datePart = dateStr.split('T')[0];
      const parts = datePart.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateStr);
  };

  const getDateBounds = (range, startStr, endStr) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let startLocal, endLocal;

    if (range === 'Today') {
      startLocal = new Date(today);
      endLocal = new Date(today);
      endLocal.setHours(23, 59, 59, 999);
    } else if (range === 'This Week') {
      startLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
      endLocal = new Date(startLocal);
      endLocal.setDate(startLocal.getDate() + 6);
      endLocal.setHours(23, 59, 59, 999);
    } else if (range === 'This Month') {
      startLocal = new Date(today.getFullYear(), today.getMonth(), 1);
      endLocal = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (range === 'This Year') {
      startLocal = new Date(today.getFullYear(), 0, 1);
      endLocal = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (range === 'Custom') {
      if (!startStr || !endStr) {
        return null;
      }
      startLocal = parseDateSafe(startStr);
      startLocal.setHours(0, 0, 0, 0);
      endLocal = parseDateSafe(endStr);
      endLocal.setHours(23, 59, 59, 999);
    } else {
      return null;
    }

    const orderStart = startLocal.toISOString();
    const orderEnd = endLocal.toISOString();

    const formatDateObj = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const expenseStart = formatDateObj(startLocal);
    const expenseEnd = formatDateObj(endLocal);

    return {
      orderStart,
      orderEnd,
      expenseStart,
      expenseEnd
    };
  };

  const fetchTaxData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        const bounds = getDateBounds(dateRange, customStartDate, customEndDate);
        
        let ordersQuery = `
          SELECT orders.id, orders.totalAmount, orders.items, orders.createdAt 
          FROM orders 
          WHERE orders.status != 'Cancelled'
        `;
        let ordersParams = [];

        let expensesQuery = `
          SELECT id, amount, taxAmount, isTaxEnabled, date 
          FROM expenses
        `;
        let expensesParams = [];

        if (bounds) {
          ordersQuery += ` AND orders.createdAt >= ? AND orders.createdAt <= ?`;
          ordersParams = [bounds.orderStart, bounds.orderEnd];

          expensesQuery += ` WHERE date >= ? AND date <= ?`;
          expensesParams = [bounds.expenseStart, bounds.expenseEnd];
        } else if (dateRange === 'Custom') {
          setOrders([]);
          setExpenses([]);
          setLoading(false);
          return;
        }

        const ordersRes = await window.electronAPI.dbQuery(ordersQuery, ordersParams);
        const expensesRes = await window.electronAPI.dbQuery(expensesQuery, expensesParams);

        if (ordersRes.success) setOrders(ordersRes.data);
        if (expensesRes.success) setExpenses(expensesRes.data);
      } catch (err) {
        console.error("Failed to fetch tax data for daily report:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchTaxData();
    }
  }, [isAuthorized, dateRange, customStartDate, customEndDate]);

  // Helper to calculate exact order tax based on items or settings
  const calculateOrderTax = (order, settingsObj) => {
    if (!settingsObj.isTaxEnabled) return 0;
    
    let items = [];
    try {
      items = JSON.parse(order.items || '[]');
    } catch (e) {
      return 0;
    }
    
    if (!Array.isArray(items) || items.length === 0) return 0;

    const defaultRate = (settingsObj.taxRate || 0) / 100;
    const isInclusive = settingsObj.taxMethod === 'inclusive';
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    let totalTax = 0;
    if (isInclusive) {
      const discountRatio = itemsSubtotal > 0 ? (itemsSubtotal - order.totalAmount) / itemsSubtotal : 0;
      items.forEach(item => {
        const itemSubtotal = item.price * item.qty;
        const itemBase = itemSubtotal * (1 - discountRatio);
        const rate = (item.taxRate !== null && item.taxRate !== undefined) 
          ? (item.taxRate / 100) 
          : defaultRate;
        totalTax += itemBase - (itemBase / (1 + rate));
      });
    } else {
      const itemsTaxSum = items.reduce((sum, item) => {
        const itemSubtotal = item.price * item.qty;
        const rate = (item.taxRate !== null && item.taxRate !== undefined) ? (item.taxRate / 100) : defaultRate;
        return sum + (itemSubtotal * rate);
      }, 0);
      
      const factor = (itemsSubtotal + itemsTaxSum) > 0 ? order.totalAmount / (itemsSubtotal + itemsTaxSum) : 0;
      items.forEach(item => {
        const itemSubtotal = item.price * item.qty;
        const itemBase = itemSubtotal * factor;
        const rate = (item.taxRate !== null && item.taxRate !== undefined) 
          ? (item.taxRate / 100) 
          : defaultRate;
        totalTax += itemBase * rate;
      });
    }
    return totalTax;
  };

  // Group Sales & Expenses by Date
  const dailyData = useMemo(() => {
    const dailyMap = {};

    // Group Orders (Sales)
    orders.forEach(order => {
      const d = new Date(order.createdAt);
      if (isNaN(d.getTime())) return;
      const localYear = d.getFullYear();
      const localMonth = String(d.getMonth() + 1).padStart(2, '0');
      const localDay = String(d.getDate()).padStart(2, '0');
      const dateKey = `${localYear}-${localMonth}-${localDay}`;

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateKey,
          salesGross: 0,
          salesTax: 0,
          expensesGross: 0,
          expensesTax: 0
        };
      }
      const taxVal = calculateOrderTax(order, settings);
      dailyMap[dateKey].salesGross += order.totalAmount;
      dailyMap[dateKey].salesTax += taxVal;
    });

    // Group Expenses
    expenses.forEach(exp => {
      const dateKey = exp.date ? exp.date.substring(0, 10) : new Date().toISOString().substring(0, 10);

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateKey,
          salesGross: 0,
          salesTax: 0,
          expensesGross: 0,
          expensesTax: 0
        };
      }
      const isTax = exp.isTaxEnabled === 1 || exp.taxAmount > 0;
      const taxVal = isTax ? exp.taxAmount : 0;
      dailyMap[dateKey].expensesGross += exp.amount;
      dailyMap[dateKey].expensesTax += taxVal;
    });

    // Convert map to list and calculate net tax
    const list = Object.values(dailyMap).map(day => {
      const netTax = day.salesTax - day.expensesTax;
      return {
        ...day,
        netTax
      };
    });

    // Sort by date descending
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, expenses, settings]);

  // Aggregate stats over filtered range
  const totals = useMemo(() => {
    let salesGross = 0;
    let salesTax = 0;
    let expensesGross = 0;
    let expensesTax = 0;

    dailyData.forEach(day => {
      salesGross += day.salesGross;
      salesTax += day.salesTax;
      expensesGross += day.expensesGross;
      expensesTax += day.expensesTax;
    });

    const netTax = salesTax - expensesTax;

    return {
      salesGross,
      salesTax,
      expensesGross,
      expensesTax,
      netTax
    };
  }, [dailyData]);

  const handleExportCSV = () => {
    const headers = [
      t('date', settings.language), 
      `${t('totalSales', settings.language)} (Gross)`, 
      `${t('salestax', settings.language)} (Output)`, 
      `${t('expenses', settings.language)} (Gross)`, 
      `${t('expensetax', settings.language)} (Input)`
    ];

    const rows = dailyData.map(day => [
      formatDate(`${day.date}T00:00:00Z`),
      day.salesGross.toFixed(2),
      day.salesTax.toFixed(2),
      day.expensesGross.toFixed(2),
      day.expensesTax.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_tax_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthorized) return null;

  const isRtl = settings.language === 'Arabic';

  return (
    <motion.div 
      className={styles.taxPage}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      {/* Header Info */}
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <h1>{t('dailytaxreport', settings.language)}</h1>
          <p>Daily consolidated summary of Output Tax (Sales) vs Input Tax (Expenses).</p>
        </div>
        <div className={styles.headerActions} data-noprint="true">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={18} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={18} /> Print Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {/* Output Tax Card */}
        <div className={`${styles.kpiCard} ${styles.salesCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.iconBox} style={{ background: '#EFF6FF' }}>
              <ArrowUpRight size={20} color="#2563EB" />
            </div>
            {settings.trn && <span className={styles.trnBadge}>TRN: {settings.trn}</span>}
          </div>
          <div>
            <span className={styles.kpiLabel}>Total Output Tax</span>
            <h2 className={styles.kpiValue}>
              <CurrencySymbol size={20} /> {totals.salesTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className={styles.kpiSubtext}>VAT collected from customer sales</p>
          </div>
        </div>

        {/* Input Tax Card */}
        <div className={`${styles.kpiCard} ${styles.expenseCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.iconBox} style={{ background: '#FEE2E2' }}>
              <ArrowDownRight size={20} color="#EF4444" />
            </div>
            <span className={styles.trnBadge}>Rate: {settings.taxRate}%</span>
          </div>
          <div>
            <span className={styles.kpiLabel}>Total Input Tax</span>
            <h2 className={styles.kpiValue}>
              <CurrencySymbol size={20} /> {totals.expensesTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className={styles.kpiSubtext}>VAT paid on operations &amp; expenses</p>
          </div>
        </div>
      </div>


      {/* Detailed Statement Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.tableToolbar} data-noprint="true">
          {/* Filters */}
          <div className={styles.filterControls}>
            <div className={styles.customDateGrid}>
              <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="This Year">This Year</option>
                <option value="Custom">Custom Date Range</option>
              </select>

              {dateRange === 'Custom' && (
                <>
                  <span className={styles.dateInputLabel}>From:</span>
                  <input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className={styles.dateInput}
                  />
                  <span className={styles.dateInputLabel}>To:</span>
                  <input 
                    type="date" 
                    value={customEndDate} 
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className={styles.dateInput}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* The Data Table */}
        <div className={styles.tableContainer}>
          <table className={styles.taxTable}>
            <thead>
              <tr>
                <th style={{ textAlign: isRtl ? 'right' : 'left' }}>{t('date', settings.language)}</th>
                <th style={{ textAlign: 'right' }}>{t('totalSales', settings.language)} (Gross)</th>
                <th style={{ textAlign: 'right' }}>{t('salestax', settings.language)} (Output)</th>
                <th style={{ textAlign: 'right' }}>{t('expenses', settings.language)} (Gross)</th>
                <th style={{ textAlign: 'right' }}>{t('expensetax', settings.language)} (Input)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                   <td colSpan="5" className={styles.emptyRow}>Loading daily tax data...</td>
                </tr>
              ) : dailyData.length > 0 ? (
                dailyData.map((day, idx) => (
                  <tr key={`${day.date}-${idx}`}>
                    <td className={styles.dateCell}>
                      {formatDate(`${day.date}T00:00:00Z`)}
                    </td>
                    <td className={styles.amountCol}>
                      <CurrencySymbol size={12} /> {day.salesGross.toFixed(2)}
                    </td>
                    <td className={`${styles.amountCol} ${styles.salesTaxCell}`}>
                      + <CurrencySymbol size={12} /> {day.salesTax.toFixed(2)}
                    </td>
                    <td className={styles.amountCol}>
                      <CurrencySymbol size={12} /> {day.expensesGross.toFixed(2)}
                    </td>
                    <td className={`${styles.amountCol} ${styles.expenseTaxCell}`}>
                      - <CurrencySymbol size={12} /> {day.expensesTax.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                   <td colSpan="5" className={styles.emptyRow}>
                    No tax statements found for the selected date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && dailyData.length > 0 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing all {dailyData.length} active dates
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
