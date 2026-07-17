import React, { useState, useEffect } from 'react';
import {
  Search, Filter, ChevronLeft, ChevronRight, Calendar,
  Clock, Package, CheckCircle, AlertCircle, ChevronDown,
  X, Printer, CreditCard, Wallet, User, History, QrCode, Phone, DollarSign, Truck, Trash2, AlertTriangle, Info, Lock, Edit3, Layers,
  RefreshCw, Send
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
    if (method === 'Advance' || method.toUpperCase() === 'ADVANCE') return 'Advance';
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
              orders.paymentStatus, orders.status, orders.paymentMethod, 
              orders.items, orders.statusHistory, orders.expectedDeliveryDate, orders.specialInstructions, orders.branchId,
              orders.createdAt, orders.updatedAt, orders.isSynced,
              orders.nomodPaymentStatus, orders.nomodCheckoutId,
              payment_links.date AS nomodLinkDate, payment_links.url AS nomodLinkUrl,
              0 AS isDeleted, NULL AS refundStatus, NULL AS refundMethod, NULL AS returnedAt, NULL AS payments
            FROM orders 
            LEFT JOIN customers ON orders.customerId = customers.id
            LEFT JOIN payment_links ON orders.nomodCheckoutId = payment_links.checkoutId

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
        // Fallback to checking active manager PINs on the backend
        try {
          const verifyRes = await axios.post(`${API_BASE}/auth/verify-manager-pin`, { pin: pinValue });
          if (verifyRes.data.valid) {
            pinOwner = `Manager ${verifyRes.data.managerName}`;
          }
        } catch (apiErr) {
          console.warn('Backend PIN check failed or offline:', apiErr.message);
          // If offline and check fails, and it didn't match the local settings PIN, reject
          setPinError('Invalid Manager PIN / Offline');
          setIsDeleting(false);
          return;
        }
      }

      if (!pinOwner) {
        setPinError('Invalid Manager PIN');
        setIsDeleting(false);
        return;
      }

      // PIN is valid! Delete the order.
      const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
      const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
      const currentLoggedInUser = `${userRole}: ${userSession.name || userSession.username || 'User'}`;

      const refundImmediately = deleteOption === 'refund';
      let linkedPayments = [];

      // A. Delete locally from SQLite (if electron app)
      if (window.electronAPI?.dbQuery) {
        // 1. Before deleting payments, query linked payment details so we can save them in audit log
        //    and use them to remove corresponding account_transactions
        const linkedPaymentsRes = await window.electronAPI.dbQuery(
          'SELECT id, amount, createdAt, method FROM payments WHERE orderId = ?',
          [orderToDelete.id]
        );
        linkedPayments = linkedPaymentsRes.success ? linkedPaymentsRes.data : [];

        const allocationsRes = await window.electronAPI.dbQuery(
          'SELECT paymentId, amountUsed FROM advance_allocations WHERE orderId = ?',
          [orderToDelete.id]
        );
        const allocationsUsed = allocationsRes.success ? allocationsRes.data : [];

        // 2. Insert into deleted_orders audit log
        const isPaid = orderToDelete.paidAmount > 0 || ['Paid', 'Partial'].includes(orderToDelete.paymentStatus);
        const initialReturnStatus = isPaid
          ? (refundImmediately ? 'Returned' : 'Converted to Advance')
          : 'N/A';
        const initialRefundStatus = isPaid
          ? (refundImmediately ? 'Returned' : 'Converted to Advance')
          : 'Deleted';
        const refundMethodVal = isPaid && refundImmediately ? refundMethod : null;
        const returnedAtVal = isPaid && refundImmediately ? getLocalISOString() : null;

        await window.electronAPI.dbQuery(
          `INSERT OR REPLACE INTO deleted_orders (id, shopId, billNumber, customerId, customerName, customerPhone, totalAmount, items, createdAt, deletedAt, deletedBy, originalPaymentStatus, paidAmount, returnStatus, approvedBy, originalPaymentMethod, payments, refundMethod, returnedAt, refundStatus) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderToDelete.id,
            orderToDelete.shopId || DEFAULT_SHOP_ID || 'SHOP_01',
            orderToDelete.billNumber || '',
            orderToDelete.customerId || '',
            orderToDelete.customerName || '',
            orderToDelete.customerPhone || orderToDelete.phone || '',
            orderToDelete.totalAmount || 0,
            typeof orderToDelete.items === 'string' ? orderToDelete.items : JSON.stringify(orderToDelete.items || []),
            orderToDelete.createdAt || getLocalISOString(),
            getLocalISOString(),
            currentLoggedInUser,
            orderToDelete.paymentStatus || 'Pending',
            orderToDelete.paidAmount || 0,
            initialReturnStatus,
            pinOwner,
            orderToDelete.paymentMethod || 'CASH',
            JSON.stringify(linkedPayments),
            refundMethodVal,
            returnedAtVal,
            initialRefundStatus
          ]
        );

        // 3. Delete associated payments
        await window.electronAPI.dbQuery('DELETE FROM payments WHERE orderId = ?', [orderToDelete.id]);

        // 4. Delete the order itself
        await window.electronAPI.dbQuery('DELETE FROM orders WHERE id = ?', [orderToDelete.id]);

        // 4b. If refunding immediately, delete or reduce allocated payments so they don't become available advance
        if (refundImmediately) {
          for (const alloc of allocationsUsed) {
            const payRes = await window.electronAPI.dbQuery('SELECT amount FROM payments WHERE id = ?', [alloc.paymentId]);
            if (payRes.success && payRes.data.length > 0) {
              const currentAmt = payRes.data[0].amount || 0;
              const newAmt = Math.max(0, currentAmt - alloc.amountUsed);
              if (newAmt <= 0.01) {
                await window.electronAPI.dbQuery('DELETE FROM payments WHERE id = ?', [alloc.paymentId]);
              } else {
                await window.electronAPI.dbQuery('UPDATE payments SET amount = ?, isSynced = 0, updatedAt = ? WHERE id = ?', [newAmt, getLocalISOString(), alloc.paymentId]);
              }
            }
          }
        }

        // 4c. Delete advance allocations associated with this order
        await window.electronAPI.dbQuery('DELETE FROM advance_allocations WHERE orderId = ?', [orderToDelete.id]);

        // 5. Process refund or convert to advance
        const paidAmt = orderToDelete.paidAmount || 0;

        if (isPaid && paidAmt > 0) {
          const allocSum = allocationsUsed.reduce((sum, a) => sum + (a.amountUsed || 0), 0);
          const cashPaidAmt = Math.max(0, paidAmt - allocSum);

          if (refundImmediately) {
            if (cashPaidAmt > 0) {
              const refundTxnId = `TXN-RETURN-${Date.now()}`;
              const _now1 = new Date();
              const txnTimestamp = `${_now1.getFullYear()}-${String(_now1.getMonth() + 1).padStart(2, '0')}-${String(_now1.getDate()).padStart(2, '0')} ${String(_now1.getHours()).padStart(2, '0')}:${String(_now1.getMinutes()).padStart(2, '0')}`;
              
              const creatorName = userSession.name || userSession.username || 'System';
              const creatorId = userSession.id || 'SYSTEM';
              const creatorRole = userSession.role || 'system';

              await window.electronAPI.dbQuery(
                `INSERT INTO account_transactions 
                 (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  refundTxnId,
                  orderToDelete.shopId || DEFAULT_SHOP_ID || 'SHOP_01',
                  refundMethod === 'Bank' ? 'BANK' : 'CASH',
                  'EXPENSE',
                  'Return',
                  cashPaidAmt,
                  `Return - Order ${orderToDelete.id.startsWith('#') ? '' : '#'}${orderToDelete.id}`,
                  txnTimestamp,
                  0,
                  getLocalISOString(),
                  'Zap',
                  refundMethod === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null,
                  creatorName || null,
                  creatorId || null,
                  creatorRole || null
                ]
              );
            }
          } else if (orderToDelete.customerId && orderToDelete.customerId !== 'Walk-in') {
            // No refund immediately: Convert ONLY the cash portion to unlinked Available Advance.
            if (cashPaidAmt > 0) {
              const newAdvRef = await window.electronAPI.getNextPaymentReference('ADV');
              const newAdvId = `ADV-CONV-${Date.now()}`;
              await window.electronAPI.dbQuery(
                `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
                 VALUES (?, ?, NULL, ?, ?, 'Refund Advance', 'SUCCESS', ?, 0, ?, ?)`,
                [newAdvId, orderToDelete.customerId || null, orderToDelete.shopId || DEFAULT_SHOP_ID || null, cashPaidAmt, getLocalISOString(), getLocalISOString(), newAdvRef || null]
              );
            }
          }
        }

        // 6. Run data healer to reconcile any remaining inconsistencies
        await window.electronAPI.runDataHealer();
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
      alert(`Order ${orderToDelete.id} and all its associated payments/transactions deleted successfully (authorized by ${pinOwner}).`);
      window.location.reload();
    } catch (err) {
      console.error('Failed to delete order:', err);
      setPinError('An error occurred during deletion');
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
    if (due > 0 && orderMatch && settings.enablePaymentLinks !== false) {
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
    <div className={styles.ordersPage}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 0.75rem', height: '40px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 800 }}>SORT:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 700, color: '#1E293B', cursor: 'pointer', outline: 'none' }}
            >
              <option value="date">Latest Order</option>
              <option value="payment">Latest Payment</option>
            </select>
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
              <CurrencySymbol size={18} /> {totalAmount.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.length} {t('invoices', settings.language)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.paidCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#ECFDF5' }}><CheckCircle size={22} color="#10B981" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('paid', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#10B981' }}>
              <CurrencySymbol size={18} /> {totalPaid.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.filter(o => (o.dueAmount === 0 || o.dueAmount === null) && o.totalAmount > 0).length} {t('invoices', settings.language)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.pendingCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#FFF7ED' }}><Clock size={22} color="#F97316" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('pending', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#F97316' }}>
              <CurrencySymbol size={18} /> {totalPending.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.filter(o => o.dueAmount > 0).length} {t('invoices', settings.language)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.overdueCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#FEF2F2' }}><AlertCircle size={22} color="#EF4444" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('overdue', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#EF4444' }}>
              <CurrencySymbol size={18} /> {overdueAmount.toFixed(2)}
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
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                style={{ border: '1px solid #E2E8F0', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 600, outline: 'none', fontSize: '0.85rem' }}
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="This Month">This Month</option>
                <option value="This Year">This Year</option>
                <option value="Custom">Custom Range</option>
              </select>

              {dateRange === 'Custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{ border: '1px solid #E2E8F0', padding: '0.35rem 0.5rem', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{ border: '1px solid #E2E8F0', padding: '0.35rem 0.5rem', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
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
                <th>{t('date', settings.language)}</th>
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
                    <td className={styles.orderIdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div>
                          <span className={styles.idText}>{settings.invoicePrefix || ''}{order.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className={styles.dateText}>{formatDateTime(order.createdAt)}</td>
                    <td>
                      <div className={styles.custCell}>
                        <span className={styles.custName}>
                          {order.customerName || (order.customerId === 'Walk-in' ? t('walkInCustomer', settings.language) : order.customerId)}
                        </span>
                        <div className={styles.custPhoneRow}>
                          <Phone size={12} color="#2563EB" />
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
                    <td className={styles.amountText}><CurrencySymbol size={14} /> {order.totalAmount?.toFixed(2)}</td>
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
                              } catch (e) {}
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
              <div>
                <h2>{t('order', settings.language)} {settings.invoicePrefix || ''}{selectedOrder.orderId || selectedOrder.id}</h2>
                <p>{t('createdOn', settings.language)} {formatDateTime(selectedOrder.createdAt)}</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setSelectedOrder(null)} />
            </div>

            <div className={styles.modalContent}>
              <div className={styles.detailsGrid}>
                {/* Left: Info */}
                <div className={styles.infoCol}>
                  <div className={styles.section}>
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
                          <button
                            className={styles.waBtnMini}
                            onClick={() => handleWhatsApp(selectedOrder.customerPhone || selectedOrder.phone, selectedOrder.id)}
                          >
                            <WhatsAppIcon size={12} /> {t('whatsapp', settings.language)}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedOrder.expectedDeliveryDate && (
                    <div className={`${styles.section} ${styles.expectedDeliverySection}`}>
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

                        return (Array.isArray(items) ? items : []).map((item, i) => {
                          // Build treatment label from types array or fallback to type string
                          let treatmentLabel = '';
                          if (item.types && Array.isArray(item.types) && item.types.length > 0) {
                            treatmentLabel = item.types.map(tp => tp.name).join(' + ');
                          } else if (item.type) {
                            treatmentLabel = item.type;
                          }
                          return (
                            <div key={i} className={styles.orderItem}>
                              <span>{item.qty} x {item.name}{treatmentLabel ? ` (${treatmentLabel})` : ''}{item.deliveryMethod ? ` [${item.deliveryMethod}]` : ''}</span>
                              <span><CurrencySymbol size={12} /> {((item.price || 0) * (item.qty || 1)).toFixed(2)}</span>
                            </div>
                          );
                        });
                      })()}
                      <div className={styles.orderTotal}>
                        <span>
                          {selectedOrder.paymentStatus === 'Paid'
                            ? `${t('totalPaidVia', settings.language)} ${getPaymentMethodTranslation(selectedOrder.paymentMethod || 'CASH')}`
                            : `${t('paymentStatus', settings.language)}: ${t(selectedOrder.paymentStatus?.toLowerCase() || 'notPaid', settings.language)}`
                          }
                        </span>
                        <span><CurrencySymbol size={14} /> {(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.section}>
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

                {/* Right: Actions & QR */}
                <div className={styles.actionCol}>

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
                        <div className={styles.statusAction}>
                          <label>{t('workflowStatus', settings.language)}</label>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginTop: '1rem', textAlign: 'left' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CreditCard size={14} /> Nomod Payment Link
                          </span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.85rem', color: '#475569' }}>Nomod Status:</span>
                            <span style={{ 
                              fontWeight: 'bold', 
                              fontSize: '0.85rem',
                              color: selectedOrder.nomodPaymentStatus === 'Paid' ? '#16A34A' : (selectedOrder.nomodPaymentStatus === 'Pending' ? '#2563EB' : '#DC2626')
                            }}>
                              {selectedOrder.nomodPaymentStatus}
                            </span>
                          </div>
                          {selectedOrder.nomodLinkDate && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Generated:</span>
                              <span style={{ fontSize: '0.8rem', color: '#1E293B' }}>{formatDateTime(selectedOrder.nomodLinkDate)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '0.4rem' }}>
                            {selectedOrder.nomodPaymentStatus === 'Pending' && (
                              <button
                                type="button"
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
                                style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                Check Status
                              </button>
                            )}
                            {(selectedOrder.nomodPaymentStatus === 'Pending' || selectedOrder.nomodPaymentStatus === 'Expired' || selectedOrder.nomodPaymentStatus === 'Failed') && (
                              <button
                                type="button"
                                onClick={() => handleResendPaymentLink(selectedOrder)}
                                style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', background: '#EC4899', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                Resend Link
                              </button>
                            )}
                          </div>
                        </div>
                      )} </>
                  )}

                  <div className={styles.actionBtns}>
                    <button
                      className={styles.printBtn}
                      onClick={() => handlePrint(selectedOrder.id)}
                    >
                      <Printer size={18} /> {t('printReceipt', settings.language)}
                    </button>
                    {!selectedOrder.isDeleted && (
                      <>
                        <button
                          className={styles.tagBtn}
                          style={{ background: '#4F46E5', color: 'white' }}
                          onClick={() => {
                            setSelectedOrder(null);
                            setShowModal(false);
                            navigate(`/pos?editOrderId=${selectedOrder.id}`);
                          }}
                        >
                          <Edit3 size={18} /> Edit Order
                        </button>
                        <button
                          className={styles.tagBtn}
                          onClick={handlePrintTags}
                        >
                          <QrCode size={18} /> {t('printGarmentTags', settings.language)}
                        </button>
                        <button
                          className={`${styles.tagBtn} ${styles.deleteBtn}`}
                          onClick={() => {
                            setOrderToDelete(selectedOrder);
                            setDeleteOption('refund');
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
        <div className={styles.modalOverlay} onClick={() => {
          setShowPayModal(false);
          if (originalPayStatus) {
            setSelectedOrder(prev => ({ ...prev, paymentStatus: originalPayStatus }));
          }
        }}>
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
                  className={`${styles.payOption} ${payMethod === 'UPI' ? styles.payOptionActive : ''}`}
                  onClick={() => setPayMethod('UPI')}
                >
                  <QrCode size={24} />
                  <span>{t('upi', settings.language)}</span>
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
        <div className={styles.modalOverlay} onClick={() => { setShowPinModal(false); setPinValue(''); setPinError(''); }}>
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
          <div className={`${styles.modal} ${styles.tempModal}`} style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#FEF2F2', borderBottom: '1px solid #FEE2E2' }}>
              <div className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={24} color="#EF4444" />
                <div>
                  <h2 style={{ color: '#991B1B', margin: 0 }}>Credit Limit Exceeded</h2>
                  <p style={{ color: '#B91C1C', margin: 0, fontSize: '0.8rem' }}>This customer has exceeded their credit threshold.</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleVerifyManagerPin}>
              <div className={styles.modalBody} style={{ padding: '1.5rem' }}>
                <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1rem', border: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Customer Name:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}>{creditWarningDetails.customerName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Credit Limit:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.creditLimit.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Outstanding Balance:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.currentOutstanding.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Credit Balance Increase:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.orderAmount.toFixed(2)}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.5rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>New Outstanding Balance:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.newOutstanding.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444', fontWeight: 700 }}>
                    <span>Exceeded Amount:</span>
                    <span>{settings.currencySymbol} {creditWarningDetails.exceededAmount.toFixed(2)}</span>
                  </div>
                </div>

                {settings.enableManagerOverride ? (
                  <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>ENTER MANAGER SECURE PIN TO APPROVE</label>
                    <div className={styles.posInputWrapper} style={{ marginTop: '0.5rem' }}>
                      <Lock size={18} />
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="Enter 4-Digit PIN"
                        value={managerPinValue}
                        onChange={(e) => setManagerPinValue(e.target.value.replace(/\D/g, ''))}
                        style={{ fontSize: '1.25rem', letterSpacing: '0.25rem' }}
                        autoFocus
                      />
                    </div>
                    {managerPinError && (
                      <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>{managerPinError}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '12px', padding: '0.75rem 1rem', color: '#C53030', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <AlertCircle size={18} />
                    <span>Credit Limit Protection is active and Manager Override is disabled.</span>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter} style={{ display: 'flex', gap: '1rem', padding: '1rem 1.5rem' }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleCancelOverride}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                {creditWarningDetails.overrideAllowed && settings.enableManagerOverride && (
                  <button
                    type="submit"
                    className={styles.saveBtn}
                    style={{ flex: 1, background: '#D97706', color: 'white' }}
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



