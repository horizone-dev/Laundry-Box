import React, { useState, useEffect, useRef } from 'react';
import {
  Search, User, Download, Printer, FileText, Calendar,
  ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight,
  CheckCircle, Clock, AlertCircle, CreditCard, Wallet,
  X, Filter, Package, TrendingUp, RotateCcw
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './CustomerStatement.module.css';

export default function CustomerStatement() {
  const { settings } = useSettings();
  const printRef = useRef(null);

  /* ─── State ──────────────────────────────────────── */
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('All'); // All | Orders | Payments

  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  /* ─── Close dropdown on outside click ────────────── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ─── Search customers ────────────────────────────── */
  useEffect(() => {
    if (!searchTerm.trim()) {
      setCustomers([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (window.electronAPI?.dbQuery) {
        const res = await window.electronAPI.dbQuery(
          'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name ASC LIMIT 10',
          [`%${searchTerm}%`, `%${searchTerm}%`]
        );
        if (res.success) setCustomers(res.data);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  /* ─── Load data when customer / date filter changes ─ */
  useEffect(() => {
    if (!selectedCustomer) return;
    fetchStatement(selectedCustomer.id);
  }, [selectedCustomer, dateFrom, dateTo]);

  const fetchStatement = async (customerId) => {
    if (!window.electronAPI?.dbQuery) return;
    setLoading(true);
    try {
      /* Build date conditions */
      let orderWhere = 'WHERE o.customerId = ?';
      const orderParams = [customerId];
      if (dateFrom) { orderWhere += ' AND o.createdAt >= ?'; orderParams.push(dateFrom); }
      if (dateTo)   { orderWhere += ' AND o.createdAt <= ?'; orderParams.push(dateTo + 'T23:59:59'); }

      const ordersRes = await window.electronAPI.dbQuery(
        `SELECT o.*, '' as type FROM orders o ${orderWhere} ORDER BY o.createdAt ASC`,
        orderParams
      );

      let payWhere = 'WHERE customerId = ?';
      const payParams = [customerId];
      if (dateFrom) { payWhere += ' AND createdAt >= ?'; payParams.push(dateFrom); }
      if (dateTo)   { payWhere += ' AND createdAt <= ?'; payParams.push(dateTo + 'T23:59:59'); }

      const paymentsRes = await window.electronAPI.dbQuery(
        `SELECT * FROM payments ${payWhere} ORDER BY createdAt ASC`,
        payParams
      );

      setOrders(ordersRes.success ? ordersRes.data : []);
      setPayments(paymentsRes.success ? paymentsRes.data : []);
    } catch (err) {
      console.error('Statement fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Build unified ledger rows ───────────────────── */
  const ledgerRows = React.useMemo(() => {
    const rows = [];

    if (filterType !== 'Payments') {
      orders.forEach(o => rows.push({
        date: o.createdAt,
        type: 'order',
        ref: o.id,
        description: `Order #${o.id}`,
        debit: o.totalAmount,
        credit: o.paidAmount || 0,
        status: o.paymentStatus,
        dueAmount: o.dueAmount,
        rawOrder: o
      }));
    }

    if (filterType !== 'Orders') {
      payments.forEach(p => rows.push({
        date: p.createdAt,
        type: 'payment',
        ref: p.id,
        description: `Payment – ${p.method || 'CASH'}${p.orderId ? ` (Order ${p.orderId})` : ''}`,
        debit: 0,
        credit: p.amount,
        status: 'SUCCESS',
        dueAmount: 0
      }));
    }

    /* Sort chronologically */
    rows.sort((a, b) => new Date(a.date) - new Date(b.date));

    /* Running balance */
    let balance = 0;
    rows.forEach(row => {
      if (row.type === 'order') {
        balance += row.debit - row.credit;
      } else {
        balance -= row.credit;
      }
      row.runningBalance = balance;
    });

    return rows;
  }, [orders, payments, filterType]);

  /* ─── KPIs ────────────────────────────────────────── */
  const totalBilled    = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const totalPaid      = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding    = Math.max(0, selectedCustomer?.balance || 0);
  const advanceCredit  = selectedCustomer?.balance < 0 ? Math.abs(selectedCustomer.balance) : 0;
  const orderCount     = orders.length;

  /* ─── Export CSV ──────────────────────────────────── */
  const exportCSV = () => {
    const headers = ['Date', 'Reference', 'Description', 'Debit (Charged)', 'Credit (Paid)', 'Running Balance', 'Status'];
    const rows = ledgerRows.map(r => [
      new Date(r.date).toLocaleDateString(),
      r.ref,
      `"${r.description}"`,
      r.debit.toFixed(2),
      r.credit.toFixed(2),
      r.runningBalance.toFixed(2),
      r.status
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `statement_${selectedCustomer?.name?.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  /* ─── Status badge helper ─────────────────────────── */
  const StatusBadge = ({ status }) => {
    const map = {
      'Paid':    { bg: '#DCFCE7', color: '#166534', label: 'Paid' },
      'Partial': { bg: '#FEF3C7', color: '#92400E', label: 'Partial' },
      'Credit':  { bg: '#FEE2E2', color: '#991B1B', label: 'Credit' },
      'SUCCESS': { bg: '#DCFCE7', color: '#166534', label: 'Paid' },
      'Pending': { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
    };
    const s = map[status] || { bg: '#F1F5F9', color: '#64748B', label: status };
    return (
      <span style={{ padding: '0.2rem 0.6rem', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, background: s.bg, color: s.color }}>
        {s.label}
      </span>
    );
  };

  /* ─── Render ──────────────────────────────────────── */
  return (
    <div className={styles.page}>

      {/* ── Header ──────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <p className={styles.breadcrumb}>Reports › Customer Statement</p>
          <h1>Customer Statement</h1>
          <p className={styles.subtext}>Full billing ledger with running balance for any customer.</p>
        </div>

        {selectedCustomer && (
          <div className={styles.headerActions}>
            <button className={styles.btnSecondary} onClick={exportCSV}>
              <Download size={16} /> Export CSV
            </button>
            <button className={styles.btnPrimary} onClick={() => window.print()}>
              <Printer size={16} /> Print / PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Customer Selector + Filters ─────────────── */}
      <div className={styles.filterBar}>

        {/* Customer search */}
        <div className={styles.customerSelector} ref={dropdownRef}>
          <div
            className={styles.selectorInput}
            onClick={() => {
              inputRef.current?.focus();
              setShowDropdown(true);
            }}
          >
            <User size={16} color="#94A3B8" />
            {selectedCustomer ? (
              <span className={styles.selectedName}>{selectedCustomer.name}</span>
            ) : null}
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); }}
              placeholder={selectedCustomer ? 'Change customer…' : 'Search customer by name or phone…'}
              className={styles.searchInput}
            />
            {selectedCustomer
              ? <X size={14} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); setSearchTerm(''); setOrders([]); setPayments([]); }} />
              : <ChevronDown size={16} color="#94A3B8" />
            }
          </div>

          {showDropdown && customers.length > 0 && (
            <div className={styles.dropdown}>
              {customers.map(c => (
                <div key={c.id} className={styles.dropdownItem} onClick={() => {
                  setSelectedCustomer(c);
                  setSearchTerm(c.name);
                  setShowDropdown(false);
                }}>
                  <div className={styles.dropdownAvatar}>{c.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className={styles.dropdownName}>{c.name}</div>
                    <div className={styles.dropdownPhone}>{c.phone}</div>
                  </div>
                  <span className={c.balance > 0 ? styles.balanceDue : styles.balanceOk}>
                    {c.balance > 0 ? `Due: ` : c.balance < 0 ? 'Adv: ' : ''}
                    {c.balance !== 0 && <><CurrencySymbol size={10} /> {Math.abs(c.balance).toFixed(2)}</>}
                    {c.balance === 0 && 'Settled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Date filters */}
        <div className={styles.dateFilters}>
          <div className={styles.dateField}>
            <Calendar size={14} color="#94A3B8" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={styles.dateInput} />
          </div>
          <span className={styles.dateSep}>to</span>
          <div className={styles.dateField}>
            <Calendar size={14} color="#94A3B8" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={styles.dateInput} />
          </div>
          {(dateFrom || dateTo) && (
            <button className={styles.clearBtn} onClick={() => { setDateFrom(''); setDateTo(''); }}>
              <RotateCcw size={14} /> Clear
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className={styles.typeFilter}>
          {['All', 'Orders', 'Payments'].map(t => (
            <button
              key={t}
              className={`${styles.typeBtn} ${filterType === t ? styles.typeBtnActive : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Empty State ─────────────────────────────── */}
      {!selectedCustomer && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><FileText size={48} color="#CBD5E1" /></div>
          <h3>Select a Customer</h3>
          <p>Search for a customer above to view their complete billing statement and transaction history.</p>
        </div>
      )}

      {/* ── Loaded State ────────────────────────────── */}
      {selectedCustomer && (
        <div ref={printRef}>

          {/* KPI Row */}
          <div className={styles.kpiRow}>
            <KPICard
              label="Total Billed"
              value={totalBilled}
              icon={<Package size={18} />}
              color="#2563EB"
              bg="#EFF6FF"
              sub={`${orderCount} order${orderCount !== 1 ? 's' : ''}`}
            />
            <KPICard
              label="Total Paid"
              value={totalPaid}
              icon={<CheckCircle size={18} />}
              color="#10B981"
              bg="#F0FDF4"
              sub="Across all payments"
            />
            <KPICard
              label="Outstanding Balance"
              value={outstanding}
              icon={<AlertCircle size={18} />}
              color={outstanding > 0 ? '#EF4444' : '#10B981'}
              bg={outstanding > 0 ? '#FEF2F2' : '#F0FDF4'}
              sub={outstanding > 0 ? 'Amount owed' : 'Fully settled'}
            />
            <KPICard
              label="Advance Credit"
              value={advanceCredit}
              icon={<TrendingUp size={18} />}
              color="#8B5CF6"
              bg="#F5F3FF"
              sub="Prepaid balance"
            />
          </div>

          {/* Customer Info Banner */}
          <div className={styles.customerBanner}>
            <div className={styles.bannerAvatar}>{selectedCustomer.name.charAt(0).toUpperCase()}</div>
            <div className={styles.bannerInfo}>
              <h2>{selectedCustomer.name}</h2>
              <p>{selectedCustomer.phone}</p>
            </div>
            <div className={styles.bannerMeta}>
              <span className={styles.metaLabel}>Statement Period</span>
              <span className={styles.metaValue}>
                {dateFrom ? new Date(dateFrom).toLocaleDateString() : 'All Time'} —{' '}
                {dateTo   ? new Date(dateTo).toLocaleDateString()   : 'Today'}
              </span>
            </div>
            <div className={styles.bannerMeta}>
              <span className={styles.metaLabel}>Generated</span>
              <span className={styles.metaValue}>{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Ledger Table */}
          <div className={styles.tableCard}>
            {loading ? (
              <div className={styles.loadingRow}>Loading transactions…</div>
            ) : ledgerRows.length === 0 ? (
              <div className={styles.loadingRow}>No transactions found for selected filters.</div>
            ) : (
              <table className={styles.ledgerTable}>
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>REFERENCE</th>
                    <th>DESCRIPTION</th>
                    <th className={styles.numCol}>CHARGED</th>
                    <th className={styles.numCol}>PAID</th>
                    <th className={styles.numCol}>BALANCE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((row, idx) => (
                    <tr key={idx} className={`${styles.ledgerRow} ${row.type === 'payment' ? styles.paymentRow : styles.orderRow}`}>
                      <td className={styles.dateCell}>
                        <div>{new Date(row.date).toLocaleDateString()}</div>
                        <div className={styles.timeText}>{new Date(row.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td>
                        <div className={styles.refCell}>
                          {row.type === 'order'
                            ? <Package size={13} color="#2563EB" />
                            : <Wallet size={13} color="#10B981" />
                          }
                          <span className={styles.refText}>{row.ref}</span>
                        </div>
                      </td>
                      <td className={styles.descCell}>{row.description}</td>
                      <td className={`${styles.numCol} ${styles.debitCell}`}>
                        {row.debit > 0 ? <><CurrencySymbol size={11} /> {row.debit.toFixed(2)}</> : <span className={styles.dash}>—</span>}
                      </td>
                      <td className={`${styles.numCol} ${styles.creditCell}`}>
                        {row.credit > 0 ? <><CurrencySymbol size={11} /> {row.credit.toFixed(2)}</> : <span className={styles.dash}>—</span>}
                      </td>
                      <td className={`${styles.numCol} ${row.runningBalance > 0 ? styles.balanceDueNum : row.runningBalance < 0 ? styles.balanceAdvNum : styles.balanceZero}`}>
                        <CurrencySymbol size={11} /> {Math.abs(row.runningBalance).toFixed(2)}
                        {row.runningBalance < 0 && <span className={styles.advTag}> Adv</span>}
                      </td>
                      <td><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.totalsRow}>
                    <td colSpan="3" className={styles.totalsLabel}>TOTALS</td>
                    <td className={`${styles.numCol} ${styles.debitCell} ${styles.totalsNum}`}>
                      <CurrencySymbol size={12} /> {ledgerRows.reduce((s, r) => s + r.debit, 0).toFixed(2)}
                    </td>
                    <td className={`${styles.numCol} ${styles.creditCell} ${styles.totalsNum}`}>
                      <CurrencySymbol size={12} /> {ledgerRows.reduce((s, r) => s + r.credit, 0).toFixed(2)}
                    </td>
                    <td className={`${styles.numCol} ${styles.totalsNum} ${outstanding > 0 ? styles.balanceDueNum : styles.balanceZero}`}>
                      <CurrencySymbol size={12} /> {outstanding.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Print Footer */}
          <div className={styles.printFooter}>
            <p>This statement was generated automatically by Laundry Management System.</p>
            <p>For queries, please contact the shop directly.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, icon, color, bg, sub }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIcon} style={{ background: bg, color }}>
        {icon}
      </div>
      <div className={styles.kpiContent}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}><CurrencySymbol size={16} /> {Number(value || 0).toFixed(2)}</span>
        <span className={styles.kpiSub}>{sub}</span>
      </div>
    </div>
  );
}
