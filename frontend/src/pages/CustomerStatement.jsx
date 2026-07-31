import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, User, Download, Printer, FileText, Calendar,
  ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight,
  CheckCircle, Clock, AlertCircle, CreditCard, Wallet,
  X, Filter, Package, TrendingUp, RotateCcw, Percent
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { getLocalISOString } from '../utils/dateUtils';
import { getReceiptNumber } from '../utils/receiptNumber';
import { getDiscountScope } from '../utils/discountScope';
import CurrencySymbol from '../components/CurrencySymbol';
import Pagination from '../components/Pagination';
import CustomSelect from '../components/CustomSelect';
import styles from './CustomerStatement.module.css';

export default function CustomerStatement({ customerIdProp, selectedCustomerProp, onBackToInsight, onClose, hideHeader }) {
  const { customerId: routeCustomerId } = useParams();
  const customerId = customerIdProp || routeCustomerId;
  const [searchParams] = useSearchParams();
  const queryCustomerId = searchParams.get('customerId');
  const navigate = useNavigate();
  const { settings, formatDate } = useSettings();
  const formatDateTime = (dateVal) => {
    if (!dateVal) return '';
    const dateStr = formatDate(dateVal);
    try {
      const timeStr = new Date(dateVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} ${timeStr}`;
    } catch (e) {
      return dateStr;
    }
  };
  const printRef = useRef(null);
  const statementRequestRef = useRef(0);

  /* ─── State ──────────────────────────────────────── */
  const [searchTerm, setSearchTerm] = useState(selectedCustomerProp ? selectedCustomerProp.name : '');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(selectedCustomerProp || null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [dateRange, setDateRange] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('All'); // All | Orders | Payments
  const [sortOrder, setSortOrder] = useState('desc'); // asc | desc

  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [customerLedgerRows, setCustomerLedgerRows] = useState([]);
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

  // Save statement filters to sessionStorage
  useEffect(() => {
    if (selectedCustomer) {
      const stateToSave = {
        customerId: selectedCustomer.id,
        dateRange,
        dateFrom,
        dateTo,
        filterType,
        sortOrder,
        currentPage,
        searchTerm
      };
      sessionStorage.setItem('customer_statement_filters', JSON.stringify(stateToSave));
    }
  }, [selectedCustomer, dateRange, dateFrom, dateTo, filterType, sortOrder, currentPage, searchTerm]);

  // Restore statement filters from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('customer_statement_filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const activeCustId = customerId || parsed.customerId;
        if (parsed.customerId === activeCustId) {
          if (parsed.dateRange) setDateRange(parsed.dateRange);
          if (parsed.dateFrom) setDateFrom(parsed.dateFrom);
          if (parsed.dateTo) setDateTo(parsed.dateTo);
          if (parsed.filterType) setFilterType(parsed.filterType);
          if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
          if (parsed.currentPage) setCurrentPage(parsed.currentPage);
          if (parsed.searchTerm) setSearchTerm(parsed.searchTerm);
        }
      } catch (e) {
        console.error("Failed to parse saved filters:", e);
      }
    }
  }, [customerId]);

  // Save/Restore scroll position
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('customer_statement_scroll', window.scrollY.toString());
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!loading) {
      const savedScroll = sessionStorage.getItem('customer_statement_scroll');
      if (savedScroll) {
        const timer = setTimeout(() => {
          window.scrollTo(0, parseInt(savedScroll, 10));
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [loading]);

  /* ─── Load customer from URL or sessionStorage ── */
  useEffect(() => {
    if (selectedCustomerProp) {
      setSelectedCustomer(selectedCustomerProp);
      setSearchTerm(selectedCustomerProp.name);
      return;
    }

    const saved = sessionStorage.getItem('customer_statement_filters');
    let savedCustomerId = null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        savedCustomerId = parsed.customerId;
      } catch (e) {
        console.error("Failed to parse saved customerId:", e);
      }
    }

    const activeCustId = customerIdProp || customerId || queryCustomerId || savedCustomerId;

    if (activeCustId && window.electronAPI?.dbQuery) {
      const loadCustomer = async () => {
        try {
          const res = await window.electronAPI.dbQuery(
            'SELECT * FROM customers WHERE id = ?',
            [activeCustId]
          );
          if (res.success && res.data.length > 0) {
            setSelectedCustomer(res.data[0]);
            setSearchTerm(res.data[0].name);
          }
        } catch (err) {
          console.error("Failed to load customer details:", err);
        }
      };
      loadCustomer();
    }
  }, [selectedCustomerProp, customerIdProp, customerId, queryCustomerId]);

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

  useEffect(() => {
    const handleDbUpdate = async (e) => {
      const detail = e?.detail || e;
      const updatedCustId = detail?.customerId;
      if (selectedCustomer && (!updatedCustId || updatedCustId === selectedCustomer.id)) {
        fetchStatement(selectedCustomer.id);
        if (window.electronAPI?.dbQuery) {
          try {
            const res = await window.electronAPI.dbQuery(
              'SELECT * FROM customers WHERE id = ?',
              [selectedCustomer.id]
            );
            if (res.success && res.data.length > 0) {
              setSelectedCustomer(res.data[0]);
            }
          } catch (err) {
            console.error("Failed to refresh customer statement details:", err);
          }
        }
      }
    };
    window.addEventListener('database-updated', handleDbUpdate);
    let unsubscribe = () => {};
    if (window.electronAPI?.onDatabaseUpdated) {
      unsubscribe = window.electronAPI.onDatabaseUpdated(handleDbUpdate);
    }
    return () => {
      window.removeEventListener('database-updated', handleDbUpdate);
      unsubscribe();
    };
  }, [selectedCustomer, dateRange, dateFrom, dateTo]);

  const fetchStatement = async (customerId) => {
    // A settlement can be posted while an earlier statement query is still
    // running. Only the most recent request may update the screen, otherwise
    // an older response can hide the new payment until the user refreshes.
    const requestId = statementRequestRef.current + 1;
    statementRequestRef.current = requestId;

    if (!window.electronAPI?.dbQuery) return;
    if (dateRange === 'Custom' && (!dateFrom || !dateTo)) {
      if (requestId === statementRequestRef.current) {
        setOrders([]);
        setPayments([]);
        setAllocations([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      /* Build date conditions on the UNION wrapper */
      let orderQuery = `
        SELECT * FROM (
          SELECT 
            o.id, o.shopId, o.billNumber, o.customerId, o.totalAmount,
            COALESCE(d.paidAmount, o.paidAmount) AS paidAmount, o.dueAmount,
            o.paymentStatus, o.status, o.paymentMethod, o.items, o.createdAt, o.updatedAt,
            o.paymentBreakdown,
            CASE WHEN o.status = 'Deleted' THEN 1 ELSE 0 END AS isDeleted,
            COALESCE(d.refundStatus, d.returnStatus, o.deletedAction) AS refundStatus,
            d.refundMethod,
            COALESCE(d.returnedAt, d.deletedAt, o.deletedAt) AS returnedAt,
            d.payments
          FROM orders o
          LEFT JOIN deleted_orders d ON d.id = o.id

          UNION ALL

          SELECT 
            id, shopId, billNumber, customerId, totalAmount, paidAmount, 0 AS dueAmount, 
            originalPaymentStatus AS paymentStatus, 'Deleted' AS status, originalPaymentMethod AS paymentMethod, items, IFNULL(createdAt, deletedAt) AS createdAt, deletedAt AS updatedAt, 
            NULL AS paymentBreakdown,
            1 AS isDeleted, refundStatus, refundMethod, returnedAt, payments 
          FROM deleted_orders 
          WHERE id NOT IN (SELECT id FROM orders)
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

      const cancellationsRes = await window.electronAPI.dbQuery(
        `SELECT * FROM cancellations WHERE customerId = ? ORDER BY createdAt ASC`,
        [customerId]
      );

      const refundsRes = await window.electronAPI.dbQuery(
        `SELECT * FROM refunds WHERE customerId = ? ORDER BY createdAt ASC`,
        [customerId]
      );

      const ledgerRes = await window.electronAPI.dbQuery(
        `SELECT * FROM customer_ledger WHERE customerId = ? ORDER BY createdAt ASC`,
        [customerId]
      );

      if (requestId !== statementRequestRef.current) return;

      setOrders(ordersRes.success ? ordersRes.data : []);
      setPayments(paymentsRes.success ? paymentsRes.data : []);
      setAllocations(allocationsRes.success ? allocationsRes.data : []);
      setCancellations(cancellationsRes.success ? cancellationsRes.data : []);
      setRefunds(refundsRes.success ? refundsRes.data : []);
      setCustomerLedgerRows(ledgerRes.success ? ledgerRes.data : []);
    } catch (err) {
      if (requestId === statementRequestRef.current) {
        console.error('Statement fetch error:', err);
      }
    } finally {
      if (requestId === statementRequestRef.current) {
        setLoading(false);
      }
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
      const baseDate = selectedCustomer.createdAt || selectedCustomer.updatedAt || getLocalISOString();
      rows.push({
        date: baseDate,
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

    // Preserve timezone information: legacy rows can be stored as local (+04:00)
    // or UTC (Z). Stripping the suffix makes the same instant sort incorrectly.
    const normalizeDate = (dateValue) => {
      if (!dateValue) return 0;
      if (dateValue instanceof Date) return dateValue.getTime();

      const raw = String(dateValue).trim();
      const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T');
      const timestamp = Date.parse(isoLike);
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    orders.forEach(o => {
      if (filterType !== 'Payments') {
        const cleanRef = `${settings.invoicePrefix || '#'}${o.id}`;
        const orderDesc = `Order ${cleanRef}` + (o.isDeleted ? ' (Deleted)' : '');
        let itemSummary = '';
        try {
          const itemsList = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
          if (Array.isArray(itemsList) && itemsList.length > 0) {
            itemSummary = itemsList.map(item => `${item.qty || item.quantity || 1}x ${item.name}`).join(', ');
          }
        } catch (e) { }

        let discount = 0;
        try {
          if (o.paymentBreakdown) {
            const breakdown = typeof o.paymentBreakdown === 'string'
              ? JSON.parse(o.paymentBreakdown)
              : o.paymentBreakdown;
            discount = parseFloat(breakdown.discount || breakdown.discountAmount || breakdown.orderDiscount || 0) || 0;
          }
        } catch (e) { }

        const totalAmt = parseFloat(o.totalAmount) || 0;
        const discountEditRows = customerLedgerRows.filter(r => r.orderId === o.id && r.transactionType === 'DISCOUNT_EDIT');
        const sumDiff = discountEditRows.reduce((sum, r) => sum + (r.debit || 0) - (r.credit || 0), 0);
        const originalDiscount = Math.max(0, discount + sumDiff);
        const grossAmt = totalAmt + discount;

        // 1. Order Creation (Debit) - ALWAYS shows Gross Amount!
        rows.push({
          date: o.createdAt,
          type: 'order',
          ref: cleanRef,
          description: orderDesc,
          itemsSummary: itemSummary,
          debit: grossAmt,
          credit: 0,
          discountAmount: originalDiscount,
          status: o.isDeleted ? 'Deleted' : o.paymentStatus,
          dueAmount: o.isDeleted ? 0 : o.dueAmount,
          rawOrder: o
        });

        // 2. Initial Discount Row (Credit) - if originalDiscount > 0
        if (originalDiscount > 0) {
          rows.push({
            date: o.createdAt,
            type: 'discount',
            ref: cleanRef,
            description: 'Order Discount',
            itemsSummary: `Discount given for Order ${cleanRef}`,
            debit: 0,
            credit: originalDiscount,
            discountAmount: 0,
            status: o.isDeleted ? 'Deleted' : 'Confirmed',
            dueAmount: 0,
            rawOrder: o
          });
        }

        // 3. Cancellation Reversals
        if (o.isDeleted) {
          // Revert Order Gross Amount (Credit)
          rows.push({
            date: o.updatedAt || o.createdAt,
            type: 'cancellation',
            ref: cleanRef,
            description: `Deleted (Order ${cleanRef} Reversed)`,
            itemsSummary: `Reason: ${o.deleteReason || 'Order Deleted'}`,
            debit: 0,
            credit: grossAmt,
            discountAmount: 0,
            status: 'Deleted',
            dueAmount: 0,
            rawOrder: o
          });

          // Revert current discount (Debit) - if discount > 0
          if (discount > 0) {
            rows.push({
              date: o.updatedAt || o.createdAt,
              type: 'discount_cancel',
              ref: cleanRef,
              description: 'Order Discount Deleted',
              itemsSummary: `Discount reversed for Deleted Order ${cleanRef}`,
              debit: discount,
              credit: 0,
              discountAmount: 0,
              status: 'Deleted',
              dueAmount: 0,
              rawOrder: o
            });
          }
        }
      }
    });

    const groupedPaymentsMap = {};
    const statementPayments = payments;
    statementPayments.filter(p => p.method !== 'Refund Advance' && p.method !== 'Advance' && p.method !== 'System Auto').forEach(p => {
      const discountScope = p.method === 'Discount' ? getDiscountScope(p) : 'order';
      let amtVal = parseFloat(p.amount) || 0;
      if (p.method === 'Discount' && discountScope === 'order') {
        return;
      }
      if (p.method === 'Discount' && discountScope === 'settlement') {
        const sumDiff = customerLedgerRows
          .filter(r => {
            if (r.transactionType !== 'DISCOUNT_EDIT') return false;
            if (r.orderId && r.orderId !== '') return false;
            if (r.description.includes('Ref: ') || r.description.includes('DISC-')) {
              return r.description.includes(p.id) || (p.paymentReference && r.description.includes(p.paymentReference));
            }
            const match = r.description.match(/(?:reduced|increased) from ([\d.]+) to ([\d.]+)/);
            if (match) {
              const newAmt = parseFloat(match[2]) || 0;
              if (Math.abs(newAmt - parseFloat(p.amount)) < 0.01) {
                return true;
              }
            }
            return false;
          })
          .reduce((sum, r) => sum + (parseFloat(r.debit) || 0) - (parseFloat(r.credit) || 0), 0);
        amtVal = amtVal + sumDiff;
      }
      const timestampKey = p.method === 'Discount' && discountScope === 'settlement'
        ? (p.createdAt || p.id)
        : (p.createdAt ? p.createdAt.substring(0, 19) : p.id);
      const cleanRef = String(p.paymentReference || p.id || '');
      const refToUse = cleanRef.startsWith('DEL-') ? cleanRef.substring(4) : cleanRef;
      const referencePrefix = refToUse.split('-')[0] || 'PAY';
      const isSettlementPayment = p.method !== 'Discount'
        && ['SET', 'ACC', 'ADV'].includes(referencePrefix);
      const isReverse = amtVal < 0;
      const purposeKey = p.method === 'Discount'
        ? (discountScope === 'settlement'
          ? (isReverse ? `reverse-settlement-discount:${referencePrefix}` : 'settlement-discount')
          : (isReverse ? `reverse-discount:${referencePrefix}` : `discount:${referencePrefix}`))
        : (isReverse ? `reverse-payment:${referencePrefix}` : `payment:${p.method || referencePrefix}`);
      const key = `${timestampKey}:${purposeKey}`;

      if (!groupedPaymentsMap[key]) {
        groupedPaymentsMap[key] = {
          date: p.createdAt,
          type: 'payment',
          ref: getReceiptNumber(p),
          internalReference: p.paymentReference || p.id,
          description: `Payment – ${p.method || 'Cash'}`,
          debit: isReverse ? Math.abs(amtVal) : 0,
          credit: isReverse ? 0 : amtVal,
          discountAmount: 0,
          status: 'SUCCESS',
          dueAmount: 0,
          orderId: p.orderId,
          paymentMethod: p.method,
          discountScope,
          isSettlementPayment,
          orderIds: p.orderId ? [p.orderId] : [],
          methods: [p.method],
          receiptCount: 1
        };
      } else {
        if (isReverse) {
          groupedPaymentsMap[key].debit += Math.abs(amtVal);
        } else {
          groupedPaymentsMap[key].credit += amtVal;
        }
        if (p.orderId && !groupedPaymentsMap[key].orderIds.includes(p.orderId)) {
          groupedPaymentsMap[key].orderIds.push(p.orderId);
        }
        if (!groupedPaymentsMap[key].methods.includes(p.method)) {
          groupedPaymentsMap[key].methods.push(p.method);
        }
        groupedPaymentsMap[key].isSettlementPayment = groupedPaymentsMap[key].isSettlementPayment || isSettlementPayment;
        groupedPaymentsMap[key].receiptCount += 1;
      }
    });

    const paymentsFromTable = Object.values(groupedPaymentsMap).map(p => {
      const cleanOrderRef = p.orderId ? `${settings.invoicePrefix || '#'}${p.orderId}` : '';
      let itemsSummary = '';

      let description = p.description;
      let finalPaymentMethod = p.paymentMethod;
      if (p.paymentMethod === 'Discount') {
        if (p.debit > 0) {
          description = 'Discount Deleted';
        } else {
          description = p.discountScope === 'settlement' ? 'Settlement Discount' : 'Order Discount';
        }
      } else if (p.debit > 0) {
        description = `Reversed Payment – ${p.paymentMethod || 'Cash'}`;
      } else if (p.isSettlementPayment) {
        if (p.methods.length > 1) finalPaymentMethod = 'Multipayment';
        description = `Settlement Paid – ${finalPaymentMethod || 'Cash'}`;
      } else if (p.methods.length > 1) {
        description = 'Payment – Multipayment';
        finalPaymentMethod = 'Multipayment';
      }

      if (p.paymentMethod === 'Advance') {
        itemsSummary = `Advance Consumed for Order ${cleanOrderRef}`;
      } else if (p.paymentMethod === 'Discount') {
        if (p.debit > 0) {
          itemsSummary = p.discountScope === 'settlement'
            ? `Discount Deleted for ${cleanOrderRef || 'settlement'}`
            : `Discount Deleted for ${cleanOrderRef || 'order'}`;
        } else {
          itemsSummary = p.discountScope === 'settlement'
            ? 'Settlement discount'
            : `Order discount for ${cleanOrderRef}`;
        }
      } else if (p.debit > 0) {
        itemsSummary = `Reversed payment for ${cleanOrderRef || 'account'}`;
      } else if (p.isSettlementPayment) {
        itemsSummary = 'Customer settlement';
      } else if (p.orderIds.length > 1) {
        itemsSummary = 'Quick Pay Settlement';
      } else if (p.orderId) {
        itemsSummary = `Linked to Order ${cleanOrderRef}`;
      } else {
        const refStr = p.internalReference || p.ref || '';
        if (refStr.startsWith('QPY-')) itemsSummary = 'Quick Pay Settlement';
        else if (refStr.startsWith('ADV-')) itemsSummary = 'Advance Deposit';
        else if (refStr.startsWith('SYS-')) itemsSummary = 'System Auto Offset';
        else itemsSummary = 'Account Payment';
      }

      return {
        ...p,
        description,
        paymentMethod: finalPaymentMethod,
        itemsSummary,
        ref: p.ref
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
    if (filterType !== 'Orders' && statementPayments.length === 0) {
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

    // KPI totals are customer-wide and must not change merely because the
    // table is filtered to Orders. The filter controls visible rows only.
    const allCustomerPayments = [...paymentsFromTable, ...initialPaymentsFromOrders];
    const allPayments = filterType !== 'Orders' ? allCustomerPayments : [];

    allPayments.forEach(p => rows.push(p));

    // PUSH REFUNDS
    if (filterType !== 'Orders') {
      refunds.forEach(r => {
        const cleanOrderRef = r.orderId ? `${settings.invoicePrefix || '#'}${r.orderId}` : '';
        rows.push({
          date: r.createdAt,
          type: 'refund',
          ref: r.id || 'REFUND',
          description: `Refund Voucher (${r.refundMethod || 'Cash'})`,
          itemsSummary: r.reason ? `${r.reason}${cleanOrderRef ? ` for ${cleanOrderRef}` : ''}` : `Refund for ${cleanOrderRef}`,
          debit: r.amount || 0,
          credit: 0,
          status: 'SUCCESS',
          dueAmount: 0
        });
      });
    }

    // PUSH DISCOUNT EDITS/DELETIONS FROM LEDGER
    if (filterType !== 'Payments') {
      customerLedgerRows
        .filter(r => r.transactionType === 'DISCOUNT_EDIT')
        .forEach(r => {
          const cleanOrderRef = r.orderId ? `${settings.invoicePrefix || '#'}${r.orderId}` : '';
          rows.push({
            date: r.createdAt,
            type: 'discount_edit',
            ref: r.orderId ? `${settings.invoicePrefix || '#'}${r.orderId}` : 'DISC-EDIT',
            description: 'Discount Edited',
            itemsSummary: r.description,
            debit: r.debit || 0,
            credit: r.credit || 0,
            status: 'SUCCESS',
            dueAmount: 0
          });
        });
    }

     /* Sort chronologically (ascending) first to calculate running balance */
     rows.sort((a, b) => {
       if (a.type === 'opening_balance' && b.type !== 'opening_balance') return -1;
       if (b.type === 'opening_balance' && a.type !== 'opening_balance') return 1;
       const diff = normalizeDate(a.date) - normalizeDate(b.date);
       if (diff !== 0) return diff;
       const aIsDebit = a.debit > 0;
       const bIsDebit = b.debit > 0;
       if (aIsDebit && !bIsDebit) return -1;
       if (!aIsDebit && bIsDebit) return 1;
       return 0;
     });

    /* Apply date filter BEFORE running balance so balance is correct for the filtered window */
    let finalRows = rows;
    let openingBalanceForRange = 0; // balance accumulated BEFORE the filter window

    const hasDateFilter = dateRange !== 'All' && (dateFrom || dateTo);
    if (hasDateFilter) {
      const dFrom = dateFrom ? normalizeDate(dateFrom) : null;
      const dTo = dateTo ? normalizeDate(dateTo + 'T23:59:59') : null;

      // Compute balance from rows BEFORE the date window (opening balance for the period)
      rows.forEach(r => {
        const rDate = normalizeDate(r.date);
        const beforeWindow = dFrom ? rDate < dFrom : false;
        if (beforeWindow) {
          openingBalanceForRange += r.debit - r.credit;
        }
      });

      // Keep only rows inside the window
      finalRows = rows.filter(r => {
        const rDate = normalizeDate(r.date);
        if (dFrom && rDate < dFrom) return false;
        if (dTo && rDate > dTo) return false;
        return true;
      });
    }

    /* Running balance: Positive = Due, Negative = Advance */
    let balance = openingBalanceForRange;
    finalRows.forEach(row => {
      const priorBalance = balance;
      balance += row.debit - row.credit;
      row.runningBalance = balance;

      if (row.type === 'payment' && !row.orderId && row.itemsSummary === 'Advance Deposit') {
        if (priorBalance > 0) {
          row.itemsSummary = 'Account Payment';
        }
      }
    });

    /* If date filter is active and there's a carried-forward opening balance, prepend it as a row */
    if (hasDateFilter && openingBalanceForRange !== 0) {
      const openingRow = {
        date: dateFrom || finalRows[0]?.date || getLocalISOString(),
        type: 'opening_balance',
        ref: 'B/F',
        description: openingBalanceForRange > 0
          ? 'Opening Balance (Outstanding Carried Forward)'
          : 'Opening Balance (Advance Carried Forward)',
        itemsSummary: '',
        debit: openingBalanceForRange > 0 ? openingBalanceForRange : 0,
        credit: openingBalanceForRange < 0 ? Math.abs(openingBalanceForRange) : 0,
        status: 'SUCCESS',
        dueAmount: 0,
        runningBalance: openingBalanceForRange
      };
      finalRows = [openingRow, ...finalRows];
    }

    /* Sort according to user preference (desc = newest first) */
    if (sortOrder === 'desc') {
      finalRows = [...finalRows].reverse();
    }

    const computedPaid = allCustomerPayments.reduce((s, p) => s + (p.credit || 0), 0);
    return { filteredRows: finalRows, totalBalance: balance, totalPaid: computedPaid };
  }, [orders, payments, allocations, cancellations, refunds, customerLedgerRows, filterType, sortOrder, dateFrom, dateTo, dateRange, selectedCustomer]);

  const paginatedLedgerRows = React.useMemo(() => {
    const startIndex = (currentPage - 1) * 20;
    return ledgerRows.filteredRows.slice(startIndex, startIndex + 20);
  }, [ledgerRows, currentPage]);

  /* ─── KPIs ────────────────────────────────────────── */
  const totalBilled = orders.filter(o => !o.isDeleted).reduce((s, o) => s + (o.totalAmount || 0), 0);
  const totalPaid = ledgerRows.totalPaid || 0;
  const outstanding = Math.max(0, ledgerRows.totalBalance || 0);
  const advanceCredit = ledgerRows.totalBalance < 0 ? Math.abs(ledgerRows.totalBalance) : 0;
  const orderCount = orders.filter(o => !o.isDeleted).length;

  /* ─── Export CSV ──────────────────────────────────── */
  const exportCSV = () => {
    const headers = ['Date', 'Reference', 'Description', 'Debit (Charged)', 'Credit (Paid)', 'Running Balance'];
    const rows = ledgerRows.filteredRows.map(r => [
      formatDateTime(r.date),
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
    a.download = `statement_${selectedCustomer?.name?.replace(/\s+/g, '_')}_${localDateStr}.csv`;
    a.click();
  };

  const shareStatement = () => {
    if (!selectedCustomer) return;
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
  };

  /* ─── Status badge helper ─────────────────────────── */
  // StatusBadge was removed since Status column was removed.

  /* ─── Render ──────────────────────────────────────── */
  return (
    <div className={styles.page} style={{ padding: '1rem', background: '#F8FAFC', minHeight: '100vh' }}>

      {/* ── Header ──────────────────────────────────── */}
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.75rem' }}>
        <div className={styles.headerInfo} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {selectedCustomer ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#E2E8F0', padding: '0.25rem', borderRadius: '10px' }}>
              <button
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', borderRadius: '7px', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', background: 'transparent', color: '#475569' }}
                onClick={() => {
                  if (onBackToInsight) {
                    onBackToInsight();
                  } else {
                    navigate(`/customers?insightId=${selectedCustomer.id}`);
                  }
                }}
              >
                📋 Customer Insight
              </button>
              <button
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', borderRadius: '7px', border: 'none', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
              >
                📄 Customer Statement
              </button>
            </div>
          ) : (
            <h1>Customer Statement</h1>
          )}
        </div>

        {selectedCustomer && (
          <div className={styles.headerActions}>
            <button
              className={styles.btnSecondary}
              style={{ background: '#10B981', color: 'white', border: '1px solid #10B981', display: 'flex', gap: '0.4rem', alignItems: 'center' }}
              onClick={shareStatement}
            >
              Share Statement
            </button>
            <button className={styles.btnSecondary} onClick={exportCSV}>
              <Download size={16} /> Export CSV
            </button>
            <button className={styles.btnPrimary} onClick={() => { if (window.appPrint) { window.appPrint(); } else { window.print(); } }}>
              <Printer size={16} /> Print / PDF
            </button>
            {onClose && (
              <button
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #CBD5E1', background: 'white', cursor: 'pointer', transition: 'all 0.2s', marginLeft: '0.5rem' }}
                onClick={onClose}
              >
                <X size={20} color="#64748B" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Customer Selector + Filters ─────────────── */}
      {selectedCustomer && (
        <div className={styles.filterBar} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>

        {/* Left Side: Customer Profile Card or search */}
        {selectedCustomerProp || customerIdProp ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1rem',
              boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)'
            }}>
              {selectedCustomer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1E293B', fontWeight: 700, lineHeight: 1.2 }}>
                {selectedCustomer.name}
              </h2>
              {selectedCustomer.phone && (
                <span style={{ fontSize: '0.8rem', color: '#64748B', display: 'block', marginTop: '0.05rem' }}>
                  📞 {selectedCustomer.phone}
                </span>
              )}
            </div>
          </div>
        ) : (
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
                    <span className={c.balance > 0.005 ? styles.balanceDue : styles.balanceOk}>
                      {c.balance > 0.005 ? `Due: ` : c.balance < -0.005 ? 'Adv: ' : ''}
                      {Math.abs(c.balance) > 0.005 && <><CurrencySymbol size={10} /> {Math.abs(c.balance).toFixed(2)}</>}
                      {Math.abs(c.balance) <= 0.005 && 'Settled'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right Side Filters Wrapper */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>

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
      </div>
      )}

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
                    <th className={styles.numCol}>DEBIT</th>
                    <th className={styles.numCol}>CREDIT</th>
                    <th className={styles.numCol}>BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLedgerRows.map((row, idx) => (
                    <tr key={idx} className={`${styles.ledgerRow} ${row.type === 'payment' ? styles.paymentRow : row.type === 'opening_balance' ? styles.openingRow : styles.orderRow}`}>
                      <td className={styles.dateCell}>
                        <div>{formatDate(row.date)}</div>
                        <div className={styles.timeText}>{new Date(row.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td>
                        <div className={styles.refCell}>
                          {row.type === 'order'
                            ? <Package size={13} color="#2563EB" />
                            : row.type === 'deleted_order' || row.type === 'cancellation'
                              ? <X size={13} color="#EF4444" />
                              : row.type === 'refund'
                                ? <RotateCcw size={13} color="#F59E0B" />
                                : row.type === 'opening_balance'
                                  ? <TrendingUp size={13} color="#7C3AED" />
                                  : row.type === 'discount' || row.type === 'discount_cancel'
                                    ? <Percent size={13} color="#EF4444" />
                                    : <Wallet size={13} color="#10B981" />
                          }
                          {['order', 'deleted_order', 'cancellation', 'refund', 'discount', 'discount_cancel'].includes(row.type) ? (
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
                            <span className={styles.refText} style={row.type === 'opening_balance' ? { color: '#7C3AED', fontWeight: 600 } : {}}>{row.ref}</span>
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
                      <td className={`${styles.numCol} ${styles.creditCell}`}>
                        {row.credit > 0 ? <><CurrencySymbol size={11} /> {row.credit.toFixed(2)}</> : <span className={styles.dash}>—</span>}
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
                    <td className={`${styles.numCol} ${styles.creditCell} ${styles.totalsNum}`}>
                      <CurrencySymbol size={12} /> {ledgerRows.filteredRows.reduce((s, r) => s + r.credit, 0).toFixed(2)}
                    </td>
                    <td className={`${styles.numCol} ${styles.totalsNum} ${ledgerRows.totalBalance > 0
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
