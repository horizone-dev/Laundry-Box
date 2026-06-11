import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, Search, RefreshCw, Clock, Phone, User, X, ChevronDown, 
  CheckCircle, AlertCircle, Trash2, Printer, QrCode, ArrowLeft, 
  ArrowRight, Eye, MessageCircle, Wallet, CreditCard, ShoppingCart
} from 'lucide-react';
import axios from 'axios';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import DressTag from '../components/DressTag';
import { QRCodeSVG } from 'qrcode.react';
import { t } from '../utils/translations';
import { DEFAULT_SHOP_ID, API_BASE_URL } from '../constants';
import { getLocalISOString } from '../utils/dateUtils';
import styles from './Workflow.module.css';

// Status styling colors mapping matching Orders.jsx
const STATUS_COLORS = {
  'Paid': styles.paymentPaid,
  'Pending': styles.paymentPending,
  'Credit': styles.paymentCredit,
  'Partial': styles.paymentPartial,
  'Confirmed': 'bg-blue-100 text-blue-800',
  'Picked Up': 'bg-sky-100 text-sky-800',
  'Washing': 'bg-purple-100 text-purple-800',
  'Drying': 'bg-pink-100 text-pink-800',
  'Ironing': 'bg-amber-100 text-amber-800',
  'Ready': 'bg-emerald-100 text-emerald-800',
  'Ready to Pick up': 'bg-green-100 text-green-800',
  'Out for Delivery': 'bg-rose-100 text-rose-800'
};

