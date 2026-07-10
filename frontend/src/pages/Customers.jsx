import React, { useState, useEffect } from 'react';
import { 
  Search, UserPlus, Download, Calendar, MoreHorizontal, 
  TrendingUp, ChevronLeft, ChevronRight, X, Phone, MapPin, CreditCard, Wallet, DollarSign, Trash2, Users, Edit2, Lock,
  Printer, AlertTriangle, Eye
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
  const [paymentData, setPaymentData] = useState({ amount: '', method: 'Cash' });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
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
  const [customerReturns, setCustomerReturns] = useState([]);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState(null);
  const [selectedCustomerStats, setSelectedCustomerStats] = useState({
    totalSales: 0,
    pendingDue: 0,
    salesReturn: 0,
    totalDiscount: 0
  });


  useEffect(() => {
    fetchCustomers();
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setShowBillsModal(false);
        setShowPaymentModal(false);
        setShowQuickSettleModal(false);
        setShowEditCreditLimitModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const isAnyOpen = showModal || showBillsModal || showPaymentModal || showQuickSettleModal || showEditCreditLimitModal;
    if (isAnyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal, showBillsModal, showPaymentModal, showQuickSettleModal, showEditCreditLimitModal]);

  const fetchCustomers = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        let query = `
          SELECT c.*, 
                 IFNULL(SUM(CASE WHEN o.status != 'Cancelled' THEN o.totalAmount ELSE 0 END), 0) as totalSales
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
        
        query += ' GROUP BY c.id ORDER BY CAST(SUBSTR(c.id, 6) AS INTEGER) ASC';
        
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

    if (window.electronAPI?.dbQuery) {
      try {
        if (editingCustomer) {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET name = ?, phone = ?, address = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [formData.name, formData.phone, formData.address, timestamp, editingCustomer.id]
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
          const id = `CUST-${nextNum}`;

          await window.electronAPI.dbQuery(
            'INSERT INTO customers (id, shopId, name, phone, email, address, creditLimit, isSynced, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, DEFAULT_SHOP_ID, formData.name, formData.phone, '', formData.address, 0, 0, timestamp]
          );
          alert('Customer created successfully!');
        }
        fetchCustomers();
        setShowModal(false);
        setEditingCustomer(null);
        setFormData({ name: '', phone: '', address: '' });
      } catch (err) {
        console.error("Failed to save customer:", err);
      }
    } else {
      // Web demo
      if (editingCustomer) {
        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...formData } : c));
      } else {
        const id = `CUST-${customers.length + 1}`;
        setCustomers([{ ...formData, id, orders: 0, lastDate: 'Just now', tag: 'New', balance: 0, creditLimit: 0 }, ...customers]);
      }
      setShowModal(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', address: '' });
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
        let remainingPayment = parseFloat(paymentData.amount);
        const totalPaid = remainingPayment;
        const timestamp = getLocalISOString();

        console.log(`Starting settlement for ${selectedCustomer.name}. Amount: ${totalPaid}`);

        // 1. Fetch oldest unpaid/partial bills first (FIFO)
        const billsRes = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND (dueAmount > 0 OR paymentStatus = 'Credit' OR paymentStatus = 'Partial') ORDER BY createdAt ASC",
          [selectedCustomer.id]
        );

        let billsToProcess = [];
        if (billsRes.success && billsRes.data.length > 0) {
          billsToProcess = billsRes.data;
        }

        if (selectedBillForPayment) {
          billsToProcess = billsToProcess.filter(b => b.id !== selectedBillForPayment.id);
          // fetch the latest state of the selected bill just in case
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

            // Handle legacy data where dueAmount might be 0 but status is Credit
            const currentDue = bill.dueAmount > 0 ? bill.dueAmount : (bill.totalAmount - (bill.paidAmount || 0));
            if (currentDue <= 0) continue;

            const currentDueCents = Math.round(currentDue * 100);
            let remainingPaymentCents = Math.round(remainingPayment * 100);

            let paymentForThisBill = 0;
            let newStatus = bill.paymentStatus || 'Credit';
            let newDue = currentDue;
            let newPaid = bill.paidAmount || 0;

            if (remainingPaymentCents >= currentDueCents) {
              paymentForThisBill = currentDue; // clear exact float due
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

            // Update Bill
            await window.electronAPI.dbQuery(
              'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
              [newPaid, newDue, newStatus, paymentData.method, timestamp, bill.id]
            );

            // Record Payment Entry linked to Bill
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
              [`PAY-${Date.now()}-${bill.id}`, selectedCustomer.id, bill.id, DEFAULT_SHOP_ID, paymentForThisBill, paymentData.method, 'SUCCESS', timestamp, timestamp]
            );
          }
        } else {
          console.log("No specific bills found to settle, applying to general balance.");
        }

        // If there's remaining unapplied payment (excess / advance payment), record it as an unlinked payment
        if (remainingPayment > 0) {
          await window.electronAPI.dbQuery(
            `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [`PAY-ADV-${Date.now()}`, selectedCustomer.id, null, DEFAULT_SHOP_ID, remainingPayment, paymentData.method, 'SUCCESS', timestamp, timestamp]
          );
        }

        // 2. Update overall customer balance
        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [totalPaid, timestamp, selectedCustomer.id]
        );

        // 3. Record Transaction in Accounts
        const txnId = `TXN-${Date.now()}`;
        const _nowC = new Date();
        const txnTimestamp = `${_nowC.getFullYear()}-${String(_nowC.getMonth()+1).padStart(2,'0')}-${String(_nowC.getDate()).padStart(2,'0')} ${String(_nowC.getHours()).padStart(2,'0')}:${String(_nowC.getMinutes()).padStart(2,'0')}`;
        
        const mappedBankId = paymentData.method === 'Card'
          ? (settings.cardDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
          : (paymentData.method === 'UPI'
            ? (settings.upiDefaultAccountId || settings.defaultBankId || settings.bankAccounts?.[0]?.id || null)
            : (paymentData.method === 'Bank' ? (settings.defaultBankId || settings.bankAccounts?.[0]?.id || null) : null));

        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txnId, DEFAULT_SHOP_ID, (paymentData.method === 'Bank' || paymentData.method === 'Card' || paymentData.method === 'UPI') ? 'BANK' : 'CASH', 'INCOME', 'Credit Settlement', totalPaid, `Settlement from ${selectedCustomer.name}`, txnTimestamp, 0, timestamp, 'DollarSign', mappedBankId]
        );

        // Record card commission if applicable
        if (paymentData.method === 'Card' && settings.cardCommission > 0) {
          const commissionRate = parseFloat(settings.cardCommission || 0);
          const commissionAmount = totalPaid * (commissionRate / 100);
          const commTxnId = `TXN-COMM-${Date.now()}`;
          const commDesc = `Card Commission for Credit Settlement ${selectedCustomer.name}`;
          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [commTxnId, DEFAULT_SHOP_ID, 'BANK', 'EXPENSE', 'Card Commission', commissionAmount, commDesc, txnTimestamp, 0, timestamp, 'Percent', mappedBankId]
          );
        }

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
          alert(`Settlement complete! Remaining unallocated: ${remainingPayment.toFixed(2)}`);
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
        // Check for orders
        const ordersRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM orders WHERE customerId = ?', [id]);
        const ordersCount = ordersRes?.data?.[0]?.count || 0;

        // Check for payments
        const paymentsRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM payments WHERE customerId = ?', [id]);
        const paymentsCount = paymentsRes?.data?.[0]?.count || 0;

        // Check for deleted orders
        const deletedRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM deleted_orders WHERE customerId = ?', [id]);
        const deletedCount = deletedRes?.data?.[0]?.count || 0;

        if (ordersCount > 0 || paymentsCount > 0 || deletedCount > 0) {
          alert("Restricted: Cannot delete this customer because they have associated orders, payments, or transaction history.");
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
        setShowEditCreditLimitModal(false);
        setSelectedCustomer(null);
        setEditCreditLimitValue('0');
        setManagerPinValue('');
        setManagerPinError('');
      } catch (err) {
        console.error('Update credit limit error:', err);
        alert('Failed to update credit limit.');
      }
    }
  };


  const handleViewCustomerInsight = async (customer) => {
    setSelectedCustomer(customer);
    setLoading(true);
    if (window.electronAPI?.dbQuery) {
      try {
        const result = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' ORDER BY createdAt DESC",
          [customer.id]
        );
        let bills = result.success ? result.data : [];
        bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setCustomerBills(bills.filter(b => b.status !== 'Cancelled'));
        setCustomerReturns(bills.filter(b => b.status === 'Cancelled'));

        const paymentsRes = await window.electronAPI.dbQuery(
          "SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt DESC",
          [customer.id]
        );
        let payments = paymentsRes.success ? paymentsRes.data : [];
        payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setCustomerPayments(payments);

        const totalSales = bills.filter(b => b.status !== 'Cancelled').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const salesReturn = bills.filter(b => b.status === 'Cancelled').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        
        let totalDiscount = 0;
        bills.forEach(bill => {
          try {
            const breakdown = bill.paymentBreakdown ? JSON.parse(bill.paymentBreakdown) : null;
            if (breakdown && breakdown.discount) {
              totalDiscount += parseFloat(breakdown.discount) || 0;
            }
          } catch (e) {}
        });

        setSelectedCustomerStats({
          totalSales,
          pendingDue: customer.balance || 0,
          salesReturn,
          totalDiscount
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
    if (!window.confirm(`Are you sure you want to cancel order ${bill.billNumber || bill.id}?`)) return;

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

  const fetchCustomerBills = async (customerId) => {
    if (window.electronAPI?.dbQuery) {
      try {
        const result = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' ORDER BY createdAt DESC",
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
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Customer Insight</span>
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
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{selectedCustomer.phone || '—'}</div>
            </div>



            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Address</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', lineHeight: '1.4' }}>{selectedCustomer.address || '—'}</div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.25rem 0' }} />

            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: '1rem', letterSpacing: '0.05em' }}>Sale Details</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Total Sales</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{(selectedCustomerStats.totalSales || 0).toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Pending Due</span>
                <span style={{ fontWeight: 800, color: selectedCustomerStats.pendingDue > 0 ? 'var(--danger)' : 'var(--secondary)' }}>
                  {(selectedCustomerStats.pendingDue || 0).toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Sales Return</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{(selectedCustomerStats.salesReturn || 0).toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Total Discount</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{(selectedCustomerStats.totalDiscount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Tabs & Tables */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <button 
                style={{ border: 'none', background: insightTab === 'sales' ? '#1E3A8A' : 'transparent', color: insightTab === 'sales' ? 'white' : '#64748B', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setInsightTab('sales')}
              >
                Sales
              </button>
              <button 
                style={{ border: 'none', background: insightTab === 'payments' ? '#1E3A8A' : 'transparent', color: insightTab === 'payments' ? 'white' : '#64748B', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setInsightTab('payments')}
              >
                Payments
              </button>
              <button 
                style={{ border: 'none', background: insightTab === 'returns' ? '#1E3A8A' : 'transparent', color: insightTab === 'returns' ? 'white' : '#64748B', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setInsightTab('returns')}
              >
                Returns
              </button>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
              {insightTab === 'sales' && (
                <table className={styles.customersTable} style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#F8FAFC' }}># Order</th>
                      <th style={{ background: '#F8FAFC' }}>Date</th>
                      <th style={{ background: '#F8FAFC' }}>Net Amount</th>
                      <th style={{ background: '#F8FAFC' }}>Pay Mode</th>
                      <th style={{ background: '#F8FAFC', width: '150px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerBills.length > 0 ? customerBills.map((bill) => (
                      <tr key={bill.id}>
                        <td style={{ fontWeight: 700 }}>{bill.billNumber || bill.id}</td>
                        <td>{formatDate(bill.createdAt)}</td>
                        <td><CurrencySymbol size={13} /> {(bill.totalAmount || 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 700, color: (bill.dueAmount || 0) <= 0 ? 'var(--secondary)' : ((bill.paidAmount || 0) > 0 ? 'var(--warning)' : 'var(--danger)') }}>
                          {(bill.dueAmount || 0) <= 0 ? 'PAID' : ((bill.paidAmount || 0) > 0 ? 'PARTIAL' : 'CREDIT')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
                            {/* View Order Detail */}
                            <button 
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                              onClick={() => {
                                navigate(`/invoice/${bill.id}`);
                              }}
                              title="View details"
                            >
                              <Eye size={16} />
                            </button>
                            {/* Settle Order */}
                            {bill.dueAmount > 0 && (
                              <button 
                                style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer' }}
                                onClick={() => {
                                  setSelectedBillForPayment(bill);
                                  setPaymentData({ amount: bill.dueAmount.toString(), method: 'Cash' });
                                  setShowPaymentModal(true);
                                }}
                                title="Collect payment"
                              >
                                <DollarSign size={16} />
                              </button>
                            )}
                            {/* Cancel/Delete Order button removed as per requirements */}
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
                    </tr>
                  </thead>
                  <tbody>
                    {customerPayments.length > 0 ? customerPayments.map((pay) => (
                      <tr key={pay.id}>
                        <td style={{ fontWeight: 700 }}>{pay.id}</td>
                        <td>{formatDate(pay.createdAt)}</td>
                        <td><CurrencySymbol size={13} /> {(pay.amount || 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 600 }}>{pay.method}</td>
                        <td>
                          <span className={styles.statusPaid} style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#DCFCE7', color: '#15803D', fontSize: '0.75rem', fontWeight: 700 }}>SUCCESS</span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>No payment records found.</td></tr>
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
                      <th style={{ background: '#F8FAFC' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerReturns.length > 0 ? customerReturns.map((ret) => (
                      <tr key={ret.id}>
                        <td style={{ fontWeight: 700 }}>{ret.billNumber || ret.id}</td>
                        <td>{formatDate(ret.createdAt)}</td>
                        <td><CurrencySymbol size={13} /> {(ret.totalAmount || 0).toFixed(2)}</td>
                        <td>
                          <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.8rem' }}>CANCELLED</span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>No returned/cancelled orders found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Re-render identical modal portals so that payment options work inside the detail page */}
        {showPaymentModal && (
          <div className={styles.modalOverlay} onClick={() => { setShowPaymentModal(false); setSelectedBillForPayment(null); }}>
            <div className={styles.modal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ color: '#0F172A' }}>Settle Customer Bill</h2>
                  <p>{selectedBillForPayment ? `Record payment for Bill #${selectedBillForPayment.billNumber}` : 'Record payment and settle outstanding credit'}</p>
                </div>
                <X size={24} className={styles.closeBtn} onClick={() => { setShowPaymentModal(false); setSelectedBillForPayment(null); }} />
              </div>
              
              <form onSubmit={handlePayment}>
                <div className={styles.modalBody}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: '#F1F5F9', borderRadius: '12px', marginBottom: '0.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 800 }}>
                      {selectedCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#1E293B' }}>{selectedCustomer.name}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                        Due for this bill: <strong><CurrencySymbol size={14} /> {selectedBillForPayment ? selectedBillForPayment.dueAmount.toFixed(2) : selectedCustomer.balance.toFixed(2)}</strong>
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
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Payment Method</label>
                    <div className={styles.inputWrapper}>
                      <Wallet size={18} />
                      <select 
                        style={{ background: 'transparent', border: 'none', width: '100%', outline: 'none', fontSize: '0.95rem' }}
                        value={paymentData.method}
                        onChange={(e) => setPaymentData({...paymentData, method: e.target.value})}
                      >
                        <option value="Cash">Cash Payment</option>
                        <option value="Card">Card Payment</option>
                        <option value="UPI">UPI Payment</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => { setShowPaymentModal(false); setSelectedBillForPayment(null); }}>Cancel</button>
                  <button type="submit" className={styles.primaryBtn} style={{ background: 'var(--secondary)' }}>Complete Settlement</button>
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
          <p>Manage and view your customer database and order history.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Unified search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.4rem 0.75rem', width: '280px' }}>
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
            setFormData({ name: '', phone: settings.waCountryCode ? `+${settings.waCountryCode.replace(/\+/g, '')}` : '+971', address: '' });
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
                <td style={{ fontWeight: 600, color: '#1E293B' }}>
                  {customer.name}
                </td>
                <td>
                  {customer.phone || '000'}
                </td>
                <td style={{ fontWeight: 600, color: '#475569' }}>
                  {(customer.creditLimit || 0).toFixed(2)}
                </td>
                <td style={{ fontWeight: 600, color: '#475569' }}>
                  {(customer.totalSales || 0).toFixed(2)}
                </td>
                <td style={{ fontWeight: 700, color: (customer.balance || 0) > 0 ? 'var(--danger)' : 'var(--secondary)' }}>
                  {(customer.balance || 0).toFixed(2)}
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
                        setFormData({ name: customer.name, phone: customer.phone, address: customer.address || '' });
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
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Phone Number</label>
                    <div className={styles.inputWrapper}>
                      <Phone size={18} />
                      <input 
                        type="tel" 
                        placeholder="+1 (555) 000-0000" 
                        required 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
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
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
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
                <h2>Billing History - {selectedCustomer?.name}</h2>
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
                    <th>Bill ID</th>
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
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No billing history found.</td></tr>
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
                  setPaymentData({ ...paymentData, amount: autoAmount });
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
        <div className={styles.modalOverlay} onClick={() => setShowPaymentModal(false)}>
          <div className={styles.modal} style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A' }}>Settle Customer Bill</h2>
                <p>Record payment and settle outstanding credit</p>
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
                    background: '#2563EB', 
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
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Payment Method</label>
                  <div className={styles.inputWrapper}>
                    <Wallet size={18} />
                    <select 
                      style={{ background: 'transparent', border: 'none', width: '100%', outline: 'none', fontSize: '0.95rem' }}
                      value={paymentData.method}
                      onChange={(e) => setPaymentData({...paymentData, method: e.target.value})}
                    >
                      <option value="Cash">Cash Payment</option>
                      <option value="Card">Card Payment</option>
                      <option value="UPI">UPI Payment</option>
                    </select>
                  </div>
                </div>
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
        <div className={styles.modalOverlay} onClick={() => { setShowEditCreditLimitModal(false); setSelectedCustomer(null); }}>
          <div className={styles.modal} style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Edit Credit Limit</h2>
                <p>Set individual credit limit for <strong>{selectedCustomer.name}</strong></p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => { setShowEditCreditLimitModal(false); setSelectedCustomer(null); }} />
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
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (selectedCustomerStats.pendingDue || 0) > 0 ? 'var(--danger)' : 'var(--secondary)' }}>
                      <CurrencySymbol size={16} /> {Math.abs(selectedCustomerStats.pendingDue || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>CURRENT CREDIT LIMIT</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563EB' }}>
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
                <button type="button" className={styles.secondaryBtn} onClick={() => { setShowEditCreditLimitModal(false); setSelectedCustomer(null); }}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} style={{ background: '#2563EB' }}>Save Credit Limit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreditWarning && creditWarningDetails && (
        <div className={styles.modalOverlay} onClick={handleCancelOverride}>
          <div className={styles.statusModal} style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#FEF2F2', borderBottom: '1px solid #FEE2E2', padding: '1.25rem 1.5rem', borderRadius: '12px 12px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={24} color="var(--danger)" />
                <div>
                  <h2 style={{ color: '#991B1B', margin: 0, fontSize: '1.25rem' }}>Credit Limit Exceeded</h2>
                  <p style={{ color: '#B91C1C', margin: 0, fontSize: '0.8rem' }}>This customer has exceeded their credit threshold.</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleVerifyManagerPin}>
              <div className={styles.modalBody} style={{ padding: '1.5rem' }}>
                <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1rem', border: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Customer Name:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}>{creditWarningDetails.customerName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Credit Limit:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}><CurrencySymbol size={14} /> {creditWarningDetails.creditLimit.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Outstanding Balance:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}><CurrencySymbol size={14} /> {creditWarningDetails.currentOutstanding.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Credit Balance Change:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}><CurrencySymbol size={14} /> {creditWarningDetails.orderAmount.toFixed(2)}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.5rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>New Outstanding Balance:</span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}><CurrencySymbol size={14} /> {creditWarningDetails.newOutstanding.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 700 }}>
                    <span>Exceeded Amount:</span>
                    <span><CurrencySymbol size={14} /> {creditWarningDetails.exceededAmount.toFixed(2)}</span>
                  </div>
                </div>

                {settings.enableManagerOverride ? (
                  <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>ENTER MANAGER SECURE PIN TO APPROVE</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.5rem 0.75rem', background: '#F8FAFC' }}>
                      <Lock size={18} color="#64748B" />
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="Enter 4-Digit PIN"
                        value={managerPinValue}
                        onChange={(e) => setManagerPinValue(e.target.value.replace(/\D/g, ''))}
                        style={{ fontSize: '1.25rem', letterSpacing: '0.25rem', border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
                        autoFocus
                      />
                    </div>
                    {managerPinError && (
                      <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem', fontWeight: 600 }}>{managerPinError}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '12px', padding: '0.75rem 1rem', color: '#C53030', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <AlertCircle size={18} className="inline mr-2" />
                    <span>Credit Limit Protection is active and Manager Override is disabled.</span>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter} style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '0 0 12px 12px' }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleCancelOverride}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                {creditWarningDetails.overrideAllowed && settings.enableManagerOverride && (
                  <button
                    type="submit"
                    className={styles.primaryBtn}
                    style={{ flex: 1, background: '#D97706', color: 'white' }}
                  >
                    Approve Override
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
