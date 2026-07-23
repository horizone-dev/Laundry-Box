import React, { useState, useEffect } from 'react';
import {
  Search, Filter, ChevronLeft, ChevronRight, Calendar,
  Clock, Package, CheckCircle, AlertCircle, ChevronDown,
  X, Printer, CreditCard, Wallet, User, History, QrCode, Phone, DollarSign, Truck, Trash2, AlertTriangle, Info, Lock, Edit3, Layers,
  RefreshCw, Send, MoreVertical, ExternalLink, Download
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import WhatsAppIcon from '../components/WhatsAppIcon';
import Pagination from '../components/Pagination';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID, API_BASE_URL } from '../constants';
import { t } from '../utils/translations';
import { getLocalDateBounds, isWithinBounds } from '../utils/dateFilters';
import { getLocalISOString, getLocalDateTime } from '../utils/dateUtils';
import CurrencySymbol from '../components/CurrencySymbol';
import DressTag from '../components/DressTag';
import CustomSelect from '../components/CustomSelect';
import styles from './Orders.module.css';
import { checkCreditLimit } from '../utils/creditLimit';
import { paymentService } from '../services/paymentService';

const API_BASE = API_BASE_URL;

const STATUS_COLORS = {
  'Payment Pending': styles.statusPending,
  'Paid': styles.statusDelivered,
  'Credit': styles.statusCancelled,
  'Confirmed': styles.statusProcessing,
  'Picked Up': styles.statusProcessing,
  'Washing': styles.statusProcessing,
  'Drying': styles.statusProcessing,
  'Ironing': styles.statusIroning,
  'Ready': styles.statusDelivery,
  'Ready to Pick up': styles.statusDelivery,
  'Out for Delivery': styles.statusDelivery,
  'Delivered': styles.statusDelivered
};

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const querySearch = searchParams.get('search') || '';
  const { settings, formatDate } = useSettings();

  const formatDateTime = (dateVal) => {
    if (!dateVal) return 'N/A';
    const formattedDate = formatDate(dateVal);
    if (formattedDate === 'N/A' || formattedDate === 'Invalid Date') return formattedDate;

    let d;
    try {
      d = new Date(dateVal);
    } catch (e) {
      return formattedDate;
    }
    if (isNaN(d.getTime())) return formattedDate;

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    let ampm = '';
    if (settings.timeFormat === '12h') {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
    }
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
    return `${formattedDate} ${formattedTime}`;
  };

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(querySearch);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [orderPayments, setOrderPayments] = useState([]);

  useEffect(() => {
    if (selectedOrder && window.electronAPI?.dbQuery) {
      window.electronAPI.dbQuery(
        "SELECT * FROM payments WHERE orderId = ? ORDER BY createdAt DESC",
        [selectedOrder.id]
      ).then(res => {
        if (res.success) {
          setOrderPayments(res.data || []);
        }
      }).catch(err => {
        console.error("Failed to load order payments:", err);
      });
    } else {
      setOrderPayments([]);
    }
  }, [selectedOrder]);

  // Filtering logic
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState('Cash');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');

  const cashVal = parseFloat(cashAmount) || 0;
  const cardVal = parseFloat(cardAmount) || 0;
  const upiVal = parseFloat(upiAmount) || 0;
  const bankVal = parseFloat(bankAmount) || 0;
  const discVal = parseFloat(discountAmount) || 0;

  useEffect(() => {
    if (!showPayModal) {
      setCashAmount('');
      setCardAmount('');
      setUpiAmount('');
      setBankAmount('');
      setDiscountAmount('');
      setPayMethod('Cash');
    }
  }, [showPayModal]);

  useEffect(() => {
    const unsubscribe = paymentService.subscribe(({ orderId, status }) => {
      fetchOrders();
      if (status === 'Paid') {
        alert(`Payment successful for Order: ${orderId}`);
      }
    });
    return () => unsubscribe();
  }, []);

  const [nomodLinkModal, setNomodLinkModal] = useState({ show: false, url: '', linkId: '', amount: 0 });
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [sortBy, setSortBy] = useState('date'); // 'date', 'payment'

  const getDaysPending = (dateStr) => {
    if (!dateStr) return 0;
    const created = new Date(dateStr);
    const diffTime = Math.abs(new Date() - created);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleResendPaymentLink = async (order) => {
    if (!window.electronAPI) return;
    try {
      const userStr = sessionStorage.getItem('user') || '{}';
      const currentUser = JSON.parse(userStr);

      if (order.nomodCheckoutId) {
        await window.electronAPI.dbQuery(
          "UPDATE payment_links SET status = 'Expired' WHERE checkoutId = ?",
          [order.nomodCheckoutId]
        );
        paymentService.stopTracking(order.id);
      }

      const linkId = `LNK-${order.billNumber || Date.now().toString().slice(-4)}-${Date.now().toString().slice(-3)}`;
      const due = order.dueAmount ?? (order.totalAmount - (order.paidAmount || 0));

      const checkoutRes = await window.electronAPI.createNomodCheckout({
        amount: due,
        currency: settings.nomodCurrency || 'AED',
        customer: { name: order.customerName, phone: order.customerPhone },
        orderId: order.id
      });

      if (checkoutRes.success && checkoutRes.data) {
        const newUrl = checkoutRes.data.url;
        const newCheckoutId = checkoutRes.data.id || linkId;

        const dateStr = getLocalDateTime();
        await window.electronAPI.dbQuery(
          `INSERT INTO payment_links (id, customerId, customerName, description, amount, channel, date, status, url, checkoutId) 
           VALUES (?, ?, ?, ?, ?, 'Nomod', ?, 'Pending', ?, ?)`,
          [
            linkId,
            order.customerId || 'Walk-in',
            order.customerName || 'Walk-in Customer',
            `Order #${settings.invoicePrefix || ''}${order.id}`,
            due,
            dateStr,
            newUrl,
            newCheckoutId
          ]
        );

        await window.electronAPI.dbQuery(
          "UPDATE orders SET nomodCheckoutId = ?, nomodPaymentStatus = 'Pending', updatedAt = ? WHERE id = ?",
          [newCheckoutId, new Date().toISOString(), order.id]
        );

        paymentService.startTracking(order.id, newCheckoutId);
        alert("New Nomod payment link generated and tracking started!");
        fetchOrders();
      } else {
        alert("Failed to generate new payment link: " + (checkoutRes.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Resend payment link exception:", err);
      alert("Error generating new payment link: " + err.message);
    }
  };
  const [workflowFilter, setWorkflowFilter] = useState('All'); // 'All', 'Confirmed', 'Processing', 'Ready', 'Delivered'
  const [showFilters, setShowFilters] = useState(false);
  const [isPrintingTags, setIsPrintingTags] = useState(false);
  const [pdfToast, setPdfToast] = useState(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data) {
        if (event.data.type === 'pdf-downloaded') {
          setPdfToast({ success: true, filePath: event.data.filePath });
          setTimeout(() => {
            setPdfToast(null);
          }, 5000);
        } else if (event.data.type === 'pdf-error') {
          setPdfToast({ success: false, error: event.data.error });
          setTimeout(() => {
            setPdfToast(null);
          }, 7000);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const [dateRange, setDateRange] = useState('All');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Delete Order & PIN Verification State
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOption, setDeleteOption] = useState('refund'); // 'refund' or 'advance'
  const [refundMethod, setRefundMethod] = useState('Cash');
  const [deleteReason, setDeleteReason] = useState('');

  // Credit Limit Protection states
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [showManagerPinModal, setShowManagerPinModal] = useState(false);
  const [creditWarningDetails, setCreditWarningDetails] = useState(null);
  const [managerPinValue, setManagerPinValue] = useState('');
  const [managerPinError, setManagerPinError] = useState('');
  const [pendingPayStatus, setPendingPayStatus] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, workflowFilter, dateRange, customStart, customEnd, sortBy]);

  useEffect(() => {
    const handleNomodSuccess = (e) => {
      const paidOrderId = e.detail?.orderId;
      if (paidOrderId) {
        if (nomodLinkModal.show && (nomodLinkModal.orderId === paidOrderId || nomodLinkModal.linkId === paidOrderId)) {
          setNomodLinkModal({ show: false, url: '', linkId: '', amount: 0 });
        }
        fetchOrders();
      }
    };
    window.addEventListener('nomod-payment-success', handleNomodSuccess);
    return () => window.removeEventListener('nomod-payment-success', handleNomodSuccess);
  }, [nomodLinkModal]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setSelectedOrder(null);
        setShowPayModal(false);
        setShowPinModal(false);
        setPinValue('');
        setPinError('');
        setShowCreditWarning(false);
        setShowManagerPinModal(false);
        setManagerPinValue('');
        setManagerPinError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const isAnyOpen = selectedOrder || showStatusModal || showPayModal || showPinModal || showCreditWarning || showManagerPinModal;
    if (isAnyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedOrder, showStatusModal, showPayModal, showPinModal, showCreditWarning, showManagerPinModal]);

  const checkCreditLimitBeforeUpdate = async (newPayStatus) => {
    if (!selectedOrder || !selectedOrder.customerId || selectedOrder.customerId === 'Walk-in') return false;
    if (!settings.enableCreditLimitProtection) return false;

    let updatedPaidAmount = selectedOrder.paidAmount || 0;
    let updatedDueAmount = selectedOrder.dueAmount ?? selectedOrder.totalAmount;

    if (newPayStatus === 'Credit' || newPayStatus === 'Pending') {
      updatedDueAmount = selectedOrder.totalAmount;
    } else if (newPayStatus === 'Partial') {
      if (updatedPaidAmount >= selectedOrder.totalAmount) {
        updatedPaidAmount = selectedOrder.totalAmount / 2;
      }
      updatedDueAmount = selectedOrder.totalAmount - updatedPaidAmount;
    } else {
      updatedDueAmount = 0; // Paid
    }

    const oldDueAmount = selectedOrder.dueAmount || 0;
    const netIncrease = updatedDueAmount - oldDueAmount;

    if (netIncrease <= 0) return false;

    const checkRes = await checkCreditLimit(selectedOrder.customerId, netIncrease, settings);
    if (checkRes.blocked) {
      setCreditWarningDetails(checkRes.details);
      setPendingPayStatus(newPayStatus);
      setShowCreditWarning(true);
      return true; // blocked
    }
    return false; // allowed
  };

  const handleVerifyManagerPin = async (e) => {
    e.preventDefault();
    setManagerPinError('');
    const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
    const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
    const userId = `${userRole}: ${userSession.name || userSession.username || 'User'}`;

    try {
      const res = await window.electronAPI.verifyManagerPin({
        pin: managerPinValue,
        customerId: selectedOrder.customerId,
        customerName: creditWarningDetails.customerName,
        orderId: selectedOrder.id,
        creditLimit: creditWarningDetails.creditLimit,
        outstandingBalance: creditWarningDetails.currentOutstanding,
        orderAmount: creditWarningDetails.orderAmount,
        exceededAmount: creditWarningDetails.exceededAmount,
        userId
      });

      if (res.success) {
        setShowManagerPinModal(false);
        setShowCreditWarning(false);
        setManagerPinValue('');

        const status = pendingPayStatus;
        setTimeout(() => {
          handleUpdatePaymentStatus(status, true);
        }, 50);
      } else {
        setManagerPinError(res.error || "Incorrect PIN! Access Denied.");
      }
    } catch (err) {
      setManagerPinError("An error occurred during verification");
    }
  };

  const handleCancelOverride = async () => {
    const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
    const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
    const userId = `${userRole}: ${userSession.name || userSession.username || 'User'}`;

    try {
      await window.electronAPI.logOverrideRejection({
        customerId: selectedOrder.customerId,
        customerName: creditWarningDetails.customerName,
        orderId: selectedOrder.id,
        creditLimit: creditWarningDetails.creditLimit,
        outstandingBalance: creditWarningDetails.currentOutstanding,
        orderAmount: creditWarningDetails.orderAmount,
        exceededAmount: creditWarningDetails.exceededAmount,
        userId,
        actionType: 'REJECTED'
      });
    } catch (err) {
      console.error("Failed to log override rejection:", err);
    }

    setShowCreditWarning(false);
    setShowManagerPinModal(false);
    setManagerPinValue('');
    setManagerPinError('');
  };

  // Translation helpers
  const translateStatus = (status) => {
    if (!status) return '';
    if (['Payment Pending', 'Credit'].includes(status)) {
      return t('confirmed', settings.language);
    }
    // Convert to camelCase (e.g. "Ready to Pick up" -> "readyToPickUp", "Picked Up" -> "pickedUp")
    const key = status.charAt(0).toLowerCase() + status.slice(1).replace(/\s+(.)/g, (_, c) => c.toUpperCase());
    const translated = t(key, settings.language);
    return translated === key ? status : translated;
  };

  const getPaymentMethodTranslation = (method) => {
    if (!method) return '';
    if (method === 'Cash' || method.toUpperCase() === 'CASH') return 'Cash';
    if (method === 'Bank' || method.toUpperCase() === 'BANK') return 'Bank';
    if (method === 'Card' || method.toUpperCase() === 'CARD') return t('card', settings.language);
    if (method === 'UPI' || method.toUpperCase() === 'UPI') return t('upi', settings.language);
    if (method === 'Not Paid') return t('notPaid', settings.language) || 'Not Paid';
    if (method === 'Multipayment') return 'Multipayment';
    if (method === 'Advance' || method.toUpperCase() === 'ADVANCE' || method.toUpperCase() === 'SYSTEM AUTO') return 'Advance';
    return method;
  };

  // Helper to determine if an order is overdue
  const isOverdue = (order) => {
    if (order.dueAmount <= 0 && order.paymentStatus === 'Paid') return false;
    const createdDate = new Date(order.createdAt);
    const diffTime = Math.abs(new Date() - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const overdueLimit = settings.overdueDays || 7;
    return diffDays > overdueLimit;
  };

  const dateFilteredOrders = React.useMemo(() => {
    const bounds = getLocalDateBounds(dateRange, customStart, customEnd);
    if (bounds === false) return []; // Custom selected but dates missing
    if (bounds === null) return orders; // All time
    return orders.filter(o => isWithinBounds(o.createdAt, bounds));
  }, [orders, dateRange, customStart, customEnd]);

  // Filtering logic
  let filteredOrders = [];
  if (workflowFilter === 'Deleted') {
    filteredOrders = dateFilteredOrders.filter(o => o.isDeleted);
  } else {
    const activeOnly = dateFilteredOrders.filter(o => !o.isDeleted);
    if (workflowFilter === 'All') {
      filteredOrders = activeOnly;
    } else if (workflowFilter === 'Confirmed') {
      filteredOrders = activeOnly.filter(o => ['Confirmed', 'Pending', 'Payment Pending', 'Credit'].includes(o.status));
    } else if (workflowFilter === 'Processing') {
      filteredOrders = activeOnly.filter(o => !['Confirmed', 'Pending', 'Payment Pending', 'Credit', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered'].includes(o.status) || ['Picked Up', 'Washing', 'Drying', 'Ironing'].includes(o.status));
    } else if (workflowFilter === 'Ready') {
      filteredOrders = activeOnly.filter(o => ['Ready', 'Ready to Pick up', 'Out for Delivery'].includes(o.status));
    } else if (workflowFilter === 'Delivered') {
      filteredOrders = activeOnly.filter(o => o.status === 'Delivered');
    }
  }

  const paginatedOrders = React.useMemo(() => {
    return filteredOrders.slice((currentPage - 1) * 20, currentPage * 20);
  }, [filteredOrders, currentPage]);

  // Active orders only for financial KPIs and workflowCounts of active states
  const activeDateFilteredOrders = dateFilteredOrders.filter(o => !o.isDeleted);

  // Financial Calculations for KPIs
  const totalAmount = activeDateFilteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const totalPaid = activeDateFilteredOrders
    .filter(o => (o.dueAmount === 0 || o.dueAmount === null) && o.totalAmount > 0)
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const totalPending = activeDateFilteredOrders
    .filter(o => (o.dueAmount > 0))
    .reduce((sum, o) => sum + (o.dueAmount || 0), 0);

  const overdueOrdersList = activeDateFilteredOrders.filter(o => isOverdue(o));
  const overdueAmount = overdueOrdersList.reduce((sum, o) => sum + (o.dueAmount || 0), 0);


  const workflowCounts = {
    All: activeDateFilteredOrders.length,
    Confirmed: activeDateFilteredOrders.filter(o => ['Confirmed', 'Pending', 'Payment Pending', 'Credit'].includes(o.status)).length,
    Processing: activeDateFilteredOrders.filter(o => !['Confirmed', 'Pending', 'Payment Pending', 'Credit', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered'].includes(o.status) || ['Picked Up', 'Washing', 'Drying', 'Ironing'].includes(o.status)).length,
    Ready: activeDateFilteredOrders.filter(o => ['Ready', 'Ready to Pick up', 'Out for Delivery'].includes(o.status)).length,
    Delivered: activeDateFilteredOrders.filter(o => o.status === 'Delivered').length,
    Deleted: dateFilteredOrders.filter(o => o.isDeleted).length
  };


  useEffect(() => {
    setSearchTerm(querySearch);
  }, [querySearch]);

  useEffect(() => {
    fetchOrders();
  }, [searchTerm, sortBy]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // Try local DB first if in Electron
      if (window.electronAPI?.dbQuery) {
        let query = `
          SELECT * FROM (
            SELECT 
              orders.id, orders.shopId, orders.billNumber, orders.customerId, 
              customers.name AS customerName, customers.phone AS customerPhone, 
              orders.totalAmount, orders.paidAmount, orders.dueAmount, 
              orders.paymentStatus, orders.status, 
              (SELECT CASE 
                 WHEN COUNT(DISTINCT method) > 1 THEN 'Multipayment' 
                 WHEN COUNT(DISTINCT method) = 1 THEN MIN(method) 
                 ELSE orders.paymentMethod 
               END FROM payments WHERE payments.orderId = orders.id) AS paymentMethod,
              orders.items, orders.statusHistory, orders.expectedDeliveryDate, orders.specialInstructions, orders.branchId,
              orders.createdAt, orders.updatedAt, orders.isSynced,
              orders.nomodPaymentStatus, orders.nomodCheckoutId,
              payment_links.date AS nomodLinkDate, payment_links.url AS nomodLinkUrl,
              orders.paymentBreakdown,
              0 AS isDeleted, NULL AS refundStatus, NULL AS refundMethod, NULL AS returnedAt, NULL AS payments
            FROM orders 
            LEFT JOIN customers ON orders.customerId = customers.id
            LEFT JOIN payment_links ON orders.nomodCheckoutId = payment_links.checkoutId
            WHERE orders.status != 'Deleted'

            UNION ALL

            SELECT 
              deleted_orders.id, deleted_orders.shopId, deleted_orders.billNumber, deleted_orders.customerId, 
              deleted_orders.customerName AS customerName, deleted_orders.customerPhone AS customerPhone, 
              deleted_orders.totalAmount, deleted_orders.paidAmount, 0 AS dueAmount, 
              deleted_orders.originalPaymentStatus AS paymentStatus, 'Deleted' AS status, deleted_orders.originalPaymentMethod AS paymentMethod, 
              deleted_orders.items, NULL AS statusHistory, NULL AS expectedDeliveryDate, NULL AS specialInstructions, NULL AS branchId,
              deleted_orders.deletedAt AS createdAt, deleted_orders.deletedAt AS updatedAt, 1 AS isSynced,
              NULL AS nomodPaymentStatus, NULL AS nomodCheckoutId,
              NULL AS nomodLinkDate, NULL AS nomodLinkUrl,
              NULL AS paymentBreakdown,
              1 AS isDeleted, deleted_orders.refundStatus, deleted_orders.refundMethod, deleted_orders.returnedAt, deleted_orders.payments
            FROM deleted_orders
          ) AS all_orders
        `;
        let params = [];
        if (searchTerm) {
          query += ' WHERE id LIKE ? OR billNumber LIKE ? OR customerName LIKE ? OR customerPhone LIKE ? OR status LIKE ? OR paymentStatus LIKE ?';
          const term = `%${searchTerm}%`;
          params = [term, term, term, term, term, term];
        }
        if (sortBy === 'payment') {
          query += " ORDER BY CASE WHEN paymentStatus = 'Paid' THEN 0 ELSE 1 END, updatedAt DESC, createdAt DESC";
        } else {
          query += ' ORDER BY createdAt DESC';
        }
        const res = await window.electronAPI.dbQuery(query, params);
        if (res.success) {
          setOrders(res.data);

          // Auto-open if exact match on bill number or ID (robust matching)
          if (searchTerm && res.data.length === 1) {
            const found = res.data[0];
            const cleanSearch = searchTerm.replace('#', '').replace('ORDER:', '').trim().toLowerCase();
            const cleanId = (found.id || '').toString().replace('#', '').trim().toLowerCase();
            const cleanBill = (found.billNumber || '').toString().replace('#', '').trim().toLowerCase();

            if (cleanId === cleanSearch || cleanBill === cleanSearch) {
              setSelectedOrder(found);
              setShowModal(true);
            }
          }

          setLoading(false);
          return;
        }
      }

      // Fallback to remote API
      const res = await axios.get(`${API_BASE}/orders/search?q=${encodeURIComponent(searchTerm)}`);
      setOrders(res.data);

      // Auto-open if exact match on bill number or ID (robust matching)
      if (searchTerm && res.data.length === 1) {
        const found = res.data[0];
        const cleanSearch = searchTerm.replace('#', '').replace('ORDER:', '').trim().toLowerCase();
        const cleanId = (found.id || '').toString().replace('#', '').trim().toLowerCase();
        const cleanBill = (found.billNumber || '').toString().replace('#', '').trim().toLowerCase();

        if (cleanId === cleanSearch || cleanBill === cleanSearch) {
          setSelectedOrder(found);
          setShowModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus, orderOverride = null) => {
    const orderToUpdate = orderOverride || selectedOrder;
    if (!orderToUpdate) return;

    if (['Delivered'].includes(newStatus)) {
      const statusText = translateStatus(newStatus);
      const confirmMsg = t('confirmStatusChange', settings.language)
        .replace('{id}', orderToUpdate.id)
        .replace('{status}', statusText);
      if (!window.confirm(confirmMsg)) return;
    }

    try {
      // 1. Update Local DB First (Offline-First approach)
      let newHistory = [];
      if (window.electronAPI?.dbQuery) {
        let history = [];
        try {
          history = typeof orderToUpdate.statusHistory === 'string'
            ? JSON.parse(orderToUpdate.statusHistory || '[]')
            : (orderToUpdate.statusHistory || []);
          if (!Array.isArray(history)) history = [];
        } catch (e) {
          history = [];
        }
        newHistory = [...history, { status: newStatus, updatedBy: 'Admin Staff', timestamp: getLocalISOString() }];

        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, statusHistory = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newStatus, JSON.stringify(newHistory), getLocalISOString(), orderToUpdate.id]
        );
      }

      // 2. Update State immediately
      setOrders(prev => prev.map(o => o.id === orderToUpdate.id ? { ...o, status: newStatus, statusHistory: newHistory } : o));
      if (selectedOrder && selectedOrder.id === orderToUpdate.id) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus, statusHistory: newHistory }));
      }

      // 3. Attempt Background Sync to Cloud (Don't block UI)
      axios.patch(`${API_BASE}/orders/${encodeURIComponent(orderToUpdate.id)}/status`, {
        status: newStatus,
        updatedBy: 'Admin Staff'
      }).catch(syncErr => {
        console.warn('Cloud sync deferred for background:', syncErr.message);
        // We don't alert the user because isSynced=0 will handle it later
      });

    } catch (err) {
      console.error('Failed to update status locally:', err);
      alert(t('failedLocalStatusUpdate', settings.language));
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    setPinError('');
    setIsDeleting(true);
    try {
      let pinOwner = null;

      // 1. Verify locally against Shop Settings Order Deletion PIN
      const configuredPin = settings.orderDeletePin || '0000';
      if (pinValue === configuredPin) {
        pinOwner = 'Shop Settings PIN';
      } else {
        // 2. Check local SQLite users table for Admin/Manager PIN
        if (window.electronAPI?.dbQuery) {
          try {
            const userCheck = await window.electronAPI.dbQuery(
              `SELECT name, role FROM users WHERE (role IN ('admin', 'manager', 'super_admin')) AND (passcode = ? OR pin = ?)`,
              [pinValue, pinValue]
            );
            if (userCheck.success && userCheck.data && userCheck.data.length > 0) {
              pinOwner = `${userCheck.data[0].role}: ${userCheck.data[0].name}`;
            }
          } catch (dbErr) {
            console.warn('Local users table PIN check failed:', dbErr);
          }
        }

        // 3. Fallback to checking active manager PINs on the backend
        if (!pinOwner) {
          try {
            const verifyRes = await axios.post(`${API_BASE}/auth/verify-manager-pin`, { pin: pinValue });
            if (verifyRes.data && verifyRes.data.valid) {
              pinOwner = `Manager ${verifyRes.data.managerName}`;
            }
          } catch (apiErr) {
            console.warn('Backend PIN check failed or offline:', apiErr.message);
          }
        }
      }

      if (!pinOwner) {
        setPinError('Invalid Manager PIN. Please enter the Order Delete PIN configured in Settings.');
        setIsDeleting(false);
        return;
      }

      // PIN is valid! Delete the order.
      const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
      const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
      const currentLoggedInUser = `${userRole}: ${userSession.name || userSession.username || 'User'}`;

      const refundImmediately = deleteOption === 'refund';
      let linkedPayments = [];

      // A. Perform ERP Soft Delete Transaction in SQLite
      if (window.electronAPI?.softDeleteOrder) {
        const softRes = await window.electronAPI.softDeleteOrder({
          orderId: orderToDelete.id,
          deletedBy: currentLoggedInUser,
          deleteReason: deleteReason || `Deleted by ${pinOwner}`,
          deleteAction: deleteOption, // 'refund' or 'advance'
          refundMethod: refundMethod
        });

        if (!softRes.success) {
          throw new Error(softRes.error || 'Failed to soft delete order');
        }

        await window.electronAPI.runDataHealer();
      } else if (window.electronAPI?.dbQuery) {
        // Fallback for dbQuery
        await window.electronAPI.dbQuery('UPDATE orders SET status = "Deleted", deletedAt = ?, deletedBy = ?, deleteReason = ? WHERE id = ?', [
          getLocalISOString(), currentLoggedInUser, deleteReason || `Deleted by ${pinOwner}`, orderToDelete.id
        ]);
      }

      // B. Delete remotely from Cloud (Background invocation - non-blocking)
      axios.delete(`${API_BASE}/orders/${encodeURIComponent(orderToDelete.id)}`, {
        data: {
          deletedBy: currentLoggedInUser,
          approvedBy: pinOwner,
          refundImmediately: refundImmediately,
          refundMethod: refundMethod,
          originalPaymentMethod: orderToDelete.paymentMethod,
          payments: linkedPayments
        }
      }).catch(remoteErr => {
        console.warn('Could not delete from cloud (offline):', remoteErr.message);
      });

      // C. Update State
      setOrders(prev => prev.filter(o => o.id !== orderToDelete.id));
      setSelectedOrder(null);
      setShowPinModal(false);
      setPinValue('');
      alert(`Order ${orderToDelete.id} soft deleted and ERP ledgers updated successfully (authorized by ${pinOwner}).`);
      window.location.reload();
    } catch (err) {
      console.error('Failed to delete order:', err);
      setPinError('An error occurred during deletion: ' + (err.message || ''));
    } finally {
      setIsDeleting(false);
    }
  };

  const [originalPayStatus, setOriginalPayStatus] = useState(null);

  const handleUpdatePaymentStatus = async (newPayStatus, isOverridden = false) => {
    if (!selectedOrder) return;

    if (newPayStatus === 'Paid') {
      setOriginalPayStatus(selectedOrder.paymentStatus);
      setSelectedOrder(prev => ({ ...prev, paymentStatus: 'Paid' }));
      setShowPayModal(true);
      return;
    }

    if (!isOverridden) {
      const blocked = await checkCreditLimitBeforeUpdate(newPayStatus);
      if (blocked) return;
    }

    try {
      let updatedPaidAmount = selectedOrder.paidAmount || 0;
      let updatedDueAmount = selectedOrder.dueAmount ?? selectedOrder.totalAmount;

      if (newPayStatus === 'Credit' || newPayStatus === 'Pending') {
        updatedPaidAmount = 0;
        updatedDueAmount = selectedOrder.totalAmount;
      } else if (newPayStatus === 'Partial') {
        if (updatedPaidAmount >= selectedOrder.totalAmount) {
          updatedPaidAmount = selectedOrder.totalAmount / 2;
        }
        updatedDueAmount = selectedOrder.totalAmount - updatedPaidAmount;
      }

      if (window.electronAPI?.dbQuery) {
        // Update order amounts and payment status
        await window.electronAPI.dbQuery(
          'UPDATE orders SET paymentStatus = ?, paidAmount = ?, dueAmount = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newPayStatus, updatedPaidAmount, updatedDueAmount, getLocalISOString(), selectedOrder.id]
        );

        // Revert any linked payments if changed to Credit or Pending
        if (newPayStatus === 'Credit' || newPayStatus === 'Pending') {
          await window.electronAPI.dbQuery(
            'DELETE FROM payments WHERE orderId = ?',
            [selectedOrder.id]
          );
        }

        // Call the healer to automatically reconcile customer balance
        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }
      }

      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? {
        ...o,
        paymentStatus: newPayStatus,
        paidAmount: updatedPaidAmount,
        dueAmount: updatedDueAmount
      } : o));

      setSelectedOrder(prev => ({
        ...prev,
        paymentStatus: newPayStatus,
        paidAmount: updatedPaidAmount,
        dueAmount: updatedDueAmount
      }));

      alert(t('paymentStatusUpdated', settings.language));
    } catch (err) {
      console.error('Failed to update payment status:', err);
      alert(t('updateFailed', settings.language) + err.message);
    }
  };

  const handlePrint = (orderId) => {
    // Navigate to invoice page which handles printing
    navigate(`/invoice/${encodeURIComponent(orderId)}`);
  };

  const handleDownloadPDF = (orderId) => {
    console.log("handleDownloadPDF clicked in Orders.jsx! orderId =", orderId);
    const cleanId = orderId ? orderId.toString().replace('#', '') : '';
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '100px';
    iframe.style.height = '100px';
    iframe.style.border = 'none';

    const targetSrc = `${window.location.origin}${window.location.pathname}#/invoice/${cleanId}?download=force&t=${Date.now()}`;
    console.log("Appending iframe with src:", targetSrc);
    iframe.src = targetSrc;

    iframe.onload = () => {
      console.log("Iframe loaded target source successfully, sending order data via postMessage:", targetSrc);
      iframe.contentWindow.postMessage({
        type: 'load-invoice-data',
        orderData: selectedOrder
      }, '*');
    };

    document.body.appendChild(iframe);
    setTimeout(() => {
      if (iframe.parentNode) {
        console.log("Removing background iframe.");
        document.body.removeChild(iframe);
      }
    }, 15000);
  };

  const handlePrintTags = () => {
    document.body.classList.add('printing-tags');
    setIsPrintingTags(true);
    setTimeout(async () => {
      if (window.appPrint) {
        await window.appPrint({ printerType: 'tag' });
      } else {
        window.print();
      }
      setIsPrintingTags(false);
      document.body.classList.remove('printing-tags');
    }, 500);
  };

  const confirmPaidStatus = async (isOverridden = false) => {
    try {
      const nextStatus = ['Payment Pending', 'Credit', 'Paid'].includes(selectedOrder.status)
        ? 'Confirmed'
        : selectedOrder.status;

      const amountToPay = (selectedOrder.dueAmount !== undefined && selectedOrder.dueAmount > 0)
        ? selectedOrder.dueAmount
        : selectedOrder.totalAmount;

      if (payMethod === 'Nomod' && !isOverridden) {
        let linkId = `LNK-${Date.now().toString().slice(-4)}`;
        let checkoutUrl = '';

        // 1. Duplicate protection check: reuse active link if exists
        if (window.electronAPI?.dbQuery) {
          try {
            const activeLnkRes = await window.electronAPI.dbQuery(
              `SELECT * FROM payment_links WHERE (description LIKE ? OR id = ?) AND status = 'Active' LIMIT 1`,
              [`%${selectedOrder.id}%`, `LNK-${selectedOrder.id}`]
            );
            if (activeLnkRes.success && activeLnkRes.data.length > 0) {
              checkoutUrl = activeLnkRes.data[0].url;
              linkId = activeLnkRes.data[0].id;
            }
          } catch (dbErr) {
            console.warn("Failed to check active payment link in Orders:", dbErr);
          }
        }

        if (!checkoutUrl) {
          try {
            const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
            const checkoutRes = await window.electronAPI.createNomodCheckout({
              amount: amountToPay,
              currency: settings.nomodCurrency || 'AED',
              customer: {
                name: selectedOrder.customerName || 'Customer',
                phone: selectedOrder.customerPhone || selectedOrder.phone || ''
              },
              orderId: selectedOrder.id,
              userRole: currentUser.role || 'staff'
            });

            if (checkoutRes.success && checkoutRes.data && checkoutRes.data.url) {
              checkoutUrl = checkoutRes.data.url;
              if (checkoutRes.data.id) {
                linkId = checkoutRes.data.id;
              }
            } else {
              const errorMsg = checkoutRes?.error || 'Unknown error';
              console.warn("Nomod Backend API failed in Orders:", errorMsg);
              if (settings.nomodEnv === 'live') {
                alert("Nomod Checkout API connection failed: " + errorMsg + ". Please check your API key configuration in settings.");
                return;
              }
              checkoutUrl = `https://link.nomod.com/pay?account=${settings.nomodMerchantId || 'default'}&amount=${amountToPay}&reference=${linkId}`;
            }
          } catch (err) {
            console.warn("Nomod Checkout IPC failed in Orders:", err.message);
            if (settings.nomodEnv === 'live') {
              alert("Nomod Checkout IPC failed: " + err.message);
              return;
            }
          }
        }

        // Log Audit Event
        if (window.electronAPI?.logAuditEvent) {
          const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
          window.electronAPI.logAuditEvent({
            eventName: 'Payment Link Generated',
            details: `Nomod payment link generated for Order ${selectedOrder.id}, Amount: ${amountToPay}`,
            userId: currentUser.name || 'Staff',
            userRole: currentUser.role || 'staff'
          });
        }

        setNomodLinkModal({
          show: true,
          url: checkoutUrl,
          linkId,
          amount: amountToPay
        });
        return;
      }

      // 1. Local DB Updates (Perform this FIRST)
      if (window.electronAPI?.dbQuery) {
        let actualPaid = amountToPay;
        let newPayStatus = 'Paid';
        let newDue = 0;
        let newPaid = selectedOrder.totalAmount;
        let finalPayMethod = payMethod;

        if (payMethod === 'Multipayment') {
          actualPaid = cashVal + cardVal + upiVal + bankVal;
          if (actualPaid + discVal < amountToPay) {
            newDue = amountToPay - (actualPaid + discVal);
            newPaid = selectedOrder.totalAmount - newDue;
            newPayStatus = newDue > 0 ? 'Partial' : 'Paid';
          } else {
            newPaid = selectedOrder.totalAmount;
            newDue = 0;
            newPayStatus = 'Paid';
          }
        } else {
          if (discVal > 0) {
            actualPaid = Math.max(0, amountToPay - discVal);
            if (actualPaid + discVal < amountToPay) {
              newDue = amountToPay - (actualPaid + discVal);
              newPaid = selectedOrder.totalAmount - newDue;
              newPayStatus = newDue > 0 ? 'Partial' : 'Paid';
            } else {
              newPaid = selectedOrder.totalAmount;
              newDue = 0;
              newPayStatus = 'Paid';
            }
          }
        }

        const finalNextStatus = (newDue === 0 && ['Payment Pending', 'Credit', 'Pending'].includes(selectedOrder.status)) ? 'Confirmed' : selectedOrder.status;

        // Update Local Order
        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, paymentStatus = ?, paidAmount = ?, dueAmount = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [finalNextStatus, newPayStatus, newPaid, newDue, finalPayMethod, getLocalISOString(), selectedOrder.id]
        );

        // Update Customer Balance if it was Credit/Pending/Partial
        const wasUnpaid = selectedOrder.paymentStatus === 'Credit' || selectedOrder.paymentStatus === 'Partial' || (selectedOrder.dueAmount !== undefined && selectedOrder.dueAmount > 0);
        if (wasUnpaid && selectedOrder.customerId && selectedOrder.customerId !== 'Walk-in') {
          const reduction = amountToPay - newDue;
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [reduction, getLocalISOString(), selectedOrder.customerId]
          );
        }

        const txnTimestamp = getLocalDateTime();

        // Prepare splits
        let splits = [];
        if (payMethod === 'Multipayment') {
          if (cashVal > 0) splits.push({ method: 'Cash', amount: cashVal });
          if (cardVal > 0) splits.push({ method: 'Card', amount: cardVal });
          if (upiVal > 0) splits.push({ method: 'UPI', amount: upiVal });
          if (bankVal > 0) splits.push({ method: 'Bank', amount: bankVal });
        } else {
          if (actualPaid > 0) splits.push({ method: payMethod, amount: actualPaid });
        }
        if (discVal > 0) {
          splits.push({ method: 'Discount', amount: discVal });
        }

        const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
        const creatorName = userSession.name || userSession.username || 'System';
        const creatorId = userSession.id || 'SYSTEM';
        const creatorRole = userSession.role || 'system';

        for (const split of splits) {
          if (split.method === 'Discount') {
            const splitTxnId = `TXN-${Date.now()}-Discount`;
            await window.electronAPI.dbQuery(
              `INSERT INTO account_transactions 
               (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
              [
                splitTxnId,
                DEFAULT_SHOP_ID,
                'CASH',
                'EXPENSE',
                'Discount Given',
                split.amount,
                `Discount for Order ${selectedOrder.id}`,
                txnTimestamp,
                getLocalISOString(),
                'DollarSign',
                null,
                creatorName,
                creatorId,
                creatorRole
              ]
            );
          } else {
            const splitTxnId = `TXN-${Date.now()}-${split.method}`;
            const mappedBankId = split.method === 'Card' ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : (split.method === 'UPI' ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : (split.method === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null));
            const accountType = (split.method === 'Bank' || split.method === 'Card' || split.method === 'UPI') ? 'BANK' : 'CASH';

            await window.electronAPI.dbQuery(
              `INSERT INTO account_transactions 
               (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
              [
                splitTxnId,
                DEFAULT_SHOP_ID,
                accountType,
                'INCOME',
                'Sales Settlement',
                split.amount,
                `Payment for Order ${selectedOrder.id}${split.method === 'Card' ? ' (Card)' : (split.method === 'UPI' ? ' (UPI)' : '')}`,
                txnTimestamp,
                getLocalISOString(),
                'DollarSign',
                mappedBankId,
                creatorName,
                creatorId,
                creatorRole
              ]
            );

            if (split.method === 'Card' && settings.cardCommission > 0) {
              const commissionRate = parseFloat(settings.cardCommission || 0);
              const commissionAmount = split.amount * (commissionRate / 100);
              const commTxnId = `TXN-COMM-${Date.now()}`;
              await window.electronAPI.dbQuery(
                `INSERT INTO account_transactions 
                 (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
                [
                  commTxnId,
                  DEFAULT_SHOP_ID,
                  'BANK',
                  'EXPENSE',
                  'Card Commission',
                  commissionAmount,
                  `Card Commission for Order ${selectedOrder.id}`,
                  txnTimestamp,
                  getLocalISOString(),
                  'Percent',
                  mappedBankId,
                  creatorName,
                  creatorId,
                  creatorRole
                ]
              );
            }

            // Record Payment in payments table
            const currentTimestamp = getLocalISOString();
            const payId = `PAY-HEAL-${selectedOrder.id}-${split.method}-${Date.now()}`;
            const payRef = await window.electronAPI.getNextPaymentReference('PAY');
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
              [payId, selectedOrder.customerId || 'Walk-in', selectedOrder.id, DEFAULT_SHOP_ID, split.amount, split.method, 'SUCCESS', currentTimestamp, currentTimestamp, payRef]
            );
          }
        }

        // Call the healer to automatically reconcile customer balance
        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }
      }

      // 2. Update Local React State immediately
      const actualPaidState = payMethod === 'Multipayment' ? cashVal + cardVal + upiVal + bankVal : (amountToPay - discVal);
      const newDueState = amountToPay - actualPaidState - discVal;
      const newPaidState = selectedOrder.totalAmount - Math.max(0, newDueState);
      const newPayStatusState = newDueState > 0 ? 'Partial' : 'Paid';
      const nextStatusState = (newDueState <= 0 && ['Payment Pending', 'Credit', 'Pending'].includes(selectedOrder.status)) ? 'Confirmed' : selectedOrder.status;

      const updatedOrder = {
        ...selectedOrder,
        status: nextStatusState,
        paymentStatus: newPayStatusState,
        paidAmount: newPaidState,
        dueAmount: Math.max(0, newDueState),
        paymentMethod: payMethod
      };
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);

      // 3. Sync to Backend
      const syncPromise = axios.patch(`${API_BASE}/orders/${encodeURIComponent(selectedOrder.id)}/status`, {
        status: nextStatusState,
        paymentStatus: newPayStatusState,
        paidAmount: newPaidState,
        dueAmount: Math.max(0, newDueState),
        updatedBy: 'Admin Staff'
      }).catch(syncErr => {
        console.warn('Backend sync deferred (local payment already recorded):', syncErr.message);
      });

      setShowPayModal(false);
      alert(t('paymentRecordedLocally', settings.language));

      if (window.electronAPI?.dbQuery) {
        // Local DB was updated synchronously, re-fetch immediately
        fetchOrders();
      } else {
        // Fallback/web: wait for API patch to complete to avoid race condition
        syncPromise.finally(() => {
          fetchOrders();
        });
      }

    } catch (err) {
      console.error('Failed to update local status:', err);
      alert(t('failedRecordPayment', settings.language) + err.message);
    }
  };

  const handleWhatsApp = async (phone, id = null) => {
    if (!phone) {
      alert(t('noPhoneFound', settings.language));
      return;
    }

    let cleanPhone = phone.toString().replace(/\D/g, '');
    if (!cleanPhone) {
      alert(t('invalidPhoneFormat', settings.language));
      return;
    }

    // Prepend country code if original phone doesn't start with '+'
    if (!phone.toString().trim().startsWith('+')) {
      const countryCode = settings.waCountryCode || '971';
      const cleanCountryCode = countryCode.replace(/\D/g, '');
      if (cleanCountryCode && !cleanPhone.startsWith(cleanCountryCode)) {
        cleanPhone = cleanCountryCode + cleanPhone;
      }
    }

    const orderMatch = orders.find(o => o.id === id || o.billNumber === id) || selectedOrder;
    const isReadyStatus = orderMatch && ['Ready', 'Ready to Pick up'].includes(orderMatch.status);

    // Auto generate / retrieve payment link if there is a due balance
    let paymentLinkUrl = '';
    const due = orderMatch ? (orderMatch.dueAmount ?? (orderMatch.totalAmount - (orderMatch.paidAmount || 0))) : 0;
    if (due > 0 && orderMatch && settings.enablePaymentLinks !== false && settings.enableNomod) {
      if (window.electronAPI?.dbQuery) {
        try {
          const searchRes = await window.electronAPI.dbQuery(
            `SELECT * FROM payment_links WHERE (description LIKE ? OR id = ?) AND status IN ('Active', 'Pending') LIMIT 1`,
            [`%${orderMatch.id}%`, `LNK-${orderMatch.billNumber}`]
          );
          if (searchRes.success && searchRes.data.length > 0) {
            paymentLinkUrl = searchRes.data[0].url;
          } else {
            const linkId = `LNK-${orderMatch.billNumber || Date.now().toString().slice(-4)}`;
            const paymentBase = (settings.paymentBaseUrl || 'https://pay.laundry.ae').replace(/\/$/, '');
            const url = `${paymentBase}/lnk/${linkId.toLowerCase()}`;
            const dateStr = getLocalDateTime();
            await window.electronAPI.dbQuery(
              `INSERT INTO payment_links (id, customerId, customerName, description, amount, channel, date, status, url, checkoutId) 
               VALUES (?, ?, ?, ?, ?, 'Nomod', ?, 'Pending', ?, ?)`,
              [
                linkId,
                orderMatch.customerId || 'Walk-in',
                orderMatch.customerName || orderMatch.customer || 'Walk-in Customer',
                `Order #${orderMatch.billNumber || orderMatch.id}`,
                due,
                dateStr,
                url,
                linkId
              ]
            );
            paymentLinkUrl = url;
          }
        } catch (err) {
          console.error("Failed to query or create payment link in database:", err);
        }
      } else {
        const paymentBase = (settings.paymentBaseUrl || 'https://pay.laundry.ae').replace(/\/$/, '');
        paymentLinkUrl = `${paymentBase}/lnk/lnk-${(orderMatch.billNumber || 'mock').toLowerCase()}`;
      }
    }

    let message = '';
    if (isReadyStatus && settings.waOrderReadyTemplate) {
      message = settings.waOrderReadyTemplate
        .replace(/{customerName}/g, orderMatch.customerName || orderMatch.customer || 'Customer')
        .replace(/{orderId}/g, orderMatch.id)
        .replace(/{total}/g, `${settings.currencySymbol || 'AED'} ${(orderMatch.totalAmount || orderMatch.total || 0).toFixed(2)}`)
        .replace(/{dueAmount}/g, `${settings.currencySymbol || 'AED'} ${(orderMatch.dueAmount ?? 0).toFixed(2)}`)
        .replace(/{deliveryDate}/g, orderMatch.expectedDeliveryDate || '');
      if (due > 0 && paymentLinkUrl) {
        message += `\n\nPay online: ${paymentLinkUrl}`;
      }
    } else if (id && settings.waReminderTemplate) {
      message = settings.waReminderTemplate
        .replace(/{customerName}/g, orderMatch ? (orderMatch.customerName || orderMatch.customer || 'Customer') : 'Customer')
        .replace(/{orderId}/g, id)
        .replace(/{total}/g, orderMatch ? `${settings.currencySymbol || 'AED'} ${(orderMatch.totalAmount || orderMatch.total || 0).toFixed(2)}` : '')
        .replace(/{dueAmount}/g, orderMatch ? `${settings.currencySymbol || 'AED'} ${(orderMatch.dueAmount ?? 0).toFixed(2)}` : '')
        .replace(/{deliveryDate}/g, orderMatch ? (orderMatch.expectedDeliveryDate || '') : '');
      if (due > 0 && paymentLinkUrl) {
        message += `\n\nPay online: ${paymentLinkUrl}`;
      }
    } else {
      message = t('waGeneralMessage', settings.language);
      if (id) {
        const getStatusTextForMsg = () => {
          if (selectedOrder) {
            const isPaid = selectedOrder.paymentStatus === 'Paid' || (selectedOrder.dueAmount !== undefined && selectedOrder.dueAmount <= 0);
            if (isPaid && ['Confirmed', 'Payment Pending', 'Credit', 'Pending'].includes(selectedOrder.status)) {
              return t('paid', settings.language);
            }
            return translateStatus(selectedOrder.status);
          }
          return t('confirmed', settings.language);
        };
        const statusText = getStatusTextForMsg();
        message = t('waStatusMessage', settings.language)
          .replace('{id}', id)
          .replace('{status}', statusText);

        if (orderMatch && orderMatch.dueAmount > 0) {
          message += `\n\nFriendly reminder: Your pending balance is ${settings.currencySymbol || 'AED'} ${orderMatch.dueAmount.toFixed(2)}.`;
          if (paymentLinkUrl) {
            message += `\n\nPay online: ${paymentLinkUrl}`;
          }
        }
      }
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className={`${styles.ordersPage} ${selectedOrder ? styles.modalActive : ''}`}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <h1>{t('orderManagement', settings.language)}</h1>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBox}>
            <Search size={18} color="#94A3B8" />
            <input
              type="text"
              placeholder={t('searchPlaceholder', settings.language)}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: showFilters ? '#EFF6FF' : 'white',
              border: showFilters ? '1px solid #3B82F6' : '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '0 0.75rem',
              height: '40px',
              cursor: 'pointer',
              color: showFilters ? '#2563EB' : '#64748B',
              fontWeight: 700,
              fontSize: '0.85rem',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
          >
            <Filter size={16} /> Filters
          </button>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '12px', zIndex: 10, pointerEvents: 'none', fontSize: '0.75rem', color: '#64748B', fontWeight: 800 }}>SORT:</span>
            <CustomSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              options={[
                { value: 'date', label: 'Latest Order' },
                { value: 'payment', label: 'Latest Payment' }
              ]}
              style={{ width: '180px' }}
              paddingLeft="36px"
            />
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.totalCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#F8FAFC' }}><DollarSign size={22} color="#0F172A" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('totalAmount', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#0F172A' }}>
              {totalAmount.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.length} {t('invoices', settings.language)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.paidCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#ECFDF5' }}><CheckCircle size={22} color="#10B981" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('paid', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#10B981' }}>
              {totalPaid.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.filter(o => (o.dueAmount === 0 || o.dueAmount === null) && o.totalAmount > 0).length} {t('invoices', settings.language)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.pendingCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#FFF7ED' }}><Clock size={22} color="#F97316" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('pending', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#F97316' }}>
              {totalPending.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.filter(o => o.dueAmount > 0).length} {t('invoices', settings.language)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.overdueCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#FEF2F2' }}><AlertCircle size={22} color="#EF4444" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('overdue', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#EF4444' }}>
              {overdueAmount.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{overdueOrdersList.length} {t('invoices', settings.language)}</span>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className={styles.subFilterRow}>
          {settings.workflowEnabled && (
            <>
              <Filter size={16} color="#64748B" />
              <button
                className={`${styles.filterTab} ${workflowFilter === 'All' ? styles.filterTabActive : ''}`}
                onClick={() => setWorkflowFilter('All')}
              >
                {t('all', settings.language)} ({workflowCounts.All})
              </button>
              <button
                className={`${styles.filterTab} ${workflowFilter === 'Confirmed' ? styles.filterTabActive : ''}`}
                onClick={() => setWorkflowFilter('Confirmed')}
              >
                {t('confirmed', settings.language)} ({workflowCounts.Confirmed})
              </button>
              <button
                className={`${styles.filterTab} ${workflowFilter === 'Processing' ? styles.filterTabActive : ''}`}
                onClick={() => setWorkflowFilter('Processing')}
              >
                {t('processing', settings.language)} ({workflowCounts.Processing})
              </button>
              <button
                className={`${styles.filterTab} ${workflowFilter === 'Ready' ? styles.filterTabActive : ''}`}
                onClick={() => setWorkflowFilter('Ready')}
              >
                {t('ready', settings.language)} ({workflowCounts.Ready})
              </button>
              <button
                className={`${styles.filterTab} ${workflowFilter === 'Delivered' ? styles.filterTabActive : ''}`}
                onClick={() => setWorkflowFilter('Delivered')}
              >
                {t('delivered', settings.language)} ({workflowCounts.Delivered})
              </button>
            </>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} color="#64748B" />
            <CustomSelect
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              options={[
                { value: 'All', label: 'All Time' },
                { value: 'Today', label: 'Today' },
                { value: 'This Month', label: 'This Month' },
                { value: 'This Year', label: 'This Year' },
                { value: 'Custom', label: 'Custom Range' }
              ]}
              style={{ width: '150px' }}
            />

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
      )}


      {/* Table Section */}
      <div className={styles.tableCard}>
        <table className={styles.ordersTable}>

          <thead>
            <tr>
              <th>{t('orderId', settings.language)}</th>
              <th>{settings.language === 'Arabic' ? 'التاريخ والوقت' : 'DATE & TIME'}</th>
              <th>{t('customer', settings.language)}</th>
              <th>{t('whatsapp', settings.language)}</th>
              <th>{t('totalAmount', settings.language)}</th>
              <th>{t('paymentMethodLabel', settings.language)}</th>
              <th>{t('actions', settings.language) || 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('loading', settings.language)}
                </td>
              </tr>
            ) : paginatedOrders.length > 0 ? (
              paginatedOrders.map((order) => (
                <tr key={order.id || order._id} className={styles.orderRow} onClick={() => {
                  setSelectedOrder(order);
                  setShowStatusModal(true);
                }}>
                  <td style={{ verticalAlign: 'middle' }}>
                    <span className={styles.idText}>{settings.invoicePrefix || ''}{order.id}</span>
                  </td>
                  <td className={styles.dateText}>{formatDateTime(order.createdAt)}</td>
                  <td>
                    <div className={styles.custCell}>
                      <span className={styles.custName}>
                        {order.customerName || (order.customerId === 'Walk-in' ? t('walkInCustomer', settings.language) : order.customerId)}
                      </span>
                      <div className={styles.custPhoneRow}>
                        <span className={styles.custPhone}>
                          {order.customerPhone || order.phone || t('noPhone', settings.language)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {(order.customerPhone || order.phone) ? (
                      <button
                        className={styles.tableWaBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWhatsApp(order.customerPhone || order.phone, order.id);
                        }}
                        title={t('whatsapp', settings.language)}
                      >
                        <WhatsAppIcon size={16} />
                      </button>
                    ) : (
                      <span className={styles.noWaText}>-</span>
                    )}
                  </td>
                  <td className={styles.amountText}>{order.totalAmount?.toFixed(2)}</td>
                  <td>
                    {order.paymentStatus === 'Paid' || order.paymentStatus === 'Partial' ? (
                      order.paymentMethod ? (
                        <span className={
                          order.paymentMethod === 'Cash' ? styles.methodCash :
                            order.paymentMethod === 'Bank' ? styles.methodOther :
                              order.paymentMethod === 'Multipayment' ? styles.methodOther :
                                order.paymentMethod === 'Advance' ? styles.methodAdvance || styles.methodOther :
                                  styles.methodOther
                        } style={order.paymentMethod === 'Advance' && !styles.methodAdvance ? { background: '#E0E7FF', color: '#4338CA', padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' } : {}}>
                          {getPaymentMethodTranslation(order.paymentMethod)}
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>-</span>
                      )
                    ) : (
                      <span className={styles.methodCredit}>
                        {t('notPaid', settings.language)}
                      </span>
                    )}
                  </td>
                  <td>
                    {order.isDeleted ? (
                      <span className={styles.statusBadge} style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>
                        Deleted
                      </span>
                    ) : order.status === 'Delivered' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700 }}>DELIVERED</span>
                        <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 500 }}>
                          {(() => {
                            try {
                              const history = typeof order.statusHistory === 'string'
                                ? JSON.parse(order.statusHistory || '[]')
                                : (order.statusHistory || []);
                              const delEntry = history.find(h => h.status === 'Delivered');
                              if (delEntry && delEntry.timestamp) return formatDateTime(delEntry.timestamp);
                            } catch (e) { }
                            return formatDateTime(order.updatedAt);
                          })()}
                        </span>
                      </div>
                    ) : (
                      <button
                        className={styles.deliverBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus('Delivered', order);
                        }}
                        style={{ margin: 0 }}
                      >
                        <Truck size={12} /> {t('deliver', settings.language)}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('noOrdersFound', settings.language)}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredOrders.length / 20)}
            onPageChange={setCurrentPage}
            totalItems={filteredOrders.length}
            pageSize={20}
            itemLabel="orders"
          />
        )}
      </div>

      {/* Order Details Drawer/Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.headerLeft}>
                <button className={styles.backBtn} onClick={() => setSelectedOrder(null)}>
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <div className={styles.headerTitleRow}>
                    <h2>Order #{settings.invoicePrefix || ''}{selectedOrder.orderId || selectedOrder.id}</h2>
                  </div>
                  <p>{t('createdOn', settings.language)} {formatDateTime(selectedOrder.createdAt)}</p>
                </div>
              </div>
              <div className={styles.headerRightActions}>
                <button className={styles.headerActionBtn} onClick={() => handlePrint(selectedOrder.id)}>
                  <Printer size={16} /> Print Receipt
                </button>
                <button className={styles.headerActionBtn} onClick={handlePrintTags}>
                  <QrCode size={16} /> Print Tags
                </button>
                <button className={styles.headerActionBtn} onClick={() => handleDownloadPDF(selectedOrder.id)}>
                  <Download size={16} /> Download PDF
                </button>
              </div>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.detailsGrid}>
                {/* Left: Info */}
                <div className={styles.infoCol}>
                  <div className={styles.customerDeliveryRow}>
                    <div className={styles.section} style={{ flex: 1 }}>
                      <h3>{t('customerInfo', settings.language)}</h3>
                      <div className={styles.infoCard}>
                        <User size={16} />
                        <div>
                          <p className={styles.infoVal}>
                            {selectedOrder.customerName || (selectedOrder.customerId === 'Walk-in' ? t('walkInCustomer', settings.language) : selectedOrder.customerId)}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <p className={styles.infoSub}>
                              {selectedOrder.customerPhone || selectedOrder.phone || t('noPhone', settings.language)} • {selectedOrder.customerId}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedOrder.expectedDeliveryDate && (
                      <div className={`${styles.section} ${styles.expectedDeliverySection}`} style={{ flex: 1 }}>
                        <h3>Expected Delivery</h3>
                        <div className={styles.infoCard}>
                          <Clock size={16} />
                          <div>
                            <p className={styles.infoVal}>
                              {(() => {
                                const rawDate = selectedOrder.expectedDeliveryDate || '';
                                if (rawDate.includes(' ')) {
                                  const [datePart, timePart] = rawDate.split(' ');
                                  return `${formatDate(datePart)} at ${timePart}`;
                                }
                                return rawDate ? formatDate(rawDate) : 'Not Scheduled';
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.section}>
                    <h3>{t('orderItems', settings.language)}</h3>
                    <div className={styles.itemsList}>
                      {(() => {
                        let items = [];
                        try {
                          items = typeof selectedOrder.items === 'string'
                            ? JSON.parse(selectedOrder.items || '[]')
                            : (selectedOrder.items || []);
                        } catch (e) { console.error("Failed to parse items", e); }

                        return (
                          <table className={styles.itemsTable}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Item</th>
                                <th style={{ textAlign: 'center' }}>Qty</th>
                                <th style={{ textAlign: 'right' }}>Unit Price</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(Array.isArray(items) ? items : []).map((item, i) => {
                                let treatmentLabel = '';
                                if (item.types && Array.isArray(item.types) && item.types.length > 0) {
                                  treatmentLabel = item.types.map(tp => tp.name).join(' + ');
                                } else if (item.type) {
                                  treatmentLabel = item.type;
                                }
                                const itemUnitPrice = item.price || 0;
                                const itemTotalAmount = itemUnitPrice * (item.qty || 1);
                                return (
                                  <tr key={i}>
                                    <td>
                                      {i + 1}. {item.name}
                                      {treatmentLabel ? ` (${treatmentLabel})` : ''}
                                      {item.deliveryMethod ? ` [${item.deliveryMethod}]` : ''}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{item.qty}</td>
                                    <td style={{ textAlign: 'right' }}>{itemUnitPrice.toFixed(2)}</td>
                                    <td style={{ textAlign: 'right' }}>{itemTotalAmount.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        );
                      })()}
                      <div className={styles.orderTotal}>
                        <span>
                          {selectedOrder.paymentStatus === 'Paid'
                            ? `${t('totalPaidVia', settings.language)} ${getPaymentMethodTranslation(selectedOrder.paymentMethod || 'CASH')}`
                            : `${t('paymentStatus', settings.language)}: ${t(selectedOrder.paymentStatus?.toLowerCase() || 'notPaid', settings.language)}`
                          }
                        </span>
                        <span>{(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.section} style={{ marginTop: '1.5rem' }}>
                    <h3>Payment Transactions & Breakdown</h3>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem' }}>
                      {orderPayments && orderPayments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          {orderPayments.map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #ECEFF1' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>
                                  {p.method} Payment
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.15rem' }}>
                                  Ref: {p.paymentReference || 'N/A'} • {formatDateTime(p.createdAt)}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>
                                  <CurrencySymbol size={11} /> {p.amount?.toFixed(2)}
                                </span>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: p.status === 'SUCCESS' ? '#10B981' : '#F59E0B', marginTop: '0.15rem' }}>
                                  {p.status}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: '#64748B' }}>Primary Payment Method:</span>
                          <strong style={{ color: '#0F172A' }}>
                            {selectedOrder.paymentMethod || 'Cash'} (Default)
                          </strong>
                        </div>
                      )}

                      {/* Summary calculations block */}
                      <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px dashed #CBD5E1', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                          <span>Total Order Amount:</span>
                          <span><CurrencySymbol size={10} /> {(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                          <span>Total Paid to Date:</span>
                          <span style={{ fontWeight: 700, color: '#10B981' }}><CurrencySymbol size={10} /> {(selectedOrder.paidAmount || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontWeight: 700 }}>
                          <span>Remaining Balance:</span>
                          <span style={{ color: selectedOrder.dueAmount > 0 ? '#EF4444' : '#10B981' }}>
                            <CurrencySymbol size={10} /> {(selectedOrder.dueAmount || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Order Summary & Status & Workflow */}
                <div className={styles.summaryCol}>
                  <div className={styles.section}>
                    <h3>Order Summary</h3>
                    {(() => {
                      const items = (() => {
                        try {
                          return typeof selectedOrder.items === 'string'
                            ? JSON.parse(selectedOrder.items || '[]')
                            : (selectedOrder.items || []);
                        } catch (e) {
                          return [];
                        }
                      })();

                      const itemsTotal = items.reduce((sum, item) => sum + ((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)), 0);
                      const taxRate = settings.isTaxEnabled ? (parseFloat(settings.taxRate || 0) / 100) : 0;

                      let computedSubtotal = 0;
                      let computedTax = 0;
                      let computedTotal = selectedOrder.totalAmount || 0;
                      let computedDiscount = 0;

                      if (settings.isTaxEnabled) {
                        computedSubtotal = computedTotal / (1 + taxRate);
                        computedTax = computedTotal - computedSubtotal;
                        if (settings.taxMethod === 'exclusive') {
                          computedDiscount = itemsTotal - computedSubtotal;
                        } else {
                          computedDiscount = itemsTotal - computedTotal;
                        }
                      } else {
                        computedSubtotal = computedTotal;
                        computedTax = 0;
                        computedDiscount = itemsTotal - computedTotal;
                      }

                      if (computedDiscount < 0.01) computedDiscount = 0;

                      return (
                        <div className={styles.summaryList}>
                          <div className={styles.summaryRow}>
                            <span>Item Total</span>
                            <span>{itemsTotal.toFixed(2)}</span>
                          </div>
                          <div className={styles.summaryRow}>
                            <span>Discount</span>
                            <span>{computedDiscount.toFixed(2)}</span>
                          </div>
                          <div className={styles.summaryRow}>
                            <span>{settings.taxName || 'Tax'} ({settings.isTaxEnabled ? settings.taxRate : 0}%)</span>
                            <span>{computedTax.toFixed(2)}</span>
                          </div>
                          <div className={`${styles.summaryRow} ${styles.summaryTotalRow}`}>
                            <span>Total Amount</span>
                            <span>{computedTotal.toFixed(2)}</span>
                          </div>
                          <div className={`${styles.summaryRow} ${styles.summaryPaidRow}`}>
                            <span>Paid Amount</span>
                            <span className={styles.paidVal}>{(selectedOrder.paidAmount || 0).toFixed(2)}</span>
                          </div>
                          <div className={`${styles.summaryRow} ${styles.summaryDueRow}`}>
                            <span>Due Amount</span>
                            <span className={selectedOrder.dueAmount > 0 ? styles.dueValRed : styles.dueValGreen}>
                              {(selectedOrder.dueAmount || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>



                  {selectedOrder.isDeleted ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginTop: '1rem', textAlign: 'left' }}>
                      <div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Workflow Status:</span>
                        <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, color: '#EF4444' }}>Deleted</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Refund Status:</span>
                        <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, color: selectedOrder.refundStatus === 'Returned' ? '#10B981' : '#F59E0B' }}>
                          {selectedOrder.refundStatus}
                        </p>
                      </div>
                      {selectedOrder.refundStatus === 'Returned' && (
                        <>
                          <div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Refund Method:</span>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, color: '#1E293B' }}>{selectedOrder.refundMethod}</p>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Returned At:</span>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, color: '#1E293B' }}>{formatDate(selectedOrder.returnedAt)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {settings.workflowEnabled && (
                        <div className={styles.section}>
                          <h3>Workflow Status</h3>
                          <div className={styles.statusSelectWrapper}>
                            <select
                              value={['Payment Pending', 'Credit', 'Pending'].includes(selectedOrder.status) ? 'Confirmed' : selectedOrder.status}
                              onChange={(e) => handleUpdateStatus(e.target.value)}
                              className={styles.statusSelect}
                            >
                              {(settings.workflowStatuses || ['Confirmed', 'Picked Up', 'Washing', 'Drying', 'Ironing', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered', 'Cancelled']).map((status) => (
                                <option key={status} value={status}>{translateStatus(status)}</option>
                              ))}
                            </select>
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      )}

                      {selectedOrder.nomodCheckoutId && (
                        <div className={styles.nomodCard}>
                          <div className={styles.nomodHeader}>
                            <div className={styles.nomodTitleGroup}>
                              <CreditCard size={15} className={styles.nomodIcon} />
                              <span className={styles.nomodTitle}>Nomod Payment</span>
                            </div>
                            <span className={`${styles.nomodBadge} ${styles[selectedOrder.nomodPaymentStatus?.toLowerCase()] || ''}`}>
                              {selectedOrder.nomodPaymentStatus || 'Pending'}
                            </span>
                          </div>

                          <div className={styles.nomodBody}>
                            {selectedOrder.nomodLinkDate && (
                              <div className={styles.nomodRow}>
                                <span className={styles.nomodLabel}>Generated:</span>
                                <span className={styles.nomodValue}>{formatDateTime(selectedOrder.nomodLinkDate)}</span>
                              </div>
                            )}
                            {selectedOrder.nomodPaymentLink && selectedOrder.nomodPaymentStatus === 'Pending' && (
                              <div className={styles.nomodRow}>
                                <span className={styles.nomodLabel}>Checkout:</span>
                                <a
                                  href={selectedOrder.nomodPaymentLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.nomodLink}
                                >
                                  Open Checkout <ExternalLink size={12} />
                                </a>
                              </div>
                            )}
                          </div>

                          <div className={styles.nomodActions}>
                            {selectedOrder.nomodPaymentStatus === 'Pending' && (
                              <button
                                type="button"
                                className={styles.nomodBtnPrimary}
                                onClick={async () => {
                                  const res = await paymentService.checkNow(selectedOrder.id, selectedOrder.nomodCheckoutId);
                                  if (res.success) {
                                    alert(`Nomod payment status is: ${res.status}`);
                                    setSelectedOrder(prev => ({ ...prev, nomodPaymentStatus: res.status, paymentStatus: res.status === 'Paid' ? 'Paid' : prev.paymentStatus }));
                                    fetchOrders();
                                  } else {
                                    alert("Failed checking status: " + res.error);
                                  }
                                }}
                              >
                                <RefreshCw size={13} /> Check Status
                              </button>
                            )}
                            {(selectedOrder.nomodPaymentStatus === 'Pending' || selectedOrder.nomodPaymentStatus === 'Expired' || selectedOrder.nomodPaymentStatus === 'Failed') && (
                              <button
                                type="button"
                                className={styles.nomodBtnSecondary}
                                onClick={() => handleResendPaymentLink(selectedOrder)}
                              >
                                <Send size={13} /> Resend Link
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className={styles.section} style={{ marginTop: '1.5rem' }}>
                    <h3>{t('statusHistory', settings.language)}</h3>
                    <div className={styles.timeline}>
                      {(() => {
                        let history = [];
                        try {
                          history = typeof selectedOrder.statusHistory === 'string'
                            ? JSON.parse(selectedOrder.statusHistory || '[]')
                            : (selectedOrder.statusHistory || []);
                        } catch (e) { console.error("Failed to parse history", e); }

                        return (Array.isArray(history) ? history : []).map((h, i) => (
                          <div key={i} className={styles.timelineItem}>
                            <div className={styles.timelineDot}></div>
                            <div className={styles.timelineContent}>
                              <p className={styles.timelineStatus}>{translateStatus(h.status) || t('unknown', settings.language)}</p>
                              <p className={styles.timelineMeta}>
                                {h.updatedBy === 'Admin Staff' ? t('adminStaff', settings.language) : h.updatedBy === 'Staff' ? t('staff', settings.language) : (h.updatedBy || t('staff', settings.language))} • {h.timestamp ? formatDateTime(h.timestamp) : t('unknown', settings.language)}
                              </p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalStickyFooter}>
              {!selectedOrder.isDeleted && (
                <>
                  <button
                    className={`${styles.footerActionBtn} ${styles.blueBtn}`}
                    onClick={() => {
                      setSelectedOrder(null);
                      setShowModal(false);
                      navigate(`/pos?editOrderId=${selectedOrder.id}`);
                    }}
                  >
                    <Edit3 size={18} /> Edit Order
                  </button>
                  <button
                    className={`${styles.footerActionBtn} ${styles.whiteBtn}`}
                    onClick={() => handleWhatsApp(selectedOrder.customerPhone || selectedOrder.phone, selectedOrder.id)}
                  >
                    <WhatsAppIcon size={18} /> Send WhatsApp Receipt
                  </button>
                  <button
                    className={`${styles.footerActionBtn} ${styles.redBtn}`}
                    onClick={() => {
                      setOrderToDelete(selectedOrder);
                      setDeleteOption('refund');
                      setDeleteReason('');
                      setShowPinModal(true);
                    }}
                  >
                    <Trash2 size={18} /> Delete Order
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Tag Printing Area */}
      {isPrintingTags && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'white', zIndex: 99999 }}>
          <DressTag order={selectedOrder} />
        </div>
      )}

      {/* Payment Selection Modal */}
      {showPayModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.statusModal} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{t('confirmPayment', settings.language)}</h2>
              <X size={24} className={styles.closeBtn} onClick={() => setShowPayModal(false)} />
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: '1.5rem', color: '#64748B' }}>
                {(() => {
                  const msg = t('confirmPaymentMsg', settings.language);
                  const parts = msg.split('{id}');
                  if (parts.length === 2) {
                    return (
                      <>
                        {parts[0]}
                        <strong>{selectedOrder?.orderId || selectedOrder?.id}</strong>
                        {parts[1]}
                      </>
                    );
                  }
                  return msg;
                })()}
              </p>

              <div className={styles.payOptionGrid}>
                <div
                  className={`${styles.payOption} ${payMethod === 'Cash' ? styles.payOptionActive : ''}`}
                  onClick={() => setPayMethod('Cash')}
                >
                  <Wallet size={24} />
                  <span>{t('cashaccount', settings.language)}</span>
                </div>
                <div
                  className={`${styles.payOption} ${payMethod === 'Card' ? styles.payOptionActive : ''}`}
                  onClick={() => setPayMethod('Card')}
                >
                  <CreditCard size={24} />
                  <span>{t('card', settings.language)}</span>
                </div>
                <div
                  className={`${styles.payOption} ${payMethod === 'Multipayment' ? styles.payOptionActive : ''}`}
                  onClick={() => setPayMethod('Multipayment')}
                >
                  <Layers size={24} />
                  <span>Multipayment</span>
                </div>
              </div>

              {payMethod === 'Multipayment' && (
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Cash Amount</label>
                    <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} style={{ width: '120px', padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Card Amount</label>
                    <input type="number" value={cardAmount} onChange={e => setCardAmount(e.target.value)} style={{ width: '120px', padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>UPI Amount</label>
                    <input type="number" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} style={{ width: '120px', padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Bank Transfer</label>
                    <input type="number" value={bankAmount} onChange={e => setBankAmount(e.target.value)} style={{ width: '120px', padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px' }} />
                  </div>
                </div>
              )}
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFBEB', padding: '1rem', borderRadius: '8px', border: '1px solid #FEF08A' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400E' }}>Discount / Waive</label>
                <input type="number" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} placeholder="0.00" style={{ width: '120px', padding: '0.4rem', border: '1px solid #FDE047', borderRadius: '6px' }} />
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                <button
                  className={styles.secondaryBtn}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowPayModal(false);
                    if (originalPayStatus) {
                      setSelectedOrder(prev => ({ ...prev, paymentStatus: originalPayStatus }));
                    }
                  }}
                >
                  {t('cancel', settings.language)}
                </button>
                <button className={styles.printBtn} style={{ flex: 1.5 }} onClick={() => confirmPaidStatus(false)}>
                  {t('recordPayment', settings.language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* PIN Verification Modal */}
      {showPinModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.statusModal} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ backgroundColor: '#EF4444' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', margin: 0 }}>
                <Trash2 size={20} /> Confirm Deletion
              </h2>
              <X size={24} className={styles.closeBtn} onClick={() => { setShowPinModal(false); setPinValue(''); setPinError(''); }} />
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: '1.2rem', color: '#64748B', fontSize: '0.9rem', lineHeight: '1.4' }}>
                You are deleting order <strong>{orderToDelete?.id}</strong>. This action is permanent and cannot be undone.
              </p>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                Enter Manager/Admin Access PIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={pinValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ''); // only digits
                  setPinValue(val);
                }}
                placeholder="••••"
                className={`${styles.pinInput} ${pinError ? styles.pinInputError : ''}`}
                autoFocus
              />

              {orderToDelete && (orderToDelete.paidAmount > 0 || ['Paid', 'Partial'].includes(orderToDelete.paymentStatus)) ? (
                <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Choose Action for Payment (<CurrencySymbol size={11} />{(orderToDelete.paidAmount || 0).toFixed(2)}):</span>

                  {/* Option 1: Refund */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="radio"
                        name="deleteOption"
                        value="refund"
                        checked={deleteOption === 'refund'}
                        onChange={() => setDeleteOption('refund')}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      Refund Customer
                    </label>

                    {deleteOption === 'refund' && (
                      <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>Select Refund Account:</span>
                        <div style={{ display: 'flex', gap: '1.25rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                            <input
                              type="radio"
                              name="refundMethod"
                              value="Cash"
                              checked={refundMethod === 'Cash'}
                              onChange={() => setRefundMethod('Cash')}
                              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                            />
                            Cash Account
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                            <input
                              type="radio"
                              name="refundMethod"
                              value="Bank"
                              checked={refundMethod === 'Bank'}
                              onChange={() => setRefundMethod('Bank')}
                              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                            />
                            Bank Account
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Option 2: Convert to Advance */}
                  {orderToDelete.customerId && orderToDelete.customerId !== 'Walk-in' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="radio"
                          name="deleteOption"
                          value="advance"
                          checked={deleteOption === 'advance'}
                          onChange={() => setDeleteOption('advance')}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        Convert Payment to Advance
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ margin: '1rem 0', background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Status:</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', marginTop: '0.25rem' }}>
                    Not Paid (No transactions recorded)
                  </div>
                </div>
              )}

              {pinError && (
                <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 500, textAlign: 'center' }}>
                  {pinError}
                </p>
              )}

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                <button
                  className={styles.secondaryBtn}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowPinModal(false);
                    setPinValue('');
                    setPinError('');
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className={styles.deleteConfirmBtn}
                  style={{ flex: 1.5 }}
                  onClick={handleDeleteOrder}
                  disabled={isDeleting || pinValue.length < 4}
                >
                  {isDeleting ? 'Deleting...' : 'Authorize & Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Limit Warning Modal */}
      {showCreditWarning && creditWarningDetails && (
        <div className={styles.modalOverlay} onClick={handleCancelOverride}>
          <div className={styles.statusModal} style={{ maxWidth: '450px', borderRadius: '24px', background: 'white', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <AlertTriangle size={24} color="#EF4444" style={{ marginTop: '2px' }} />
              <div>
                <h2 style={{ color: '#EF4444', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Credit Limit Exceeded</h2>
                <p style={{ color: '#EF4444', margin: '2px 0 0 0', fontSize: '0.85rem', fontWeight: 500, opacity: 0.9 }}>This customer has exceeded their credit threshold.</p>
              </div>
            </div>
            <form onSubmit={handleVerifyManagerPin}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem', color: '#64748B', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>Customer Name:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{creditWarningDetails.customerName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>Credit Limit:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.creditLimit.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>Outstanding Balance:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.currentOutstanding.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>Credit Balance Increase:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.orderAmount.toFixed(2)}</span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.25rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>New Outstanding Balance:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.newOutstanding.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444', fontWeight: 700 }}>
                  <span>Exceeded Amount:</span>
                  <span>{settings.currencySymbol} {creditWarningDetails.exceededAmount.toFixed(2)}</span>
                </div>
              </div>

              {settings.enableManagerOverride ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>ENTER MANAGER SECURE PIN TO APPROVE</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '0.75rem 1rem', background: '#F8FAFC' }}>
                    <Lock size={18} color="#94A3B8" />
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={managerPinValue}
                      onChange={(e) => setManagerPinValue(e.target.value.replace(/\D/g, ''))}
                      style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', border: 'none', background: 'transparent', outline: 'none', width: '100%', color: '#1E293B' }}
                      autoFocus
                    />
                  </div>
                  {managerPinError && (
                    <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>{managerPinError}</p>
                  )}
                </div>
              ) : (
                <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '12px', padding: '0.75rem 1rem', color: '#C53030', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  <AlertCircle size={18} />
                  <span>Credit Limit Protection is active and Manager Override is disabled.</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={handleCancelOverride}
                  style={{ background: 'none', border: 'none', color: '#64748B', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', padding: '0.5rem 0' }}
                >
                  Cancel
                </button>
                {creditWarningDetails.overrideAllowed && settings.enableManagerOverride && (
                  <button
                    type="submit"
                    style={{ background: '#D97706', color: 'white', border: 'none', borderRadius: '10px', padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.2)' }}
                  >
                    Approve Override
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {nomodLinkModal.show && (
        <div className={styles.modalOverlay} style={{ zIndex: 9999 }}>
          <div className={styles.statusModal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Nomod Payment Link</h2>
              <X size={24} className={styles.closeBtn} onClick={() => setNomodLinkModal({ show: false, url: '', linkId: '', amount: 0 })} />
            </div>

            <div className={styles.modalBody} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 800 }}>PAYMENT AMOUNT</span>
                <h1 style={{ margin: '0.25rem 0 0 0', color: '#1E293B', fontSize: '2rem', fontWeight: 800 }}>
                  {settings.currencySymbol || 'AED'} {nomodLinkModal.amount.toFixed(2)}
                </h1>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                <div style={{ padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <QRCodeCanvas
                    id="nomod-order-qr-canvas"
                    value={nomodLinkModal.url}
                    size={160}
                    level="H"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={styles.saveBtn}
                    style={{ background: '#475569', color: 'white', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      const canvas = document.getElementById('nomod-order-qr-canvas');
                      if (canvas) {
                        if (window.electronAPI?.printHtml) {
                          window.electronAPI.printHtml({
                            html: `<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><img src="${canvas.toDataURL()}" style="width:300px;height:300px;"/></div>`,
                            css: '',
                            printerName: settings.billingPrinter,
                            silent: settings.silentPrinting !== false
                          });
                        } else {
                          const win = window.open('', '', 'width=400,height=400');
                          win.document.write(`<html><body style="display:flex;justify-content:center;align-items:center;height:90vh;"><img id="qr-img" src="${canvas.toDataURL()}" style="width:300px;height:300px;"/>
                          <script>
                            document.getElementById('qr-img').onload = function() {
                              window.print();
                              window.close();
                            };
                          </script>
                          </body></html>`);
                          win.document.close();
                        }
                      }
                    }}
                  >
                    Print QR
                  </button>
                  <button
                    type="button"
                    className={styles.saveBtn}
                    style={{ background: '#475569', color: 'white', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      const canvas = document.getElementById('nomod-order-qr-canvas');
                      if (canvas) {
                        const a = document.createElement('a');
                        a.download = `QR-${nomodLinkModal.linkId}.png`;
                        a.href = canvas.toDataURL();
                        a.click();
                      }
                    }}
                  >
                    Save QR
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Nomod Checkout URL</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="text"
                    readOnly
                    className={styles.pinInput}
                    value={nomodLinkModal.url}
                    style={{ flex: 1, background: '#F1F5F9', fontSize: '0.9rem', padding: '0.5rem' }}
                  />
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(nomodLinkModal.url);
                      alert("Payment Link copied to clipboard!");
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  style={{ flex: '1 1 45%', padding: '0.75rem' }}
                  onClick={() => {
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(nomodLinkModal.url);
                    } else {
                      window.open(nomodLinkModal.url, '_blank');
                    }
                  }}
                >
                  Open Link
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  style={{ flex: '1 1 45%', padding: '0.75rem' }}
                  onClick={() => {
                    const text = `Please pay ${settings.currencySymbol || 'AED'} ${nomodLinkModal.amount.toFixed(2)} for your laundry order using this link: ${nomodLinkModal.url}`;
                    const phone = selectedOrder?.customerPhone || selectedOrder?.phone || '';
                    let cleanPhone = phone.toString().replace(/\D/g, '');
                    let finalPhone = cleanPhone;
                    if (cleanPhone && !phone.toString().trim().startsWith('+')) {
                      const countryCode = settings.waCountryCode || '971';
                      const cleanCountryCode = countryCode.replace(/\D/g, '');
                      if (cleanCountryCode && !finalPhone.startsWith(cleanCountryCode)) {
                        finalPhone = cleanCountryCode + finalPhone;
                      }
                    }
                    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(url);
                    } else {
                      window.open(url, '_blank');
                    }
                  }}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  style={{ flex: '1 1 45%', padding: '0.75rem' }}
                  onClick={() => {
                    const smsUrl = `sms:${selectedOrder?.customerPhone || selectedOrder?.phone || ''}?body=${encodeURIComponent(`Please pay ${settings.currencySymbol || 'AED'} ${nomodLinkModal.amount.toFixed(2)} for your laundry order: ${nomodLinkModal.url}`)}`;
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(smsUrl);
                    } else {
                      window.open(smsUrl, '_blank');
                    }
                  }}
                >
                  SMS
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  style={{ flex: '1 1 45%', padding: '0.75rem' }}
                  onClick={() => {
                    const emailUrl = `mailto:${selectedOrder?.email || ''}?subject=Laundry Order Payment&body=Please pay ${settings.currencySymbol || 'AED'} ${nomodLinkModal.amount.toFixed(2)} using this link: ${nomodLinkModal.url}`;
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(emailUrl);
                    } else {
                      window.open(emailUrl, '_blank');
                    }
                  }}
                >
                  Email
                </button>
              </div>
            </div>
            <div className={styles.modalFooter} style={{ display: 'flex', gap: '1rem', padding: '1rem 1.5rem' }}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setNomodLinkModal({ show: false, url: '', linkId: '', amount: 0 })}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.printBtn}
                onClick={async () => {
                  if (window.electronAPI?.dbQuery) {
                    await window.electronAPI.dbQuery(
                      `INSERT INTO payment_links (id, customerId, customerName, description, amount, channel, date, status, url, checkoutId) 
                       VALUES (?, ?, ?, ?, ?, 'Nomod', ?, 'Pending', ?, ?)`,
                      [
                        nomodLinkModal.linkId,
                        selectedOrder.customerId || 'Walk-in',
                        selectedOrder.customerName || 'Walk-in Customer',
                        `Order #${settings.invoicePrefix || ''}${selectedOrder.id}`,
                        nomodLinkModal.amount,
                        getLocalDateTime(),
                        nomodLinkModal.url,
                        nomodLinkModal.linkId
                      ]
                    );

                    await window.electronAPI.dbQuery(
                      `UPDATE orders SET nomodCheckoutId = ?, nomodPaymentLink = ?, nomodPaymentStatus = 'Pending', isSynced = 0, updatedAt = ? 
                       WHERE id = ?`,
                      [nomodLinkModal.linkId, nomodLinkModal.url, getLocalISOString(), selectedOrder.id]
                    );
                  }

                  setNomodLinkModal({ show: false, url: '', linkId: '', amount: 0 });
                  alert("Nomod payment link saved successfully. The system will verify status automatically in the background.");

                  paymentService.startTracking(selectedOrder.id, nomodLinkModal.linkId);
                  fetchOrders();
                }}
                style={{ flex: 1.5 }}
              >
                Confirm Payment & Save
              </button>
            </div>
          </div>
        </div>
      )}
      {pdfToast && (
        <>
          <style>{`
            @keyframes toastSlideIn {
              0% { transform: translateX(120%) scale(0.9); opacity: 0; }
              70% { transform: translateX(-10px) scale(1.02); opacity: 1; }
              100% { transform: translateX(0) scale(1); opacity: 1; }
            }
            @keyframes toastProgress {
              0% { width: 100%; }
              100% { width: 0%; }
            }
            .premium-toast {
              position: fixed;
              top: 24px;
              right: 24px;
              background: rgba(15, 23, 42, 0.95);
              backdrop-filter: blur(8px);
              color: white;
              padding: 1rem 1.5rem;
              border-radius: 12px;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
              display: flex;
              align-items: center;
              gap: 16px;
              z-index: 999999;
              font-family: 'Inter', sans-serif;
              max-width: 400px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-left: 5px solid ${pdfToast.success ? '#10B981' : '#EF4444'};
              animation: toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              overflow: hidden;
            }
            .premium-toast-progress {
              position: absolute;
              bottom: 0;
              left: 0;
              height: 3px;
              background: ${pdfToast.success ? '#10B981' : '#EF4444'};
              animation: toastProgress ${pdfToast.success ? '5s' : '7s'} linear forwards;
            }
          `}</style>
          <div className="premium-toast">
            {pdfToast.success ? (
              <CheckCircle size={22} style={{ color: '#10B981', flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={22} style={{ color: '#EF4444', flexShrink: 0 }} />
            )}
            <div style={{ display: 'flex', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.01em' }}>
                {pdfToast.success ? 'Invoice PDF Saved' : 'Download Failed'}
              </span>
              <span style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '2px', wordBreak: 'break-all', fontWeight: 400 }}>
                {pdfToast.success ? pdfToast.filePath : pdfToast.error}
              </span>
            </div>
            <div className="premium-toast-progress" />
          </div>
        </>
      )}

    </div>
  );
}

function KPIItem({ label, value, icon, iconBg, subText }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIcon} style={{ background: iconBg }}>{icon}</div>
      <div className={styles.kpiInfo}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>{value}</span>
        {subText && <span className={styles.kpiSub}>{subText}</span>}
      </div>
    </div>
  );
}



