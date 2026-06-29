import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  XCircle, Calendar, Download, Printer, Search,
  Users, DollarSign, RotateCcw
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { useNavigate } from 'react-router-dom';
import CurrencySymbol from '../components/CurrencySymbol';
import { getLocalDateBounds, isWithinBounds } from '../utils/dateFilters';
import Pagination from '../components/Pagination';
import styles from './CancelledOrdersReport.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};


export default function CancelledOrdersReport() {
  const { settings, formatDate } = useSettings();
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

  const navigate = useNavigate();

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAuthorized = user.role === 'super_admin' || user.role === 'manager';

  useEffect(() => {
    if (!isAuthorized) navigate('/');
  }, [isAuthorized, navigate]);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('Today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange, customStart, customEnd]);


  const fetchData = async () => {
    if (!window.electronAPI?.dbQuery) return;
    try {
      setLoading(true);
      const bounds = getLocalDateBounds(dateRange, customStart, customEnd);

      let query = `
        SELECT o.id, o.billNumber, o.totalAmount, o.items, o.createdAt, o.statusHistory,
               c.name as customerName, c.phone as customerPhone
        FROM orders o
        LEFT JOIN customers c ON o.customerId = c.id
        WHERE o.status = 'Cancelled'
      `;
      let params = [];

      if (bounds === false) {
        setOrders([]);
        setLoading(false);
        return;
      }

      if (bounds !== null) {
        query += ` AND o.createdAt >= ? AND o.createdAt <= ?`;
        params = [bounds.from.toISOString(), bounds.to.toISOString()];
      }

      query += ` ORDER BY o.createdAt DESC`;

      const res = await window.electronAPI.dbQuery(query, params);
      setOrders(res.success ? res.data : []);
    } catch (err) {
      console.error('Cancelled orders fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) fetchData();
  }, [isAuthorized, dateRange, customStart, customEnd]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const ref = (o.billNumber || o.id || '').toLowerCase();
        const name = (o.customerName || '').toLowerCase();
        const phone = (o.customerPhone || '').toLowerCase();
        if (!ref.includes(q) && !name.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [orders, searchTerm]);

  /* ── KPIs ─────────────────────────────────────────── */
  const totalCancelled = filteredOrders.length;
  const totalLostRevenue = filteredOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const uniqueCustomers = new Set(filteredOrders.map(o => o.customerPhone || o.customerName)).size;

  /* ── Pagination ───────────────────────────────────── */
  const paginated = useMemo(() => {
    return filteredOrders.slice((currentPage - 1) * 20, currentPage * 20);
  }, [filteredOrders, currentPage]);

  /* ── CSV export ───────────────────────────────────── */
  const exportCSV = () => {
    const headers = ['Date', 'Bill No.', 'Customer', 'Phone', 'Items', 'Amount', 'Cancelled At'];
    const rows = filteredOrders.map(o => {
      let items = '';
      try {
        const parsed = JSON.parse(o.items || '[]');
        items = parsed.map(i => `${i.qty || i.quantity || 1}x ${i.name}`).join('; ');
      } catch (_) {}
      const cancelledAt = (() => {
        try {
          const hist = JSON.parse(o.statusHistory || '[]');
          const ev = hist.find(h => h.status === 'Cancelled');
          return ev ? formatDate(ev.timestamp) : '';
        } catch (_) { return ''; }
      })();
      return [
        formatDate(o.createdAt),
        `"${o.billNumber || o.id}"`,
        `"${o.customerName || 'Walk-in'}"`,
        o.customerPhone || '',
        `"${items}"`,
        (o.totalAmount || 0).toFixed(2),
        cancelledAt
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cancelled_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!isAuthorized) return null;

  return (
    <motion.div className={styles.page} variants={containerVariants} initial="hidden" animate="visible">

      {/* ── Header ──────────────────────────────────── */}
      <motion.div className={styles.headerRow} variants={itemVariants}>
        <div className={styles.headerInfo}>
          <h1>Cancelled Orders Report</h1>
          <p className={styles.subtext}>Review all cancelled orders and the revenue impact for your laundry business.</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print / PDF
          </button>
        </div>
      </motion.div>

      {/* ── KPI Cards ────────────────────────────────── */}
      <motion.div className={styles.kpiGrid} variants={itemVariants}>
        <KPICard
          icon={<XCircle size={20} color="#EF4444" />}
          bg="#FEF2F2"
          label="Total Cancelled"
          value={totalCancelled.toLocaleString()}
          isCurrency={false}
          subtext="Orders cancelled in period"
        />
        <KPICard
          icon={<DollarSign size={20} color="#F59E0B" />}
          bg="#FFFBEB"
          label="Lost Revenue"
          value={totalLostRevenue}
          isCurrency={true}
          subtext="Potential earnings missed"
        />
        <KPICard
          icon={<Users size={20} color="#8B5CF6" />}
          bg="#F5F3FF"
          label="Affected Customers"
          value={uniqueCustomers.toLocaleString()}
          isCurrency={false}
          subtext="Unique customers with cancellations"
        />
      </motion.div>

      {/* ── Table Card ───────────────────────────────── */}
      <motion.div className={styles.tableCard} variants={itemVariants}>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by bill no., customer name or phone…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={styles.filterControls}>
            <select
              className={styles.filterSelect}
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="This Month">This Month</option>
              <option value="This Year">This Year</option>
              <option value="Custom">Custom Range</option>
            </select>
            {dateRange === 'Custom' && (
              <div className={styles.customDates}>
                <input type="date" className={styles.dateInput} value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <span className={styles.dateSep}>to</span>
                <input type="date" className={styles.dateInput} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            )}
            {searchTerm && (
              <button className={styles.clearBtn} onClick={() => setSearchTerm('')}>
                <RotateCcw size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className={styles.emptyRow}>Loading cancelled orders…</div>
        ) : filteredOrders.length === 0 ? (
          <div className={styles.emptyRow}>
            <XCircle size={40} color="#CBD5E1" />
            <p>No cancelled orders found for the selected period.</p>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>BILL NO.</th>
                  <th>CUSTOMER</th>
                  <th>ITEMS</th>
                  <th className={styles.numCol}>AMOUNT</th>
                  <th>CANCELLED AT</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((o, idx) => {
                  let items = '';
                  try {
                    const parsed = JSON.parse(o.items || '[]');
                    items = parsed.map(i => `${i.qty || i.quantity || 1}x ${i.name}`).join(', ');
                  } catch (_) {}

                  let cancelledAt = '—';
                  let cancelledAtTime = '';
                  try {
                    const hist = JSON.parse(o.statusHistory || '[]');
                    const ev = hist.find(h => h.status === 'Cancelled');
                    if (ev) {
                      const { date: cDate, time: cTime } = formatDateTimeSplit(ev.timestamp);
                      cancelledAt = cDate;
                      cancelledAtTime = cTime;
                    }
                  } catch (_) {}

                  return (
                    <tr key={idx} className={styles.tableRow}>
                      <td className={styles.dateCell}>
                        {(() => {
                          const { date: oDate, time: oTime } = formatDateTimeSplit(o.createdAt);
                          return (
                            <>
                              <div>{oDate}</div>
                              {oTime && <div className={styles.timeText}>{oTime}</div>}
                            </>
                          );
                        })()}
                      </td>
                      <td>
                        <span className={styles.billRef}>{o.billNumber || o.id || '—'}</span>
                      </td>
                      <td>
                        <div className={styles.customerName}>{o.customerName || 'Walk-in'}</div>
                        {o.customerPhone && <div className={styles.customerPhone}>{o.customerPhone}</div>}
                      </td>
                      <td className={styles.itemsCell}>
                        {items || <span className={styles.dash}>—</span>}
                      </td>
                      <td className={`${styles.numCol} ${styles.amountCell}`}>
                        <CurrencySymbol size={11} /> {(o.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className={styles.cancelledAtCell}>
                        <div>{cancelledAt}</div>
                        {cancelledAtTime && <div className={styles.timeText}>{cancelledAtTime}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={styles.totalsRow}>
                  <td colSpan="4" className={styles.totalsLabel}>TOTAL ({filteredOrders.length} orders)</td>
                  <td className={`${styles.numCol} ${styles.totalsNum}`}>
                    <CurrencySymbol size={12} /> {totalLostRevenue.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredOrders.length / 20)}
              onPageChange={setCurrentPage}
              totalItems={filteredOrders.length}
              pageSize={20}
              itemLabel="orders"
            />
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function KPICard({ icon, bg, label, value, isCurrency, subtext }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.cardHeader}>
        <div className={styles.iconBox} style={{ background: bg }}>{icon}</div>
      </div>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>
        {isCurrency ? <><CurrencySymbol size={18} /> {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</> : value}
      </div>
      <div className={styles.kpiSubtext}>{subtext}</div>
    </div>
  );
}
