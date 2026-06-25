import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, ChevronLeft, ChevronRight, Calendar,
  Clock, Package, CheckCircle, AlertCircle, ChevronDown, 
  X, Printer, CreditCard, Wallet, User, History, QrCode, Phone, DollarSign, Truck, Trash2, AlertTriangle, Info, Lock, Edit3
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import WhatsAppIcon from '../components/WhatsAppIcon';
import Pagination from '../components/Pagination';
import { QRCodeSVG } from 'qrcode.react';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID, API_BASE_URL } from '../constants';
import { t } from '../utils/translations';
import { getLocalDateBounds, isWithinBounds } from '../utils/dateFilters';
import { getLocalISOString, getLocalDateTime } from '../utils/dateUtils';
import CurrencySymbol from '../components/CurrencySymbol';
import DressTag from '../components/DressTag';
import styles from './Orders.module.css';

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
  'Delivered': styles.statusDelivered,
  'Cancelled': styles.statusCancelled
};

export default function Orders({ isPendingView = false }) {
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
    } catch(e) {
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
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingSubFilter, setPendingSubFilter] = useState('All'); // 'All', 'Pending', 'Overdue'
  const [workflowFilter, setWorkflowFilter] = useState('All'); // 'All', 'Confirmed', 'Processing', 'Ready', 'Delivered', 'Cancelled'
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
  const [refundImmediately, setRefundImmediately] = useState(true);
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
  }, [searchTerm, isPendingView, pendingSubFilter, workflowFilter, dateRange, customStart, customEnd]);

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

    if (netIncrease > 0) {
      const custRes = await window.electronAPI.dbQuery(
        'SELECT balance, creditLimit, name FROM customers WHERE id = ?',
        [selectedOrder.customerId]
      );

      if (custRes.success && custRes.data.length > 0) {
        const customer = custRes.data[0];
        const currentOutstanding = customer.balance || 0;
        const creditLimit = customer.creditLimit !== undefined && customer.creditLimit !== null && customer.creditLimit !== 0
          ? customer.creditLimit 
          : (settings.defaultCreditLimit ?? 500);
        
        const newOutstanding = currentOutstanding + netIncrease;

        // Block if ALREADY at/over limit OR if the change would exceed limit
        if (currentOutstanding >= creditLimit || newOutstanding > creditLimit) {
          const exceededAmount = Math.max(0, newOutstanding - creditLimit);
          const overrideAllowed = true;

          setCreditWarningDetails({
            customerName: customer.name,
            creditLimit,
            currentOutstanding,
            orderAmount: netIncrease,
            newOutstanding,
            exceededAmount,
            overrideAllowed
          });
          setPendingPayStatus(newPayStatus);
          setShowCreditWarning(true);
          return true; // blocked
        }
      }
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
    if (method === 'Cash' || method.toUpperCase() === 'CASH') return t('cashaccount', settings.language);
    if (method === 'Bank' || method.toUpperCase() === 'BANK') return t('bankaccount', settings.language);
    if (method === 'Card' || method.toUpperCase() === 'CARD') return t('card', settings.language);
    if (method === 'UPI' || method.toUpperCase() === 'UPI') return t('upi', settings.language);
    if (method === 'Not Paid') return t('notPaid', settings.language) || 'Not Paid';
    if (method === 'Mixed') return 'Mixed';
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
  if (isPendingView) {
    filteredOrders = dateFilteredOrders.filter(o => !o.isDeleted && (o.dueAmount > 0 || o.paymentStatus !== 'Paid'));
    if (pendingSubFilter === 'Pending') {
      filteredOrders = filteredOrders.filter(o => !isOverdue(o));
    } else if (pendingSubFilter === 'Overdue') {
      filteredOrders = filteredOrders.filter(o => isOverdue(o));
    }
  } else {
    if (workflowFilter === 'Deleted') {
      filteredOrders = dateFilteredOrders.filter(o => o.isDeleted);
    } else {
      const activeOnly = dateFilteredOrders.filter(o => !o.isDeleted);
      if (workflowFilter === 'All') {
        filteredOrders = activeOnly;
      } else if (workflowFilter === 'Confirmed') {
        filteredOrders = activeOnly.filter(o => ['Confirmed', 'Pending', 'Payment Pending', 'Credit'].includes(o.status));
      } else if (workflowFilter === 'Processing') {
        filteredOrders = activeOnly.filter(o => !['Confirmed', 'Pending', 'Payment Pending', 'Credit', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered', 'Cancelled'].includes(o.status) || ['Picked Up', 'Washing', 'Drying', 'Ironing'].includes(o.status));
      } else if (workflowFilter === 'Ready') {
        filteredOrders = activeOnly.filter(o => ['Ready', 'Ready to Pick up', 'Out for Delivery'].includes(o.status));
      } else if (workflowFilter === 'Delivered') {
        filteredOrders = activeOnly.filter(o => o.status === 'Delivered');
      } else if (workflowFilter === 'Cancelled') {
        filteredOrders = activeOnly.filter(o => o.status === 'Cancelled');
      }
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

  const counts = {
    all: activeDateFilteredOrders.filter(o => o.dueAmount > 0).length,
    pending: activeDateFilteredOrders.filter(o => o.dueAmount > 0 && !isOverdue(o)).length,
    overdue: overdueOrdersList.length
  };

  const workflowCounts = {
    All: activeDateFilteredOrders.length,
    Confirmed: activeDateFilteredOrders.filter(o => ['Confirmed', 'Pending', 'Payment Pending', 'Credit'].includes(o.status)).length,
    Processing: activeDateFilteredOrders.filter(o => !['Confirmed', 'Pending', 'Payment Pending', 'Credit', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered', 'Cancelled'].includes(o.status) || ['Picked Up', 'Washing', 'Drying', 'Ironing'].includes(o.status)).length,
    Ready: activeDateFilteredOrders.filter(o => ['Ready', 'Ready to Pick up', 'Out for Delivery'].includes(o.status)).length,
    Delivered: activeDateFilteredOrders.filter(o => o.status === 'Delivered').length,
    Cancelled: activeDateFilteredOrders.filter(o => o.status === 'Cancelled').length,
    Deleted: dateFilteredOrders.filter(o => o.isDeleted).length
  };

  const dueSoonOrders = activeDateFilteredOrders.filter(o => {
    if (o.status !== 'Credit' && o.status !== 'Payment Pending') return false;
    const diffDays = Math.ceil(Math.abs(new Date() - new Date(o.createdAt)) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays > 0;
  });

  useEffect(() => {
    setSearchTerm(querySearch);
  }, [querySearch]);

  useEffect(() => {
    fetchOrders();
  }, [searchTerm]);

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
              0 AS isDeleted, NULL AS refundStatus, NULL AS refundMethod, NULL AS returnedAt, NULL AS payments
            FROM orders 
            LEFT JOIN customers ON orders.customerId = customers.id

            UNION ALL

            SELECT 
              deleted_orders.id, deleted_orders.shopId, deleted_orders.billNumber, deleted_orders.customerId, 
              deleted_orders.customerName AS customerName, deleted_orders.customerPhone AS customerPhone, 
              deleted_orders.totalAmount, deleted_orders.paidAmount, 0 AS dueAmount, 
              deleted_orders.originalPaymentStatus AS paymentStatus, 'Deleted' AS status, deleted_orders.originalPaymentMethod AS paymentMethod, 
              deleted_orders.items, NULL AS statusHistory, NULL AS expectedDeliveryDate, NULL AS specialInstructions, NULL AS branchId,
              deleted_orders.deletedAt AS createdAt, deleted_orders.deletedAt AS updatedAt, 1 AS isSynced,
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
        query += ' ORDER BY createdAt DESC';
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
    
    if (['Cancelled', 'Delivered'].includes(newStatus)) {
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

      // A. Delete locally from SQLite (if electron app)
      if (window.electronAPI?.dbQuery) {
        // 1. Before deleting payments, query linked payment details so we can save them in audit log
        //    and use them to remove corresponding account_transactions
        const linkedPaymentsRes = await window.electronAPI.dbQuery(
          'SELECT id, amount, createdAt, method FROM payments WHERE orderId = ?',
          [orderToDelete.id]
        );
        const linkedPayments = linkedPaymentsRes.success ? linkedPaymentsRes.data : [];

        // 2. Insert into deleted_orders audit log
        const isPaid = orderToDelete.paidAmount > 0 || ['Paid', 'Partial'].includes(orderToDelete.paymentStatus);
        const initialReturnStatus = isPaid
          ? (refundImmediately ? 'Returned' : 'Return Pending')
          : 'N/A';
        const initialRefundStatus = isPaid
          ? (refundImmediately ? 'Returned' : 'Refund Pending')
          : 'Deleted';
        const refundMethodVal = isPaid && refundImmediately ? refundMethod : null;
        const returnedAtVal = isPaid && refundImmediately ? getLocalISOString() : null;

        await window.electronAPI.dbQuery(
          `INSERT INTO deleted_orders (id, shopId, billNumber, customerId, customerName, customerPhone, totalAmount, items, deletedAt, deletedBy, originalPaymentStatus, paidAmount, returnStatus, approvedBy, originalPaymentMethod, payments, refundMethod, returnedAt, refundStatus) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderToDelete.id,
            orderToDelete.shopId || DEFAULT_SHOP_ID || 'SHOP_01',
            orderToDelete.billNumber || '',
            orderToDelete.customerId || '',
            orderToDelete.customerName || '',
            orderToDelete.customerPhone || orderToDelete.phone || '',
            orderToDelete.totalAmount || 0,
            typeof orderToDelete.items === 'string' ? orderToDelete.items : JSON.stringify(orderToDelete.items || []),
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
        
        // 5. Process refund if the order has a paid amount and refundImmediately is selected
        const paidAmt = orderToDelete.paidAmount || 0;
        
        if (isPaid && paidAmt > 0 && refundImmediately) {
          const refundTxnId = `TXN-RETURN-${Date.now()}`;
          const _now1 = new Date();
          const txnTimestamp = `${_now1.getFullYear()}-${String(_now1.getMonth()+1).padStart(2,'0')}-${String(_now1.getDate()).padStart(2,'0')} ${String(_now1.getHours()).padStart(2,'0')}:${String(_now1.getMinutes()).padStart(2,'0')}`;
          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              refundTxnId,
              orderToDelete.shopId || DEFAULT_SHOP_ID || 'SHOP_01',
              refundMethod === 'Bank' ? 'BANK' : 'CASH',
              'EXPENSE',
              'Return',
              paidAmt,
              `Return - Bill ${orderToDelete.id.startsWith('#') ? '' : '#'}${orderToDelete.id}`,
              txnTimestamp,
              0,
              getLocalISOString(),
              'Zap',
              refundMethod === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null
            ]
          );
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
    setTimeout(() => {
      window.print();
      setIsPrintingTags(false);
      document.body.classList.remove('printing-tags');
    }, 500);
  };

  const confirmPaidStatus = async () => {
    try {
      const nextStatus = ['Payment Pending', 'Credit', 'Paid'].includes(selectedOrder.status)
        ? 'Confirmed'
        : selectedOrder.status;

      const amountToPay = (selectedOrder.dueAmount !== undefined && selectedOrder.dueAmount > 0)
        ? selectedOrder.dueAmount
        : selectedOrder.totalAmount;

      // 1. Local DB Updates (Perform this FIRST)
      if (window.electronAPI?.dbQuery) {
        // Update Local Order
        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, paymentStatus = ?, paidAmount = ?, dueAmount = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [nextStatus, 'Paid', selectedOrder.totalAmount, 0, payMethod, getLocalISOString(), selectedOrder.id]
        );

        // Update Customer Balance if it was Credit/Pending/Partial
        const wasUnpaid = selectedOrder.paymentStatus === 'Credit' || selectedOrder.paymentStatus === 'Partial' || (selectedOrder.dueAmount !== undefined && selectedOrder.dueAmount > 0);
        if (wasUnpaid && selectedOrder.customerId) {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [amountToPay, getLocalISOString(), selectedOrder.customerId]
          );
        }

        const txnId = `TXN-${Date.now()}`;
        const _now2 = new Date();
        const txnTimestamp = `${_now2.getFullYear()}-${String(_now2.getMonth()+1).padStart(2,'0')}-${String(_now2.getDate()).padStart(2,'0')} ${String(_now2.getHours()).padStart(2,'0')}:${String(_now2.getMinutes()).padStart(2,'0')}`;
        
        const mappedBankId = payMethod === 'Card'
          ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
          : (payMethod === 'UPI'
            ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
            : (payMethod === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null));

        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txnId, DEFAULT_SHOP_ID, (payMethod === 'Bank' || payMethod === 'Card' || payMethod === 'UPI') ? 'BANK' : 'CASH', 'INCOME', 'Sales Settlement', amountToPay, `Payment for Order ${selectedOrder.id}${payMethod === 'Card' ? ' (Card)' : (payMethod === 'UPI' ? ' (UPI)' : '')}`, txnTimestamp, 0, getLocalISOString(), 'DollarSign', mappedBankId]
        );

        // Record card commission if applicable
        if (payMethod === 'Card' && settings.cardCommission > 0) {
          const commissionRate = parseFloat(settings.cardCommission || 0);
          const commissionAmount = amountToPay * (commissionRate / 100);
          const commTxnId = `TXN-COMM-${Date.now()}`;
          const commDesc = `Card Commission for Order ${selectedOrder.id}`;
          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [commTxnId, DEFAULT_SHOP_ID, 'BANK', 'EXPENSE', 'Card Commission', commissionAmount, commDesc, txnTimestamp, 0, getLocalISOString(), 'Percent', mappedBankId]
          );
        }

        // Record Payment in payments table
        const currentTimestamp = getLocalISOString();
        await window.electronAPI.dbQuery(
          `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [`PAY-HEAL-${selectedOrder.id}`, selectedOrder.customerId || 'Walk-in', selectedOrder.id, DEFAULT_SHOP_ID, amountToPay, payMethod, 'SUCCESS', currentTimestamp, currentTimestamp]
        );

        // Call the healer to automatically reconcile customer balance
        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }
      }

      // 2. Update Local React State immediately
      const updatedOrder = {
        ...selectedOrder,
        status: nextStatus,
        paymentStatus: 'Paid',
        paidAmount: selectedOrder.totalAmount,
        dueAmount: 0,
        paymentMethod: payMethod
      };
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);

      // 3. Sync to Backend
      const syncPromise = axios.patch(`${API_BASE}/orders/${encodeURIComponent(selectedOrder.id)}/status`, {
        status: nextStatus,
        paymentStatus: 'Paid',
        paidAmount: selectedOrder.totalAmount,
        dueAmount: 0,
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
    if (due > 0 && orderMatch) {
      if (window.electronAPI?.dbQuery) {
        try {
          const searchRes = await window.electronAPI.dbQuery(
            `SELECT * FROM payment_links WHERE (description LIKE ? OR id = ?) AND status = 'Active' LIMIT 1`,
            [`%${orderMatch.id}%`, `LNK-${orderMatch.billNumber}`]
          );
          if (searchRes.success && searchRes.data.length > 0) {
            paymentLinkUrl = searchRes.data[0].url;
          } else {
            const linkId = `LNK-${orderMatch.billNumber || Date.now().toString().slice(-4)}`;
            const url = `https://pay.lundry.ae/lnk/${linkId.toLowerCase()}`;
            const dateStr = getLocalDateTime();
            await window.electronAPI.dbQuery(
              `INSERT INTO payment_links (id, customerId, customerName, description, amount, channel, date, status, url) 
               VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
              [
                linkId,
                orderMatch.customerId || 'Walk-in',
                orderMatch.customerName || orderMatch.customer || 'Walk-in Customer',
                `Order #${orderMatch.billNumber || orderMatch.id}`,
                due,
                'Apple Pay',
                dateStr,
                url
              ]
            );
            paymentLinkUrl = url;
          }
        } catch (err) {
          console.error("Failed to query or create payment link in database:", err);
        }
      } else {
        paymentLinkUrl = `https://pay.lundry.ae/lnk/lnk-${(orderMatch.billNumber || 'mock').toLowerCase()}`;
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
          <h1>{isPendingView ? t('pendingpayments', settings.language) : t('orderManagement', settings.language)}</h1>
          <p>
            {isPendingView 
              ? t('pendingPaymentsSub', settings.language) 
              : t('orderManagementSub', settings.language)}
          </p>
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
          <button className={styles.settleBtn} onClick={() => navigate('/settlement')}>
            <DollarSign size={18} /> {t('settlebill', settings.language)}
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            + {t('neworder', settings.language)}
          </button>
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

      {isPendingView ? (
        <div className={styles.subFilterRow}>
          <Filter size={16} color="#64748B" />
          <button 
            className={`${styles.filterTab} ${pendingSubFilter === 'All' ? styles.filterTabActive : ''}`}
            onClick={() => setPendingSubFilter('All')}
          >
            {t('all', settings.language)} ({counts.all})
          </button>
          <button 
            className={`${styles.filterTab} ${pendingSubFilter === 'Pending' ? styles.filterTabActive : ''}`}
            onClick={() => setPendingSubFilter('Pending')}
          >
            {t('pending', settings.language)} ({counts.pending})
          </button>
          <button 
            className={`${styles.filterTab} ${pendingSubFilter === 'Overdue' ? styles.filterTabActiveOverdue : ''}`}
            onClick={() => setPendingSubFilter('Overdue')}
          >
            {t('overdue', settings.language)} ({counts.overdue})
          </button>

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
      ) : (
        <div className={styles.subFilterRow}>
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
          <button 
            className={`${styles.filterTab} ${workflowFilter === 'Cancelled' ? styles.filterTabActiveOverdue : ''}`}
            onClick={() => setWorkflowFilter('Cancelled')}
          >
            {t('cancelled', settings.language)} ({workflowCounts.Cancelled})
          </button>

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
      <div className={isPendingView ? styles.cardGridContainer : styles.tableCard}>
        {isPendingView ? (
          <div className={styles.orderListContainer}>
            {paginatedOrders.length > 0 ? (
              paginatedOrders.map((order) => (
                <div key={order.id} className={`${styles.premiumListItem} ${isOverdue(order) ? styles.overdueListItem : ''}`}>
                  <div className={styles.listIdSection}>
                    <span className={styles.listIdLabel}>{t('order', settings.language).toUpperCase()}</span>
                    <h3 className={styles.listIdValue}>{settings.invoicePrefix || ''}{order.id}</h3>
                  </div>

                  <div className={styles.listCustomerSection}>
                    <div className={styles.listAvatar}>
                      {order.customerName ? order.customerName.charAt(0).toUpperCase() : 'W'}
                    </div>
                    <div className={styles.listUserInfo}>
                      <p className={styles.listCustName}>{order.customerName || t('walkInCustomer', settings.language)}</p>
                      <p className={styles.listCustPhone}>{order.customerPhone || order.phone || t('noPhone', settings.language)}</p>
                    </div>
                  </div>

                  <div className={styles.listFinancialSection} style={{ width: '220px' }}>
                     <div className={styles.listStat}>
                        <span className={styles.listStatLabel}>{t('dueAmount', settings.language)}</span>
                        <span className={styles.listStatValue} style={{ color: (order.dueAmount ?? (order.totalAmount - (order.paidAmount || 0))) > 0 ? '#EF4444' : '#107C41' }}>
                          <CurrencySymbol size={14} /> {((order.dueAmount !== undefined && order.dueAmount !== null) ? order.dueAmount : (order.totalAmount - (order.paidAmount || 0))).toFixed(2)}
                        </span>
                     </div>
                     <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginTop: '4px', textTransform: 'capitalize' }}>
                        {t('total', settings.language)}: <CurrencySymbol size={10} /> {(order.totalAmount || 0).toFixed(2)} | {t('paid', settings.language)}: <CurrencySymbol size={10} /> {(order.paidAmount || 0).toFixed(2)}
                     </div>
                     <div style={{ marginTop: '6px' }}>
                        {order.paymentStatus === 'Paid' || (order.dueAmount !== undefined && order.dueAmount <= 0) ? (
                          <span className={
                           order.paymentMethod === 'Cash' ? styles.methodCash : 
                           order.paymentMethod === 'Bank' ? styles.methodOther :
                           order.paymentMethod === 'Mixed' ? styles.methodOther :
                           styles.methodOther
                         }>
                           {order.paymentMethod}
                          </span>
                        ) : order.paymentStatus === 'Partial' ? (
                          <span className={styles.methodPartial}>
                            {t('partial', settings.language) || 'Partial'}
                          </span>
                        ) : (
                          <span className={styles.methodCredit}>
                            {t('notPaid', settings.language)}
                          </span>
                        )}
                     </div>
                  </div>

                  <div className={styles.listStatusSection}>
                    {isOverdue(order) ? (
                      <span className={styles.listBadgeOverdue}>{t('overdue', settings.language)}</span>
                    ) : (
                      <span className={styles.listBadgePending}>{t('pending', settings.language)}</span>
                    )}
                    <span className={styles.listDate}>{formatDateTime(order.createdAt)}</span>
                  </div>

                  <div className={styles.listActionsSection}>
                    <button 
                      className={styles.listCollectBtn}
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowPayModal(true);
                      }}
                    >
                      <DollarSign size={16} /> {t('collect', settings.language)}
                    </button>
                    <button 
                      className={styles.listReminderBtn}
                      onClick={() => handleWhatsApp(order.customerPhone || order.phone, order.id)}
                    >
                      <WhatsAppIcon size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.noData}>{t('noPendingPayments', settings.language)}</div>
            )}
          </div>
        ) : (
          <table className={styles.ordersTable}>
            <thead>
              <tr>
                <th>{t('orderId', settings.language)}</th>
                <th>{t('date', settings.language)}</th>
                <th>{t('customer', settings.language)}</th>
                <th>{t('whatsapp', settings.language)}</th>
                <th>{t('totalAmount', settings.language)}</th>
                <th>{t('paymentMethodLabel', settings.language)}</th>
                <th>{t('status', settings.language)}</th>
                <th className={styles.actionsHeader}>{t('paymentStatus', settings.language)}</th>
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
                          <span className={styles.billText}>{t('bill', settings.language)}: {order.billNumber || 'N/A'}</span>
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
                       {order.paymentStatus === 'Paid' ? (
                         order.paymentMethod ? (
                            <span className={
                              order.paymentMethod === 'Cash' ? styles.methodCash : 
                              order.paymentMethod === 'Bank' ? styles.methodOther :
                              order.paymentMethod === 'Mixed' ? styles.methodOther :
                              styles.methodOther
                            }>
                              {order.paymentMethod}
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                        {order.isDeleted ? (
                          <span className={`${styles.statusBadge} ${
                            order.refundStatus === 'Returned' ? styles.statusDelivered :
                            order.refundStatus === 'Refund Pending' ? styles.statusPending :
                            styles.statusCancelled
                          }`}>
                            {order.refundStatus || 'Deleted'}
                          </span>
                        ) : !['Payment Pending', 'Paid', 'Credit'].includes(order.status) ? (
                          <span className={`${styles.statusBadge} ${STATUS_COLORS[order.status]}`}>
                            {translateStatus(order.status)}
                          </span>
                        ) : (
                          <span className={`${styles.statusBadge} ${styles.statusProcessing}`}>
                            {t('confirmed', settings.language)}
                          </span>
                        )}
                        {!order.isDeleted && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                          <button 
                            className={styles.deliverBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus('Delivered', order);
                            }}
                          >
                            <Truck size={12} /> {t('deliver', settings.language)}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionCellContainer}>
                        <div className={styles.paymentCol}>
                          {order.isDeleted ? (
                            <span className={styles.statusBadge} style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>
                              Deleted
                            </span>
                          ) : order.paymentStatus === 'Paid' ? (
                            <span className={styles.paidActionBadge}>
                              <CheckCircle size={14} /> {t('paid', settings.language)}
                            </span>
                          ) : (
                            <span className={styles.creditActionBadge}>
                              <AlertCircle size={14} /> {order.paymentStatus ? t(order.paymentStatus.toLowerCase(), settings.language) : t('notPaid', settings.language)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                    {isPendingView ? t('noPendingPayments', settings.language) : t('noOrdersFound', settings.language)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

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
                        } catch(e) { console.error("Failed to parse items", e); }
                        
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
                        } catch(e) { console.error("Failed to parse history", e); }
                        
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


                    </>
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
                            setRefundImmediately(true);
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
                <button className={styles.printBtn} style={{ flex: 1.5 }} onClick={confirmPaidStatus}>
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
              
              {orderToDelete && (orderToDelete.paidAmount > 0 || ['Paid', 'Partial'].includes(orderToDelete.paymentStatus)) && (
                <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="markAsReturned"
                      checked={refundImmediately}
                      onChange={(e) => setRefundImmediately(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="markAsReturned" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                      Mark payment of <CurrencySymbol size={11} />{(orderToDelete.paidAmount || 0).toFixed(2)} as returned (refunded) now
                    </label>
                  </div>
                  
                  {refundImmediately && (
                    <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refund Source:</span>
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
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '0.75rem 1rem', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <Info size={18} />
                  <span>This update can be authorized using the secure PIN.</span>
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
                  type="button" 
                  className={styles.saveBtn} 
                  onClick={() => setShowManagerPinModal(true)}
                  style={{ flex: 1, background: '#D97706', color: 'white' }}
                >
                  Manager Override
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manager PIN Modal */}
      {showManagerPinModal && (
        <div className={styles.modalOverlay} onClick={() => {
          setShowManagerPinModal(false);
          setManagerPinValue('');
          setManagerPinError('');
        }}>
          <div className={`${styles.modal} ${styles.tempModal}`} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <h2>Manager Verification</h2>
                <p>Enter the PIN to approve this credit</p>
              </div>
            </div>
            <form onSubmit={handleVerifyManagerPin}>
              <div className={styles.modalBody} style={{ padding: '1.5rem' }}>
                <div className={styles.formGroup}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>SECURE PIN</label>
                  <div className={styles.posInputWrapper}>
                    <Lock size={18} />
                    <input 
                      type="password" 
                      required 
                      maxLength={4}
                      placeholder="Enter 4-Digit PIN"
                      value={managerPinValue}
                      onChange={(e) => setManagerPinValue(e.target.value.replace(/\D/g, ''))}
                      style={{ fontSize: '1.25rem', letterSpacing: '0.25rem' }}
                    />
                  </div>
                  {managerPinError && (
                    <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>{managerPinError}</p>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter} style={{ display: 'flex', gap: '1rem', padding: '1rem 1.5rem' }}>
                <button 
                  type="button" 
                  className={styles.secondaryBtn} 
                  onClick={() => {
                    setShowManagerPinModal(false);
                    setManagerPinValue('');
                    setManagerPinError('');
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.saveBtn}
                  style={{ flex: 1 }}
                >
                  Verify
                </button>
              </div>
            </form>
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
