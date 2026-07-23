import React, { useState, useEffect, useRef } from 'react';
import {
  Search, UserPlus, Download, Calendar, MoreHorizontal,
  TrendingUp, ChevronLeft, ChevronRight, X, Phone, MapPin, CreditCard, Wallet, DollarSign, Trash2, Users, Edit2, Lock,
  Printer, AlertTriangle, Eye, ArrowUpDown, ChevronDown, Check, Percent, QrCode, Landmark, ShieldCheck, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WhatsAppIcon from '../components/WhatsAppIcon';
import Pagination from '../components/Pagination';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID } from '../constants';
import CurrencySymbol from '../components/CurrencySymbol';
import { getLocalISOString, getLocalDateStr } from '../utils/dateUtils';
import styles from './Customers.module.css';
import { checkCreditLimit } from '../utils/creditLimit';
import InvoiceTemplate from '../components/InvoiceTemplate';

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
    { id: 'Cash', label: 'Cash Payment', icon: <Wallet size={16} color="#10B981" />, badgeBg: '#ECFDF5' },
    { id: 'Card', label: 'Card Payment', icon: <CreditCard size={16} color="#2563EB" />, badgeBg: '#EFF6FF' },
    { id: 'Bank', label: 'Bank Transfer', icon: <Landmark size={16} color="#4F46E5" />, badgeBg: '#EEF2FF' },
    { id: 'Nomod', label: 'Nomod Pay (Link)', icon: <ShieldCheck size={16} color="#059669" />, badgeBg: '#D1FAE5' },
    { id: 'Multipayment', label: 'Multipayment (Split)', icon: <Layers size={16} color="#F59E0B" />, badgeBg: '#FEF3C7' },
  ];

  const current = methods.find(m => m.id === value) || methods[0];

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