export default function Workflow() {
  const navigate = useNavigate();
  const { settings, formatDate } = useSettings();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Drag and drop states
  const [draggedOrderId, setDraggedOrderId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Details Modal states (matching Orders details drawer)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState('Cash');
  const [originalPayStatus, setOriginalPayStatus] = useState(null);
  const [isPrintingTags, setIsPrintingTags] = useState(false);

  // Exclude terminal statuses from Kanban columns
  const columns = useMemo(() => {
    const rawStatuses = settings.workflowStatuses || [
      'Confirmed', 'Picked Up', 'Washing', 'Drying', 
      'Ironing', 'Ready', 'Ready to Pick up', 'Out for Delivery', 
      'Delivered', 'Cancelled'
    ];
    return rawStatuses.filter(status => status !== 'Delivered' && status !== 'Cancelled');
  }, [settings.workflowStatuses]);

  // Fetch active orders from database
  const fetchOrders = async () => {
    if (!window.electronAPI?.dbQuery) return;
    setLoading(true);
    try {
      const query = `
        SELECT orders.*, customers.name AS customerName, customers.phone AS customerPhone 
        FROM orders 
        LEFT JOIN customers ON orders.customerId = customers.id
        WHERE orders.status NOT IN ('Delivered', 'Cancelled')
        ORDER BY orders.createdAt ASC
      `;
      const res = await window.electronAPI.dbQuery(query, []);
      if (res.success) {
        setOrders(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch active orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Filter orders by search term
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(order => {
      const orderId = (order.id || '').toLowerCase();
      const billNo = (order.billNumber || '').toLowerCase();
      const custName = (order.customerName || '').toLowerCase();
      const custPhone = (order.customerPhone || order.phone || '').toLowerCase();
      const items = (order.items || '').toLowerCase();
      return orderId.includes(term) || billNo.includes(term) || custName.includes(term) || custPhone.includes(term) || items.includes(term);
    });
  }, [orders, searchTerm]);

  // Group orders by their workflow status
  const ordersByStatus = useMemo(() => {
    const groups = {};
    columns.forEach(col => {
      groups[col] = [];
    });
    
    filteredOrders.forEach(order => {
      // Map legacy statuses like 'Pending', 'Payment Pending' to 'Confirmed' if not explicitly in workflowStatuses
      let status = order.status;
      if (['Payment Pending', 'Credit', 'Pending'].includes(status)) {
        status = 'Confirmed';
      }
      
      if (groups[status]) {
        groups[status].push(order);
      } else {
        // Fallback to Confirmed if status is unknown/custom and not in columns
        if (groups['Confirmed']) {
          groups['Confirmed'].push(order);
        }
      }
    });
    return groups;
  }, [filteredOrders, columns]);

  // Update order status in Local DB & background sync to Cloud
  const handleUpdateStatus = async (orderId, newStatus) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    if (newStatus === 'Delivered') {
      const statusText = t('delivered', settings.language);
      const confirmMsg = t('confirmStatusChange', settings.language)
        .replace('{id}', orderId)
        .replace('{status}', statusText);
      if (!window.confirm(confirmMsg)) return;
    }

    try {
      let newHistory = [];
      let history = [];
      try {
        history = typeof orderToUpdate.statusHistory === 'string'
          ? JSON.parse(orderToUpdate.statusHistory || '[]')
          : (orderToUpdate.statusHistory || []);
        if (!Array.isArray(history)) history = [];
      } catch (e) {
        history = [];
      }
      const timestamp = getLocalISOString();
      newHistory = [...history, { status: newStatus, updatedBy: 'Admin Staff', timestamp }];

      // Update SQLite Local DB
      if (window.electronAPI?.dbQuery) {
        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, statusHistory = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newStatus, JSON.stringify(newHistory), timestamp, orderId]
        );
      }

      // Update state
      if (['Delivered', 'Cancelled'].includes(newStatus)) {
        // Remove from active Kanban lists
        setOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, statusHistory: newHistory } : o));
      }

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus, statusHistory: newHistory }));
      }

      // Background Cloud sync (non-blocking)
      const API_BASE = API_BASE_URL;
      axios.patch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/status`, {
        status: newStatus,
        updatedBy: 'Admin Staff'
      }).catch(err => {
        console.warn("Cloud sync deferred:", err.message);
      });

    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Error: " + err.message);
    }
  };

  // Payment Status transition (Paid confirmation modal launcher)
  const handleUpdatePaymentStatus = async (newPayStatus) => {
    if (!selectedOrder) return;
    
    if (newPayStatus === 'Paid') {
      setOriginalPayStatus(selectedOrder.paymentStatus);
      setSelectedOrder(prev => ({ ...prev, paymentStatus: 'Paid' }));
      setShowPayModal(true);
      return;
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
        await window.electronAPI.dbQuery(
          'UPDATE orders SET paymentStatus = ?, paidAmount = ?, dueAmount = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newPayStatus, updatedPaidAmount, updatedDueAmount, getLocalISOString(), selectedOrder.id]
        );
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
      alert("Error: " + err.message);
    }
  };

  // Confirm Paid Status
  const confirmPaidStatus = async () => {
    if (!selectedOrder) return;
    try {
      const nextStatus = ['Payment Pending', 'Credit', 'Pending'].includes(selectedOrder.status)
        ? 'Confirmed'
        : selectedOrder.status;

      const amountToPay = selectedOrder.dueAmount > 0 ? selectedOrder.dueAmount : selectedOrder.totalAmount;

      if (window.electronAPI?.dbQuery) {
        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, paymentStatus = ?, paidAmount = ?, dueAmount = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [nextStatus, 'Paid', selectedOrder.totalAmount, 0, payMethod, getLocalISOString(), selectedOrder.id]
        );

        if (selectedOrder.customerId && selectedOrder.customerId !== 'Walk-in') {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [amountToPay, getLocalISOString(), selectedOrder.customerId]
          );
        }

        const txnId = `TXN-${Date.now()}`;
        const _now = new Date();
        const txnTimestamp = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')} ${String(_now.getHours()).padStart(2,'0')}:${String(_now.getMinutes()).padStart(2,'0')}`;
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txnId, DEFAULT_SHOP_ID, payMethod === 'Bank' ? 'BANK' : 'CASH', 'INCOME', 'Sales Settlement', amountToPay, `Payment for Order ${selectedOrder.id}`, txnTimestamp, 0, getLocalISOString(), 'DollarSign']
        );

        await window.electronAPI.dbQuery(
          `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [`PAY-HEAL-${selectedOrder.id}`, selectedOrder.customerId || 'Walk-in', selectedOrder.id, DEFAULT_SHOP_ID, amountToPay, payMethod, 'SUCCESS', getLocalISOString(), getLocalISOString()]
        );

        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }
      }

      const updated = {
        ...selectedOrder,
        status: nextStatus,
        paymentStatus: 'Paid',
        paidAmount: selectedOrder.totalAmount,
        dueAmount: 0,
        paymentMethod: payMethod
      };

      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updated : o));
      setSelectedOrder(updated);
      setShowPayModal(false);
      alert(t('paymentRecordedLocally', settings.language));
      fetchOrders();

      const API_BASE = API_BASE_URL;
      axios.patch(`${API_BASE}/orders/${encodeURIComponent(selectedOrder.id)}/status`, {
        status: nextStatus,
        paymentStatus: 'Paid',
        paidAmount: selectedOrder.totalAmount,
        dueAmount: 0,
        updatedBy: 'Admin Staff'
      }).catch(e => console.warn(e));

    } catch (err) {
      alert("Payment failed: " + err.message);
    }
  };

  // Drag and Drop implementation
  const handleDragStart = (e, orderId) => {
    e.dataTransfer.setData('text/plain', orderId);
    setDraggedOrderId(orderId);
  };

  const handleDragEnd = () => {
    setDraggedOrderId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, columnStatus) => {
    e.preventDefault();
  };

  const handleDragEnter = (e, columnStatus) => {
    e.preventDefault();
    setDragOverColumn(columnStatus);
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('text/plain');
    if (orderId) {
      handleUpdateStatus(orderId, targetStatus);
    }
    setDragOverColumn(null);
    setDraggedOrderId(null);
  };

  // Move status shift shortcut helper
  const handleShiftStatus = (order, direction) => {
    let currentStatus = order.status;
    if (['Payment Pending', 'Credit', 'Pending'].includes(currentStatus)) {
      currentStatus = 'Confirmed';
    }
    const currentIndex = columns.indexOf(currentStatus);
    if (currentIndex === -1) return;

    if (direction === 'next') {
      if (currentIndex < columns.length - 1) {
        handleUpdateStatus(order.id, columns[currentIndex + 1]);
      } else {
        // Last step - shift to Delivered
        handleUpdateStatus(order.id, 'Delivered');
      }
    } else if (direction === 'prev') {
      if (currentIndex > 0) {
        handleUpdateStatus(order.id, columns[currentIndex - 1]);
      }
    }
  };

  // Overdue status calculation
  const getDeliveryStatus = (expectedDateStr) => {
    if (!expectedDateStr) return { label: '', className: '' };
    
    // Normalize date strings
    const rawDate = expectedDateStr.split(' ')[0];
    const expected = new Date(rawDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expected.setHours(0, 0, 0, 0);
    
    const diff = expected - today;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) {
      return { label: `Overdue by ${Math.abs(days)}d`, className: styles.deliveryOverdue };
    } else if (days === 0) {
      return { label: 'Due Today', className: styles.deliveryToday };
    } else if (days === 1) {
      return { label: 'Due Tomorrow', className: styles.deliveryInfo };
    } else {
      return { label: `Due in ${days} days`, className: styles.deliveryInfo };
    }
  };

  // Parse order items for preview text on cards
  const getItemsSummary = (itemsJson) => {
    try {
      const list = typeof itemsJson === 'string' ? JSON.parse(itemsJson || '[]') : (itemsJson || []);
      if (!Array.isArray(list) || list.length === 0) return 'No items';
      return list.map(item => `${item.qty || 1}x ${item.name}`).join(', ');
    } catch (e) {
      return 'Items list';
    }
  };

  // WhatsApp Messaging
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
    const countryCode = settings.waCountryCode || '971';
    if (countryCode && !cleanPhone.startsWith(countryCode)) {
      cleanPhone = countryCode + cleanPhone;
    }
    
    let message = t('waGeneralMessage', settings.language);
    if (id) {
      const orderMatch = orders.find(o => o.id === id);
      const translateOrderSt = (st) => {
        if (!st) return '';
        if (['Payment Pending', 'Credit', 'Pending'].includes(st)) return t('confirmed', settings.language);
        const key = st.charAt(0).toLowerCase() + st.slice(1).replace(/\s+(.)/g, (_, c) => c.toUpperCase());
        const trans = t(key, settings.language);
        return trans === key ? st : trans;
      };
      const statusText = orderMatch ? translateOrderSt(orderMatch.status) : t('confirmed', settings.language);
      message = t('waStatusMessage', settings.language).replace('{id}', id).replace('{status}', statusText);
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const translateStatus = (st) => {
    if (!st) return '';
    if (['Payment Pending', 'Credit', 'Pending'].includes(st)) return t('confirmed', settings.language);
    const key = st.charAt(0).toLowerCase() + st.slice(1).replace(/\s+(.)/g, (_, c) => c.toUpperCase());
    const trans = t(key, settings.language);
    return trans === key ? st : trans;
  };

  const getPaymentMethodTranslation = (method) => {
    if (!method) return '';
    if (method === 'Cash' || method.toUpperCase() === 'CASH') return t('cashaccount', settings.language);
    if (method === 'Bank' || method.toUpperCase() === 'BANK') return t('bankaccount', settings.language);
    if (method === 'Not Paid') return t('notPaid', settings.language) || 'Not Paid';
    if (method === 'Mixed') return 'Mixed';
    return method;
  };

  const handlePrint = (orderId) => {
    navigate(`/invoice/${encodeURIComponent(orderId)}`);
  };

  const handlePrintTags = () => {
    setIsPrintingTags(true);
    setTimeout(() => {
      window.print();
      setIsPrintingTags(false);
    }, 500);
  };

  return (
    <div className={styles.page}>
      
      {/* Header Panel */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h1>{t('workflow', settings.language) || 'Workflow Board'}</h1>
          <p className={styles.subtext}>Monitor and transition operational laundry stages visually.</p>
        </div>
        
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <Search size={18} color="#94A3B8" />
            <input 
              type="text" 
              placeholder={t('searchPlaceholder', settings.language)}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            {searchTerm && (
              <X 
                size={16} 
                color="#94A3B8" 
                style={{ cursor: 'pointer' }} 
                onClick={() => setSearchTerm('')} 
              />
            )}
          </div>
          <button 
            className={styles.refreshBtn} 
            onClick={fetchOrders} 
            title="Refresh Board"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <RefreshCw size={36} className={styles.spinner} />
          <p>{t('loading', settings.language)}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.emptyBoard}>
          <ShoppingCart size={48} color="#CBD5E1" />
          <h3>No Active Orders</h3>
          <p className={styles.emptyBoardText}>All orders have been delivered or cancelled. Create a new order to track its status.</p>
        </div>
      ) : (
        /* Kanban Lane Grid */
        <div className={styles.boardContainer}>
          {columns.map(col => {
            const laneOrders = ordersByStatus[col] || [];
            const isDragOver = dragOverColumn === col;
            
            return (
              <div 
                key={col} 
                className={`${styles.column} ${isDragOver ? styles.columnDragOver : ''}`}
                data-status={col}
                onDragOver={(e) => handleDragOver(e, col)}
                onDragEnter={(e) => handleDragEnter(e, col)}
                onDrop={(e) => handleDrop(e, col)}
              >
                <div className={styles.columnHeader}>
                  <div className={styles.columnTitle}>
                    <span>{translateStatus(col)}</span>
                  </div>
                  <span className={styles.countBadge}>{laneOrders.length}</span>
                </div>

                <div className={styles.cardsContainer} onDragLeave={() => setDragOverColumn(null)}>
                  {laneOrders.length > 0 ? (
                    laneOrders.map(order => {
                      const delivery = getDeliveryStatus(order.expectedDeliveryDate);
                      const isExpress = order.specialInstructions?.toLowerCase().includes('express') || order.items?.toLowerCase().includes('express');
                      
                      return (
                        <div 
                          key={order.id}
                          className={`${styles.card} ${draggedOrderId === order.id ? styles.cardDragging : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedOrder(order)}
                        >
                          <div className={styles.cardHeader}>
                            <div>
                              <span className={styles.orderId}>{order.id}</span>
                              <span className={styles.billNum}>{t('bill', settings.language)}: {order.billNumber || 'N/A'}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                              <span className={`${styles.paymentBadge} ${
                                order.paymentStatus === 'Paid' ? styles.paymentPaid :
                                order.paymentStatus === 'Credit' ? styles.paymentCredit :
                                order.paymentStatus === 'Partial' ? styles.paymentPartial :
                                styles.paymentPending
                              }`}>
                                {order.paymentStatus ? t(order.paymentStatus.toLowerCase(), settings.language) : t('pending', settings.language)}
                              </span>
                              {isExpress && <span className={styles.expressBadge}>Express</span>}
                            </div>
                          </div>

                          <div className={styles.customerInfo}>
                            <span className={styles.custName}>
                              {order.customerName || (order.customerId === 'Walk-in' ? t('walkInCustomer', settings.language) : order.customerId)}
                            </span>
                            <span className={styles.custPhone}>
                              {order.customerPhone || order.phone || t('noPhone', settings.language)}
                            </span>
                          </div>

                          <div className={styles.itemsSummary}>
                            {getItemsSummary(order.items)}
                          </div>

                          <div className={styles.cardFooter}>
                            <span className={styles.price}>
                              <CurrencySymbol size={11} /> {order.totalAmount?.toFixed(2)}
                            </span>
                            {delivery.label && (
                              <span className={`${styles.deliveryInfo} ${delivery.className}`}>
                                <Clock size={11} />
                                {delivery.label}
                              </span>
                            )}
                          </div>

                          {/* Quick shifts actions */}
                          <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                            {columns.indexOf(col) > 0 && (
                              <button 
                                className={styles.actionBtn} 
                                onClick={() => handleShiftStatus(order, 'prev')}
                                title="Move Back"
                              >
                                <ArrowLeft size={12} />
                              </button>
                            )}
                            <button 
                              className={styles.actionBtn} 
                              onClick={() => setSelectedOrder(order)}
                              title="View Details"
                            >
                              <Eye size={12} />
                            </button>
                            <button 
                              className={styles.actionBtn} 
                              onClick={() => handleShiftStatus(order, 'next')}
                              title={columns.indexOf(col) === columns.length - 1 ? "Mark Delivered" : "Move Forward"}
                            >
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={styles.emptyLane}>
                      <Clock size={20} color="#CBD5E1" />
                      <div className={styles.emptyLaneText}>No orders here</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Dialog Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{t('order', settings.language)} {selectedOrder.id}</h2>
                <p>{t('createdOn', settings.language)} {formatDate(selectedOrder.createdAt)}</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setSelectedOrder(null)} />
            </div>

            <div className={styles.modalContent}>
              <div className={styles.detailsGrid}>
                {/* Left side details */}
                <div className={styles.infoCol}>
                  <div className={styles.section}>
                    <h3>{t('customerInfo', settings.language)}</h3>
                    <div className={styles.infoCard}>
                      <User size={16} style={{ marginTop: '2px', color: '#64748B' }} />
                      <div>
                        <p className={styles.infoVal}>
                          {selectedOrder.customerName || (selectedOrder.customerId === 'Walk-in' ? t('walkInCustomer', settings.language) : selectedOrder.customerId)}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                          <p className={styles.infoSub}>
                            {selectedOrder.customerPhone || selectedOrder.phone || t('noPhone', settings.language)} • {selectedOrder.customerId}
                          </p>
                          {(selectedOrder.customerPhone || selectedOrder.phone) && (
                            <button 
                              className={styles.waBtnMini}
                              onClick={() => handleWhatsApp(selectedOrder.customerPhone || selectedOrder.phone, selectedOrder.id)}
                            >
                              <MessageCircle size={10} /> {t('whatsapp', settings.language)}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedOrder.expectedDeliveryDate && (
                    <div className={styles.section}>
                      <h3>Expected Delivery</h3>
                      <div className={styles.infoCard}>
                        <Clock size={16} color="#E11D48" style={{ marginTop: '2px' }} />
                        <div>
                          <p className={styles.infoVal} style={{ color: '#E11D48' }}>
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
                        } catch(e) { console.error("Parse items failed", e); }
                        
                        return (Array.isArray(items) ? items : []).map((item, i) => {
                          let treatmentLabel = '';
                          if (item.types && Array.isArray(item.types) && item.types.length > 0) {
                            treatmentLabel = item.types.map(tp => tp.name).join(' + ');
                          } else if (item.type) {
                            treatmentLabel = item.type;
                          }
                          return (
                            <div key={i} className={styles.orderItem}>
                              <span>{item.qty} x {item.name}{treatmentLabel ? ` (${treatmentLabel})` : ''}</span>
                              <span><CurrencySymbol size={11} /> {((item.price || 0) * (item.qty || 1)).toFixed(2)}</span>
                            </div>
                          );
                        });
                      })()}
                      <div className={styles.orderTotal}>
                        <span>
                          {selectedOrder.paymentStatus === 'Paid' 
                            ? `${t('totalPaidVia', settings.language)} ${getPaymentMethodTranslation(selectedOrder.paymentMethod || 'Cash')}` 
                            : `${t('paymentStatus', settings.language)}: ${t(selectedOrder.paymentStatus?.toLowerCase() || 'notPaid', settings.language)}`
                          }
                        </span>
                        <span><CurrencySymbol size={13} /> {(selectedOrder.totalAmount || 0).toFixed(2)}</span>
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
                        } catch(e) { console.error(e); }
                        
                        return (Array.isArray(history) ? history : []).map((h, i) => (
                          <div key={i} className={styles.timelineItem}>
                            <div className={styles.timelineDot}></div>
                            <div className={styles.timelineContent}>
                              <p className={styles.timelineStatus}>{translateStatus(h.status)}</p>
                              <p className={styles.timelineMeta}>
                                {h.updatedBy || 'Staff'} • {h.timestamp ? formatDate(h.timestamp) : 'N/A'}
                              </p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right side controls */}
                <div className={styles.actionCol}>
                  <div className={styles.qrCard}>
                    <QRCodeSVG value={`ORDER:${selectedOrder.id}`} size={110} />
                    <p>Scan to verify order status</p>
                  </div>

                  <div className={styles.statusAction}>
                    <label>Workflow Stage</label>
                    <div className={styles.statusSelectWrapper}>
                      <select 
                        value={['Payment Pending', 'Credit', 'Pending'].includes(selectedOrder.status) ? 'Confirmed' : selectedOrder.status} 
                        onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value)}
                        className={styles.statusSelect}
                      >
                        {columns.map(status => (
                          <option key={status} value={status}>{translateStatus(status)}</option>
                        ))}
                      </select>
                      <ChevronDown size={18} />
                    </div>
                  </div>

                  <div className={styles.statusAction}>
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
                      <Printer size={16} /> {t('printReceipt', settings.language)}
                    </button>
                    <button 
                      className={styles.tagBtn}
                      onClick={handlePrintTags}
                    >
                      <QrCode size={16} /> {t('printGarmentTags', settings.language)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print element for tags */}
      {isPrintingTags && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'white', zIndex: 9999 }}>
          <DressTag order={selectedOrder} />
        </div>
      )}

      {/* Settle payment selection modal */}
      {showPayModal && (
        <div className={styles.payModalOverlay}>
          <div className={styles.payModal}>
            <div className={styles.modalHeader} style={{ padding: '0 0 1rem 0' }}>
              <h2 style={{ fontSize: '1.15rem' }}>{t('confirmPayment', settings.language)}</h2>
              <X size={20} className={styles.closeBtn} onClick={() => { setShowPayModal(false); if (originalPayStatus) setSelectedOrder(prev => ({ ...prev, paymentStatus: originalPayStatus })); }} />
            </div>
            
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.5rem 0 1.5rem' }}>
              Select transaction account for Order <strong>#{selectedOrder.id}</strong> payment:
            </p>

            <div className={styles.payOptionGrid}>
              <div 
                className={`${styles.payOption} ${payMethod === 'Cash' ? styles.payOptionActive : ''}`}
                onClick={() => setPayMethod('Cash')}
              >
                <Wallet size={20} />
                <span>Cash Drawer</span>
              </div>
              <div 
                className={`${styles.payOption} ${payMethod === 'Bank' ? styles.payOptionActive : ''}`}
                onClick={() => setPayMethod('Bank')}
              >
                <CreditCard size={20} />
                <span>Bank / Card</span>
              </div>
            </div>

            <div className={styles.btnRow}>
              <button 
                className={styles.secondaryBtn}
                onClick={() => {
                  setShowPayModal(false);
                  if (originalPayStatus) {
                    setSelectedOrder(prev => ({ ...prev, paymentStatus: originalPayStatus }));
                  }
                }}
              >
                {t('cancel', settings.language)}
              </button>
              <button 
                className={styles.printBtn} 
                style={{ flex: 1.5 }}
                onClick={confirmPaidStatus}
              >
                {t('recordPayment', settings.language)}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
