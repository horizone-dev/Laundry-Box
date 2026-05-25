import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
  const { customerId } = useParams();
  const { settings, formatDate } = useSettings();
  const printRef = useRef(null);

  /* ─── State ──────────────────────────────────────── */
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('All'); // All | Orders | Payments
  const [sortOrder, setSortOrder] = useState('desc'); // asc | desc

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

  /* ─── Load customer from URL parameter if present ── */
  useEffect(() => {
    if (customerId && window.electronAPI?.dbQuery) {
      const loadCustomer = async () => {
        try {
          const res = await window.electronAPI.dbQuery(
            'SELECT * FROM customers WHERE id = ?',
            [customerId]
          );
          if (res.success && res.data.length > 0) {
            setSelectedCustomer(res.data[0]);
            setSearchTerm(res.data[0].name);
          }
        } catch (err) {
          console.error("Failed to load customer from URL parameter:", err);
        }
      };
      loadCustomer();
    }
  }, [customerId]);

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
      orders.forEach(o => {
        const cleanRef = o.id.startsWith('#') ? o.id : `#${o.id}`;
        const displayDesc = o.id.startsWith('#') ? `Order ${o.id}` : `Order #${o.id}`;
        
        let itemSummary = '';
        try {
          const itemsList = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
          if (Array.isArray(itemsList) && itemsList.length > 0) {
            itemSummary = itemsList.map(item => `${item.qty || item.quantity || 1}x ${item.name}`).join(', ');
          }
        } catch (e) {
          console.error("Failed to parse items for ledger row", e);
        }

        rows.push({
          date: o.createdAt,
          type: 'order',
          ref: cleanRef,
          description: displayDesc,
          itemsSummary: itemSummary,
          debit: o.totalAmount,
          credit: 0,
          status: o.paymentStatus,
          dueAmount: o.dueAmount,
          rawOrder: o
        });
      });
    }

    // Map table payments and group by order ID to prevent double counting
    const paymentsFromTable = payments.map(p => {
      const cleanOrderRef = p.orderId ? (p.orderId.startsWith('#') ? p.orderId : `#${p.orderId}`) : '';
      return {
        date: p.createdAt,
        type: 'payment',
        ref: p.id,
        description: `Payment – ${p.method || 'CASH'}`,
        itemsSummary: p.orderId ? `Linked to Order ${cleanOrderRef}` : 'Advance Deposit',
        debit: 0,
        credit: p.amount,
        status: 'SUCCESS',
        dueAmount: 0,
        orderId: p.orderId
      };
    });

    const tablePaymentsByOrder = {};
    paymentsFromTable.forEach(p => {
      if (p.orderId) {
        tablePaymentsByOrder[p.orderId] = (tablePaymentsByOrder[p.orderId] || 0) + p.credit;
      }
    });

    // Capture initial payments made at order creation time that aren't in the payments table
    const initialPaymentsFromOrders = [];
    if (filterType !== 'Orders') {
      orders.forEach(o => {
        const tablePaySum = tablePaymentsByOrder[o.id] || 0;
        const initialPay = (o.paidAmount || 0) - tablePaySum;
        if (initialPay > 0.01) {
          const cleanRef = o.id.startsWith('#') ? o.id : `#${o.id}`;
          initialPaymentsFromOrders.push({
            date: o.createdAt,
            type: 'payment',
            ref: cleanRef,
            description: `Payment – ${o.paymentMethod || 'CASH'}`,
            itemsSummary: `Linked to Order ${cleanRef}`,
            debit: 0,
            credit: initialPay,
            status: 'SUCCESS',
            dueAmount: 0
          });
        }
      });
    }

    const allPayments = [];
    if (filterType !== 'Orders') {
      paymentsFromTable.forEach(p => allPayments.push(p));
      initialPaymentsFromOrders.forEach(p => allPayments.push(p));
    }

    allPayments.forEach(p => rows.push(p));

    /* Sort chronologically (ascending) first to calculate running balance */
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

    /* Sort according to user preference */
    if (sortOrder === 'desc') {
      rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return rows;
  }, [orders, payments, filterType, sortOrder]);

  /* ─── KPIs ────────────────────────────────────────── */
  const totalBilled    = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const totalPaid      = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding    = Math.max(0, selectedCustomer?.balance || 0);
  const advanceCredit  = selectedCustomer?.balance < 0 ? Math.abs(selectedCustomer.balance) : 0;
  const orderCount     = orders.length;

  /* ─── Export CSV ──────────────────────────────────── */
  const exportCSV = () => {
    const headers = ['Date', 'Reference', 'Description', 'Debit (Charged)', 'Credit (Paid)', 'Running Balance'];
    const rows = ledgerRows.map(r => [
      formatDate(r.date),
      r.ref,
      `"${r.description}${r.itemsSummary ? ` (${r.itemsSummary})` : ''}"`,
      r.debit.toFixed(2),
      r.credit.toFixed(2),
      r.runningBalance.toFixed(2)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `statement_${selectedCustomer?.name?.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  /* ─── Status badge helper ─────────────────────────── */
  // StatusBadge was removed since Status column was removed.

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

        {/* Sort Order filter */}
        <div className={styles.typeFilter}>
          <button
            className={`${styles.typeBtn} ${sortOrder === 'asc' ? styles.typeBtnActive : ''}`}
            onClick={() => setSortOrder('asc')}
          >
            Oldest First
          </button>
          <button
            className={`${styles.typeBtn} ${sortOrder === 'desc' ? styles.typeBtnActive : ''}`}
            onClick={() => setSortOrder('desc')}
          >
            Newest First
          </button>
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
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((row, idx) => (
                    <tr key={idx} className={`${styles.ledgerRow} ${row.type === 'payment' ? styles.paymentRow : styles.orderRow}`}>
                      <td className={styles.dateCell}>
                        <div>{formatDate(row.date)}</div>
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
                      <td className={styles.descCell}>
                        <div className={styles.descMain}>{row.description}</div>
                        {row.itemsSummary && (
                          <div className={styles.descSub}>{row.itemsSummary}</div>
                        )}
                      </td>
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
