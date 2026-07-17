import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, User, DollarSign, Calendar, Clock, CheckCircle, 
  AlertCircle, CreditCard, Wallet, FileText, Send, Printer,
  ChevronRight, ArrowRight, History, Trash2, Download, X,
  Filter, MoreVertical, Plus, Info, Eye, ArrowUpRight, TrendingUp,
  Share2, FileDown, Layers, ArrowLeft, Landmark, Check, QrCode,
  AlertTriangle, Lock
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID } from '../constants';
import { t } from '../utils/translations';
import axios from 'axios';
import CurrencySymbol from '../components/CurrencySymbol';
import Pagination from '../components/Pagination';
import { getLocalISOString, getLocalDateTime } from '../utils/dateUtils';
import styles from './Settlement.module.css';
import { QRCodeCanvas } from 'qrcode.react';
import { checkCreditLimit } from '../utils/creditLimit';
import { paymentService } from '../services/paymentService';

export default function Settlement() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const queryParams = new URLSearchParams(location.search);
  const initialCustomerId = queryParams.get('customerId');
  
  const { settings, formatDate } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Outstanding'); // All | Outstanding | Advance | Paid
  const [workspaceTab, setWorkspaceTab] = useState('pending'); // pending | history
  const [loading, setLoading] = useState(false);
  const [globalData, setGlobalData] = useState({ pending: [], history: [], advances: [] });
  const [kpis, setKpis] = useState({
    outstanding: 0,
    settlements: 0,
    pendingCount: 0,
    overdueCount: 0,
    advanceCredits: 0
  });

  // Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [nomodLinkModal, setNomodLinkModal] = useState({ show: false, url: '', linkId: '', amount: 0 });
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [showManagerPinModal, setShowManagerPinModal] = useState(false);
  const [creditWarningDetails, setCreditWarningDetails] = useState(null);
  const [managerPinValue, setManagerPinValue] = useState('');
  const [managerPinError, setManagerPinError] = useState('');

  // Multipayment Split States
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');

  const cashVal = parseFloat(cashAmount) || 0;
  const cardVal = parseFloat(cardAmount) || 0;
  const upiVal = parseFloat(upiAmount) || 0;
  const bankVal = parseFloat(bankAmount) || 0;

  useEffect(() => {
    if (paymentMethod === 'Multipayment') {
      const sum = cashVal + cardVal + upiVal + bankVal;
      setPaymentAmount(sum > 0 ? sum.toString() : '');
    }
  }, [cashAmount, cardAmount, upiAmount, bankAmount, paymentMethod]);

  useEffect(() => {
    if (!showPayModal) {
      setCashAmount('');
      setCardAmount('');
      setUpiAmount('');
      setBankAmount('');
      setDiscountAmount('');
    }
  }, [showPayModal]);

  useEffect(() => {
    if (paymentMethod !== 'Multipayment') {
      setCashAmount('');
      setCardAmount('');
      setUpiAmount('');
      setBankAmount('');
    }
  }, [paymentMethod]);

  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [selectedCustomer, workspaceTab]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPayModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleNomodSuccess = (e) => {
      const { customerId } = e.detail || {};
      if (selectedCustomer && (selectedCustomer.id === customerId || customerId === 'all')) {
        fetchCustomerDetails(selectedCustomer.id);
        if (typeof fetchCustomers === 'function') {
          fetchCustomers();
        }
      }
    };
    window.addEventListener('nomod-payment-success', handleNomodSuccess);
    return () => window.removeEventListener('nomod-payment-success', handleNomodSuccess);
  }, [selectedCustomer]);

  useEffect(() => {
    if (showPayModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPayModal]);

  useEffect(() => {
    if (settings.bankAccounts && settings.bankAccounts.length > 0) {
      if (paymentMethod === 'Card') {
        const cardBank = settings.bankAccounts.find(acc => acc.id === settings.cardDefaultAccountId) || 
                         settings.bankAccounts.find(acc => acc.id === settings.defaultBankId) || 
                         settings.bankAccounts[0];
        setSelectedBank(cardBank.bankName);
      } else if (paymentMethod === 'UPI') {
        const upiBank = settings.bankAccounts.find(acc => acc.id === settings.upiDefaultAccountId) || 
                        settings.bankAccounts.find(acc => acc.id === settings.defaultBankId) || 
                        settings.bankAccounts[0];
        setSelectedBank(upiBank.bankName);
      } else if (!selectedBank) {
        const defaultBank = settings.bankAccounts.find(acc => acc.id === settings.defaultBankId) || settings.bankAccounts[0];
        setSelectedBank(defaultBank.bankName);
      }
    }
  }, [paymentMethod, settings.bankAccounts, settings.cardDefaultAccountId, settings.upiDefaultAccountId, settings.defaultBankId, selectedBank]);

  // 1. Initial Load of Customer from query params
  useEffect(() => {
    if (initialCustomerId && window.electronAPI?.dbQuery) {
      const loadInitialCustomer = async () => {
        const res = await window.electronAPI.dbQuery(
          'SELECT * FROM customers WHERE id = ?',
          [initialCustomerId]
        );
        if (res.success && res.data.length > 0) {
          setSelectedCustomer(res.data[0]);
        }
      };
      loadInitialCustomer();
    }
  }, [initialCustomerId]);

  // 2. Fetch customers and global dashboard data
  useEffect(() => {
    fetchCustomers();
    if (!selectedCustomer) {
      fetchGlobalData();
    }
  }, [searchTerm, activeTab, selectedCustomer]);

  // 3. Fetch specific customer data when selected
  useEffect(() => {
    if (selectedCustomer) {
      if (window.electronAPI?.runDataHealer) {
        window.electronAPI.runDataHealer()
          .catch(err => console.error("Data healer failed on customer select:", err))
          .finally(() => {
            fetchCustomerSpecificData(selectedCustomer);
          });
      } else {
        fetchCustomerSpecificData(selectedCustomer);
      }
    }
  }, [selectedCustomer]);

  const fetchCustomers = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        let query = 'SELECT * FROM customers';
        let params = [];
        let conditions = [];

        if (searchTerm) {
          conditions.push('(name LIKE ? OR phone LIKE ?)');
          const term = `%${searchTerm}%`;
          params.push(term, term);
        }

        if (activeTab === 'Outstanding') conditions.push('balance > 0');
        else if (activeTab === 'Advance') conditions.push('balance < 0');
        else if (activeTab === 'Paid') conditions.push('balance = 0');

        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY balance DESC, name ASC';
        const res = await window.electronAPI.dbQuery(query, params);
        if (res.success) setCustomers(res.data);
      } catch (err) {
        console.error("Fetch customers failed:", err);
      }
    }
  };

  const fetchGlobalData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const pendingRes = await window.electronAPI.dbQuery(
          "SELECT orders.*, customers.name as customerName, customers.phone as customerPhone, customers.balance as customerBalance FROM orders LEFT JOIN customers ON orders.customerId = customers.id WHERE orders.id IS NOT NULL AND orders.id != '' AND orders.dueAmount > 0 ORDER BY orders.createdAt DESC LIMIT 8",
          []
        );
        const historyRes = await window.electronAPI.dbQuery(
          'SELECT payments.*, customers.name as customerName FROM payments LEFT JOIN customers ON payments.customerId = customers.id ORDER BY payments.createdAt DESC LIMIT 8',
          []
        );
        const advancesRes = await window.electronAPI.dbQuery(
          'SELECT * FROM customers WHERE balance < 0 ORDER BY balance ASC LIMIT 8',
          []
        );

        setGlobalData({
          pending: pendingRes.success ? pendingRes.data : [],
          history: historyRes.success ? historyRes.data : [],
          advances: advancesRes.success ? advancesRes.data : []
        });

        const outstandingSum = await window.electronAPI.dbQuery('SELECT SUM(balance) as total FROM customers WHERE balance > 0', []);
        const advanceSum = await window.electronAPI.dbQuery('SELECT SUM(ABS(balance)) as total FROM customers WHERE balance < 0', []);
        const pendingCount = await window.electronAPI.dbQuery("SELECT COUNT(*) as count FROM orders WHERE id IS NOT NULL AND id != '' AND dueAmount > 0", []);
        const settlementsRes = await window.electronAPI.dbQuery("SELECT SUM(amount) as total FROM payments WHERE strftime('%m', createdAt) = strftime('%m', 'now')", []);
        const overdueDays = settings?.overdueDays || 7;
        const overdueRes = await window.electronAPI.dbQuery(
          "SELECT COUNT(*) as count FROM orders WHERE id IS NOT NULL AND id != '' AND dueAmount > 0 AND createdAt < date('now', ?)",
          [`-${overdueDays} days`]
        );

        setKpis({
          outstanding: (outstandingSum.success && outstandingSum.data[0]?.total) || 0,
          settlements: (settlementsRes.success && settlementsRes.data[0]?.total) || 0,
          pendingCount: (pendingCount.success && pendingCount.data[0]?.count) || 0,
          overdueCount: (overdueRes.success && overdueRes.data[0]?.count) || 0,
          advanceCredits: (advanceSum.success && advanceSum.data[0]?.total) || 0
        });
      } catch (err) {
        console.error("Global data fetch failed:", err);
      }
    }
  };

  const fetchCustomerSpecificData = async (customer) => {
    if (!customer || !customer.id) return;
    
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        const customerId = customer.id;
        
        const pendingRes = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND dueAmount > 0 ORDER BY createdAt DESC",
          [customerId]
        );
        const historyRes = await window.electronAPI.dbQuery(
          'SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt DESC',
          [customerId]
        );
        
        setGlobalData(prev => ({
          ...prev,
          pending: pendingRes.success ? pendingRes.data.map(d => ({
            ...d, 
            customerName: customer.name,
            customerPhone: customer.phone,
            customerBalance: customer.balance
          })) : [],
          history: historyRes.success ? historyRes.data.map(d => ({
            ...d, 
            customerName: customer.name
          })) : [],
        }));
      } catch (err) {
        console.error("Fetch specific failed:", err);
      } finally {
        setLoading(false);
      }
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
        orderId: `SETTLE-${selectedCustomer.id.substring(0, 5)}`,
        creditLimit: creditWarningDetails.creditLimit,
        outstandingBalance: creditWarningDetails.currentOutstanding,
        orderAmount: creditWarningDetails.orderAmount,
        exceededAmount: creditWarningDetails.exceededAmount,
        userId
      });

      if (res.success) {
        setShowManagerPinModal(false);
        setShowCreditWarning(false);
        setManagerPinValue('');
        setTimeout(() => {
          handleSettle(true);
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
        orderId: `SETTLE-${selectedCustomer.id.substring(0, 5)}`,
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
    setShowManagerPinModal(false);
    setManagerPinValue('');
    setManagerPinError('');
  };

  const handleSettle = async (isOverridden = false) => {
    const amount = parseFloat(paymentAmount);
    const discount = parseFloat(discountAmount || 0) || 0;
    if (!selectedCustomer || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    if (!isOverridden) {
      const checkRes = await checkCreditLimit(selectedCustomer.id, -amount, settings);
      if (checkRes.blocked) {
        setCreditWarningDetails(checkRes.details);
        setShowCreditWarning(true);
        return;
      }
    }

    if (paymentMethod === 'Nomod' && !isOverridden) {
      let linkId = `LNK-${Date.now().toString().slice(-4)}`;
      let checkoutUrl = '';
      
      // 1. Duplicate protection check: reuse active link if exists
      if (window.electronAPI?.dbQuery) {
        try {
          const activeLnkRes = await window.electronAPI.dbQuery(
            `SELECT * FROM payment_links WHERE customerId = ? AND status IN ('Active', 'Pending') AND amount = ? LIMIT 1`,
            [selectedCustomer.id, amount]
          );
          if (activeLnkRes.success && activeLnkRes.data.length > 0) {
            checkoutUrl = activeLnkRes.data[0].url;
            linkId = activeLnkRes.data[0].id;
          }
        } catch (dbErr) {
          console.warn("Failed to check active payment link in Settlement:", dbErr);
        }
      }

      if (!checkoutUrl) {
        try {
          const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
          const checkoutRes = await window.electronAPI.createNomodCheckout({
            amount: amount,
            currency: settings.nomodCurrency || 'AED',
            customer: {
              name: selectedCustomer?.name || 'Customer',
              phone: selectedCustomer?.phone || ''
            },
            orderId: `SETTLE-${selectedCustomer.id.substring(0, 5)}`,
            userRole: currentUser.role || 'staff'
          });

          if (checkoutRes.success && checkoutRes.data && checkoutRes.data.url) {
            checkoutUrl = checkoutRes.data.url;
            if (checkoutRes.data.id) {
              linkId = checkoutRes.data.id;
            }
          } else {
            const errorMsg = checkoutRes?.error || 'Unknown error';
            console.warn("Nomod Backend API failed in Settlement:", errorMsg);
            if (settings.nomodEnv === 'live') {
              alert("Nomod Checkout API connection failed: " + errorMsg + ". Please check your API key configuration in settings.");
              return; // Stop flow
            } else {
              alert("Nomod Checkout API connection failed: " + errorMsg + ". Falling back to sandbox payment link.");
            }
          }
        } catch (err) {
          console.warn("Nomod Checkout IPC failed in Settlement:", err.message);
          if (settings.nomodEnv === 'live') {
            alert("Nomod Checkout IPC failed: " + err.message);
            return;
          }
        }
      }

      if (!checkoutUrl) {
        if (settings.nomodEnv === 'live') {
          return;
        }
        checkoutUrl = `https://link.nomod.com/pay?account=${settings.nomodMerchantId || 'default'}&amount=${amount}&reference=${linkId}`;
      }

      // Log Audit Event
      if (window.electronAPI?.logAuditEvent) {
        const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
        window.electronAPI.logAuditEvent({
          eventName: 'Payment Link Generated',
          details: `Nomod payment link generated for Customer ${selectedCustomer.name} Settlement, Amount: ${amount}`,
          userId: currentUser.name || 'Staff',
          userRole: currentUser.role || 'staff'
        });
      }

      setNomodLinkModal({
        show: true,
        url: checkoutUrl,
        linkId,
        amount
      });
      return;
    }

    const timestamp = getLocalISOString();
    
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        
        let splits = [];
        if (paymentMethod === 'Multipayment') {
          if (cashVal > 0) splits.push({ method: 'Cash', amount: cashVal });
          if (cardVal > 0) splits.push({ method: 'Card', amount: cardVal });
          if (upiVal > 0) splits.push({ method: 'UPI', amount: upiVal });
          if (bankVal > 0) splits.push({ method: 'Bank', amount: bankVal });
        } else {
          splits.push({ method: paymentMethod, amount: amount });
        }
        if (discount > 0) {
          splits.push({ method: 'Discount', amount: discount });
        }

        // Process each split payment sequentially
        for (const split of splits) {
          let remaining = split.amount;

          // Re-fetch pending bills sequentially to get updated dues
          const billsRes = await window.electronAPI.dbQuery(
            "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND dueAmount > 0 ORDER BY createdAt ASC",
            [selectedCustomer.id]
          );
          const bills = billsRes.success ? billsRes.data : [];

          if (bills.length > 0) {
            for (const bill of bills) {
              if (remaining <= 0) break;
              const currentDue = bill.dueAmount > 0 ? bill.dueAmount : (bill.totalAmount - (bill.paidAmount || 0));
              if (currentDue <= 0) continue;

              const currentDueCents = Math.round(currentDue * 100);
              let remainingCents = Math.round(remaining * 100);

              let allocate = 0;
              let newStatus = 'Paid';
              let newDue = 0;
              let newPaid = (bill.paidAmount || 0);

              if (remainingCents >= currentDueCents) {
                allocate = currentDue; // clear exact float due
                remaining = (remainingCents - currentDueCents) / 100;
                newPaid += allocate;
                newDue = 0;
                newStatus = 'Paid';
              } else {
                allocate = remaining;
                newPaid += allocate;
                newDue = (currentDueCents - remainingCents) / 100;
                remaining = 0;
                newStatus = 'Partial';
              }

              // Update workflow status to 'Confirmed' when fully paid
              const newWorkflowStatus = newDue <= 0 ? 'Confirmed' : bill.status;

              // Recalculate paymentMethod for this order from all payments
              let newOrderPaymentMethod = split.method; // current payment method being processed
              if (newDue <= 0) {
                // Order is now fully paid – look at all previous payments + this one
                const prevPayRes = await window.electronAPI.dbQuery(
                  'SELECT DISTINCT method FROM payments WHERE orderId = ?',
                  [bill.id]
                );
                const prevMethods = prevPayRes.success ? prevPayRes.data.map(p => p.method) : [];
                const allMethods = [...new Set([...prevMethods, split.method])];
                const hasCash = allMethods.some(m => m === 'Cash');
                const hasCardOrBankOrUPI = allMethods.some(m => m === 'Card' || m === 'Bank' || m === 'UPI');
                if (hasCash && hasCardOrBankOrUPI) newOrderPaymentMethod = 'Multipayment';
                else if (allMethods.includes('Card')) newOrderPaymentMethod = 'Card';
                else if (allMethods.includes('UPI')) newOrderPaymentMethod = 'UPI';
                else if (allMethods.includes('Bank')) newOrderPaymentMethod = 'Bank';
                else newOrderPaymentMethod = 'Cash';
              }

              await window.electronAPI.dbQuery(
                'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
                [newPaid, newDue, newStatus, newWorkflowStatus, newOrderPaymentMethod, timestamp, bill.id]
              );

              const payId = await getNextRvNumber();
              const payRef = await window.electronAPI.getNextPaymentReference('SET');
              await window.electronAPI.dbQuery(
                `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                [payId, selectedCustomer.id, bill.id, DEFAULT_SHOP_ID, allocate, split.method, 'SUCCESS', timestamp, timestamp, payRef]
              );
            }
          }

          // If there's remaining unapplied payment (excess / advance payment)
          if (remaining > 0) {
            const payId = await getNextRvNumber();
            const payRef = await window.electronAPI.getNextPaymentReference('SET');
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
              [payId, selectedCustomer.id, null, DEFAULT_SHOP_ID, remaining, split.method, 'SUCCESS', timestamp, timestamp, payRef]
            );
          }
        }

        const totalReduction = amount + discount;
        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [totalReduction, timestamp, selectedCustomer.id]
        );

        // 3. Record Transactions in Accounts for each split
        const txnTimestamp = getLocalDateTime();
        const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
        const creatorName = currentUser.name || currentUser.username || 'System';
        const creatorId = currentUser.id || 'SYSTEM';
        const creatorRole = currentUser.role || 'system';

        for (const split of splits) {
          if (split.method === 'Discount') {
            const splitTxnId = `TXN-${Date.now()}-Discount`;
            await window.electronAPI.dbQuery(
              `INSERT INTO account_transactions 
               (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
              [
                splitTxnId,
                DEFAULT_SHOP_ID,
                'CASH',
                'EXPENSE',
                'Discount Given',
                split.amount,
                `Discount given to ${selectedCustomer.name} during settlement`,
                txnTimestamp,
                timestamp,
                'Percent',
                null,
                creatorName,
                creatorId,
                creatorRole
              ]
            );
            continue;
          }

          const splitTxnId = `TXN-${Date.now()}-${split.method}`;
          const splitMappedBankId = (split.method === 'Card' || split.method === 'UPI' || split.method === 'Bank')
            ? (settings.bankAccounts?.find(acc => acc.bankName === selectedBank || acc.id === selectedBank)?.id || selectedBank)
            : null;

          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
            [
              splitTxnId,
              DEFAULT_SHOP_ID,
              (split.method === 'Bank' || split.method === 'Card' || split.method === 'UPI') ? 'BANK' : (split.method === 'Nomod' ? 'GATEWAY' : 'CASH'),
              'INCOME',
              'Credit Settlement',
              split.amount,
              `Settlement from ${selectedCustomer.name} via ${split.method}${
                (split.method === 'Card' || split.method === 'UPI' || split.method === 'Bank') && selectedBank 
                  ? ` (${selectedBank})` 
                  : ''
              }`,
              txnTimestamp,
              timestamp,
              split.method === 'Card' ? 'CreditCard' : (split.method === 'UPI' ? 'QrCode' : 'DollarSign'),
              splitMappedBankId,
              creatorName,
              creatorId,
              creatorRole
            ]
          );

          // Record card commission if applicable
          if (split.method === 'Card' && settings.cardCommission > 0) {
            const commissionRate = parseFloat(settings.cardCommission || 0);
            const commissionAmount = split.amount * (commissionRate / 100);
            const commTxnId = `TXN-COMM-${Date.now()}-${split.method}`;
            const commDesc = `Card Commission for Credit Settlement ${selectedCustomer.name}`;
            await window.electronAPI.dbQuery(
              `INSERT INTO account_transactions 
               (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
              [
                commTxnId, 
                DEFAULT_SHOP_ID, 
                'BANK', 
                'EXPENSE', 
                'Card Commission', 
                commissionAmount, 
                commDesc, 
                txnTimestamp, 
                timestamp, 
                'Percent', 
                splitMappedBankId,
                creatorName,
                creatorId,
                creatorRole
              ]
            );
          }
        }

        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }

        alert("Settlement completed successfully!");
        setPaymentAmount('');
        setShowPayModal(false);
        
        // Refresh customer state
        const updatedCust = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE id = ?', [selectedCustomer.id]);
        const refreshedCustomer = (updatedCust.success && updatedCust.data && updatedCust.data.length > 0) ? updatedCust.data[0] : selectedCustomer;
        if (updatedCust.success) setSelectedCustomer(refreshedCustomer);
        fetchCustomerSpecificData(refreshedCustomer);
        
        fetchGlobalData();
        fetchCustomers();
      } catch (err) {
        console.error("Settlement failed:", err);
        alert("Settlement failed: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const displayDue = selectedCustomer ? Math.max(0, Number(selectedCustomer.balance) || 0) : 0;
  const currentNetBalance = selectedCustomer ? (Number(selectedCustomer.balance) || 0) : 0;
  const simulatedNewBalance = currentNetBalance - (parseFloat(paymentAmount) || 0) - (parseFloat(discountAmount || 0) || 0);

  const paginatedPending = React.useMemo(() => {
    return (globalData.pending || []).slice((pendingPage - 1) * 20, pendingPage * 20);
  }, [globalData.pending, pendingPage]);

  const paginatedHistory = React.useMemo(() => {
    return (globalData.history || []).slice((historyPage - 1) * 20, historyPage * 20);
  }, [globalData.history, historyPage]);

  return (
    <div className={styles.settlementContainer}>
      
      {/* ── LEFT SIDEBAR: CUSTOMER SELECTION ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Credit Ledger</h2>
        </div>

        <div className={styles.searchContainer}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.sidebarSearch}
          />
        </div>

        <div className={styles.sidebarTabs}>
          {[
            { id: 'All', label: 'All' },
            { id: 'Outstanding', label: 'Dues' },
            { id: 'Advance', label: 'Advances' }
          ].map(tab => (
            <button 
              key={tab.id} 
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTabBtn : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.customerList}>
          {customers.map((customer, idx) => {
            const isSelected = selectedCustomer?.id === customer.id;
            const initials = customer.name 
              ? customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
              : '??';
            
            return (
              <div 
                key={customer.id} 
                className={`${styles.customerCard} ${isSelected ? styles.selectedCustomerCard : ''}`}
                onClick={() => setSelectedCustomer(customer)}
              >
                <div className={styles.custCardLeft}>
                  <div className={`${styles.avatarCircle} ${styles[`avatarColor${idx % 5}`]}`}>
                    {initials}
                  </div>
                  <div className={styles.custCardInfo}>
                    <span className={styles.custCardName}>{customer.name}</span>
                    <span className={styles.custCardPhone}>{customer.phone}</span>
                  </div>
                </div>
                <div className={styles.custCardRight}>
                  <span className={styles.custCardBalance}>
                    <CurrencySymbol size={11} /> {Math.abs(Number(customer.balance) || 0).toFixed(2)}
                  </span>
                  <span className={`${styles.statusBadge} ${
                    (Number(customer.balance) || 0) > 0 
                      ? styles.badgeDue 
                      : (Number(customer.balance) || 0) < 0 
                        ? styles.badgeAdv 
                        : styles.badgeSettled
                  }`}>
                    {(Number(customer.balance) || 0) > 0 ? 'Due' : (Number(customer.balance) || 0) < 0 ? 'Adv' : 'Settled'}
                  </span>
                </div>
              </div>
            );
          })}
          {customers.length === 0 && (
            <div className={styles.noCustomers}>No customers found.</div>
          )}
        </div>
      </aside>

      {/* ── RIGHT MAIN PANEL ── */}
      <main className={styles.mainPanel}>
        
        {/* If customer is NOT selected: Dashboard View */}
        {!selectedCustomer ? (
          <div className={styles.dashboardView}>
            <div className={styles.dashboardHeader}>
              <h1>Credit Settlements Dashboard</h1>
            </div>

            {/* Gradient KPI Cards */}
            <div className={styles.kpiGrid}>
              <div className={`${styles.kpiCardItem} ${styles.kpiReceivables}`}>
                <div className={styles.kpiIconWrapper}><AlertCircle size={24} /></div>
                <div className={styles.kpiItemContent}>
                  <span className={styles.kpiItemLabel}>Total Receivables</span>
                  <span className={styles.kpiItemValue}><CurrencySymbol size={18} /> {Number(kpis.outstanding || 0).toFixed(2)}</span>
                  <span className={styles.kpiItemSub}>{kpis.pendingCount || 0} pending collections</span>
                </div>
              </div>

              <div className={`${styles.kpiCardItem} ${styles.kpiAdvances}`}>
                <div className={styles.kpiIconWrapper}><Wallet size={24} /></div>
                <div className={styles.kpiItemContent}>
                  <span className={styles.kpiItemLabel}>Customer Advances</span>
                  <span className={styles.kpiItemValue}><CurrencySymbol size={18} /> {Number(kpis.advanceCredits || 0).toFixed(2)}</span>
                  <span className={styles.kpiItemSub}>Prepaid deposits</span>
                </div>
              </div>

              <div className={`${styles.kpiCardItem} ${styles.kpiSettled}`}>
                <div className={styles.kpiIconWrapper}><CheckCircle size={24} /></div>
                <div className={styles.kpiItemContent}>
                  <span className={styles.kpiItemLabel}>Monthly Collections</span>
                  <span className={styles.kpiItemValue}><CurrencySymbol size={18} /> {Number(kpis.settlements || 0).toFixed(2)}</span>
                  <span className={styles.kpiItemSub}>Collected this month</span>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* If customer IS selected: Focused Workspace View */
          <div className={styles.workspaceView}>
            
            {/* Workspace Hero Profile Header */}
            <div className={styles.workspaceHeader}>
              <div className={styles.profileRow}>
                <button 
                  className={styles.profileBackBtn} 
                  onClick={() => setSelectedCustomer(null)}
                  title="Close and return to dashboard"
                >
                  <ArrowLeft size={16} /> Dashboard
                </button>
                <div className={styles.profileMainInfo}>
                  <div className={styles.profileAvatar}>
                    {(selectedCustomer.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2>{selectedCustomer.name || 'Unknown Customer'}</h2>
                    <p>{selectedCustomer.phone || 'No Phone'} {selectedCustomer.address ? `• ${selectedCustomer.address}` : ''}</p>
                  </div>
                </div>
              </div>
              
              <div className={styles.headerButtons}>
                <button 
                  className={styles.btnSecondary} 
                  onClick={() => navigate(`/overdue-statement/${selectedCustomer.id}`)}
                >
                  <Printer size={16} /> Print {t('overdue', settings.language)} Statement
                </button>
                <button 
                  className={styles.btnSecondary} 
                  onClick={() => navigate(`/reports/customer-statement/${selectedCustomer.id}`)}
                >
                  <FileText size={16} /> Full Statement
                </button>
              </div>
            </div>

            {/* Dynamic Balance Card */}
            <div className={`${styles.balanceHeroCard} ${
              (Number(currentNetBalance) || 0) > 0 
                ? styles.balanceDueCard 
                : (Number(currentNetBalance) || 0) < 0 
                  ? styles.balanceAdvCard 
                  : styles.balanceSettledCard
            }`}>
              <div className={styles.balanceCardContent}>
                <span className={styles.balanceSubtitle}>
                  {(Number(currentNetBalance) || 0) > 0 
                    ? 'OUTSTANDING DEBT' 
                    : (Number(currentNetBalance) || 0) < 0 
                      ? 'PREPAID ACCOUNT ADVANCE' 
                      : 'ACCOUNT FULLY SETTLED'}
                </span>
                <h1 className={styles.balanceBigAmount}>
                  <CurrencySymbol size={32} /> {Math.abs(Number(currentNetBalance) || 0).toFixed(2)}
                </h1>
                <p className={styles.balanceStatusText}>
                  {(Number(currentNetBalance) || 0) > 0 
                    ? `This customer owes the shop ${Math.abs(Number(currentNetBalance) || 0).toFixed(2)}. Please record a payment to settle.`
                    : (Number(currentNetBalance) || 0) < 0 
                      ? `The customer has a credit balance of ${Math.abs(Number(currentNetBalance) || 0).toFixed(2)} available for future orders.`
                      : 'All credit invoices and payments for this customer are fully balanced.'}
                </p>
              </div>

              <div className={styles.balanceCardActions}>
                {(Number(currentNetBalance) || 0) > 0 ? (
                  <button 
                    className={`${styles.actionButton} ${styles.actionBtnSettle}`}
                    onClick={() => {
                      setPaymentAmount((Number(currentNetBalance) || 0).toFixed(2));
                      setShowPayModal(true);
                    }}
                  >
                    <DollarSign size={18} /> Settle Outstanding Dues
                  </button>
                ) : (
                  <button 
                    className={`${styles.actionButton} ${styles.actionBtnAdvance}`}
                    onClick={() => {
                      setPaymentAmount('');
                      setShowPayModal(true);
                    }}
                  >
                    <Plus size={18} /> Record Advance Deposit
                  </button>
                )}
                {(Number(currentNetBalance) || 0) > 0 && (
                  <button 
                    className={`${styles.actionButton} ${styles.actionBtnPrepay}`}
                    onClick={() => {
                      setPaymentAmount('');
                      setShowPayModal(true);
                    }}
                  >
                    <Plus size={16} /> Add Extra Advance
                  </button>
                )}
              </div>
            </div>

            {/* Workspace tabs for Pending Bills vs Settlement History */}
            <div className={styles.workspaceTabsCard}>
              <div className={styles.workspaceTabsHeader}>
                <div className={styles.tabsRow}>
                  <button 
                    className={`${styles.tabBtnItem} ${workspaceTab === 'pending' ? styles.activeTabBtnItem : ''}`}
                    onClick={() => setWorkspaceTab('pending')}
                  >
                    Pending Invoices ({globalData.pending.length})
                  </button>
                  <button 
                    className={`${styles.tabBtnItem} ${workspaceTab === 'history' ? styles.activeTabBtnItem : ''}`}
                    onClick={() => setWorkspaceTab('history')}
                  >
                    Settlement History ({globalData.history.length})
                  </button>
                </div>
              </div>

              <div className={styles.workspaceTabContent}>
                {workspaceTab === 'pending' ? (
                  <div className={styles.tableWrapper}>
                    <table className={styles.ledgerDetailsTable}>
                      <thead>
                        <tr>
                          <th>Invoice ID</th>
                          <th>Invoice Date</th>
                          <th>Total Amount</th>
                          <th>Paid Amount</th>
                          <th>Remaining Due</th>
                          <th>Status</th>
                          <th>Quick Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPending.map(bill => {
                          const invoiceDate = formatDate(bill.createdAt);
                          
                          return (
                            <tr key={bill.id}>
                              <td className={styles.billIdText}>{bill.id}</td>
                              <td>{invoiceDate}</td>
                              <td><CurrencySymbol size={10} /> {Number(bill.totalAmount || 0).toFixed(2)}</td>
                              <td className={styles.greenText}><CurrencySymbol size={10} /> {Number(bill.paidAmount || 0).toFixed(2)}</td>
                              <td className={styles.redAmountText}><CurrencySymbol size={10} /> {Number(bill.dueAmount || 0).toFixed(2)}</td>
                              <td>
                                <span className={`${styles.pillBadge} ${
                                  (bill.paidAmount || 0) > 0 ? styles.pillBadgePartial : styles.pillBadgeRed
                                }`}>
                                  {(bill.paidAmount || 0) > 0 ? 'Partial' : 'Credit'}
                                </span>
                              </td>
                              <td>
                                <button 
                                  className={styles.invoiceQuickPayBtn}
                                  onClick={() => {
                                    const due = Number(bill.dueAmount || 0);
                                    const defaultAmount = currentNetBalance > 0 ? Math.min(due, currentNetBalance) : due;
                                    setPaymentAmount(defaultAmount.toFixed(2));
                                    setShowPayModal(true);
                                  }}
                                >
                                  Settle Invoice
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {globalData.pending.length === 0 && (
                          <tr>
                            <td colSpan="7">
                              <div className={styles.workspaceAllSettled}>
                                <CheckCircle size={48} className={styles.checkSuccessIcon} />
                                <h3>All Invoices Settled</h3>
                                <p>This customer does not have any pending credit invoices.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    <Pagination
                      currentPage={pendingPage}
                      totalPages={Math.ceil(globalData.pending.length / 20)}
                      onPageChange={setPendingPage}
                      totalItems={globalData.pending.length}
                      pageSize={20}
                      itemLabel="pending invoices"
                    />
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.ledgerDetailsTable}>
                      <thead>
                        <tr>
                          <th>Receipt ID</th>
                          <th>Linked Invoice</th>
                          <th>Payment Date</th>
                          <th>Method</th>
                          <th>Amount Settled</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedHistory.map(pay => {
                          const payDate = formatDate(pay.createdAt);
                          
                          return (
                            <tr key={pay.id}>
                              <td className={styles.receiptIdText}>{pay.paymentReference || ((pay.id || '').split('-')[0] + '-' + ((pay.id || '').split('-')[1] || ''))}</td>
                              <td className={styles.boldText}>{pay.orderId ? pay.orderId : <span className={styles.advanceLabel}>Unlinked (Advance)</span>}</td>
                              <td>{payDate}</td>
                              <td className={styles.boldText}>{pay.method}</td>
                              <td className={styles.greenText}><CurrencySymbol size={10} /> {Number(pay.amount || 0).toFixed(2)}</td>
                              <td>
                                <span className={`${styles.pillBadge} ${styles.pillBadgeGreen}`}>SUCCESS</span>
                              </td>
                            </tr>
                          );
                        })}
                        {globalData.history.length === 0 && (
                          <tr>
                            <td colSpan="6">
                              <div className={styles.workspaceAllSettled}>
                                <History size={40} style={{ color: '#94a3b8', marginBottom: '0.75rem' }} />
                                <h3>No Settlement History</h3>
                                <p>No payment or settlement records found for this customer.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    <Pagination
                      currentPage={historyPage}
                      totalPages={Math.ceil(globalData.history.length / 20)}
                      onPageChange={setHistoryPage}
                      totalItems={globalData.history.length}
                      pageSize={20}
                      itemLabel="settlements"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── REDESIGNED PAYMENT MODAL (COMPACTED) ── */}
      {showPayModal && selectedCustomer && (
        <div className={styles.modalOverlay} onClick={() => setShowPayModal(false)}>
          <div className={styles.payModalCard} onClick={(e) => e.stopPropagation()}>
            
            <div className={styles.modalHeaderRow} style={{ padding: '1rem 1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem' }}>Record Settlement / Payment</h3>
                <p style={{ fontSize: '0.75rem' }}>{selectedCustomer.name || 'Unknown Customer'} • {selectedCustomer.phone || 'N/A'}</p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setShowPayModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBodyContent} style={{ gap: '0.85rem', padding: '1rem 1.25rem' }}>
              
              {/* Row with Received Amount & Discount Amount side-by-side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', alignItems: 'start' }}>
                {/* Received Amount Input */}
                <div className={styles.modalInputGroup} style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.7rem' }}>Received Amount</label>
                  <div className={styles.largeInputBox} style={{ height: '42px', padding: '0.4rem 0.8rem', borderRadius: '10px' }}>
                    <span className={styles.inputCurrency} style={{ fontSize: '1.1rem' }}><CurrencySymbol size={15} /></span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      autoFocus
                      disabled={paymentMethod === 'Multipayment'}
                      style={{ fontSize: '1.2rem', fontWeight: 800 }}
                    />
                  </div>
                  
                  {/* Quick Presets */}
                  <div className={styles.presetsRow} style={{ marginTop: '0.1rem', gap: '0.35rem' }}>
                    <button 
                      onClick={() => setPaymentAmount(Number(displayDue || 0).toFixed(2))} 
                      disabled={displayDue <= 0 || paymentMethod === 'Multipayment'}
                      style={{ padding: '0.2rem 0.35rem', fontSize: '0.65rem', borderRadius: '6px' }}
                    >
                      Full ({Number(displayDue || 0).toFixed(2)})
                    </button>
                    <button 
                      onClick={() => setPaymentAmount((Number(displayDue || 0) / 2).toFixed(2))} 
                      disabled={displayDue <= 0 || paymentMethod === 'Multipayment'}
                      style={{ padding: '0.2rem 0.35rem', fontSize: '0.65rem', borderRadius: '6px' }}
                    >
                      50%
                    </button>
                    <button 
                      onClick={() => setPaymentAmount('')} 
                      className={styles.presetClear} 
                      disabled={paymentMethod === 'Multipayment'}
                      style={{ padding: '0.2rem 0.35rem', fontSize: '0.65rem', borderRadius: '6px', maxWidth: '45px' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Discount Input Field */}
                <div className={styles.modalInputGroup} style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.7rem' }}>Discount Amount</label>
                  <div className={styles.largeInputBox} style={{ height: '42px', padding: '0.4rem 0.8rem', borderRadius: '10px' }}>
                    <span className={styles.inputCurrency} style={{ fontSize: '1.1rem' }}><CurrencySymbol size={15} /></span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      step="0.01"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      style={{ fontSize: '1.2rem', fontWeight: 800 }}
                    />
                  </div>
                  {/* Empty space matching height of presetsRow to balance alignment */}
                  <div style={{ height: '24px', marginTop: '0.1rem' }}></div>
                </div>
              </div>

              {/* Payment Method Cards */}
              <div className={styles.modalInputGroup} style={{ gap: '0.25rem' }}>
                <label style={{ fontSize: '0.7rem' }}>Payment Method</label>
                <div 
                  className={styles.methodCardsGrid} 
                  style={{ 
                    gridTemplateColumns: settings.enableNomod ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)',
                    gap: '0.5rem',
                    marginTop: '0.1rem'
                  }}
                >
                  {[
                    { id: 'Cash', label: 'Cash', icon: <Wallet size={16} /> },
                    { id: 'Card', label: 'Card', icon: <CreditCard size={16} /> },
                    { id: 'UPI', label: 'UPI', icon: <QrCode size={16} /> },
                    ...(settings.noModPayEnabled && settings.enableNomod ? [{ id: 'Nomod', label: 'Nomod', icon: <CreditCard size={16} /> }] : []),
                    { id: 'Multipayment', label: 'Split', icon: <Layers size={16} /> }
                  ].map(method => {
                    const isSelected = paymentMethod === method.id;
                    
                    return (
                      <div 
                        key={method.id} 
                        className={`${styles.methodCardItem} ${isSelected ? styles.activeMethodCard : ''}`}
                        onClick={() => setPaymentMethod(method.id)}
                        style={{ padding: '0.5rem 0.25rem', gap: '0.25rem', borderRadius: '10px' }}
                      >
                        <div className={styles.methodCardIcon} style={{ height: '20px' }}>{method.icon}</div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{method.label}</span>
                        {isSelected && <div className={styles.methodCheck} style={{ top: '3px', right: '3px' }}><Check size={8} /></div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Multipayment Breakdown Fields */}
              {paymentMethod === 'Multipayment' && (
                <div className={styles.modalInputGroup} style={{ marginTop: '0.1rem', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-sub)', textTransform: 'uppercase' }}>Split Breakdown</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
                    
                    {/* Cash split */}
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.35rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', background: '#F8FAFC' }}>
                      <span style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700 }}>Cash</span>
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>
                        <span style={{ marginRight: '0.1rem' }}><CurrencySymbol size={9} /></span>
                        <input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01"
                          value={cashAmount} 
                          onChange={(e) => setCashAmount(e.target.value)} 
                          style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    {/* Card split */}
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.35rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', background: '#F8FAFC' }}>
                      <span style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700 }}>Card</span>
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>
                        <span style={{ marginRight: '0.1rem' }}><CurrencySymbol size={9} /></span>
                        <input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01"
                          value={cardAmount} 
                          onChange={(e) => setCardAmount(e.target.value)} 
                          style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    {/* UPI split */}
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.35rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', background: '#F8FAFC' }}>
                      <span style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700 }}>UPI</span>
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>
                        <span style={{ marginRight: '0.1rem' }}><CurrencySymbol size={9} /></span>
                        <input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01"
                          value={upiAmount} 
                          onChange={(e) => setUpiAmount(e.target.value)} 
                          style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    {/* Bank split */}
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.35rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', background: '#F8FAFC' }}>
                      <span style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700 }}>Bank</span>
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>
                        <span style={{ marginRight: '0.1rem' }}><CurrencySymbol size={9} /></span>
                        <input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01"
                          value={bankAmount} 
                          onChange={(e) => setBankAmount(e.target.value)} 
                          style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {(paymentMethod === 'Card' || paymentMethod === 'UPI' || paymentMethod === 'Bank' || (paymentMethod === 'Multipayment' && (cardVal > 0 || upiVal > 0 || bankVal > 0))) && settings.bankAccounts?.length > 0 && (
                <div className={styles.modalInputGroup} style={{ marginTop: '0.1rem', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.7rem' }}>Select Bank Account</label>
                  <div className={styles.largeInputBox} style={{ height: '38px', padding: '0.3rem 0.75rem', borderRadius: '10px' }}>
                    <Landmark size={15} color="#2563EB" />
                    <select
                      style={{ border: 'none', width: '100%', outline: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                    >
                      {settings.bankAccounts.filter(acc => acc.isActive !== false).map((acc, idx) => (
                        <option key={idx} value={acc.id || acc.bankName}>
                          {acc.bankName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Live Preview Summary Box */}
              <div className={styles.liveSummaryBox} style={{ padding: '0.75rem 1rem', gap: '0.4rem', borderRadius: '12px' }}>
                <div className={styles.summaryRowItem} style={{ fontSize: '0.75rem' }}>
                  <span>Current Balance</span>
                  <span className={(Number(currentNetBalance) || 0) > 0 ? styles.outstandingText : (Number(currentNetBalance) || 0) < 0 ? styles.advanceText : ''}>
                    {(Number(currentNetBalance) || 0) > 0 ? 'Due ' : (Number(currentNetBalance) || 0) < 0 ? 'Adv ' : ''}
                    <CurrencySymbol size={10} /> {Math.abs(Number(currentNetBalance) || 0).toFixed(2)}
                  </span>
                </div>
                
                <div className={styles.summaryRowItem} style={{ fontSize: '0.75rem' }}>
                  <span>Payment Amount</span>
                  <span className={styles.paymentAddedText}>
                    + <CurrencySymbol size={10} /> {(parseFloat(paymentAmount) || 0).toFixed(2)}
                  </span>
                </div>

                {parseFloat(discountAmount) > 0 && (
                  <div className={styles.summaryRowItem} style={{ fontSize: '0.75rem' }}>
                    <span>Discount Amount</span>
                    <span style={{ color: '#EF4444', fontWeight: 700 }}>
                      + <CurrencySymbol size={10} /> {parseFloat(discountAmount).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className={styles.summaryDividerLine} style={{ margin: '0.1rem 0' }}></div>

                <div className={styles.summaryRowTotal} style={{ fontSize: '0.85rem' }}>
                  <span>
                    {(Number(simulatedNewBalance) || 0) > 0 
                      ? 'New Outstanding Balance' 
                      : (Number(simulatedNewBalance) || 0) < 0 
                        ? 'New Prepaid Advance' 
                        : 'Account Balance'}
                  </span>
                  <span className={`${styles.totalResultText} ${
                    (Number(simulatedNewBalance) || 0) > 0 
                      ? styles.outstandingText 
                      : (Number(simulatedNewBalance) || 0) < 0 
                        ? styles.advanceText 
                        : styles.settledText
                  }`} style={{ fontSize: '0.9rem' }}>
                    {(Number(simulatedNewBalance) || 0) === 0 ? 'Fully Settled' : (
                      <>
                        <CurrencySymbol size={11} /> {Math.abs(Number(simulatedNewBalance) || 0).toFixed(2)}
                      </>
                    )}
                  </span>
                </div>
              </div>

            </div>

            <div className={styles.modalFooterActions} style={{ padding: '0.85rem 1.25rem' }}>
              <button className={styles.btnSecondary} onClick={() => setShowPayModal(false)}>
                Cancel
              </button>
              <button 
                className={styles.btnConfirmSettle}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || loading}
                onClick={() => handleSettle(false)}
              >
                {loading ? 'Processing Settle...' : 'Confirm Payment Settlement'}
              </button>
            </div>

          </div>
        </div>
      )}

      {nomodLinkModal.show && (
        <div className={styles.modalOverlay} style={{ zIndex: 9999 }}>
          <div className={styles.payModalCard} style={{ width: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeaderRow}>
              <div>
                <h3>Nomod Payment Link</h3>
                <p>Share payment settlement link with {selectedCustomer.name}</p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setNomodLinkModal({ show: false, url: '', linkId: '', amount: 0 })}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBodyContent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 800 }}>SETTLEMENT AMOUNT</span>
                <h1 style={{ margin: '0.25rem 0 0 0', color: '#1E293B', fontSize: '2rem', fontWeight: 800 }}>
                  {settings.currencySymbol || 'AED'} {nomodLinkModal.amount.toFixed(2)}
                </h1>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                <div style={{ padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <QRCodeCanvas 
                    id="nomod-settle-qr-canvas"
                    value={nomodLinkModal.url}
                    size={160}
                    level="H"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      const canvas = document.getElementById('nomod-settle-qr-canvas');
                      if (canvas) {
                        if (window.electronAPI?.printHtml) {
                          window.electronAPI.printHtml({
                            html: `<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><img src="${canvas.toDataURL()}" style="width:300px;height:300px;"/></div>`,
                            css: '',
                            printerName: settings.billingPrinter,
                            silent: settings.silentPrinting !== false
                          });
                        } else {
                          const win = window.open('', '', 'width=400,height=400');
                          win.document.write(`<html><body style="display:flex;justify-content:center;align-items:center;height:90vh;"><img id="qr-img" src="${canvas.toDataURL()}" style="width:300px;height:300px;"/>
                          <script>
                            document.getElementById('qr-img').onload = function() {
                              window.print();
                              window.close();
                            };
                          </script>
                          </body></html>`);
                          win.document.close();
                        }
                      }
                    }}
                  >
                    Print QR
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      const canvas = document.getElementById('nomod-settle-qr-canvas');
                      if (canvas) {
                        const a = document.createElement('a');
                        a.download = `QR-${nomodLinkModal.linkId}.png`;
                        a.href = canvas.toDataURL();
                        a.click();
                      }
                    }}
                  >
                    Save QR
                  </button>
                </div>
              </div>

              <div className={styles.modalInputGroup}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Nomod Checkout URL</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="text"
                    readOnly
                    className={styles.sidebarSearch}
                    value={nomodLinkModal.url}
                    style={{ flex: 1, background: '#F1F5F9' }}
                  />
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(nomodLinkModal.url);
                      alert("Payment Link copied to clipboard!");
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ flex: '1 1 45%', padding: '0.75rem' }}
                  onClick={() => {
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(nomodLinkModal.url);
                    } else {
                      window.open(nomodLinkModal.url, '_blank');
                    }
                  }}
                >
                  Open Link
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ flex: '1 1 45%', padding: '0.75rem' }}
                  onClick={() => {
                    const text = `Please pay ${settings.currencySymbol || 'AED'} ${nomodLinkModal.amount.toFixed(2)} to settle your laundry balance: ${nomodLinkModal.url}`;
                    const phone = selectedCustomer?.phone || '';
                    let cleanPhone = phone.toString().replace(/\D/g, '');
                    let finalPhone = cleanPhone;
                    if (cleanPhone && !phone.toString().trim().startsWith('+')) {
                      const countryCode = settings.waCountryCode || '971';
                      const cleanCountryCode = countryCode.replace(/\D/g, '');
                      if (cleanCountryCode && !finalPhone.startsWith(cleanCountryCode)) {
                        finalPhone = cleanCountryCode + finalPhone;
                      }
                    }
                    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(url);
                    } else {
                      window.open(url, '_blank');
                    }
                  }}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ flex: '1 1 45%', padding: '0.75rem' }}
                  onClick={() => {
                    const smsUrl = `sms:${selectedCustomer?.phone || ''}?body=${encodeURIComponent(`Please pay ${settings.currencySymbol || 'AED'} ${nomodLinkModal.amount.toFixed(2)} to settle your laundry balance: ${nomodLinkModal.url}`)}`;
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(smsUrl);
                    } else {
                      window.open(smsUrl, '_blank');
                    }
                  }}
                >
                  SMS
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ flex: '1 1 45%', padding: '0.75rem' }}
                  onClick={() => {
                    const emailUrl = `mailto:${selectedCustomer?.email || ''}?subject=Laundry Settlement Payment&body=Please pay ${settings.currencySymbol || 'AED'} ${nomodLinkModal.amount.toFixed(2)} using this link: ${nomodLinkModal.url}`;
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(emailUrl);
                    } else {
                      window.open(emailUrl, '_blank');
                    }
                  }}
                >
                  Email
                </button>
              </div>
            </div>
            <div className={styles.modalFooterActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setNomodLinkModal({ show: false, url: '', linkId: '', amount: 0 })}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnConfirmSettle}
                onClick={async () => {
                  if (window.electronAPI?.dbQuery) {
                    await window.electronAPI.dbQuery(
                      `INSERT INTO payment_links (id, customerId, customerName, description, amount, channel, date, status, url, checkoutId) 
                       VALUES (?, ?, ?, ?, ?, 'Nomod', ?, 'Pending', ?, ?)`,
                      [
                        nomodLinkModal.linkId,
                        selectedCustomer.id,
                        selectedCustomer.name,
                        `Settlement of outstanding balance`,
                        nomodLinkModal.amount,
                        getLocalDateTime(),
                        nomodLinkModal.url,
                        nomodLinkModal.linkId
                      ]
                    );
                  }
                  
                  paymentService.startTracking(`SETTLE-${selectedCustomer.id.substring(0, 5)}`, nomodLinkModal.linkId);

                  setNomodLinkModal({ show: false, url: '', linkId: '', amount: 0 });
                  alert("Nomod payment link saved successfully. The system will verify status automatically in the background.");
                  if (selectedCustomer?.id) {
                    fetchCustomerDetails(selectedCustomer.id);
                  }
                }}
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreditWarning && creditWarningDetails && (
        <div className={styles.modalOverlay} onClick={handleCancelOverride}>
          <div className={styles.statusModal} style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: '#FEF2F2', borderBottom: '1px solid #FEE2E2', padding: '1.25rem 1.5rem', borderRadius: '12px 12px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={24} color="#EF4444" />
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444', fontWeight: 700 }}>
                    <span>Exceeded Amount:</span>
                    <span><CurrencySymbol size={14} /> {creditWarningDetails.exceededAmount.toFixed(2)}</span>
                  </div>
                </div>

                {settings.enableManagerOverride ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                      <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.25rem', fontWeight: 600 }}>{managerPinError}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '12px', padding: '0.75rem 1rem', color: '#C53030', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <AlertCircle size={18} />
                    <span>Credit Limit Protection is active and Manager Override is disabled.</span>
                  </div>
                )}
              </div>
              <div className={styles.modalFooterActions} style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '0 0 12px 12px' }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleCancelOverride}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                {creditWarningDetails.overrideAllowed && settings.enableManagerOverride && (
                  <button
                    type="submit"
                    className={styles.btnConfirmSettle}
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
