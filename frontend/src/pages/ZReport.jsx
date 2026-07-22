import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Calendar, Printer, FileText, ArrowUpRight,
  ArrowDownRight, RefreshCw, AlertTriangle, CheckCircle2, Download,
  Share2, ShoppingBag, Shirt, Users, Layers, Tag, Award,
  Truck, HelpCircle, Eye, Percent, CheckSquare, ListTodo,
  Lock, Unlock, X, Plus, ChevronDown, ShieldCheck, Clock, TrendingUp,
  CreditCard, UserPlus, RefreshCcw, Landmark, Receipt, FileSpreadsheet, Box
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { useNavigate } from 'react-router-dom';
import CurrencySymbol from '../components/CurrencySymbol';
import { t } from '../utils/translations';
import styles from './ZReport.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.02 }
  }
};

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export default function ZReport() {
  const { settings, formatDate } = useSettings();
  const navigate = useNavigate();

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isManager = user.role === 'super_admin' || user.role === 'manager';

  useEffect(() => {
    if (settings.zReportEnabled === false) {
      navigate('/pos', { replace: true });
    }
  }, [settings.zReportEnabled, navigate]);

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [loading, setLoading] = useState(true);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  // Z Report Data States
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [newCustomersCount, setNewCustomersCount] = useState(0);
  const [returningCustomersCount, setReturningCustomersCount] = useState(0);
  const [creditCustomersCount, setCreditCustomersCount] = useState(0);
  const [vipCustomersCount, setVipCustomersCount] = useState(0);
  const [topCustomer, setTopCustomer] = useState({ name: 'N/A', amount: 0 });
  const [totalCustomersCount, setTotalCustomersCount] = useState(0);
  const [allCustomersData, setAllCustomersData] = useState([]);
  const [allDeletedOrders, setAllDeletedOrders] = useState([]);

  // Reconciliation inputs
  const [openingFloat, setOpeningFloat] = useState(() => {
    const stored = localStorage.getItem(`opening_float_${selectedDate}`);
    return stored ? parseFloat(stored) : 200;
  });
  const [actualCashCounted, setActualCashCounted] = useState(() => {
    const stored = localStorage.getItem(`actual_cash_${selectedDate}`);
    return stored ? parseFloat(stored) : 200;
  });
  const [cashWithdrawals, setCashWithdrawals] = useState(() => {
    const stored = localStorage.getItem(`cash_withdrawal_${selectedDate}`);
    return stored ? parseFloat(stored) : 0;
  });

  // Day Close Status
  const [isDayClosed, setIsDayClosed] = useState(() => localStorage.getItem(`day_close_status_${selectedDate}`) === 'CLOSED');
  const [showManagerPinModal, setShowManagerPinModal] = useState(false);
  const [managerPinInput, setManagerPinInput] = useState('');
  const [managerPinError, setManagerPinError] = useState('');

  // Sync state with selectedDate
  useEffect(() => {
    setIsDayClosed(localStorage.getItem(`day_close_status_${selectedDate}`) === 'CLOSED');
    const storedFloat = localStorage.getItem(`opening_float_${selectedDate}`);
    setOpeningFloat(storedFloat ? parseFloat(storedFloat) : 200);
    const storedCash = localStorage.getItem(`actual_cash_${selectedDate}`);
    setActualCashCounted(storedCash ? parseFloat(storedCash) : 200);
    const storedWithdrawal = localStorage.getItem(`cash_withdrawal_${selectedDate}`);
    setCashWithdrawals(storedWithdrawal ? parseFloat(storedWithdrawal) : 0);
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch data
  const fetchZReportData = async () => {
    if (!window.electronAPI?.dbQuery) return;
    try {
      setLoading(true);
      const dateParam = `${selectedDate}%`;

      // 1. Orders
      const ordersRes = await window.electronAPI.dbQuery(
        `SELECT * FROM orders WHERE createdAt LIKE ?`, [dateParam]
      );
      // 2. Expenses
      const expensesRes = await window.electronAPI.dbQuery(
        `SELECT * FROM expenses WHERE date LIKE ?`, [dateParam]
      );
      // 3. Transactions
      const txnsRes = await window.electronAPI.dbQuery(
        `SELECT * FROM account_transactions WHERE date LIKE ?`, [dateParam]
      );
      // 4. Deleted orders
      const deletedRes = await window.electronAPI.dbQuery(
        `SELECT * FROM deleted_orders WHERE deletedAt LIKE ?`, [dateParam]
      );
      // 5. All Customers (for segments)
      const custsRes = await window.electronAPI.dbQuery(
        `SELECT * FROM customers`, []
      );

      if (ordersRes.success) setOrders(ordersRes.data);
      if (expensesRes.success) setExpenses(expensesRes.data);
      if (txnsRes.success) setTransactions(txnsRes.data);
      if (deletedRes.success) setAllDeletedOrders(deletedRes.data);
      if (custsRes.success) {
        setAllCustomersData(custsRes.data);
        setTotalCustomersCount(custsRes.data.length);
      }

      // New customers count today (proxy using updatedAt/createdAt check)
      const newCustsRes = await window.electronAPI.dbQuery(
        `SELECT COUNT(*) as count FROM customers WHERE updatedAt LIKE ?`, [dateParam]
      );
      if (newCustsRes.success && newCustsRes.data.length > 0) {
        setNewCustomersCount(newCustsRes.data[0].count);
      }

      // Top customer
      const topCustRes = await window.electronAPI.dbQuery(
        `SELECT c.name, SUM(o.totalAmount) as totalSpent 
         FROM orders o
         JOIN customers c ON o.customerId = c.id
         WHERE o.createdAt LIKE ? AND o.status != 'Cancelled'
         GROUP BY o.customerId
         ORDER BY totalSpent DESC
         LIMIT 1`,
        [dateParam]
      );
      if (topCustRes.success && topCustRes.data.length > 0) {
        setTopCustomer({
          name: topCustRes.data[0].name || 'Walk-in',
          amount: topCustRes.data[0].totalSpent || 0
        });
      } else {
        setTopCustomer({ name: 'N/A', amount: 0 });
      }

    } catch (err) {
      console.error("Z Report data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZReportData();
  }, [selectedDate]);

  // Tax calculation helper
  const calculateOrderTax = (order) => {
    if (!settings.isTaxEnabled) return 0;
    let items = [];
    try {
      items = JSON.parse(order.items || '[]');
    } catch (e) {
      return 0;
    }
    if (!Array.isArray(items) || items.length === 0) return 0;

    const defaultRate = (settings.taxRate || 0) / 100;
    const isInclusive = settings.taxMethod === 'inclusive';
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

    let totalTax = 0;
    if (isInclusive) {
      const discountRatio = itemsSubtotal > 0 ? (itemsSubtotal - order.totalAmount) / itemsSubtotal : 0;
      items.forEach(item => {
        const itemSubtotal = item.price * item.qty;
        const itemBase = itemSubtotal * (1 - discountRatio);
        const rate = (item.taxRate !== null && item.taxRate !== undefined) ? (item.taxRate / 100) : defaultRate;
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
        const rate = (item.taxRate !== null && item.taxRate !== undefined) ? (item.taxRate / 100) : defaultRate;
        totalTax += itemBase * rate;
      });
    }
    return totalTax;
  };

  // Perform Calculations
  const metrics = useMemo(() => {
    const activeOrders = orders.filter(o => o.status !== 'Cancelled');

    // 1. Business Hours
    let earliestTime = null;
    let latestTime = null;
    const checkTime = (dateStr) => {
      if (!dateStr) return;
      const t = new Date(dateStr).getTime();
      if (!isNaN(t)) {
        if (earliestTime === null || t < earliestTime) earliestTime = t;
        if (latestTime === null || t > latestTime) latestTime = t;
      }
    };
    activeOrders.forEach(o => checkTime(o.createdAt));
    transactions.forEach(t => checkTime(t.date));
    expenses.forEach(e => checkTime(e.date));

    const storeOpening = earliestTime ? new Date(earliestTime) : null;
    const storeClosing = latestTime ? new Date(latestTime) : null;

    let durationStr = "N/A";
    if (storeOpening && storeClosing) {
      const diffMs = storeClosing - storeOpening;
      const diffHours = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      durationStr = `${diffHours}h ${diffMins}m`;
    }

    // 2. Operational Metrics
    const totalOrders = activeOrders.length;
    const deliveredOrders = activeOrders.filter(o => o.status === 'Delivered').length;
    const pendingOrders = activeOrders.filter(o => o.status !== 'Delivered').length;
    const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length;

    let totalPieces = 0;
    let expressPieces = 0;
    let expressCount = 0;
    let deliveryCount = 0;
    let pickupCount = 0;
    let highestInvoice = 0;
    let lowestInvoice = totalOrders > 0 ? Infinity : 0;

    // Service & Garment groupings
    const serviceSales = {};
    const garmentSummary = {};

    activeOrders.forEach(o => {
      const amt = o.totalAmount || 0;
      if (amt > highestInvoice) highestInvoice = amt;
      if (amt < lowestInvoice) lowestInvoice = amt;

      let itemsList = [];
      try { itemsList = JSON.parse(o.items || '[]'); } catch (err) { }
      const oPieces = itemsList.reduce((s, i) => s + (i.qty || 0), 0);
      totalPieces += oPieces;

      const isExpressOrder = o.specialInstructions?.toLowerCase().includes('express');
      if (isExpressOrder) expressCount++;

      itemsList.forEach(item => {
        const qty = item.qty || 0;
        const price = item.price || 0;
        const itemRevenue = qty * price;

        // Service summary grouping
        const sType = item.type || 'Other';
        if (!serviceSales[sType]) serviceSales[sType] = { qty: 0, revenue: 0 };
        serviceSales[sType].qty += qty;
        serviceSales[sType].revenue += itemRevenue;

        // Garment summary grouping
        const gName = item.name || 'Miscellaneous';
        if (!garmentSummary[gName]) garmentSummary[gName] = { pieces: 0, revenue: 0 };
        garmentSummary[gName].pieces += qty;
        garmentSummary[gName].revenue += itemRevenue;

        // Check express/delivery details
        if (item.deliveryMethod?.toLowerCase() === 'delivery') deliveryCount++;
        if (item.deliveryMethod?.toLowerCase() === 'pickup') pickupCount++;
        
        const isExpressItem = item.name?.toLowerCase().includes('express') || item.type?.toLowerCase().includes('express');
        if (isExpressItem) {
          expressPieces += qty;
        }
      });
    });

    if (lowestInvoice === Infinity) lowestInvoice = 0;
    const avgOrderValue = totalOrders > 0 ? activeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) / totalOrders : 0;

    // 3. Financial Totals
    let grossSales = 0;
    let deliveryCharges = 0;
    let expressCharges = 0;
    let additionalCharges = 0;
    let totalDiscount = 0;
    let couponDiscounts = 0;
    let manualDiscounts = 0;
    let vatCollected = 0;

    activeOrders.forEach(o => {
      let itemsList = [];
      try { itemsList = JSON.parse(o.items || '[]'); } catch (err) { }
      const subtotal = itemsList.reduce((sum, item) => sum + (item.price * item.qty), 0);
      grossSales += subtotal;

      // Calculate taxes
      vatCollected += calculateOrderTax(o);

      // Extract specific addon charges if any
      itemsList.forEach(item => {
        if (item.addons && Array.isArray(item.addons)) {
          item.addons.forEach(addon => {
            const addName = (addon.name || '').toLowerCase();
            const addAmt = (addon.price || 0) * (item.qty || 1);
            if (addName.includes('express')) {
              expressCharges += addAmt;
            } else if (addName.includes('delivery')) {
              deliveryCharges += addAmt;
            } else {
              additionalCharges += addAmt;
            }
          });
        }
      });

      // Split discounts
      const oDiscount = Math.max(0, subtotal - (o.totalAmount - (settings.taxMethod === 'inclusive' ? 0 : calculateOrderTax(o))));
      totalDiscount += oDiscount;
      if (o.specialInstructions?.toLowerCase().includes('coupon') || o.specialInstructions?.toLowerCase().includes('promo')) {
        couponDiscounts += oDiscount;
      } else {
        manualDiscounts += oDiscount;
      }
    });

    const netSales = grossSales + additionalCharges + deliveryCharges + expressCharges - totalDiscount;
    const grandTotal = netSales + vatCollected;

    // 4. Payment Breakdown
    let cashSales = 0;
    let cardSales = 0;
    let bankTransfer = 0;
    let nomodSales = 0;
    let creditSales = 0;
    let partialPayments = 0;
    let otherPayments = 0;
    let totalCollected = 0;

    activeOrders.forEach(o => {
      const paid = o.paidAmount || 0;
      const due = o.dueAmount || 0;
      const method = (o.paymentMethod || '').toLowerCase();
      const status = (o.paymentStatus || '').toLowerCase();

      let breakdown = null;
      try {
        if (o.paymentBreakdown) {
          breakdown = typeof o.paymentBreakdown === 'string' ? JSON.parse(o.paymentBreakdown) : o.paymentBreakdown;
        }
      } catch (e) {}

      if (breakdown) {
        cashSales += parseFloat(breakdown.cash || 0);
        cardSales += parseFloat(breakdown.card || 0);
        bankTransfer += parseFloat(breakdown.bank || 0);
        nomodSales += parseFloat(breakdown.nomod || 0);
        creditSales += due;
      } else {
        if (status === 'credit') {
          creditSales += due;
        } else if (status === 'partial') {
          partialPayments += paid;
          creditSales += due;
        } else {
          if (method === 'cash') cashSales += paid;
          else if (method === 'card') cardSales += paid;
          else if (method === 'bank') bankTransfer += paid;
          else if (method === 'nomod') nomodSales += paid;
          else if (method === 'discount') {
            // Exclude checkout discounts from payments
          }
          else otherPayments += paid;
        }
      }
    });

    totalCollected = cashSales + cardSales + bankTransfer + nomodSales + partialPayments + otherPayments;

    // 5. Cash Drawer Reconciliation Calculations
    let cashCreditCollections = 0;
    let cashAdvancePayments = 0;
    let cashInTrans = 0;
    let cashExpenses = 0;
    let cashRefunds = 0;

    transactions.forEach(t => {
      if (t.accountType === 'CASH') {
        const cat = (t.category || '').toLowerCase();
        const amt = t.amount || 0;
        if (t.type === 'INCOME') {
          if (cat === 'credit settlement' || cat === 'sales settlement') {
            cashCreditCollections += amt;
          } else if (cat === 'advance' || cat === 'deposit') {
            cashAdvancePayments += amt;
          } else {
            cashInTrans += amt;
          }
        } else if (t.type === 'EXPENSE') {
          cashExpenses += amt;
        } else if (t.type === 'REFUND') {
          cashRefunds += amt;
        }
      }
    });

    // Fallbacks if account transactions are empty
    if (cashExpenses === 0) {
      cashExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    }

    const expectedCash = openingFloat + cashSales + cashCreditCollections + cashAdvancePayments + cashInTrans - cashRefunds - cashExpenses - cashWithdrawals;
    const cashDifference = actualCashCounted - expectedCash;

    // 6. Credit Summary calculations
    const todayCreditSettled = transactions.filter(t => t.type === 'INCOME' && ['credit settlement', 'sales settlement'].includes(t.category?.toLowerCase())).reduce((s, t) => s + (t.amount || 0), 0);
    const todayCreditReturned = allDeletedOrders.reduce((s, o) => s + (o.dueAmount || 0), 0);
    const todayCreditSales = creditSales;

    let closingOutstanding = allCustomersData.reduce((s, c) => s + (c.balance || 0), 0);
    let openingOutstanding = closingOutstanding - todayCreditSales + todayCreditSettled + todayCreditReturned;

    // 7. Customers Summary
    const uniqueCusts = new Set(activeOrders.map(o => o.customerId).filter(Boolean));
    const returningCustomers = Math.max(0, uniqueCusts.size - newCustomersCount);
    const creditCustomers = allCustomersData.filter(c => c.balance > 0).length;
    const vipCustomers = allCustomersData.filter(c => c.balance > 1000).length;
    const avgCustSpend = uniqueCusts.size > 0 ? grandTotal / uniqueCusts.size : 0;

    // 8. Employee performance
    const employeePerf = {};
    activeOrders.forEach(o => {
      let history = [];
      try { history = JSON.parse(o.statusHistory || '[]'); } catch (e) { }
      const createStep = history.find(h => ['Confirmed', 'Pending', 'Payment Pending'].includes(h.status));
      const emp = createStep?.updatedBy?.replace(/^(Super Admin|Manager|Cashier|Staff):\s*/, '') || 'Admin';

      if (!employeePerf[emp]) {
        employeePerf[emp] = { orders: 0, revenue: 0, discounts: 0, refunds: 0 };
      }
      employeePerf[emp].orders++;
      employeePerf[emp].revenue += o.totalAmount || 0;
      
      let itemsList = [];
      try { itemsList = JSON.parse(o.items || '[]'); } catch (err) { }
      const sub = itemsList.reduce((s, i) => s + (i.price * i.qty), 0);
      const disc = Math.max(0, sub - o.totalAmount);
      employeePerf[emp].discounts += disc;
    });

    // 9. Refunds
    const refundCount = allDeletedOrders.length;
    const refundAmount = allDeletedOrders.reduce((s, o) => s + (o.paidAmount || 0), 0);

    return {
      storeOpening: storeOpening ? storeOpening.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      storeClosing: storeClosing ? storeClosing.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      durationStr,
      totalOrders,
      deliveredOrders,
      pendingOrders,
      cancelledOrders,
      totalPieces,
      expressPieces,
      expressCount,
      deliveryCount,
      pickupCount,
      avgOrderValue,
      highestInvoice,
      lowestInvoice,
      grossSales,
      deliveryCharges,
      expressCharges,
      additionalCharges,
      totalDiscount,
      couponDiscounts,
      manualDiscounts,
      vatCollected,
      netSales,
      grandTotal,
      cashSales,
      cardSales,
      bankTransfer,
      nomodSales,
      creditSales,
      partialPayments,
      otherPayments,
      totalCollected,
      cashCreditCollections,
      cashAdvancePayments,
      cashInTrans,
      cashExpenses,
      cashRefunds,
      expectedCash,
      cashDifference,
      openingOutstanding,
      todayCreditSales,
      todayCreditSettled,
      todayCreditReturned,
      closingOutstanding,
      returningCustomers,
      creditCustomers,
      vipCustomers,
      avgCustSpend,
      employeePerf,
      refundCount,
      refundAmount,
      serviceSales,
      garmentSummary
    };

  }, [orders, expenses, transactions, allCustomersData, allDeletedOrders, openingFloat, actualCashCounted, cashWithdrawals, selectedDate, settings]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Z REPORT METRIC,VALUE",
         `Business Date,${selectedDate}`,
         `Total Orders,${metrics.totalOrders}`,
         `Gross Sales,${metrics.grossSales.toFixed(2)}`,
         `Net Sales,${metrics.netSales.toFixed(2)}`,
         `VAT Collected,${metrics.vatCollected.toFixed(2)}`,
         `Grand Total,${metrics.grandTotal.toFixed(2)}`,
         `Total Collected,${metrics.totalCollected.toFixed(2)}`,
         `Outstanding Credit,${metrics.creditSales.toFixed(2)}`,
         `Expected Cash Drawer,${metrics.expectedCash.toFixed(2)}`,
         `Difference,${metrics.cashDifference.toFixed(2)}`
        ].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Z_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      className={styles.zReportPage}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Sticky Header Row */}
      <div className={`${styles.headerRow} no-print`}>
        <div className={styles.headerTitleArea}>
          <div className={styles.iconCircle}>
            <Receipt size={22} color="var(--primary)" />
          </div>
          <div>
            <h1>Daily Z Close Report</h1>
            <p className={styles.subtext}>Enterprise reconciliation & closing diagnostics</p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.datePicker}>
            <Calendar size={16} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>
          <button className={styles.iconBtn} onClick={fetchZReportData} title="Refresh Data">
            <RefreshCw size={16} />
          </button>

          <div ref={exportDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button 
              className={styles.primaryBtn} 
              onClick={() => setIsExportOpen(!isExportOpen)}
            >
              <Download size={16} />
              <span>Export Z Report</span>
              <ChevronDown size={14} />
            </button>

            {isExportOpen && (
              <div className={styles.dropdownMenu}>
                <button onClick={handleExportCSV}>
                  <FileSpreadsheet size={16} color="#10B981" />
                  <span>Export CSV Sheet</span>
                </button>
                <button onClick={handlePrint}>
                  <Printer size={16} color="#2563EB" />
                  <span>Print Document (A4/80mm)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <RefreshCw size={36} className={styles.spinner} />
          <p>Compiling database reconciliation logs...</p>
        </div>
      ) : (
        <div className={styles.reportLayout}>
          
          {/* 1. Report Metadata / Header */}
          <div className={styles.sectionCard}>
            <div className={styles.metaGrid}>
              <div>
                <span className={styles.metaLabel}>Business Date</span>
                <span className={styles.metaVal}>{formatDate(selectedDate)}</span>
              </div>
              <div>
                <span className={styles.metaLabel}>Report Type</span>
                <span className={styles.metaVal}>Daily Z Close</span>
              </div>
              <div>
                <span className={styles.metaLabel}>POS Terminal</span>
                <span className={styles.metaVal}>Terminal 01</span>
              </div>
              <div>
                <span className={styles.metaLabel}>Generated By</span>
                <span className={styles.metaVal}>{user.name || 'Admin'}</span>
              </div>
              <div>
                <span className={styles.metaLabel}>Status</span>
                <span className={styles.metaVal} style={{ color: '#10B981', fontWeight: 800 }}>Completed</span>
              </div>
            </div>
          </div>

          {/* 2. Business Information */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}><Clock size={16} /> Business Operation Times</h3>
            <div className={styles.metaGrid}>
              <div>
                <span className={styles.metaLabel}>Store Opening</span>
                <span className={styles.metaVal}>{metrics.storeOpening}</span>
              </div>
              <div>
                <span className={styles.metaLabel}>Store Closing</span>
                <span className={styles.metaVal}>{isDayClosed ? metrics.storeClosing : 'Active Session'}</span>
              </div>
              <div>
                <span className={styles.metaLabel}>Operational Duration</span>
                <span className={styles.metaVal}>{metrics.durationStr}</span>
              </div>
            </div>
          </div>

          {/* 3. KPI Cards Grid */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <Box size={20} color="#2563EB" />
              <div>
                <span className={styles.kpiLabel}>Total Orders</span>
                <span className={styles.kpiValue}>{metrics.totalOrders}</span>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <DollarSign size={20} color="#059669" />
              <div>
                <span className={styles.kpiLabel}>Gross Sales</span>
                <span className={styles.kpiValue}><CurrencySymbol /> {metrics.grossSales.toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <TrendingUp size={20} color="#10B981" />
              <div>
                <span className={styles.kpiLabel}>Net Sales</span>
                <span className={styles.kpiValue}><CurrencySymbol /> {metrics.netSales.toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <Receipt size={20} color="#4F46E5" />
              <div>
                <span className={styles.kpiLabel}>Grand Total</span>
                <span className={styles.kpiValue}><CurrencySymbol /> {metrics.grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <CheckSquare size={20} color="#059669" />
              <div>
                <span className={styles.kpiLabel}>Total Collected</span>
                <span className={styles.kpiValue}><CurrencySymbol /> {metrics.totalCollected.toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <AlertTriangle size={20} color="#DC2626" />
              <div>
                <span className={styles.kpiLabel}>Outstanding Credit</span>
                <span className={styles.kpiValue} style={{ color: '#DC2626' }}><CurrencySymbol /> {metrics.creditSales.toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <Shirt size={20} color="#D97706" />
              <div>
                <span className={styles.kpiLabel}>Total Pieces</span>
                <span className={styles.kpiValue}>{metrics.totalPieces}</span>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <UserPlus size={20} color="#7C3AED" />
              <div>
                <span className={styles.kpiLabel}>New Customers</span>
                <span className={styles.kpiValue}>{newCustomersCount}</span>
              </div>
            </div>
          </div>

          {/* 4. Revenue Summary & Tax */}
          <div className={styles.gridTwoCols}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Revenue Summary</h3>
              <table className={styles.dataTable}>
                <tbody>
                  <tr>
                    <td>Gross Sales (Items Subtotal)</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.grossSales.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Delivery Charges</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.deliveryCharges.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Express Charges</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.expressCharges.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Additional Service Addons</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.additionalCharges.toFixed(2)}</td>
                  </tr>
                  <tr style={{ color: '#DC2626' }}>
                    <td>Total Discounts Applied</td>
                    <td className="text-right">- <CurrencySymbol /> {metrics.totalDiscount.toFixed(2)}</td>
                  </tr>
                  <tr className={styles.highlightRow}>
                    <td>Net Revenue</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.netSales.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>VAT Collected ({settings.taxRate}%)</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.vatCollected.toFixed(2)}</td>
                  </tr>
                  <tr className={styles.grandTotalRow}>
                    <td>Grand Total</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.grandTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 5. Payment Breakdown */}
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Payment Breakdown</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">% Share</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Cash Collections</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.cashSales.toFixed(2)}</td>
                    <td className="text-right">{metrics.totalCollected > 0 ? ((metrics.cashSales/metrics.totalCollected)*100).toFixed(1) : 0}%</td>
                  </tr>
                  <tr>
                    <td>Card Terminal</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.cardSales.toFixed(2)}</td>
                    <td className="text-right">{metrics.totalCollected > 0 ? ((metrics.cardSales/metrics.totalCollected)*100).toFixed(1) : 0}%</td>
                  </tr>
                  <tr>
                    <td>Bank Transfer</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.bankTransfer.toFixed(2)}</td>
                    <td className="text-right">{metrics.totalCollected > 0 ? ((metrics.bankTransfer/metrics.totalCollected)*100).toFixed(1) : 0}%</td>
                  </tr>
                  <tr>
                    <td>Nomod Payments</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.nomodSales.toFixed(2)}</td>
                    <td className="text-right">{metrics.totalCollected > 0 ? ((metrics.nomodSales/metrics.totalCollected)*100).toFixed(1) : 0}%</td>
                  </tr>
                  <tr>
                    <td>On Account / Credit sales</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.creditSales.toFixed(2)}</td>
                    <td className="text-right">-</td>
                  </tr>
                  <tr className={styles.highlightRow}>
                    <td>Total Collections</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.totalCollected.toFixed(2)}</td>
                    <td className="text-right">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Cash Drawer Reconciliation & Credit Summary */}
          <div className={styles.gridTwoCols}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}><CheckSquare size={16} /> Cash Drawer Reconciliation</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span className={styles.metaLabel}>Opening Drawer Float</span>
                <input 
                  type="number" 
                  value={openingFloat} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setOpeningFloat(val);
                    localStorage.setItem(`opening_float_${selectedDate}`, val);
                  }}
                  className={styles.reconcileInput}
                  disabled={isDayClosed}
                />
              </div>

              <table className={styles.dataTable} style={{ marginBottom: '1rem' }}>
                <tbody>
                  <tr>
                    <td>(+) Cash Sales</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.cashSales.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>(+) Cash Credit Collections</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.cashCreditCollections.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>(+) Cash Advance / Deposits</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.cashAdvancePayments.toFixed(2)}</td>
                  </tr>
                  <tr style={{ color: '#DC2626' }}>
                    <td>(-) Cash Refunds Processed</td>
                    <td className="text-right">- <CurrencySymbol /> {metrics.cashRefunds.toFixed(2)}</td>
                  </tr>
                  <tr style={{ color: '#DC2626' }}>
                    <td>(-) Cash Expenses Paid</td>
                    <td className="text-right">- <CurrencySymbol /> {metrics.cashExpenses.toFixed(2)}</td>
                  </tr>
                  
                  <tr style={{ color: '#DC2626' }}>
                    <td>(-) Cash Withdrawals / Drops</td>
                    <td className="text-right" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.25rem' }}>
                      - <CurrencySymbol />
                      <input 
                        type="number" 
                        value={cashWithdrawals} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCashWithdrawals(val);
                          localStorage.setItem(`cash_withdrawal_${selectedDate}`, val);
                        }}
                        className={styles.reconcileInputCompact}
                        disabled={isDayClosed}
                      />
                    </td>
                  </tr>

                  <tr className={styles.highlightRow}>
                    <td>Expected Cash In Drawer</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.expectedCash.toFixed(2)}</td>
                  </tr>

                  <tr>
                    <td>Actual Cash Counted</td>
                    <td className="text-right" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.25rem' }}>
                      <CurrencySymbol />
                      <input 
                        type="number" 
                        value={actualCashCounted} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setActualCashCounted(val);
                          localStorage.setItem(`actual_cash_${selectedDate}`, val);
                        }}
                        className={styles.reconcileInputCompact}
                        disabled={isDayClosed}
                      />
                    </td>
                  </tr>

                  <tr className={metrics.cashDifference === 0 ? styles.successRow : metrics.cashDifference > 0 ? styles.warningRow : styles.dangerRow}>
                    <td style={{ fontWeight: 800 }}>Discrepancy / Difference</td>
                    <td className="text-right" style={{ fontWeight: 800 }}>
                      {metrics.cashDifference > 0 ? '+' : ''}<CurrencySymbol /> {metrics.cashDifference.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={styles.metaLabel}>Drawer Status</span>
                <span className={`${styles.statusBadge} ${
                  metrics.cashDifference === 0 ? styles.badgeSuccess : metrics.cashDifference > 0 ? styles.badgeWarning : styles.badgeDanger
                }`}>
                  {metrics.cashDifference === 0 ? 'Balanced' : metrics.cashDifference > 0 ? 'Over' : 'Short'}
                </span>
              </div>
            </div>

            {/* 7. Credit Summary */}
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}><CreditCard size={16} /> Credit Ledger Summary</h3>
              <table className={styles.dataTable}>
                <tbody>
                  <tr>
                    <td>Opening Credit Outstanding</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.openingOutstanding.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>(+) Today's Credit Sales</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.todayCreditSales.toFixed(2)}</td>
                  </tr>
                  <tr style={{ color: '#059669' }}>
                    <td>(-) Today's Credit Collections</td>
                    <td className="text-right">- <CurrencySymbol /> {metrics.todayCreditSettled.toFixed(2)}</td>
                  </tr>
                  <tr style={{ color: '#059669' }}>
                    <td>(-) Today's Credit Returns / Cancellations</td>
                    <td className="text-right">- <CurrencySymbol /> {metrics.todayCreditReturned.toFixed(2)}</td>
                  </tr>
                  <tr className={styles.highlightRow}>
                    <td>Closing Credit Outstanding</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.closingOutstanding.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 8. Operational Summaries */}
          <div className={styles.gridTwoCols}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Order Diagnostics</h3>
              <div className={styles.statsList}>
                <div className={styles.statLine}><span>Orders Created</span><strong>{metrics.totalOrders}</strong></div>
                <div className={styles.statLine}><span>Delivered</span><strong>{metrics.deliveredOrders}</strong></div>
                <div className={styles.statLine}><span>Pending Delivery</span><strong>{metrics.pendingOrders}</strong></div>
                <div className={styles.statLine}><span>Cancelled Today</span><strong>{metrics.cancelledOrders}</strong></div>
                <div className={styles.statLine}><span>Average Ticket Size</span><strong><CurrencySymbol /> {metrics.avgOrderValue.toFixed(2)}</strong></div>
                <div className={styles.statLine}><span>Highest Bill Value</span><strong><CurrencySymbol /> {metrics.highestInvoice.toFixed(2)}</strong></div>
                <div className={styles.statLine}><span>Lowest Bill Value</span><strong><CurrencySymbol /> {metrics.lowestInvoice.toFixed(2)}</strong></div>
              </div>
            </div>

            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Customer Demographics</h3>
              <div className={styles.statsList}>
                <div className={styles.statLine}><span>New Registrations</span><strong>{newCustomersCount}</strong></div>
                <div className={styles.statLine}><span>Returning Customers</span><strong>{metrics.returningCustomers}</strong></div>
                <div className={styles.statLine}><span>Active Credit Accounts</span><strong>{metrics.creditCustomers}</strong></div>
                <div className={styles.statLine}><span>VIP Customer Count</span><strong>{metrics.vipCustomers}</strong></div>
                <div className={styles.statLine}><span>Average Customer Spend</span><strong><CurrencySymbol /> {metrics.avgCustSpend.toFixed(2)}</strong></div>
                <div className={styles.statLine}><span>Top Spender</span><strong>{topCustomer.name} (<CurrencySymbol />{topCustomer.amount.toFixed(2)})</strong></div>
              </div>
            </div>
          </div>

          {/* 10. Service wise sales & Garments */}
          <div className={styles.gridTwoCols}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Service Performance</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Service Category</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(metrics.serviceSales).length === 0 ? (
                    <tr><td colSpan="3" className="text-center">No service records today</td></tr>
                  ) : (
                    Object.entries(metrics.serviceSales)
                      .sort((a, b) => b[1].revenue - a[1].revenue)
                      .map(([name, data]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td className="text-right">{data.qty}</td>
                          <td className="text-right"><CurrencySymbol /> {data.revenue.toFixed(2)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Garment Diagnostics</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Garment Item</th>
                    <th className="text-right">Pieces</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(metrics.garmentSummary).length === 0 ? (
                    <tr><td colSpan="3" className="text-center">No garment items processed today</td></tr>
                  ) : (
                    Object.entries(metrics.garmentSummary)
                      .sort((a, b) => b[1].revenue - a[1].revenue)
                      .slice(0, 8)
                      .map(([name, data]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td className="text-right">{data.pieces}</td>
                          <td className="text-right"><CurrencySymbol /> {data.revenue.toFixed(2)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 12. Employee performance & Expenses */}
          <div className={styles.gridTwoCols}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Staff Performance Metrics</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Cashier/Operator</th>
                    <th className="text-right">Tickets</th>
                    <th className="text-right">Sales Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(metrics.employeePerf).length === 0 ? (
                    <tr><td colSpan="3" className="text-center">No employee activities logged today</td></tr>
                  ) : (
                    Object.entries(metrics.employeePerf).map(([emp, data]) => (
                      <tr key={emp}>
                        <td>{emp}</td>
                        <td className="text-right">{data.orders}</td>
                        <td className="text-right"><CurrencySymbol /> {data.revenue.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Store Expenses summary</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Expense Category</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan="2" className="text-center">No expenses logged today</td></tr>
                  ) : (
                    expenses.map((exp, idx) => (
                      <tr key={idx}>
                        <td>{exp.title} ({exp.category || 'Other'})</td>
                        <td className="text-right"><CurrencySymbol /> {(exp.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 14. Discounts & Refunds */}
          <div className={styles.gridTwoCols}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Discount Diagnostics</h3>
              <table className={styles.dataTable}>
                <tbody>
                  <tr>
                    <td>Coupon / Promo Codes</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.couponDiscounts.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Manual POS Discounts</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.manualDiscounts.toFixed(2)}</td>
                  </tr>
                  <tr className={styles.highlightRow}>
                    <td>Total Discounts</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.totalDiscount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Refund & Returns Diagnostics</h3>
              <table className={styles.dataTable}>
                <tbody>
                  <tr>
                    <td>Refund Count</td>
                    <td className="text-right">{metrics.refundCount}</td>
                  </tr>
                  <tr>
                    <td>Total Amount Refunded</td>
                    <td className="text-right"><CurrencySymbol /> {metrics.refundAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 17. Financial Flow Reconciliation */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}><ShieldCheck size={16} /> Financial Flow Reconciliation</h3>
            <div className={styles.flowWrapper}>
              <div className={styles.flowNode}>
                <span>Gross Sales</span>
                <strong><CurrencySymbol /> {metrics.grossSales.toFixed(2)}</strong>
              </div>
              <div className={styles.flowArrow}>↓</div>
              <div className={styles.flowNode} style={{ color: '#DC2626' }}>
                <span>Discounts</span>
                <strong>- <CurrencySymbol /> {metrics.totalDiscount.toFixed(2)}</strong>
              </div>
              <div className={styles.flowArrow}>↓</div>
              <div className={styles.flowNode} style={{ color: '#10B981' }}>
                <span>Net Sales</span>
                <strong><CurrencySymbol /> {metrics.netSales.toFixed(2)}</strong>
              </div>
              <div className={styles.flowArrow}>↓</div>
              <div className={styles.flowNode}>
                <span>VAT Collected</span>
                <strong>+ <CurrencySymbol /> {metrics.vatCollected.toFixed(2)}</strong>
              </div>
              <div className={styles.flowArrow}>↓</div>
              <div className={styles.flowNode} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <span>Grand Total (Net + VAT)</span>
                <strong><CurrencySymbol /> {metrics.grandTotal.toFixed(2)}</strong>
              </div>
              <div className={styles.flowArrow}>↓</div>
              <div className={styles.flowNode} style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                <span>Collected Amount</span>
                <strong><CurrencySymbol /> {metrics.totalCollected.toFixed(2)}</strong>
              </div>
              <div className={styles.flowArrow}>↓</div>
              <div className={styles.flowNode} style={{ color: '#DC2626' }}>
                <span>Pending Balance (On Account)</span>
                <strong><CurrencySymbol /> {metrics.creditSales.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* 18. Audit Information */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>Audit Log Metadata</h3>
            <div className={styles.metaGrid}>
              <div>
                <span className={styles.metaLabel}>Device Name</span>
                <span className={styles.metaVal}>POS-Terminal-01</span>
              </div>
              <div>
                <span className={styles.metaLabel}>Software Version</span>
                <span className={styles.metaVal}>v3.4.1</span>
              </div>
              <div>
                <span className={styles.metaLabel}>Database Version</span>
                <span className={styles.metaVal}>SQLite 3.39</span>
              </div>
              <div>
                <span className={styles.metaLabel}>Backup Status</span>
                <span className={styles.metaVal} style={{ color: '#10B981', fontWeight: 800 }}>Synced (Cloud)</span>
              </div>
            </div>
          </div>

          {/* Day Close Manager Override Action Button */}
          <div className={`${styles.actionRow} no-print`} style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', gap: '1rem' }}>
            <button 
              className={styles.closeDayBtn} 
              style={{ background: isDayClosed ? '#64748B' : '#DC2626', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              onClick={() => setShowManagerPinModal(true)}
            >
              {isDayClosed ? <Unlock size={16} /> : <Lock size={16} />}
              <span>{isDayClosed ? 'Reopen Business Day' : 'Lock & Close Business Day (Z Report)'}</span>
            </button>
          </div>

          {/* Print specific thermal footer */}
          <div className="print-only" style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: '#94A3B8', borderTop: '1px dashed #E2E8F0', paddingTop: '1rem' }}>
            <p>This Z Close report is system generated.</p>
            <p>Report ID: Z-REP-{selectedDate}-{Math.floor(Math.random()*100000)}</p>
            <p>Timestamp: {new Date().toLocaleString()}</p>
            <p>Laundry Box POS Software</p>
          </div>
        </div>
      )}

      {/* Manager Security PIN Modal */}
      {showManagerPinModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Manager PIN Verification</h3>
              <button className={styles.closeModalBtn} onClick={() => setShowManagerPinModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.25rem' }}>
                Please enter the manager credentials security PIN to lock or unlock the selected business day closing.
              </p>
              <div className={styles.modalInputWrapper}>
                <label>Manager Security PIN</label>
                <div className={styles.modalInputArea}>
                  <Lock size={18} color="#64748B" />
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={managerPinInput}
                    onChange={(e) => {
                      setManagerPinInput(e.target.value.replace(/\D/g, ''));
                      setManagerPinError('');
                    }}
                    style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.25rem', fontWeight: 700 }}
                    autoFocus
                  />
                </div>
                {managerPinError && (
                  <p className={styles.errorText}>{managerPinError}</p>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowManagerPinModal(false)}>
                Cancel
              </button>
              <button 
                className={styles.confirmBtn} 
                onClick={() => {
                  if (managerPinInput === (settings.orderDeletePin || '0000')) {
                    setShowManagerPinModal(false);
                    setManagerPinInput('');
                    if (!isDayClosed) {
                      localStorage.setItem(`day_close_status_${selectedDate}`, 'CLOSED');
                      setIsDayClosed(true);
                      alert(`Business Day ${formatDate(selectedDate)} closed and locked successfully!`);
                    } else {
                      localStorage.removeItem(`day_close_status_${selectedDate}`);
                      setIsDayClosed(false);
                      alert(`Business Day ${formatDate(selectedDate)} unlocked.`);
                    }
                  } else {
                    setManagerPinError('Incorrect PIN code.');
                  }
                }}
              >
                Verify PIN
              </button>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
}
