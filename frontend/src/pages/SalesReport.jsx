import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, Calendar, Download, Printer, Search, FileText, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Wallet, CreditCard, 
  Smartphone, Landmark, Shirt, Tag, ClipboardList, CheckCircle2, 
  TrendingUp, Percent, ChevronRight, AlertCircle, ShoppingBag
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { useNavigate } from 'react-router-dom';
import CurrencySymbol from '../components/CurrencySymbol';
import Pagination from '../components/Pagination';
import CustomSelect from '../components/CustomSelect';
import { getLocalDateBounds, localStrIsWithinBounds, localTodayStr, parseLocalDateStr } from '../utils/dateFilters';
import styles from './SalesReport.module.css';

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

// Helper to calculate order discount
const calculateOrderDiscount = (order, settingsObj) => {
  let itemsList = [];
  try { itemsList = JSON.parse(order.items || '[]'); } catch (err) {}
  const orderSubtotal = itemsList.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let orderDiscount = 0;
  if (settingsObj.isTaxEnabled) {
    if (settingsObj.taxMethod === 'inclusive') {
      orderDiscount = Math.max(0, orderSubtotal - order.totalAmount);
    } else {
      const rate = (settingsObj.taxRate || 0) / 100;
      orderDiscount = Math.max(0, orderSubtotal - (order.totalAmount / (1 + rate)));
    }
  } else {
    orderDiscount = Math.max(0, orderSubtotal - order.totalAmount);
  }
  return orderDiscount;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export default function SalesReport() {
  const { settings, formatDate } = useSettings();
  const navigate = useNavigate();

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAuthorized = user.role === 'super_admin' || user.role === 'manager';

  useEffect(() => {
    if (!isAuthorized) navigate('/');
  }, [isAuthorized, navigate]);

  if (!isAuthorized) return null;

  // Tabs state
  const [activeTab, setActiveTab] = useState('daily'); // 'daily', 'items', 'payments', 'invoices', 'creditSales', 'paidCredits', 'returns', 'daySummary'

  // Filter states
  const [dateRange, setDateRange] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Day Summary Tab Date selector (specific day)
  const [summaryDate, setSummaryDate] = useState(() => localTodayStr());

  // Database Data States
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [returns, setReturns] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customersMap, setCustomersMap] = useState({});
  const [loading, setLoading] = useState(true);

  // PDF generation state
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfToast, setPdfToast] = useState(null);

  useEffect(() => {
    if (pdfToast) {
      const timer = setTimeout(() => setPdfToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [pdfToast]);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, dateRange, customStart, customEnd, searchTerm]);

  const fetchData = async () => {
    if (!window.electronAPI?.dbQuery) return;
    try {
      setLoading(true);

      // 1. Fetch Customers to construct mapping
      const custRes = await window.electronAPI.dbQuery("SELECT id, name, phone FROM customers", []);
      const cMap = {};
      if (custRes.success) {
        custRes.data.forEach(c => {
          cMap[c.id] = c;
        });
        setCustomersMap(cMap);
      }

      // 2. Fetch Orders
      const ordersRes = await window.electronAPI.dbQuery(
        "SELECT * FROM orders ORDER BY createdAt DESC", []
      );
      if (ordersRes.success) setOrders(ordersRes.data);

      // 3. Fetch Payments
      const paymentsRes = await window.electronAPI.dbQuery(
        "SELECT * FROM payments ORDER BY createdAt DESC", []
      );
      if (paymentsRes.success) setPayments(paymentsRes.data);

      // 4. Fetch Returns from deleted_orders
      const returnsRes = await window.electronAPI.dbQuery(
        "SELECT * FROM deleted_orders WHERE returnStatus IN ('Returned', 'Return Pending') ORDER BY returnedAt DESC", []
      );
      if (returnsRes.success) setReturns(returnsRes.data);

      // 5. Fetch Expenses
      const expensesRes = await window.electronAPI.dbQuery(
        "SELECT * FROM expenses ORDER BY date DESC", []
      );
      if (expensesRes.success) setExpenses(expensesRes.data);

    } catch (err) {
      console.error("Failed to load reports data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format date-time helper
  const formatDateTimeSplit = (dateVal) => {
    if (!dateVal) return { date: 'N/A', time: '' };
    const formattedDate = formatDate(dateVal);
    if (formattedDate === 'N/A' || formattedDate === 'Invalid Date') return { date: formattedDate, time: '' };
    
    let d;
    try {
      d = new Date(dateVal);
    } catch(e) {
      return { date: formattedDate, time: '' };
    }
    if (isNaN(d.getTime())) return { date: formattedDate, time: '' };

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    let ampm = '';
    if (settings.timeFormat === '12h' || !settings.timeFormat) {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
    }
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
    return { date: formattedDate, time: formattedTime };
  };

  // Helper: Filter records by selected date range bounds
  const filterByDateBounds = (records, dateField) => {
    const bounds = getLocalDateBounds(dateRange, customStart, customEnd);
    if (bounds === false) return []; // Incomplete custom range
    if (!bounds) return records; // All time
    
    return records.filter(r => {
      const val = r[dateField];
      return localStrIsWithinBounds(val, bounds);
    });
  };

  // 1. Daily Base Sale Aggregated Data
  const dailyBaseSaleData = useMemo(() => {
    const filtered = filterByDateBounds(orders, 'createdAt');
    const dailyMap = {};
    
    filtered.forEach(o => {
      // Extract date component (robust check for both ISO 'T' and space-separated local strings)
      let datePart = 'N/A';
      if (o.createdAt) {
        if (o.createdAt.includes('T')) {
          datePart = o.createdAt.split('T')[0];
        } else if (o.createdAt.includes(' ')) {
          datePart = o.createdAt.split(' ')[0];
        } else {
          datePart = o.createdAt;
        }
      }
      
      if (!dailyMap[datePart]) {
        dailyMap[datePart] = { date: datePart, count: 0, total: 0, paid: 0, due: 0, discount: 0, tax: 0 };
      }
      dailyMap[datePart].count += 1;
      dailyMap[datePart].total += o.totalAmount || 0;
      dailyMap[datePart].paid += o.paidAmount || 0;
      dailyMap[datePart].due += o.dueAmount || 0;
      dailyMap[datePart].discount += calculateOrderDiscount(o, settings);
      dailyMap[datePart].tax += calculateOrderTax(o, settings);
    });

    return Object.values(dailyMap)
      .filter(d => d.date.includes(searchTerm))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, settings, dateRange, customStart, customEnd, searchTerm]);

  // Daily Base Sale Totals
  const dailyBaseSaleTotals = useMemo(() => {
    let bills = 0;
    let sales = 0;
    let paid = 0;
    let due = 0;
    let discount = 0;
    let tax = 0;

    dailyBaseSaleData.forEach(d => {
      bills += d.count;
      sales += d.total;
      paid += d.paid;
      due += d.due;
      discount += d.discount;
      tax += d.tax;
    });

    return { bills, sales, paid, due, discount, tax };
  }, [dailyBaseSaleData]);

  // 2. Sales Item Aggregated Data
  const salesItemData = useMemo(() => {
    const filtered = filterByDateBounds(orders, 'createdAt');
    const itemsMap = {};

    filtered.forEach(o => {
      try {
        const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
        if (Array.isArray(items)) {
          items.forEach(item => {
            const name = item.name || 'Unknown Item';
            const category = item.category || 'General';
            const qty = Number(item.qty || item.quantity || 0);
            const total = Number(item.total || (Number(item.price || 0) * qty) || 0);

            if (!itemsMap[name]) {
              itemsMap[name] = { name, category, qty: 0, total: 0 };
            }
            itemsMap[name].qty += qty;
            itemsMap[name].total += total;
          });
        }
      } catch (e) {
        // Skip malformed order items
      }
    });

    return Object.values(itemsMap)
      .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.total - a.total);
  }, [orders, dateRange, customStart, customEnd, searchTerm]);

  // 3. Payments Data
  const paymentsData = useMemo(() => {
    const filtered = filterByDateBounds(payments, 'createdAt');
    const dailyPaymentsMap = {};
    
    filtered.forEach(p => {
      let datePart = 'N/A';
      if (p.createdAt) {
        if (p.createdAt.includes('T')) {
          datePart = p.createdAt.split('T')[0];
        } else if (p.createdAt.includes(' ')) {
          datePart = p.createdAt.split(' ')[0];
        } else {
          datePart = p.createdAt;
        }
      }

      if (!dailyPaymentsMap[datePart]) {
        dailyPaymentsMap[datePart] = { date: datePart, cash: 0, card: 0, upi: 0, bank: 0, total: 0, tax: 0 };
      }

      const method = p.method?.toUpperCase();
      const amount = Number(p.amount || 0);
      dailyPaymentsMap[datePart].total += amount;

      if (method === 'CASH') {
        dailyPaymentsMap[datePart].cash += amount;
      } else if (method === 'CARD') {
        dailyPaymentsMap[datePart].card += amount;
      } else if (method === 'UPI') {
        dailyPaymentsMap[datePart].upi += amount;
      } else {
        dailyPaymentsMap[datePart].bank += amount;
      }

      // Find order to calculate VAT ratio
      let taxAmount = 0;
      if (p.orderId) {
        const order = orders.find(o => o.id === p.orderId);
        if (order && order.totalAmount > 0) {
          const orderTax = calculateOrderTax(order, settings);
          const ratio = orderTax / order.totalAmount;
          taxAmount = amount * ratio;
        }
      }
      dailyPaymentsMap[datePart].tax += taxAmount;
    });

    return Object.values(dailyPaymentsMap)
      .filter(d => d.date.includes(searchTerm))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [payments, orders, settings, dateRange, customStart, customEnd, searchTerm]);

  // Payments Totals
  const paymentsTotals = useMemo(() => {
    let cash = 0;
    let card = 0;
    let upi = 0;
    let bank = 0;
    let total = 0;
    let tax = 0;

    paymentsData.forEach(d => {
      cash += d.cash;
      card += d.card;
      upi += d.upi;
      bank += d.bank;
      total += d.total;
      tax += d.tax;
    });

    return { cash, card, upi, bank, total, tax };
  }, [paymentsData]);

  // 4. Invoices Data (Grouped Daily)
  const invoicesData = useMemo(() => {
    const filtered = filterByDateBounds(orders, 'createdAt');
    const dailyInvoiceMap = {};

    filtered.forEach(o => {
      let datePart = 'N/A';
      if (o.createdAt) {
        if (o.createdAt.includes('T')) {
          datePart = o.createdAt.split('T')[0];
        } else if (o.createdAt.includes(' ')) {
          datePart = o.createdAt.split(' ')[0];
        } else {
          datePart = o.createdAt;
        }
      }

      if (!dailyInvoiceMap[datePart]) {
        dailyInvoiceMap[datePart] = { date: datePart, count: 0, subtotal: 0, discount: 0, tax: 0, total: 0 };
      }

      const vat = calculateOrderTax(o, settings);
      const subtotal = o.totalAmount - vat;
      const discount = calculateOrderDiscount(o, settings);

      dailyInvoiceMap[datePart].count += 1;
      dailyInvoiceMap[datePart].subtotal += subtotal;
      dailyInvoiceMap[datePart].discount += discount;
      dailyInvoiceMap[datePart].tax += vat;
      dailyInvoiceMap[datePart].total += (o.totalAmount || 0);
    });

    return Object.values(dailyInvoiceMap)
      .filter(d => d.date.includes(searchTerm))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, settings, dateRange, customStart, customEnd, searchTerm]);

  // 5. Credit Sales Data (Grouped Daily)
  const creditSalesData = useMemo(() => {
    const filtered = filterByDateBounds(orders, 'createdAt').filter(o => o.dueAmount > 0);
    const dailyCreditMap = {};

    filtered.forEach(o => {
      let datePart = 'N/A';
      if (o.createdAt) {
        if (o.createdAt.includes('T')) {
          datePart = o.createdAt.split('T')[0];
        } else if (o.createdAt.includes(' ')) {
          datePart = o.createdAt.split(' ')[0];
        } else {
          datePart = o.createdAt;
        }
      }

      if (!dailyCreditMap[datePart]) {
        dailyCreditMap[datePart] = { date: datePart, count: 0, totalAmount: 0, dueAmount: 0 };
      }

      dailyCreditMap[datePart].count += 1;
      dailyCreditMap[datePart].totalAmount += (o.totalAmount || 0);
      dailyCreditMap[datePart].dueAmount += (o.dueAmount || 0);
    });

    return Object.values(dailyCreditMap)
      .filter(d => d.date.includes(searchTerm))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, dateRange, customStart, customEnd, searchTerm]);

  // 6. Paid Credits Data (Grouped Daily)
  const paidCreditsData = useMemo(() => {
    // Settlements are payments with paymentReference starting with 'SET' or where orderId is null/empty but customer matches
    const filtered = filterByDateBounds(payments, 'createdAt').filter(
      p => p.paymentReference?.toUpperCase().startsWith('SET') || !p.orderId
    );
    const dailyPaidCreditsMap = {};

    filtered.forEach(p => {
      let datePart = 'N/A';
      if (p.createdAt) {
        if (p.createdAt.includes('T')) {
          datePart = p.createdAt.split('T')[0];
        } else if (p.createdAt.includes(' ')) {
          datePart = p.createdAt.split(' ')[0];
        } else {
          datePart = p.createdAt;
        }
      }

      if (!dailyPaidCreditsMap[datePart]) {
        dailyPaidCreditsMap[datePart] = { date: datePart, count: 0, total: 0 };
      }

      dailyPaidCreditsMap[datePart].count += 1;
      dailyPaidCreditsMap[datePart].total += Number(p.amount || 0);
    });

    return Object.values(dailyPaidCreditsMap)
      .filter(d => d.date.includes(searchTerm))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [payments, dateRange, customStart, customEnd, searchTerm]);

  // 7. Returns Data
  const returnsData = useMemo(() => {
    const filtered = filterByDateBounds(returns, 'returnedAt');
    return filtered.filter(r => {
      const custName = r.customerName || 'Walk-in Customer';
      return (
        r.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        custName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [returns, dateRange, customStart, customEnd, searchTerm]);

  // 8. Summary Data (Dynamic based on selected date range)
  const daySummaryData = useMemo(() => {
    const dayOrders = filterByDateBounds(orders, 'createdAt');
    const dayPayments = filterByDateBounds(payments, 'createdAt');
    const dayReturns = filterByDateBounds(returns, 'returnedAt');
    const dayExpenses = filterByDateBounds(expenses, 'date');

    // Summary calculations
    const totalInvoices = dayOrders.length;
    const totalSalesAmount = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalPaidAmount = dayOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
    const totalDueAmount = dayOrders.reduce((sum, o) => sum + (o.dueAmount || 0), 0);

    // Payments collections breakdown
    let cashCollected = 0;
    let cardCollected = 0;
    let bankCollected = 0;
    let upiCollected = 0;
    dayPayments.forEach(p => {
      const method = p.method?.toUpperCase();
      if (method === 'CASH') cashCollected += p.amount;
      else if (method === 'CARD') cardCollected += p.amount;
      else if (method === 'UPI') upiCollected += p.amount;
      else bankCollected += p.amount; // Bank or bank transfer
    });
    const totalCollections = cashCollected + cardCollected + bankCollected + upiCollected;

    // Expenses total
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Credit Issued
    const creditSalesTotal = dayOrders.reduce((sum, o) => sum + (o.paymentStatus === 'Credit' || o.dueAmount > 0 ? o.dueAmount : 0), 0);

    // Credit Settlements Collected
    const creditSettlementsTotal = dayPayments
      .filter(p => p.paymentReference?.toUpperCase().startsWith('SET') || !p.orderId)
      .reduce((sum, p) => sum + p.amount, 0);

    // Returned amount
    const returnsTotalValue = dayReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    return {
      totalInvoices,
      totalSalesAmount,
      totalPaidAmount,
      totalDueAmount,
      cashCollected,
      cardCollected,
      bankCollected,
      upiCollected,
      totalCollections,
      totalExpenses,
      creditSalesTotal,
      creditSettlementsTotal,
      returnsTotalValue,
      netCashFlow: totalCollections - totalExpenses
    };
  }, [orders, payments, returns, expenses, dateRange, customStart, customEnd]);

  // Select appropriate data list depending on active tab
  const getTabItems = () => {
    switch (activeTab) {
      case 'daily': return dailyBaseSaleData;
      case 'items': return salesItemData;
      case 'payments': return paymentsData;
      case 'invoices': return invoicesData;
      case 'creditSales': return creditSalesData;
      case 'paidCredits': return paidCreditsData;
      case 'returns': return returnsData;
      default: return [];
    }
  };

  const currentTabItems = getTabItems();
  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(currentTabItems.length / PAGE_SIZE);

  const paginatedItems = useMemo(() => {
    if (activeTab === 'daySummary') return [];
    return currentTabItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [currentTabItems, currentPage, activeTab]);

  // EXPORT CSV
  const handleExportCSV = () => {
    let headers = [];
    let rows = [];
    const filename = `sales_${activeTab}_report_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeTab === 'daily') {
      headers = ['Date', 'Invoice Count', 'Sub Total', 'Discount', 'VAT', 'Total Sales', 'Total Paid', 'Total Due'];
      rows = dailyBaseSaleData.map(d => [
        d.date,
        d.count,
        (d.total - d.tax).toFixed(2),
        d.discount.toFixed(2),
        d.tax.toFixed(2),
        d.total.toFixed(2),
        d.paid.toFixed(2),
        d.due.toFixed(2)
      ]);
    } else if (activeTab === 'items') {
      headers = ['Item Name', 'Category', 'Quantity Sold', 'Revenue'];
      rows = salesItemData.map(i => [i.name, i.category, i.qty, i.total.toFixed(2)]);
    } else if (activeTab === 'payments') {
      headers = ['Date', 'Cash Collected', 'Card Collected', 'UPI Collected', 'Bank Collected', 'VAT', 'Total Collected'];
      rows = paymentsData.map(p => [
        p.date,
        p.cash.toFixed(2),
        p.card.toFixed(2),
        p.upi.toFixed(2),
        p.bank.toFixed(2),
        p.tax.toFixed(2),
        p.total.toFixed(2)
      ]);
    } else if (activeTab === 'invoices') {
      headers = ['Date', 'Invoice Count', 'Sub Total', 'Discount', 'VAT', 'Total Amount'];
      rows = invoicesData.map(i => [
        i.date,
        i.count,
        i.subtotal.toFixed(2),
        i.discount.toFixed(2),
        i.tax.toFixed(2),
        i.total.toFixed(2)
      ]);
    } else if (activeTab === 'creditSales') {
      headers = ['Date', 'Bill Count', 'Total Amount', 'Due Amount'];
      rows = creditSalesData.map(c => [
        c.date,
        c.count,
        c.totalAmount.toFixed(2),
        c.dueAmount.toFixed(2)
      ]);
    } else if (activeTab === 'paidCredits') {
      headers = ['Date', 'Settlements Count', 'Total Settled'];
      rows = paidCreditsData.map(p => [
        p.date,
        p.count,
        p.total.toFixed(2)
      ]);
    } else if (activeTab === 'returns') {
      headers = ['Order Date', 'Date Returned', 'Bill Number', 'Customer', 'Refund Method', 'Refunded Total'];
      rows = returnsData.map(r => [
        r.createdAt,
        r.returnedAt || r.deletedAt,
        r.billNumber,
        r.customerName || 'Walk-in',
        r.refundMethod || 'N/A',
        r.totalAmount.toFixed(2)
      ]);
    } else if (activeTab === 'daySummary' && daySummaryData) {
      headers = ['Metric', 'Amount'];
      rows = [
        ['Total Invoices Generated', daySummaryData.totalInvoices],
        ['Total Sales Volume', daySummaryData.totalSalesAmount.toFixed(2)],
        ['Total Collected', daySummaryData.totalCollections.toFixed(2)],
        ['- Cash Collected', daySummaryData.cashCollected.toFixed(2)],
        ['- Card Collected', daySummaryData.cardCollected.toFixed(2)],
        ['- UPI Collected', daySummaryData.upiCollected.toFixed(2)],
        ['- Bank Collected', daySummaryData.bankCollected.toFixed(2)],
        ['Total Expenses', daySummaryData.totalExpenses.toFixed(2)],
        ['Credit Issued', daySummaryData.creditSalesTotal.toFixed(2)],
        ['Credit Settlements Collected', daySummaryData.creditSettlementsTotal.toFixed(2)],
        ['Returns Volume', daySummaryData.returnsTotalValue.toFixed(2)],
        ['Net Cash Flow', daySummaryData.netCashFlow.toFixed(2)]
      ];
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PRINT
  const handlePrint = () => {
    if (window.appPrint) {
      window.appPrint();
    } else {
      window.print();
    }
  };

  // PDF DOWNLOAD
  const handleDownloadPDF = async () => {
    const activeTabLabel = [
      { id: 'daily', label: 'Daily Base Sale' },
      { id: 'items', label: 'Sales Item' },
      { id: 'payments', label: 'Payment' },
      { id: 'invoices', label: 'Invoice' },
      { id: 'creditSales', label: 'Credit Sales' },
      { id: 'paidCredits', label: 'Paid Credits' },
      { id: 'returns', label: 'Return' },
      { id: 'daySummary', label: 'Summary' },
    ].find(t => t.id === activeTab)?.label || 'Report';

    const filename = `Sales_Report_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`;
    if (!window.electronAPI?.printToPDF) {
      handlePrint();
      return;
    }

    setPdfLoading(true);
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

      const reportContainer = document.querySelector(`.${styles.reportsPage}`);
      if (!reportContainer) throw new Error("Report content not found");

      const clone = reportContainer.cloneNode(true);
      
      // Add a clean heading for the PDF copy
      const printHeader = document.createElement('h1');
      printHeader.innerText = `${activeTabLabel} Report`;
      printHeader.style.marginBottom = '1.5rem';
      printHeader.style.fontSize = '1.8rem';
      printHeader.style.fontWeight = '800';
      printHeader.style.color = '#0F172A';
      clone.insertBefore(printHeader, clone.firstChild);

      // Hide tabs and header actions in the printed copy
      const tabs = clone.querySelector(`.${styles.tabsContainer}`);
      if (tabs) tabs.style.display = 'none';
      const actions = clone.querySelector(`.${styles.headerActions}`);
      if (actions) actions.style.display = 'none';

      // Hide filter bar in the printed copy
      const filterBar = clone.querySelector('#report-filter-bar');
      if (filterBar) filterBar.style.display = 'none';

      // Hide pagination in the printed copy
      const pagination = clone.querySelector('#report-pagination-container');
      if (pagination) pagination.style.display = 'none';

      const html = clone.outerHTML;

      const result = await window.electronAPI.printToPDF({
        filename,
        html,
        css,
        pdfDownloadPath: settings.pdfDownloadPath || '',
        origin: window.location.origin,
        pageSize: 'A4'
      });

      if (result && result.success) {
        setPdfToast({ success: true, message: `Saved to Downloads: ${filename}` });
      } else {
        setPdfToast({ success: false, message: result?.error || 'PDF saving failed' });
      }
    } catch (err) {
      console.error('PDF failed:', err);
      setPdfToast({ success: false, message: err.message });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className={styles.reportsPage}>
      {pdfToast && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: pdfToast.success ? '#10B981' : '#EF4444',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999
        }}>
          {pdfToast.message}
        </div>
      )}

      <div className={styles.headerRow}>
        <div className={styles.headerActions} style={{ marginLeft: 'auto' }} data-noprint="true">
          <button 
            className="btn btn-secondary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#1E293B', fontWeight: '600' }} 
            onClick={handleExportCSV}
          >
            <Download size={18} /> Export CSV
          </button>
          <button 
            className="btn btn-primary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2563EB', border: '1px solid #2563EB', borderRadius: '8px', color: '#FFFFFF', fontWeight: '600' }} 
            onClick={handlePrint}
          >
            <Printer size={18} /> Print Report
          </button>
          <button 
            className="btn btn-primary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#10B981', border: '1px solid #10B981', borderRadius: '8px', color: '#FFFFFF', fontWeight: '600' }} 
            onClick={handleDownloadPDF} 
            disabled={pdfLoading}
          >
            <Download size={18} /> {pdfLoading ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className={styles.tabsContainer}>
        {[
          { id: 'daily', label: 'Daily Base Sale' },
          { id: 'items', label: 'Sales Item' },
          { id: 'payments', label: 'Payment' },
          { id: 'invoices', label: 'Invoice' },
          { id: 'creditSales', label: 'Credit Sales' },
          { id: 'paidCredits', label: 'Paid Credits' },
          { id: 'returns', label: 'Return' },
          { id: 'daySummary', label: 'Summary' },
        ].map(t => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${activeTab === t.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* FILTER BAR (Unconditionally render date and search filters) */}
      <div id="report-filter-bar" className={styles.tableCard} style={{ padding: '0.75rem 1rem' }}>
        <div className={styles.tableToolbar} style={{ marginBottom: 0 }}>
          <div className={styles.searchBox}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input 
              type="text" 
              placeholder="Search report..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', outline: 'none' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <CustomSelect
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              options={[
                { value: 'All', label: 'All Time' },
                { value: 'Today', label: 'Today' },
                { value: 'This Week', label: 'This Week' },
                { value: 'This Month', label: 'This Month' },
                { value: 'Custom', label: 'Custom Date Range' }
              ]}
              style={{ width: '180px' }}
            />

            {dateRange === 'Custom' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{ padding: '0.4rem 0.5rem', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 700 }}>to</span>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{ padding: '0.4rem 0.5rem', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RENDER ACTIVE TAB VIEW */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className={styles.tableCard}
        >
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>
              <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem auto' }} />
              <p style={{ fontWeight: 600 }}>Loading analytics database...</p>
            </div>
          ) : (
            <>
              {/* 1. DAILY BASE SALE */}
              {activeTab === 'daily' && (
                <div className="table-container">
                  <table className="base-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th className="num-col">BILLS</th>
                        <th className="num-col">SUB TOTAL</th>
                        <th className="num-col">DISCOUNT</th>
                        <th className="num-col">VAT</th>
                        <th className="num-col">TOTAL</th>
                        <th className="num-col">PAID AMOUNT</th>
                        <th className="num-col">DUE AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((d, i) => {
                        const subtotal = d.total - d.tax;
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 700 }}>{formatDate(d.date)}</td>
                            <td className="num-col" style={{ fontWeight: 600 }}>{d.count}</td>
                            <td className="num-col" style={{ fontWeight: 700 }}>
                              {subtotal.toFixed(2)}
                            </td>
                            <td className="num-col" style={{ fontWeight: 700, color: d.discount > 0 ? '#D97706' : '#64748B' }}>
                              {d.discount.toFixed(2)}
                            </td>
                            <td className="num-col" style={{ fontWeight: 700, color: '#2563EB' }}>
                              {d.tax.toFixed(2)}
                            </td>
                            <td className="num-col" style={{ fontWeight: 800 }}>
                              {d.total.toFixed(2)}
                            </td>
                            <td className="num-col" style={{ fontWeight: 700, color: '#166534' }}>
                              {d.paid.toFixed(2)}
                            </td>
                            <td className="num-col" style={{ fontWeight: 700, color: d.due > 0 ? '#991B1B' : '#64748B' }}>
                              {d.due.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedItems.length === 0 && (
                        <tr>
                          <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                            No sales records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {paginatedItems.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: 800 }}>
                          <td style={{ fontWeight: 800 }}>TOTAL</td>
                          <td className="num-col" style={{ fontWeight: 800 }}>{dailyBaseSaleTotals.bills}</td>
                          <td className="num-col" style={{ fontWeight: 800 }}>{(dailyBaseSaleTotals.sales - dailyBaseSaleTotals.tax).toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#D97706' }}>{dailyBaseSaleTotals.discount.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#2563EB' }}>{dailyBaseSaleTotals.tax.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 900 }}>{dailyBaseSaleTotals.sales.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#166534' }}>{dailyBaseSaleTotals.paid.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 800, color: dailyBaseSaleTotals.due > 0 ? '#991B1B' : '#64748B' }}>{dailyBaseSaleTotals.due.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* 2. SALES ITEM */}
              {activeTab === 'items' && (
                <div className="table-container">
                  <table className="base-table">
                    <thead>
                      <tr>
                        <th>ITEM NAME</th>
                        <th>CATEGORY</th>
                        <th className="num-col">QUANTITY SOLD</th>
                        <th className="num-col">TOTAL REVENUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{item.name}</td>
                          <td>
                            <span style={{ padding: '0.25rem 0.6rem', background: '#F1F5F9', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                              {item.category}
                            </span>
                          </td>
                          <td className="num-col" style={{ fontWeight: 700 }}>{item.qty}</td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#2563EB' }}>
                            {item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {paginatedItems.length === 0 && (
                        <tr>
                          <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                            No item breakdown data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {paginatedItems.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: 800 }}>
                          <td colSpan="2" style={{ fontWeight: 800 }}>TOTAL</td>
                          <td className="num-col" style={{ fontWeight: 800 }}>
                            {salesItemData.reduce((sum, item) => sum + item.qty, 0)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 900, color: '#2563EB' }}>
                            {salesItemData.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* 3. PAYMENT */}
              {activeTab === 'payments' && (
                <div className="table-container">
                  <table className="base-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th className="num-col">CASH</th>
                        <th className="num-col">CARD</th>
                        <th className="num-col">UPI</th>
                        <th className="num-col">BANK</th>
                        <th className="num-col">VAT</th>
                        <th className="num-col">TOTAL COLLECTED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((p, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{formatDate(p.date)}</td>
                          <td className="num-col" style={{ fontWeight: 600, color: '#3B82F6' }}>
                            {p.cash.toFixed(2)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 600, color: '#8B5CF6' }}>
                            {p.card.toFixed(2)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 600, color: '#F59E0B' }}>
                            {p.upi.toFixed(2)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 600, color: '#10B981' }}>
                            {p.bank.toFixed(2)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 600, color: '#2563EB' }}>
                            {p.tax.toFixed(2)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#166534' }}>
                            {p.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {paginatedItems.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                            No payment records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {paginatedItems.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: 800 }}>
                          <td style={{ fontWeight: 800 }}>TOTAL</td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#3B82F6' }}>{paymentsTotals.cash.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#8B5CF6' }}>{paymentsTotals.card.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#F59E0B' }}>{paymentsTotals.upi.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#10B981' }}>{paymentsTotals.bank.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#2563EB' }}>{paymentsTotals.tax.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 900, color: '#166534' }}>{paymentsTotals.total.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* 4. INVOICES */}
              {activeTab === 'invoices' && (
                <div className="table-container">
                  <table className="base-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th className="num-col">BILLS</th>
                        <th className="num-col">SUB TOTAL</th>
                        <th className="num-col">DISCOUNT</th>
                        <th className="num-col">VAT</th>
                        <th className="num-col">TOTAL AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((o, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{formatDate(o.date)}</td>
                          <td className="num-col" style={{ fontWeight: 600 }}>{o.count}</td>
                          <td className="num-col" style={{ fontWeight: 700 }}>{o.subtotal.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 700, color: o.discount > 0 ? '#D97706' : '#64748B' }}>{o.discount.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 700, color: '#2563EB' }}>{o.tax.toFixed(2)}</td>
                          <td className="num-col" style={{ fontWeight: 800 }}>{o.total.toFixed(2)}</td>
                        </tr>
                      ))}
                      {paginatedItems.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                            No invoice records.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {paginatedItems.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: 800 }}>
                          <td style={{ fontWeight: 800 }}>TOTAL</td>
                          <td className="num-col" style={{ fontWeight: 800 }}>
                            {invoicesData.reduce((sum, o) => sum + (o.count || 0), 0)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 800 }}>
                            {invoicesData.reduce((sum, o) => sum + (o.subtotal || 0), 0).toFixed(2)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#D97706' }}>
                            {invoicesData.reduce((sum, o) => sum + (o.discount || 0), 0).toFixed(2)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 800, color: '#2563EB' }}>
                            {invoicesData.reduce((sum, o) => sum + (o.tax || 0), 0).toFixed(2)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 900 }}>
                            {invoicesData.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* 5. CREDIT SALES */}
              {activeTab === 'creditSales' && (
                <div className="table-container">
                  <table className="base-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th className="num-col">BILLS</th>
                        <th className="num-col">TOTAL AMOUNT</th>
                        <th className="num-col">OUTSTANDING DUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((c, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{formatDate(c.date)}</td>
                          <td className="num-col" style={{ fontWeight: 600 }}>{c.count}</td>
                          <td className="num-col" style={{ fontWeight: 700 }}>{c.totalAmount.toFixed(2)}</td>
                          <td className="num-col" style={{ color: '#B91C1C', fontWeight: 800 }}>{c.dueAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                      {paginatedItems.length === 0 && (
                        <tr>
                          <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                            No credit sales active.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {paginatedItems.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: 800 }}>
                          <td style={{ fontWeight: 800 }}>TOTAL</td>
                          <td className="num-col" style={{ fontWeight: 800 }}>
                            {creditSalesData.reduce((sum, c) => sum + (c.count || 0), 0)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 800 }}>
                            {creditSalesData.reduce((sum, c) => sum + (c.totalAmount || 0), 0).toFixed(2)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 900, color: '#B91C1C' }}>
                            {creditSalesData.reduce((sum, c) => sum + (c.dueAmount || 0), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* 6. PAID CREDITS */}
              {activeTab === 'paidCredits' && (
                <div className="table-container">
                  <table className="base-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th className="num-col">SETTLEMENTS</th>
                        <th className="num-col">TOTAL SETTLED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((p, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{formatDate(p.date)}</td>
                          <td className="num-col" style={{ fontWeight: 600 }}>{p.count}</td>
                          <td className="num-col" style={{ color: '#166534', fontWeight: 800 }}>
                            {p.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {paginatedItems.length === 0 && (
                        <tr>
                          <td colSpan="3" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                            No credit payments settled yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {paginatedItems.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: 800 }}>
                          <td style={{ fontWeight: 800 }}>TOTAL</td>
                          <td className="num-col" style={{ fontWeight: 800 }}>
                            {paidCreditsData.reduce((sum, p) => sum + (p.count || 0), 0)}
                          </td>
                          <td className="num-col" style={{ fontWeight: 900, color: '#166534' }}>
                            {paidCreditsData.reduce((sum, p) => sum + (p.total || 0), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* 7. RETURNS */}
              {activeTab === 'returns' && (
                <div className="table-container">
                  <table className="base-table">
                    <thead>
                      <tr>
                        <th>ORDER DATE</th>
                        <th>DATE RETURNED</th>
                        <th>BILL NO</th>
                        <th>CUSTOMER</th>
                        <th>REFUND METHOD</th>
                        <th className="num-col">REFUNDED TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((r, i) => (
                        <tr key={i}>
                          <td>{formatDate(r.createdAt)}</td>
                          <td>{formatDate(r.returnedAt || r.deletedAt)}</td>
                          <td style={{ fontWeight: 700 }}>{r.billNumber}</td>
                          <td>{r.customerName || 'Walk-in'}</td>
                          <td style={{ fontWeight: 700 }}>{r.refundMethod || 'N/A'}</td>
                          <td className="num-col" style={{ color: '#B91C1C', fontWeight: 800 }}>
                            {r.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {paginatedItems.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                            No return records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {paginatedItems.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: 800 }}>
                          <td colSpan="5" style={{ fontWeight: 800 }}>TOTAL</td>
                          <td className="num-col" style={{ fontWeight: 900, color: '#B91C1C' }}>
                            {returnsData.reduce((sum, r) => sum + (r.totalAmount || 0), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* 8. SUMMARY */}
              {activeTab === 'daySummary' && daySummaryData && (
                <div className={styles.daySummaryContainer}>
                  <div className={styles.daySummaryGrid}>
                    <div className={styles.summarySection}>
                      <div className={styles.sectionHeader}>
                        <TrendingUp size={18} color="#2563EB" />
                        <h2>Sales & Collection Breakdown</h2>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Total Invoices Generated</span>
                        <span>{daySummaryData.totalInvoices}</span>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Total Sales Volume</span>
                        <span>{daySummaryData.totalSalesAmount.toFixed(2)}</span>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Direct Amount Paid</span>
                        <span>{daySummaryData.totalPaidAmount.toFixed(2)}</span>
                      </div>
                      <div className={styles.rowItem} style={{ borderBottom: 'none' }}>
                        <span>New Due (Credit Sales)</span>
                        <span style={{ color: '#B91C1C' }}>{daySummaryData.totalDueAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className={styles.summarySection}>
                      <div className={styles.sectionHeader}>
                        <Wallet size={18} color="#10B981" />
                        <h2>Collections By Method</h2>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Cash Collected</span>
                        <span>{daySummaryData.cashCollected.toFixed(2)}</span>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Card Collected</span>
                        <span>{daySummaryData.cardCollected.toFixed(2)}</span>
                      </div>
                      <div className={styles.rowItem}>
                        <span>UPI Collected</span>
                        <span>{daySummaryData.upiCollected.toFixed(2)}</span>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Bank Transfer Collected</span>
                        <span>{daySummaryData.bankCollected.toFixed(2)}</span>
                      </div>
                      <div className={styles.totalRow}>
                        <span>Total Collected</span>
                        <span>{daySummaryData.totalCollections.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.daySummaryGrid}>
                    <div className={styles.summarySection}>
                      <div className={styles.sectionHeader}>
                        <AlertCircle size={18} color="#D97706" />
                        <h2>Financial Auditing</h2>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Outstanding Credit Issued</span>
                        <span style={{ color: '#B91C1C' }}>{daySummaryData.creditSalesTotal.toFixed(2)}</span>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Credit Settle Payments Received</span>
                        <span style={{ color: '#166534' }}>{daySummaryData.creditSettlementsTotal.toFixed(2)}</span>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Returns & Refund Volume</span>
                        <span style={{ color: '#B91C1C' }}>{daySummaryData.returnsTotalValue.toFixed(2)}</span>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Total Operating Expenses</span>
                        <span style={{ color: '#B91C1C' }}>{daySummaryData.totalExpenses.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className={styles.summarySection}>
                      <div className={styles.sectionHeader}>
                        <DollarSign size={18} color="#4F46E5" />
                        <h2>Operating Cash Flow Summary</h2>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Total Cash Collections</span>
                        <span>+{daySummaryData.totalCollections.toFixed(2)}</span>
                      </div>
                      <div className={styles.rowItem}>
                        <span>Operating Expenses</span>
                        <span>-{daySummaryData.totalExpenses.toFixed(2)}</span>
                      </div>
                      <div className={`${styles.netBox} ${daySummaryData.netCashFlow < 0 ? styles.negative : ''}`}>
                        <span style={{ fontWeight: 800 }}>NET CASH FLOW</span>
                        <span style={{ fontWeight: 900 }}>
                          {daySummaryData.netCashFlow.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGINATION (Only for non Day Summary tab) */}
              {activeTab !== 'daySummary' && totalPages > 1 && (
                <div id="report-pagination-container">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={currentTabItems.length}
                    pageSize={PAGE_SIZE}
                    itemLabel="records"
                  />
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
