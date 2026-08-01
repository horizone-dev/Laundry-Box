import React, { useState, useEffect, useRef } from 'react';
import {
  Search, UserPlus, Download, Calendar, MoreHorizontal,
  TrendingUp, ChevronLeft, ChevronRight, X, Phone, MapPin, CreditCard, Wallet, DollarSign, Trash2, Users, Edit2, Lock, Unlock,
  Printer, AlertTriangle, Eye, ArrowUpDown, ChevronDown, Check, Percent, QrCode, Landmark, ShieldCheck, Layers, FileText
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WhatsAppIcon from '../components/WhatsAppIcon';
import Pagination from '../components/Pagination';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID } from '../constants';
import CurrencySymbol from '../components/CurrencySymbol';
import { getLocalISOString, getLocalDateStr } from '../utils/dateUtils';
import { getReceiptNumber } from '../utils/receiptNumber';
import { getDiscountScope } from '../utils/discountScope';
import styles from './Customers.module.css';
import { checkCreditLimit } from '../utils/creditLimit';
import InvoiceTemplate from '../components/InvoiceTemplate';
import CustomerStatement from './CustomerStatement';

function PaymentMethodSelect({ value, onChange, settings }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const methods = [
    { id: 'Cash', label: 'Cash Payment', icon: <Wallet size={16} color="#10B981" />, badgeBg: '#ECFDF5', enabled: settings?.paymentMethodCashEnabled ?? true },
    { id: 'Card', label: 'Card Payment', icon: <CreditCard size={16} color="#2563EB" />, badgeBg: '#EFF6FF', enabled: settings?.paymentMethodCardEnabled ?? true },
    { id: 'UPI', label: 'UPI / QR Payment', icon: <QrCode size={16} color="#06B6D4" />, badgeBg: '#ECFEFF', enabled: settings?.paymentMethodUpiEnabled ?? true },
    { id: 'Bank', label: 'Bank Transfer', icon: <Landmark size={16} color="#4F46E5" />, badgeBg: '#EEF2FF', enabled: settings?.paymentMethodBankEnabled ?? true },
    { id: 'Nomod', label: 'Nomod Pay (Link)', icon: <ShieldCheck size={16} color="#059669" />, badgeBg: '#D1FAE5', enabled: settings?.noModPayEnabled && settings?.enableNomod },
    { id: 'Multipayment', label: 'Multipayment (Split)', icon: <Layers size={16} color="#F59E0B" />, badgeBg: '#FEF3C7', enabled: true },
  ].filter(m => m.enabled);

  const current = methods.find(m => m.id === value) || methods[0] || { id: 'Cash', label: 'Cash Payment', icon: <Wallet size={16} color="#10B981" />, badgeBg: '#ECFDF5' };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 0.85rem',
          background: 'white',
          border: '1.5px solid #CBD5E1',
          borderRadius: '10px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
          borderColor: isOpen ? 'var(--primary)' : '#CBD5E1',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ padding: '0.35rem', borderRadius: '6px', background: current.badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {current.icon}
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1E293B' }}>{current.label}</span>
        </div>
        <ChevronDown size={16} color="#64748B" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.05)',
          padding: '0.4rem',
          zIndex: 99999,
          maxHeight: '250px',
          overflowY: 'auto'
        }}>
          {methods.map((m) => {
            const isSelected = value === m.id;
            return (
              <div
                key={m.id}
                onClick={() => {
                  onChange(m.id);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: isSelected ? '#EFF6FF' : 'transparent',
                  color: isSelected ? 'var(--primary)' : '#334155',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ padding: '0.35rem', borderRadius: '6px', background: m.badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {m.icon}
                  </div>
                  <span style={{ fontWeight: isSelected ? 800 : 600, fontSize: '0.85rem' }}>{m.label}</span>
                </div>
                {isSelected && <Check size={16} color="var(--primary)" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// An "Advance" record linked to an order is an internal allocation of an
// existing customer advance, not a new cash/card receipt. It must never be
// edited through the normal payment editor, otherwise the allocation can be
// accidentally converted into a fresh payment method.
const isAdvanceAllocation = (payment) => payment?.method === 'Advance' && Boolean(payment?.orderId);
const getPaymentMethodLabel = (payment) => {
  if (isAdvanceAllocation(payment)) return 'Advance Applied';
  if (payment?.method === 'Discount') {
    return getDiscountScope(payment) === 'settlement' ? 'Settlement Discount' : 'Order Discount';
  }
  return payment?.method || '—';
};

export default function Customers() {
  const navigate = useNavigate();
  const { settings, formatDate } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBillsModal, setShowBillsModal] = useState(false);
  const [showQuickSettleModal, setShowQuickSettleModal] = useState(false);
  const [quickSettleSearch, setQuickSettleSearch] = useState('');
  const [customerBills, setCustomerBills] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentData, setPaymentData] = useState({ amount: '', method: 'Cash', discount: '' });
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [splitUPI, setSplitUPI] = useState('');
  const [splitBank, setSplitBank] = useState('');

  useEffect(() => {
    if (paymentData.method === 'Multipayment') {
      const cashVal = parseFloat(splitCash) || 0;
      const cardVal = parseFloat(splitCard) || 0;
      const upiVal = parseFloat(splitUPI) || 0;
      const bankVal = parseFloat(splitBank) || 0;
      const total = cashVal + cardVal + upiVal + bankVal;
      setPaymentData(prev => ({ ...prev, amount: total > 0 ? total.toFixed(2) : '' }));
    }
  }, [splitCash, splitCard, splitUPI, splitBank, paymentData.method]);

  useEffect(() => {
    if (!showPaymentModal) {
      setSplitCash('');
      setSplitCard('');
      setSplitUPI('');
      setSplitBank('');
      setPaymentData(prev => ({ ...prev, discount: '' }));
    }
  }, [showPaymentModal]);
  const [searchParams] = useSearchParams();
  const insightIdFromUrl = searchParams.get('insightId');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    openingBalance: ''
  });
  const [isOpeningBalanceUnlocked, setIsOpeningBalanceUnlocked] = useState(false);

  useEffect(() => {
    if (!showModal) {
      setIsOpeningBalanceUnlocked(false);
    }
  }, [showModal]);

  const [showEditCreditLimitModal, setShowEditCreditLimitModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editCreditLimitValue, setEditCreditLimitValue] = useState('0');
  const [managerPinValue, setManagerPinValue] = useState('');
  const [managerPinError, setManagerPinError] = useState('');
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [creditWarningDetails, setCreditWarningDetails] = useState(null);

  // ─── Customer Insight View States ──────────────────────────────────────────
  const [viewMode, setViewMode] = useState('list'); // 'list', 'insight', 'statement'
  const [insightTab, setInsightTab] = useState('sales'); // 'sales', 'payments', 'returns'
  const [customerPayments, setCustomerPayments] = useState([]);
  const [rawPayments, setRawPayments] = useState([]);
  const [editSelectedBank, setEditSelectedBank] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [showAlertReason, setShowAlertReason] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      setShowAlertReason(false);
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const getRefundedOrderForPayment = (pay) => {
    const checkOrderId = (orderId) => {
      if (!orderId) return null;
      return customerReturns.find(ret => String(ret.id) === String(orderId)) || null;
    };

    if (pay.orderId) {
      const ref = checkOrderId(pay.orderId);
      if (ref) return ref;
    }

    if (pay.paymentIds && pay.paymentIds.length > 0) {
      for (const pId of pay.paymentIds) {
        const origPay = rawPayments.find(p => String(p.id) === String(pId));
        if (origPay && origPay.orderId) {
          const ref = checkOrderId(origPay.orderId);
          if (ref) return ref;
        }
      }
    }
    return null;
  };

  const handleEditPaymentClick = async (e, pay) => {
    e.preventDefault();
    e.stopPropagation();

    const refundedOrder = getRefundedOrderForPayment(pay);
    if (refundedOrder) {
      const reasonQuery = await window.electronAPI.dbQuery(
        "SELECT reason FROM cancellations WHERE orderId = ? ORDER BY createdAt DESC LIMIT 1",
        [refundedOrder.id]
      );
      const deleteReason = reasonQuery.success && reasonQuery.data.length > 0
        ? reasonQuery.data[0].reason
        : 'No reason provided';

      const msg = `This payment cannot be edited because it is linked to Order #${settings.invoicePrefix || ''}${refundedOrder.id} which has been refunded.`;
      setToastMessage(prev => (prev && prev.msg === msg) ? null : { msg, reason: deleteReason });
      return;
    }

    if (isAdvanceAllocation(pay)) {
      setToastMessage({ msg: "This is an advance amount already applied to an order. It cannot be edited as a normal payment." });
      return;
    }
    if (pay.isSettlementGroup) {
      setToastMessage({ msg: "This is a grouped settlement payment. Editing it directly is restricted to maintain account integrity." });
      return;
    }
    if (pay.method === 'Multipayment') {
      setToastMessage({ msg: "This is a split/multipayment. Editing it directly is restricted. Please delete and re-record if needed." });
      return;
    }

    setSelectedPaymentForAction(pay);
    setEditPaymentMethod(pay.method || 'Cash');
    setEditPaymentAmount(pay.amount ? pay.amount.toString() : '');

    let existingBankId = '';
    const datePrefix = pay.createdAt ? pay.createdAt.substring(0, 10) : '';
    const txnRes = await window.electronAPI.dbQuery(
      "SELECT bankAccountId FROM account_transactions WHERE amount = ? AND (description LIKE ? OR date LIKE ?) LIMIT 1",
      [pay.amount, `%${selectedCustomer?.name || ''}%`, `${datePrefix}%`]
    );
    if (txnRes.success && txnRes.data.length > 0) {
      existingBankId = txnRes.data[0].bankAccountId || '';
    }
    
    const defaultBankForMethod = pay.method === 'Card'
      ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || '')
      : (pay.method === 'UPI'
        ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || '')
        : (settings.defaultBankId || settings.bankAccounts?.[0]?.id || ''));

    setEditSelectedBank(existingBankId || defaultBankForMethod);
    setPinActionTarget('edit_payment');
    setShowPinModal(true);
  };

  const handleDeletePaymentClick = async (e, pay) => {
    e.preventDefault();
    e.stopPropagation();

    const refundedOrder = getRefundedOrderForPayment(pay);
    if (refundedOrder) {
      const reasonQuery = await window.electronAPI.dbQuery(
        "SELECT reason FROM cancellations WHERE orderId = ? ORDER BY createdAt DESC LIMIT 1",
        [refundedOrder.id]
      );
      const deleteReason = reasonQuery.success && reasonQuery.data.length > 0
        ? reasonQuery.data[0].reason
        : 'No reason provided';

      const msg = `This payment cannot be deleted because it is linked to Order #${settings.invoicePrefix || ''}${refundedOrder.id} which has been refunded.`;
      setToastMessage(prev => (prev && prev.msg === msg) ? null : { msg, reason: deleteReason });
      return;
    }

    if (isAdvanceAllocation(pay)) {
      setToastMessage({ msg: "This is an advance amount already applied to an order. It cannot be deleted directly." });
      return;
    }

    setSelectedPaymentForAction(pay);
    setPinActionTarget('delete_payment');
    setShowPinModal(true);
  };

  const [customerDiscounts, setCustomerDiscounts] = useState([]);
  const [customerDeletedDiscounts, setCustomerDeletedDiscounts] = useState([]);
  const [customerDeletedBills, setCustomerDeletedBills] = useState([]);
  const [selectedPaymentAllocations, setSelectedPaymentAllocations] = useState([]);
  const [customerReturns, setCustomerReturns] = useState([]);
  const [selectedPaymentForAction, setSelectedPaymentForAction] = useState(null);
  const [showPaymentViewModal, setShowPaymentViewModal] = useState(false);
  const [showPaymentEditModal, setShowPaymentEditModal] = useState(false);
  const [showDiscountEditModal, setShowDiscountEditModal] = useState(false);
  const [selectedBillForDiscount, setSelectedBillForDiscount] = useState(null);
  const [editDiscountValue, setEditDiscountValue] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('Cash');
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinActionTarget, setPinActionTarget] = useState(null);
  const [selectedCustomerIdForAction, setSelectedCustomerIdForAction] = useState(null);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState(null);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [orderToRefund, setOrderToRefund] = useState(null);
  const [selectedRefundMethod, setSelectedRefundMethod] = useState('Cash');
  const [selectedCustomerStats, setSelectedCustomerStats] = useState({
    totalSales: 0,
    pendingDue: 0,
    salesReturn: 0,
    totalDiscount: 0
  });

  const [orderToDelete, setOrderToDelete] = useState(null);
  const [showOrderDeletePinModal, setShowOrderDeletePinModal] = useState(false);
  const [orderDeletePinValue, setOrderDeletePinValue] = useState('');
  const [orderDeletePinError, setOrderDeletePinError] = useState('');
  const [deleteOption, setDeleteOption] = useState('refund');
  const [refundMethod, setRefundMethod] = useState('Cash');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  const handleDeleteOrderInInsight = async () => {
    if (!orderToDelete) return;
    setIsDeletingOrder(true);
    try {
      let pinOwner = null;
      const configuredPin = settings.orderDeletePin || '0000';

      if (orderDeletePinValue === configuredPin) {
        pinOwner = 'Shop Settings PIN';
      } else {
        if (window.electronAPI?.dbQuery) {
          try {
            const userCheck = await window.electronAPI.dbQuery(
              `SELECT name, role FROM users WHERE (role IN ('admin', 'manager', 'super_admin')) AND (passcode = ? OR pin = ?)`,
              [orderDeletePinValue, orderDeletePinValue]
            );
            if (userCheck.success && userCheck.data && userCheck.data.length > 0) {
              pinOwner = `${userCheck.data[0].role}: ${userCheck.data[0].name}`;
            }
          } catch (dbErr) {
            console.warn('Local users PIN check error:', dbErr);
          }
        }
      }

      if (!pinOwner) {
        setOrderDeletePinError('Invalid Manager PIN. Please enter the Order Delete PIN configured in Settings.');
        setIsDeletingOrder(false);
        return;
      }

      const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
      const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
      const currentLoggedInUser = `${userRole}: ${userSession.name || userSession.username || 'User'}`;
      const refundImmediately = deleteOption === 'refund';
      let linkedPayments = [];

      if (window.electronAPI?.dbQuery) {
        const linkedPaymentsRes = await window.electronAPI.dbQuery(
          'SELECT id, amount, createdAt, method FROM payments WHERE orderId = ?',
          [orderToDelete.id]
        );
        linkedPayments = linkedPaymentsRes.success ? linkedPaymentsRes.data : [];
      }

      // A. Perform ERP Soft Delete Transaction in SQLite
      if (window.electronAPI?.softDeleteOrder) {
        const softRes = await window.electronAPI.softDeleteOrder({
          orderId: orderToDelete.id,
          deletedBy: currentLoggedInUser,
          deleteReason: deleteReason || `Deleted by ${pinOwner}`,
          deleteAction: deleteOption,
          refundMethod: refundMethod
        });

        if (!softRes.success) {
          throw new Error(softRes.error || 'Failed to soft delete order');
        }

        await window.electronAPI.runDataHealer(orderToDelete.customerId || selectedCustomer?.id);
      } else if (window.electronAPI?.dbQuery) {
        await window.electronAPI.dbQuery('UPDATE orders SET status = "Deleted", deletedAt = ?, deletedBy = ?, deleteReason = ? WHERE id = ?', [
          getLocalISOString(), currentLoggedInUser, deleteReason || `Deleted by ${pinOwner}`, orderToDelete.id
        ]);
      }

      if (selectedCustomer) {
        if (window.electronAPI?.dbQuery) {
          const updatedCustRes = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE id = ?', [selectedCustomer.id]);
          if (updatedCustRes.success && updatedCustRes.data.length > 0) {
            const freshCust = updatedCustRes.data[0];
            setSelectedCustomer(freshCust);
            await handleViewCustomerInsight(freshCust);
          }
        }
        await fetchCustomers();
      }

      setShowOrderDeletePinModal(false);
      setOrderToDelete(null);
      setOrderDeletePinValue('');
      setOrderDeletePinError('');
      alert(`Order ${orderToDelete.id} and all its associated payments/transactions deleted successfully.`);
    } catch (err) {
      console.error('Failed to delete order:', err);
      setOrderDeletePinError('Failed to delete order: ' + err.message);
    } finally {
      setIsDeletingOrder(false);
    }
  };


  const [sortBy, setSortBy] = useState('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef(null);

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'id_asc', label: 'ID (Low → High)' },
    { value: 'id_desc', label: 'ID (High → Low)' },
    { value: 'name_asc', label: 'Name (A → Z)' },
    { value: 'name_desc', label: 'Name (Z → A)' },
    { value: 'due_desc', label: 'Highest Due First' },
    { value: 'adv_desc', label: 'Highest Advance First' },
  ];

  // One-time fix on mount: run data healer to correct any stale customer balances
  // from before the 'Deleted orders inflating balance' bug fix.
  useEffect(() => {
    fetchCustomers();
  }, []); // runs only once on mount

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm, sortBy, currentPage]);

  useEffect(() => {
    const handleDbUpdate = async (e) => {
      const detail = e?.detail || e;
      fetchCustomers();
      const updatedCustId = detail?.customerId;
      if (selectedCustomer && (!updatedCustId || updatedCustId === selectedCustomer.id)) {
        if (window.electronAPI?.dbQuery) {
          try {
            const res = await window.electronAPI.dbQuery(
              'SELECT * FROM customers WHERE id = ?',
              [selectedCustomer.id]
            );
            if (res.success && res.data.length > 0) {
              const freshCust = res.data[0];
              setSelectedCustomer(freshCust);
              if (viewMode === 'insight' || viewMode === 'statement') {
                await handleViewCustomerInsight(freshCust);
              }
            }
          } catch (err) {
            console.error("Failed to refresh selected customer in Customers page:", err);
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
  }, [selectedCustomer, searchTerm, sortBy, currentPage, viewMode]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setShowBillsModal(false);
        setShowPaymentModal(false);
        setShowQuickSettleModal(false);
        setShowEditCreditLimitModal(false);
        setSelectedInvoiceForView(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (insightIdFromUrl && window.electronAPI?.dbQuery) {
      window.electronAPI.dbQuery('SELECT * FROM customers WHERE id = ?', [insightIdFromUrl])
        .then(res => {
          if (res.success && res.data.length > 0) {
            handleViewCustomerInsight(res.data[0]);
          }
        })
        .catch(err => console.error("Failed to load customer insight from URL:", err));
    }
  }, [insightIdFromUrl]);



  useEffect(() => {
    const isAnyOpen = showModal || showBillsModal || showPaymentModal || showQuickSettleModal || showEditCreditLimitModal || selectedInvoiceForView;
    if (isAnyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal, showBillsModal, showPaymentModal, showQuickSettleModal, showEditCreditLimitModal, selectedInvoiceForView]);

  const PAGE_SIZE = 20;

  const fetchCustomers = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        let conditions = [];
        let params = [];

        if (searchTerm) {
          conditions.push('(c.name LIKE ? OR c.id LIKE ? OR c.phone LIKE ?)');
          const param = `%${searchTerm}%`;
          params.push(param, param, param);
        }

        const whereStr = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        let orderByClause = 'c.rowid DESC';
        if (sortBy === 'oldest' || sortBy === 'id_asc') {
          orderByClause = 'c.rowid ASC';
        } else if (sortBy === 'newest' || sortBy === 'id_desc') {
          orderByClause = 'c.rowid DESC';
        } else if (sortBy === 'name_asc') {
          orderByClause = 'c.name ASC';
        } else if (sortBy === 'name_desc') {
          orderByClause = 'c.name DESC';
        } else if (sortBy === 'due_desc') {
          orderByClause = 'c.balance DESC';
        } else if (sortBy === 'adv_desc') {
          orderByClause = 'c.balance ASC';
        }

        const offset = (currentPage - 1) * PAGE_SIZE;

        // Count total for pagination
        const countResult = await window.electronAPI.dbQuery(
          `SELECT COUNT(*) as cnt FROM customers c ${whereStr}`,
          params
        );
        if (countResult.success && countResult.data.length > 0) {
          setTotalCustomers(countResult.data[0].cnt || 0);
        }

        // Fetch paginated customers (totalSales subquery only on visible page)
        const query = `
          SELECT c.*, 
                 (SELECT IFNULL(SUM(o.totalAmount), 0) 
                  FROM orders o 
                  WHERE o.customerId = c.id AND o.status NOT IN ('Cancelled', 'Deleted')) as totalSales
          FROM customers c
          ${whereStr}
          ORDER BY ${orderByClause}
          LIMIT ? OFFSET ?
        `;

        const result = await window.electronAPI.dbQuery(query, [...params, PAGE_SIZE, offset]);
        if (result.success) {
          setCustomers(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setCustomers([]);
      setLoading(false);
    }
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    const timestamp = getLocalISOString();
    const openBal = parseFloat(formData.openingBalance) || 0;

    const cleanPhone = (formData.phone || '').trim();
    const defaultCc = settings.waCountryCode ? `+${settings.waCountryCode.replace(/\+/g, '')}` : '+971';
    if (!cleanPhone || cleanPhone === defaultCc || cleanPhone === '+' || cleanPhone.replace(/\D/g, '').length < 7) {
      alert('Phone number is mandatory! Please enter a valid phone number.');
      return;
    }

    if (window.electronAPI?.dbQuery) {
      try {
        // Check for duplicate customer with same phone number
        const phoneDigits = cleanPhone.replace(/\D/g, '');
        const existingCusts = await window.electronAPI.dbQuery('SELECT id, name, phone FROM customers');
        if (existingCusts.success && existingCusts.data) {
          const duplicate = existingCusts.data.find(c => {
            if (editingCustomer && c.id === editingCustomer.id) return false;
            const cDigits = (c.phone || '').replace(/\D/g, '');
            return cDigits && cDigits === phoneDigits;
          });
          if (duplicate) {
            alert(`A customer with phone number "${formData.phone}" already exists! (Customer: ${duplicate.name})`);
            return;
          }
        }

        let targetCustId = editingCustomer ? editingCustomer.id : null;

        if (editingCustomer) {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET name = ?, phone = ?, address = ?, openingBalance = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [formData.name, formData.phone, formData.address, openBal, timestamp, editingCustomer.id]
          );
          alert('Customer updated successfully!');
        } else {
          const res = await window.electronAPI.dbQuery('SELECT id FROM customers');
          let nextNum = 1;
          if (res.success && res.data) {
            const numbers = res.data.map(c => {
              const parts = c.id.split('-');
              const num = parseInt(parts[1]);
              return isNaN(num) || num > 999999 ? 0 : num;
            });
            nextNum = Math.max(0, ...numbers) + 1;
          }
          targetCustId = `CUST-${nextNum}`;

          await window.electronAPI.dbQuery(
            "DELETE FROM payments WHERE customerId = ? AND (orderId IS NULL OR orderId = '')",
            [targetCustId]
          );

          await window.electronAPI.dbQuery(
            'INSERT INTO customers (id, shopId, name, phone, email, address, creditLimit, balance, openingBalance, isSynced, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [targetCustId, DEFAULT_SHOP_ID, formData.name, formData.phone, '', formData.address, 0, openBal, openBal, 0, timestamp, timestamp]
          );
          alert('Customer created successfully!');
        }

        if (openBal < 0) {
          const advAmt = Math.abs(openBal);
          const existingPay = await window.electronAPI.dbQuery(
            "SELECT id FROM payments WHERE customerId = ? AND method = 'Opening Advance'",
            [targetCustId]
          );
          if (existingPay.success && existingPay.data.length > 0) {
            await window.electronAPI.dbQuery(
              "UPDATE payments SET amount = ?, updatedAt = ? WHERE id = ?",
              [advAmt, timestamp, existingPay.data[0].id]
            );
          } else {
            const payIdAdv = `PAY-OPENING-${Date.now()}`;
            const payRefAdv = await window.electronAPI.getNextPaymentReference('ADV');
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
               VALUES (?, ?, NULL, ?, ?, 'Opening Advance', 'SUCCESS', ?, 0, ?, ?)`,
              [payIdAdv, targetCustId, DEFAULT_SHOP_ID, advAmt, timestamp, timestamp, payRefAdv]
            );
          }
        }

        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer(targetCustId);
        }

        setSortBy('newest');
        setSearchTerm('');
        setCurrentPage(1);
        await fetchCustomers();
        setShowModal(false);
        setEditingCustomer(null);
        setFormData({ name: '', phone: '', address: '', openingBalance: '' });
      } catch (err) {
        console.error("Failed to save customer:", err);
      }
    } else {
      // Web demo
      if (editingCustomer) {
        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...formData } : c));
      } else {
        const id = `CUST-${customers.length + 1}`;
        setCustomers([{ ...formData, id, orders: 0, lastDate: 'Just now', tag: 'New', balance: openBal, openingBalance: openBal, creditLimit: 0 }, ...customers]);
      }
      setShowModal(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', address: '', openingBalance: '' });
    }
  };

  const handleVerifyManagerPin = async (e) => {
    e.preventDefault();
    setManagerPinError('');
    const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
    const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
    const userId = `${userRole}: ${userSession.name || userSession.username || 'User'}`;

    try {
      const res = await window.electronAPI.verifyManagerPin({
        pin: managerPinValue,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        orderId: `SETTLE-CUST-${selectedCustomer.id.substring(0, 5)}`,
        creditLimit: creditWarningDetails.creditLimit,
        outstandingBalance: creditWarningDetails.currentOutstanding,
        orderAmount: creditWarningDetails.orderAmount,
        exceededAmount: creditWarningDetails.exceededAmount,
        userId
      });

      if (res.success) {
        setShowCreditWarning(false);
        setManagerPinValue('');
        setTimeout(() => {
          handlePayment(null, true);
        }, 50);
      } else {
        setManagerPinError(res.error || "Incorrect PIN! Access Denied.");
      }
    } catch (err) {
      setManagerPinError("An error occurred during verification");
    }
  };

  const handleCancelOverride = async () => {
    const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
    const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
    const userId = `${userRole}: ${userSession.name || userSession.username || 'User'}`;

    try {
      await window.electronAPI.logOverrideRejection({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        orderId: `SETTLE-CUST-${selectedCustomer.id.substring(0, 5)}`,
        creditLimit: creditWarningDetails.creditLimit,
        outstandingBalance: creditWarningDetails.currentOutstanding,
        orderAmount: creditWarningDetails.orderAmount,
        exceededAmount: creditWarningDetails.exceededAmount,
        userId,
        actionType: 'REJECTED'
      });
    } catch (err) {
      console.error("Failed to log override rejection:", err);
    }

    setShowCreditWarning(false);
    setManagerPinValue('');
    setManagerPinError('');
  };

  const handlePayment = async (e, isOverridden = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedCustomer || !paymentData.amount) return;

    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) return;

    if (!isOverridden) {
      const checkRes = await checkCreditLimit(selectedCustomer.id, -amount, settings);
      if (checkRes.blocked) {
        setCreditWarningDetails(checkRes.details);
        setShowCreditWarning(true);
        return;
      }
    }

    if (window.electronAPI?.dbQuery) {
      try {
        const totalPaid = parseFloat(paymentData.amount);
        const discountAmt = parseFloat(paymentData.discount) || 0;
        const timestamp = getLocalISOString();

        if (window.electronAPI?.settleCustomerBalance) {
          const centralSplits = paymentData.method === 'Multipayment'
            ? [
              { method: 'Cash', amount: parseFloat(splitCash) || 0 },
              { method: 'Card', amount: parseFloat(splitCard) || 0 },
              { method: 'UPI', amount: parseFloat(splitUPI) || 0 },
              { method: 'Bank', amount: parseFloat(splitBank) || 0 }
            ].filter((split) => split.amount > 0)
            : [{ method: paymentData.method, amount: totalPaid }];
          const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
          const bankForMethod = (method) => method === 'Card'
            ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
            : (method === 'UPI'
              ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
              : (method === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null));
          const result = await window.electronAPI.settleCustomerBalance({
            customerId: selectedCustomer.id,
            orderId: selectedBillForPayment?.id || null,
            shopId: DEFAULT_SHOP_ID,
            splits: centralSplits.map((split) => ({ ...split, bankAccountId: bankForMethod(split.method) })),
            discount: discountAmt,
            cardCommissionRate: settings.cardCommission || 0,
            actor: {
              id: currentUser.id || 'SYSTEM',
              name: currentUser.name || currentUser.username || 'System',
              role: currentUser.role || 'system'
            },
            description: selectedBillForPayment
              ? `Customer payment for order ${selectedBillForPayment.id}`
              : `Customer payment for ${selectedCustomer.name}`
          });

          if (!result?.success) throw new Error(result?.error || 'Payment could not be posted.');
          setShowPaymentModal(false);
          setPaymentData({ amount: '', method: 'Cash' });
          setSelectedBillForPayment(null);
          await fetchCustomers();
          window.dispatchEvent(new CustomEvent('database-updated', { detail: { customerId: selectedCustomer.id } }));

          if ((viewMode === 'insight' || viewMode === 'statement') && selectedCustomer) {
            const freshCustRes = await window.electronAPI.dbQuery(
              "SELECT c.*, (SELECT IFNULL(SUM(totalAmount), 0) FROM orders WHERE customerId = c.id AND status NOT IN ('Cancelled', 'Deleted')) as totalSales FROM customers c WHERE c.id = ?",
              [selectedCustomer.id]
            );
            if (freshCustRes.success && freshCustRes.data.length > 0) {
              await handleViewCustomerInsight(freshCustRes.data[0]);
            }
          }

          alert(`Payment completed. Advance created: ${(result.advanceCreated || 0).toFixed(2)}`);
          return;
        }

        if (discountAmt > 0) {
          let targetBill = selectedBillForPayment;
          if (!targetBill) {
            const pendingBillRes = await window.electronAPI.dbQuery(
              "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND (dueAmount > 0 OR paymentStatus = 'Credit' OR paymentStatus = 'Partial') ORDER BY createdAt ASC LIMIT 1",
              [selectedCustomer.id]
            );
            if (pendingBillRes.success && pendingBillRes.data.length > 0) {
              targetBill = pendingBillRes.data[0];
            }
          }
          if (targetBill) {
            let breakdownObj = {};
            let oldDisc = 0;
            try {
              if (targetBill.paymentBreakdown) {
                breakdownObj = typeof targetBill.paymentBreakdown === 'string' ? JSON.parse(targetBill.paymentBreakdown) : targetBill.paymentBreakdown;
                oldDisc = parseFloat(breakdownObj.discount || breakdownObj.discountAmount || 0) || 0;
              }
            } catch (e) { }
            const newDisc = oldDisc + discountAmt;
            const grossTotal = (targetBill.totalAmount || 0) + oldDisc;
            const newNetTotal = Math.max(0, grossTotal - newDisc);
            const newDue = Math.max(0, newNetTotal - (targetBill.paidAmount || 0));
            const newPayStatus = newDue <= 0 ? 'Paid' : ((targetBill.paidAmount || 0) > 0 ? 'Partial' : 'Credit');
            breakdownObj.discount = newDisc;

            await window.electronAPI.dbQuery(
              "UPDATE orders SET totalAmount = ?, dueAmount = ?, paymentStatus = ?, paymentBreakdown = ?, isSynced = 0, updatedAt = ? WHERE id = ?",
              [newNetTotal, newDue, newPayStatus, JSON.stringify(breakdownObj), timestamp, targetBill.id]
            );

            // Discount is not entered in account_transactions
          }
        }

        console.log(`Starting settlement for ${selectedCustomer.name}. Amount: ${totalPaid}`);

        // Prepare splits
        let splits = [];
        if (paymentData.method === 'Multipayment') {
          const cashVal = parseFloat(splitCash) || 0;
          const cardVal = parseFloat(splitCard) || 0;
          const upiVal = parseFloat(splitUPI) || 0;
          const bankVal = parseFloat(splitBank) || 0;
          if (cashVal > 0) splits.push({ method: 'Cash', amount: cashVal });
          if (cardVal > 0) splits.push({ method: 'Card', amount: cardVal });
          if (upiVal > 0) splits.push({ method: 'UPI', amount: upiVal });
          if (bankVal > 0) splits.push({ method: 'Bank', amount: bankVal });
        } else {
          splits.push({ method: paymentData.method, amount: totalPaid });
        }

        let totalRemaining = 0;

        // Process splits sequentially
        for (const split of splits) {
          let remainingPayment = split.amount;

          // 1. Fetch oldest unpaid/partial bills first (FIFO)
          const billsRes = await window.electronAPI.dbQuery(
            "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND (dueAmount > 0 OR paymentStatus = 'Credit' OR paymentStatus = 'Partial') AND status NOT IN ('Cancelled', 'Deleted') ORDER BY createdAt ASC",
            [selectedCustomer.id]
          );

          let billsToProcess = [];
          if (billsRes.success && billsRes.data.length > 0) {
            billsToProcess = billsRes.data;
          }

          if (selectedBillForPayment) {
            billsToProcess = billsToProcess.filter(b => b.id !== selectedBillForPayment.id);
            const selBillRes = await window.electronAPI.dbQuery("SELECT * FROM orders WHERE id = ?", [selectedBillForPayment.id]);
            if (selBillRes.success && selBillRes.data.length > 0) {
              billsToProcess.unshift(selBillRes.data[0]);
            } else {
              billsToProcess.unshift(selectedBillForPayment);
            }
          }

          // Insert a single payment record for the total split amount first
          const payId = await getNextRvNumber();
          const payRef = await window.electronAPI.getNextPaymentReference('PAY');
          await window.electronAPI.dbQuery(
            `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [payId, selectedCustomer.id, DEFAULT_SHOP_ID, split.amount, split.method, 'SUCCESS', timestamp, timestamp, payRef]
          );

          if (billsToProcess.length > 0) {
            console.log(`Found ${billsToProcess.length} pending bills.`);
            for (const bill of billsToProcess) {
              if (remainingPayment <= 0) break;

              const currentDue = bill.dueAmount > 0 ? bill.dueAmount : (bill.totalAmount - (bill.paidAmount || 0));
              if (currentDue <= 0) continue;

              const currentDueCents = Math.round(currentDue * 100);
              let remainingPaymentCents = Math.round(remainingPayment * 100);

              let paymentForThisBill = 0;
              let newStatus = bill.paymentStatus || 'Credit';
              let newDue = currentDue;
              let newPaid = bill.paidAmount || 0;

              if (remainingPaymentCents >= currentDueCents) {
                paymentForThisBill = currentDue;
                remainingPayment = (remainingPaymentCents - currentDueCents) / 100;
                newDue = 0;
                newPaid += paymentForThisBill;
                newStatus = 'Paid';
              } else {
                paymentForThisBill = remainingPayment;
                newDue = (currentDueCents - remainingPaymentCents) / 100;
                newPaid += remainingPayment;
                remainingPayment = 0;
                newStatus = 'Partial';
              }

              console.log(`Applying ${paymentForThisBill} to bill ${bill.id}. New status: ${newStatus}`);

              await window.electronAPI.dbQuery(
                'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
                [newPaid, newDue, newStatus, split.method, timestamp, bill.id]
              );

              // Record the allocation in advance_allocations
              const allocId = `ALLOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              await window.electronAPI.dbQuery(
                `INSERT INTO advance_allocations (id, paymentId, orderId, amountUsed, date, isSynced, updatedAt) 
                 VALUES (?, ?, ?, ?, ?, 0, ?)`,
                [allocId, payId, bill.id, paymentForThisBill, timestamp, timestamp]
              );
            }
          }

          totalRemaining += remainingPayment;

          const txnId = `TXN-${Date.now()}-${split.method}`;
          const _nowC = new Date();
          const txnTimestamp = `${_nowC.getFullYear()}-${String(_nowC.getMonth() + 1).padStart(2, '0')}-${String(_nowC.getDate()).padStart(2, '0')} ${String(_nowC.getHours()).padStart(2, '0')}:${String(_nowC.getMinutes()).padStart(2, '0')}`;

          const mappedBankId = split.method === 'Card'
            ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
            : (split.method === 'UPI'
              ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
              : (split.method === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null));

          const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
          const creatorName = currentUser.name || currentUser.username || 'System';
          const creatorId = currentUser.id || 'SYSTEM';
          const creatorRole = currentUser.role || 'system';

          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              txnId,
              DEFAULT_SHOP_ID,
              (split.method === 'Bank' || split.method === 'Card' || split.method === 'UPI') ? 'BANK' : 'CASH',
              'INCOME',
              'Credit Settlement',
              split.amount,
              `Settlement from ${selectedCustomer.name} (${split.method})`,
              txnTimestamp,
              0,
              timestamp,
              'DollarSign',
              mappedBankId,
              creatorName,
              creatorId,
              creatorRole
            ]
          );

          if (split.method === 'Card' && settings.cardCommission > 0) {
            const commissionRate = parseFloat(settings.cardCommission || 0);
            const commissionAmount = split.amount * (commissionRate / 100);
            const commTxnId = `TXN-COMM-${Date.now()}-${split.method}`;
            const commDesc = `Card Commission for Credit Settlement ${selectedCustomer.name}`;
            await window.electronAPI.dbQuery(
              `INSERT INTO account_transactions 
                (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                commTxnId,
                DEFAULT_SHOP_ID,
                'BANK',
                'EXPENSE',
                'Card Commission',
                commissionAmount,
                commDesc,
                txnTimestamp,
                0,
                timestamp,
                'Percent',
                mappedBankId,
                creatorName,
                creatorId,
                creatorRole
              ]
            );
          }
        }

        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [totalPaid + discountAmt, timestamp, selectedCustomer.id]
        );

        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer(selectedCustomer.id);
        }

        setShowPaymentModal(false);
        setPaymentData({ amount: '', method: 'Cash' });
        setSelectedBillForPayment(null);
        await fetchCustomers();
        window.dispatchEvent(new CustomEvent('database-updated', { detail: { customerId: selectedCustomer.id } }));

        if ((viewMode === 'insight' || viewMode === 'statement') && selectedCustomer) {
          const freshCustRes = await window.electronAPI.dbQuery(
            "SELECT c.*, (SELECT IFNULL(SUM(totalAmount), 0) FROM orders WHERE customerId = c.id AND status NOT IN ('Cancelled', 'Deleted')) as totalSales FROM customers c WHERE c.id = ?",
            [selectedCustomer.id]
          );
          if (freshCustRes.success && freshCustRes.data.length > 0) {
            await handleViewCustomerInsight(freshCustRes.data[0]);
          }
        }
      } catch (err) {
        console.error("Payment error:", err);
        alert("Payment failed. Please check console for details.");
      }
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (window.electronAPI?.dbQuery) {
      try {
        // Fetch full customer record to check balance & openingBalance
        const custRes = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE id = ?', [id]);
        const cust = custRes?.data?.[0];

        // Check for non-zero balance or openingBalance
        const hasBalance = cust && (Math.abs(cust.balance || 0) > 0.01 || Math.abs(cust.openingBalance || 0) > 0.01);

        // Check for orders
        const ordersRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM orders WHERE customerId = ?', [id]);
        const ordersCount = ordersRes?.data?.[0]?.count || 0;

        // Check for payments
        const paymentsRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM payments WHERE customerId = ?', [id]);
        const paymentsCount = paymentsRes?.data?.[0]?.count || 0;

        // Check for deleted orders
        const deletedRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM deleted_orders WHERE customerId = ?', [id]);
        const deletedCount = deletedRes?.data?.[0]?.count || 0;

        if (hasBalance || ordersCount > 0 || paymentsCount > 0 || deletedCount > 0) {
          alert("Cannot delete customer! This customer has active transaction history, orders, pending balance, or advance amount.");
          return;
        }

        setSelectedCustomerIdForAction(id);
        setPinActionTarget('delete_customer');
        setShowPinModal(true);
      } catch (err) {
        console.error("Delete customer check error:", err);
        alert("Failed to perform customer delete checks.");
      }
    }
  };

  const executeDeleteCustomer = async (id) => {
    if (window.electronAPI?.dbQuery) {
      try {
        if (!window.confirm("Are you sure you want to delete this customer?")) return;
        await window.electronAPI.dbQuery('DELETE FROM customers WHERE id = ?', [id]);
        setSelectedCustomerIdForAction(null);
        fetchCustomers();
        alert("Customer deleted successfully!");
      } catch (err) {
        console.error("Delete customer error:", err);
        alert("Failed to delete customer.");
      }
    }
  };

  const getNextRvNumber = async () => {
    try {
      if (window.electronAPI && typeof window.electronAPI.getNextRvNumber === 'function') {
        const nextId = await window.electronAPI.getNextRvNumber();
        if (nextId) return nextId;
      }
    } catch (err) {
      console.warn("Failed to get sequential RV from main, falling back:", err);
    }
    return `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  };

  const formatPaymentId = (pay) => getReceiptNumber(pay);

  const handleUpdateCreditLimit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const newLimit = parseFloat(editCreditLimitValue);
    if (isNaN(newLimit) || newLimit < 0) {
      alert('Please enter a valid credit limit (0 or more).');
      return;
    }

    // Verify Manager PIN
    const correctPin = settings.orderDeletePin || '0000';
    if (String(managerPinValue) !== String(correctPin)) {
      setManagerPinError("Incorrect Manager PIN! Access Denied.");
      return;
    }

    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery(
          'UPDATE customers SET creditLimit = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newLimit, getLocalISOString(), selectedCustomer.id]
        );
        fetchCustomers();
        const updated = { ...selectedCustomer, creditLimit: newLimit };
        setSelectedCustomer(updated);
        handleViewCustomerInsight(updated);
        setShowEditCreditLimitModal(false);
        setEditCreditLimitValue('0');
        setManagerPinValue('');
        setManagerPinError('');
      } catch (err) {
        console.error('Update credit limit error:', err);
        alert('Failed to update credit limit.');
      }
    }
  };

  const handleVerifyPinAction = (e) => {
    e.preventDefault();
    const correctPin = settings.orderDeletePin || '0000';
    if (String(managerPinValue) !== String(correctPin)) {
      setManagerPinError("Incorrect Manager PIN! Access Denied.");
      return;
    }
    setManagerPinError('');
    setManagerPinValue('');
    setShowPinModal(false);

    if (selectedPaymentForAction && isAdvanceAllocation(selectedPaymentForAction)) {
      alert('This is an advance amount already applied to an order. It cannot be edited or deleted as a normal payment.');
      return;
    }

    if (pinActionTarget === 'delete_payment' && selectedPaymentForAction) {
      handleDeletePaymentRecord(selectedPaymentForAction.id);
    } else if (pinActionTarget === 'edit_payment' && selectedPaymentForAction) {
      // Payment and discount are separate accounting records.  Never infer a
      // discount's scope from this payment's orderId: a customer settlement
      // can legitimately be allocated across one or more orders.
      setShowPaymentEditModal(true);
    } else if (pinActionTarget === 'delete_customer' && selectedCustomerIdForAction) {
      executeDeleteCustomer(selectedCustomerIdForAction);
    } else if (pinActionTarget === 'edit_order_discount' && selectedBillForDiscount) {
      setShowDiscountEditModal(true);
    } else if (pinActionTarget === 'delete_order_discount' && selectedBillForDiscount) {
      handleDeleteOrderDiscount(selectedBillForDiscount);
    } else if (pinActionTarget === 'unlock_opening_balance') {
      setIsOpeningBalanceUnlocked(true);
    }
  };

  const getPaymentSourceInfo = (pay) => {
    if (!pay) return '';
    if (pay.orderId) {
      return `Linked to active Order #${pay.orderId}`;
    }
    // Check if it was originally part of a deleted order
    const origOrder = customerDeletedBills.find(db => {
      try {
        const snapshot = typeof db.payments === 'string' ? JSON.parse(db.payments || '[]') : (db.payments || []);
        return snapshot.some(p => p.id === pay.id);
      } catch (e) {
        return false;
      }
    });
    if (origOrder) {
      return `Moved to Customer Advance (Originally applied to Order #${origOrder.id}, which was deleted)`;
    }
    return 'General Account / Standalone';
  };

  const handleViewPaymentDetails = async (pay) => {
    if (!pay) return;

    let bankName = pay.bankName || '';
    if (!bankName && ['Card', 'UPI', 'Bank', 'Bank Transfer'].includes(pay.method)) {
      const datePrefix = pay.createdAt ? pay.createdAt.substring(0, 10) : '';
      const txnRes = await window.electronAPI.dbQuery(
        "SELECT bankAccountId FROM account_transactions WHERE amount = ? AND (description LIKE ? OR date LIKE ?) LIMIT 1",
        [pay.amount, `%${selectedCustomer?.name || ''}%`, `${datePrefix}%`]
      );
      if (txnRes.success && txnRes.data.length > 0) {
        const bankId = txnRes.data[0].bankAccountId;
        const bankAcc = settings.bankAccounts?.find(acc => acc.id === bankId || acc.bankName === bankId);
        if (bankAcc) {
          bankName = bankAcc.bankName;
        }
      }
    }

    setSelectedPaymentForAction({ ...pay, bankName });
    setShowPaymentViewModal(true);
    setSelectedPaymentAllocations([]);

    const ids = pay.paymentIds && pay.paymentIds.length > 0 ? pay.paymentIds : [pay.id];
    
    try {
      const placeholders = ids.map(() => '?').join(',');
      const payQuery = await window.electronAPI.dbQuery(
        `SELECT id, orderId, amount, method, createdAt FROM payments WHERE id IN (${placeholders})`,
        ids
      );
      const paymentsList = payQuery.success ? payQuery.data : [];

      const allocations = [];

      for (const p of paymentsList) {
        const amt = parseFloat(p.amount) || 0;
        let remaining = amt;

        if (p.orderId) {
          let isRefunded = false;
          let refundStatusText = '';
          const ordQuery = await window.electronAPI.dbQuery(
            `SELECT status FROM orders WHERE id = ?`, [p.orderId]
          );
          const delQuery = await window.electronAPI.dbQuery(
            `SELECT refundStatus FROM deleted_orders WHERE id = ?`, [p.orderId]
          );
          if (delQuery.success && delQuery.data.length > 0) {
            isRefunded = true;
            refundStatusText = delQuery.data[0].refundStatus || 'Refunded';
          } else if (ordQuery.success && ordQuery.data[0] && (ordQuery.data[0].status === 'Cancelled' || ordQuery.data[0].status === 'Deleted')) {
            isRefunded = true;
            refundStatusText = 'Cancelled';
          }

          allocations.push({
            paymentId: p.id,
            target: isRefunded ? `Order #${p.orderId} (Deleted & ${refundStatusText})` : `Order #${p.orderId}`,
            amount: amt,
            type: isRefunded ? 'Order Payment (Refunded)' : 'Order Payment',
            date: p.createdAt
          });
          remaining = 0;
          continue;
        }

        const allocQuery = await window.electronAPI.dbQuery(
          `SELECT orderId, amountUsed, createdAt FROM advance_allocations WHERE paymentId = ?`,
          [p.id]
        );
        const allocList = allocQuery.success ? allocQuery.data : [];
        
        for (const a of allocList) {
          let allocRefunded = false;
          let allocRefundStatusText = '';
          const ordQuery = await window.electronAPI.dbQuery(
            `SELECT status FROM orders WHERE id = ?`, [a.orderId]
          );
          const delQuery = await window.electronAPI.dbQuery(
            `SELECT refundStatus FROM deleted_orders WHERE id = ?`, [a.orderId]
          );
          if (delQuery.success && delQuery.data.length > 0) {
            allocRefunded = true;
            allocRefundStatusText = delQuery.data[0].refundStatus || 'Refunded';
          } else if (ordQuery.success && ordQuery.data[0] && (ordQuery.data[0].status === 'Cancelled' || ordQuery.data[0].status === 'Deleted')) {
            allocRefunded = true;
            allocRefundStatusText = 'Cancelled';
          }

          allocations.push({
            paymentId: p.id,
            target: allocRefunded ? `Order #${a.orderId} (Deleted & ${allocRefundStatusText})` : `Order #${a.orderId}`,
            amount: parseFloat(a.amountUsed) || 0,
            type: allocRefunded ? 'Advance Allocation (Reversed)' : 'Advance Allocation',
            date: a.createdAt
          });
          remaining -= parseFloat(a.amountUsed) || 0;
        }

        const refStr = String(p.paymentReference || p.id || '');
        let isOpeningSettlement = refStr.startsWith('ACC-');

        if (!isOpeningSettlement) {
          const cleanTxnId = p.id.startsWith('RV-') ? p.id.replace('RV-', '') : p.id;
          const txnQuery = await window.electronAPI.dbQuery(
            `SELECT description FROM account_transactions WHERE id = ? OR id = ? OR id = ?`,
            [`FIN-TXN-${cleanTxnId}`, `FIN-TXN-${p.id}`, `FIN-TXN-DISC-${p.id}`]
          );
          const txnDesc = txnQuery.success && txnQuery.data[0] ? txnQuery.data[0].description : '';
          if (txnDesc.toLowerCase().includes('opening/account') || txnDesc.toLowerCase().includes('settlement discount via') || txnDesc.toLowerCase().includes('settlement discount -')) {
            isOpeningSettlement = true;
          }
        }

        if (isOpeningSettlement) {
          if (remaining > 0.005) {
            allocations.push({
              paymentId: p.id,
              target: 'Account Opening Balance',
              amount: remaining,
              type: 'Opening Balance Settlement',
              date: p.createdAt
            });
            remaining = 0;
          }
        }

        if (remaining > 0.005) {
          allocations.push({
            paymentId: p.id,
            target: 'Customer Advance (Unused)',
            amount: remaining,
            type: 'Unused Advance Credit',
            date: p.createdAt
          });
        }
      }

      setSelectedPaymentAllocations(allocations);
    } catch (e) {
      console.error('Error fetching payment allocations:', e);
    }
  };

  const handleDeletePaymentRecord = async (paymentId) => {
    let payment = customerPayments.find(p => p.id === paymentId);
    if (!payment) {
      payment = customerDiscounts.find(p => p.id === paymentId);
    }
    if (!payment) return;
    if (isAdvanceAllocation(payment)) {
      alert('This is an advance amount already applied to an order. It cannot be edited or deleted as a normal payment.');
      return;
    }
    if (!window.confirm("Are you sure you want to delete this payment/discount? The customer balance will increase.")) return;

    setLoading(true);
    const timestamp = getLocalISOString();
    const idsToDelete = payment.paymentIds && payment.paymentIds.length > 0 ? [...payment.paymentIds] : [payment.id];
    const totalAmount = payment.amount || 0;

    try {
      await window.electronAPI.dbQuery("BEGIN TRANSACTION");

      // 1. Fetch individual payment records to group updates by orderId
      const pToDelRes = await window.electronAPI.dbQuery(
        `SELECT id, amount, method, orderId, createdAt FROM payments WHERE id IN (${idsToDelete.map(() => '?').join(',')})`,
        idsToDelete
      );
      let paymentsToDelete = pToDelRes.success ? pToDelRes.data : [];

      // Find any associated discount payments for the same orderId and same timestamp
      const discountIds = [];
      const discountPayments = [];
      for (const pDel of paymentsToDelete) {
        if (pDel.orderId) {
          const timePrefix = pDel.createdAt ? pDel.createdAt.substring(0, 19) : '';
          let query = "SELECT id, amount, method, orderId, createdAt FROM payments WHERE orderId = ? AND method = 'Discount'";
          let params = [pDel.orderId];
          if (timePrefix) {
            query += " AND createdAt LIKE ?";
            params.push(`${timePrefix}%`);
          }
          const discRes = await window.electronAPI.dbQuery(query, params);
          if (discRes.success && discRes.data.length > 0) {
            discRes.data.forEach(dp => {
              if (!idsToDelete.includes(dp.id) && !discountIds.includes(dp.id)) {
                discountIds.push(dp.id);
                discountPayments.push(dp);
              }
            });
          }
        }
      }

      // Merge the discount payments into the deletion lists
      if (discountIds.length > 0) {
        idsToDelete.push(...discountIds);
        paymentsToDelete = [...paymentsToDelete, ...discountPayments];
      }

      // If an unlinked advance is deleted, undo every invoice allocation that
      // used it and remove the matching System Auto receipt. Without this, an
      // invoice can remain marked as paid after its source advance is gone.
      const sourceAllocationRes = await window.electronAPI.dbQuery(
        `SELECT id, paymentId, orderId, amountUsed FROM advance_allocations
         WHERE paymentId IN (${idsToDelete.map(() => '?').join(',')})`,
        idsToDelete
      );
      const sourceAllocations = sourceAllocationRes.success ? sourceAllocationRes.data : [];
      const autoPaymentIdsToDelete = [];

      const orderUpdates = {};
      paymentsToDelete.forEach(pDel => {
        if (pDel.orderId) {
          if (!orderUpdates[pDel.orderId]) {
            orderUpdates[pDel.orderId] = {
              amountDeducted: 0,
              methodsDeducted: []
            };
          }
          orderUpdates[pDel.orderId].amountDeducted += pDel.amount || 0;
          orderUpdates[pDel.orderId].methodsDeducted.push({
            method: pDel.method,
            amount: pDel.amount || 0
          });
        }
      });

      for (const allocation of sourceAllocations) {
        if (!orderUpdates[allocation.orderId]) {
          orderUpdates[allocation.orderId] = { amountDeducted: 0, methodsDeducted: [] };
        }
        orderUpdates[allocation.orderId].amountDeducted += Number(allocation.amountUsed) || 0;
        orderUpdates[allocation.orderId].methodsDeducted.push({ method: 'System Auto', amount: Number(allocation.amountUsed) || 0 });

        const autoPaymentRes = await window.electronAPI.dbQuery(
          `SELECT id FROM payments
           WHERE orderId = ? AND method = 'System Auto' AND ABS(IFNULL(amount, 0) - ?) < 0.01
           ORDER BY createdAt DESC LIMIT 1`,
          [allocation.orderId, allocation.amountUsed]
        );
        if (autoPaymentRes.success && autoPaymentRes.data.length > 0) {
          autoPaymentIdsToDelete.push(autoPaymentRes.data[0].id);
        }
      }

      // 2. Loop and update each affected order in the database
      for (const [orderId, update] of Object.entries(orderUpdates)) {
        const orderRes = await window.electronAPI.dbQuery("SELECT * FROM orders WHERE id = ?", [orderId]);
        if (orderRes.success && orderRes.data.length > 0) {
          const bill = orderRes.data[0];
          const newPaidAmount = Math.max(0, (bill.paidAmount || 0) - update.amountDeducted);
          const newDueAmount = (bill.dueAmount || 0) + update.amountDeducted;
          const newStatus = newPaidAmount <= 0 ? 'Credit' : 'Partial';

          let paymentBreakdown = {};
          try {
            if (bill.paymentBreakdown) {
              paymentBreakdown = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
            }
          } catch (e) { }

          update.methodsDeducted.forEach(md => {
            const methodKey = md.method.toLowerCase();
            if (paymentBreakdown[methodKey] !== undefined) {
              paymentBreakdown[methodKey] = Math.max(0, (paymentBreakdown[methodKey] || 0) - md.amount);
            }
          });

          let activeMethods = Object.keys(paymentBreakdown).filter(k => k !== 'discount' && k !== 'advance' && paymentBreakdown[k] > 0);
          const keyMap = { cash: 'Cash', card: 'Card', upi: 'UPI', bank: 'Bank Transfer' };
          let finalMethodName = 'Multipayment';
          if (activeMethods.length === 1) {
            finalMethodName = keyMap[activeMethods[0]] || 'Cash';
          } else if (activeMethods.length === 0) {
            finalMethodName = 'Not Paid';
          }

          await window.electronAPI.dbQuery(
            "UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, paymentMethod = ?, paymentBreakdown = ?, isSynced = 0, updatedAt = ? WHERE id = ?",
            [newPaidAmount, newDueAmount, newStatus, finalMethodName, JSON.stringify(paymentBreakdown), timestamp, orderId]
          );
        }
      }

      // 3. Update customer balance
      await window.electronAPI.dbQuery(
        "UPDATE customers SET balance = balance + ?, isSynced = 0, updatedAt = ? WHERE id = ?",
        [totalAmount, timestamp, selectedCustomer.id]
      );

      // 4. Delete advance allocations and payment records
      const paymentIdsForDeletion = [...new Set([...idsToDelete, ...autoPaymentIdsToDelete])];
      for (const id of paymentIdsForDeletion) {
        await window.electronAPI.dbQuery("DELETE FROM advance_allocations WHERE paymentId = ?", [id]);
        const pCheckRes = await window.electronAPI.dbQuery("SELECT * FROM payments WHERE id = ?", [id]);
        if (pCheckRes.success && pCheckRes.data.length > 0) {
          const pOrig = pCheckRes.data[0];
          if (pOrig.method === 'Discount') {
            const revId = `DISC-REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference, discountScope)
               VALUES (?, ?, ?, ?, ?, 'Discount', 'SUCCESS', ?, 0, ?, ?, ?)`,
              [
                revId,
                selectedCustomer.id,
                pOrig.orderId || null,
                pOrig.shopId || DEFAULT_SHOP_ID,
                -Math.abs(pOrig.amount || 0),
                timestamp,
                timestamp,
                `DEL-${pOrig.paymentReference || pOrig.id}`,
                pOrig.discountScope || (pOrig.orderId ? 'order' : 'settlement')
              ]
            );
          } else {
            const revId = `PAY-REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference)
               VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?, 0, ?, ?)`,
              [
                revId,
                selectedCustomer.id,
                pOrig.orderId || null,
                pOrig.shopId || DEFAULT_SHOP_ID,
                -Math.abs(pOrig.amount || 0),
                pOrig.method || 'Cash',
                timestamp,
                timestamp,
                `DEL-${pOrig.paymentReference || pOrig.id}`
              ]
            );
          }
        }
      }
      for (const allocation of sourceAllocations) {
        await window.electronAPI.dbQuery("DELETE FROM advance_allocations WHERE id = ?", [allocation.id]);
      }

      // 5. Insert balancing reversal account transactions for each deleted payment amount instead of deleting original entries
      const payDate = new Date(payment.createdAt);
      const datePrefix = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}-${String(payDate.getDate()).padStart(2, '0')} ${String(payDate.getHours()).padStart(2, '0')}:${String(payDate.getMinutes()).padStart(2, '0')}`;

      const _nowC = new Date();
      const txnTimestamp = `${_nowC.getFullYear()}-${String(_nowC.getMonth() + 1).padStart(2, '0')}-${String(_nowC.getDate()).padStart(2, '0')} ${String(_nowC.getHours()).padStart(2, '0')}:${String(_nowC.getMinutes()).padStart(2, '0')}`;

      for (const pDel of paymentsToDelete) {
        const txnRes = await window.electronAPI.dbQuery(
          "SELECT * FROM account_transactions WHERE amount = ? AND (description LIKE ? OR description LIKE ? OR date LIKE ?) LIMIT 1",
          [pDel.amount, `%${selectedCustomer.name}%`, `%${pDel.orderId}%`, `${datePrefix.substring(0, 10)}%`]
        );
        if (txnRes.success && txnRes.data.length > 0) {
          const origTxn = txnRes.data[0];
          const revTxnId = `TXN-REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
          const creatorName = currentUser.name || currentUser.username || 'System';
          const creatorId = currentUser.id || 'SYSTEM';
          const creatorRole = currentUser.role || 'system';

          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              revTxnId,
              origTxn.shopId || DEFAULT_SHOP_ID,
              origTxn.accountType || ((pDel.method === 'Bank' || pDel.method === 'Card' || pDel.method === 'UPI') ? 'BANK' : 'CASH'),
              origTxn.type === 'INCOME' ? 'EXPENSE' : 'INCOME',
              'Payment Cancellation',
              pDel.amount,
              `Deleted: Payment ${getReceiptNumber(pDel)} for ${selectedCustomer.name}`,
              txnTimestamp,
              0,
              timestamp,
              'Trash2',
              origTxn.bankAccountId || null,
              creatorName,
              creatorId,
              creatorRole
            ]
          );
        } else {
          const revTxnId = `TXN-REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
          const creatorName = currentUser.name || currentUser.username || 'System';
          const creatorId = currentUser.id || 'SYSTEM';
          const creatorRole = currentUser.role || 'system';

          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              revTxnId,
              DEFAULT_SHOP_ID,
              (pDel.method === 'Bank' || pDel.method === 'Card' || pDel.method === 'UPI') ? 'BANK' : 'CASH',
              'EXPENSE',
              'Payment Cancellation',
              pDel.amount,
              `Deleted: Payment ${getReceiptNumber(pDel)} for ${selectedCustomer.name}`,
              txnTimestamp,
              0,
              timestamp,
              'Trash2',
              null,
              creatorName,
              creatorId,
              creatorRole
            ]
          );
        }
      }

      await window.electronAPI.dbQuery("COMMIT");

      if (window.electronAPI?.runDataHealer) {
        await window.electronAPI.runDataHealer(selectedCustomer.id);
      }

      const updatedCustomerRes = await window.electronAPI.dbQuery("SELECT * FROM customers WHERE id = ?", [selectedCustomer.id]);
      if (updatedCustomerRes.success && updatedCustomerRes.data.length > 0) {
        setSelectedCustomer(updatedCustomerRes.data[0]);
        await handleViewCustomerInsight(updatedCustomerRes.data[0]);
      }
      fetchCustomers();
      window.dispatchEvent(new CustomEvent('database-updated', { detail: { customerId: selectedCustomer.id } }));
      alert("Payment record deleted successfully!");
    } catch (err) {
      await window.electronAPI.dbQuery("ROLLBACK");
      console.error("Delete payment error:", err);
      alert("Failed to delete payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaymentEdit = async () => {
    if (!selectedPaymentForAction) return;
    const payment = selectedPaymentForAction;
    if (isAdvanceAllocation(payment)) {
      alert('This is an advance amount already applied to an order. It cannot be edited as a normal payment.');
      return;
    }
    const oldMethod = payment.method;
    const newMethod = editPaymentMethod;
    const oldAmount = parseFloat(payment.amount) || 0;
    const newAmount = parseFloat(editPaymentAmount) || 0;

    if (newAmount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    if (oldMethod === 'Discount') {
      if (!window.electronAPI?.editDiscountReceipt) {
        alert('Discount editing is unavailable in this application build.');
        return;
      }
      setLoading(true);
      try {
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        const result = await window.electronAPI.editDiscountReceipt({
          paymentId: payment.id,
          amount: newAmount,
          actor: {
            id: user.id || 'SYSTEM',
            name: user.name || user.username || 'System',
            role: user.role || 'system'
          }
        });
        if (!result?.success) throw new Error(result?.error || 'Discount could not be updated.');

        setShowPaymentEditModal(false);
        setSelectedPaymentForAction(null);
        const updatedCustomerRes = await window.electronAPI.dbQuery("SELECT * FROM customers WHERE id = ?", [selectedCustomer.id]);
        if (updatedCustomerRes.success && updatedCustomerRes.data.length > 0) {
          setSelectedCustomer(updatedCustomerRes.data[0]);
          await handleViewCustomerInsight(updatedCustomerRes.data[0]);
        }
        fetchCustomers();
        window.dispatchEvent(new CustomEvent('database-updated', { detail: { customerId: selectedCustomer.id } }));
        alert('Discount updated successfully!');
      } catch (err) {
        console.error('Edit discount error:', err);
        alert(err.message || 'Failed to update discount.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    const timestamp = getLocalISOString();
    const diff = newAmount - oldAmount;

    try {
      await window.electronAPI.dbQuery("BEGIN TRANSACTION");

      // A source advance cannot be reduced below the part already applied to
      // orders. The allocation must be reversed first so paid/due totals stay
      // mathematically valid.
      if (!payment.orderId) {
        const allocationRes = await window.electronAPI.dbQuery(
          'SELECT IFNULL(SUM(amountUsed), 0) AS amount FROM advance_allocations WHERE paymentId = ?',
          [payment.id]
        );
        const allocatedAmount = allocationRes.success ? (Number(allocationRes.data?.[0]?.amount) || 0) : 0;
        if (newAmount + 0.005 < allocatedAmount) {
          throw new Error(`This advance has ${allocatedAmount.toFixed(2)} already applied to orders. Reverse those allocations before reducing it.`);
        }
      }

      // 1. Update payments table
      await window.electronAPI.dbQuery(
        "UPDATE payments SET method = ?, amount = ?, isSynced = 0, updatedAt = ? WHERE id = ?",
        [newMethod, newAmount, timestamp, payment.id]
      );

      // 2. Adjust customer balance
      await window.electronAPI.dbQuery(
        "UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?",
        [diff, timestamp, selectedCustomer.id]
      );

      // 3. Update orders table if linked
      if (payment.orderId) {
        const orderRes = await window.electronAPI.dbQuery("SELECT * FROM orders WHERE id = ?", [payment.orderId]);
        if (orderRes.success && orderRes.data.length > 0) {
          const order = orderRes.data[0];
          let paymentBreakdown = {};
          try {
            if (order.paymentBreakdown) {
              paymentBreakdown = typeof order.paymentBreakdown === 'string' ? JSON.parse(order.paymentBreakdown) : order.paymentBreakdown;
            }
          } catch (e) { }

          const oldKey = oldMethod.toLowerCase();
          const newKey = newMethod.toLowerCase();

          if (paymentBreakdown[oldKey] !== undefined) {
            paymentBreakdown[oldKey] = Math.max(0, (paymentBreakdown[oldKey] || 0) - oldAmount);
          }
          paymentBreakdown[newKey] = (paymentBreakdown[newKey] || 0) + newAmount;

          let activeMethods = Object.keys(paymentBreakdown).filter(k => k !== 'discount' && k !== 'advance' && paymentBreakdown[k] > 0);
          const keyMap = { cash: 'Cash', card: 'Card', upi: 'UPI', bank: 'Bank Transfer' };
          let finalMethodName = 'Multipayment';
          if (activeMethods.length === 1) {
            finalMethodName = keyMap[activeMethods[0]] || 'Cash';
          }

          const newPaidAmount = (order.paidAmount || 0) + diff;
          const newDueAmount = Math.max(0, (order.totalAmount || 0) - newPaidAmount);

          let newPaymentStatus = 'Partial';
          if (newDueAmount <= 0) {
            newPaymentStatus = 'Paid';
          } else if (newPaidAmount <= 0) {
            newPaymentStatus = 'Credit';
          }

          await window.electronAPI.dbQuery(
            "UPDATE orders SET totalAmount = ?, paidAmount = ?, dueAmount = ?, paymentStatus = ?, paymentMethod = ?, paymentBreakdown = ?, isSynced = 0, updatedAt = ? WHERE id = ?",
            [order.totalAmount || 0, newPaidAmount, newDueAmount, newPaymentStatus, finalMethodName, JSON.stringify(paymentBreakdown), timestamp, payment.orderId]
          );
        }
      }

      // 4. Record accounting correction trail instead of directly updating the original transaction
      const payDate = new Date(payment.createdAt);
      const datePrefix = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}-${String(payDate.getDate()).padStart(2, '0')} ${String(payDate.getHours()).padStart(2, '0')}:${String(payDate.getMinutes()).padStart(2, '0')}`;

      const txnRes = await window.electronAPI.dbQuery(
        "SELECT * FROM account_transactions WHERE amount = ? AND (description LIKE ? OR date LIKE ?) LIMIT 1",
        [oldAmount, `%${selectedCustomer.name}%`, `${datePrefix.substring(0, 10)}%`]
      );

      const oldAccountType = (oldMethod === 'Bank' || oldMethod === 'Card' || oldMethod === 'UPI') ? 'BANK' : 'CASH';
      const newAccountType = (newMethod === 'Bank' || newMethod === 'Card' || newMethod === 'UPI') ? 'BANK' : 'CASH';
      const mappedBankId = (newMethod === 'Card' || newMethod === 'UPI' || newMethod === 'Bank')
        ? (editSelectedBank || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
        : null;

      const origTxn = (txnRes.success && txnRes.data.length > 0) ? txnRes.data[0] : null;
      const oldBankAccountId = origTxn ? origTxn.bankAccountId : null;

      const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
      const creatorName = currentUser.name || currentUser.username || 'System';
      const creatorId = currentUser.id || 'SYSTEM';
      const creatorRole = currentUser.role || 'system';

      const _nowC = new Date();
      const txnTimestamp = `${_nowC.getFullYear()}-${String(_nowC.getMonth() + 1).padStart(2, '0')}-${String(_nowC.getDate()).padStart(2, '0')} ${String(_nowC.getHours()).padStart(2, '0')}:${String(_nowC.getMinutes()).padStart(2, '0')}`;

      const normalizeBankId = (val) => (val === '' || val === null || val === undefined) ? null : val;
      const isBankChange = (['Card', 'UPI', 'Bank'].includes(oldMethod) || ['Card', 'UPI', 'Bank'].includes(newMethod)) && (normalizeBankId(oldBankAccountId) !== normalizeBankId(mappedBankId));

      if (oldMethod === newMethod && !isBankChange) {
        // If payment method and bank account are the same, record only the difference as an adjustment row
        const diffAmount = newAmount - oldAmount;
        if (Math.abs(diffAmount) > 0.005) {
          const adjTxnId = `TXN-ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const isIncrease = diffAmount > 0;
          const finalAmount = Math.abs(diffAmount);
          const adjType = isIncrease ? 'INCOME' : 'EXPENSE';
          const adjCategory = isIncrease ? 'Credit Settlement' : 'Payment Correction';
          const adjDesc = isIncrease 
            ? `Adjustment (Increase): Edited payment ${getReceiptNumber(payment)} for ${selectedCustomer.name}`
            : `Adjustment (Decrease): Edited payment ${getReceiptNumber(payment)} for ${selectedCustomer.name}`;

          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              adjTxnId,
              origTxn?.shopId || DEFAULT_SHOP_ID,
              newAccountType,
              adjType,
              adjCategory,
              finalAmount,
              adjDesc,
              txnTimestamp,
              0,
              timestamp,
              isIncrease ? 'DollarSign' : 'ArrowUpDown',
              mappedBankId,
              creatorName,
              creatorId,
              creatorRole
            ]
          );
        }
      } else {
        // If payment method changed, do a full reversal of the old method and post the new method
        // A. Reversal Expense for Old Payment Details
        const revTxnId = `TXN-REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            revTxnId,
            origTxn?.shopId || DEFAULT_SHOP_ID,
            oldAccountType,
            'EXPENSE',
            'Payment Correction',
            oldAmount,
            `Reversal (Edit): Converted ${oldMethod} to ${newMethod} for payment ${getReceiptNumber(payment)}`,
            txnTimestamp,
            0,
            timestamp,
            'ArrowUpDown',
            oldBankAccountId,
            creatorName,
            creatorId,
            creatorRole
          ]
        );

        // B. New Income for New Payment Details
        const newTxnId = `TXN-NEW-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newTxnId,
            origTxn?.shopId || DEFAULT_SHOP_ID,
            newAccountType,
            'INCOME',
            'Credit Settlement',
            newAmount,
            `Settlement (Edited): ${newMethod} payment ${getReceiptNumber(payment)} for ${selectedCustomer.name}`,
            txnTimestamp,
            0,
            timestamp,
            'DollarSign',
            mappedBankId,
            creatorName,
            creatorId,
            creatorRole
          ]
        );
      }

      await window.electronAPI.dbQuery("COMMIT");

      if (window.electronAPI?.runDataHealer) {
        await window.electronAPI.runDataHealer(selectedCustomer.id);
      }

      setShowPaymentEditModal(false);
      setSelectedPaymentForAction(null);

      const updatedCustomerRes = await window.electronAPI.dbQuery("SELECT * FROM customers WHERE id = ?", [selectedCustomer.id]);
      if (updatedCustomerRes.success && updatedCustomerRes.data.length > 0) {
        setSelectedCustomer(updatedCustomerRes.data[0]);
        await handleViewCustomerInsight(updatedCustomerRes.data[0]);
      }
      fetchCustomers();
      alert("Payment updated successfully!");
    } catch (err) {
      await window.electronAPI.dbQuery("ROLLBACK");
      console.error("Edit payment error:", err);
      alert("Failed to update payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDiscountEdit = async () => {
    if (!selectedBillForDiscount || !window.electronAPI?.dbQuery) return;
    const newDisc = parseFloat(editDiscountValue) || 0;
    if (newDisc < 0) {
      alert("Discount cannot be negative.");
      return;
    }

    try {
      setLoading(true);
      const timestamp = getLocalISOString();
      const billItem = selectedBillForDiscount;
      const bill = billItem.bill || billItem;

      let oldDisc = 0;
      let breakdownObj = {};
      try {
        if (bill.paymentBreakdown) {
          breakdownObj = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
          oldDisc = parseFloat(breakdownObj.discount || breakdownObj.discountAmount || breakdownObj.orderDiscount || breakdownObj.settlementDiscount || 0) || 0;
        }
      } catch (e) { }
      if (oldDisc <= 0) {
        oldDisc = parseFloat(bill.discount || bill.discountAmount || 0) || 0;
      }

      const targetCustId = bill.customerId || selectedCustomer?.id;
      const grossTotal = (bill.totalAmount || 0) + oldDisc;
      const newNetTotal = Math.max(0, grossTotal - newDisc);
      const newDue = Math.max(0, newNetTotal - (bill.paidAmount || 0));
      const newPayStatus = newDue <= 0 ? 'Paid' : ((bill.paidAmount || 0) > 0 ? 'Partial' : 'Credit');

      breakdownObj.discount = newDisc;
      const newBreakdownStr = JSON.stringify(breakdownObj);

      await window.electronAPI.dbQuery("BEGIN TRANSACTION");

      await window.electronAPI.dbQuery(
        `UPDATE orders SET totalAmount = ?, dueAmount = ?, paymentStatus = ?, paymentBreakdown = ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
        [newNetTotal, newDue, newPayStatus, newBreakdownStr, timestamp, bill.id]
      );

      const diff = newDisc - oldDisc;
      if (Math.abs(diff) > 0.005) {
        const revId = `DISC-REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await window.electronAPI.dbQuery(
          `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference, discountScope)
           VALUES (?, ?, ?, ?, ?, 'Discount', 'SUCCESS', ?, 0, ?, ?, 'order')`,
          [
            revId,
            targetCustId,
            bill.id,
            DEFAULT_SHOP_ID,
            diff,
            timestamp,
            timestamp,
            `EDIT-ORD-${bill.id}`,
            'order'
          ]
        );
        const debitAmt = diff < 0 ? Math.abs(diff) : 0;
        const creditAmt = diff > 0 ? diff : 0;
        const descStr = diff < 0
          ? `Order #${bill.id} discount reduced from ${oldDisc.toFixed(2)} to ${newDisc.toFixed(2)} (Difference: ${Math.abs(diff).toFixed(2)})`
          : `Order #${bill.id} discount increased from ${oldDisc.toFixed(2)} to ${newDisc.toFixed(2)} (Difference: ${diff.toFixed(2)})`;
        
        await window.electronAPI.dbQuery(
          `INSERT INTO customer_ledger (id, shopId, customerId, orderId, transactionType, debit, credit, balance, description, createdAt) VALUES (?, ?, ?, ?, 'DISCOUNT_EDIT', ?, ?, ?, ?, ?)`,
          [`CUST-DISC-EDIT-${Date.now()}-${Math.floor(Math.random() * 100000)}`, DEFAULT_SHOP_ID, targetCustId, bill.id, debitAmt, creditAmt, 0, descStr, timestamp]
        );

        // REDISTRIBUTE PAYMENTS
        const orderPayRes = await window.electronAPI.dbQuery(
          `SELECT * FROM payments WHERE orderId = ? AND method != 'Discount' LIMIT 1`,
          [bill.id]
        );
        const orderPayment = orderPayRes.success && orderPayRes.data[0] ? orderPayRes.data[0] : null;

        if (orderPayment) {
          const unlinkPayRes = await window.electronAPI.dbQuery(
            `SELECT * FROM payments WHERE customerId = ? AND orderId IS NULL AND createdAt = ? AND method != 'Discount' LIMIT 1`,
            [targetCustId, orderPayment.createdAt]
          );
          const unlinkedPayment = unlinkPayRes.success && unlinkPayRes.data[0] ? unlinkPayRes.data[0] : null;

          if (diff > 0) {
            const excess = diff;
            if (unlinkedPayment) {
              await window.electronAPI.dbQuery(
                `UPDATE payments SET amount = amount - ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
                [excess, timestamp, orderPayment.id]
              );
              await window.electronAPI.dbQuery(
                `UPDATE payments SET amount = amount + ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
                [excess, timestamp, unlinkedPayment.id]
              );
            } else {
              const newPayId = `RV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
              const newPayRef = `ADV-${Date.now().toString().slice(-6)}`;
              await window.electronAPI.dbQuery(
                `UPDATE payments SET amount = amount - ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
                [excess, timestamp, orderPayment.id]
              );
              await window.electronAPI.dbQuery(
                `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference)
                 VALUES (?, ?, NULL, ?, ?, ?, 'SUCCESS', ?, 0, ?, ?)`,
                [newPayId, targetCustId, DEFAULT_SHOP_ID, excess, orderPayment.method, orderPayment.createdAt, timestamp, newPayRef]
              );
            }
          } else {
            const shortage = Math.abs(diff);
            if (unlinkedPayment) {
              const transferAmount = Math.min(shortage, unlinkedPayment.amount);
              if (transferAmount > 0.005) {
                await window.electronAPI.dbQuery(
                  `UPDATE payments SET amount = amount + ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
                  [transferAmount, timestamp, orderPayment.id]
                );
                await window.electronAPI.dbQuery(
                  `UPDATE payments SET amount = amount - ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
                  [transferAmount, timestamp, unlinkedPayment.id]
                );
                if (unlinkedPayment.amount - transferAmount <= 0.005) {
                  await window.electronAPI.dbQuery(
                    `DELETE FROM payments WHERE id = ?`,
                    [unlinkedPayment.id]
                  );
                }
              }
            }
          }
        }
      }

      await window.electronAPI.dbQuery("COMMIT");

      if (window.electronAPI?.runDataHealer) {
        await window.electronAPI.runDataHealer(targetCustId);
      }

      setShowDiscountEditModal(false);
      setSelectedBillForDiscount(null);

      const freshCustRes = await window.electronAPI.dbQuery(
        "SELECT c.*, (SELECT IFNULL(SUM(totalAmount), 0) FROM orders WHERE customerId = c.id AND status NOT IN ('Cancelled', 'Deleted')) as totalSales FROM customers c WHERE c.id = ?",
        [targetCustId]
      );
      if (freshCustRes.success && freshCustRes.data.length > 0) {
        await handleViewCustomerInsight(freshCustRes.data[0]);
      }
      fetchCustomers();
      window.dispatchEvent(new CustomEvent('database-updated', { detail: { customerId: targetCustId } }));
      alert("Discount updated successfully!");
    } catch (err) {
      console.error("Save discount edit error:", err);
      alert("Failed to update discount.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrderDiscount = async (billItem) => {
    if (!billItem || !window.electronAPI?.dbQuery) return;
    if (!window.confirm("Are you sure you want to delete this discount? The order's due amount will increase.")) return;

    try {
      setLoading(true);
      const timestamp = getLocalISOString();
      const bill = billItem.bill || billItem;
      const targetCustId = bill.customerId || selectedCustomer?.id;

      let oldDisc = 0;
      let breakdownObj = {};
      try {
        if (bill.paymentBreakdown) {
          breakdownObj = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
          oldDisc = parseFloat(breakdownObj.discount || breakdownObj.discountAmount || breakdownObj.orderDiscount || breakdownObj.settlementDiscount || 0) || 0;
        }
      } catch (e) { }
      if (oldDisc <= 0) {
        oldDisc = parseFloat(bill.discount || bill.discountAmount || 0) || 0;
      }

      const grossTotal = (bill.totalAmount || 0) + oldDisc;
      const newNetTotal = grossTotal;
      const newDue = Math.max(0, (bill.dueAmount || 0) + oldDisc);
      const newPayStatus = newDue <= 0 ? 'Paid' : ((bill.paidAmount || 0) > 0 ? 'Partial' : 'Credit');

      breakdownObj.discount = 0;
      if (breakdownObj.orderDiscount) breakdownObj.orderDiscount = 0;
      if (breakdownObj.settlementDiscount) breakdownObj.settlementDiscount = 0;
      if (breakdownObj.discountAmount) breakdownObj.discountAmount = 0;
      const newBreakdownStr = JSON.stringify(breakdownObj);

      await window.electronAPI.dbQuery("BEGIN TRANSACTION");

      await window.electronAPI.dbQuery(
        `UPDATE orders SET totalAmount = ?, dueAmount = ?, paymentStatus = ?, paymentBreakdown = ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
        [newNetTotal, newDue, newPayStatus, newBreakdownStr, timestamp, bill.id]
      );

      // Delete associated discount transactions from account_transactions
      const payDate = new Date(bill.createdAt);
      const datePrefix = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}-${String(payDate.getDate()).padStart(2, '0')}`;
      const txnRes = await window.electronAPI.dbQuery(
        "SELECT id FROM account_transactions WHERE category = 'Discount Given' AND amount = ? AND (description LIKE ? OR date LIKE ?) LIMIT 1",
        [oldDisc, `%${selectedCustomer?.name || ''}%`, `${datePrefix}%`]
      );
      if (txnRes.success && txnRes.data.length > 0) {
        await window.electronAPI.dbQuery("DELETE FROM account_transactions WHERE id = ?", [txnRes.data[0].id]);
      }

      if (oldDisc > 0.005) {
        const revId = `DISC-REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await window.electronAPI.dbQuery(
          `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference, discountScope)
           VALUES (?, ?, ?, ?, ?, 'Discount', 'SUCCESS', ?, 0, ?, ?, 'order')`,
          [
            revId,
            targetCustId,
            bill.id,
            DEFAULT_SHOP_ID,
            -Math.abs(oldDisc),
            timestamp,
            timestamp,
            `DEL-ORD-${bill.id}`,
            'order'
          ]
        );
        await window.electronAPI.dbQuery(
          `INSERT INTO customer_ledger (id, shopId, customerId, orderId, transactionType, debit, credit, balance, description, createdAt) VALUES (?, ?, ?, ?, 'DISCOUNT_EDIT', ?, 0, 0, ?, ?)`,
          [`CUST-DISC-EDIT-${Date.now()}-${Math.floor(Math.random() * 100000)}`, DEFAULT_SHOP_ID, targetCustId, bill.id, oldDisc, `Order #${bill.id} discount deleted (Reversed ${oldDisc.toFixed(2)})`, timestamp]
        );

        // REDISTRIBUTE PAYMENTS
        const orderPayRes = await window.electronAPI.dbQuery(
          `SELECT * FROM payments WHERE orderId = ? AND method != 'Discount' LIMIT 1`,
          [bill.id]
        );
        const orderPayment = orderPayRes.success && orderPayRes.data[0] ? orderPayRes.data[0] : null;

        if (orderPayment) {
          const unlinkPayRes = await window.electronAPI.dbQuery(
            `SELECT * FROM payments WHERE customerId = ? AND orderId IS NULL AND createdAt = ? AND method != 'Discount' LIMIT 1`,
            [targetCustId, orderPayment.createdAt]
          );
          const unlinkedPayment = unlinkPayRes.success && unlinkPayRes.data[0] ? unlinkPayRes.data[0] : null;

          const shortage = oldDisc;
          if (unlinkedPayment) {
            const transferAmount = Math.min(shortage, unlinkedPayment.amount);
            if (transferAmount > 0.005) {
              await window.electronAPI.dbQuery(
                `UPDATE payments SET amount = amount + ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
                [transferAmount, timestamp, orderPayment.id]
              );
              await window.electronAPI.dbQuery(
                `UPDATE payments SET amount = amount - ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
                [transferAmount, timestamp, unlinkedPayment.id]
              );
              if (unlinkedPayment.amount - transferAmount <= 0.005) {
                await window.electronAPI.dbQuery(
                  `DELETE FROM payments WHERE id = ?`,
                  [unlinkedPayment.id]
                );
              }
            }
          }
        }
      }

      await window.electronAPI.dbQuery("COMMIT");

      if (window.electronAPI?.runDataHealer) {
        await window.electronAPI.runDataHealer(targetCustId);
      }

      const freshCustRes = await window.electronAPI.dbQuery(
        "SELECT c.*, (SELECT IFNULL(SUM(totalAmount), 0) FROM orders WHERE customerId = c.id AND status NOT IN ('Cancelled', 'Deleted')) as totalSales FROM customers c WHERE c.id = ?",
        [targetCustId]
      );
      if (freshCustRes.success && freshCustRes.data.length > 0) {
        await handleViewCustomerInsight(freshCustRes.data[0]);
      }
      fetchCustomers();
      window.dispatchEvent(new CustomEvent('database-updated', { detail: { customerId: targetCustId } }));
      alert("Discount deleted successfully!");
    } catch (err) {
      await window.electronAPI.dbQuery("ROLLBACK");
      console.error("Delete discount error:", err);
      alert("Failed to delete discount.");
    } finally {
      setLoading(false);
    }
  };


  const handleViewCustomerInsight = async (customer, targetViewMode = 'insight') => {
    setLoading(true);
    if (window.electronAPI?.dbQuery) {
      try {
        const financialStateRes = window.electronAPI?.getCustomerFinancialState
          ? await window.electronAPI.getCustomerFinancialState(customer.id)
          : null;
        const financialState = financialStateRes?.success ? financialStateRes.data : null;
        const freshCustRes = await window.electronAPI.dbQuery(
          "SELECT * FROM customers WHERE id = ?",
          [customer.id]
        );
        const savedCustomer = freshCustRes.success && freshCustRes.data.length > 0 ? freshCustRes.data[0] : customer;
        const activeCustomer = financialState
          ? {
              ...savedCustomer,
              balance: financialState.balance,
              advanceBalance: financialState.availableAdvance
            }
          : savedCustomer;
        setSelectedCustomer(activeCustomer);

        const result = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' ORDER BY createdAt DESC",
          [activeCustomer.id]
        );
        let bills = result.success ? result.data : [];
        setCustomerBills(bills.filter(b => b.status !== 'Cancelled' && b.status !== 'Deleted'));

        const deletedBillsRes = await window.electronAPI.dbQuery(
          "SELECT * FROM deleted_orders WHERE customerId = ?",
          [activeCustomer.id]
        );
        const deletedBills = deletedBillsRes.success ? deletedBillsRes.data : [];

        const combinedReturns = [
          ...bills.filter(b => b.status === 'Cancelled' || b.status === 'Deleted').map(b => {
            const dbRecord = deletedBills.find(db => db.id === b.id);
            return {
              ...b,
              isDeleted: true,
              paidAmount: dbRecord ? (dbRecord.paidAmount !== undefined ? dbRecord.paidAmount : b.paidAmount) : b.paidAmount,
              refundStatus: dbRecord 
                ? (dbRecord.refundStatus || dbRecord.returnStatus || 'Deleted')
                : (b.status === 'Deleted' ? (b.deletedAction || 'Deleted') : 'Cancelled'),
              refundMethod: dbRecord ? dbRecord.refundMethod : b.refundMethod,
              returnedAt: dbRecord ? dbRecord.returnedAt : b.returnedAt
            };
          }),
          ...deletedBills.filter(db => !bills.some(b => b.id === db.id)).map(db => ({
            ...db,
            isDeleted: true,
            refundStatus: db.refundStatus || db.returnStatus || 'Deleted'
          }))
        ];
        combinedReturns.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        setCustomerReturns(combinedReturns);

        const refundsRes = await window.electronAPI.dbQuery(
          "SELECT * FROM refunds WHERE customerId = ?",
          [activeCustomer.id]
        );
        const refundsList = refundsRes.success ? refundsRes.data : [];

        const paymentsRes = await window.electronAPI.dbQuery(
          "SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt DESC",
          [activeCustomer.id]
        );
        let payments = paymentsRes.success ? paymentsRes.data : [];
        setRawPayments(payments);
        const discountPayments = payments.filter(p => p.method === 'Discount');
        setCustomerDiscounts(discountPayments);
        // Find all references that have been deleted/reversed
        const deletedRefs = new Set(
          payments
            .filter(p => String(p.paymentReference || '').startsWith('DEL-'))
            .map(p => String(p.paymentReference || '').substring(4))
        );

        // Payments tab shows only amounts actually received from the customer.
        // An Advance row linked to an order is merely the later application of
        // an existing advance credit, so showing it here would make a single
        // payment appear twice. We also exclude deleted/reversed payments.
        payments = payments.filter(p => (
          p.method !== 'System Auto'
          && p.method !== 'Discount'
          && !isAdvanceAllocation(p)
          && !String(p.paymentReference || '').startsWith('DEL-')
          && !deletedRefs.has(p.paymentReference || p.id)
        ));

        // A customer makes one Quick Settle payment, even when the accounting
        // engine applies it to several places (orders, opening due or advance).
        // Those rows share the exact settlement timestamp, so show their total
        // as one customer-facing receipt. Other payment types remain separate.
        const groupedMap = {};
        payments.forEach(p => {
          const timestampKey = p.createdAt || p.id;
          const referencePrefix = String(p.paymentReference || p.id || '').split('-')[0] || 'PAY';
          const isSettlementReceipt = ['SET', 'ACC', 'ADV'].includes(referencePrefix);
          const purposeKey = isSettlementReceipt
            ? `settlement:${timestampKey}`
            : (p.orderId
              ? `order:${p.orderId}`
              : `account:${referencePrefix}:${p.paymentReference || p.id}`);
          const key = `${timestampKey}:${purposeKey}`;

          if (!groupedMap[key]) {
            groupedMap[key] = {
              ...p,
              methodsList: [p.method],
              totalAmount: p.amount || 0,
              paymentIds: [p.id],
              isSettlementGroup: isSettlementReceipt
            };
          } else {
            groupedMap[key].totalAmount += p.amount || 0;
            if (!groupedMap[key].methodsList.includes(p.method)) {
              groupedMap[key].methodsList.push(p.method);
            }
            groupedMap[key].paymentIds.push(p.id);
          }
        });

        // Convert back to array and format the method name and amount
        const processedPayments = Object.values(groupedMap).map(p => {
          let finalMethod = p.method;
          if (p.methodsList.length > 1) {
            finalMethod = 'Multipayment';
          }
          return {
            ...p,
            method: finalMethod,
            amount: p.totalAmount,
            // A grouped settlement is safe to view or delete as one event.
            // Editing only one of its underlying allocation rows would make
            // its shown total disagree with the accounting records.
            isSettlementGroup: Boolean(p.isSettlementGroup && p.paymentIds.length > 1)
          };
        });

        // Sort by createdAt DESC to keep order correct
        processedPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Enrich payments with their bank name
        const enrichedProcessedPayments = [];
        for (const p of processedPayments) {
          let bankName = '';
          if (['Card', 'UPI', 'Bank', 'Bank Transfer'].includes(p.method)) {
            const datePrefix = p.createdAt ? p.createdAt.substring(0, 10) : '';
            const txnRes = await window.electronAPI.dbQuery(
              "SELECT bankAccountId FROM account_transactions WHERE amount = ? AND (description LIKE ? OR date LIKE ?) LIMIT 1",
              [p.amount, `%${activeCustomer.name}%`, `${datePrefix}%`]
            );
            if (txnRes.success && txnRes.data.length > 0) {
              const bankId = txnRes.data[0].bankAccountId;
              const bankAcc = settings.bankAccounts?.find(acc => acc.id === bankId || acc.bankName === bankId);
              if (bankAcc) {
                bankName = bankAcc.bankName;
              }
            }
          }
          enrichedProcessedPayments.push({ ...p, bankName });
        }
        setCustomerPayments(enrichedProcessedPayments);

        const totalSales = bills.filter(b => b.status !== 'Cancelled' && b.status !== 'Deleted').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const salesReturn = bills.filter(b => b.status === 'Cancelled' || b.status === 'Deleted').reduce((sum, b) => sum + (b.totalAmount || 0), 0) +
          deletedBills.filter(db => !bills.some(b => b.id === db.id)).reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        const getDiscountVal = (bill) => {
          if (!bill) return 0;
          if (bill.paymentBreakdown) {
            try {
              const bd = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
              if (bd) {
                const val = parseFloat(bd.orderDiscount || bd.discount || bd.discountAmount || bd.discount_amount || bd.discountValue || bd.settlementDiscount || 0);
                if (!isNaN(val) && val > 0) return val;
              }
            } catch (e) { }
          }
          if (typeof bill.discount === 'number' && bill.discount > 0) return bill.discount;
          if (typeof bill.discountAmount === 'number' && bill.discountAmount > 0) return bill.discountAmount;

          if (bill.items) {
            try {
              const itemsArr = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
              if (Array.isArray(itemsArr) && itemsArr.length > 0) {
                const itemsTotal = itemsArr.reduce((s, i) => s + ((parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0)), 0);
                const taxRate = settings.isTaxEnabled ? ((settings.taxRate || 0) / 100) : 0;
                const grossWithTax = settings.taxMethod === 'exclusive' ? (itemsTotal * (1 + taxRate)) : itemsTotal;
                const diff = grossWithTax - (bill.totalAmount || 0);
                if (diff > 0.05) return parseFloat(diff.toFixed(2));
              }
            } catch (e) { }
          }
          return 0;
        };

        // Dedicated DISC receipts are the source of truth. Old order
        // paymentBreakdown values are a legacy fallback only when an order
        // has no corresponding discount receipt, avoiding double counting.
        let totalDiscount = discountPayments
          .filter(p => (p.amount || 0) > 0)
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        bills.forEach(bill => {
          if (bill.status === 'Deleted' || bill.status === 'Cancelled') return;
          const hasDiscountReceipt = discountPayments.some(
            p => p.orderId === bill.id && (p.amount || 0) > 0
          );
          if (!hasDiscountReceipt) totalDiscount += getDiscountVal(bill);
        });

        // ─── Derive pendingDue & availableAdvance using the SAME running-balance
        // algorithm as CustomerStatement, so both pages always agree.
        //
        // Formula (mirrors CustomerStatement ledgerRows memo):
        //   runningBalance += debit (order charge / opening)
        //   runningBalance -= credit (payment / discount / deleted-order reversal / refund)
        //   pendingDue    = max(0,  runningBalance)
        //   availableAdv  = max(0, -runningBalance)   [negative balance = advance on account]

        // All payments for this customer (from payments table)
        const allPaymentsRaw = paymentsRes.success ? paymentsRes.data : [];

        // Opening balance (debit)
        const systemAutoOffset = allPaymentsRaw
          .filter(p => p.method === 'System Auto' && !p.orderId)
          .reduce((s, p) => s + (p.amount || 0), 0);
        const openingBal = Math.max(0, activeCustomer.openingBalance || 0) + Math.abs(systemAutoOffset);
        let runningBalance = openingBal;

        // Active orders charges (debit)
        const orderCharges = bills
          .filter(b => b.status !== 'Cancelled' && b.status !== 'Deleted')
          .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        runningBalance += orderCharges;

        // Refunds paid out (debit)
        const refundDebits = refundsList.reduce((sum, r) => sum + (r.amount || 0), 0);
        runningBalance += refundDebits;

        // Payments received (credit)
        const paymentCredits = allPaymentsRaw
          .filter(p => p.method !== 'System Auto' && p.method !== 'Advance')
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        runningBalance -= paymentCredits;

        // Final values — mirror CustomerStatement KPIs exactly
        const canonicalBalance = Number(financialState?.balance ?? runningBalance) || 0;
        const pendingDue = Math.max(0, canonicalBalance);
        const availableAdvance = Math.max(0, -canonicalBalance);

        // totalAdvanceReceived: unlinked payments minus their allocations (for display in Advance Details section)
        const rawAdvanceReceived = allPaymentsRaw
          .filter(p => {
            const reference = String(p.paymentReference || '');
            return (!p.orderId || p.orderId === '')
              && !reference.startsWith('ACC-')
              && p.method !== 'System Auto'
              && p.method !== 'Discount'
              && (Number(p.amount) || 0) > 0;
          })
          .reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const totalAdvanceReceived = Math.max(0, rawAdvanceReceived);
        const advanceUsed = Math.max(0, totalAdvanceReceived - availableAdvance);

        setSelectedCustomerStats({
          totalSales,
          pendingDue,
          salesReturn,
          totalDiscount,
          totalAdvanceReceived,
          advanceUsed,
          availableAdvance
        });
        setViewMode(targetViewMode);
        setInsightTab('sales');
      } catch (err) {
        console.error("Failed to fetch customer insight data:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancelOrder = async (bill) => {
    if (bill.paymentStatus === 'Paid') {
      alert('Restricted: Paid orders cannot be cancelled/deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to cancel order ${settings.invoicePrefix || ''}${bill.id}?`)) return;

    const timestamp = getLocalISOString();
    try {
      await window.electronAPI.dbQuery(
        "UPDATE orders SET status = 'Cancelled', dueAmount = 0, paymentStatus = 'Cancelled', isSynced = 0, updatedAt = ? WHERE id = ?",
        [timestamp, bill.id]
      );
      await window.electronAPI.dbQuery(
        "UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?",
        [bill.dueAmount, timestamp, selectedCustomer.id]
      );

      // Update local state customer balance
      setSelectedCustomer(prev => ({
        ...prev,
        balance: prev.balance - bill.dueAmount
      }));

      alert('Order cancelled successfully!');

      // Reload details
      const freshCust = { ...selectedCustomer, balance: selectedCustomer.balance - bill.dueAmount };
      handleViewCustomerInsight(freshCust);
      fetchCustomers();
    } catch (err) {
      console.error('Cancel order error:', err);
      alert('Failed to cancel order.');
    }
  };

  /* Legacy client-side refund workflow. Refunds now run through the single
     audited desktop transaction below. */
  /*
  const confirmRefundLegacy = async () => {
    if (!orderToRefund) return;
    try {
      const nowIso = getLocalISOString();
      if (window.electronAPI?.dbQuery) {
        // 1. Process refund if paid amount exists: Create a single Return expense transaction
        const paidAmt = orderToRefund.paidAmount || 0;
        if (paidAmt > 0) {
          const refundTxnId = `TXN-RETURN-${Date.now()}`;
          const _nowD = new Date();
          const txnTimestamp = `${_nowD.getFullYear()}-${String(_nowD.getMonth() + 1).padStart(2, '0')}-${String(_nowD.getDate()).padStart(2, '0')} ${String(_nowD.getHours()).padStart(2, '0')}:${String(_nowD.getMinutes()).padStart(2, '0')}`;

          const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
          const creatorName = userSession.name || userSession.username || 'System';
          const creatorId = userSession.id || 'SYSTEM';
          const creatorRole = userSession.role || 'system';

          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
              (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              refundTxnId,
              orderToRefund.shopId || 'SHOP_01',
              selectedRefundMethod === 'Bank' ? 'BANK' : 'CASH',
              'EXPENSE',
              'Return',
              paidAmt,
              `Return - Order ${orderToRefund.id.startsWith('#') ? '' : '#'}${orderToRefund.id}`,
              txnTimestamp,
              0,
              getLocalISOString(),
              'Zap',
              selectedRefundMethod === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null,
              creatorName,
              creatorId,
              creatorRole
            ]
          );
        }

        // 2. Update return status and refund details in SQLite database
        await window.electronAPI.dbQuery(
          "UPDATE deleted_orders SET returnStatus = 'Returned', refundStatus = 'Returned', refundMethod = ?, returnedAt = ? WHERE id = ?",
          [selectedRefundMethod, nowIso, orderToRefund.id]
        );

        // 3. Adjust customer balance (since refund is no longer pending, add it back to customer balance)
        if (paidAmt > 0 && orderToRefund.customerId && orderToRefund.customerId !== 'Walk-in') {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance + ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [paidAmt, getLocalISOString(), orderToRefund.customerId]
          );
        }

        // 4. Run data healer to make sure sync and state are correct
        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer(orderToRefund.customerId);
        }
      }

      setCustomerReturns(prev =>
        prev.map((o) =>
          o.id === orderToRefund.id
            ? {
              ...o,
              returnStatus: 'Returned',
              refundStatus: 'Returned',
              refundMethod: selectedRefundMethod,
              returnedAt: nowIso,
            }
            : o
        )
      );

      // Attempt backend sync
      try {
        await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/orders/deleted/${encodeURIComponent(orderToRefund.id)}/refund`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              returnStatus: 'Returned',
              refundStatus: 'Returned',
              refundMethod: selectedRefundMethod,
            }),
          }
        ).catch(() => { });
      } catch (e) { }

      // Reload/update the current customer's data so the balance updates in the UI
      const updatedCustomerRes = await window.electronAPI.dbQuery("SELECT * FROM customers WHERE id = ?", [selectedCustomer.id]);
      if (updatedCustomerRes.success && updatedCustomerRes.data.length > 0) {
        setSelectedCustomer(updatedCustomerRes.data[0]);
      }
      fetchCustomers();

      alert("Refund processed successfully!");
      setShowRefundModal(false);
      setOrderToRefund(null);
    } catch (err) {
      console.error("Refund error:", err);
      alert("Failed to process refund: " + err.message);
    }
  };

  */
  const confirmRefund = async () => {
    if (!orderToRefund) return;
    try {
      const nowIso = getLocalISOString();
      const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
      const refundedBy = userSession.name || userSession.username || 'System';

      if (window.electronAPI?.refundDeletedOrder) {
        const result = await window.electronAPI.refundDeletedOrder({
          orderId: orderToRefund.id,
          refundMethod: selectedRefundMethod,
          refundedBy
        });
        if (!result?.success) throw new Error(result?.error || 'Failed to process refund');
      } else {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/orders/deleted/${encodeURIComponent(orderToRefund.id)}/refund`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ returnStatus: 'Returned', refundStatus: 'Returned', refundMethod: selectedRefundMethod })
          }
        );
        if (!response.ok) throw new Error('Failed to process refund');
      }

      setCustomerReturns(prev => prev.map(order => order.id === orderToRefund.id
        ? { ...order, returnStatus: 'Returned', refundStatus: 'Returned', refundMethod: selectedRefundMethod, returnedAt: nowIso }
        : order));

      // Keep the server audit in sync when the desktop app is online. The
      // local transaction above remains authoritative when the app is offline.
      if (window.electronAPI?.refundDeletedOrder) {
        fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/orders/deleted/${encodeURIComponent(orderToRefund.id)}/refund`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ returnStatus: 'Returned', refundStatus: 'Returned', refundMethod: selectedRefundMethod })
          }
        ).catch(() => { });
      }

      const customerId = orderToRefund.customerId || selectedCustomer?.id;
      if (customerId && window.electronAPI?.dbQuery) {
        const updatedCustomerRes = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (updatedCustomerRes.success && updatedCustomerRes.data.length > 0) {
          setSelectedCustomer(updatedCustomerRes.data[0]);
          await handleViewCustomerInsight(updatedCustomerRes.data[0]);
        }
      }
      fetchCustomers();
      alert('Refund processed successfully!');
      setShowRefundModal(false);
      setOrderToRefund(null);
    } catch (err) {
      console.error('Refund error:', err);
      alert('Failed to process refund: ' + err.message);
    }
  };

  const fetchCustomerBills = async (customerId) => {
    if (window.electronAPI?.dbQuery) {
      try {
        const result = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND status NOT IN ('Deleted', 'Cancelled') ORDER BY createdAt DESC",
          [customerId]
        );
        if (result.success) setCustomerBills(result.data);
      } catch (err) {
        console.error("Failed to fetch customer bills:", err);
      }
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Paid': return styles.statusPaid;
      case 'Credit': return styles.statusCredit;
      case 'Partial': return styles.statusPartial;
      default: return '';
    }
  };

  const handleWhatsApp = (phone, balance) => {
    if (!phone) return;
    let cleanPhone = phone.toString().replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone && !phone.toString().trim().startsWith('+')) {
      const countryCode = settings.waCountryCode || '971';
      const cleanCountryCode = countryCode.replace(/\D/g, '');
      if (cleanCountryCode && !finalPhone.startsWith(cleanCountryCode)) {
        finalPhone = cleanCountryCode + finalPhone;
      }
    }

    let message = '';
    if (balance > 0) {
      if (settings.waCustomerBalanceTemplate) {
        const custMatch = customers.find(c => c.phone === phone);
        message = settings.waCustomerBalanceTemplate
          .replace(/{customerName}/g, custMatch ? custMatch.name : 'Customer')
          .replace(/{dueAmount}/g, `${settings.currencySymbol || 'AED'} ${balance.toFixed(2)}`)
          .replace(/{shopName}/g, settings.shopName || 'Laundry Box');
      } else {
        message = `Hello! This is from the ${settings.shopName || 'Laundry Box'}. We're reaching out regarding your account.\n\nFriendly reminder: Your outstanding balance is ${settings.currencySymbol || 'AED'} ${balance.toFixed(2)}. Please visit us to settle the payment. Thank you!`;
      }
    } else {
      if (settings.waGeneralTemplate) {
        message = settings.waGeneralTemplate.replace(/{shopName}/g, settings.shopName || 'Laundry Box');
      } else {
        message = `Hello! This is from the ${settings.shopName || 'Laundry Box'}. We're reaching out regarding your account.`;
      }
    }
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // customers is already the current page (server-side paginated)
  const paginatedCustomers = customers;


  if (viewMode === 'insight' && selectedCustomer) {
    return (
      <div className={styles.customersPage} style={{ padding: '1rem', background: '#F8FAFC', minHeight: '100vh' }}>
        {/* Insight Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#E2E8F0', padding: '0.25rem', borderRadius: '10px' }}>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  background: 'white',
                  color: 'var(--primary)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                📋 Customer Insight
              </button>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#475569'
                }}
                onClick={() => setViewMode('statement')}
              >
                📄 Customer Statement
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--secondary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              onClick={() => {
                const autoAmount = selectedCustomer.balance > 0 ? selectedCustomer.balance : '';
                setPaymentData({ amount: autoAmount.toString(), method: 'Cash' });
                setShowPaymentModal(true);
              }}
            >
              <DollarSign size={16} /> Settle Payment
            </button>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              onClick={() => {
                setEditCreditLimitValue((selectedCustomer.creditLimit || 0).toString());
                setShowEditCreditLimitModal(true);
              }}
            >
              <CreditCard size={16} /> Edit Credit Limit
            </button>
            <button
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #CBD5E1', background: 'white', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => {
                setViewMode('list');
                setSelectedCustomer(null);
              }}
            >
              <X size={20} color="#64748B" />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Panel: Customer details & Sales Stats */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Customer</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', wordBreak: 'break-all' }}>{selectedCustomer.name}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Phone</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{selectedCustomer.phone || '—'}</span>
                {selectedCustomer.phone && (
                  <button
                    style={{ background: 'none', border: 'none', color: '#25D366', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                    onClick={() => handleWhatsApp(selectedCustomer.phone, selectedCustomer.balance)}
                    title="Send via WhatsApp"
                  >
                    <WhatsAppIcon size={16} />
                  </button>
                )}
              </div>
            </div>



            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Address</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', lineHeight: '1.4' }}>{selectedCustomer.address || '—'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Credit Limit</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)' }}>
                <CurrencySymbol size={14} /> {(selectedCustomer.creditLimit || settings.defaultCreditLimit || 500).toFixed(2)}
                {(!selectedCustomer.creditLimit || selectedCustomer.creditLimit === 0) && <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginLeft: '0.25rem' }}>(Shop default)</span>}
              </div>
            </div>


            <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.25rem 0' }} />

            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: '1rem', letterSpacing: '0.05em' }}>Sale Details</h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Total Sales</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{(selectedCustomerStats.totalSales || 0).toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Pending Due</span>
                <span style={{
                  fontWeight: 800,
                  color: selectedCustomerStats.pendingDue > 0 ? 'var(--danger)' : '#64748B'
                }}>
                  {(selectedCustomerStats.pendingDue || 0).toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Sales Return</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{(selectedCustomerStats.salesReturn || 0).toFixed(2)}</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.25rem 0' }} />

            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: '1rem', letterSpacing: '0.05em' }}>Discount Details</h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Total Discount</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{(selectedCustomerStats.totalDiscount || 0).toFixed(2)}</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.25rem 0' }} />

            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: '1rem', letterSpacing: '0.05em' }}>Advance Details</h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Total Advance Credit</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{(selectedCustomerStats.totalAdvanceReceived || 0).toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Advance Used</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{(selectedCustomerStats.advanceUsed || 0).toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Available Advance</span>
                <span style={{ fontWeight: 800, color: 'var(--secondary)' }}>
                  {(selectedCustomerStats.availableAdvance || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Panel: Tabs & Tables */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <button
                style={{ border: 'none', background: insightTab === 'sales' ? 'var(--primary)' : 'transparent', color: insightTab === 'sales' ? 'white' : '#64748B', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setInsightTab('sales')}
              >
                Sales
              </button>
              <button
                style={{ border: 'none', background: insightTab === 'payments' ? 'var(--primary)' : 'transparent', color: insightTab === 'payments' ? 'white' : '#64748B', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setInsightTab('payments')}
              >
                Payments
              </button>
              <button
                style={{ border: 'none', background: insightTab === 'returns' ? 'var(--primary)' : 'transparent', color: insightTab === 'returns' ? 'white' : '#64748B', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setInsightTab('returns')}
              >
                Returns
              </button>
              <button
                style={{ border: 'none', background: insightTab === 'discounts' ? 'var(--primary)' : 'transparent', color: insightTab === 'discounts' ? 'white' : '#64748B', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setInsightTab('discounts')}
              >
                Discounts
              </button>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
              {insightTab === 'sales' && (
                <table className={styles.customersTable} style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#F8FAFC', textAlign: 'center' }}># Order</th>
                      <th style={{ background: '#F8FAFC', textAlign: 'center' }}>Date</th>
                      <th style={{ background: '#F8FAFC', textAlign: 'center' }}>Net Amount</th>
                      <th style={{ background: '#F8FAFC', textAlign: 'center' }}>Pay Mode</th>
                      <th style={{ background: '#F8FAFC', width: '150px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerBills.length > 0 ? customerBills.map((bill) => (
                      <tr key={bill.id}>
                        <td style={{ fontWeight: 700, textAlign: 'center' }}>{settings.invoicePrefix || ''}{bill.id}</td>
                        <td style={{ textAlign: 'center' }}>{formatDate(bill.createdAt)}</td>
                        <td style={{ textAlign: 'center' }}><CurrencySymbol size={13} /> {(bill.totalAmount || 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 700, textAlign: 'center', color: (bill.dueAmount || 0) <= 0 ? 'var(--secondary)' : ((bill.paidAmount || 0) > 0 ? 'var(--warning)' : 'var(--danger)') }}>
                          {(bill.dueAmount || 0) <= 0 ? 'PAID' : ((bill.paidAmount || 0) > 0 ? 'PARTIAL' : 'CREDIT')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
                            {/* Settle Order / Collect payment (placed first for alignment & priority) */}
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--warning)',
                                cursor: bill.dueAmount > 0 ? 'pointer' : 'default',
                                visibility: bill.dueAmount > 0 ? 'visible' : 'hidden'
                              }}
                              onClick={() => {
                                if (bill.dueAmount > 0) {
                                  setSelectedBillForPayment(bill);
                                  setPaymentData({ amount: bill.dueAmount.toString(), method: 'Cash' });
                                  setShowPaymentModal(true);
                                }
                              }}
                              title="Collect payment"
                            >
                              <DollarSign size={16} />
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                              onClick={() => {
                                let parsedItems = [];
                                try {
                                  if (bill.items && bill.items !== 'null') {
                                    parsedItems = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
                                  }
                                } catch (e) {
                                  console.error('Failed to parse items for invoice view:', e);
                                }

                                let parsedBreakdown = null;
                                try {
                                  if (bill.paymentBreakdown && bill.paymentBreakdown !== 'null') {
                                    parsedBreakdown = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
                                  }
                                } catch (e) {
                                  console.error('Failed to parse paymentBreakdown for invoice view:', e);
                                }

                                const formatDateTime = (dateVal) => {
                                  if (!dateVal) return 'N/A';
                                  const formattedDate = formatDate(dateVal);
                                  if (formattedDate === 'N/A' || formattedDate === 'Invalid Date') return formattedDate;
                                  let d;
                                  try {
                                    d = new Date(dateVal);
                                  } catch (e) {
                                    return formattedDate;
                                  }
                                  if (isNaN(d.getTime())) return formattedDate;
                                  let hours = d.getHours();
                                  const minutes = String(d.getMinutes()).padStart(2, '0');
                                  let ampm = '';
                                  if (settings.timeFormat === '12h') {
                                    ampm = hours >= 12 ? ' PM' : ' AM';
                                    hours = hours % 12;
                                    hours = hours ? hours : 12;
                                  }
                                  const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
                                  return `${formattedDate} ${formattedTime}`;
                                };

                                setSelectedInvoiceForView({
                                  ...bill,
                                  id: bill.id,
                                  billNumber: bill.billNumber || '',
                                  date: formatDateTime(bill.createdAt),
                                  customer: selectedCustomer?.name || bill.customerId,
                                  customerId: bill.customerId,
                                  customerPhone: selectedCustomer?.phone || '',
                                  residency: 'Customer Residency',
                                  status: bill.status,
                                  paymentStatus: bill.paymentStatus,
                                  paymentMethod: bill.paymentMethod || 'Not Paid',
                                  total: bill.totalAmount,
                                  paidAmount: bill.paidAmount || 0,
                                  dueAmount: bill.dueAmount ?? (bill.totalAmount - (bill.paidAmount || 0)),
                                  items: parsedItems,
                                  paymentBreakdown: parsedBreakdown,
                                  totalBalance: selectedCustomer?.balance || 0,
                                  previousBalance: (selectedCustomer?.balance || 0) - (bill.totalAmount - (bill.paidAmount || 0))
                                });
                              }}
                              title="View details"
                            >
                              <Eye size={16} />
                            </button>
                            {/* Edit Order */}
                            <button
                              style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer' }}
                              onClick={() => navigate(`/pos?editOrderId=${bill.id}`)}
                              title="Edit Order"
                            >
                              <Edit2 size={16} />
                            </button>
                            {/* Delete Order with Manager PIN */}
                            <button
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                              onClick={() => {
                                setOrderToDelete(bill);
                                setOrderDeletePinValue('');
                                setOrderDeletePinError('');
                                setDeleteReason('');
                                setShowOrderDeletePinModal(true);
                              }}
                              title="Delete Order (Manager PIN Required)"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>No sale records found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {insightTab === 'payments' && (
                <table className={styles.customersTable} style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#F8FAFC' }}>Payment ID</th>
                      <th style={{ background: '#F8FAFC' }}>Date</th>
                      <th style={{ background: '#F8FAFC' }}>Amount</th>
                      <th style={{ background: '#F8FAFC' }}>Method</th>
                      <th style={{ background: '#F8FAFC' }}>Status</th>
                      <th style={{ background: '#F8FAFC', width: '120px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPayments.length > 0 ? customerPayments.map((pay) => (
                      <tr key={pay.id}>
                        <td style={{ fontWeight: 700 }} title={formatPaymentId(pay)}>{formatPaymentId(pay)}</td>
                        <td>{formatDate(pay.createdAt)}</td>
                        <td><CurrencySymbol size={13} /> {(pay.amount || 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 600 }}>
                          {getPaymentMethodLabel(pay)}
                          {pay.bankName && (
                            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500, display: 'block', marginTop: '2px' }}>
                              ({pay.bankName})
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={styles.statusPaid} style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#DCFCE7', color: '#15803D', fontSize: '0.75rem', fontWeight: 700 }}>SUCCESS</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                              onClick={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                handleViewPaymentDetails(pay);
                              }}
                              title="View Payment"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer' }}
                              onClick={(e) => handleEditPaymentClick(e, pay)}
                              title="Edit Payment"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              onClick={(e) => handleDeletePaymentClick(e, pay)}
                              title="Delete Payment"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>No payment records found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {insightTab === 'returns' && (
                <table className={styles.customersTable} style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#F8FAFC' }}># Order</th>
                      <th style={{ background: '#F8FAFC' }}>Date</th>
                      <th style={{ background: '#F8FAFC' }}>Net Amount</th>
                      <th style={{ background: '#F8FAFC' }}>Paid Amount</th>
                      <th style={{ background: '#F8FAFC' }}>Refund/Return Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerReturns.length > 0 ? customerReturns.map((ret) => (
                      <tr key={ret.id}>
                        <td style={{ fontWeight: 700 }}>{settings.invoicePrefix || ''}{ret.id}</td>
                        <td>{formatDate(ret.createdAt)}</td>
                        <td><CurrencySymbol size={13} /> {(ret.totalAmount || 0).toFixed(2)}</td>
                        <td><CurrencySymbol size={13} /> {(ret.paidAmount || 0).toFixed(2)}</td>
                        <td>
                          {!ret.isDeleted ? (
                            <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.8rem' }}>CANCELLED</span>
                          ) : ret.refundStatus === 'Refund Pending' ? (
                            <button
                              className={styles.refundBtn}
                              onClick={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                setOrderToRefund(ret);
                                setSelectedRefundMethod('Cash');
                                setShowRefundModal(true);
                              }}
                            >
                              Refund Pending
                            </button>
                          ) : ret.refundStatus === 'Returned' ? (
                            <span style={{ color: '#16A34A', fontWeight: 700, fontSize: '0.8rem' }}>REFUNDED ({ret.refundMethod || 'Cash'})</span>
                          ) : ret.refundStatus === 'Converted to Advance' ? (
                            <span style={{ color: '#2563EB', fontWeight: 700, fontSize: '0.8rem' }}>CREDITED TO ADVANCE</span>
                          ) : (ret.paidAmount || 0) <= 0 ? (
                            <span style={{ color: '#64748B', fontWeight: 700, fontSize: '0.8rem' }}>NOT PAID</span>
                          ) : (
                            <span style={{ color: '#64748B', fontWeight: 700, fontSize: '0.8rem' }}>RETURNED / DELETED</span>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>No returned/cancelled orders found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {insightTab === 'discounts' && (
                <table className={styles.customersTable} style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#F8FAFC' }}># Order / Ref</th>
                      <th style={{ background: '#F8FAFC' }}>Date</th>
                      <th style={{ background: '#F8FAFC' }}>Order Total</th>
                      <th style={{ background: '#F8FAFC' }}>Discount Given</th>
                      <th style={{ background: '#F8FAFC' }}>Net Payable</th>
                      <th style={{ background: '#F8FAFC', width: '100px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const getDiscountVal = (bill) => {
                        if (!bill) return 0;
                        if (bill.paymentBreakdown) {
                          try {
                            const bd = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
                            if (bd) {
                              if (bd.discount === 0 && bd.orderDiscount === undefined && bd.settlementDiscount === undefined) return 0;
                              const val = parseFloat(bd.orderDiscount || bd.discount || bd.discountAmount || bd.discount_amount || bd.discountValue || bd.settlementDiscount || 0);
                              if (!isNaN(val) && val > 0) return val;
                              if (bd.discount === 0 || bd.orderDiscount === 0) return 0;
                            }
                          } catch (e) { }
                        }
                        if (bill.items) {
                          try {
                            const itemsArr = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
                            if (Array.isArray(itemsArr) && itemsArr.length > 0) {
                              const itemsTotal = itemsArr.reduce((s, i) => s + ((parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0)), 0);
                              const taxRate = settings.isTaxEnabled ? ((settings.taxRate || 0) / 100) : 0;
                              const grossWithTax = settings.taxMethod === 'exclusive' ? (itemsTotal * (1 + taxRate)) : itemsTotal;
                              const diff = grossWithTax - (bill.totalAmount || 0);
                              if (diff > 0.05) return parseFloat(diff.toFixed(2));
                            }
                          } catch (e) { }
                        }
                        return 0;
                      };

                      const discountedBills = customerBills.filter(bill => getDiscountVal(bill) > 0).map(bill => {
                        const discVal = getDiscountVal(bill);
                        return {
                          id: bill.id,
                          date: bill.createdAt,
                          type: 'order',
                          orderTotal: (bill.totalAmount || 0) + discVal,
                          discount: discVal,
                          netPayable: bill.totalAmount || 0,
                          status: (bill.dueAmount || 0) <= 0 ? 'PAID' : ((bill.paidAmount || 0) > 0 ? 'PARTIAL' : 'CREDIT'),
                          bill: bill
                        };
                      });

                      // Settlement discounts have no invoice of their own and
                      // remain standalone. Order discounts are already shown
                      // in the linked order row above.
                      const groupedDiscountsMap = {};
                      customerDiscounts
                        .filter(p => !p.orderId && (p.amount || 0) > 0)
                        .forEach(p => {
                          const timestampKey = p.createdAt || p.id;
                          const key = `settlement_disc:${timestampKey}`;
                          if (!groupedDiscountsMap[key]) {
                            groupedDiscountsMap[key] = {
                              ...p,
                              totalAmount: p.amount || 0,
                              paymentIds: [p.id]
                            };
                          } else {
                            groupedDiscountsMap[key].totalAmount += p.amount || 0;
                            groupedDiscountsMap[key].paymentIds.push(p.id);
                          }
                        });

                      const receiptDiscounts = Object.values(groupedDiscountsMap).map(p => ({
                        id: p.id,
                        date: p.createdAt,
                        type: 'receipt',
                        orderTotal: null,
                        discount: p.totalAmount,
                        netPayable: null,
                        status: 'SUCCESS',
                        payment: {
                          ...p,
                          amount: p.totalAmount,
                          isSettlementGroup: p.paymentIds.length > 1
                        }
                      }));

                      // Deleted orders keep a snapshot of their original DISC
                      // receipts for audit history. These rows are deliberately
                      // excluded from totalDiscount and all financial balances.
                      const deletedDiscountRows = customerDeletedDiscounts
                        .filter(p => !customerDiscounts.some(activeP => activeP.id === p.originalPaymentId))
                        .map(p => ({
                        id: p.id,
                        date: p.deletedAt || p.createdAt,
                        type: 'deleted',
                        discount: p.amount || 0,
                        payment: p
                      }));

                      const allDiscounts = [...discountedBills, ...receiptDiscounts, ...deletedDiscountRows].sort((a, b) => new Date(b.date) - new Date(a.date));

                      if (allDiscounts.length === 0) {
                        return (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                              No discount records found for this customer.
                            </td>
                          </tr>
                        );
                      }

                      return allDiscounts.map((item) => {
                        if (item.type === 'order') {
                          const bill = item.bill;
                          const discVal = item.discount;
                          return (
                            <tr key={bill.id}>
                              <td style={{ fontWeight: 700 }}>{settings.invoicePrefix || ''}{bill.id}</td>
                              <td>{formatDate(bill.createdAt)}</td>
                              <td><CurrencySymbol size={13} /> {item.orderTotal.toFixed(2)}</td>
                              <td style={{ fontWeight: 800, color: 'var(--danger)' }}>
                                <CurrencySymbol size={13} /> {discVal.toFixed(2)}
                              </td>
                              <td style={{ fontWeight: 700 }}><CurrencySymbol size={13} /> {item.netPayable.toFixed(2)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                    onClick={() => {
                                      let parsedItems = [];
                                      let parsedBreakdown = null;
                                      try {
                                        if (bill.items && bill.items !== 'null') {
                                          parsedItems = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
                                        }
                                        if (bill.paymentBreakdown && bill.paymentBreakdown !== 'null') {
                                          parsedBreakdown = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
                                        }
                                      } catch (e) { }

                                      setSelectedInvoiceForView({
                                        ...bill,
                                        id: bill.id,
                                        billNumber: bill.billNumber || '',
                                        date: formatDate(bill.createdAt),
                                        customer: selectedCustomer?.name || bill.customerId,
                                        customerId: bill.customerId,
                                        customerPhone: selectedCustomer?.phone || '',
                                        total: bill.totalAmount,
                                        paidAmount: bill.paidAmount || 0,
                                        dueAmount: bill.dueAmount ?? (bill.totalAmount - (bill.paidAmount || 0)),
                                        items: parsedItems,
                                        paymentBreakdown: parsedBreakdown
                                      });
                                    }}
                                    title="View Order Details"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer' }}
                                    onClick={() => {
                                      setSelectedBillForDiscount(bill);
                                      setEditDiscountValue(discVal.toString());
                                      setPinActionTarget('edit_order_discount');
                                      setShowPinModal(true);
                                    }}
                                    title="Edit Discount"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                                    onClick={() => {
                                      setSelectedBillForDiscount(bill);
                                      setPinActionTarget('delete_order_discount');
                                      setShowPinModal(true);
                                    }}
                                    title="Delete Discount"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        } else if (item.type === 'deleted') {
                          const p = item.payment;
                          return (
                            <tr key={p.id} style={{ background: '#FFF7ED' }}>
                              <td style={{ color: '#9A3412', fontWeight: 700 }}>
                                Deleted Order #{settings.invoicePrefix || ''}{p.deletedOrderId}
                              </td>
                              <td>{formatDate(p.createdAt || p.deletedAt)}</td>
                              <td>N/A</td>
                              <td style={{ fontWeight: 800, color: '#9A3412' }}>
                                <CurrencySymbol size={13} /> {item.discount.toFixed(2)}
                              </td>
                              <td>N/A</td>
                              <td style={{ textAlign: 'center', color: '#94A3B8' }}>—</td>
                            </tr>
                          );
                        } else {
                          const p = item.payment;
                          const isSettlementDiscount = getDiscountScope(p) === 'settlement';
                          const isOrderDiscount = Boolean(p.orderId) && !isSettlementDiscount;
                          return (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 700 }}>
                                {isOrderDiscount
                                  ? `${settings.invoicePrefix || ''}${p.orderId}`
                                  : (isSettlementDiscount ? (p.paymentReference || p.id) : 'General Account')}
                              </td>
                              <td>{formatDate(p.createdAt)}</td>
                              <td>N/A</td>
                              <td style={{ fontWeight: 800, color: 'var(--danger)' }}>
                                <CurrencySymbol size={13} /> {item.discount.toFixed(2)}
                              </td>
                              <td>N/A</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                    onClick={() => {
                                      handleViewPaymentDetails(p);
                                    }}
                                    title="View Discount Details"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer' }}
                                    onClick={() => {
                                      setSelectedPaymentForAction(p);
                                      setEditPaymentAmount(String(p.amount || 0));
                                      setEditPaymentMethod('Discount');
                                      setPinActionTarget('edit_payment');
                                      setShowPinModal(true);
                                    }}
                                    title="Edit Discount"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                                    onClick={() => {
                                      setSelectedPaymentForAction(p);
                                      setPinActionTarget('delete_payment');
                                      setShowPinModal(true);
                                    }}
                                    title="Delete Discount"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      });
                    })()}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Re-render identical modal portals so that payment options work inside the detail page */}
        {showPaymentModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ color: '#0F172A' }}>{selectedBillForPayment ? 'Settle Customer Invoice' : 'Settle Customer Balance'}</h2>
                  <p>{selectedBillForPayment ? `Record payment for Invoice #${settings.invoicePrefix || ''}${selectedBillForPayment.id}` : 'Record payment and settle outstanding credit'}</p>
                </div>
                <X size={24} className={styles.closeBtn} onClick={() => { setShowPaymentModal(false); setSelectedBillForPayment(null); }} />
              </div>

              <form onSubmit={handlePayment}>
                <div className={styles.modalBody}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: '#F1F5F9', borderRadius: '12px', marginBottom: '0.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 800 }}>
                      {selectedCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#1E293B' }}>{selectedCustomer.name}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                        {selectedBillForPayment ? 'Due for this invoice: ' : 'Customer balance: '}
                        <strong><CurrencySymbol size={14} /> {selectedBillForPayment ? selectedBillForPayment.dueAmount.toFixed(2) : selectedCustomer.balance.toFixed(2)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Settlement Amount</label>
                    <div className={styles.inputWrapper}>
                      <CreditCard size={18} />
                      <input
                        type="number"
                        step="0.01"
                        required
                        autoFocus
                        placeholder="0.00"
                        disabled={paymentData.method === 'Multipayment'}
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Discount Amount (Optional)</label>
                    <div className={styles.inputWrapper}>
                      <Percent size={18} />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={paymentData.discount || ''}
                        onChange={(e) => setPaymentData(prev => ({ ...prev, discount: e.target.value }))}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem' }}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem', display: 'block' }}>Payment Method</label>
                    <PaymentMethodSelect
                      value={paymentData.method}
                      onChange={(method) => setPaymentData(prev => ({ ...prev, method }))}
                      settings={settings}
                    />
                  </div>

                  {paymentData.method === 'Multipayment' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Cash</label>
                        <input type="number" placeholder="0.00" value={splitCash} onChange={(e) => setSplitCash(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', marginTop: '0.25rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Card</label>
                        <input type="number" placeholder="0.00" value={splitCard} onChange={(e) => setSplitCard(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', marginTop: '0.25rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Bank</label>
                        <input type="number" placeholder="0.00" value={splitBank} onChange={(e) => setSplitBank(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', marginTop: '0.25rem' }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => { setShowPaymentModal(false); setSelectedBillForPayment(null); }}>Cancel</button>
                  <button type="submit" className={styles.primaryBtn} style={{ background: 'var(--secondary)' }}>Complete Settlement</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* INVOICE VIEW MODAL */}
        {selectedInvoiceForView && (
          <div className={styles.modalOverlay} style={{ zIndex: 10000 }}>
            <div className={styles.modal} style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B' }}>Invoice #{settings.invoicePrefix || ''}{selectedInvoiceForView.id}</h2>
                </div>
                <X size={24} className={styles.closeBtn} onClick={() => setSelectedInvoiceForView(null)} />
              </div>
              <div className={styles.modalBody} style={{ padding: '1.5rem', background: '#F8FAFC' }}>
                <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                  <InvoiceTemplate
                    order={selectedInvoiceForView}
                    settings={settings}
                    editable={false}
                    onOrderUpdate={(updated) => {
                      fetchCustomerBills(selectedCustomer?.id);
                      setSelectedInvoiceForView(prev => ({ ...prev, ...updated }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Payment Details Modal */}
        {showPaymentViewModal && selectedPaymentForAction && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ color: '#0F172A' }}>Payment Details</h2>
                  <p>Receipt ID: {getReceiptNumber(selectedPaymentForAction)}</p>
                </div>
                <X size={24} className={styles.closeBtn} onClick={() => setShowPaymentViewModal(false)} />
              </div>
              <div className={styles.modalContent} style={{ padding: '1.25rem 1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#64748B', fontWeight: 600, width: '35%' }}>Amount</td>
                      <td style={{ padding: '0.85rem 0.5rem', fontWeight: 800, color: '#0F172A', fontSize: '1.05rem' }}>
                        <CurrencySymbol size={13} /> {(parseFloat(selectedPaymentForAction.amount) || 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#64748B', fontWeight: 600 }}>Method</td>
                      <td style={{ padding: '0.85rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: selectedPaymentForAction.method === 'Discount' ? '#FEE2E2' : '#E0F2FE',
                          color: selectedPaymentForAction.method === 'Discount' ? '#991B1B' : '#0369A1',
                          display: 'inline-block'
                        }}>
                          {getPaymentMethodLabel(selectedPaymentForAction)}
                        </span>
                        {selectedPaymentForAction.bankName && (
                          <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>
                            ({selectedPaymentForAction.bankName})
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#64748B', fontWeight: 600 }}>Date & Time</td>
                      <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: '#334155' }}>
                        {formatDate(selectedPaymentForAction.createdAt)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#64748B', fontWeight: 600, verticalAlign: 'top' }}>Usage / Link</td>
                      <td style={{ padding: '0.85rem 0.5rem', fontWeight: 700, color: '#1E293B', lineHeight: 1.45 }}>
                        {selectedPaymentForAction.isSettlementGroup ? (
                          <div style={{ color: '#0369A1', background: '#F0F9FF', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', display: 'inline-block', border: '1px solid #BAE6FD' }}>
                            Quick Settlement ({selectedPaymentForAction.paymentIds.length} allocations)
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: selectedPaymentForAction.orderId ? '#0F172A' : '#475569' }}>
                            {getPaymentSourceInfo(selectedPaymentForAction)}
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {selectedPaymentAllocations && selectedPaymentAllocations.length > 0 && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Usage / Allocation Breakdown
                    </h4>
                    <div style={{ background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#475569', fontWeight: 600 }}>Applied To</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#475569', fontWeight: 600 }}>Amount</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#475569', fontWeight: 600 }}>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPaymentAllocations.map((alloc, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < selectedPaymentAllocations.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#0F172A' }}>{alloc.target}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                                <CurrencySymbol size={11} /> {alloc.amount.toFixed(2)}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', color: '#64748B', fontSize: '0.78rem' }}>{alloc.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setShowPaymentViewModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Payment Modal */}
        {showPaymentEditModal && selectedPaymentForAction && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ color: '#0F172A', fontSize: '1.15rem' }}>{isAdvanceAllocation(selectedPaymentForAction) ? 'Advance Applied' : 'Edit Payment'}</h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748B' }}>
                    Receipt: {getReceiptNumber(selectedPaymentForAction)}
                  </p>
                </div>
                <X size={22} className={styles.closeBtn} onClick={() => setShowPaymentEditModal(false)} />
              </div>
              <div className={styles.modalContent} style={{ padding: '1.25rem 1.5rem' }}>
                {isAdvanceAllocation(selectedPaymentForAction) ? (
                  <div style={{ padding: '0.85rem', borderRadius: '8px', background: '#EFF6FF', color: '#1E40AF', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    ₹{(Number(selectedPaymentForAction.amount) || 0).toFixed(2)} from the customer's existing advance was applied to Order #{settings.invoicePrefix || ''}{selectedPaymentForAction.orderId}. This is not a new cash payment and cannot be edited here.
                  </div>
                ) : <>
                <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    {selectedPaymentForAction.method === 'Discount' ? 'Discount Amount' : 'Payment Amount'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPaymentAmount}
                    onChange={(e) => setEditPaymentAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem', fontWeight: 700 }}
                  />
                </div>
                {selectedPaymentForAction.method !== 'Discount' && (
                  <>
                  <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem', display: 'block' }}>Payment Method</label>
                    <PaymentMethodSelect
                      value={editPaymentMethod}
                      onChange={(method) => {
                        setEditPaymentMethod(method);
                        const defaultBankForMethod = method === 'Card'
                          ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || '')
                          : (method === 'UPI'
                            ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || '')
                            : (settings.defaultBankId || settings.bankAccounts?.[0]?.id || ''));
                        setEditSelectedBank(defaultBankForMethod);
                      }}
                      settings={settings}
                    />
                  </div>
                  {['Card', 'UPI', 'Bank'].includes(editPaymentMethod) && settings.bankAccounts?.length > 0 && (
                  <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem', display: 'block' }}>Select Bank Account</label>
                    <select
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem', background: 'white' }}
                      value={editSelectedBank}
                      onChange={(e) => setEditSelectedBank(e.target.value)}
                    >
                      {settings.bankAccounts.filter(acc => acc.isActive !== false).map((acc, idx) => (
                        <option key={idx} value={acc.id || acc.bankName}>
                          {acc.bankName}
                        </option>
                      ))}
                    </select>
                  </div>
                  )}
                  </>
                )}
                </>}
              </div>
              <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  style={{ padding: '0.5rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setShowPaymentEditModal(false)}
                >
                  Cancel
                </button>
                {!isAdvanceAllocation(selectedPaymentForAction) && <button
                  style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={handleSavePaymentEdit}
                >
                  Save Changes
                </button>}
              </div>
            </div>
          </div>
        )}

        {/* Edit Discount Modal */}
        {showDiscountEditModal && selectedBillForDiscount && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ color: '#0F172A', fontSize: '1.15rem' }}>Edit Order Discount</h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748B' }}>Order #{settings.invoicePrefix || ''}{selectedBillForDiscount.id}</p>
                </div>
                <X size={22} className={styles.closeBtn} onClick={() => setShowDiscountEditModal(false)} />
              </div>
              <div className={styles.modalContent} style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ background: '#F1F5F9', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#64748B' }}>Current Net Amount:</span>
                    <span style={{ fontWeight: 700 }}><CurrencySymbol size={13} /> {(selectedBillForDiscount.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Discount Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editDiscountValue}
                    onChange={(e) => setEditDiscountValue(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem', fontWeight: 700 }}
                  />
                </div>
              </div>
              <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  style={{ padding: '0.5rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setShowDiscountEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={handleSaveDiscountEdit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Action Secure PIN Modal */}
        {showPinModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ color: '#0F172A' }}>Security Verification</h2>
                  <p>Enter Settings PIN to proceed</p>
                </div>
                <X size={24} className={styles.closeBtn} onClick={() => setShowPinModal(false)} />
              </div>
              <form onSubmit={handleVerifyPinAction}>
                <div className={styles.modalContent} style={{ padding: '1.5rem' }}>
                  <div className={styles.formGroup}>
                    <label>Secure PIN</label>
                    <div className={styles.inputWrapper}>
                      <Lock size={18} />
                      <input
                        type="password"
                        maxLength={4}
                        required
                        autoFocus
                        placeholder="••••"
                        value={managerPinValue}
                        onChange={(e) => {
                          setManagerPinValue(e.target.value.replace(/\D/g, ''));
                          setManagerPinError('');
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                    {managerPinError && (
                      <p style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.25rem' }}>
                        {managerPinError}
                      </p>
                    )}
                  </div>
                </div>
                <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    style={{ padding: '0.5rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => setShowPinModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Verify PIN
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Credit Limit Modal */}
        {showEditCreditLimitModal && selectedCustomer && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Edit Credit Limit</h2>
                  <p>Set individual credit limit for <strong>{selectedCustomer.name}</strong></p>
                </div>
                <X size={24} className={styles.closeBtn} onClick={() => { setShowEditCreditLimitModal(false); }} />
              </div>
              <form onSubmit={handleUpdateCreditLimit}>
                <div className={styles.modalBody}>
                  <div style={{
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>CURRENT BALANCE</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (selectedCustomer.balance || 0) > 0 ? 'var(--danger)' : (selectedCustomer.balance || 0) < 0 ? 'var(--secondary)' : '#64748B' }}>
                        <CurrencySymbol size={16} /> {Math.abs(selectedCustomer.balance || 0).toFixed(2)}
                        {selectedCustomer.balance < 0 ? ' Adv' : selectedCustomer.balance > 0 ? ' Due' : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>CURRENT CREDIT LIMIT</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                        <CurrencySymbol size={16} /> {(selectedCustomer.creditLimit || settings.defaultCreditLimit || 500).toFixed(2)}
                        {(!selectedCustomer.creditLimit || selectedCustomer.creditLimit === 0) && <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginLeft: '0.25rem' }}>(shop default)</span>}
                      </div>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>New Credit Limit</label>
                    <div className={styles.inputWrapper}>
                      <CreditCard size={18} />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        autoFocus
                        placeholder="e.g. 500.00"
                        value={editCreditLimitValue}
                        onChange={(e) => setEditCreditLimitValue(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <p style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.25rem' }}>
                      Set to 0 to use the shop default limit ({settings.defaultCreditLimit} {settings.currencySymbol}).
                    </p>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                    <label>Manager PIN</label>
                    <div className={styles.inputWrapper}>
                      <Lock size={18} />
                      <input
                        type="password"
                        maxLength={4}
                        required
                        placeholder="••••"
                        value={managerPinValue}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, ''); // only digits
                          setManagerPinValue(val);
                          setManagerPinError('');
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                    {managerPinError && (
                      <p style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.25rem' }}>
                        {managerPinError}
                      </p>
                    )}
                  </div>

                  {parseFloat(editCreditLimitValue) > 0 && parseFloat(editCreditLimitValue) <= (selectedCustomer.balance || 0) && (
                    <div style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      fontSize: '0.8rem',
                      color: '#DC2626',
                      marginTop: '0.5rem'
                    }}>
                      ⚠️ Warning: The new limit ({parseFloat(editCreditLimitValue).toFixed(2)}) is less than or equal to the current balance ({(selectedCustomer.balance || 0).toFixed(2)}). Future orders will require Manager Override.
                    </div>
                  )}
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => { setShowEditCreditLimitModal(false); }}>Cancel</button>
                  <button type="submit" className={styles.primaryBtn} style={{ background: 'var(--primary)' }}>Save Credit Limit</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Refund Method Selection Modal */}
        {showRefundModal && orderToRefund && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ color: '#0F172A', fontSize: '1.25rem', fontWeight: 800 }}>Confirm Refund Account</h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.25rem' }}>
                    Select the account to refund <strong style={{ color: '#0F172A' }}><CurrencySymbol size={12} />{(orderToRefund.paidAmount || 0).toFixed(2)}</strong> for order <strong style={{ color: '#0F172A' }}>{orderToRefund.id}</strong>.
                  </p>
                </div>
                <X size={24} className={styles.closeBtn} onClick={() => { setShowRefundModal(false); setOrderToRefund(null); }} />
              </div>
              <div className={styles.modalContent} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', background: selectedRefundMethod === 'Cash' ? '#F0F9FF' : 'white', borderColor: selectedRefundMethod === 'Cash' ? '#0284C7' : '#E2E8F0', transition: 'all 0.2s' }}>
                    <input
                      type="radio"
                      name="refundAccount"
                      value="Cash"
                      checked={selectedRefundMethod === 'Cash'}
                      onChange={() => setSelectedRefundMethod('Cash')}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}>Refund to Cash Account</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Deduct refund amount from Cash register</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', background: selectedRefundMethod === 'Bank' ? '#F0F9FF' : 'white', borderColor: selectedRefundMethod === 'Bank' ? '#0284C7' : '#E2E8F0', transition: 'all 0.2s' }}>
                    <input
                      type="radio"
                      name="refundAccount"
                      value="Bank"
                      checked={selectedRefundMethod === 'Bank'}
                      onChange={() => setSelectedRefundMethod('Bank')}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}>Refund to Bank Account</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Deduct refund amount from default bank account</div>
                    </div>
                  </label>
                </div>
              </div>
              <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => { setShowRefundModal(false); setOrderToRefund(null); }}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={confirmRefund}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  Confirm Refund
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Order Delete Manager PIN Verification Modal */}
        {showOrderDeletePinModal && orderToDelete && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '420px', borderRadius: '12px', overflow: 'hidden', padding: 0, border: 'none' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ backgroundColor: '#EF4444', color: 'white', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                  <Trash2 size={22} /> Confirm Deletion
                </h2>
                <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={() => { setShowOrderDeletePinModal(false); setOrderToDelete(null); setOrderDeletePinValue(''); setOrderDeletePinError(''); }} />
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleDeleteOrderInInsight(); }}>
                <div style={{ padding: '1.5rem' }}>
                  <p style={{ marginBottom: '1.2rem', color: '#64748B', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    You are deleting order <strong>{orderToDelete.id}</strong>. This action is permanent and cannot be undone.
                  </p>

                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                    Enter Manager/Admin Access PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={orderDeletePinValue}
                    onChange={(e) => {
                      setOrderDeletePinValue(e.target.value.replace(/\D/g, ''));
                      setOrderDeletePinError('');
                    }}
                    placeholder="••••"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      textAlign: 'center',
                      fontSize: '1.25rem',
                      letterSpacing: '0.5rem',
                      borderRadius: '8px',
                      border: orderDeletePinError ? '2px solid #EF4444' : '1px solid #CBD5E1',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    autoFocus
                  />

                  {(orderToDelete.paidAmount > 0 || ['Paid', 'Partial'].includes(orderToDelete.paymentStatus)) ? (
                    <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        CHOOSE ACTION FOR PAYMENT (<CurrencySymbol size={11} />{(orderToDelete.paidAmount || 0).toFixed(2)}):
                      </span>

                      {/* Option 1: Refund */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="radio"
                            name="deleteOption"
                            value="refund"
                            checked={deleteOption === 'refund'}
                            onChange={() => setDeleteOption('refund')}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          Refund Customer
                        </label>

                        {deleteOption === 'refund' && (
                          <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>Select Refund Account:</span>
                            <div style={{ display: 'flex', gap: '1.25rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                                <input
                                  type="radio"
                                  name="refundMethod"
                                  value="Cash"
                                  checked={refundMethod === 'Cash'}
                                  onChange={() => setRefundMethod('Cash')}
                                  style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                                />
                                Cash Account
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                                <input
                                  type="radio"
                                  name="refundMethod"
                                  value="Bank"
                                  checked={refundMethod === 'Bank'}
                                  onChange={() => setRefundMethod('Bank')}
                                  style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                                />
                                Bank Account
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Option 2: Convert to Advance */}
                      {orderToDelete.customerId && orderToDelete.customerId !== 'Walk-in' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                            <input
                              type="radio"
                              name="deleteOption"
                              value="advance"
                              checked={deleteOption === 'advance'}
                              onChange={() => setDeleteOption('advance')}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            Convert Payment to Advance
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ margin: '1rem 0', background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Status:</span>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', marginTop: '0.25rem' }}>
                        Not Paid (No transactions recorded)
                      </div>
                    </div>
                  )}

                  {orderDeletePinError && (
                    <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 500, textAlign: 'center' }}>
                      {orderDeletePinError}
                    </p>
                  )}

                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <button
                      type="button"
                      style={{ flex: 1, padding: '0.65rem 1rem', background: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                      onClick={() => {
                        setShowOrderDeletePinModal(false);
                        setOrderToDelete(null);
                        setOrderDeletePinValue('');
                        setOrderDeletePinError('');
                      }}
                      disabled={isDeletingOrder}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ flex: 1.5, padding: '0.65rem 1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 700, color: '#64748B', cursor: isDeletingOrder || orderDeletePinValue.length < 4 ? 'not-allowed' : 'pointer', opacity: isDeletingOrder || orderDeletePinValue.length < 4 ? 0.6 : 1 }}
                      disabled={isDeletingOrder || orderDeletePinValue.length < 4}
                    >
                      {isDeletingOrder ? 'Deleting...' : 'Authorize & Delete'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {toastMessage && (
          <>
            <style>{`
              @keyframes toastSlideIn {
                0% { transform: translateX(120%) scale(0.9); opacity: 0; }
                70% { transform: translateX(-10px) scale(1.02); opacity: 1; }
                100% { transform: translateX(0) scale(1); opacity: 1; }
              }
            `}</style>
            <div style={{
              position: 'fixed',
              top: '24px',
              right: '24px',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              padding: '1rem 1.5rem',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              zIndex: 9999999,
              fontFamily: "'Inter', sans-serif",
              width: '380px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderLeft: '5px solid #EF4444',
              animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}>
              <AlertTriangle size={20} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.01em' }}>Restriction Alert</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '2px', fontWeight: 400, lineHeight: 1.4 }}>
                  {typeof toastMessage === 'string' ? toastMessage : toastMessage.msg}
                </span>
                {toastMessage.reason && (
                  <div style={{ marginTop: '6px' }}>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAlertReason(r => !r); }}
                      style={{ background: 'none', border: 'none', color: '#60A5FA', padding: 0, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      {showAlertReason ? 'Hide Deletion Reason' : 'Show Deletion Reason'}
                    </button>
                    {showAlertReason && (
                      <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#CBD5E1', background: 'rgba(255,255,255,0.08)', padding: '6px 8px', borderRadius: '4px', fontStyle: 'italic', borderLeft: '2px solid #60A5FA', lineHeight: 1.35 }}>
                        "{toastMessage.reason}"
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button 
                onClick={() => setToastMessage(null)}
                style={{ background: 'none', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', marginTop: '2px' }}
              >
                <X size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (viewMode === 'statement' && selectedCustomer) {
    return (
      <CustomerStatement
        customerIdProp={selectedCustomer.id}
        selectedCustomerProp={selectedCustomer}
        onBackToInsight={() => setViewMode('insight')}
        onClose={() => {
          setViewMode('list');
          setSelectedCustomer(null);
        }}
        hideHeader={false}
      />
    );
  }

  return (
    <div className={styles.customersPage}>
      {/* Header */}
      <div className={styles.headerRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className={styles.headerTitle}>
          <h1>Customers</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Custom Sleek Sort Dropdown */}
          <div ref={sortDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                background: 'white',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
            >
              <ArrowUpDown size={15} color="var(--primary)" />
              <span>{sortOptions.find(o => o.value === sortBy)?.label || 'Sort By'}</span>
              <ChevronDown
                size={14}
                color="#64748B"
                style={{
                  transform: isSortOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              />
            </button>

            {isSortOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                width: '230px',
                padding: '0.4rem',
                zIndex: 200
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', padding: '0.4rem 0.65rem 0.25rem 0.65rem', letterSpacing: '0.05em' }}>
                  Sort Customers By
                </div>
                {sortOptions.map((opt) => {
                  const isSelected = sortBy === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        setIsSortOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? 'var(--primary)' : '#334155',
                        background: isSelected ? '#F1F5F9' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check size={16} color="var(--primary)" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unified search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.4rem 0.75rem', width: '260px' }}>
            <Search size={18} color="#64748B" />
            <input
              type="text"
              placeholder="Search name or phone..."
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={() => {
            setEditingCustomer(null);
            setFormData({ name: '', phone: settings.waCountryCode ? `+${settings.waCountryCode.replace(/\+/g, '')}` : '+971', address: '', openingBalance: '' });
            setShowModal(true);
          }}>
            <UserPlus size={18} /> Add Customer
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className={styles.tableCard}>
        <table className={styles.customersTable}>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Id</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Credit Limit</th>
              <th>Total Sales</th>
              <th>Due</th>
              <th data-noprint="true" style={{ width: '180px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.length > 0 ? paginatedCustomers.map((customer, idx) => (
              <tr key={customer.id || idx}>
                <td style={{ fontWeight: 700, color: '#64748B', fontSize: '0.8rem' }}>
                  {customer.id?.split('-')[1]?.substring(0, 8) || customer.id || idx + 1}
                </td>
                <td
                  style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewCustomerInsight(customer); }}
                >
                  {customer.name}
                </td>
                <td>
                  {customer.phone || '000'}
                </td>
                <td style={{ fontWeight: 600, color: '#475569' }}>
                  {(customer.creditLimit || settings.defaultCreditLimit || 500).toFixed(2)}
                  {(!customer.creditLimit || customer.creditLimit === 0) && <span style={{ fontSize: '0.65rem', color: '#94A3B8', marginLeft: '3px' }}>(default)</span>}
                </td>
                <td style={{ fontWeight: 600, color: '#475569' }}>
                  {(customer.totalSales || 0).toFixed(2)}
                </td>
                <td style={{ fontWeight: 700, color: (customer.balance || 0) > 0 ? 'var(--danger)' : (customer.balance || 0) < 0 ? 'var(--secondary)' : '#64748B' }}>
                  {Math.abs(customer.balance || 0).toFixed(2)}
                  {(customer.balance || 0) > 0 ? ' Due' : (customer.balance || 0) < 0 ? ' Adv' : ''}
                </td>
                <td data-noprint="true" style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewCustomerInsight(customer); }}
                      title="View Customer Insight"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      style={{ background: 'none', border: 'none', color: '#8B5CF6', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewCustomerInsight(customer, 'statement'); }}
                      title="View Customer Statement"
                    >
                      <FileText size={18} />
                    </button>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedCustomer(customer);
                        setEditingCustomer(customer);
                        setFormData({ name: customer.name, phone: customer.phone, address: customer.address || '', openingBalance: customer.openingBalance !== undefined && customer.openingBalance !== null ? customer.openingBalance.toString() : '' });
                        setShowModal(true);
                      }}
                      title="Edit Customer"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedCustomer(customer);
                        const autoAmount = customer.balance > 0 ? customer.balance : '';
                        setPaymentData({ amount: autoAmount.toString(), method: 'Cash' });
                        setShowPaymentModal(true);
                      }}
                      title="Settle Payment"
                    >
                      <DollarSign size={18} />
                    </button>
                    {customer.phone && (
                      <button
                        style={{ background: 'none', border: 'none', color: '#25D366', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleWhatsApp(customer.phone, customer.balance); }}
                        title="Send via WhatsApp"
                      >
                        <WhatsAppIcon size={18} />
                      </button>
                    )}
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteCustomer(customer.id); }}
                      title="Delete Customer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                  {loading ? 'Loading customers...' : 'No customers found. Click "Add Customer" to start.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalCustomers / 20)}
            onPageChange={setCurrentPage}
            totalItems={totalCustomers}
            pageSize={20}
            itemLabel="customers"
          />
        )}
      </div>


      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{editingCustomer ? 'Edit Customer Info' : 'Add New Customer'}</h2>
                <p>{editingCustomer ? 'Update details for this customer' : 'Register a new customer to your database'}</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => { setShowModal(false); setEditingCustomer(null); }} />
            </div>

            <form onSubmit={handleSaveCustomer}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Full Name</label>
                  <div className={styles.inputWrapper}>
                    <UserPlus size={18} />
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Phone Number <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div className={styles.inputWrapper}>
                    <Phone size={18} />
                    <input
                      type="tel"
                      placeholder="+971 50 123 4567"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Address (Optional)</label>
                  <div className={styles.inputWrapper}>
                    <MapPin size={18} />
                    <input
                      type="text"
                      placeholder="Street, City, State"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Opening Balance
                    <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748B' }}>
                      (e.g. -500 for Advance, 500 for Due)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isOpeningBalanceUnlocked) {
                          setPinActionTarget('unlock_opening_balance');
                          setShowPinModal(true);
                        } else {
                          setIsOpeningBalanceUnlocked(false);
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isOpeningBalanceUnlocked ? '#10B981' : '#EF4444',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                      title={isOpeningBalanceUnlocked ? "Lock field" : "Unlock with PIN"}
                    >
                      {isOpeningBalanceUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
                    </button>
                  </label>
                  <div className={styles.inputWrapper} style={{ opacity: isOpeningBalanceUnlocked ? 1 : 0.7 }}>
                    <DollarSign size={18} />
                    <input
                      type="number"
                      step="0.01"
                      placeholder={isOpeningBalanceUnlocked ? "0.00 (- for Advance, + for Due)" : "Click lock icon to unlock"}
                      value={formData.openingBalance}
                      onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                      readOnly={!isOpeningBalanceUnlocked}
                      style={{ cursor: isOpeningBalanceUnlocked ? 'text' : 'not-allowed' }}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => { setShowModal(false); setEditingCustomer(null); }}>Cancel</button>
                <button type="submit" className={styles.primaryBtn}>{editingCustomer ? 'Save Changes' : 'Create Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bills Modal */}
      {showBillsModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ width: '800px', maxWidth: '95vw' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Invoice/Order History - {selectedCustomer?.name}</h2>
                <p>
                  {selectedCustomer?.balance > 0
                    ? 'Outstanding Due: '
                    : selectedCustomer?.balance < 0
                      ? 'Prepaid Advance: '
                      : 'Customer Balance: '}
                  <strong style={{ color: (selectedCustomer?.balance || 0) > 0 ? 'var(--danger)' : (selectedCustomer?.balance || 0) < 0 ? 'var(--secondary)' : '#64748B' }}>
                    {selectedCustomer?.balance !== 0 ? (
                      <>
                        <CurrencySymbol size={16} /> {Math.abs(selectedCustomer?.balance || 0).toFixed(2)}
                      </>
                    ) : (
                      'Settled'
                    )}
                  </strong>
                </p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowBillsModal(false)} />
            </div>
            <div className={styles.modalBody} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table className={styles.customersTable}>
                <thead>
                  <tr>
                    <th>Invoice/Order ID</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customerBills.length > 0 ? customerBills.map((bill) => (
                    <tr key={bill.id}>
                      <td style={{ fontWeight: 700 }}>{bill.id}</td>
                      <td>{formatDate(bill.createdAt)}</td>
                      <td><CurrencySymbol size={14} /> {bill.totalAmount.toFixed(2)}</td>
                      <td>
                        <CurrencySymbol size={14} /> {
                          bill.paymentStatus === 'Paid'
                            ? bill.totalAmount.toFixed(2)
                            : (bill.paidAmount || 0).toFixed(2)
                        }
                      </td>
                      <td><span style={{ color: (bill.dueAmount || 0) > 0 ? 'var(--danger)' : 'inherit' }}><CurrencySymbol size={14} /> {(bill.dueAmount || 0).toFixed(2)}</span></td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(
                          (bill.paidAmount || 0) === 0
                            ? 'Credit'
                            : ((bill.paidAmount || 0) >= bill.totalAmount ? 'Paid' : 'Partial')
                        )}`}>
                          {(bill.paidAmount || 0) === 0
                            ? 'Credit'
                            : ((bill.paidAmount || 0) >= bill.totalAmount ? 'Paid' : 'Partial')}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No invoice/order history found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={() => setShowBillsModal(false)}>Close</button>
              <button
                className={styles.primaryBtn}
                onClick={() => {
                  setShowBillsModal(false);
                  // Only auto-fill if balance is positive (due), otherwise let them enter amount
                  const autoAmount = selectedCustomer?.balance > 0 ? selectedCustomer.balance : '';
                  setPaymentData({ amount: autoAmount, method: 'Cash', discount: '' });
                  setSplitCash('');
                  setSplitCard('');
                  setSplitUPI('');
                  setSplitBank('');
                  setShowPaymentModal(true);
                }}
                disabled={!selectedCustomer}
              >
                Settle Balance
              </button>
            </div>
          </div>
        </div>
      )}
      {showPaymentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A' }}>{selectedBillForPayment ? 'Settle Customer Invoice' : 'Settle Customer Balance'}</h2>
                <p>{selectedBillForPayment ? `Record payment for Invoice #${settings.invoicePrefix || ''}${selectedBillForPayment.id}` : 'Record payment and settle outstanding credit'}</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowPaymentModal(false)} />
            </div>

            <form onSubmit={handlePayment}>
              <div className={styles.modalBody}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: '#F1F5F9',
                  borderRadius: '12px',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifySelf: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.2rem',
                    fontWeight: 800
                  }}>
                    {selectedCustomer?.name?.charAt(0)}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#1E293B' }}>{selectedCustomer?.name}</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                      {selectedCustomer?.balance > 0
                        ? 'Outstanding Due: '
                        : selectedCustomer?.balance < 0
                          ? 'Prepaid Advance: '
                          : 'Customer Balance: '}
                      <strong style={{ color: (selectedCustomer?.balance || 0) > 0 ? 'var(--danger)' : (selectedCustomer?.balance || 0) < 0 ? 'var(--secondary)' : '#64748B' }}>
                        {selectedCustomer?.balance !== 0 ? (
                          <>
                            <CurrencySymbol size={14} /> {Math.abs(selectedCustomer?.balance || 0).toFixed(2)}
                          </>
                        ) : (
                          'Settled'
                        )}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Settlement Amount</label>
                  <div className={styles.inputWrapper}>
                    <CreditCard size={18} />
                    <input
                      type="number"
                      step="0.01"
                      required
                      autoFocus
                      placeholder="0.00"
                      disabled={paymentData.method === 'Multipayment'}
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem', display: 'block' }}>Discount Amount (Optional)</label>
                  <div className={styles.inputWrapper}>
                    <Percent size={18} />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={paymentData.discount || ''}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, discount: e.target.value }))}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem' }}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem', display: 'block' }}>Payment Method</label>
                  <PaymentMethodSelect
                    value={paymentData.method}
                    onChange={(method) => setPaymentData(prev => ({ ...prev, method }))}
                    settings={settings}
                  />
                </div>

                {paymentData.method === 'Multipayment' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Cash</label>
                      <input type="number" placeholder="0.00" value={splitCash} onChange={(e) => setSplitCash(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', marginTop: '0.25rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Card</label>
                      <input type="number" placeholder="0.00" value={splitCard} onChange={(e) => setSplitCard(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', marginTop: '0.25rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>UPI</label>
                      <input type="number" placeholder="0.00" value={splitUPI} onChange={(e) => setSplitUPI(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', marginTop: '0.25rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Bank</label>
                      <input type="number" placeholder="0.00" value={splitBank} onChange={(e) => setSplitBank(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', marginTop: '0.25rem' }} />
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} style={{ background: 'var(--secondary)' }}>
                  Complete Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showQuickSettleModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Quick Settle</h2>
                <p>Search customer to record payment</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => {
                setShowQuickSettleModal(false);
                setQuickSettleSearch('');
              }} />
            </div>
            <div className={styles.modalBody}>
              <div className={styles.inputWrapper}>
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Enter name or phone..."
                  autoFocus
                  value={quickSettleSearch}
                  onChange={(e) => setQuickSettleSearch(e.target.value)}
                />
              </div>

              <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                {quickSettleSearch.length > 1 && customers
                  .filter(c =>
                    c.name.toLowerCase().includes(quickSettleSearch.toLowerCase()) ||
                    c.phone?.includes(quickSettleSearch)
                  )
                  .map(customer => (
                    <div
                      key={customer.id}
                      className={styles.searchResultItem}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setPaymentData({ ...paymentData, amount: customer.balance });
                        setShowQuickSettleModal(false);
                        setQuickSettleSearch('');
                        setShowPaymentModal(true);
                      }}
                    >
                      <div className={styles.searchResultInfo}>
                        <strong>{customer.name}</strong>
                        <span>{customer.phone}</span>
                      </div>
                      <div className={styles.searchResultBalance}>
                        <CurrencySymbol size={14} /> {customer.balance.toFixed(2)}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Credit Limit Modal */}
      {showEditCreditLimitModal && selectedCustomer && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Edit Credit Limit</h2>
                <p>Set individual credit limit for <strong>{selectedCustomer.name}</strong></p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => { setShowEditCreditLimitModal(false); }} />
            </div>
            <form onSubmit={handleUpdateCreditLimit}>
              <div className={styles.modalBody}>
                <div style={{
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>CURRENT BALANCE</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (selectedCustomer.balance || 0) > 0 ? 'var(--danger)' : (selectedCustomer.balance || 0) < 0 ? 'var(--secondary)' : '#64748B' }}>
                      <CurrencySymbol size={16} /> {Math.abs(selectedCustomer.balance || 0).toFixed(2)}
                      {selectedCustomer.balance < 0 ? ' Adv' : selectedCustomer.balance > 0 ? ' Due' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>CURRENT CREDIT LIMIT</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                      <CurrencySymbol size={16} /> {(selectedCustomer.creditLimit || 0).toFixed(2)}
                      {selectedCustomer.creditLimit === 0 && <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginLeft: '0.25rem' }}>(using shop default: {settings.defaultCreditLimit})</span>}
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>New Credit Limit</label>
                  <div className={styles.inputWrapper}>
                    <CreditCard size={18} />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      autoFocus
                      placeholder="e.g. 500.00"
                      value={editCreditLimitValue}
                      onChange={(e) => setEditCreditLimitValue(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.25rem' }}>
                    Set to 0 to use the shop default limit ({settings.defaultCreditLimit} {settings.currencySymbol}).
                  </p>
                </div>

                <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                  <label>Manager PIN</label>
                  <div className={styles.inputWrapper}>
                    <Lock size={18} />
                    <input
                      type="password"
                      maxLength={4}
                      required
                      placeholder="••••"
                      value={managerPinValue}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, ''); // only digits
                        setManagerPinValue(val);
                        setManagerPinError('');
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {managerPinError && (
                    <p style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.25rem' }}>
                      {managerPinError}
                    </p>
                  )}
                </div>

                {parseFloat(editCreditLimitValue) > 0 && parseFloat(editCreditLimitValue) <= (selectedCustomer.balance || 0) && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    fontSize: '0.8rem',
                    color: '#DC2626',
                    marginTop: '0.5rem'
                  }}>
                    ⚠️ Warning: The new limit ({parseFloat(editCreditLimitValue).toFixed(2)}) is less than or equal to the current balance ({(selectedCustomer.balance || 0).toFixed(2)}). Future orders will require Manager Override.
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => { setShowEditCreditLimitModal(false); }}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} style={{ background: 'var(--primary)' }}>Save Credit Limit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreditWarning && creditWarningDetails && (
        <div className={styles.modalOverlay}>
          <div className={styles.statusModal} style={{ maxWidth: '450px', borderRadius: '24px', background: 'white', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <AlertTriangle size={24} color="#EF4444" style={{ marginTop: '2px' }} />
              <div>
                <h2 style={{ color: '#EF4444', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Credit Limit Exceeded</h2>
                <p style={{ color: '#EF4444', margin: '2px 0 0 0', fontSize: '0.85rem', fontWeight: 500, opacity: 0.9 }}>This customer has exceeded their credit threshold.</p>
              </div>
            </div>
            <form onSubmit={handleVerifyManagerPin}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem', color: '#64748B', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>Customer Name:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{creditWarningDetails.customerName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>Credit Limit:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}><CurrencySymbol size={14} /> {creditWarningDetails.creditLimit.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>Outstanding Balance:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}><CurrencySymbol size={14} /> {creditWarningDetails.currentOutstanding.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>Credit Balance Change:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}><CurrencySymbol size={14} /> {creditWarningDetails.orderAmount.toFixed(2)}</span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.25rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>New Outstanding Balance:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}><CurrencySymbol size={14} /> {creditWarningDetails.newOutstanding.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444', fontWeight: 700 }}>
                  <span>Exceeded Amount:</span>
                  <span><CurrencySymbol size={14} /> {creditWarningDetails.exceededAmount.toFixed(2)}</span>
                </div>
              </div>

              {settings.enableManagerOverride ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>ENTER MANAGER SECURE PIN TO APPROVE</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '0.75rem 1rem', background: '#F8FAFC' }}>
                    <Lock size={18} color="#94A3B8" />
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={managerPinValue}
                      onChange={(e) => setManagerPinValue(e.target.value.replace(/\D/g, ''))}
                      style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', border: 'none', background: 'transparent', outline: 'none', width: '100%', color: '#1E293B' }}
                      autoFocus
                    />
                  </div>
                  {managerPinError && (
                    <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>{managerPinError}</p>
                  )}
                </div>
              ) : (
                <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '12px', padding: '0.75rem 1rem', color: '#C53030', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  <AlertCircle size={18} />
                  <span>Credit Limit Protection is active and Manager Override is disabled.</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={handleCancelOverride}
                  style={{ background: 'none', border: 'none', color: '#64748B', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', padding: '0.5rem 0' }}
                >
                  Cancel
                </button>
                {creditWarningDetails.overrideAllowed && settings.enableManagerOverride && (
                  <button
                    type="submit"
                    style={{ background: '#D97706', color: 'white', border: 'none', borderRadius: '10px', padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.2)' }}
                  >
                    Approve Override
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Payment Details Modal */}
      {showPaymentViewModal && selectedPaymentForAction && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A' }}>Payment Details</h2>
                <p>Receipt ID: {getReceiptNumber(selectedPaymentForAction)}</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowPaymentViewModal(false)} />
            </div>
             <div className={styles.modalContent} style={{ padding: '1.25rem 1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#64748B', fontWeight: 600, width: '35%' }}>Amount</td>
                      <td style={{ padding: '0.85rem 0.5rem', fontWeight: 800, color: '#0F172A', fontSize: '1.05rem' }}>
                        <CurrencySymbol size={13} /> {(parseFloat(selectedPaymentForAction.amount) || 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#64748B', fontWeight: 600 }}>Method</td>
                      <td style={{ padding: '0.85rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: selectedPaymentForAction.method === 'Discount' ? '#FEE2E2' : '#E0F2FE',
                          color: selectedPaymentForAction.method === 'Discount' ? '#991B1B' : '#0369A1',
                          display: 'inline-block'
                        }}>
                          {getPaymentMethodLabel(selectedPaymentForAction)}
                        </span>
                        {selectedPaymentForAction.bankName && (
                          <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>
                            ({selectedPaymentForAction.bankName})
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#64748B', fontWeight: 600 }}>Date & Time</td>
                      <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: '#334155' }}>
                        {formatDate(selectedPaymentForAction.createdAt)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#64748B', fontWeight: 600, verticalAlign: 'top' }}>Usage / Link</td>
                      <td style={{ padding: '0.85rem 0.5rem', fontWeight: 700, color: '#1E293B', lineHeight: 1.45 }}>
                        {selectedPaymentForAction.isSettlementGroup ? (
                          <div style={{ color: '#0369A1', background: '#F0F9FF', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', display: 'inline-block', border: '1px solid #BAE6FD' }}>
                            Quick Settlement ({selectedPaymentForAction.paymentIds.length} allocations)
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: selectedPaymentForAction.orderId ? '#0F172A' : '#475569' }}>
                            {getPaymentSourceInfo(selectedPaymentForAction)}
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {selectedPaymentAllocations && selectedPaymentAllocations.length > 0 && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Usage / Allocation Breakdown
                    </h4>
                    <div style={{ background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#475569', fontWeight: 600 }}>Applied To</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#475569', fontWeight: 600 }}>Amount</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#475569', fontWeight: 600 }}>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPaymentAllocations.map((alloc, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < selectedPaymentAllocations.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#0F172A' }}>{alloc.target}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                                <CurrencySymbol size={11} /> {alloc.amount.toFixed(2)}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', color: '#64748B', fontSize: '0.78rem' }}>{alloc.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setShowPaymentViewModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showPaymentEditModal && selectedPaymentForAction && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A' }}>{isAdvanceAllocation(selectedPaymentForAction) ? 'Advance Applied' : 'Edit Payment'}</h2>
                <p>{isAdvanceAllocation(selectedPaymentForAction) ? 'Existing advance applied to the linked order' : 'Change payment details'}</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowPaymentEditModal(false)} />
            </div>
            <div className={styles.modalContent} style={{ padding: '1.5rem' }}>
              {isAdvanceAllocation(selectedPaymentForAction) ? (
                <div style={{ padding: '0.85rem', borderRadius: '8px', background: '#EFF6FF', color: '#1E40AF', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  ₹{(Number(selectedPaymentForAction.amount) || 0).toFixed(2)} from the customer's existing advance was applied to Order #{settings.invoicePrefix || ''}{selectedPaymentForAction.orderId}. This is not a new cash payment and cannot be edited here.
                </div>
              ) : <>
              <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                <label>Payment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editPaymentAmount}
                  onChange={(e) => setEditPaymentAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem' }}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Payment Method</label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => {
                    const method = e.target.value;
                    setEditPaymentMethod(method);
                    const defaultBankForMethod = method === 'Card'
                      ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || '')
                      : (method === 'UPI'
                        ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || '')
                        : (settings.defaultBankId || settings.bankAccounts?.[0]?.id || ''));
                    setEditSelectedBank(defaultBankForMethod);
                  }}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem' }}
                >
                  {(settings.paymentMethodCashEnabled !== false) && <option value="Cash">Cash</option>}
                  {(settings.paymentMethodCardEnabled !== false) && <option value="Card">Card</option>}
                  {(settings.paymentMethodUpiEnabled !== false) && <option value="UPI">UPI</option>}
                  {(settings.paymentMethodBankEnabled !== false) && <option value="Bank">Bank Transfer</option>}
                </select>
              </div>
              {['Card', 'UPI', 'Bank'].includes(editPaymentMethod) && settings.bankAccounts?.length > 0 && (
              <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem', display: 'block' }}>Select Bank Account</label>
                <select
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem', background: 'white' }}
                  value={editSelectedBank}
                  onChange={(e) => setEditSelectedBank(e.target.value)}
                >
                  {settings.bankAccounts.filter(acc => acc.isActive !== false).map((acc, idx) => (
                    <option key={idx} value={acc.id || acc.bankName}>
                      {acc.bankName}
                    </option>
                  ))}
                </select>
              </div>
              )}
              </>}
            </div>
            <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                style={{ padding: '0.5rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setShowPaymentEditModal(false)}
              >
                Cancel
              </button>
              {!isAdvanceAllocation(selectedPaymentForAction) && <button
                style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                onClick={handleSavePaymentEdit}
              >
                Save Changes
              </button>}
            </div>
          </div>
        </div>
      )}

      {/* Payment Action Secure PIN Modal */}
      {showPinModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A' }}>Security Verification</h2>
                <p>Enter Settings PIN to proceed</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowPinModal(false)} />
            </div>
            <form onSubmit={handleVerifyPinAction}>
              <div className={styles.modalContent} style={{ padding: '1.5rem' }}>
                <div className={styles.formGroup}>
                  <label>Secure PIN</label>
                  <div className={styles.inputWrapper}>
                    <Lock size={18} />
                    <input
                      type="password"
                      maxLength={4}
                      required
                      autoFocus
                      placeholder="••••"
                      value={managerPinValue}
                      onChange={(e) => {
                        setManagerPinValue(e.target.value.replace(/\D/g, ''));
                        setManagerPinError('');
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {managerPinError && (
                    <p style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.25rem' }}>
                      {managerPinError}
                    </p>
                  )}
                </div>
              </div>
              <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  style={{ padding: '0.5rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setShowPinModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Verify PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Delete Manager PIN Verification Modal */}
      {showOrderDeletePinModal && orderToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#FEF2F2', borderBottom: '1px solid #FCA5A5', padding: '1.25rem 1.5rem' }}>
              <div>
                <h2 style={{ color: '#DC2626', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Trash2 size={20} /> Authorize Order Deletion
                </h2>
                <p style={{ color: '#991B1B', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
                  Order #{settings.invoicePrefix || ''}{orderToDelete.id}
                </p>
              </div>
              <X size={22} className={styles.closeBtn} onClick={() => { setShowOrderDeletePinModal(false); setOrderToDelete(null); }} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleDeleteOrderInInsight(); }}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: '1.5' }}>
                  Please enter the 4-digit <strong>Manager / Deletion PIN</strong> to delete this order. This action will permanently remove the order and reconcile balances.
                </p>

                <div className={styles.formGroup} style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Manager PIN</label>
                  <div className={styles.inputWrapper}>
                    <Lock size={18} color="#94A3B8" />
                    <input
                      type="password"
                      maxLength={4}
                      required
                      autoFocus
                      placeholder="••••"
                      value={orderDeletePinValue}
                      onChange={(e) => {
                        setOrderDeletePinValue(e.target.value.replace(/\D/g, ''));
                        setOrderDeletePinError('');
                      }}
                      style={{ letterSpacing: '0.5rem', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold', width: '100%' }}
                    />
                  </div>
                  {orderDeletePinError && (
                    <p style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.35rem' }}>
                      {orderDeletePinError}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ padding: '1rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  style={{ padding: '0.5rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setShowOrderDeletePinModal(false); setOrderToDelete(null); }}
                  disabled={isDeletingOrder}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingOrder || orderDeletePinValue.length < 4}
                  style={{ padding: '0.5rem 1.25rem', background: '#DC2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', opacity: isDeletingOrder || orderDeletePinValue.length < 4 ? 0.6 : 1 }}
                >
                  {isDeletingOrder ? 'Deleting...' : 'Authorize & Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVOICE VIEW MODAL */}
      {selectedInvoiceForView && (
        <div className={styles.modalOverlay} style={{ zIndex: 10000 }}>
          <div className={styles.modal} style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B' }}>Invoice #{settings.invoicePrefix || ''}{selectedInvoiceForView.id}</h2>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setSelectedInvoiceForView(null)} />
            </div>
            <div className={styles.modalBody} style={{ padding: '1.5rem', background: '#F8FAFC' }}>
              <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <InvoiceTemplate
                  order={selectedInvoiceForView}
                  settings={settings}
                  editable={false}
                  onOrderUpdate={(updated) => {
                    fetchCustomerBills(selectedCustomer?.id);
                    setSelectedInvoiceForView(prev => ({ ...prev, ...updated }));
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <>
          <style>{`
            @keyframes toastSlideIn {
              0% { transform: translateX(120%) scale(0.9); opacity: 0; }
              70% { transform: translateX(-10px) scale(1.02); opacity: 1; }
              100% { transform: translateX(0) scale(1); opacity: 1; }
            }
          `}</style>
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            zIndex: 9999999,
            fontFamily: "'Inter', sans-serif",
            width: '380px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderLeft: '5px solid #EF4444',
            animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            <AlertTriangle size={20} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.01em' }}>Restriction Alert</span>
              <span style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '2px', fontWeight: 400, lineHeight: 1.4 }}>
                {typeof toastMessage === 'string' ? toastMessage : toastMessage.msg}
              </span>
              {toastMessage.reason && (
                <div style={{ marginTop: '6px' }}>
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAlertReason(r => !r); }}
                    style={{ background: 'none', border: 'none', color: '#60A5FA', padding: 0, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    {showAlertReason ? 'Hide Deletion Reason' : 'Show Deletion Reason'}
                  </button>
                  {showAlertReason && (
                    <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#CBD5E1', background: 'rgba(255,255,255,0.08)', padding: '6px 8px', borderRadius: '4px', fontStyle: 'italic', borderLeft: '2px solid #60A5FA', lineHeight: 1.35 }}>
                      "{toastMessage.reason}"
                    </div>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              style={{ background: 'none', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', marginTop: '2px' }}
            >
              <X size={16} />
            </button>
          </div>
        </>
      )}

    </div>
  );
}
