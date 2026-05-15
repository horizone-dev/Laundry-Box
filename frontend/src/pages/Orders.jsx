import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, ChevronLeft, ChevronRight, MoreHorizontal, 
  Clock, Package, CheckCircle, AlertCircle, ChevronDown, 
  X, Printer, CreditCard, Wallet, User, History, QrCode, MessageCircle, Phone, DollarSign
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { useSettings } from '../store/SettingsContext';
import { t } from '../utils/translations';
import CurrencySymbol from '../components/CurrencySymbol';
import DressTag from '../components/DressTag';
import styles from './Orders.module.css';

const API_BASE = 'http://localhost:3000/api';

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
      if (!window.confirm(`Are you sure you want to mark Order #${orderToUpdate.id} as ${newStatus}?`)) return;
    }

    try {
      // 1. Update Local DB First (Offline-First approach)
      let newHistory = [];
      if (window.electronAPI?.dbQuery) {
        const history = typeof orderToUpdate.statusHistory === 'string' ? JSON.parse(orderToUpdate.statusHistory) : (orderToUpdate.statusHistory || []);
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
      alert('Critical: Failed to save status update to local database.');
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
          'UPDATE orders SET paymentStatus = ?, updatedAt = ? WHERE id = ?',
          [newPayStatus, new Date().toISOString(), selectedOrder.id]
        );
        
        // If changing to Credit, update customer balance
        if (newPayStatus === 'Credit' && selectedOrder.customerId) {
           await window.electronAPI.dbQuery(
             'UPDATE customers SET balance = balance + ? WHERE id = ?',
             [selectedOrder.dueAmount || selectedOrder.totalAmount, selectedOrder.customerId]
           );
        }
      }

      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, paymentStatus: newPayStatus } : o));
      setSelectedOrder(prev => ({ ...prev, paymentStatus: newPayStatus }));
      alert('Payment status updated!');
    } catch (err) {
      console.error('Failed to update payment status:', err);
      alert('Update failed: ' + err.message);
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
      // 1. Local DB Updates (Perform this FIRST)
      if (window.electronAPI?.dbQuery) {
        // Update Local Order
        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, paymentStatus = ?, paidAmount = ?, dueAmount = ?, updatedAt = ? WHERE id = ?',
          ['Paid', 'Paid', selectedOrder.totalAmount, 0, new Date().toISOString(), selectedOrder.id]
        );

        // Update Customer Balance if it was Credit/Pending
        if (['Credit', 'Payment Pending'].includes(selectedOrder.status) && selectedOrder.customerId) {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance - ?, updatedAt = ? WHERE id = ?',
            [selectedOrder.totalAmount, new Date().toISOString(), selectedOrder.customerId]
          );
        }

        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
        
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txnId, 'SHOP_01', payMethod, 'INCOME', 'Sales Settlement', selectedOrder.totalAmount, `Payment for Order ${selectedOrder.id}`, txnTimestamp, 0, new Date().toISOString(), 'DollarSign']
        );
      }

      // 2. Sync to Backend (Perform this SECOND)
      try {
        const res = await axios.patch(`${API_BASE}/orders/${encodeURIComponent(selectedOrder.id)}/status`, {
          status: 'Paid',
          paymentStatus: 'Paid',
          paidAmount: selectedOrder.totalAmount,
          dueAmount: 0,
          updatedBy: 'Admin Staff'
        });
        // Update local state with fresh data from backend
        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? res.data : o));
        setSelectedOrder(res.data);
      } catch (syncErr) {
        console.warn('Backend sync failed, but local payment recorded:', syncErr);
        // Manually update local state if sync fails
        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: 'Paid' } : o));
      }

      setShowPayModal(false);
      alert('Order marked as Paid and transaction recorded locally!');
      // fetchOrders(); // Removed to avoid flicker, using state update instead
    } catch (err) {
      console.error('Failed to update local status:', err);
      alert('Failed to record payment: ' + err.message);
    }
  };

  const handleWhatsApp = (phone, id = null) => {
    if (!phone) {
      alert("No phone number found for this customer.");
      return;
    }

    let cleanPhone = phone.toString().replace(/\D/g, '');
    if (!cleanPhone) {
      alert("Invalid phone number format.");
      return;
    }
    
    // Prepend country code if not present
    const countryCode = settings.waCountryCode || '971';
    if (countryCode && !cleanPhone.startsWith(countryCode)) {
      cleanPhone = countryCode + cleanPhone;
    }

    let message = `Hello! This is regarding your laundry order.`;
    if (id) {
      message = `Hello! This is regarding your laundry order #${id}. Your current status is: ${selectedOrder?.status || 'Processing'}.`;
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
          <h1>{isPendingView ? 'Pending Payments' : 'Order Management'}</h1>
          <p>
            {isPendingView 
              ? 'View and settle orders with outstanding credit balances.' 
              : 'Track laundry status, generate QR receipts, and manage deliveries.'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBox}>
            <Search size={18} color="#94A3B8" />
            <input 
              type="text" 
              placeholder="Search by ID, QR, Bill, or Name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className={styles.settleBtn} onClick={() => navigate('/settlement')}>
            <DollarSign size={18} /> Settle Bill
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            + New Order
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.totalCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#F8FAFC' }}><DollarSign size={18} color="#0F172A" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Total Amount</span>
            <span className={styles.kpiValue} style={{ color: '#0F172A' }}>
              <CurrencySymbol size={18} /> {totalAmount.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.length} invoices</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.paidCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#ECFDF5' }}><CheckCircle size={18} color="#10B981" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Paid</span>
            <span className={styles.kpiValue} style={{ color: '#10B981' }}>
              <CurrencySymbol size={18} /> {totalPaid.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.filter(o => (o.dueAmount === 0 || o.dueAmount === null) && o.totalAmount > 0).length} invoices</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.pendingCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#FFF7ED' }}><Clock size={18} color="#F97316" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Pending</span>
            <span className={styles.kpiValue} style={{ color: '#F97316' }}>
              <CurrencySymbol size={18} /> {totalPending.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{orders.filter(o => o.dueAmount > 0).length} invoices</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.overdueCard}`}>
          <div className={styles.kpiIcon} style={{ background: '#FEF2F2' }}><AlertCircle size={18} color="#EF4444" /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Overdue</span>
            <span className={styles.kpiValue} style={{ color: '#EF4444' }}>
              <CurrencySymbol size={18} /> {overdueAmount.toFixed(2)}
            </span>
            <span className={styles.kpiSub}>{overdueOrdersList.length} invoices</span>
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
                    <span className={styles.listIdLabel}>ORDER</span>
                    <h3 className={styles.listIdValue}>{order.id}</h3>
                  </div>

                  <div className={styles.listCustomerSection}>
                    <div className={styles.listAvatar}>
                      {order.customerName ? order.customerName.charAt(0).toUpperCase() : 'W'}
                    </div>
                    <div className={styles.listUserInfo}>
                      <p className={styles.listCustName}>{order.customerName || 'Walk-in Customer'}</p>
                      <p className={styles.listCustPhone}>{order.customerPhone || order.phone || 'No Phone'}</p>
                    </div>
                  </div>

                  <div className={styles.listFinancialSection}>
                    <div className={styles.listStat}>
                      <span className={styles.listStatLabel}>Amount Due</span>
                      <span className={styles.listStatValue}><CurrencySymbol size={14} /> {order.dueAmount || order.totalAmount?.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className={styles.listStatusSection}>
                    {isOverdue(order) ? (
                      <span className={styles.listBadgeOverdue}>Overdue</span>
                    ) : (
                      <span className={styles.listBadgePending}>Pending</span>
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
                      <DollarSign size={16} /> Collect
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
              <div className={styles.noData}>No pending payments found.</div>
            )}
          </div>
        ) : (
          <table className={styles.ordersTable}>
            <thead>
              <tr>
                <th>{t('orderId', settings.language)}</th>
                <th>{t('customer', settings.language)}</th>
                <th>{t('totalAmount', settings.language)}</th>
                <th>{t('status', settings.language)}</th>
                <th>{t('date', settings.language)}</th>
                <th>{t('actions', settings.language)}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading...
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
                          <span className={styles.billText}>Bill: {order.billNumber || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.custCell}>
                        <span className={styles.custName}>
                          {order.customerName || (order.customerId === 'Walk-in' ? 'Walk-in Customer' : order.customerId)}
                        </span>
                        <div className={styles.custPhoneRow}>
                          <Phone size={12} color="#2563EB" />
                          <span className={styles.custPhone}>
                            {order.customerPhone || order.phone || 'No Phone'}
                          </span>
                          <div className={styles.waBadge} onClick={(e) => {
                            e.stopPropagation();
                            handleWhatsApp(order.customerPhone || order.phone, order.id);
                          }}>
                            <MessageCircle size={10} color="#FFF" />
                            WA
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.amountText}><CurrencySymbol size={14} /> {order.totalAmount?.toFixed(2)}</td>
                    <td>
                      {(!['Payment Pending', 'Paid', 'Credit'].includes(order.status)) ? (
                        <span className={`${styles.statusBadge} ${STATUS_COLORS[order.status]}`}>
                          {order.status}
                        </span>
                      ) : (
                        <span className={`${styles.statusBadge} ${styles.statusProcessing}`}>
                          Confirmed
                        </span>
                      )}
                    </td>
                    <td className={styles.dateText}>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {order.paymentStatus === 'Paid' ? (
                          <span className={styles.paidActionBadge}>
                            <CheckCircle size={14} /> Paid
                          </span>
                        ) : (order.paymentStatus === 'Credit' || order.paymentStatus === 'Partial') ? (
                          <span className={styles.creditActionBadge}>
                            <AlertCircle size={14} /> {order.paymentStatus}
                          </span>
                        ) : order.status !== 'Cancelled' ? (
                          <button 
                            className={styles.payBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                              setShowPayModal(true);
                            }}
                          >
                            Pay
                          </button>
                        ) : null}
                         <MoreHorizontal size={18} className={styles.moreBtn} />
                        {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                          <button 
                            className={styles.deliverBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus('Delivered', order);
                            }}
                          >
                            Deliver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    {isPendingView ? 'No pending payments found.' : 'No orders found.'}
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
                <h2>Order {selectedOrder.orderId}</h2>
                <p>Created on {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setSelectedOrder(null)} />
            </div>

            <div className={styles.modalContent}>
              <div className={styles.detailsGrid}>
                {/* Left: Info */}
                <div className={styles.infoCol}>
                  <div className={styles.section}>
                    <h3>Customer Info</h3>
                    <div className={styles.infoCard}>
                      <User size={16} />
                      <div>
                        <p className={styles.infoVal}>
                          {selectedOrder.customerName || (selectedOrder.customerId === 'Walk-in' ? 'Walk-in Customer' : selectedOrder.customerId)}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <p className={styles.infoSub}>
                            {selectedOrder.customerPhone || selectedOrder.phone || 'No Phone'} • {selectedOrder.customerId}
                          </p>
                          <button 
                            className={styles.waBtnMini}
                            onClick={() => handleWhatsApp(selectedOrder.customerPhone || selectedOrder.phone, selectedOrder.id)}
                          >
                            <MessageCircle size={12} /> WhatsApp
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.section}>
                    <h3>Order Items</h3>
                    <div className={styles.itemsList}>
                      {(typeof selectedOrder.items === 'string' ? JSON.parse(selectedOrder.items) : selectedOrder.items).map((item, i) => (
                        <div key={i} className={styles.orderItem}>
                          <span>{item.qty} x {item.name} ({item.type})</span>
                          <span><CurrencySymbol size={12} /> {(item.price * item.qty).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className={styles.orderTotal}>
                        <span>Total Paid via {selectedOrder.paymentMethod || 'CASH'}</span>
                        <span><CurrencySymbol size={14} /> {selectedOrder.totalAmount?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.section}>
                    <h3>Status History</h3>
                    <div className={styles.timeline}>
                      {(typeof selectedOrder.statusHistory === 'string' ? JSON.parse(selectedOrder.statusHistory) : (selectedOrder.statusHistory || [])).map((h, i) => (
                        <div key={i} className={styles.timelineItem}>
                          <div className={styles.timelineDot}></div>
                          <div className={styles.timelineContent}>
                            <p className={styles.timelineStatus}>{h.status}</p>
                            <p className={styles.timelineMeta}>{h.updatedBy || 'Staff'} • {new Date(h.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Actions & QR */}
                <div className={styles.actionCol}>
                  <div className={styles.qrCard}>
                    <QRCodeSVG value={`ORDER:${selectedOrder.id}`} size={120} />
                    <p>Scan to verify order</p>
                  </div>

                  <div className={styles.statusAction}>
                    <label>WORKFLOW STATUS</label>
                    <div className={styles.statusSelectWrapper}>
                      <select 
                        value={selectedOrder.status} 
                        onChange={(e) => handleUpdateStatus(e.target.value)}
                        className={styles.statusSelect}
                      >
                        <option>Confirmed</option>
                        <option>Picked Up</option>
                        <option>Washing</option>
                        <option>Drying</option>
                        <option>Ironing</option>
                        <option>Ready</option>
                        <option>Ready to Pick up</option>
                        <option>Out for Delivery</option>
                        <option>Delivered</option>
                        <option>Cancelled</option>
                      </select>
                      <ChevronDown size={18} />
                    </div>
                  </div>

                  <div className={styles.statusAction} style={{ marginTop: '1rem' }}>
                    <label>PAYMENT STATUS</label>
                    <div className={styles.statusSelectWrapper}>
                      <select 
                        value={selectedOrder.paymentStatus || 'Pending'} 
                        onChange={(e) => handleUpdatePaymentStatus(e.target.value)}
                        className={styles.statusSelect}
                        style={{ borderLeftColor: selectedOrder.paymentStatus === 'Paid' ? '#10B981' : '#F59E0B' }}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                        <option value="Credit">Credit</option>
                        <option value="Partial">Partial</option>
                      </select>
                      <ChevronDown size={18} />
                    </div>
                  </div>

                  <div className={styles.actionBtns}>
                    <button 
                      className={styles.printBtn}
                      onClick={() => handlePrint(selectedOrder.id)}
                    >
                      <Printer size={18} /> Print Receipt
                    </button>
                    <button 
                      className={styles.tagBtn}
                      onClick={handlePrintTags}
                    >
                      <QrCode size={18} /> Print Garment Tags
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
              <h2>Confirm Payment</h2>
              <X size={24} className={styles.closeBtn} onClick={() => setShowPayModal(false)} />
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: '1.5rem', color: '#64748B' }}>
                You are marking Order <strong>{selectedOrder?.id}</strong> as <strong>Paid</strong>. 
                Please select where the payment should be recorded:
              </p>
              
              <div className={styles.payOptionGrid}>
                <div 
                  className={`${styles.payOption} ${payMethod === 'CASH' ? styles.payOptionActive : ''}`}
                  onClick={() => setPayMethod('CASH')}
                >
                  <Wallet size={24} />
                  <span>Cash Account</span>
                </div>
                <div 
                  className={`${styles.payOption} ${payMethod === 'BANK' ? styles.payOptionActive : ''}`}
                  onClick={() => setPayMethod('BANK')}
                >
                  <CreditCard size={24} />
                  <span>Bank Account</span>
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
                  Cancel
                </button>
                <button className={styles.printBtn} style={{ flex: 1.5 }} onClick={confirmPaidStatus}>Record Payment</button>
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
