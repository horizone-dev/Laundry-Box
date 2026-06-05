import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Trash2, Calendar, Download, Printer, Search,
  Users, DollarSign, AlertTriangle
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { useNavigate } from 'react-router-dom';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './DeletedOrders.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export default function DeletedOrders() {
  const { settings, formatDate } = useSettings();
  const navigate = useNavigate();

  const [pinVerified, setPinVerified] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handlePinSubmit = (e) => {
    e.preventDefault();
    const correctPin = settings.orderDeletePin || '0000';
    if (enteredPin === correctPin) {
      setPinVerified(true);
      setPinError('');
    } else {
      setPinError('Invalid PIN code. Please try again.');
      setEnteredPin('');
    }
  };

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('All');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);

      // A. Fetch locally from SQLite (if electron app)
      if (window.electronAPI?.dbQuery) {
        let query = 'SELECT * FROM deleted_orders';
        let params = [];

        // Apply local date filters if not "All"
        if (dateRange !== 'All') {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          if (dateRange === 'Today') {
            const start = new Date(today).toISOString();
            const end = new Date(today);
            end.setHours(23, 59, 59, 999);
            query += ' WHERE deletedAt >= ? AND deletedAt <= ?';
            params = [start, end.toISOString()];
          } else if (dateRange === 'This Week') {
            const first = today.getDate() - today.getDay();
            const start = new Date(today.setDate(first)).toISOString();
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            query += ' WHERE deletedAt >= ? AND deletedAt <= ?';
            params = [start, end.toISOString()];
          } else if (dateRange === 'This Month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            query += ' WHERE deletedAt >= ? AND deletedAt <= ?';
            params = [start, end.toISOString()];
          } else if (dateRange === 'Custom' && customStart && customEnd) {
            const start = new Date(customStart);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customEnd);
            end.setHours(23, 59, 59, 999);
            query += ' WHERE deletedAt >= ? AND deletedAt <= ?';
            params = [start.toISOString(), end.toISOString()];
          }
        }

        query += ' ORDER BY deletedAt DESC';
        const res = await window.electronAPI.dbQuery(query, params);
        setOrders(res.success ? res.data : []);
        setLoading(false);
        return;
      }

      // B. Fallback to Remote API
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/orders/deleted`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch deleted orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsReturned = async (orderId) => {
    if (!window.confirm('Are you sure you want to mark this payment as returned/refunded to the customer?')) return;
    try {
      if (window.electronAPI?.dbQuery) {
        await window.electronAPI.dbQuery(
          "UPDATE deleted_orders SET returnStatus = 'Returned' WHERE id = ?",
          [orderId]
        );
      }
      
      // Update state locally
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, returnStatus: 'Returned' } : o));
      
      // Attempt backend sync
      try {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/orders/deleted/${encodeURIComponent(orderId)}/refund`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnStatus: 'Returned' })
        });
      } catch (remoteErr) {
        console.warn('Backend sync failed (offline):', remoteErr.message);
      }
      
      alert('Payment marked as returned successfully.');
    } catch (err) {
      console.error('Failed to mark as returned:', err);
      alert('Failed to update return status: ' + err.message);
    }
  };

  useEffect(() => {
    if (pinVerified) fetchData();
  }, [pinVerified, dateRange, customStart, customEnd]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Remote date filtering (since backend doesn't filter by date range yet)
      if (!window.electronAPI?.dbQuery && dateRange !== 'All') {
        const delDate = new Date(o.deletedAt);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateRange === 'Today') {
          const start = new Date(today);
          const end = new Date(today);
          end.setHours(23, 59, 59, 999);
          if (delDate < start || delDate > end) return false;
        } else if (dateRange === 'This Week') {
          const first = today.getDate() - today.getDay();
          const start = new Date(today.setDate(first));
          if (delDate < start) return false;
        } else if (dateRange === 'This Month') {
          const start = new Date(today.getFullYear(), today.getMonth(), 1);
          if (delDate < start) return false;
        } else if (dateRange === 'Custom' && customStart && customEnd) {
          const start = new Date(customStart);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (delDate < start || delDate > end) return false;
        }
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const ref = (o.billNumber || o.id || '').toLowerCase();
        const name = (o.customerName || '').toLowerCase();
        const phone = (o.customerPhone || '').toLowerCase();
        const deletedBy = (o.deletedBy || '').toLowerCase();
        const approvedBy = (o.approvedBy || '').toLowerCase();
        if (!ref.includes(q) && !name.includes(q) && !phone.includes(q) && !deletedBy.includes(q) && !approvedBy.includes(q)) return false;
      }
      return true;
    });
  }, [orders, searchTerm, dateRange, customStart, customEnd]);

  // KPIs
  const totalDeleted = filteredOrders.length;
  const totalVoidedAmount = filteredOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  // Export CSV
  const exportCSV = () => {
    const headers = ['Deletion Date', 'Order ID', 'Bill No.', 'Customer', 'Phone', 'Items', 'Approved By', 'Original Payment Status', 'Paid Amount', 'Refund/Return Status', 'Voided Amount'];
    const rows = filteredOrders.map(o => {
      let items = '';
      try {
        const parsed = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
        items = parsed.map(i => `${i.qty || 1}x ${i.name}`).join('; ');
      } catch (_) {}
      return [
        formatDate(o.deletedAt),
        `"${o.id}"`,
        `"${o.billNumber || ''}"`,
        `"${o.customerName || 'Walk-in'}"`,
        o.customerPhone || '',
        `"${items}"`,
        `"${o.deletedBy || '—'}"`,
        `"${o.originalPaymentStatus || 'N/A'}"`,
        (o.paidAmount || 0).toFixed(2),
        `"${o.returnStatus || 'N/A'}"`,
        (o.totalAmount || 0).toFixed(2)
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `deleted_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!pinVerified) {
    return (
      <div className={styles.pinContainer}>
        <motion.div 
          className={styles.pinCard}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.pinIconBox}>
            <AlertTriangle size={32} />
          </div>
          <h2>Enter Security PIN</h2>
          <p>This area contains sensitive voided order logs. Please input the security PIN to proceed.</p>
          <form onSubmit={handlePinSubmit}>
            <input 
              type="password" 
              placeholder="••••" 
              maxLength={8}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className={styles.pinInput}
            />
            {pinError && <span className={styles.pinErrorText}>{pinError}</span>}
            <div className={styles.pinActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => navigate('/')}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn}>
                Verify PIN
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <div className={styles.breadcrumb}>Orders / Audit</div>
          <h1>Deleted Orders Log</h1>
          <p className={styles.subtext}>Monitor order voids and deletion timestamps.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.clearBtn} onClick={exportCSV} title="Export CSV Report">
            <Download size={16} /> Export Report
          </button>
          <button className={styles.clearBtn} onClick={() => window.print()} title="Print Audit Log">
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className={styles.kpiCard}>
          <div className={styles.cardHeader}>
            <span className={styles.kpiLabel}>Total Voided Orders</span>
            <div className={styles.iconBox} style={{ background: '#FEE2E2', color: '#EF4444' }}>
              <Trash2 size={20} />
            </div>
          </div>
          <div className={styles.kpiValue}>{totalDeleted}</div>
          <div className={styles.kpiSubtext}>Permanently removed from bills</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.cardHeader}>
            <span className={styles.kpiLabel}>Total Voided Amount</span>
            <div className={styles.iconBox} style={{ background: '#FEF3C7', color: '#D97706' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            <CurrencySymbol size={20} /> {totalVoidedAmount.toFixed(2)}
          </div>
          <div className={styles.kpiSubtext}>Revenue removed from accounting</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className={styles.tableCard}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by ID, customer name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filterControls}>
            <Calendar size={16} color="#64748B" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Custom">Custom Date Range</option>
            </select>

            {dateRange === 'Custom' && (
              <div className={styles.customDates}>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className={styles.dateInput}
                />
                <span className={styles.dateSep}>to</span>
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

        {/* Table View */}
        {loading ? (
          <div className={styles.emptyRow}>
            <p>Loading audit logs...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Deletion Date</th>
                <th>Order Ref</th>
                <th>Customer</th>
                <th>Items Summary</th>
                <th>Approved By</th>
                <th>Return Status</th>
                <th className={styles.numCol}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, idx) => (
                <tr key={order.id || idx} className={styles.tableRow}>
                  <td className={styles.dateCell}>
                    <div>{formatDate(order.deletedAt)}</div>
                    <div className={styles.timeText}>
                      {new Date(order.deletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td>
                    <span className={styles.billRef}>{order.id}</span>
                    {order.billNumber && (
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>
                        Bill: {order.billNumber}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={styles.customerName}>{order.customerName || 'Walk-in Customer'}</div>
                    {order.customerPhone && <div className={styles.customerPhone}>{order.customerPhone}</div>}
                  </td>
                  <td className={styles.itemsCell}>
                    {(() => {
                      try {
                        const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
                        return items.map((i, k) => (
                          <div key={k}>{i.qty || 1} x {i.name}</div>
                        ));
                      } catch (_) {
                        return <span className={styles.dash}>-</span>;
                      }
                    })()}
                  </td>
                  <td>
                    <div className={styles.customerName}>{order.deletedBy || '—'}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                      {order.returnStatus === 'Return Pending' ? (
                        <>
                          <span className={styles.badgePending}>Return Payment</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                            Paid: <CurrencySymbol size={10} /> {(order.paidAmount || 0).toFixed(2)} ({order.originalPaymentStatus})
                          </span>
                          <button
                            className={styles.refundBtn}
                            onClick={() => handleMarkAsReturned(order.id)}
                          >
                            Mark Returned
                          </button>
                        </>
                      ) : order.returnStatus === 'Returned' ? (
                        <>
                          <span className={styles.badgeReturned}>Returned</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>
                            Refunded: <CurrencySymbol size={10} /> {(order.paidAmount || 0).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className={styles.badgeNA}>—</span>
                      )}
                    </div>
                  </td>
                  <td className={`${styles.amountCell} ${styles.numCol}`}>
                    <CurrencySymbol size={12} /> {(order.totalAmount || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyRow}>
            <AlertTriangle size={32} color="#94A3B8" />
            <p>No deleted orders found matching filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
