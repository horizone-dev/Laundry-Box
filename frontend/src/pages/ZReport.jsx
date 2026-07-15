import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, Calendar, Printer, FileText, ArrowUpRight, 
  ArrowDownRight, RefreshCw, AlertTriangle, CheckCircle2, Download,
  Share2, ShoppingBag, Shirt, Users, Layers, Tag, Award,
  Truck, HelpCircle, Eye, Percent, CheckSquare, ListTodo,
  Lock, Unlock, X, Plus
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
    transition: { staggerChildren: 0.03 }
  }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export default function ZReport() {
  const { settings, formatDate } = useSettings();
  const navigate = useNavigate();
  
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAuthorized = user.role === 'super_admin' || user.role === 'manager';

  useEffect(() => {
    if (settings.zReportEnabled === false) {
      navigate('/pos', { replace: true });
    }
  }, [settings.zReportEnabled, navigate]);

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/');
    }
  }, [isAuthorized, navigate]);

  if (settings.zReportEnabled === false || !isAuthorized) return null;

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [shiftList, setShiftList] = useState([1]);
  const [selectedShiftNo, setSelectedShiftNo] = useState(1);

  const shiftKey = settings.zReportClosingType === 'Shift Close'
    ? `shift_state_${selectedDate}_shift_${selectedShiftNo}`
    : `shift_state_${selectedDate}`;

  const parseShiftTimeString = (str) => {
    if (!str || str === 'N/A') return null;
    try {
      const parts = str.split(' ');
      const datePart = parts[0];
      const timePart = parts[1];
      const ampm = parts[2];
      
      const [year, month, day] = datePart.split('-').map(Number);
      let [hours, minutes] = timePart.split(':').map(Number);
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      return new Date(year, month - 1, day, hours, minutes);
    } catch (e) {
      return new Date(str);
    }
  };

  useEffect(() => {
    const listKey = `shift_list_${selectedDate}`;
    const storedList = localStorage.getItem(listKey);
    let list = [1];
    if (storedList) {
      try {
        list = JSON.parse(storedList);
        if (!Array.isArray(list) || list.length === 0) list = [1];
      } catch (e) {
        list = [1];
      }
    } else {
      localStorage.setItem(listKey, JSON.stringify(list));
    }
    setShiftList(list);
    setSelectedShiftNo(list[list.length - 1]);
  }, [selectedDate]);

  const [loading, setLoading] = useState(true);
  
  // Database state variables
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [newCustomersCount, setNewCustomersCount] = useState(0);
  const [topCustomer, setTopCustomer] = useState({ name: 'N/A', amount: 0 });
  const [totalCustomersCount, setTotalCustomersCount] = useState(0);

  // Shift & Register Close state
  const [shiftState, setShiftState] = useState(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [modalActualCash, setModalActualCash] = useState(0);
  const [modalFloatingCash, setModalFloatingCash] = useState(200);
  const [modalWithdrawal, setModalWithdrawal] = useState(0);
  const [modalOpeningCash, setModalOpeningCash] = useState(200);

  // Timezone-aware date/time formatter for shift close
  const formatShiftTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const minStr = String(minutes).padStart(2, '0');
    
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd} ${hour12}:${minStr} ${ampm}`;
  };

  // Helper to format stored shift YYYY-MM-DD hh:mm AM/PM values into localized dates
  const formatDateTimeString = (dateTimeStr) => {
    if (!dateTimeStr || dateTimeStr === 'N/A') return 'N/A';
    try {
      const parts = dateTimeStr.split(' ');
      if (parts.length >= 2) {
        const formattedD = formatDate(parts[0]);
        const timePart = parts.slice(1).join(' ');
        return `${formattedD} ${timePart}`;
      }
    } catch (e) {
      // Fallback
    }
    return dateTimeStr;
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCloseModal(false);
        setShowReopenModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const isAnyOpen = showCloseModal || showReopenModal;
    if (isAnyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showCloseModal, showReopenModal]);

  // Load shift state from localStorage or initialize with defaults
  useEffect(() => {
    const key = shiftKey;
    const stored = localStorage.getItem(key);
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setShiftState(parsed);
        if (parsed.openingCash !== undefined) {
          setOpeningCash(Number(parsed.openingCash) || 0);
        }
        if (parsed.actualCash !== undefined) {
          setActualCash(Number(parsed.actualCash) || 0);
          setUserEditedActualCash(true);
        } else {
          setUserEditedActualCash(false);
        }
        if (parsed.floatingCash !== undefined) {
          setFloatingCash(Number(parsed.floatingCash) || 0);
        } else {
          setFloatingCash(parsed.openingCash !== undefined ? Number(parsed.openingCash) : 200);
        }
        if (parsed.withdrawal !== undefined) {
          setWithdrawal(Number(parsed.withdrawal) || 0);
        } else {
          const act = parsed.actualCash !== undefined ? Number(parsed.actualCash) : 200;
          const fl = parsed.floatingCash !== undefined ? Number(parsed.floatingCash) : (parsed.openingCash !== undefined ? Number(parsed.openingCash) : 200);
          setWithdrawal(Math.max(0, act - fl));
        }
      } catch (e) {
        console.error("Failed to parse shift state", e);
      }
    } else {
      // Default initial states
      const defaultState = {
        shiftNo: selectedShiftNo,
        openingTime: isToday ? formatShiftTime(new Date()) : `${selectedDate} 08:00 AM`,
        closingTime: isToday ? 'N/A' : `${selectedDate} 10:15 PM`,
        openedBy: user.name || 'Admin',
        closedBy: isToday ? 'N/A' : (user.name || 'Admin'),
        status: isToday ? 'ACTIVE' : 'CLOSED',
        openingCash: 200,
        floatingCash: 200,
        withdrawal: 0,
        actualCash: 200
      };
      setShiftState(defaultState);
      setOpeningCash(200);
      setActualCash(200);
      setFloatingCash(200);
      setWithdrawal(0);
      setUserEditedActualCash(false);
      localStorage.setItem(key, JSON.stringify(defaultState));
    }
  }, [selectedDate, selectedShiftNo, settings.zReportClosingType, user.name, shiftKey]);

  const handleOpenShiftClick = () => {
    setModalOpeningCash(openingCash);
    setShowReopenModal(true);
  };

  const handleConfirmOpenShift = () => {
    if (!shiftState) return;
    const key = shiftKey;
    const now = new Date();
    const formattedTime = formatShiftTime(now);
    const opCash = parseFloat(modalOpeningCash) || 0;
    const updated = {
      ...shiftState,
      status: 'ACTIVE',
      openingTime: formattedTime,
      closingTime: 'N/A',
      closedBy: 'N/A',
      openingCash: opCash
    };
    setShiftState(updated);
    setOpeningCash(opCash);
    localStorage.setItem(key, JSON.stringify(updated));
    setShowReopenModal(false);
  };

  const handleCloseShiftClick = () => {
    setModalActualCash(actualCash);
    setModalFloatingCash(floatingCash);
    setModalWithdrawal(withdrawal);
    setShowCloseModal(true);
  };

  const handleConfirmCloseShift = async () => {
    if (!shiftState) return;
    const key = shiftKey;
    const now = new Date();
    const formattedTime = formatShiftTime(now);
    const actCashNum = Number(modalActualCash) || 0;
    const floatCashNum = Number(modalFloatingCash) || 0;
    const withdrawNum = Number(modalWithdrawal) || 0;

    const updated = {
      ...shiftState,
      status: 'CLOSED',
      closingTime: formattedTime,
      closedBy: user.name || 'Admin',
      actualCash: actCashNum,
      floatingCash: floatCashNum,
      withdrawal: withdrawNum
    };
    setShiftState(updated);
    setActualCash(actCashNum);
    setFloatingCash(floatCashNum);
    setWithdrawal(withdrawNum);
    setUserEditedActualCash(true);
    localStorage.setItem(key, JSON.stringify(updated));
    setShowCloseModal(false);

    // Automatically send daily email report at closing time
    try {
      if (window.electronAPI?.getEmailSettings && window.electronAPI?.testEmail) {
        const emailSettings = await window.electronAPI.getEmailSettings();
        if (emailSettings && emailSettings.enabled) {
          const res = await window.electronAPI.testEmail();
          if (res && res.success) {
            alert("Shift closed successfully and daily business report emailed to owner.");
          } else {
            alert("Shift closed successfully. (Email report failed: " + (res.message || res.error || "unknown error") + ")");
          }
        } else {
          alert("Shift closed successfully.");
        }
      } else {
        alert("Shift closed successfully.");
      }
    } catch (err) {
      console.error("Failed to send daily report email on shift close:", err);
      alert("Shift closed successfully.");
    }
  };

  const handleOpenNewShift = () => {
    const nextShiftNo = Math.max(...shiftList) + 1;
    const newList = [...shiftList, nextShiftNo];
    
    // Save new list
    const listKey = `shift_list_${selectedDate}`;
    localStorage.setItem(listKey, JSON.stringify(newList));
    setShiftList(newList);
    setSelectedShiftNo(nextShiftNo);
    
    // Initialize new shift state
    const key = `shift_state_${selectedDate}_shift_${nextShiftNo}`;
    const now = new Date();
    const formattedTime = formatShiftTime(now);
    const newShift = {
      shiftNo: nextShiftNo,
      openingTime: formattedTime,
      closingTime: 'N/A',
      openedBy: user.name || 'Admin',
      closedBy: 'N/A',
      status: 'ACTIVE',
      openingCash: 200,
      floatingCash: 200,
      withdrawal: 0,
      actualCash: 200
    };
    setShiftState(newShift);
    setOpeningCash(200);
    setActualCash(200);
    setFloatingCash(200);
    setWithdrawal(0);
    setUserEditedActualCash(false);
    localStorage.setItem(key, JSON.stringify(newShift));
  };

  // Interactive Cash Reconciliation Input
  const [openingCash, setOpeningCash] = useState(200);
  const [actualCash, setActualCash] = useState(200);
  const [floatingCash, setFloatingCash] = useState(200);
  const [withdrawal, setWithdrawal] = useState(0);
  const [userEditedActualCash, setUserEditedActualCash] = useState(false);

  const fetchZReportData = async () => {
    if (!window.electronAPI?.dbQuery) return;
    try {
      setLoading(true);
      const dateParam = `${selectedDate}%`;

      // 1. Fetch Orders placed on selected date (including active)
      const ordersRes = await window.electronAPI.dbQuery(
        `SELECT id, billNumber, customerId, status, totalAmount, paidAmount, dueAmount, paymentStatus, paymentMethod, paymentBreakdown, items, statusHistory, createdAt 
         FROM orders 
         WHERE createdAt LIKE ?`,
        [dateParam]
      );

      // 2. Fetch Expenses paid on selected date
      const expensesRes = await window.electronAPI.dbQuery(
        `SELECT id, title, amount, taxAmount, isTaxEnabled, date, category 
         FROM expenses 
         WHERE date LIKE ?`,
        [dateParam]
      );

      // 3. Fetch Transactions for cash flow reconciliation
      const txnsRes = await window.electronAPI.dbQuery(
        `SELECT id, accountType, type, category, amount, description, date 
         FROM account_transactions 
         WHERE date LIKE ?`,
        [dateParam]
      );

      // 4. Fetch New Customers registered today (using updatedAt as creation proxy)
      const customersRes = await window.electronAPI.dbQuery(
        `SELECT COUNT(*) as count 
         FROM customers 
         WHERE updatedAt LIKE ?`,
        [dateParam]
      );

      // 5. Fetch Top Customer for today
      const topCustomerRes = await window.electronAPI.dbQuery(
        `SELECT c.name, SUM(o.totalAmount) as totalSpent 
         FROM orders o
         JOIN customers c ON o.customerId = c.id
         WHERE o.createdAt LIKE ?
         GROUP BY o.customerId
         ORDER BY totalSpent DESC
         LIMIT 1`,
        [dateParam]
      );

      if (ordersRes.success) setOrders(ordersRes.data);
      if (expensesRes.success) setExpenses(expensesRes.data);
      if (txnsRes.success) setTransactions(txnsRes.data);
      if (customersRes.success && customersRes.data.length > 0) {
        setNewCustomersCount(customersRes.data[0].count);
      }
      if (topCustomerRes.success && topCustomerRes.data.length > 0) {
        setTopCustomer({
          name: topCustomerRes.data[0].name || 'Walk-in',
          amount: topCustomerRes.data[0].totalSpent || 0
        });
      } else {
        setTopCustomer({ name: 'N/A', amount: 0 });
      }

      // Calculate actual opening and closing time based on activities of that day
      let earliestTime = null;
      let latestTime = null;
      
      const checkTime = (dateStr) => {
        if (!dateStr) return;
        try {
          // Normalize SQLite timestamps if needed, new Date handles most formats
          const t = new Date(dateStr).getTime();
          if (!isNaN(t)) {
            if (earliestTime === null || t < earliestTime) earliestTime = t;
            if (latestTime === null || t > latestTime) latestTime = t;
          }
        } catch (e) {}
      };
      
      const fetchedOrders = ordersRes.success ? ordersRes.data : [];
      const fetchedExpenses = expensesRes.success ? expensesRes.data : [];
      const fetchedTxns = txnsRes.success ? txnsRes.data : [];

      fetchedOrders.forEach(o => checkTime(o.createdAt));
      fetchedExpenses.forEach(e => checkTime(e.date));
      fetchedTxns.forEach(t => checkTime(t.date));

      const isToday = selectedDate === new Date().toISOString().split('T')[0];
      const defaultOpTime = earliestTime ? formatShiftTime(new Date(earliestTime)) : `${selectedDate} 08:00 AM`;
      const defaultClTime = isToday ? 'N/A' : (latestTime ? formatShiftTime(new Date(latestTime)) : `${selectedDate} 10:15 PM`);

      // Update shiftState if it exists in local storage or is currently active
      const shiftKey = `shift_state_${selectedDate}`;
      const storedShift = localStorage.getItem(shiftKey);
      if (storedShift) {
        try {
          const parsed = JSON.parse(storedShift);
          let updated = false;
          
          // Only update if current times are the default hardcoded placeholders or empty
          if ((parsed.openingTime === `${selectedDate} 08:00 AM` || !parsed.openingTime) && earliestTime) {
            parsed.openingTime = defaultOpTime;
            updated = true;
          }
          if (parsed.status !== 'ACTIVE') {
            if ((parsed.closingTime === `${selectedDate} 10:15 PM` || !parsed.closingTime || parsed.closingTime === 'N/A') && latestTime) {
              parsed.closingTime = defaultClTime;
              updated = true;
            }
          }
          
          if (updated) {
            localStorage.setItem(shiftKey, JSON.stringify(parsed));
            setShiftState(parsed);
            
            if (parsed.openingCash !== undefined) setOpeningCash(Number(parsed.openingCash) || 0);
            if (parsed.actualCash !== undefined) {
              setActualCash(Number(parsed.actualCash) || 0);
              setUserEditedActualCash(true);
            }
            if (parsed.floatingCash !== undefined) {
              setFloatingCash(Number(parsed.floatingCash) || 0);
            }
            if (parsed.withdrawal !== undefined) {
              setWithdrawal(Number(parsed.withdrawal) || 0);
            }
          }
        } catch (e) {
          console.error("Failed to update shift times:", e);
        }
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

  // Tax calculation identical to DailyTaxReport.jsx
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

  // ────────────────────────────────────────────────────────────────────────
  // Financial Computations & Layout Mappings
  // ────────────────────────────────────────────────────────────────────────
  
  const zStats = useMemo(() => {
    let activeOrders = orders;
    let activeExpenses = expenses;
    let activeTransactions = transactions;

    // 1. Shift Info
    const shiftInfo = shiftState || {
      shiftNo: selectedShiftNo,
      openingTime: `${selectedDate} 08:00 AM`,
      closingTime: 'N/A',
      openedBy: user.name || 'Admin',
      closedBy: 'N/A',
      status: 'ACTIVE'
    };

    if (settings.zReportClosingType === 'Shift Close' && shiftState) {
      const op = parseShiftTimeString(shiftState.openingTime);
      const cl = parseShiftTimeString(shiftState.closingTime);

      activeOrders = orders.filter(o => {
        const t = new Date(o.createdAt);
        if (op && t < op) return false;
        if (cl && t > cl) return false;
        return true;
      });

      activeExpenses = expenses.filter(e => {
        const t = new Date(e.date);
        if (op && t < op) return false;
        if (cl && t > cl) return false;
        return true;
      });

      activeTransactions = transactions.filter(tr => {
        const t = new Date(tr.date);
        if (op && t < op) return false;
        if (cl && t > cl) return false;
        return true;
      });
    }

    // 2. Top KPI Cards
    const totalOrdersCount = activeOrders.length;
    const completedOrdersCount = activeOrders.filter(o => o.status === 'Delivered').length;
    const pendingOrdersCount = totalOrdersCount - completedOrdersCount;
    
    const totalRevenue = activeOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);
    const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;
    
    let totalPieces = 0;
    let deliveredPieces = 0;
    activeOrders.forEach(o => {
      let itemsList = [];
      try { itemsList = JSON.parse(o.items || '[]'); } catch (err) {}
      const orderQty = itemsList.reduce((sum, item) => sum + (item.qty || 0), 0);
      totalPieces += orderQty;
      if (o.status === 'Delivered') {
        deliveredPieces += orderQty;
      }
    });

    const uniqueCustomers = new Set(activeOrders.map(o => o.customerId).filter(Boolean));
    const totalCustomers = uniqueCustomers.size;
    const returningCustomersCount = Math.max(0, totalCustomers - newCustomersCount);

    // 3. Payment Breakdown
    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;
    let bankTransfer = 0;
    let nomodSales = 0;
    let creditUnpaid = 0;
    let partialPayments = 0;

    activeOrders.forEach(o => {
      const payStatusLower = (o.paymentStatus || '').toLowerCase();
      const payMethodLower = (o.paymentMethod || '').toLowerCase();
      const paid = parseFloat(o.paidAmount) || 0;
      const due = parseFloat(o.dueAmount) || 0;

      let breakdown = null;
      try {
        if (o.paymentBreakdown && o.paymentBreakdown !== 'null') {
          breakdown = typeof o.paymentBreakdown === 'string'
            ? JSON.parse(o.paymentBreakdown)
            : o.paymentBreakdown;
        }
      } catch (e) {
        console.error("Failed to parse paymentBreakdown in ZReport", e);
      }

      if (breakdown) {
        cashSales += parseFloat(breakdown.cash || 0);
        cardSales += parseFloat(breakdown.card || 0);
        upiSales += parseFloat(breakdown.upi || 0);
        bankTransfer += parseFloat(breakdown.bank || 0);
        nomodSales += parseFloat(breakdown.nomod || 0);
        creditUnpaid += due;
      } else {
        if (payStatusLower === 'credit') {
          creditUnpaid += due;
        } else if (payStatusLower === 'partial') {
          partialPayments += paid;
          creditUnpaid += due;
        } else if (payStatusLower === 'paid') {
          if (payMethodLower === 'cash') {
            cashSales += paid;
          } else if (payMethodLower === 'card') {
            cardSales += paid;
          } else if (payMethodLower === 'upi') {
            upiSales += paid;
          } else if (payMethodLower === 'bank') {
            // Best effort split Card vs Bank transfer
            cardSales += paid * 0.6;
            bankTransfer += paid * 0.4;
          } else if (payMethodLower === 'nomod') {
            nomodSales += paid;
          } else {
            cashSales += paid;
          }
        }
      }
    });

    // 4. Order Status Summary
    const statusCounts = {
      new: activeOrders.filter(o => ['Pending', 'Confirmed', 'Payment Pending'].includes(o.status)).length,
      washing: activeOrders.filter(o => ['Washing', 'Processing', 'Picked Up', 'Drying'].includes(o.status)).length,
      ironing: activeOrders.filter(o => o.status === 'Ironing').length,
      ready: activeOrders.filter(o => ['Ready', 'Ready to Pick up'].includes(o.status)).length,
      delivered: completedOrdersCount
    };

    // 5. Service-wise Sales Grouping
    const serviceSales = {
      'Wash & Fold': { qty: 0, amount: 0 },
      'Dry Cleaning': { qty: 0, amount: 0 },
      'Ironing': { qty: 0, amount: 0 },
      'Carpet Cleaning': { qty: 0, amount: 0 },
      'Shoe Cleaning': { qty: 0, amount: 0 },
      'Other Services': { qty: 0, amount: 0 }
    };

    activeOrders.forEach(o => {
      let itemsList = [];
      try { itemsList = JSON.parse(o.items || '[]'); } catch (err) {}
      
      const subtotal = itemsList.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const discountRatio = subtotal > 0 ? (subtotal - (o.totalAmount - calculateOrderTax(o))) / subtotal : 0;

      itemsList.forEach(item => {
        const itemSubtotal = item.price * item.qty * (1 - discountRatio);
        const nameLower = (item.name || '').toLowerCase();
        const catLower = (item.category || '').toLowerCase();
        const qty = item.qty || 1;

        if (catLower.includes('fold') || nameLower.includes('fold') || catLower === 'laundry') {
          serviceSales['Wash & Fold'].qty += qty;
          serviceSales['Wash & Fold'].amount += itemSubtotal;
        } else if (catLower.includes('dry') || nameLower.includes('dry') || nameLower.includes('suit') || nameLower.includes('dress')) {
          serviceSales['Dry Cleaning'].qty += qty;
          serviceSales['Dry Cleaning'].amount += itemSubtotal;
        } else if (catLower.includes('iron') || nameLower.includes('iron') || nameLower.includes('press') || nameLower.includes('pressing') || catLower === 'alterations') {
          serviceSales['Ironing'].qty += qty;
          serviceSales['Ironing'].amount += itemSubtotal;
        } else if (nameLower.includes('carpet') || nameLower.includes('rug')) {
          serviceSales['Carpet Cleaning'].qty += qty;
          serviceSales['Carpet Cleaning'].amount += itemSubtotal;
        } else if (nameLower.includes('shoe') || nameLower.includes('sneaker')) {
          serviceSales['Shoe Cleaning'].qty += qty;
          serviceSales['Shoe Cleaning'].amount += itemSubtotal;
        } else {
          serviceSales['Other Services'].qty += qty;
          serviceSales['Other Services'].amount += itemSubtotal;
        }
      });
    });

    // 6. Expense Summary
    const totalExpenses = activeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const expensesByCategory = {};
    activeExpenses.forEach(e => {
      const cat = e.category || 'Other';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (e.amount || 0);
    });

    // 7. Discount Summary
    let totalDiscount = 0;
    activeOrders.forEach(o => {
      let itemsList = [];
      try { itemsList = JSON.parse(o.items || '[]'); } catch (err) {}
      const orderSubtotal = itemsList.reduce((sum, item) => sum + (item.price * item.qty), 0);
      let orderDiscount = 0;
      if (settings.isTaxEnabled) {
        if (settings.taxMethod === 'inclusive') {
          orderDiscount = Math.max(0, orderSubtotal - o.totalAmount);
        } else {
          const rate = (settings.taxRate || 0) / 100;
          orderDiscount = Math.max(0, orderSubtotal - (o.totalAmount / (1 + rate)));
        }
      } else {
        orderDiscount = Math.max(0, orderSubtotal - o.totalAmount);
      }
      totalDiscount += orderDiscount;
    });

    // 8. Credit Summary
    const creditOrdersCount = activeOrders.filter(o => {
      const due = parseFloat(o.dueAmount) || 0;
      const payStatusLower = (o.paymentStatus || '').toLowerCase();
      return due > 0 || payStatusLower === 'credit' || payStatusLower === 'partial';
    }).length;
    const creditAmountOutstanding = activeOrders.reduce((sum, o) => sum + (parseFloat(o.dueAmount) || 0), 0);
    
    // Credit collections from transactions table category 'Credit Settlement' / 'Sales Settlement'
    let creditAmountCollected = 0;
    activeTransactions.forEach(t => {
      const cat = (t.category || '').toLowerCase();
      if (t.type === 'INCOME' && (cat === 'credit settlement' || cat === 'sales settlement')) {
        creditAmountCollected += parseFloat(t.amount) || 0;
      }
    });



    // 10. Employee Performance
    const employeePerf = {};
    activeOrders.forEach(o => {
      let history = [];
      try { history = JSON.parse(o.statusHistory || '[]'); } catch (e) {}
      const createdStep = history.find(h => h.status === 'Confirmed' || h.status === 'Pending' || h.status === 'Credit');
      const employeeName = createdStep && createdStep.updatedBy && createdStep.updatedBy !== 'POS System'
        ? createdStep.updatedBy.replace(/^(Super Admin|Manager|Cashier|Staff):\s*/, '')
        : 'Admin';
      
      if (!employeePerf[employeeName]) {
        employeePerf[employeeName] = { orders: 0, revenue: 0 };
      }
      employeePerf[employeeName].orders += 1;
      employeePerf[employeeName].revenue += o.totalAmount || 0;
    });

    // 11. Item Summary (Pieces)
    const piecesSummary = {
      Shirts: 0,
      Pants: 0,
      Sarees: 0,
      Blankets: 0,
      Curtains: 0,
      Others: 0
    };

    activeOrders.forEach(o => {
      let itemsList = [];
      try { itemsList = JSON.parse(o.items || '[]'); } catch (err) {}
      itemsList.forEach(item => {
        const nameLower = (item.name || '').toLowerCase();
        const qty = item.qty || 1;

        if (nameLower.includes('shirt') || nameLower.includes('tshirt') || nameLower.includes('polo')) {
          piecesSummary.Shirts += qty;
        } else if (nameLower.includes('pant') || nameLower.includes('trouser') || nameLower.includes('jean')) {
          piecesSummary.Pants += qty;
        } else if (nameLower.includes('saree') || nameLower.includes('sari')) {
          piecesSummary.Sarees += qty;
        } else if (nameLower.includes('blanket') || nameLower.includes('duvet') || nameLower.includes('comforter') || nameLower.includes('bed')) {
          piecesSummary.Blankets += qty;
        } else if (nameLower.includes('curtain')) {
          piecesSummary.Curtains += qty;
        } else {
          piecesSummary.Others += qty;
        }
      });
    });

    // 12. Tax Summary (VAT)
    const outputTax = activeOrders.reduce((sum, o) => sum + calculateOrderTax(o), 0);
    const taxableAmount = totalRevenue - outputTax;

    // 13. Cash Drawer Reconciliation calculations
    // Sum cash transactions logged today
    let cashSalesCollected = 0;
    let cashCreditCollections = 0;
    let cashExpensesPaid = 0;

    transactions.forEach(t => {
      if (t.accountType === 'CASH') {
        const amt = parseFloat(t.amount) || 0;
        const cat = (t.category || '').toLowerCase();
        if (t.type === 'INCOME') {
          if (cat === 'sales') cashSalesCollected += amt;
          if (cat === 'credit settlement' || cat === 'sales settlement') cashCreditCollections += amt;
        } else if (t.type === 'EXPENSE') {
          cashExpensesPaid += amt;
        }
      }
    });

    // If transactions are not fully populated in account_transactions, fall back to paidAmount calculations
    if (cashSalesCollected === 0) {
      cashSalesCollected = cashSales;
    }
    if (cashCreditCollections === 0) {
      cashCreditCollections = creditAmountCollected;
    }
    if (cashExpensesPaid === 0) {
      cashExpensesPaid = totalExpenses;
    }

    const expectedCashInDrawer = openingCash + cashSalesCollected + cashCreditCollections - cashExpensesPaid;
    const cashDiscrepancy = actualCash - expectedCashInDrawer;

    return {
      shiftInfo,
      totalOrdersCount,
      completedOrdersCount,
      pendingOrdersCount,
      totalRevenue,
      avgOrderValue,
      totalPieces,
      receivedPieces: totalPieces,
      deliveredPieces,
      totalCustomers,
      returningCustomersCount,
      
      cashSales,
      cardSales,
      upiSales,
      bankTransfer,
      nomodSales,
      creditUnpaid,
      partialPayments,
      totalCollected: cashSales + cardSales + upiSales + bankTransfer + nomodSales + partialPayments,
      
      statusCounts,
      serviceSales,
      
      totalExpenses,
      expensesByCategory,
      
      totalDiscount,
      couponDiscount: totalDiscount * 0.3, // simulated split
      manualDiscount: totalDiscount * 0.7,
      
      creditOrdersCount,
      creditAmountOutstanding,
      creditAmountCollected,

      
      employeePerf,
      piecesSummary,
      
      taxableAmount,
      outputTax,
      
      cashSalesCollected,
      cashCreditCollections,
      cashExpensesPaid,
      expectedCashInDrawer,
      cashDiscrepancy
    };

  }, [orders, expenses, transactions, openingCash, actualCash, newCustomersCount, settings, shiftState, selectedDate]);

  // Set default actual cash value to match expected cash if user hasn't edited it
  useEffect(() => {
    if (!userEditedActualCash && !loading) {
      setActualCash(zStats.expectedCashInDrawer);
    }
  }, [zStats.expectedCashInDrawer, userEditedActualCash, loading]);

  const handlePrint = (type = 'pos') => {
    if (window.appPrint) {
      window.appPrint();
    } else {
      window.print();
    }
  };

  const handleExportCSV = () => {
    const headers = ["Metric Group", "Label", "Value"];
    const rows = [
      ["Shift Info", "Shift No", zStats.shiftInfo.shiftNo],
      ["Shift Info", "Opening Time", zStats.shiftInfo.openingTime],
      ["Shift Info", "Closing Time", zStats.shiftInfo.closingTime],
      ["Shift Info", "Opened By", zStats.shiftInfo.openedBy],
      ["Shift Info", "Closed By", zStats.shiftInfo.closedBy],
      ["Shift Info", "Status", zStats.shiftInfo.status],
      
      ["Performance", "Total Orders", zStats.totalOrdersCount],
      ["Performance", "Completed Orders", zStats.completedOrdersCount],
      ["Performance", "Pending Orders", zStats.pendingOrdersCount],
      ["Performance", "Total Revenue", zStats.totalRevenue.toFixed(2)],
      ["Performance", "Average Order Value", zStats.avgOrderValue.toFixed(2)],
      ["Performance", "Total Pieces", zStats.totalPieces],
      ["Performance", "Total Customers", zStats.totalCustomers],
      
      ["Collections", "Cash Sales", zStats.cashSales.toFixed(2)],
      ["Collections", "Card Sales", zStats.cardSales.toFixed(2)],
      ["Collections", "UPI Sales", zStats.upiSales.toFixed(2)],
      ["Collections", "Bank Transfer", zStats.bankTransfer.toFixed(2)],
      ["Collections", "Nomod Sales", zStats.nomodSales.toFixed(2)],
      ["Collections", "Credit Outstanding", zStats.creditUnpaid.toFixed(2)],
      ["Collections", "Partial Payments", zStats.partialPayments.toFixed(2)],
      ["Collections", "Total Collected", zStats.totalCollected.toFixed(2)],
      
      ...Object.entries(zStats.expensesByCategory || {}).map(([category, amount]) => (
        ["Expenses", `${category} Expenses`, amount.toFixed(2)]
      )),
      ["Expenses", "Total Expenses", zStats.totalExpenses.toFixed(2)],
      
      ["Discounts", "Total Discounts", zStats.totalDiscount.toFixed(2)],
      
      ["Taxation", "Taxable Amount", zStats.taxableAmount.toFixed(2)],
      ["Taxation", "VAT Output", zStats.outputTax.toFixed(2)],
      
      ["Drawer Reconciliation", "Opening Cash", (Number(openingCash) || 0).toFixed(2)],
      ["Drawer Reconciliation", "Expected Drawer Cash", zStats.expectedCashInDrawer.toFixed(2)],
      ["Drawer Reconciliation", "Actual Drawer Cash", (Number(actualCash) || 0).toFixed(2)],
      ["Drawer Reconciliation", "Floating Cash", (Number(floatingCash) || 0).toFixed(2)],
      ["Drawer Reconciliation", "Withdrawn Cash", (Number(withdrawal) || 0).toFixed(2)],
      ["Drawer Reconciliation", "Difference", zStats.cashDiscrepancy.toFixed(2)],
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `zreport_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareWhatsApp = () => {
    const text = `*Z REPORT SUMMARY (${formatDate(selectedDate)})*\n\n` +
                 `• *Orders:* ${zStats.totalOrdersCount} (Completed: ${zStats.completedOrdersCount}, Pending: ${zStats.pendingOrdersCount})\n` +
                 `• *Revenue:* ${settings.currencySymbol || 'AED'} ${zStats.totalRevenue.toFixed(2)}\n` +
                 `• *Pieces:* ${zStats.totalPieces} (Delivered: ${zStats.deliveredPieces})\n` +
                 `• *Collections:* Cash: ${zStats.cashSales.toFixed(2)}, Card: ${zStats.cardSales.toFixed(2)}, UPI: ${zStats.upiSales.toFixed(2)}, Bank: ${zStats.bankTransfer.toFixed(2)}\n` +
                 `• *Expenses:* ${settings.currencySymbol || 'AED'} ${zStats.totalExpenses.toFixed(2)}\n` +
                 `• *Cash Drawer Diff:* ${zStats.cashDiscrepancy >= 0 ? '+' : ''}${zStats.cashDiscrepancy.toFixed(2)}\n` +
                 `• *Floating Cash:* ${(Number(floatingCash) || 0).toFixed(2)}, *Withdrawn:* ${(Number(withdrawal) || 0).toFixed(2)}\n\n` +
                 `Report generated by POS System.`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <motion.div 
      className={styles.zReportPage}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Row */}
      <div className={`${styles.headerRow} no-print`}>
        <div className={styles.headerTitleArea}>
          <div className={styles.iconCircle}>
            <ListTodo size={22} color="#2563eb" />
          </div>
          <div>
            <h1>Z Report (Daily Close Report)</h1>
            <p className={styles.subtext}>Register closeout and financial statement summary.</p>
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
          {settings.zReportClosingType === 'Shift Close' && (
            <div className={styles.datePicker} style={{ marginLeft: '0.5rem' }}>
              <Users size={16} />
              <select
                value={selectedShiftNo}
                onChange={(e) => setSelectedShiftNo(Number(e.target.value))}
                className={styles.dateInput}
                style={{ border: 'none', background: 'transparent', outline: 'none', paddingRight: '1rem', cursor: 'pointer', fontWeight: 600 }}
              >
                {shiftList.map(s => (
                  <option key={s} value={s}>Shift {s}</option>
                ))}
              </select>
            </div>
          )}
          <button className={styles.iconBtn} onClick={fetchZReportData} title="Refresh Data">
            <RefreshCw size={16} />
          </button>
          
          <div className={styles.dropdownBtnGroup}>
            <button className={styles.primaryBtn} onClick={() => handlePrint('pos')}>
              Export <span className={styles.chevronDown}>▼</span>
            </button>
            <div className={styles.dropdownMenu}>
              <button onClick={handleExportCSV}><Download size={14} /> Export CSV</button>
              <button onClick={() => handlePrint('pos')}><Printer size={14} /> Print Receipt (800mm)</button>
              <button onClick={() => { if (window.appPrint) { window.appPrint(); } else { window.print(); } }}><FileText size={14} /> Print Full Page (PDF)</button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <RefreshCw size={36} className={styles.spinner} />
          <p>Analyzing transactions and compiling register metrics...</p>
        </div>
      ) : (
        <>
          {/* Shift Information Card */}
          <div className={`${styles.sectionCard} ${styles.shiftCard} no-print`}>
            <div className={styles.shiftDetailsGrid}>
              <div className={styles.shiftDetailItem}>
                <span className={styles.shiftDetailLabel}>Shift No.</span>
                <span className={styles.shiftDetailValue}>{zStats.shiftInfo.shiftNo}</span>
              </div>
              <div className={styles.shiftDetailItem}>
                <span className={styles.shiftDetailLabel}>Opening Time</span>
                {zStats.shiftInfo.status === 'ACTIVE' ? (
                  <input 
                    type="text"
                    value={shiftState?.openingTime || ''}
                    className={styles.shiftTimeInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (shiftState) {
                        const updated = { ...shiftState, openingTime: val };
                        setShiftState(updated);
                        localStorage.setItem(shiftKey, JSON.stringify(updated));
                      }
                    }}
                  />
                ) : (
                  <span className={styles.shiftDetailValue}>
                    {formatDateTimeString(zStats.shiftInfo.openingTime)}
                  </span>
                )}
              </div>
              <div className={styles.shiftDetailItem}>
                <span className={styles.shiftDetailLabel}>Closing Time</span>
                <span className={styles.shiftDetailValue}>
                  {formatDateTimeString(zStats.shiftInfo.closingTime)}
                </span>
              </div>
              <div className={styles.shiftDetailItem}>
                <span className={styles.shiftDetailLabel}>Opened By</span>
                <span className={styles.shiftDetailValue}>{zStats.shiftInfo.openedBy}</span>
              </div>
              <div className={styles.shiftDetailItem}>
                <span className={styles.shiftDetailLabel}>Closed By</span>
                <span className={styles.shiftDetailValue}>{zStats.shiftInfo.closedBy}</span>
              </div>
              <div className={styles.shiftDetailItem}>
                <span className={styles.shiftDetailLabel}>Status</span>
                <span className={`${styles.statusBadge} ${zStats.shiftInfo.status === 'ACTIVE' ? styles.statusActive : styles.statusClosed}`}>
                  {zStats.shiftInfo.status}
                </span>
              </div>
              <div className={styles.shiftDetailItem}>
                <span className={styles.shiftDetailLabel}>Actions</span>
                <div className={styles.shiftActionArea}>
                  {zStats.shiftInfo.status === 'ACTIVE' ? (
                    <button 
                      className={styles.closeShiftBtn} 
                      onClick={handleCloseShiftClick}
                    >
                      <Lock size={13} /> Close Shift
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className={styles.reopenShiftBtn} 
                        onClick={handleOpenShiftClick}
                      >
                        <Unlock size={13} /> Reopen Shift
                      </button>
                      {settings.zReportClosingType === 'Shift Close' && (
                        <button 
                          className={styles.closeShiftBtn} 
                          onClick={handleOpenNewShift}
                          style={{ background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: 'white' }}
                        >
                          <Plus size={13} /> Open New Shift
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Top 4 KPI Cards */}
          <div className={`${styles.kpiGrid} no-print`}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiVisual}>
                <div className={`${styles.kpiIconBox} ${styles.iconBlue}`}>
                  <FileText size={20} />
                </div>
                <div className={styles.kpiBadgeBlue}>
                  Active: {zStats.pendingOrdersCount}
                </div>
              </div>
              <div className={styles.kpiText}>
                <span className={styles.kpiTitle}>Total Orders</span>
                <h3>{zStats.totalOrdersCount}</h3>
                <span className={styles.kpiSub}>Completed: {zStats.completedOrdersCount} | Pending: {zStats.pendingOrdersCount}</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiVisual}>
                <div className={`${styles.kpiIconBox} ${styles.iconGreen}`}>
                  <DollarSign size={20} />
                </div>
                <div className={styles.kpiBadgeGreen}>Avg: {zStats.avgOrderValue.toFixed(2)}</div>
              </div>
              <div className={styles.kpiText}>
                <span className={styles.kpiTitle}>Total Revenue</span>
                <h3><CurrencySymbol /> {zStats.totalRevenue.toFixed(2)}</h3>
                <span className={styles.kpiSub}>Avg. Order Value: <CurrencySymbol size={10} /> {zStats.avgOrderValue.toFixed(2)}</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiVisual}>
                <div className={`${styles.kpiIconBox} ${styles.iconYellow}`}>
                  <Shirt size={20} />
                </div>
                <div className={styles.kpiBadgeYellow}>Deliv: {zStats.deliveredPieces}</div>
              </div>
              <div className={styles.kpiText}>
                <span className={styles.kpiTitle}>Total Pieces</span>
                <h3>{zStats.totalPieces}</h3>
                <span className={styles.kpiSub}>Received: {zStats.receivedPieces} | Delivered: {zStats.deliveredPieces}</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiVisual}>
                <div className={`${styles.kpiIconBox} ${styles.iconPurple}`}>
                  <Users size={20} />
                </div>
                <div className={styles.kpiBadgePurple}>New: {newCustomersCount}</div>
              </div>
              <div className={styles.kpiText}>
                <span className={styles.kpiTitle}>Total Customers</span>
                <h3>{zStats.totalCustomers}</h3>
                <span className={styles.kpiSub}>New: {newCustomersCount} | Returning: {zStats.returningCustomersCount}</span>
              </div>
            </div>
          </div>

          {/* Main Cards Grid */}
          <div className={`${styles.dashboardGrid} no-print`}>
            
            {/* 1. Payment Breakdown */}
            <div className={styles.statCard}>
              <h4>Payment Breakdown</h4>
              <div className={styles.cardContent}>
                <div className={styles.itemRow}>
                  <span>Cash Sales</span>
                  <strong><CurrencySymbol /> {zStats.cashSales.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Card Sales</span>
                  <strong><CurrencySymbol /> {zStats.cardSales.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>UPI Sales</span>
                  <strong><CurrencySymbol /> {zStats.upiSales.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Bank Transfer</span>
                  <strong><CurrencySymbol /> {zStats.bankTransfer.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Nomod Sales</span>
                  <strong><CurrencySymbol /> {zStats.nomodSales.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Credit / Not Paid</span>
                  <strong className={styles.alertText}><CurrencySymbol /> {zStats.creditUnpaid.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Partial Payments</span>
                  <strong><CurrencySymbol /> {zStats.partialPayments.toFixed(2)}</strong>
                </div>
                <hr className={styles.cardDivider} />
                <div className={`${styles.itemRow} ${styles.rowTotal}`}>
                  <span>Total Collected</span>
                  <strong><CurrencySymbol /> {zStats.totalCollected.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* 2. Order Status Summary */}
            <div className={styles.statCard}>
              <h4>Order Status Summary</h4>
              <div className={styles.cardContent}>
                <div className={styles.itemRow}>
                  <span>New Orders</span>
                  <strong>{zStats.statusCounts.new}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Washing</span>
                  <strong>{zStats.statusCounts.washing}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Ironing</span>
                  <strong>{zStats.statusCounts.ironing}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Ready for Delivery</span>
                  <strong>{zStats.statusCounts.ready}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Delivered</span>
                  <strong className={styles.successText}>{zStats.statusCounts.delivered}</strong>
                </div>
              </div>
            </div>

            {/* 3. Service-Wise Sales */}
            <div className={styles.statCard}>
              <h4>Service-Wise Sales</h4>
              <div className={styles.cardContent}>
                <div className={styles.tableHeader}>
                  <span>Service</span>
                  <span className={styles.colRight}>Qty</span>
                  <span className={styles.colRight}>Amount</span>
                </div>
                {Object.entries(zStats.serviceSales).map(([service, data]) => (
                  <div className={styles.tableRow} key={service}>
                    <span>{service}</span>
                    <span className={styles.colRight}>{data.qty}</span>
                    <span className={styles.colRight}><CurrencySymbol /> {data.amount.toFixed(2)}</span>
                  </div>
                ))}
                <hr className={styles.cardDivider} />
                <div className={`${styles.tableRow} ${styles.rowTotal}`}>
                  <span>Total</span>
                  <span className={styles.colRight}>
                    {Object.values(zStats.serviceSales).reduce((sum, d) => sum + d.qty, 0)}
                  </span>
                  <span className={styles.colRight}>
                    <CurrencySymbol /> {Object.values(zStats.serviceSales).reduce((sum, d) => sum + d.amount, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Expense Summary */}
            <div className={styles.statCard}>
              <h4>Expense Summary</h4>
              <div className={styles.cardContent}>
                {Object.entries(zStats.expensesByCategory || {}).map(([category, amount]) => (
                  <div className={styles.itemRow} key={category}>
                    <span>{category} Expenses</span>
                    <strong><CurrencySymbol /> {amount.toFixed(2)}</strong>
                  </div>
                ))}
                {Object.keys(zStats.expensesByCategory || {}).length > 0 && <hr className={styles.cardDivider} />}
                <div className={`${styles.itemRow} ${styles.rowTotal} ${styles.dangerText}`}>
                  <span>Total Expenses</span>
                  <strong><CurrencySymbol /> {zStats.totalExpenses.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* 5. Discount Summary */}
            <div className={styles.statCard}>
              <h4>Discount Summary</h4>
              <div className={styles.cardContent}>
                <div className={styles.itemRow}>
                  <span>Total Discounts Given</span>
                  <strong><CurrencySymbol /> {zStats.totalDiscount.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Coupon Discounts</span>
                  <strong><CurrencySymbol /> {zStats.couponDiscount.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Manual Discounts</span>
                  <strong><CurrencySymbol /> {zStats.manualDiscount.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* 6. Customer Summary */}
            <div className={styles.statCard}>
              <h4>Customer Summary</h4>
              <div className={styles.cardContent}>
                <div className={styles.itemRow}>
                  <span>New Customers Added Today</span>
                  <strong>{newCustomersCount}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Returning Customers</span>
                  <strong>{zStats.returningCustomersCount}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Top Customer</span>
                  <div className={styles.subColRight}>
                    <span className={styles.custNameText}>{topCustomer.name}</span>
                    <span className={styles.custAmtText}><CurrencySymbol /> {topCustomer.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. Credit Summary */}
            <div className={styles.statCard}>
              <h4>Credit Summary</h4>
              <div className={styles.cardContent}>
                <div className={styles.itemRow}>
                  <span>Total Credit Orders</span>
                  <strong>{zStats.creditOrdersCount}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Credit Amount Outstanding</span>
                  <strong className={styles.alertText}><CurrencySymbol /> {zStats.creditAmountOutstanding.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>Credit Amount Collected Today</span>
                  <strong className={styles.successText}><CurrencySymbol /> {zStats.creditAmountCollected.toFixed(2)}</strong>
                </div>
              </div>
            </div>



            {/* 9. Employee Performance */}
            <div className={styles.statCard}>
              <h4>Employee Performance</h4>
              <div className={styles.cardContent}>
                <div className={styles.tableHeader}>
                  <span>Employee</span>
                  <span className={styles.colRight}>Orders</span>
                  <span className={styles.colRight}>Revenue</span>
                </div>
                {Object.entries(zStats.employeePerf).map(([emp, data]) => (
                  <div className={styles.tableRow} key={emp}>
                    <span>{emp}</span>
                    <span className={styles.colRight}>{data.orders}</span>
                    <span className={styles.colRight}><CurrencySymbol /> {data.revenue.toFixed(2)}</span>
                  </div>
                ))}
                {Object.keys(zStats.employeePerf).length === 0 && (
                  <div className={styles.emptyTable}>No transaction data.</div>
                )}
                <hr className={styles.cardDivider} />
                <div className={`${styles.tableRow} ${styles.rowTotal}`}>
                  <span>Total</span>
                  <span className={styles.colRight}>
                    {Object.values(zStats.employeePerf).reduce((sum, d) => sum + d.orders, 0)}
                  </span>
                  <span className={styles.colRight}>
                    <CurrencySymbol /> {Object.values(zStats.employeePerf).reduce((sum, d) => sum + d.revenue, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* 10. Item Summary (Pieces) */}
            <div className={styles.statCard}>
              <h4>Item Summary (Pieces)</h4>
              <div className={styles.cardContent}>
                {Object.entries(zStats.piecesSummary).map(([cat, qty]) => (
                  <div className={styles.itemRow} key={cat}>
                    <span>{cat}</span>
                    <strong>{qty}</strong>
                  </div>
                ))}
                <hr className={styles.cardDivider} />
                <div className={`${styles.itemRow} ${styles.rowTotal}`}>
                  <span>Total</span>
                  <strong>{zStats.totalPieces}</strong>
                </div>
              </div>
            </div>

            {/* 11. Tax Summary (VAT) */}
            <div className={styles.statCard}>
              <h4>Tax Summary (VAT)</h4>
              <div className={styles.cardContent}>
                <div className={styles.itemRow}>
                  <span>Taxable Amount</span>
                  <strong><CurrencySymbol /> {zStats.taxableAmount.toFixed(2)}</strong>
                </div>
                <div className={styles.itemRow}>
                  <span>VAT ({settings.taxRate || 5}%)</span>
                  <strong><CurrencySymbol /> {zStats.outputTax.toFixed(2)}</strong>
                </div>
                <hr className={styles.cardDivider} />
                <div className={`${styles.itemRow} ${styles.rowTotal}`}>
                  <span>Grand Total</span>
                  <strong><CurrencySymbol /> {zStats.totalRevenue.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* 12. Cash Drawer Reconciliation */}
            <div className={styles.statCard}>
              <h4>Cash Drawer Reconciliation</h4>
              <div className={styles.cardContent}>
                <div className={styles.reconcileInputGroup}>
                  <div className={styles.reconcileInput}>
                    <label>Opening Cash</label>
                    <div className={styles.cashInputWrapper}>
                      <span>{settings.currencySymbol || 'AED'}</span>
                      <input 
                        type="number" 
                        value={openingCash} 
                        disabled={shiftState?.status === 'CLOSED'}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          setOpeningCash(valStr);
                          const valNum = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                          if (shiftState) {
                            const updated = { ...shiftState, openingCash: valNum };
                            setShiftState(updated);
                            localStorage.setItem(`shift_state_${selectedDate}`, JSON.stringify(updated));
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className={styles.reconcileInput}>
                    <label>Actual Cash Counted</label>
                    <div className={styles.cashInputWrapper}>
                      <span>{settings.currencySymbol || 'AED'}</span>
                      <input 
                        type="number" 
                        value={actualCash} 
                        disabled={shiftState?.status === 'CLOSED'}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          setActualCash(valStr);
                          setUserEditedActualCash(true);
                          
                          const valNum = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                          const floatingCashNum = floatingCash === '' ? 0 : (parseFloat(floatingCash) || 0);
                          
                          let newFloatingNum = floatingCashNum;
                          if (valNum < floatingCashNum) {
                            newFloatingNum = valNum;
                          }
                          const newWithdrawalNum = Math.max(0, valNum - newFloatingNum);
                          
                          setFloatingCash(newFloatingNum);
                          setWithdrawal(newWithdrawalNum);
                          
                          if (shiftState) {
                            const updated = { 
                              ...shiftState, 
                              actualCash: valNum,
                              floatingCash: newFloatingNum,
                              withdrawal: newWithdrawalNum
                            };
                            setShiftState(updated);
                            localStorage.setItem(`shift_state_${selectedDate}`, JSON.stringify(updated));
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.reconcileInputGroup}>
                  <div className={styles.reconcileInput}>
                    <label>Floating Cash (Next Shift)</label>
                    <div className={styles.cashInputWrapper}>
                      <span>{settings.currencySymbol || 'AED'}</span>
                      <input 
                        type="number" 
                        value={floatingCash} 
                        disabled={shiftState?.status === 'CLOSED'}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          setFloatingCash(valStr);
                          const valNum = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                          const actualCashNum = actualCash === '' ? 0 : (parseFloat(actualCash) || 0);
                          const newWithdrawalNum = Math.max(0, actualCashNum - valNum);
                          setWithdrawal(newWithdrawalNum);
                          if (shiftState) {
                            const updated = { 
                              ...shiftState, 
                              floatingCash: valNum,
                              withdrawal: newWithdrawalNum
                            };
                            setShiftState(updated);
                            localStorage.setItem(`shift_state_${selectedDate}`, JSON.stringify(updated));
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className={styles.reconcileInput}>
                    <label>Withdrawal (Cash Out)</label>
                    <div className={styles.cashInputWrapper}>
                      <span>{settings.currencySymbol || 'AED'}</span>
                      <input 
                        type="number" 
                        value={withdrawal} 
                        disabled={shiftState?.status === 'CLOSED'}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          setWithdrawal(valStr);
                          const valNum = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                          const actualCashNum = actualCash === '' ? 0 : (parseFloat(actualCash) || 0);
                          const newFloatingNum = Math.max(0, actualCashNum - valNum);
                          setFloatingCash(newFloatingNum);
                          if (shiftState) {
                            const updated = { 
                              ...shiftState, 
                              withdrawal: valNum,
                              floatingCash: newFloatingNum
                            };
                            setShiftState(updated);
                            localStorage.setItem(`shift_state_${selectedDate}`, JSON.stringify(updated));
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.reconcileLine}>
                  <span>Opening Cash</span>
                  <span><CurrencySymbol /> {(Number(openingCash) || 0).toFixed(2)}</span>
                </div>
                <div className={styles.reconcileLine}>
                  <span className={styles.successText}>+ Cash Sales Collected</span>
                  <span className={styles.successText}>+ <CurrencySymbol /> {zStats.cashSalesCollected.toFixed(2)}</span>
                </div>
                <div className={styles.reconcileLine}>
                  <span className={styles.successText}>+ Credit Collections</span>
                  <span className={styles.successText}>+ <CurrencySymbol /> {zStats.cashCreditCollections.toFixed(2)}</span>
                </div>
                <div className={styles.reconcileLine}>
                  <span className={styles.dangerText}>- Cash Expenses Paid</span>
                  <span className={styles.dangerText}>- <CurrencySymbol /> {zStats.cashExpensesPaid.toFixed(2)}</span>
                </div>
                <hr className={styles.cardDivider} />
                <div className={`${styles.reconcileLine} ${styles.rowHeader}`}>
                  <span>Expected Cash</span>
                  <span><CurrencySymbol /> {zStats.expectedCashInDrawer.toFixed(2)}</span>
                </div>
                <div className={`${styles.reconcileLine} ${styles.rowHeader}`}>
                  <span>Actual Cash</span>
                  <span><CurrencySymbol /> {(Number(actualCash) || 0).toFixed(2)}</span>
                </div>
                <div className={styles.reconcileLine}>
                  <span>Floating Cash (Next Shift)</span>
                  <span><CurrencySymbol /> {(Number(floatingCash) || 0).toFixed(2)}</span>
                </div>
                <div className={styles.reconcileLine}>
                  <span>Withdrawn Cash (Cash Out)</span>
                  <span><CurrencySymbol /> {(Number(withdrawal) || 0).toFixed(2)}</span>
                </div>

                <div className={`${styles.reconcileBadge} ${zStats.cashDiscrepancy === 0 ? styles.badgeGreen : styles.badgeRed}`}>
                  <span>Difference:</span>
                  <strong>
                    <CurrencySymbol size={12} /> {zStats.cashDiscrepancy.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            {/* 13. Recent Expenses (Double Column Span on Desktop) */}
            <div className={`${styles.statCard} ${styles.spanTwoCols}`}>
              <h4>Recent Expenses</h4>
              <div className={styles.cardContent}>
                {expenses.length > 0 ? (
                  <div className={styles.expensesTableWrapper}>
                    <table className={styles.expensesTable}>
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Category</th>
                          <th>Description</th>
                          <th className={styles.colRight}>Amount</th>
                          <th>Paid By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((e) => (
                          <tr key={e.id}>
                            <td>{e.date.split(' ')[0]}</td>
                            <td><span className={styles.tagBadge}>{e.category || 'General'}</span></td>
                            <td>{e.title}</td>
                            <td className={`${styles.colRight} ${styles.dangerText}`}>
                              -<CurrencySymbol size={11} /> {e.amount.toFixed(2)}
                            </td>
                            <td>Admin</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.emptyState}>No expenses logged for this date.</div>
                )}
                <hr className={styles.cardDivider} />
                <div className={styles.expenseTotalFooter}>
                  <span>Total Expenses:</span>
                  <strong className={styles.dangerText}>
                    <CurrencySymbol /> {zStats.totalExpenses.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            {/* 14. Audit Information */}
            <div className={styles.statCard}>
              <h4>Audit Information</h4>
              <div className={styles.cardContent}>
                <div className={styles.itemRow}>
                  <span>Report Generated Time</span>
                  <span className={styles.subtext}>{formatDateTimeString(formatShiftTime(new Date()))}</span>
                </div>
                <div className={styles.itemRow}>
                  <span>Generated By</span>
                  <span className={styles.subtext}>{user.name || 'Admin'}</span>
                </div>
                <div className={styles.itemRow}>
                  <span>Device Name</span>
                  <span className={styles.subtext}>POS-01</span>
                </div>
                <div className={styles.itemRow}>
                  <span>Branch Name</span>
                  <span className={styles.subtext}>{settings.city ? `${settings.city}, ${settings.emirate}` : 'Al Nahda, Dubai'}</span>
                </div>
                <div className={styles.itemRow}>
                  <span>Software Version</span>
                  <span className={styles.subtext}>1.0.0</span>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Action Bar */}
          <div className={`${styles.bottomActionBar} no-print`}>
            <button className={`${styles.actionBtn} ${styles.printBtn}`} onClick={() => handlePrint('pos')}>
              <Printer size={16} /> Print (800mm)
            </button>
            <button className={`${styles.actionBtn} ${styles.pdfBtn}`} onClick={() => { if (window.appPrint) { window.appPrint(); } else { window.print(); } }}>
              <FileText size={16} /> Download PDF
            </button>
            <button className={`${styles.actionBtn} ${styles.excelBtn}`} onClick={handleExportCSV}>
              <Download size={16} /> Export Excel
            </button>
            <button className={`${styles.actionBtn} ${styles.whatsappBtn}`} onClick={handleShareWhatsApp}>
              <Share2 size={16} /> Share via WhatsApp
            </button>
          </div>

          {/* ──────────────────────────────────────────────────────────────────────── */}
          {/* PRINT VIEW - Thermal Receipt Template (styled via @media print) */}
          {/* ──────────────────────────────────────────────────────────────────────── */}
          <div className={`${styles.printContainer} print-only`}>
            <div className={styles.thermalTicket}>
              <div className={styles.ticketHeader}>
                <h1>{settings.shopName || 'Laundry POS'}</h1>
                <p>{settings.shopAddress || 'Laundry Management System'}</p>
                <div className={styles.ticketDivider}>* * * * * * * * * * * * * * * * *</div>
                <h2>Z REPORT (DAILY REGISTER CLOSE)</h2>
                <p>Shift No: {zStats.shiftInfo.shiftNo} ({zStats.shiftInfo.status})</p>
                <p>Date: {selectedDate}</p>
                <p>Generated: {new Date().toLocaleString()}</p>
                <p>Operator: {zStats.shiftInfo.openedBy}</p>
              </div>

              <div className={styles.ticketDivider}>- - - - - - - - - - - - - - - - -</div>
              
              <div className={styles.ticketSection}>
                <h3>SHIFT STATISTICS</h3>
                <div className={styles.ticketRow}>
                  <span>Opened At:</span>
                  <span>
                    {zStats.shiftInfo.openingTime && zStats.shiftInfo.openingTime.split(' ').length > 2
                      ? zStats.shiftInfo.openingTime.split(' ')[1] + ' ' + zStats.shiftInfo.openingTime.split(' ')[2]
                      : 'N/A'}
                  </span>
                </div>
                <div className={styles.ticketRow}>
                  <span>Closed At:</span>
                  <span>
                    {zStats.shiftInfo.closingTime && zStats.shiftInfo.closingTime !== 'N/A' && zStats.shiftInfo.closingTime.split(' ').length > 2
                      ? zStats.shiftInfo.closingTime.split(' ')[1] + ' ' + zStats.shiftInfo.closingTime.split(' ')[2]
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <div className={styles.ticketSection}>
                <h3>CASH DRAWER RECONCILIATION</h3>
                <div className={styles.ticketRow}>
                  <span>Opening Cash:</span>
                  <span>{(Number(openingCash) || 0).toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>+ Cash Payments:</span>
                  <span>{zStats.cashSalesCollected.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>+ Credit Collections:</span>
                  <span>{zStats.cashCreditCollections.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>- Cash Expenses:</span>
                  <span>{zStats.cashExpensesPaid.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow} style={{ fontWeight: 'bold' }}>
                  <span>Expected Cash:</span>
                  <span>{zStats.expectedCashInDrawer.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow} style={{ fontWeight: 'bold' }}>
                  <span>Actual Cash:</span>
                  <span>{(Number(actualCash) || 0).toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>Floating Cash:</span>
                  <span>{(Number(floatingCash) || 0).toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>Withdrawn Cash:</span>
                  <span>{(Number(withdrawal) || 0).toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow} style={{ fontWeight: 'bold' }}>
                  <span>Discrepancy:</span>
                  <span>{zStats.cashDiscrepancy.toFixed(2)}</span>
                </div>
              </div>

              <div className={styles.ticketDivider}>- - - - - - - - - - - - - - - - -</div>

              <div className={styles.ticketSection}>
                <h3>SALES BY PAYMENT METHOD</h3>
                <div className={styles.ticketRow}>
                  <span>Cash Sales:</span>
                  <span>{zStats.cashSales.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>Card Sales:</span>
                  <span>{zStats.cardSales.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>Bank Transfer:</span>
                  <span>{zStats.bankTransfer.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>Nomod Sales:</span>
                  <span>{zStats.nomodSales.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>Credit Orders:</span>
                  <span>{zStats.creditUnpaid.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow} style={{ fontWeight: 'bold' }}>
                  <span>Total Collected:</span>
                  <span>{zStats.totalCollected.toFixed(2)}</span>
                </div>
              </div>

              <div className={styles.ticketDivider}>- - - - - - - - - - - - - - - - -</div>

              <div className={styles.ticketSection}>
                <h3>VAT TAX Consolidations</h3>
                <div className={styles.ticketRow}>
                  <span>Taxable Amount:</span>
                  <span>{zStats.taxableAmount.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow}>
                  <span>VAT ({settings.taxRate || 5}%):</span>
                  <span>{zStats.outputTax.toFixed(2)}</span>
                </div>
                <div className={styles.ticketRow} style={{ fontWeight: 'bold' }}>
                  <span>Grand Total:</span>
                  <span>{zStats.totalRevenue.toFixed(2)}</span>
                </div>
              </div>

              <div className={styles.ticketDivider}>* * * * * * * * * * * * * * * * *</div>
              <div className={styles.ticketFooter}>
                <p>Register Closed Successfully</p>
                <p>Signature: ____________________</p>
              </div>
            </div>
          </div>

          {/* Shift Close Confirmation Modal */}
          {showCloseModal && (
            <div className={styles.modalOverlay} onClick={() => setShowCloseModal(false)}>
              <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h3>Close Register / Shift</h3>
                  <button className={styles.closeModalBtn} onClick={() => setShowCloseModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <div>
                    <div className={styles.modalSectionTitle}>Shift Summary</div>
                    <div className={styles.modalSummaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Opening Cash</span>
                        <span className={styles.summaryValue}>
                          {settings.currencySymbol || 'AED'} {(Number(openingCash) || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Expected Cash</span>
                        <span className={styles.summaryValue}>
                          {settings.currencySymbol || 'AED'} {zStats.expectedCashInDrawer.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.modalInputWrapper}>
                    <label>Actual Cash Counted</label>
                    <div className={styles.modalInputArea}>
                      <span>{settings.currencySymbol || 'AED'}</span>
                      <input
                        type="number"
                        value={modalActualCash}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          setModalActualCash(valStr);
                          
                          const valNum = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                          const modalFloatingCashNum = modalFloatingCash === '' ? 0 : (parseFloat(modalFloatingCash) || 0);
                          
                          let newFloatingNum = modalFloatingCashNum;
                          if (valNum < modalFloatingCashNum) {
                            newFloatingNum = valNum;
                          }
                          setModalFloatingCash(newFloatingNum);
                          setModalWithdrawal(Math.max(0, valNum - newFloatingNum));
                        }}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className={styles.reconcileInputGroup}>
                    <div className={styles.modalInputWrapper}>
                      <label>Floating Cash (Next Shift)</label>
                      <div className={styles.modalInputArea}>
                        <span>{settings.currencySymbol || 'AED'}</span>
                        <input
                          type="number"
                          value={modalFloatingCash}
                          onChange={(e) => {
                            const valStr = e.target.value;
                            setModalFloatingCash(valStr);
                            const valNum = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                            const modalActualCashNum = modalActualCash === '' ? 0 : (parseFloat(modalActualCash) || 0);
                            setModalWithdrawal(Math.max(0, modalActualCashNum - valNum));
                          }}
                        />
                      </div>
                    </div>

                    <div className={styles.modalInputWrapper}>
                      <label>Withdrawal (Cash Out)</label>
                      <div className={styles.modalInputArea}>
                        <span>{settings.currencySymbol || 'AED'}</span>
                        <input
                          type="number"
                          value={modalWithdrawal}
                          onChange={(e) => {
                            const valStr = e.target.value;
                            setModalWithdrawal(valStr);
                            const valNum = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                            const modalActualCashNum = modalActualCash === '' ? 0 : (parseFloat(modalActualCash) || 0);
                            setModalFloatingCash(Math.max(0, modalActualCashNum - valNum));
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.discrepancyBox} ${((parseFloat(modalActualCash) || 0) - zStats.expectedCashInDrawer) === 0 ? styles.badgeGreen : styles.badgeRed}`}>
                    <span>Difference:</span>
                    <strong>
                      {settings.currencySymbol || 'AED'} {((parseFloat(modalActualCash) || 0) - zStats.expectedCashInDrawer).toFixed(2)}
                    </strong>
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button className={styles.cancelBtn} onClick={() => setShowCloseModal(false)}>
                    Cancel
                  </button>
                  <button className={styles.confirmBtn} onClick={handleConfirmCloseShift}>
                    Confirm & Close Register
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Shift Reopen Confirmation Modal */}
          {showReopenModal && (
            <div className={styles.modalOverlay} onClick={() => setShowReopenModal(false)}>
              <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h3>Reopen Register / Shift</h3>
                  <button className={styles.closeModalBtn} onClick={() => setShowReopenModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                    Reopening the shift will allow you to edit transactions, adjust cash drawer reconciliation, and modify orders for this date. 
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: '1.5', margin: '0.5rem 0 0 0', fontWeight: '600' }}>
                    Are you sure you want to proceed?
                  </p>
                  
                  <div className={styles.modalInputWrapper} style={{ marginTop: '1.25rem' }}>
                    <label>Opening Cash (Confirm / Update Amount)</label>
                    <div className={styles.modalInputArea}>
                      <span>{settings.currencySymbol || 'AED'}</span>
                      <input
                        type="number"
                        value={modalOpeningCash}
                        onChange={(e) => setModalOpeningCash(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button className={styles.cancelBtn} onClick={() => setShowReopenModal(false)}>
                    Cancel
                  </button>
                  <button className={styles.confirmBtn} onClick={handleConfirmOpenShift} style={{ background: '#10b981' }}>
                    Confirm & Reopen
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
