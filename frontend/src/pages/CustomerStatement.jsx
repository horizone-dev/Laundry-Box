import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, User, Download, Printer, FileText, Calendar,
  ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight,
  CheckCircle, Clock, AlertCircle, CreditCard, Wallet,
  X, Filter, Package, TrendingUp, RotateCcw
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import Pagination from '../components/Pagination';
import CustomSelect from '../components/CustomSelect';
import styles from './CustomerStatement.module.css';

export default function CustomerStatement() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { settings, formatDate } = useSettings();
  const printRef = useRef(null);

  /* ─── State ──────────────────────────────────────── */
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const [dateRange, setDateRange] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('All'); // All | Orders | Payments
  const [sortOrder, setSortOrder] = useState('desc'); // asc | desc

  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCustomer, dateRange, dateFrom, dateTo, filterType, sortOrder]);

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  /* ─── Sync dateFrom and dateTo based on dateRange ─── */
  useEffect(() => {
    const now = new Date();
    const toLocalDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (dateRange === 'Today') {
      const todayStr = toLocalDateString(now);
      setDateFrom(todayStr);
      setDateTo(todayStr);

    } else if (dateRange === 'This Month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(toLocalDateString(start));
      setDateTo(toLocalDateString(end));
    } else if (dateRange === 'This Year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      setDateFrom(toLocalDateString(start));
      setDateTo(toLocalDateString(end));
    } else if (dateRange === 'All') {
      setDateFrom('');
      setDateTo('');
    } else if (dateRange === 'Custom') {
      setDateFrom('');
      setDateTo('');
    }
  }, [dateRange]);

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
  }, [selectedCustomer, dateRange, dateFrom, dateTo]);

  const fetchStatement = async (customerId) => {
    if (!window.electronAPI?.dbQuery) return;
    if (dateRange === 'Custom' && (!dateFrom || !dateTo)) {
      setOrders([]);
      setPayments([]);
      setAllocations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      /* Build date conditions on the UNION wrapper */
      let orderQuery = `
        SELECT * FROM (
          SELECT 
            id, shopId, billNumber, customerId, totalAmount, paidAmount, dueAmount, 
            paymentStatus, status, paymentMethod, items, createdAt, updatedAt, 
            paymentBreakdown,
            0 AS isDeleted, NULL AS refundStatus, NULL AS refundMethod, NULL AS returnedAt, NULL AS payments 
          FROM orders 

          UNION ALL

          SELECT 
            id, shopId, billNumber, customerId, totalAmount, paidAmount, 0 AS dueAmount, 
            originalPaymentStatus AS paymentStatus, 'Deleted' AS status, originalPaymentMethod AS paymentMethod, items, IFNULL(createdAt, deletedAt) AS createdAt, deletedAt AS updatedAt, 
            NULL AS paymentBreakdown,
            1 AS isDeleted, refundStatus, refundMethod, returnedAt, payments 
          FROM deleted_orders 
        ) AS u
        WHERE u.customerId = ?
        ORDER BY u.createdAt ASC
      `;
      const orderParams = [customerId];

      const ordersRes = await window.electronAPI.dbQuery(orderQuery, orderParams);

      const paymentsRes = await window.electronAPI.dbQuery(
        `SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt ASC`,
        [customerId]
      );

      const allocationsRes = await window.electronAPI.dbQuery(
        `SELECT a.* FROM advance_allocations a
         JOIN payments p ON a.paymentId = p.id
         WHERE p.customerId = ?`,
        [customerId]
      );

      setOrders(ordersRes.success ? ordersRes.data : []);
      setPayments(paymentsRes.success ? paymentsRes.data : []);
      setAllocations(allocationsRes.success ? allocationsRes.data : []);
    } catch (err) {
      console.error('Statement fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Build unified ledger rows ───────────────────── */
  const ledgerRows = React.useMemo(() => {
    const rows = [];

    const systemAutoOffsetSum = payments
      .filter(p => p.method === 'System Auto' && !p.orderId)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const originalOpeningBalance = selectedCustomer
      ? (selectedCustomer.openingBalance || 0) + Math.abs(systemAutoOffsetSum)
      : 0;

    if (selectedCustomer && originalOpeningBalance > 0) {
      rows.push({
        date: selectedCustomer.createdAt || new Date(0).toISOString(),
        type: 'opening_balance',
        ref: 'OPENING',
        description: 'Opening Balance (Outstanding Due)',
        itemsSummary: '',
        debit: originalOpeningBalance,
        credit: 0,
        status: 'SUCCESS',
        dueAmount: 0
      });
    }

    // Robust date normalizer to handle space and timezone offsets safely
    const normalizeDate = (dStr) => {
      if (!dStr) return new Date(0);
      let normalized = dStr.replace(' ', 'T');
      if (normalized.includes('+')) {
        normalized = normalized.split('+')[0];
      }
      if (normalized.endsWith('Z')) {
        normalized = normalized.substring(0, normalized.length - 1);
      }
      const parsed = new Date(normalized);
      return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    };

    orders.forEach(o => {
      const cleanRef = `${settings.invoicePrefix || '#'}${o.id}`;
      
      if (o.isDeleted) {
        console.log("DELETED ORDER FOUND IN STATEMENT:", o);
        if (filterType !== 'Payments') {
          // 1. The Original Order Charge
          let itemSummary = '';
          try {
            const itemsList = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
            if (Array.isArray(itemsList) && itemsList.length > 0) {
              itemSummary = itemsList.map(item => `${item.qty || item.quantity || 1}x ${item.name}`).join(', ');
            }
          } catch (e) {}

          rows.push({
            date: o.createdAt,
            type: 'order',
            ref: cleanRef,
            description: `Order ${cleanRef} (Later Deleted)`,
            itemsSummary: itemSummary,
            debit: (o.totalAmount || 0),
            credit: 0,
            status: 'Cancelled',
            dueAmount: 0,
            rawOrder: o
          });

          // 2. The Deletion Reversal
          rows.push({
            date: o.updatedAt || o.createdAt,
            type: 'deleted_order',
            ref: cleanRef,
            description: `Order Deleted ${cleanRef}`,
            itemsSummary: `Status: ${o.refundStatus || 'Deleted'}`,
            debit: 0,
            credit: (o.totalAmount || 0),
            status: o.refundStatus || 'Deleted',
            dueAmount: 0,
            rawOrder: o
          });
        }

        if (filterType !== 'Orders') {

          // Add original payments parsed from JSON (these are CREDIT rows — money came in from the customer)
          let parsedPayments = [];
          try {
            parsedPayments = typeof o.payments === 'string' ? JSON.parse(o.payments || '[]') : (o.payments || []);
          } catch (e) {
            parsedPayments = [];
          }

          const deletedPaySum = Array.isArray(parsedPayments)
            ? parsedPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
            : 0;
          const initialDeletedPay = (o.paidAmount || 0) - deletedPaySum;

          if (Array.isArray(parsedPayments)) {
            parsedPayments.forEach(p => {
              rows.push({
                date: p.createdAt || o.createdAt,
                type: 'payment',
                ref: p.paymentReference || p.id || `PAY-DEL-${o.id}`,
                description: `Payment – ${p.method || 'Cash'}`,
                itemsSummary: `Linked to Order ${cleanRef}`,
                debit: 0,
                credit: p.amount || 0,
                status: 'SUCCESS',
                dueAmount: 0
              });
            });
          }

          // Fallback: if the order was paid via Advance Allocation (payments JSON is empty)
          // but paidAmount > 0, emit a single credit row for the full amount.
          // Without this, the ledger shows a refund debit with no matching credit — producing a wrong Due balance.
          if (initialDeletedPay > 0.01) {
            rows.push({
              date: o.createdAt,
              type: 'payment',
              ref: cleanRef,
              description: `Payment – ${o.paymentMethod || 'Advance'}`,
              itemsSummary: `Linked to Order ${cleanRef}`,
              debit: 0,
              credit: initialDeletedPay,
              status: 'SUCCESS',
              dueAmount: 0
            });
          }

          if (o.refundStatus === 'Returned' && (o.paidAmount || 0) > 0) {
            rows.push({
              date: o.returnedAt || o.updatedAt || o.createdAt,
              type: 'refund',
              ref: `REF-${o.id}`,
              description: `Refund – ${o.refundMethod || 'Cash'}`,
              itemsSummary: `Refund for Deleted Order ${cleanRef}`,
              debit: o.paidAmount,
              credit: 0,
              status: 'SUCCESS',
              dueAmount: 0
            });
          }
          if (o.refundStatus === 'Converted to Advance' && (o.paidAmount || 0) > 0) {
            rows.push({
              date: o.updatedAt || o.createdAt,
              type: 'payment',
              ref: `ADV-CONV-${o.id}`,
              description: 'Converted to Advance',
              itemsSummary: `Advance from Deleted Order ${cleanRef}`,
              debit: 0,
              credit: o.paidAmount,
              status: 'SUCCESS',
              dueAmount: 0
            });
          }
        }
      } else {
        // Active Order
        if (filterType !== 'Payments') {
          const displayDesc = `Order ${settings.invoicePrefix || ''}${o.id}`;
          let itemSummary = '';
          try {
            const itemsList = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
            if (Array.isArray(itemsList) && itemsList.length > 0) {
              itemSummary = itemsList.map(item => `${item.qty || item.quantity || 1}x ${item.name}`).join(', ');
            }
          } catch (e) {
            console.error("Failed to parse items for ledger row", e);
          }

          let discount = 0;
          try {
            if (o.paymentBreakdown) {
              const breakdown = typeof o.paymentBreakdown === 'string'
                ? JSON.parse(o.paymentBreakdown)
                : o.paymentBreakdown;
              discount = parseFloat(breakdown.discount || breakdown.discountAmount || 0) || 0;
            }
          } catch (e) {}

          rows.push({
            date: o.createdAt,
            type: 'order',
            ref: cleanRef,
            description: displayDesc,
            discountAmount: discount,
            itemsSummary: itemSummary,
            debit: o.totalAmount,
            credit: 0,
            status: o.paymentStatus,
            dueAmount: o.dueAmount,
            rawOrder: o
          });
        }
      }
    });

    // Group database payments by exact timestamp to prevent visual splits (even for different methods in a multipayment)
    const groupedPaymentsMap = {};
    payments.filter(p => p.method !== 'Refund Advance' && p.method !== 'Advance' && p.method !== 'System Auto').forEach(p => {
      const key = p.createdAt;
      if (!groupedPaymentsMap[key]) {
        groupedPaymentsMap[key] = {
          date: p.createdAt,
          type: 'payment',
          ref: p.paymentReference || p.id,
          description: `Payment – ${p.method || 'Cash'}`,
          debit: 0,
          credit: p.method === 'Discount' ? 0 : (p.amount || 0),
          discountAmount: p.method === 'Discount' ? (p.amount || 0) : 0,
          status: 'SUCCESS',
          dueAmount: 0,
          orderId: p.orderId,
          paymentMethod: p.method,
          orderIds: p.orderId ? [p.orderId] : [],
          methods: [p.method]
        };
      } else {
        if (p.method === 'Discount') {
          groupedPaymentsMap[key].discountAmount += p.amount || 0;
        } else {
          groupedPaymentsMap[key].credit += p.amount || 0;
        }
        if (p.orderId && !groupedPaymentsMap[key].orderIds.includes(p.orderId)) {
          groupedPaymentsMap[key].orderIds.push(p.orderId);
        }
        if (!groupedPaymentsMap[key].methods.includes(p.method)) {
          groupedPaymentsMap[key].methods.push(p.method);
        }
      }
    });

    const paymentsFromTable = Object.values(groupedPaymentsMap).map(p => {
      const cleanOrderRef = p.orderId ? `${settings.invoicePrefix || '#'}${p.orderId}` : '';
      let itemsSummary = '';
      
      let description = p.description;
      let finalPaymentMethod = p.paymentMethod;
      if (p.methods.length > 1) {
        description = 'Payment – Multipayment';
        finalPaymentMethod = 'Multipayment';
      }

      if (p.paymentMethod === 'Advance') {
        itemsSummary = `Advance Consumed for Order ${cleanOrderRef}`;
      } else if (p.orderIds.length > 1) {
        itemsSummary = 'Quick Pay Settlement';
      } else if (p.orderId) {
        itemsSummary = `Linked to Order ${cleanOrderRef}`;
      } else {
        const refStr = p.ref || '';
        if (refStr.startsWith('QPY-')) itemsSummary = 'Quick Pay Settlement';
        else if (refStr.startsWith('ADV-')) itemsSummary = 'Advance Deposit';
        else if (refStr.startsWith('SYS-')) itemsSummary = 'System Auto Offset';
        else itemsSummary = 'Account Payment';
      }

      return {
        ...p,
        description,
        paymentMethod: finalPaymentMethod,
        itemsSummary
      };
    });

    const tablePaymentsByOrder = {};
    paymentsFromTable.forEach(p => {
      if (p.orderId) {
        tablePaymentsByOrder[p.orderId] = (tablePaymentsByOrder[p.orderId] || 0) + p.credit;
      }
    });

    // Capture initial payments made at order creation time that aren't in the payments table, subtracting allocations
    const initialPaymentsFromOrders = [];
    if (filterType !== 'Orders' && payments.length === 0) {
      orders.forEach(o => {
        if (o.isDeleted) return; // Skip deleted orders here, we already extracted their payments!
        
        const allocs = allocations.filter(a => a.orderId === o.id);
        const allocSum = allocs.reduce((sum, a) => sum + (a.amountUsed || 0), 0);
        
        const actualPaymentPaid = (o.paidAmount || 0) - allocSum;
        const tablePaySum = tablePaymentsByOrder[o.id] || 0;
        const initialPay = actualPaymentPaid - tablePaySum;
        
        if (initialPay > 0.01) {
          const cleanRef = `${settings.invoicePrefix || '#'}${o.id}`;
          initialPaymentsFromOrders.push({
            date: o.createdAt,
            type: 'payment',
            ref: cleanRef,
            description: `Payment – ${o.paymentMethod || 'Cash'}`,
            itemsSummary: `Linked to Order ${cleanRef}`,
            debit: 0,
            credit: initialPay,
            status: 'SUCCESS',
            dueAmount: 0,
            paymentMethod: o.paymentMethod
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
    rows.sort((a, b) => {
      const diff = normalizeDate(a.date) - normalizeDate(b.date);
      if (diff !== 0) return diff;
      const aIsDebit = a.debit > 0;
      const bIsDebit = b.debit > 0;
      if (aIsDebit && !bIsDebit) return -1;
      if (!aIsDebit && bIsDebit) return 1;
      return 0;
    });

    /* Running balance: runningBalance = runningBalance + Debit (Charge) - Credit (Payment) */
    /* Positive = Due, Negative = Advance */
    let balance = 0;
    rows.forEach(row => {
      const priorBalance = balance;
      const creditToSubtract = row.type === 'payment' ? (row.credit + (row.discountAmount || 0)) : row.credit;
      balance += row.debit - creditToSubtract;
      row.runningBalance = balance;

      if (row.type === 'payment' && !row.orderId && row.itemsSummary === 'Advance Deposit') {
        if (priorBalance > 0) {
          row.itemsSummary = 'Account Payment';
        }
      }
    });

    let finalRows = rows;
    if (dateRange !== 'All Time') {
      if (dateFrom) {
        const dFrom = normalizeDate(dateFrom);
        finalRows = finalRows.filter(r => normalizeDate(r.date) >= dFrom);
      }
      if (dateTo) {
        const dTo = normalizeDate(dateTo + 'T23:59:59');
        finalRows = finalRows.filter(r => normalizeDate(r.date) <= dTo);
      }
    }

    /* Sort according to user preference (reverse chronological order) */
    if (sortOrder === 'desc') {
      finalRows.reverse();
    }

    const computedPaid = allPayments.reduce((s, p) => s + (p.credit || 0), 0);
    return { filteredRows: finalRows, totalBalance: balance, totalPaid: computedPaid };
  }, [orders, payments, allocations, filterType, sortOrder, dateFrom, dateTo, dateRange]);

  const paginatedLedgerRows = React.useMemo(() => {
    const startIndex = (currentPage - 1) * 20;
    return ledgerRows.filteredRows.slice(startIndex, startIndex + 20);
  }, [ledgerRows, currentPage]);

  /* ─── KPIs ────────────────────────────────────────── */
  const totalBilled    = orders.filter(o => !o.isDeleted).reduce((s, o) => s + (o.totalAmount || 0), 0);
  const totalPaid      = ledgerRows.totalPaid || 0;
  const outstanding    = Math.max(0, ledgerRows.totalBalance || 0);
  const advanceCredit  = ledgerRows.totalBalance < 0 ? Math.abs(ledgerRows.totalBalance) : 0;
  const orderCount     = orders.filter(o => !o.isDeleted).length;

  /* ─── Export CSV ──────────────────────────────────── */
  const exportCSV = () => {
    const headers = ['Date', 'Reference', 'Description', 'Debit (Charged)', 'Credit (Paid)', 'Running Balance'];
    const rows = ledgerRows.filteredRows.map(r => [
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const localDateStr = `${year}-${month}-${day}`;
    a.download = `statement_${selectedCustomer?.name?.replace(/\s+/g,'_')}_${localDateStr}.csv`;
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
          <h1>Customer Statement</h1>
        </div>

        {selectedCustomer && (
          <div className={styles.headerActions}>
            <button
              className={styles.btnSecondary}
              style={{ background: '#10B981', color: 'white', border: '1px solid #10B981', display: 'flex', gap: '0.4rem', alignItems: 'center' }}
              onClick={() => {
                if (!selectedCustomer.phone) {
                  alert('Customer phone number not found!');
                  return;
                }
                const origPhone = selectedCustomer.phone.toString();
                const cleanPhone = origPhone.replace(/\D/g, '');
                if (!cleanPhone) {
                  alert('Customer phone number not found!');
                  return;
                }
                let formattedPhone = cleanPhone;
                
                // Prepend country code if original phone doesn't start with '+'
                if (!origPhone.trim().startsWith('+')) {
                  const countryCode = settings.waCountryCode || '971';
                  const cleanCountryCode = countryCode.replace(/\D/g, '');
                  if (cleanCountryCode && !formattedPhone.startsWith(cleanCountryCode)) {
                    formattedPhone = cleanCountryCode + formattedPhone;
                  }
                }
                
                let message = '';
                const totalDue = selectedCustomer.balance || 0;
                if (settings.waStatementTemplate) {
                  message = settings.waStatementTemplate
                    .replace(/{customerName}/g, selectedCustomer.name)
                    .replace(/{dueAmount}/g, `${settings.currencySymbol || 'AED'} ${totalDue.toFixed(2)}`);
                } else {
                  message = `Hello ${selectedCustomer.name}, your current outstanding balance is ${settings.currencySymbol || 'AED'} ${totalDue.toFixed(2)}. Please settle it at your earliest convenience. Thank you!`;
                }

                const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
                if (window.electronAPI?.openExternal) {
                  window.electronAPI.openExternal(url);
                } else {
                  window.open(url, '_blank');
                }
              }}
            >
              Share Statement
            </button>
            <button className={styles.btnSecondary} onClick={exportCSV}>
              <Download size={16} /> Export CSV
            </button>
            <button className={styles.btnPrimary} onClick={() => { if (window.appPrint) { window.appPrint(); } else { window.print(); } }}>
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
              ? <X size={14} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); setSearchTerm(''); setOrders([]); setPayments([]); setAllocations([]); }} />
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
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Calendar size={14} color="#94A3B8" style={{ position: 'absolute', left: '12px', zIndex: 10, pointerEvents: 'none' }} />
            <CustomSelect
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              options={[
                { value: 'All', label: 'All Time' },
                { value: 'Today', label: 'Today' },
                { value: 'This Month', label: 'This Month' },
                { value: 'This Year', label: 'This Year' },
                { value: 'Custom', label: 'Custom Range' }
              ]}
              style={{ width: '180px' }}
              paddingLeft="14px"
            />
          </div>

          {dateRange === 'Custom' && (
            <>
              <div className={styles.dateField}>
                <Calendar size={14} color="#94A3B8" />
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={styles.dateInput} />
              </div>
              <span className={styles.dateSep}>to</span>
              <div className={styles.dateField}>
                <Calendar size={14} color="#94A3B8" />
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={styles.dateInput} />
              </div>
            </>
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
            ) : ledgerRows.filteredRows.length === 0 ? (
              <div className={styles.loadingRow}>No transactions found for selected filters.</div>
            ) : (
              <table className={styles.ledgerTable}>
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>REFERENCE</th>
                    <th>DESCRIPTION</th>
                    <th className={styles.numCol}>CHARGED</th>
                    <th className={styles.numCol}>DISCOUNT</th>
                    <th className={styles.numCol}>PAID</th>
                    <th className={styles.numCol}>BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLedgerRows.map((row, idx) => (
                    <tr key={idx} className={`${styles.ledgerRow} ${row.type === 'payment' ? styles.paymentRow : styles.orderRow}`}>
                      <td className={styles.dateCell}>
                        <div>{formatDate(row.date)}</div>
                        <div className={styles.timeText}>{new Date(row.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td>
                        <div className={styles.refCell}>
                          {row.type === 'order'
                            ? <Package size={13} color="#2563EB" />
                            : row.type === 'deleted_order'
                            ? <X size={13} color="#EF4444" />
                            : row.type === 'refund'
                            ? <RotateCcw size={13} color="#F59E0B" />
                            : <Wallet size={13} color="#10B981" />
                          }
                          {['order', 'deleted_order', 'refund'].includes(row.type) ? (
                            <span 
                              className={`${styles.refText} ${styles.refLink}`}
                              onClick={() => {
                                const orderIdClean = row.ref.replace('REF-', '').replace('#', '');
                                navigate(`/invoice/${orderIdClean}`);
                              }}
                            >
                              {row.ref}
                            </span>
                          ) : (
                            <span className={styles.refText}>{row.ref}</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.descCell}>
                        <div className={styles.descMain}>
                          {row.description}
                        </div>
                        {row.itemsSummary && (
                          <div className={styles.descSub}>{row.itemsSummary}</div>
                        )}
                      </td>
                      <td className={`${styles.numCol} ${styles.debitCell}`}>
                        {row.debit > 0 ? <><CurrencySymbol size={11} /> {row.debit.toFixed(2)}</> : <span className={styles.dash}>—</span>}
                      </td>
                      <td className={`${styles.numCol} ${styles.discountCell}`} style={{ color: 'var(--danger)' }}>
                        {row.paymentMethod === 'Discount' ? (
                          <><CurrencySymbol size={11} /> {row.credit.toFixed(2)}</>
                        ) : (row.discountAmount && row.discountAmount > 0) ? (
                          <><CurrencySymbol size={11} /> {row.discountAmount.toFixed(2)}</>
                        ) : (
                          <span className={styles.dash}>—</span>
                        )}
                      </td>
                      <td className={`${styles.numCol} ${styles.creditCell}`}>
                        {row.paymentMethod !== 'Discount' && row.credit > 0 ? <><CurrencySymbol size={11} /> {row.credit.toFixed(2)}</> : <span className={styles.dash}>—</span>}
                      </td>
                      <td className={`${styles.numCol} ${row.runningBalance < 0 ? styles.balanceAdvNum : row.runningBalance > 0 ? styles.balanceDueNum : styles.balanceZero}`}>
                        <CurrencySymbol size={11} /> {Math.abs(row.runningBalance).toFixed(2)}
                        {row.runningBalance < 0 && <span className={styles.advTag}> Adv</span>}
                        {row.runningBalance > 0 && <span className={styles.dueTag}> Due</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.totalsRow}>
                    <td colSpan="3" className={styles.totalsLabel}>TOTALS</td>
                    <td className={`${styles.numCol} ${styles.debitCell} ${styles.totalsNum}`}>
                      <CurrencySymbol size={12} /> {ledgerRows.filteredRows.reduce((s, r) => s + r.debit, 0).toFixed(2)}
                    </td>
                    <td className={`${styles.numCol} ${styles.discountCell} ${styles.totalsNum}`} style={{ color: 'var(--danger)' }}>
                      <CurrencySymbol size={12} /> {ledgerRows.filteredRows.reduce((s, r) => s + (r.paymentMethod === 'Discount' ? r.credit : (r.discountAmount || 0)), 0).toFixed(2)}
                    </td>
                    <td className={`${styles.numCol} ${styles.creditCell} ${styles.totalsNum}`}>
                      <CurrencySymbol size={12} /> {ledgerRows.filteredRows.reduce((s, r) => s + (r.paymentMethod === 'Discount' ? 0 : r.credit), 0).toFixed(2)}
                    </td>
                    <td className={`${styles.numCol} ${styles.totalsNum} ${
                      ledgerRows.totalBalance > 0 
                        ? styles.balanceDueNum 
                        : ledgerRows.totalBalance < 0 
                        ? styles.balanceAdvNum 
                        : styles.balanceZero
                    }`}>
                      <CurrencySymbol size={12} /> {selectedCustomer ? Math.abs(ledgerRows.totalBalance).toFixed(2) : '0.00'}
                      {ledgerRows.totalBalance > 0 && <span className={styles.dueTag}> Due</span>}
                      {ledgerRows.totalBalance < 0 && <span className={styles.advTag}> Adv</span>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            {/* Pagination Controls */}
            {ledgerRows.filteredRows.length > 20 && (
              <div className={styles.paginationContainer}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(ledgerRows.filteredRows.length / 20)}
                  onPageChange={setCurrentPage}
                  totalItems={ledgerRows.filteredRows.length}
                />
              </div>
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