export default function Customers() {
  const navigate = useNavigate();
  const { settings, formatDate } = useSettings();
  const [customers, setCustomers] = useState([]);
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
  const [showEditCreditLimitModal, setShowEditCreditLimitModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editCreditLimitValue, setEditCreditLimitValue] = useState('0');
  const [managerPinValue, setManagerPinValue] = useState('');
  const [managerPinError, setManagerPinError] = useState('');
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [creditWarningDetails, setCreditWarningDetails] = useState(null);

  // ─── Customer Insight View States ──────────────────────────────────────────
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'insight'
  const [insightTab, setInsightTab] = useState('sales'); // 'sales', 'payments', 'returns'
  const [customerPayments, setCustomerPayments] = useState([]);
  const [customerDiscounts, setCustomerDiscounts] = useState([]);
  const [customerReturns, setCustomerReturns] = useState([]);
  const [selectedPaymentForAction, setSelectedPaymentForAction] = useState(null);
  const [showPaymentViewModal, setShowPaymentViewModal] = useState(false);
  const [showPaymentEditModal, setShowPaymentEditModal] = useState(false);
  const [showDiscountEditModal, setShowDiscountEditModal] = useState(false);
  const [selectedBillForDiscount, setSelectedBillForDiscount] = useState(null);
  const [editDiscountValue, setEditDiscountValue] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('Cash');
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentDiscount, setEditPaymentDiscount] = useState('');
  const [editOrderGrossTotal, setEditOrderGrossTotal] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinActionTarget, setPinActionTarget] = useState(null);
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

        await window.electronAPI.runDataHealer();
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
    const fixExistingData = async () => {
      try {
        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }
      } catch (e) {
        console.warn('Data healer skipped:', e);
      } finally {
        // Always fetch after healing attempt so UI shows corrected values
        fetchCustomers();
      }
    };
    fixExistingData();
  }, []); // runs only once on mount

  useEffect(() => {
    fetchCustomers();
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

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

  const fetchCustomers = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        let query = `
          SELECT c.*, 
                 IFNULL(SUM(CASE WHEN o.status NOT IN ('Cancelled', 'Deleted') THEN o.totalAmount ELSE 0 END), 0) as totalSales
          FROM customers c
          LEFT JOIN orders o ON c.id = o.customerId
        `;
        let params = [];
        let conditions = [];

        if (searchTerm) {
          conditions.push('(c.name LIKE ? OR c.id LIKE ? OR c.phone LIKE ?)');
          const param = `%${searchTerm}%`;
          params.push(param, param, param);
        }

        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }

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

        query += ` GROUP BY c.id ORDER BY ${orderByClause}`;

        const result = await window.electronAPI.dbQuery(query, params);
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
          await window.electronAPI.runDataHealer();
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

        // 0. Apply settlement discount to selected bill (or first pending bill) if discountAmt > 0
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

              const payId = await getNextRvNumber();
              const payRef = await window.electronAPI.getNextPaymentReference('PAY');
              await window.electronAPI.dbQuery(
                `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                [payId, selectedCustomer.id, bill.id, DEFAULT_SHOP_ID, paymentForThisBill, split.method, 'SUCCESS', timestamp, timestamp, payRef]
              );
            }
          }

          if (remainingPayment > 0) {
            const payId = await getNextRvNumber();
            const payRef = await window.electronAPI.getNextPaymentReference('ADV');
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
              [payId, selectedCustomer.id, null, DEFAULT_SHOP_ID, remainingPayment, split.method, 'SUCCESS', timestamp, timestamp, payRef]
            );
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
          [totalPaid, timestamp, selectedCustomer.id]
        );

        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }

        setShowPaymentModal(false);
        setPaymentData({ amount: '', method: 'Cash' });
        setSelectedBillForPayment(null);
        await fetchCustomers();

        if (viewMode === 'insight' && selectedCustomer) {
          const freshCustRes = await window.electronAPI.dbQuery(
            "SELECT c.*, IFNULL(SUM(CASE WHEN o.status != 'Cancelled' THEN o.totalAmount ELSE 0 END), 0) as totalSales FROM customers c LEFT JOIN orders o ON c.id = o.customerId WHERE c.id = ? GROUP BY c.id",
            [selectedCustomer.id]
          );
          if (freshCustRes.success && freshCustRes.data.length > 0) {
            await handleViewCustomerInsight(freshCustRes.data[0]);
          }
        }

        setTimeout(() => {
          alert(`Settlement complete! Remaining unallocated: ${totalRemaining.toFixed(2)}`);
        }, 300);
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

        if (!window.confirm("Are you sure you want to delete this customer?")) return;

        await window.electronAPI.dbQuery('DELETE FROM customers WHERE id = ?', [id]);
        fetchCustomers();
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

  const formatPaymentId = (pay) => {
    if (!pay || (!pay.id && !pay.paymentReference)) return '';
    if (pay.paymentReference) return pay.paymentReference;
    if (pay.id && pay.id.startsWith('RV-')) return pay.id;
    if (pay.orderId) return `PAY-${pay.orderId}`;

    if (!pay.id) return '';
    const parts = pay.id.split('-');
    const lastPart = parts[parts.length - 1];

    // Find a numeric suffix or fallback to a short part
    let suffix = lastPart;
    if (['Cash', 'Card', 'UPI', 'Bank', 'Multipayment', 'Discount'].includes(lastPart) && parts.length > 2) {
      suffix = parts[parts.length - 2];
    }

    if (suffix.length > 6) {
      suffix = suffix.substring(suffix.length - 4);
    }

    if (parts.includes('ADV')) {
      return `ADV-${suffix}`;
    }
    if (parts.includes('AUTO')) {
      return `AUTO-${suffix}`;
    }
    if (parts.includes('QUIC')) {
      return `QUIC-${suffix}`;
    }

    return pay.id.length > 12 ? pay.id.substring(0, 6) + '...' + pay.id.substring(pay.id.length - 4) : pay.id;
  };

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

    if (pinActionTarget === 'delete_payment' && selectedPaymentForAction) {
      handleDeletePaymentRecord(selectedPaymentForAction.id);
    } else if (pinActionTarget === 'edit_payment' && selectedPaymentForAction) {
      let existingDisc = 0;
      let gross = 0;
      if (selectedPaymentForAction.orderId && window.electronAPI?.dbQuery) {
        window.electronAPI.dbQuery("SELECT * FROM orders WHERE id = ?", [selectedPaymentForAction.orderId]).then(res => {
          if (res.success && res.data.length > 0) {
            const ord = res.data[0];
            try {
              if (ord.paymentBreakdown) {
                const bd = typeof ord.paymentBreakdown === 'string' ? JSON.parse(ord.paymentBreakdown) : ord.paymentBreakdown;
                existingDisc = parseFloat(bd.discount || bd.discountAmount || 0) || 0;
              }
            } catch (e) { }
            if (existingDisc === 0 && ord.items) {
              try {
                const itemsArr = typeof ord.items === 'string' ? JSON.parse(ord.items) : ord.items;
                if (Array.isArray(itemsArr) && itemsArr.length > 0) {
                  const itemsTotal = itemsArr.reduce((s, i) => s + ((parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0)), 0);
                  const taxRate = settings.isTaxEnabled ? ((settings.taxRate || 0) / 100) : 0;
                  const grossWithTax = settings.taxMethod === 'exclusive' ? (itemsTotal * (1 + taxRate)) : itemsTotal;
                  const diff = grossWithTax - (ord.totalAmount || 0);
                  if (diff > 0.05) existingDisc = parseFloat(diff.toFixed(2));
                }
              } catch (e) { }
            }
            gross = (ord.totalAmount || 0) + existingDisc;
          }
          setEditOrderGrossTotal(gross);
          setEditPaymentDiscount(existingDisc ? existingDisc.toString() : '0');
          setShowPaymentEditModal(true);
        });
      } else {
        setEditOrderGrossTotal(0);
        setEditPaymentDiscount('0');
        setShowPaymentEditModal(true);
      }
    }
  };

  const handleViewPaymentDetails = (pay) => {
    if (!pay) return;
    setSelectedPaymentForAction(pay);
    setShowPaymentViewModal(true);
  };

  const handleDeletePaymentRecord = async (paymentId) => {
    const payment = customerPayments.find(p => p.id === paymentId);
    if (!payment) return;
    if (!window.confirm("Are you sure you want to delete this payment? The customer balance will increase.")) return;

    setLoading(true);
    const timestamp = getLocalISOString();
    const idsToDelete = payment.paymentIds && payment.paymentIds.length > 0 ? payment.paymentIds : [payment.id];
    const totalAmount = payment.amount || 0;

    try {
      await window.electronAPI.dbQuery("BEGIN TRANSACTION");

      if (payment.orderId) {
        const orderRes = await window.electronAPI.dbQuery("SELECT * FROM orders WHERE id = ?", [payment.orderId]);
        if (orderRes.success && orderRes.data.length > 0) {
          const bill = orderRes.data[0];
          const newPaidAmount = Math.max(0, (bill.paidAmount || 0) - totalAmount);
          const newDueAmount = (bill.dueAmount || 0) + totalAmount;
          const newStatus = newPaidAmount <= 0 ? 'Credit' : 'Partial';

          let paymentBreakdown = {};
          try {
            if (bill.paymentBreakdown) {
              paymentBreakdown = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
            }
          } catch (e) { }

          // Fetch methods and amounts of individual payments we are deleting to subtract correctly from paymentBreakdown
          const pToDelRes = await window.electronAPI.dbQuery(
            `SELECT amount, method FROM payments WHERE id IN (${idsToDelete.map(() => '?').join(',')})`,
            idsToDelete
          );
          const paymentsToDelete = pToDelRes.success ? pToDelRes.data : [];

          paymentsToDelete.forEach(pDel => {
            const methodKey = pDel.method.toLowerCase();
            if (paymentBreakdown[methodKey] !== undefined) {
              paymentBreakdown[methodKey] = Math.max(0, (paymentBreakdown[methodKey] || 0) - pDel.amount);
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
            [newPaidAmount, newDueAmount, newStatus, finalMethodName, JSON.stringify(paymentBreakdown), timestamp, payment.orderId]
          );
        }
      }

      await window.electronAPI.dbQuery(
        "UPDATE customers SET balance = balance + ?, isSynced = 0, updatedAt = ? WHERE id = ?",
        [totalAmount, timestamp, selectedCustomer.id]
      );

      // Fetch the individual payments to delete their matching transactions
      const pToDelRes = await window.electronAPI.dbQuery(
        `SELECT amount, method FROM payments WHERE id IN (${idsToDelete.map(() => '?').join(',')})`,
        idsToDelete
      );
      const paymentsToDelete = pToDelRes.success ? pToDelRes.data : [];

      // Delete all the advance allocations and payment records
      for (const id of idsToDelete) {
        await window.electronAPI.dbQuery("DELETE FROM advance_allocations WHERE paymentId = ?", [id]);
        await window.electronAPI.dbQuery("DELETE FROM payments WHERE id = ?", [id]);
      }

      // Delete matching account transactions for each deleted payment amount
      const payDate = new Date(payment.createdAt);
      const datePrefix = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}-${String(payDate.getDate()).padStart(2, '0')} ${String(payDate.getHours()).padStart(2, '0')}:${String(payDate.getMinutes()).padStart(2, '0')}`;

      for (const pDel of paymentsToDelete) {
        const txnRes = await window.electronAPI.dbQuery(
          "SELECT id FROM account_transactions WHERE amount = ? AND (description LIKE ? OR date LIKE ?) LIMIT 1",
          [pDel.amount, `%${selectedCustomer.name}%`, `${datePrefix.substring(0, 10)}%`]
        );
        if (txnRes.success && txnRes.data.length > 0) {
          await window.electronAPI.dbQuery("DELETE FROM account_transactions WHERE id = ?", [txnRes.data[0].id]);
        }
      }

      await window.electronAPI.dbQuery("COMMIT");

      const updatedCustomerRes = await window.electronAPI.dbQuery("SELECT * FROM customers WHERE id = ?", [selectedCustomer.id]);
      if (updatedCustomerRes.success && updatedCustomerRes.data.length > 0) {
        setSelectedCustomer(updatedCustomerRes.data[0]);
        await handleViewCustomerInsight(updatedCustomerRes.data[0]);
      }
      fetchCustomers();
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
    const oldMethod = payment.method;
    const newMethod = editPaymentMethod;
    const oldAmount = parseFloat(payment.amount) || 0;
    const newAmount = parseFloat(editPaymentAmount) || 0;
    const newDisc = parseFloat(editPaymentDiscount) || 0;

    if (newAmount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    setLoading(true);
    const timestamp = getLocalISOString();
    const diff = newAmount - oldAmount;

    try {
      await window.electronAPI.dbQuery("BEGIN TRANSACTION");

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
          let oldDisc = 0;
          try {
            if (order.paymentBreakdown) {
              paymentBreakdown = typeof order.paymentBreakdown === 'string' ? JSON.parse(order.paymentBreakdown) : order.paymentBreakdown;
              oldDisc = parseFloat(paymentBreakdown.discount || paymentBreakdown.discountAmount || 0) || 0;
            }
          } catch (e) { }

          const oldKey = oldMethod.toLowerCase();
          const newKey = newMethod.toLowerCase();

          if (paymentBreakdown[oldKey] !== undefined) {
            paymentBreakdown[oldKey] = Math.max(0, (paymentBreakdown[oldKey] || 0) - oldAmount);
          }
          paymentBreakdown[newKey] = (paymentBreakdown[newKey] || 0) + newAmount;
          paymentBreakdown.discount = newDisc;

          const grossTotal = (order.totalAmount || 0) + oldDisc;
          const newNetTotal = Math.max(0, grossTotal - newDisc);

          let activeMethods = Object.keys(paymentBreakdown).filter(k => k !== 'discount' && k !== 'advance' && paymentBreakdown[k] > 0);
          const keyMap = { cash: 'Cash', card: 'Card', upi: 'UPI', bank: 'Bank Transfer' };
          let finalMethodName = 'Multipayment';
          if (activeMethods.length === 1) {
            finalMethodName = keyMap[activeMethods[0]] || 'Cash';
          }

          const newPaidAmount = (order.paidAmount || 0) + diff;
          const newDueAmount = Math.max(0, newNetTotal - newPaidAmount);

          let newPaymentStatus = 'Partial';
          if (newDueAmount <= 0) {
            newPaymentStatus = 'Paid';
          } else if (newPaidAmount <= 0) {
            newPaymentStatus = 'Credit';
          }

          await window.electronAPI.dbQuery(
            "UPDATE orders SET totalAmount = ?, dueAmount = ?, paymentStatus = ?, paymentMethod = ?, paymentBreakdown = ?, isSynced = 0, updatedAt = ? WHERE id = ?",
            [newNetTotal, newPaidAmount, newDueAmount, newPaymentStatus, finalMethodName, JSON.stringify(paymentBreakdown), timestamp, payment.orderId]
          );
        }
      }

      // 4. Update account_transactions table
      const payDate = new Date(payment.createdAt);
      const datePrefix = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}-${String(payDate.getDate()).padStart(2, '0')} ${String(payDate.getHours()).padStart(2, '0')}:${String(payDate.getMinutes()).padStart(2, '0')}`;

      const txnRes = await window.electronAPI.dbQuery(
        "SELECT id FROM account_transactions WHERE amount = ? AND (description LIKE ? OR date LIKE ?) LIMIT 1",
        [oldAmount, `%${selectedCustomer.name}%`, `${datePrefix.substring(0, 10)}%`]
      );

      if (txnRes.success && txnRes.data.length > 0) {
        const txnId = txnRes.data[0].id;
        const newAccountType = (newMethod === 'Bank' || newMethod === 'Card' || newMethod === 'UPI') ? 'BANK' : 'CASH';
        const mappedBankId = newMethod === 'Card'
          ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
          : (newMethod === 'UPI'
            ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
            : (newMethod === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null));

        await window.electronAPI.dbQuery(
          "UPDATE account_transactions SET amount = ?, accountType = ?, description = ?, bankAccountId = ?, isSynced = 0, updatedAt = ? WHERE id = ?",
          [newAmount, newAccountType, `Settlement from ${selectedCustomer.name} (${newMethod})`, mappedBankId, timestamp, txnId]
        );
      }

      await window.electronAPI.dbQuery("COMMIT");

      if (window.electronAPI?.runDataHealer) {
        await window.electronAPI.runDataHealer();
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
      const bill = selectedBillForDiscount;

      let oldDisc = 0;
      let breakdownObj = {};
      try {
        if (bill.paymentBreakdown) {
          breakdownObj = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
          oldDisc = parseFloat(breakdownObj.discount || breakdownObj.discountAmount || 0) || 0;
        }
      } catch (e) { }

      const grossTotal = (bill.totalAmount || 0) + oldDisc;
      const newNetTotal = Math.max(0, grossTotal - newDisc);
      const newDue = Math.max(0, newNetTotal - (bill.paidAmount || 0));
      const newPayStatus = newDue <= 0 ? 'Paid' : ((bill.paidAmount || 0) > 0 ? 'Partial' : 'Credit');

      breakdownObj.discount = newDisc;
      const newBreakdownStr = JSON.stringify(breakdownObj);

      await window.electronAPI.dbQuery(
        `UPDATE orders SET totalAmount = ?, dueAmount = ?, paymentStatus = ?, paymentBreakdown = ?, isSynced = 0, updatedAt = ? WHERE id = ?`,
        [newNetTotal, newDue, newPayStatus, newBreakdownStr, timestamp, bill.id]
      );

      if (window.electronAPI?.runDataHealer) {
        await window.electronAPI.runDataHealer();
      }

      setShowDiscountEditModal(false);
      setSelectedBillForDiscount(null);

      const freshCustRes = await window.electronAPI.dbQuery(
        "SELECT c.*, IFNULL(SUM(CASE WHEN o.status != 'Cancelled' THEN o.totalAmount ELSE 0 END), 0) as totalSales FROM customers c LEFT JOIN orders o ON c.id = o.customerId WHERE c.id = ? GROUP BY c.id",
        [selectedCustomer.id]
      );
      if (freshCustRes.success && freshCustRes.data.length > 0) {
        await handleViewCustomerInsight(freshCustRes.data[0]);
      }
      fetchCustomers();
      alert("Discount updated successfully!");
    } catch (err) {
      console.error("Save discount edit error:", err);
      alert("Failed to update discount.");
    } finally {
      setLoading(false);
    }
  };


  const handleViewCustomerInsight = async (customer) => {
    setLoading(true);
    if (window.electronAPI?.dbQuery) {
      try {
        const freshCustRes = await window.electronAPI.dbQuery(
          "SELECT * FROM customers WHERE id = ?",
          [customer.id]
        );
        const activeCustomer = freshCustRes.success && freshCustRes.data.length > 0 ? freshCustRes.data[0] : customer;
        setSelectedCustomer(activeCustomer);

        const result = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' ORDER BY createdAt DESC",
          [activeCustomer.id]
        );
        let bills = result.success ? result.data : [];
        setCustomerBills(bills.filter(b => b.status !== 'Cancelled' && b.status !== 'Deleted'));

        const deletedRes = await window.electronAPI.dbQuery(
          "SELECT * FROM deleted_orders WHERE customerId = ? ORDER BY deletedAt DESC",
          [activeCustomer.id]
        );
        let deletedBills = deletedRes.success ? deletedRes.data : [];

        const combinedReturns = [
          ...bills.filter(b => b.status === 'Cancelled' || b.status === 'Deleted').map(b => ({
            ...b,
            isDeleted: b.status === 'Deleted',
            refundStatus: b.status === 'Deleted' ? (b.deletedAction || 'Deleted') : 'Cancelled'
          })),
          ...deletedBills.filter(db => !bills.some(b => b.id === db.id)).map(db => ({
            ...db,
            createdAt: db.deletedAt,
            isDeleted: true
          }))
        ];
        combinedReturns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setCustomerReturns(combinedReturns);

        const paymentsRes = await window.electronAPI.dbQuery(
          "SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt DESC",
          [activeCustomer.id]
        );
        let payments = paymentsRes.success ? paymentsRes.data : [];
        const discountPayments = payments.filter(p => p.method === 'Discount');
        setCustomerDiscounts(discountPayments);
        // Filter out automatic system transactions and discounts
        payments = payments.filter(p => p.method !== 'System Auto' && p.method !== 'Discount');

        // Group payments that are part of the same transaction event
        const groupedMap = {};
        payments.forEach(p => {
          let key;
          if (p.orderId) {
            // Group by orderId and the timestamp normalized to the minute to handle minor loop differences
            const timePart = p.createdAt ? p.createdAt.substring(0, 16) : '';
            key = `order_${p.orderId}_${timePart}`;
          } else {
            // Group by exact timestamp for manual/advance payments
            key = `manual_${p.createdAt}`;
          }

          if (!groupedMap[key]) {
            groupedMap[key] = {
              ...p,
              methodsList: [p.method],
              totalAmount: p.amount || 0,
              paymentIds: [p.id]
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
            amount: p.totalAmount
          };
        });

        // Sort by createdAt DESC to keep order correct
        processedPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setCustomerPayments(processedPayments);

        const totalSales = bills.filter(b => b.status !== 'Cancelled').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const salesReturn = bills.filter(b => b.status === 'Cancelled').reduce((sum, b) => sum + (b.totalAmount || 0), 0) +
          deletedBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        const getDiscountVal = (bill) => {
          if (!bill) return 0;
          if (typeof bill.discount === 'number' && bill.discount > 0) return bill.discount;
          if (typeof bill.discountAmount === 'number' && bill.discountAmount > 0) return bill.discountAmount;
          if (bill.paymentBreakdown) {
            try {
              const bd = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
              if (bd) {
                const val = parseFloat(bd.discount || bd.discountAmount || bd.discount_amount || bd.discountValue || 0);
                if (!isNaN(val) && val > 0) return val;
              }
            } catch (e) { }
          }
          const payDisc = discountPayments.filter(p => p.orderId === bill.id).reduce((sum, p) => sum + (p.amount || 0), 0);
          if (payDisc > 0) return payDisc;
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

        const generalDiscountSum = discountPayments.filter(p => !p.orderId).reduce((sum, p) => sum + (p.amount || 0), 0);
        let totalDiscount = generalDiscountSum;
        bills.forEach(bill => {
          totalDiscount += getDiscountVal(bill);
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

        // Build debits from all orders
        let runningBalance = 0;

        // Opening balance (debit)
        const systemAutoOffset = allPaymentsRaw
          .filter(p => p.method === 'System Auto' && !p.orderId)
          .reduce((s, p) => s + (p.amount || 0), 0);
        const openingBal = (activeCustomer.openingBalance || 0) + Math.abs(systemAutoOffset);
        runningBalance += openingBal;

        // Active orders: add totalAmount as debit (charges to customer)
        // Deleted orders: add totalAmount as debit then subtract totalAmount as credit (nets to 0)
        // Refunded deleted orders: also debit back the paidAmount (cash went out)
        // Subtract any payments linked to active/deleted orders as credit (except Refund/Advance/System Auto)
        bills.forEach(b => {
          if (b.status === 'Cancelled') return; // cancelled orders don't affect balance
          runningBalance += (b.totalAmount || 0); // order debit
          if (b.status === 'Deleted') {
            runningBalance -= (b.totalAmount || 0); // deletion reversal credit
            // If refunded: cash went out, so debit the refund back
            if ((b.deletedAction === 'refund' || b.deletedAction === 'Refund') && (b.paidAmount || 0) > 0) {
              runningBalance += (b.paidAmount || 0);
            }

            // Parse payments associated with deleted orders
            let parsedPays = [];
            try {
              parsedPays = typeof b.payments === 'string' ? JSON.parse(b.payments || '[]') : (b.payments || []);
            } catch (e) {
              parsedPays = [];
            }
            const validPays = parsedPays.filter(p => p.method !== 'Refund Advance' && p.method !== 'Advance' && p.method !== 'System Auto');
            const deletedPaySum = validPays.reduce((sum, p) => sum + (p.method === 'Discount' ? 0 : (p.amount || 0)), 0);
            const initialDeletedPay = (b.paidAmount || 0) - deletedPaySum;

            validPays.forEach(p => {
              if (p.method !== 'Discount') {
                runningBalance -= (p.amount || 0); // payment credit
              }
            });
            if (initialDeletedPay > 0.01 && validPays.length === 0) {
              if (b.paymentMethod !== 'Advance' && b.paymentMethod !== 'Refund Advance' && b.paymentMethod !== 'System Auto') {
                runningBalance -= initialDeletedPay; // payment fallback credit
              }
            }
          }
        });

        // Also account for deleted_orders that only exist in deleted_orders table (not in orders)
        deletedBills.filter(db => !bills.some(b => b.id === db.id)).forEach(db => {
          runningBalance += (db.totalAmount || 0); // original charge
          runningBalance -= (db.totalAmount || 0); // reversal credit
          if (db.refundStatus === 'Returned' && (db.paidAmount || 0) > 0) {
            runningBalance += (db.paidAmount || 0); // refund went out
          }

          // Parse payments associated with deleted orders
          let parsedPays = [];
          try {
            parsedPays = typeof db.payments === 'string' ? JSON.parse(db.payments || '[]') : (db.payments || []);
          } catch (e) {
            parsedPays = [];
          }
          const validPays = parsedPays.filter(p => p.method !== 'Refund Advance' && p.method !== 'Advance' && p.method !== 'System Auto');
          const deletedPaySum = validPays.reduce((sum, p) => sum + (p.method === 'Discount' ? 0 : (p.amount || 0)), 0);
          const initialDeletedPay = (db.paidAmount || 0) - deletedPaySum;

          validPays.forEach(p => {
            if (p.method !== 'Discount') {
              runningBalance -= (p.amount || 0); // payment credit
            }
          });
          if (initialDeletedPay > 0.01 && validPays.length === 0) {
            if (db.paymentMethod !== 'Advance' && db.paymentMethod !== 'Refund Advance' && db.paymentMethod !== 'System Auto') {
              runningBalance -= initialDeletedPay; // payment fallback credit
            }
          }
        });

        // All payments: subtract as credits (money received from customer)
        allPaymentsRaw.forEach(p => {
          if (p.method === 'Refund Advance' || p.method === 'Advance' || p.method === 'System Auto') return;
          runningBalance -= (p.amount || 0); // payment credit (reduces balance)
        });

        // Final values — mirror CustomerStatement KPIs exactly
        const pendingDue = Math.max(0, runningBalance);
        const availableAdvance = runningBalance < 0 ? Math.abs(runningBalance) : 0;

        // totalAdvanceReceived: unlinked payments (for display in Advance Details section)
        const totalAdvanceReceived = allPaymentsRaw
          .filter(p => (!p.orderId || p.orderId === '') && p.method !== 'System Auto' && p.method !== 'Discount' && p.method !== 'Refund Advance')
          .reduce((s, p) => s + (p.amount || 0), 0);
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
        setViewMode('insight');
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

  const confirmRefund = async () => {
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
          await window.electronAPI.runDataHealer();
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

  const paginatedCustomers = React.useMemo(() => {
    return customers.slice((currentPage - 1) * 20, currentPage * 20);
  }, [customers, currentPage]);


  if (viewMode === 'insight' && selectedCustomer) {
    return (
      <div className={styles.customersPage} style={{ padding: '1rem', background: '#F8FAFC', minHeight: '100vh' }}>
        {/* Insight Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Customer Insight</span>
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
                <span style={{ color: '#64748B', fontWeight: 600 }}>
                  {selectedCustomerStats.pendingDue > 0 ? 'Pending Due' : selectedCustomerStats.availableAdvance > 0 ? 'Advance Balance' : 'Pending Due'}
                </span>
                <span style={{
                  fontWeight: 800,
                  color: selectedCustomerStats.pendingDue > 0 ? 'var(--danger)' : selectedCustomerStats.availableAdvance > 0 ? 'var(--secondary)' : '#64748B'
                }}>
                  {selectedCustomerStats.pendingDue > 0
                    ? (selectedCustomerStats.pendingDue || 0).toFixed(2) + ' Due'
                    : selectedCustomerStats.availableAdvance > 0
                      ? (selectedCustomerStats.availableAdvance || 0).toFixed(2) + ' Adv'
                      : '0.00'}
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
                <span style={{ color: '#64748B', fontWeight: 600 }}>Total Advance Received</span>
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
                        <td style={{ fontWeight: 600 }}>{pay.method}</td>
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
                            {pay.method !== 'Multipayment' && (
                              <button
                                style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  setSelectedPaymentForAction(pay);
                                  setEditPaymentMethod(pay.method || 'Cash');
                                  setEditPaymentAmount(pay.amount ? pay.amount.toString() : '');
                                  setPinActionTarget('edit_payment');
                                  setShowPinModal(true);
                                }}
                                title="Edit Payment"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              onClick={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                setSelectedPaymentForAction(pay);
                                setPinActionTarget('delete_payment');
                                setShowPinModal(true);
                              }}
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
                      <th style={{ background: '#F8FAFC' }}># Order</th>
                      <th style={{ background: '#F8FAFC' }}>Date</th>
                      <th style={{ background: '#F8FAFC' }}>Order Total</th>
                      <th style={{ background: '#F8FAFC' }}>Discount Given</th>
                      <th style={{ background: '#F8FAFC' }}>Net Payable</th>
                      <th style={{ background: '#F8FAFC' }}>Pay Status</th>
                      <th style={{ background: '#F8FAFC', width: '100px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const getDiscountVal = (bill) => {
                        if (!bill) return 0;
                        if (typeof bill.discount === 'number' && bill.discount > 0) return bill.discount;
                        if (typeof bill.discountAmount === 'number' && bill.discountAmount > 0) return bill.discountAmount;
                        if (bill.paymentBreakdown) {
                          try {
                            const bd = typeof bill.paymentBreakdown === 'string' ? JSON.parse(bill.paymentBreakdown) : bill.paymentBreakdown;
                            if (bd) {
                              const val = parseFloat(bd.discount || bd.discountAmount || bd.discount_amount || bd.discountValue || 0);
                              if (!isNaN(val) && val > 0) return val;
                            }
                          } catch (e) { }
                        }
                        const payDisc = customerDiscounts.filter(p => p.orderId === bill.id).reduce((sum, p) => sum + (p.amount || 0), 0);
                        if (payDisc > 0) return payDisc;
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

                      const generalDiscounts = customerDiscounts.filter(p => !p.orderId).map(p => ({
                        id: p.id,
                        date: p.createdAt,
                        type: 'general',
                        orderTotal: null,
                        discount: p.amount,
                        netPayable: null,
                        status: 'SUCCESS',
                        payment: p
                      }));

                      const allDiscounts = [...discountedBills, ...generalDiscounts].sort((a, b) => new Date(b.date) - new Date(a.date));

                      if (allDiscounts.length === 0) {
                        return (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
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
                              <td>
                                <span style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: (bill.dueAmount || 0) <= 0 ? '#DCFCE7' : '#FEF3C7',
                                  color: (bill.dueAmount || 0) <= 0 ? '#15803D' : '#D97706'
                                }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                    onClick={() => {
                                      let parsedItems = [];
                                      try {
                                        if (bill.items && bill.items !== 'null') {
                                          parsedItems = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
                                        }
                                      } catch (e) { }
                                      let parsedBreakdown = null;
                                      try {
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
                                      setShowDiscountEditModal(true);
                                    }}
                                    title="Edit Discount"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        } else {
                          const p = item.payment;
                          return (
                            <tr key={p.id}>
                              <td style={{ color: '#64748B', fontStyle: 'italic' }}>General Account</td>
                              <td>{formatDate(p.createdAt)}</td>
                              <td>N/A</td>
                              <td style={{ fontWeight: 800, color: 'var(--danger)' }}>
                                <CurrencySymbol size={13} /> {item.discount.toFixed(2)}
                              </td>
                              <td>N/A</td>
                              <td>
                                <span style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: '#DCFCE7',
                                  color: '#15803D'
                                }}>
                                  APPLIED
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }} colSpan="2">
                                Settlement Adjustment
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
                  <h2 style={{ color: '#0F172A' }}>Settle Customer Invoice</h2>
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
                        Due for this invoice: <strong><CurrencySymbol size={14} /> {selectedBillForPayment ? selectedBillForPayment.dueAmount.toFixed(2) : selectedCustomer.balance.toFixed(2)}</strong>
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
          <div className={styles.modalOverlay} onClick={() => setSelectedInvoiceForView(null)} style={{ zIndex: 10000 }}>
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
          <div className={styles.modalOverlay} onClick={() => setShowPaymentViewModal(false)}>
            <div className={styles.modal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ color: '#0F172A' }}>Payment Details</h2>
                  <p>Receipt ID: {selectedPaymentForAction.paymentReference || selectedPaymentForAction.id}</p>
                </div>
                <X size={24} className={styles.closeBtn} onClick={() => setShowPaymentViewModal(false)} />
              </div>
              <div className={styles.modalContent} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Amount</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}><CurrencySymbol size={14} /> {(parseFloat(selectedPaymentForAction.amount) || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Method</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{selectedPaymentForAction.method}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Date</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{formatDate(selectedPaymentForAction.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Linked Order</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{selectedPaymentForAction.orderId || 'Settlement (Advance)'}</span>
                  </div>
                </div>
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
          <div className={styles.modalOverlay} onClick={() => setShowPaymentEditModal(false)}>
            <div className={styles.modal} style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ color: '#0F172A', fontSize: '1.15rem' }}>Edit Payment</h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748B' }}>
                    Receipt: {selectedPaymentForAction.paymentReference || selectedPaymentForAction.id}
                  </p>
                </div>
                <X size={22} className={styles.closeBtn} onClick={() => setShowPaymentEditModal(false)} />
              </div>
              <div className={styles.modalContent} style={{ padding: '1.25rem 1.5rem' }}>
                <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Payment Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPaymentAmount}
                    onChange={(e) => setEditPaymentAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem', fontWeight: 700 }}
                  />
                </div>
                <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem', display: 'block' }}>Payment Method</label>
                  <PaymentMethodSelect
                    value={editPaymentMethod}
                    onChange={(method) => setEditPaymentMethod(method)}
                    settings={settings}
                  />
                </div>
                {selectedPaymentForAction.orderId && (
                  <div className={styles.formGroup}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Discount Amount (Order #{settings.invoicePrefix || ''}{selectedPaymentForAction.orderId})</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editPaymentDiscount}
                      onChange={(e) => {
                        const newDiscStr = e.target.value;
                        setEditPaymentDiscount(newDiscStr);
                        const newDisc = parseFloat(newDiscStr) || 0;
                        if (editOrderGrossTotal > 0) {
                          const newNetPayable = Math.max(0, editOrderGrossTotal - newDisc);
                          setEditPaymentAmount(newNetPayable.toFixed(2));
                        }
                      }}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem', fontWeight: 700, color: 'var(--danger)' }}
                    />
                  </div>
                )}
              </div>
              <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  style={{ padding: '0.5rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setShowPaymentEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={handleSavePaymentEdit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Discount Modal */}
        {showDiscountEditModal && selectedBillForDiscount && (
          <div className={styles.modalOverlay} onClick={() => setShowDiscountEditModal(false)}>
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
          <div className={styles.modalOverlay} onClick={() => setShowPinModal(false)}>
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
          <div className={styles.modalOverlay} onClick={() => { setShowEditCreditLimitModal(false); }}>
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
          <div className={styles.modalOverlay} onClick={() => { setShowRefundModal(false); setOrderToRefund(null); }}>
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
      </div>
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
                      title="View Details"
                    >
                      <Eye size={18} />
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
            totalPages={Math.ceil(customers.length / 20)}
            onPageChange={setCurrentPage}
            totalItems={customers.length}
            pageSize={20}
            itemLabel="customers"
          />
        )}
      </div>


      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => { setShowModal(false); setEditingCustomer(null); }}>
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
                  <label>Opening Balance <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748B' }}>(e.g. -500 for Advance, 500 for Due)</span></label>
                  <div className={styles.inputWrapper}>
                    <DollarSign size={18} />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00 (- for Advance, + for Due)"
                      value={formData.openingBalance}
                      onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
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
        <div className={styles.modalOverlay} onClick={() => setShowBillsModal(false)}>
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
                <h2 style={{ color: '#0F172A' }}>Settle Customer Invoice</h2>
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
        <div className={styles.modalOverlay} onClick={() => { setShowQuickSettleModal(false); setQuickSettleSearch(''); }}>
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
        <div className={styles.modalOverlay} onClick={() => { setShowEditCreditLimitModal(false); }}>
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
        <div className={styles.modalOverlay} onClick={handleCancelOverride}>
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
        <div className={styles.modalOverlay} onClick={() => setShowPaymentViewModal(false)}>
          <div className={styles.modal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A' }}>Payment Details</h2>
                <p>Receipt ID: {selectedPaymentForAction.paymentReference || selectedPaymentForAction.id}</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowPaymentViewModal(false)} />
            </div>
            <div className={styles.modalContent} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Amount</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}><CurrencySymbol size={14} /> {(parseFloat(selectedPaymentForAction.amount) || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Method</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{selectedPaymentForAction.method}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Date</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{formatDate(selectedPaymentForAction.createdAt)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Linked Order</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{selectedPaymentForAction.orderId || 'Settlement (Advance)'}</span>
                </div>
              </div>
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
        <div className={styles.modalOverlay} onClick={() => setShowPaymentEditModal(false)}>
          <div className={styles.modal} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A' }}>Edit Payment</h2>
                <p>Change payment details</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowPaymentEditModal(false)} />
            </div>
            <div className={styles.modalContent} style={{ padding: '1.5rem' }}>
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
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem' }}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>
            </div>
            <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                style={{ padding: '0.5rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setShowPaymentEditModal(false)}
              >
                Cancel
              </button>
              <button
                style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                onClick={handleSavePaymentEdit}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Action Secure PIN Modal */}
      {showPinModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPinModal(false)}>
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
        <div className={styles.modalOverlay} onClick={() => setSelectedInvoiceForView(null)} style={{ zIndex: 10000 }}>
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

    </div>
  );
}
