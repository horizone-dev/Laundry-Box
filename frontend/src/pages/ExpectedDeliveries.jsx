import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Calendar, Clock, Package, CheckCircle,
  AlertCircle, Phone, DollarSign, Truck,
  Eye, Printer, ChevronDown, Check, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WhatsAppIcon from '../components/WhatsAppIcon';
import Pagination from '../components/Pagination';
import axios from 'axios';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID, API_BASE_URL } from '../constants';
import { t } from '../utils/translations';
import CurrencySymbol from '../components/CurrencySymbol';
import { getLocalISOString, getLocalDateStr } from '../utils/dateUtils';
import styles from './ExpectedDeliveries.module.css';

const API_BASE = API_BASE_URL;

export default function ExpectedDeliveries() {
  const navigate = useNavigate();
  const { settings, formatDate } = useSettings();
  const formatDateTimeSplit = (dateVal) => {
    if (!dateVal) return { date: 'N/A', time: '' };
    const formattedDate = formatDate(dateVal);
    if (formattedDate === 'N/A' || formattedDate === 'Invalid Date') return { date: formattedDate, time: '' };

    let d;
    try {
      d = new Date(dateVal);
    } catch (e) {
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

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Filters
  const [dateFilter, setDateFilter] = useState('Today'); // Default to Today
  const [statusFilter, setStatusFilter] = useState('All'); // All, Confirmed, Picked Up, Washing, Drying, Ironing, Ready, Out for Delivery
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, statusFilter, customStart, customEnd]);

  // Settle / Payment Quick Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedOrderForPay, setSelectedOrderForPay] = useState(null);
  const [payMethod, setPayMethod] = useState('Cash');

  useEffect(() => {
    fetchOrders();
  }, [searchTerm]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPayModal(false);
        setSelectedOrderForPay(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (showPayModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPayModal]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      if (window.electronAPI?.dbQuery) {
        let query = `
          SELECT orders.*, customers.name as customerName, customers.phone as customerPhone 
          FROM orders 
          LEFT JOIN customers ON orders.customerId = customers.id
        `;
        let params = [];
        if (searchTerm) {
          query += ' WHERE orders.id LIKE ? OR orders.billNumber LIKE ? OR customers.name LIKE ? OR customers.phone LIKE ? OR orders.status LIKE ? OR orders.paymentStatus LIKE ?';
          const term = `%${searchTerm}%`;
          params = [term, term, term, term, term, term];
        }
        query += " ORDER BY CASE WHEN orders.expectedDeliveryDate IS NULL OR orders.expectedDeliveryDate = '' THEN 1 ELSE 0 END, orders.expectedDeliveryDate ASC, orders.createdAt DESC";

        const res = await window.electronAPI.dbQuery(query, params);
        if (res.success) {
          setOrders(res.data);
        }
      } else {
        // Fallback to API
        const res = await axios.get(`${API_BASE}/orders/search?q=${encodeURIComponent(searchTerm)}`);
        setOrders(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper date parsing/matching functions
  const getTodayString = () => {
    return getLocalDateStr();
  };

  const getTomorrowString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const getStartOfWeekDate = () => {
    const today = new Date();
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const getEndOfWeekDate = () => {
    const start = getStartOfWeekDate();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  // KPI calculations (only active orders i.e. not Delivered and not Cancelled)
  const activeOrders = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
  const todayStr = getTodayString();
  const tomorrowStr = getTomorrowString();

  const overdueCount = activeOrders.filter(o => o.expectedDeliveryDate && o.expectedDeliveryDate.substring(0, 10) < todayStr).length;
  const todayCount = activeOrders.filter(o => o.expectedDeliveryDate && o.expectedDeliveryDate.substring(0, 10) === todayStr).length;
  const tomorrowCount = activeOrders.filter(o => o.expectedDeliveryDate && o.expectedDeliveryDate.substring(0, 10) === tomorrowStr).length;
  const totalPendingCount = activeOrders.length;

  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      // 1. Status Filter
      if (statusFilter !== 'All' && order.status !== statusFilter) return false;

      // 2. Date Filter
      const expDate = order.expectedDeliveryDate ? order.expectedDeliveryDate.substring(0, 10) : '';

      if (dateFilter === 'All Pending') {
        // Only active/pending orders
        return order.status !== 'Delivered' && order.status !== 'Cancelled';
      }

      if (dateFilter === 'Today') {
        return expDate === todayStr;
      }

      if (dateFilter === 'Tomorrow') {
        return expDate === tomorrowStr;
      }



      if (dateFilter === 'Overdue') {
        return expDate && expDate < todayStr && order.status !== 'Delivered' && order.status !== 'Cancelled';
      }

      if (dateFilter === 'Custom') {
        if (!expDate || !customStart || !customEnd) return false;
        return expDate >= customStart && expDate <= customEnd;
      }

      return true; // "All"
    });
  }, [orders, dateFilter, statusFilter, customStart, customEnd, todayStr, tomorrowStr]);

  const handleUpdateExpectedDate = async (order, newDate) => {
    try {
      const timestamp = getLocalISOString();
      if (window.electronAPI?.dbQuery) {
        await window.electronAPI.dbQuery(
          'UPDATE orders SET expectedDeliveryDate = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newDate, timestamp, order.id]
        );
      }

      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, expectedDeliveryDate: newDate, updatedAt: timestamp } : o));

      // Attempt background sync
      axios.patch(`${API_BASE}/orders/${encodeURIComponent(order.id)}/status`, {
        expectedDeliveryDate: newDate,
        updatedBy: 'Admin Staff'
      }).catch(err => {
        console.warn('Cloud sync deferred:', err.message);
      });
    } catch (err) {
      console.error('Failed to update expected delivery date:', err);
      alert('Failed to update delivery date.');
    }
  };

  const handleUpdateStatus = async (order, newStatus) => {
    if (['Cancelled', 'Delivered'].includes(newStatus)) {
      const confirmMsg = t('confirmStatusChange', settings.language)
        .replace('{id}', order.id)
        .replace('{status}', newStatus);
      if (!window.confirm(confirmMsg)) return;
    }

    try {
      const timestamp = getLocalISOString();
      let newHistory = [];

      let history = [];
      try {
        history = typeof order.statusHistory === 'string'
          ? JSON.parse(order.statusHistory || '[]')
          : (order.statusHistory || []);
        if (!Array.isArray(history)) history = [];
      } catch (e) {
        history = [];
      }
      newHistory = [...history, { status: newStatus, updatedBy: 'Admin Staff', timestamp }];

      if (window.electronAPI?.dbQuery) {
        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, statusHistory = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newStatus, JSON.stringify(newHistory), timestamp, order.id]
        );
      }

      // Update local state
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus, statusHistory: newHistory, updatedAt: timestamp } : o));

      // Background sync
      axios.patch(`${API_BASE}/orders/${encodeURIComponent(order.id)}/status`, {
        status: newStatus,
        updatedBy: 'Admin Staff'
      }).catch(err => {
        console.warn('Cloud sync deferred:', err.message);
      });

    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status.');
    }
  };

  const handleQuickDeliver = async (order) => {
    await handleUpdateStatus(order, 'Delivered');
  };

  const handleWhatsApp = (phone, id, status, expDate) => {
    if (!phone) {
      alert(t('noPhoneFound', settings.language));
      return;
    }

    let cleanPhone = phone.toString().replace(/\D/g, '');

    // Prepend country code if original phone doesn't start with '+'
    if (!phone.toString().trim().startsWith('+')) {
      const countryCode = settings.waCountryCode || '971';
      const cleanCountryCode = countryCode.replace(/\D/g, '');
      if (cleanCountryCode && !cleanPhone.startsWith(cleanCountryCode)) {
        cleanPhone = cleanCountryCode + cleanPhone;
      }
    }

    let formattedExp = 'Not Scheduled';
    if (expDate) {
      if (expDate.includes(' ')) {
        const [datePart, timePart] = expDate.split(' ');
        formattedExp = `${formatDate(datePart)} at ${timePart}`;
      } else {
        formattedExp = formatDate(expDate);
      }
    }
    let message = '';
    const orderMatch = orders.find(o => o.id === id || o.billNumber === id);
    const customerName = orderMatch ? (orderMatch.customerName || orderMatch.customer || 'Customer') : 'Customer';
    const due = orderMatch ? (orderMatch.dueAmount ?? 0) : 0;
    
    if (settings.waStatusUpdateTemplate) {
      message = settings.waStatusUpdateTemplate
        .replace(/{customerName}/g, customerName)
        .replace(/{orderId}/g, id)
        .replace(/{status}/g, status)
        .replace(/{dueAmount}/g, `${settings.currencySymbol || 'AED'} ${due.toFixed(2)}`)
        .replace(/{deliveryDate}/g, formattedExp);
    } else {
      message = `Hello! Regarding your laundry order #${id}, the current status is "${status}". Expected delivery date is ${formattedExp}. Thank you!`;
      if (orderMatch && orderMatch.dueAmount > 0) {
        message += `\n\nFriendly reminder: Your pending balance is ${settings.currencySymbol || 'AED'} ${orderMatch.dueAmount.toFixed(2)}.`;
      }
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const openPaymentModal = (order) => {
    setSelectedOrderForPay(order);
    setPayMethod('Cash');
    setShowPayModal(true);
  };

  const confirmPayment = async () => {
    if (!selectedOrderForPay) return;

    try {
      const order = selectedOrderForPay;
      const timestamp = getLocalISOString();
      const amountToPay = order.dueAmount || order.totalAmount;
      const nextStatus = ['Payment Pending', 'Credit', 'Pending'].includes(order.status)
        ? 'Confirmed'
        : order.status;

      if (window.electronAPI?.dbQuery) {
        // Update order
        const r1 = await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, paymentStatus = ?, paidAmount = ?, dueAmount = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [nextStatus, 'Paid', order.totalAmount, 0, payMethod, timestamp, order.id]
        );
        if (!r1.success) throw new Error(r1.error || 'Failed to update order status');

        // Update customer balance
        if (order.customerId && order.customerId !== 'Walk-in') {
          const r2 = await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [amountToPay, timestamp, order.customerId]
          );
          if (!r2.success) throw new Error(r2.error || 'Failed to update customer balance');
        }

        // Record account transaction
        const txnId = `TXN-${Date.now()}`;
        const _nowEd = new Date();
        const txnTimestamp = `${_nowEd.getFullYear()}-${String(_nowEd.getMonth() + 1).padStart(2, '0')}-${String(_nowEd.getDate()).padStart(2, '0')} ${String(_nowEd.getHours()).padStart(2, '0')}:${String(_nowEd.getMinutes()).padStart(2, '0')}`;
        const mappedBankId = payMethod === 'Card'
          ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
          : (payMethod === 'UPI'
            ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
            : (payMethod === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null));
        const r3 = await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [txnId, DEFAULT_SHOP_ID, (payMethod === 'Bank' || payMethod === 'Card' || payMethod === 'UPI') ? 'BANK' : 'CASH', 'INCOME', 'Sales Settlement', amountToPay, `Payment for Order ${order.id}${payMethod === 'Card' ? ' (Card)' : (payMethod === 'UPI' ? ' (UPI)' : '')}`, txnTimestamp, timestamp, 'DollarSign', mappedBankId]
        );
        if (!r3.success) throw new Error(r3.error || 'Failed to insert account transaction');

        // Record card commission if applicable
        if (payMethod === 'Card' && settings.cardCommission > 0) {
          const commissionRate = parseFloat(settings.cardCommission || 0);
          const commissionAmount = amountToPay * (commissionRate / 100);
          const commTxnId = `TXN-COMM-${Date.now()}`;
          const commDesc = `Card Commission for Order ${order.id}`;
          const r4 = await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
            [commTxnId, DEFAULT_SHOP_ID, 'BANK', 'EXPENSE', 'Card Commission', commissionAmount, commDesc, txnTimestamp, timestamp, 'Percent', mappedBankId]
          );
          if (!r4.success) throw new Error(r4.error || 'Failed to insert card commission');
        }

        // Record payment
        const r5 = await window.electronAPI.dbQuery(
          `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [`PAY-DELIV-${order.id}`, order.customerId || 'Walk-in', order.id, DEFAULT_SHOP_ID, amountToPay, payMethod, 'SUCCESS', timestamp, timestamp]
        );
        if (!r5.success) throw new Error(r5.error || 'Failed to insert payment record');

        // Run data healer
        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }
      }

      setOrders(prev => prev.map(o => o.id === order.id ? {
        ...o,
        status: nextStatus,
        paymentStatus: 'Paid',
        paidAmount: order.totalAmount,
        dueAmount: 0,
        paymentMethod: payMethod,
        updatedAt: timestamp
      } : o));

      // Cloud sync
      axios.patch(`${API_BASE}/orders/${encodeURIComponent(order.id)}/status`, {
        status: nextStatus,
        paymentStatus: 'Paid',
        paidAmount: order.totalAmount,
        dueAmount: 0,
        updatedBy: 'Admin Staff'
      }).catch(err => {
        console.warn('Cloud sync deferred:', err.message);
      });

      setShowPayModal(false);
      setSelectedOrderForPay(null);
      alert('Payment recorded successfully!');
    } catch (err) {
      console.error('Failed to settle payment:', err);
      alert('Failed to settle payment.');
    }
  };

  const getWorkflowStatuses = () => {
    return settings.workflowStatuses || ['Confirmed', 'Picked Up', 'Washing', 'Drying', 'Ironing', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered', 'Cancelled'];
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Delivered':
      case 'Paid':
        return styles.badgeGreen;
      case 'Cancelled':
      case 'Credit':
        return styles.badgeRed;
      case 'Payment Pending':
      case 'Pending':
        return styles.badgeYellow;
      case 'Ready':
      case 'Ready to Pick up':
      case 'Out for Delivery':
        return styles.badgeOrange;
      default:
        return styles.badgeBlue;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>{t('expecteddeliveries', settings.language)}</h1>
          <p>Track laundry orders sorted by expected delivery date, configure inline updates, and fulfill deliveries.</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by Bill ID, Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statOverdue}`} onClick={() => setDateFilter('Overdue')}>
          <div className={styles.statIcon}><AlertCircle color="#EF4444" size={24} /></div>
          <div className={styles.statInfo}>
            <span>{t('overdue', settings.language)} Deliveries</span>
            <h3>{overdueCount} Orders</h3>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statToday}`} onClick={() => setDateFilter('Today')}>
          <div className={styles.statIcon}><Clock color="#F59E0B" size={24} /></div>
          <div className={styles.statInfo}>
            <span>Expected Today</span>
            <h3>{todayCount} Orders</h3>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statTomorrow}`} onClick={() => setDateFilter('Tomorrow')}>
          <div className={styles.statIcon}><Calendar color="#3B82F6" size={24} /></div>
          <div className={styles.statInfo}>
            <span>Expected Tomorrow</span>
            <h3>{tomorrowCount} Orders</h3>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statPending}`} onClick={() => setDateFilter('All Pending')}>
          <div className={styles.statIcon}><Package color="#10B981" size={24} /></div>
          <div className={styles.statInfo}>
            <span>Total Pending</span>
            <h3>{totalPendingCount} Orders</h3>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className={styles.filterRow}>
        <div className={styles.filterGroup}>
          <Filter size={16} color="#64748B" />
          <button
            className={`${styles.filterBtn} ${dateFilter === 'All Pending' ? styles.active : ''}`}
            onClick={() => setDateFilter('All Pending')}
          >
            All Pending
          </button>
          <button
            className={`${styles.filterBtn} ${dateFilter === 'Today' ? styles.active : ''}`}
            onClick={() => setDateFilter('Today')}
          >
            Today
          </button>
          <button
            className={`${styles.filterBtn} ${dateFilter === 'Tomorrow' ? styles.active : ''}`}
            onClick={() => setDateFilter('Tomorrow')}
          >
            Tomorrow
          </button>

          <button
            className={`${styles.filterBtn} ${dateFilter === 'Overdue' ? styles.active : ''}`}
            onClick={() => setDateFilter('Overdue')}
          >
            {t('overdue', settings.language)}
          </button>
          <button
            className={`${styles.filterBtn} ${dateFilter === 'All' ? styles.active : ''}`}
            onClick={() => setDateFilter('All')}
          >
            All Time
          </button>
          <button
            className={`${styles.filterBtn} ${dateFilter === 'Custom' ? styles.active : ''}`}
            onClick={() => setDateFilter('Custom')}
          >
            Custom
          </button>
        </div>

        <div className={styles.selectFilters}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.dropdownSelect}
          >
            <option value="All">All Statuses</option>
            {getWorkflowStatuses().map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          {dateFilter === 'Custom' && (
            <div className={styles.customDateWrapper}>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className={styles.dateInput}
              />
              <span className={styles.dateSeparator}>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={styles.dateInput}
              />
            </div>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Created Date</th>
              <th>Expected Date & Time</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Dues</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
              const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

              return (
                <>
                  {paginatedOrders.map(order => {
                    const isOverdueOrder = order.expectedDeliveryDate && order.expectedDeliveryDate < todayStr && order.status !== 'Delivered' && order.status !== 'Cancelled';
                    const { date: createdDate, time: createdTime } = formatDateTimeSplit(order.createdAt);
                    return (
                      <tr key={order.id} className={isOverdueOrder ? styles.overdueRow : ''}>
                        <td className={styles.boldText}>
                          <div className={styles.idCell}>
                            <span className={styles.billNumber}>{order.billNumber || order.id}</span>
                            <span className={styles.orderIdSub}>{order.id}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.custCell}>
                            <span className={styles.custName}>{order.customerName || 'Walk-in'}</span>
                            <span className={styles.custPhone}>{order.customerPhone || 'No Phone'}</span>
                          </div>
                        </td>
                        <td>
                          <div>{createdDate}</div>
                          {createdTime && (
                            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.15rem', fontWeight: 500 }}>
                              {createdTime}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                            <div className={styles.datePickerContainer} style={{ width: '130px' }}>
                              <Calendar size={13} className={styles.datePickerIcon} />
                              <input
                                type="date"
                                value={order.expectedDeliveryDate ? order.expectedDeliveryDate.substring(0, 10) : ''}
                                onChange={(e) => {
                                  const newDate = e.target.value;
                                  const existingTime = order.expectedDeliveryDate && order.expectedDeliveryDate.includes(' ')
                                    ? order.expectedDeliveryDate.split(' ')[1]
                                    : '17:00';
                                  handleUpdateExpectedDate(order, `${newDate} ${existingTime}`);
                                }}
                                className={styles.inlineDateInput}
                                style={{ paddingLeft: '1.75rem', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.35rem 0.5rem', background: 'white', border: '1px solid #CBD5E1', borderRadius: '6px', width: '130px', boxSizing: 'border-box' }}>
                              <Clock size={12} color="#64748B" />
                              <input
                                type="time"
                                value={order.expectedDeliveryDate && order.expectedDeliveryDate.includes(' ') ? order.expectedDeliveryDate.split(' ')[1] : '17:00'}
                                onChange={(e) => {
                                  const newTime = e.target.value || '17:00';
                                  const existingDate = order.expectedDeliveryDate ? order.expectedDeliveryDate.substring(0, 10) : getTodayString();
                                  handleUpdateExpectedDate(order, `${existingDate} ${newTime}`);
                                }}
                                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', outline: 'none', color: '#334155', fontWeight: 600, width: '100%', padding: 0 }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.selectWrapper}>
                            <select
                              value={order.status || 'Confirmed'}
                              onChange={(e) => handleUpdateStatus(order, e.target.value)}
                              className={`${styles.inlineSelect} ${getStatusBadgeClass(order.status)}`}
                            >
                              {getWorkflowStatuses().map(status => (
                                <option key={status} value={status} style={{ background: '#FFF', color: '#000' }}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${getStatusBadgeClass(order.paymentStatus)}`}>
                            {order.paymentStatus || 'Pending'}
                          </span>
                        </td>
                        <td className={styles.amount}>
                          <div className={styles.duesCell}>
                            <span className={styles.dueAmount}>
                              <CurrencySymbol size={11} /> {(order.dueAmount ?? order.totalAmount ?? 0).toFixed(2)}
                            </span>
                            <span className={styles.totalAmountSub}>
                              Total: <CurrencySymbol size={10} /> {(order.totalAmount || 0).toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                              <button
                                className={styles.deliverBtn}
                                onClick={() => handleQuickDeliver(order)}
                                title="Quick Deliver"
                              >
                                <Truck size={14} /> Deliver
                              </button>
                            )}


                            {order.customerPhone && (
                              <button
                                className={styles.whatsappBtn}
                                onClick={() => handleWhatsApp(order.customerPhone, order.billNumber || order.id, order.status, order.expectedDeliveryDate)}
                                title="WhatsApp Reminder"
                              >
                                <WhatsAppIcon size={14} />
                              </button>
                            )}

                            <button
                              className={styles.iconBtn}
                              onClick={() => navigate(`/invoice/${encodeURIComponent(order.id.replace('#', ''))}`)}
                              title="View Invoice"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan="8" className={styles.noData}>
                        {loading ? 'Loading...' : (
                          <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <Package size={40} style={{ color: '#CBD5E1', marginBottom: '0.75rem' }} />
                            <p style={{ fontWeight: 700, color: '#475569', margin: 0 }}>
                              No orders matched the criteria.
                            </p>
                            {(dateFilter === 'Today' || dateFilter === 'Tomorrow') && (
                              <p style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.4rem' }}>
                                💡 Expected delivery dates aren't set on existing orders. Use the inline date picker in the table to assign dates, or set them at the POS when creating new orders.
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredOrders.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            totalItems={filteredOrders.length}
            pageSize={itemsPerPage}
            itemLabel="orders"
          />
        )}
      </div>

      {/* Settle Payment Modal */}
      {showPayModal && selectedOrderForPay && (
        <div className={styles.modalOverlay} onClick={() => { setShowPayModal(false); setSelectedOrderForPay(null); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Record Payment for #{selectedOrderForPay.billNumber || selectedOrderForPay.id}</h3>
              <button className={styles.closeBtn} onClick={() => { setShowPayModal(false); setSelectedOrderForPay(null); }}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p>You are marking Order <strong>{selectedOrderForPay.id}</strong> as Paid. Choose payment method:</p>

              <div className={styles.methodList}>
                <label className={`${styles.methodLabel} ${payMethod === 'Cash' ? styles.activeMethod : ''}`}>
                  <input type="radio" name="payMethod" value="Cash" checked={payMethod === 'Cash'} onChange={() => setPayMethod('Cash')} />
                  <span>Cash Account</span>
                </label>
                <label className={`${styles.methodLabel} ${payMethod === 'Card' ? styles.activeMethod : ''}`}>
                  <input type="radio" name="payMethod" value="Card" checked={payMethod === 'Card'} onChange={() => setPayMethod('Card')} />
                  <span>Card Account</span>
                </label>
                <label className={`${styles.methodLabel} ${payMethod === 'UPI' ? styles.activeMethod : ''}`}>
                  <input type="radio" name="payMethod" value="UPI" checked={payMethod === 'UPI'} onChange={() => setPayMethod('UPI')} />
                  <span>UPI Account</span>
                </label>
              </div>

              <div className={styles.paymentSummary}>
                <div className={styles.summaryRow}>
                  <span>Total Amount:</span>
                  <strong><CurrencySymbol /> {selectedOrderForPay.totalAmount.toFixed(2)}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Remaining Dues:</span>
                  <strong className={styles.dueText}><CurrencySymbol /> {(selectedOrderForPay.dueAmount || selectedOrderForPay.totalAmount).toFixed(2)}</strong>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => { setShowPayModal(false); setSelectedOrderForPay(null); }}>Cancel</button>
              <button className={styles.confirmPayBtn} onClick={confirmPayment}>
                Confirm Payment <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
