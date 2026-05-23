import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, ChevronLeft, ChevronRight, MoreHorizontal, 
  Clock, Package, CheckCircle, AlertCircle, ChevronDown, 
  X, Printer, CreditCard, Wallet, User, History, QrCode, MessageCircle, Phone, DollarSign, Truck
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID, API_BASE_URL } from '../constants';
import { t } from '../utils/translations';
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
  const { settings } = useSettings();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(querySearch);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Filtering logic
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState('CASH');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingSubFilter, setPendingSubFilter] = useState('All'); // 'All', 'Pending', 'Overdue'
  const [isPrintingTags, setIsPrintingTags] = useState(false);

  // Translation helpers
  const translateStatus = (status) => {
    if (!status) return '';
    if (['Payment Pending', 'Credit'].includes(status)) {
      return t('confirmed', settings.language);
    }
    // Convert to camelCase (e.g. "Ready to Pick up" -> "readyToPickUp", "Picked Up" -> "pickedUp")
    const key = status.charAt(0).toLowerCase() + status.slice(1).replace(/\s+(.)/g, (_, c) => c.toUpperCase());
    return t(key, settings.language);
  };

  const getPaymentMethodTranslation = (method) => {
    if (!method) return '';
    if (method.toUpperCase() === 'CASH') return t('cashaccount', settings.language);
    if (method.toUpperCase() === 'BANK') return t('bankaccount', settings.language);
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

  // Filtering logic
  let filteredOrders = isPendingView 
    ? orders.filter(o => o.dueAmount > 0 || o.paymentStatus !== 'Paid') 
    : orders;

  if (isPendingView) {
    if (pendingSubFilter === 'Pending') {
      filteredOrders = filteredOrders.filter(o => !isOverdue(o));
    } else if (pendingSubFilter === 'Overdue') {
      filteredOrders = filteredOrders.filter(o => isOverdue(o));
    }
  }

  // Financial Calculations for KPIs
  const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  
  const totalPaid = orders
    .filter(o => (o.dueAmount === 0 || o.dueAmount === null) && o.totalAmount > 0)
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    
  const totalPending = orders
    .filter(o => (o.dueAmount > 0))
    .reduce((sum, o) => sum + (o.dueAmount || 0), 0);
  
  const overdueOrdersList = orders.filter(o => isOverdue(o));
  const overdueAmount = overdueOrdersList.reduce((sum, o) => sum + (o.dueAmount || 0), 0);

  const counts = {
    all: orders.filter(o => o.dueAmount > 0).length,
    pending: orders.filter(o => o.dueAmount > 0 && !isOverdue(o)).length,
    overdue: overdueOrdersList.length
  };

  const dueSoonOrders = orders.filter(o => {
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
          SELECT orders.*, customers.name as customerName, customers.phone as customerPhone 
          FROM orders 
          LEFT JOIN customers ON orders.customerId = customers.id
        `;
        let params = [];
        if (searchTerm) {
          query += ' WHERE orders.id LIKE ? OR orders.billNumber LIKE ? OR customers.name LIKE ? OR customers.phone LIKE ?';
          const term = `%${searchTerm}%`;
          params = [term, term, term, term];
        }
        query += ' ORDER BY orders.createdAt DESC';
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
        newHistory = [...history, { status: newStatus, updatedBy: 'Admin Staff', timestamp: new Date().toISOString() }];
        
        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, statusHistory = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newStatus, JSON.stringify(newHistory), new Date().toISOString(), orderToUpdate.id]
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

  const [originalPayStatus, setOriginalPayStatus] = useState(null);

  const handleUpdatePaymentStatus = async (newPayStatus) => {
    if (!selectedOrder) return;
    
    if (newPayStatus === 'Paid') {
      setOriginalPayStatus(selectedOrder.paymentStatus);
      setSelectedOrder(prev => ({ ...prev, paymentStatus: 'Paid' }));
      setShowPayModal(true);
      return;
    }

    try {
      if (window.electronAPI?.dbQuery) {
        await window.electronAPI.dbQuery(
          'UPDATE orders SET paymentStatus = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newPayStatus, new Date().toISOString(), selectedOrder.id]
        );
        
        // If changing to Credit, update customer balance
        if (newPayStatus === 'Credit' && selectedOrder.customerId) {
           await window.electronAPI.dbQuery(
             'UPDATE customers SET balance = balance + ?, isSynced = 0, updatedAt = ? WHERE id = ?',
             [selectedOrder.dueAmount ?? selectedOrder.totalAmount, new Date().toISOString(), selectedOrder.customerId]
           );
        }
      }

      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, paymentStatus: newPayStatus } : o));
      setSelectedOrder(prev => ({ ...prev, paymentStatus: newPayStatus }));
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
    setIsPrintingTags(true);
    setTimeout(() => {
      window.print();
      setIsPrintingTags(false);
    }, 500);
  };

  const confirmPaidStatus = async () => {
    try {
      const nextStatus = ['Payment Pending', 'Credit', 'Paid'].includes(selectedOrder.status)
        ? 'Confirmed'
        : selectedOrder.status;

      // 1. Local DB Updates (Perform this FIRST)
      if (window.electronAPI?.dbQuery) {
        // Update Local Order
        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, paymentStatus = ?, paidAmount = ?, dueAmount = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [nextStatus, 'Paid', selectedOrder.totalAmount, 0, payMethod, new Date().toISOString(), selectedOrder.id]
        );

        // Update Customer Balance if it was Credit/Pending
        if (['Credit', 'Payment Pending'].includes(selectedOrder.status) && selectedOrder.customerId) {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [selectedOrder.totalAmount, new Date().toISOString(), selectedOrder.customerId]
          );
        }

        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
        
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txnId, DEFAULT_SHOP_ID, payMethod, 'INCOME', 'Sales Settlement', selectedOrder.totalAmount, `Payment for Order ${selectedOrder.id}`, txnTimestamp, 0, new Date().toISOString(), 'DollarSign']
        );
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

      // 3. Sync to Backend (fire-and-forget — DO NOT overwrite React state with backend response
      //    because the backend may return stale data or a 404 for legacy orders, which would
      //    visually REVERT the payment in the UI)
      axios.patch(`${API_BASE}/orders/${encodeURIComponent(selectedOrder.id)}/status`, {
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
      // Re-fetch from SQLite to confirm the change persisted in local DB
      fetchOrders();
    } catch (err) {
      console.error('Failed to update local status:', err);
      alert(t('failedRecordPayment', settings.language) + err.message);
    }
  };

  const handleWhatsApp = (phone, id = null) => {
    if (!phone) {
      alert(t('noPhoneFound', settings.language));
      return;
    }

    let cleanPhone = phone.toString().replace(/\D/g, '');
    if (!cleanPhone) {
      alert(t('invalidPhoneFormat', settings.language));
      return;
    }
    
    // Prepend country code if not present
    const countryCode = settings.waCountryCode || '971';
    if (countryCode && !cleanPhone.startsWith(countryCode)) {
      cleanPhone = countryCode + cleanPhone;
    }

    let message = t('waGeneralMessage', settings.language);
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
          <div className={styles.kpiIcon} style={{ background: '#F8FAFC' }}><DollarSign size={18} color="#0F172A" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('totalAmount', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#0F172A' }}>
              <CurrencySymbol size={18} /> {totalAmount.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.length} {t('invoices', settings.language)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.paidCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#ECFDF5' }}><CheckCircle size={18} color="#10B981" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('paid', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#10B981' }}>
              <CurrencySymbol size={18} /> {totalPaid.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.filter(o => (o.dueAmount === 0 || o.dueAmount === null) && o.totalAmount > 0).length} {t('invoices', settings.language)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.pendingCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#FFF7ED' }}><Clock size={18} color="#F97316" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('pending', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#F97316' }}>
              <CurrencySymbol size={18} /> {totalPending.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.filter(o => o.dueAmount > 0).length} {t('invoices', settings.language)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.overdueCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#FEF2F2' }}><AlertCircle size={18} color="#EF4444" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('overdue', settings.language)}</span>
            <span className={styles.kpiValue} style={{ color: '#EF4444' }}>
              <CurrencySymbol size={18} /> {overdueAmount.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{overdueOrdersList.length} {t('invoices', settings.language)}</span>
          </div>
        </div>
      </div>

      {isPendingView && (
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
        </div>
      )}

      {/* Table Section */}
      <div className={isPendingView ? styles.cardGridContainer : styles.tableCard}>
        {isPendingView ? (
          <div className={styles.orderListContainer}>
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <div key={order.id} className={`${styles.premiumListItem} ${isOverdue(order) ? styles.overdueListItem : ''}`}>
                  <div className={styles.listIdSection}>
                    <span className={styles.listIdLabel}>{t('order', settings.language).toUpperCase()}</span>
                    <h3 className={styles.listIdValue}>{order.id}</h3>
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

                  <div className={styles.listFinancialSection}>
                     <div className={styles.listStat}>
                       <span className={styles.listStatLabel}>{t('dueAmount', settings.language)}</span>
                       <span className={styles.listStatValue}><CurrencySymbol size={14} /> {(order.dueAmount ?? order.totalAmount ?? 0).toFixed(2)}</span>
                     </div>
                     <div className={styles.listStat} style={{ marginLeft: '1.5rem' }}>
                       <span className={styles.listStatLabel}>{t('paymentMethodLabel', settings.language)}</span>
                       {order.paymentStatus === 'Paid' ? (
                         <span className={order.paymentMethod?.toUpperCase() === 'CASH' ? styles.methodCash : styles.methodOther} style={{ marginTop: '2px' }}>
                           {order.paymentMethod}
                         </span>
                       ) : (
                         <span className={styles.methodCredit} style={{ marginTop: '2px' }}>
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
                    <span className={styles.listDate}>{new Date(order.createdAt).toLocaleDateString()}</span>
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
                      <MessageCircle size={16} />
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
                <th>{t('customer', settings.language)}</th>
                <th>{t('whatsapp', settings.language)}</th>
                <th>{t('totalAmount', settings.language)}</th>
                <th>{t('paymentMethodLabel', settings.language)}</th>
                <th>{t('status', settings.language)}</th>
                <th>{t('date', settings.language)}</th>
                <th className={styles.actionsHeader}>{t('actions', settings.language)}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                    {t('loading', settings.language)}
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id || order._id} className={styles.orderRow} onClick={() => {
                    setSelectedOrder(order);
                    setShowStatusModal(true);
                  }}>
                    <td className={styles.orderIdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className={styles.qrPlaceholder}><QrCode size={18} /></div>
                        <div>
                          <span className={styles.idText}>{order.id}</span>
                          <span className={styles.billText}>{t('bill', settings.language)}: {order.billNumber || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
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
                          <MessageCircle size={16} />
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
                             order.paymentMethod.toUpperCase() === 'CASH' ? styles.methodCash : 
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
                        {(order.paymentStatus === 'Paid' || (order.dueAmount !== undefined && order.dueAmount <= 0)) && ['Confirmed', 'Payment Pending', 'Credit', 'Pending'].includes(order.status) ? (
                          <span className={`${styles.statusBadge} ${STATUS_COLORS['Paid'] || styles.statusDelivered}`}>
                            {t('paid', settings.language)}
                          </span>
                        ) : (!['Payment Pending', 'Paid', 'Credit'].includes(order.status)) ? (
                          <span className={`${styles.statusBadge} ${STATUS_COLORS[order.status]}`}>
                            {translateStatus(order.status)}
                          </span>
                        ) : (
                          <span className={`${styles.statusBadge} ${styles.statusProcessing}`}>
                            {t('confirmed', settings.language)}
                          </span>
                        )}
                        {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
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
                    <td className={styles.dateText}>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionCellContainer}>
                        <div className={styles.paymentCol}>
                          {order.paymentStatus === 'Paid' ? (
                            <span className={styles.paidActionBadge}>
                              <CheckCircle size={14} /> {t('paid', settings.language)}
                            </span>
                          ) : (order.paymentStatus === 'Credit' || order.paymentStatus === 'Partial') ? (
                            <>
                              <span className={styles.creditActionBadge}>
                                <AlertCircle size={14} /> {order.paymentStatus ? t(order.paymentStatus.toLowerCase(), settings.language) : ''}
                              </span>
                              {order.status !== 'Cancelled' && (
                                <button 
                                  className={styles.payBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(order);
                                    setShowPayModal(true);
                                  }}
                                >
                                  {t('pay', settings.language)}
                                </button>
                              )}
                            </>
                          ) : order.status !== 'Cancelled' ? (
                            <button 
                              className={styles.payBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(order);
                                setShowPayModal(true);
                              }}
                            >
                              {t('pay', settings.language)}
                            </button>
                          ) : null}
                        </div>
                        
                        <div className={styles.moreCol}>
                          <button 
                            className={styles.moreBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                              setShowStatusModal(true);
                            }}
                            title={t('orderDetails', settings.language)}
                          >
                            <MoreHorizontal size={18} />
                          </button>
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
      </div>

      {/* Order Details Drawer/Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.detailsModal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{t('order', settings.language)} {selectedOrder.orderId || selectedOrder.id}</h2>
                <p>{t('createdOn', settings.language)} {new Date(selectedOrder.createdAt).toLocaleString()}</p>
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
                            <MessageCircle size={12} /> {t('whatsapp', settings.language)}
                          </button>
                        </div>
                      </div>
                    </div>
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
                        } catch(e) { console.error("Failed to parse items", e); }
                        
                        return (Array.isArray(items) ? items : []).map((item, i) => (
                          <div key={i} className={styles.orderItem}>
                            <span>{item.qty} x {item.name} {item.type ? `(${t(item.type.toLowerCase(), settings.language)})` : ''}</span>
                            <span><CurrencySymbol size={12} /> {((item.price || 0) * (item.qty || 1)).toFixed(2)}</span>
                          </div>
                        ));
                      })()}
                      <div className={styles.orderTotal}>
                        <span>{selectedOrder.paymentStatus === 'Paid' ? `${t('totalPaidVia', settings.language)} ${getPaymentMethodTranslation(selectedOrder.paymentMethod || 'CASH')}` : `${t('paymentStatus', settings.language)}: ${t('notPaid', settings.language)}`}</span>
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
                                {h.updatedBy === 'Admin Staff' ? t('adminStaff', settings.language) : h.updatedBy === 'Staff' ? t('staff', settings.language) : (h.updatedBy || t('staff', settings.language))} • {h.timestamp ? new Date(h.timestamp).toLocaleString() : t('unknown', settings.language)}
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
                  <div className={styles.qrCard}>
                    <QRCodeSVG value={`ORDER:${selectedOrder.id}`} size={120} />
                    <p>{t('scanToVerify', settings.language)}</p>
                  </div>

                  <div className={styles.statusAction}>
                    <label>{t('workflowStatus', settings.language)}</label>
                    <div className={styles.statusSelectWrapper}>
                      <select 
                        value={['Payment Pending', 'Credit', 'Pending'].includes(selectedOrder.status) ? 'Confirmed' : selectedOrder.status} 
                        onChange={(e) => handleUpdateStatus(e.target.value)}
                        className={styles.statusSelect}
                      >
                        <option value="Confirmed">{translateStatus('Confirmed')}</option>
                        <option value="Picked Up">{translateStatus('Picked Up')}</option>
                        <option value="Washing">{translateStatus('Washing')}</option>
                        <option value="Drying">{translateStatus('Drying')}</option>
                        <option value="Ironing">{translateStatus('Ironing')}</option>
                        <option value="Ready">{translateStatus('Ready')}</option>
                        <option value="Ready to Pick up">{translateStatus('Ready to Pick up')}</option>
                        <option value="Out for Delivery">{translateStatus('Out for Delivery')}</option>
                        <option value="Delivered">{translateStatus('Delivered')}</option>
                        <option value="Cancelled">{translateStatus('Cancelled')}</option>
                      </select>
                      <ChevronDown size={18} />
                    </div>
                  </div>

                  <div className={styles.statusAction} style={{ marginTop: '1rem' }}>
                    <label>{t('paymentStatus', settings.language)}</label>
                    <div className={styles.statusSelectWrapper}>
                      <select 
                        value={selectedOrder.paymentStatus || 'Pending'} 
                        onChange={(e) => handleUpdatePaymentStatus(e.target.value)}
                        className={styles.statusSelect}
                        style={{ borderLeftColor: selectedOrder.paymentStatus === 'Paid' ? '#10B981' : '#F59E0B' }}
                      >
                        <option value="Pending">{t('pending', settings.language)}</option>
                        <option value="Paid">{t('paid', settings.language)}</option>
                        <option value="Credit">{t('credit', settings.language)}</option>
                        <option value="Partial">{t('partial', settings.language)}</option>
                      </select>
                      <ChevronDown size={18} />
                    </div>
                  </div>

                  <div className={styles.actionBtns}>
                    <button 
                      className={styles.printBtn}
                      onClick={() => handlePrint(selectedOrder.id)}
                    >
                      <Printer size={18} /> {t('printReceipt', settings.language)}
                    </button>
                    <button 
                      className={styles.tagBtn}
                      onClick={handlePrintTags}
                    >
                      <QrCode size={18} /> {t('printGarmentTags', settings.language)}
                    </button>
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
        <div className={styles.modalOverlay}>
          <div className={styles.statusModal} style={{ maxWidth: '400px' }}>
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
                  className={`${styles.payOption} ${payMethod === 'CASH' ? styles.payOptionActive : ''}`}
                  onClick={() => setPayMethod('CASH')}
                >
                  <Wallet size={24} />
                  <span>{t('cashaccount', settings.language)}</span>
                </div>
                <div 
                  className={`${styles.payOption} ${payMethod === 'BANK' ? styles.payOptionActive : ''}`}
                  onClick={() => setPayMethod('BANK')}
                >
                  <CreditCard size={24} />
                  <span>{t('bankaccount', settings.language)}</span>
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
