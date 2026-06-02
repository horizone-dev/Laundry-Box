import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, Calendar, Download, Printer, Search, 
  ArrowUpRight, ArrowDownRight, Percent, FileText, Filter
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { useNavigate } from 'react-router-dom';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './TaxReport.module.css';

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

export default function TaxReport() {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('Today');
  const [taxTypeFilter, setTaxTypeFilter] = useState('All'); // All, Sales, Expenses
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  


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
          SELECT orders.id, orders.billNumber, orders.totalAmount, orders.items, orders.createdAt, customers.name as customerName 
          FROM orders 
          LEFT JOIN customers ON orders.customerId = customers.id 
          WHERE orders.status != 'Cancelled'
        `;
        let ordersParams = [];

        let expensesQuery = `
          SELECT id, title, amount, taxAmount, isTaxEnabled, date 
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
        console.error("Failed to fetch tax statement data:", err);
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

  // Consolidate both Sales and Expenses into a unified list of transactions
  const transactions = useMemo(() => {
    const list = [];

    // Sales (Orders)
    orders.forEach(order => {
      const taxVal = calculateOrderTax(order, settings);
      const gross = order.totalAmount;
      const net = gross - taxVal;
      list.push({
        id: order.id,
        date: order.createdAt,
        type: 'Sale',
        ref: order.billNumber || order.id,
        name: order.customerName || 'Walk-in Customer',
        grossAmount: gross,
        netAmount: net,
        taxAmount: taxVal,
        taxRate: settings.taxRate
      });
    });

    // Expenses
    expenses.forEach(exp => {
      const isTax = exp.isTaxEnabled === 1 || exp.taxAmount > 0;
      const taxVal = isTax ? exp.taxAmount : 0;
      const gross = exp.amount;
      const net = gross - taxVal;
      list.push({
        id: exp.id,
        date: exp.date ? `${exp.date}T00:00:00Z` : new Date().toISOString(),
        type: 'Expense',
        ref: exp.id,
        name: exp.title,
        grossAmount: gross,
        netAmount: net,
        taxAmount: taxVal,
        taxRate: taxVal > 0 ? settings.taxRate : 0
      });
    });

    // Sort by date descending
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, expenses, settings]);

  // Safe date parser to avoid timezone shifts
  const parseDateSafe = (dateStr) => {
    if (!dateStr) return new Date();
    // Check if it is a date-only timestamp (e.g. YYYY-MM-DD or YYYY-MM-DDT00:00:00Z)
    if (dateStr.endsWith('T00:00:00Z') || (dateStr.length === 10 && dateStr.includes('-') && !dateStr.includes('T'))) {
      const datePart = dateStr.split('T')[0];
      const parts = datePart.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateStr);
  };

  // Filtered List
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = tx.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            tx.ref.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = taxTypeFilter === 'All' || 
                          (taxTypeFilter === 'Sales' && tx.type === 'Sale') || 
                          (taxTypeFilter === 'Expenses' && tx.type === 'Expense');
      
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, taxTypeFilter]);

  // Aggregate stats
  const totalSalesTax = useMemo(() => {
    return filteredTransactions
      .filter(tx => tx.type === 'Sale')
      .reduce((sum, tx) => sum + tx.taxAmount, 0);
  }, [filteredTransactions]);

  const totalExpenseTax = useMemo(() => {
    return filteredTransactions
      .filter(tx => tx.type === 'Expense')
      .reduce((sum, tx) => sum + tx.taxAmount, 0);
  }, [filteredTransactions]);

  const netTaxPayable = totalSalesTax - totalExpenseTax;

  // No pagination – show all
  const totalItems = filteredTransactions.length;
  const paginatedTransactions = filteredTransactions;



  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Reference No', 'Customer/Vendor Name', 'Gross Total', 'Taxable Amount', 'Tax Rate', 'Tax Amount'];
    const rows = filteredTransactions.map(tx => [
      formatDate(tx.date),
      tx.type,
      tx.ref,
      `"${tx.name.replace(/"/g, '""')}"`,
      tx.grossAmount.toFixed(2),
      tx.netAmount.toFixed(2),
      `${tx.taxRate}%`,
      tx.taxAmount.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tax_statement_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthorized) return null;

  return (
    <motion.div 
      className={styles.taxPage}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Info */}
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Reports &gt; Tax Statements
          </p>
          <h1>{settings.taxName || 'VAT'} Statements</h1>
          <p>Consolidated Output vs Input tax statement report.</p>
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
        <div className={styles.kpiCard}>
          <div className={styles.cardHeader}>
            <div className={styles.iconBox} style={{ background: '#EFF6FF' }}>
              <ArrowUpRight size={20} color="#2563EB" />
            </div>
            {settings.trn && <span className={styles.trnBadge}>TRN: {settings.trn}</span>}
          </div>
          <div>
            <span className={styles.kpiLabel}>Output Tax (Sales Collected)</span>
            <h2 className={styles.kpiValue}>
              <CurrencySymbol size={20} /> {totalSalesTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className={styles.kpiSubtext}>VAT collected from customer orders</p>
          </div>
        </div>

        {/* Input Tax Card */}
        <div className={styles.kpiCard}>
          <div className={styles.cardHeader}>
            <div className={styles.iconBox} style={{ background: '#FEE2E2' }}>
              <ArrowDownRight size={20} color="#EF4444" />
            </div>
            <span className={styles.trnBadge}>Rate: {settings.taxRate}%</span>
          </div>
          <div>
            <span className={styles.kpiLabel}>Input Tax (Expenses Paid)</span>
            <h2 className={styles.kpiValue}>
              <CurrencySymbol size={20} /> {totalExpenseTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className={styles.kpiSubtext}>VAT paid on supplies &amp; operations</p>
          </div>
        </div>

        {/* Net Tax Liability Card */}
        <div className={styles.kpiCard}>
          <div className={styles.cardHeader}>
            <div className={styles.iconBox} style={{ background: netTaxPayable >= 0 ? '#FEF3C7' : '#ECFDF5' }}>
              <Percent size={20} color={netTaxPayable >= 0 ? '#D97706' : '#059669'} />
            </div>
            <span className={`${styles.netPayableBadge} ${netTaxPayable >= 0 ? styles.badgePayable : styles.badgeRefund}`}>
              {netTaxPayable >= 0 ? 'Tax Liability' : 'Tax Credit'}
            </span>
          </div>
          <div>
            <span className={styles.kpiLabel}>Net Tax Payable</span>
            <h2 className={styles.kpiValue}>
              <CurrencySymbol size={20} /> {Math.abs(netTaxPayable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className={styles.kpiSubtext}>
              {netTaxPayable >= 0 
                ? 'Total amount to be paid to tax authority' 
                : 'Excess tax amount eligible for reclaim/credit'}
            </p>
          </div>
        </div>
      </div>



      {/* Detailed Statement Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.tableToolbar} data-noprint="true">
          {/* Search box */}
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search reference, customer/vendor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          
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

            <select 
              value={taxTypeFilter} 
              onChange={(e) => setTaxTypeFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="All">All Transactions</option>
              <option value="Sales">Sales Only (Output)</option>
              <option value="Expenses">Expenses Only (Input)</option>
            </select>
          </div>
        </div>

        {/* The Data Table */}
        <table className={styles.taxTable}>
          <thead>
            <tr>
              <th>DATE</th>
              <th>TYPE</th>
              <th>REF / TICKET NO</th>
              <th>CUSTOMER / CATEGORY</th>
              <th style={{ textAlign: 'right' }}>GROSS TOTAL</th>
              <th style={{ textAlign: 'right' }}>TAXABLE AMOUNT</th>
              <th style={{ textAlign: 'center' }}>TAX RATE</th>
              <th style={{ textAlign: 'right' }}>TAX AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className={styles.emptyRow}>Loading tax transactions...</td>
              </tr>
            ) : paginatedTransactions.length > 0 ? (
              paginatedTransactions.map((tx, idx) => (
                <tr key={`${tx.type}-${tx.id}-${idx}`}>
                  <td className={styles.dateCell}>{formatDate(tx.date)}</td>
                  <td>
                    <span className={`${styles.typeBadge} ${tx.type === 'Sale' ? styles.badgeSale : styles.badgeExpense}`}>
                      {tx.type === 'Sale' ? 'SALE' : 'EXPENSE'}
                    </span>
                  </td>
                  <td>
                    {tx.type === 'Sale' ? (
                      <span 
                        className={styles.refCell} 
                        onClick={() => navigate(`/invoice/${tx.id.replace('#AG-', '').replace('#', '')}`)}
                      >
                        {tx.ref}
                      </span>
                    ) : (
                      <span className={styles.refCellDisabled}>{tx.ref}</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{tx.name}</td>
                  <td className={styles.amountCol}>
                    <CurrencySymbol size={12} /> {tx.grossAmount.toFixed(2)}
                  </td>
                  <td className={styles.amountCol}>
                    <CurrencySymbol size={12} /> {tx.netAmount.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748B' }}>
                    {tx.taxAmount > 0 ? `${tx.taxRate}%` : '0%'}
                  </td>
                  <td className={styles.taxAmountCol}>
                    <CurrencySymbol size={12} /> {tx.taxAmount.toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className={styles.emptyRow}>
                  No tax transactions found matching the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Summary row */}
        {!loading && filteredTransactions.length > 0 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing all {totalItems} entries
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
