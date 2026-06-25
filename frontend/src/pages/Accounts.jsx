import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Wallet, Landmark, ArrowUpRight, ArrowDownLeft, 
  Plus, Search, Filter, Calendar, Printer,
  DollarSign, Receipt, CreditCard, ChevronRight,
  ArrowLeftRight, Trash2, CheckCircle, HelpCircle,
  Zap, Share2, Lock, Bell
} from 'lucide-react';
import CurrencySymbol from '../components/CurrencySymbol';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID } from '../constants';
import { getLocalDateBounds, localStrIsWithinBounds } from '../utils/dateFilters';
import { getLocalISOString, getLocalDateTime } from '../utils/dateUtils';
import Pagination from '../components/Pagination';
import styles from './Accounts.module.css';

const ICON_OPTIONS = [
  { id: 'DollarSign', icon: DollarSign, color: '#3B82F6' },
  { id: 'ShoppingBag', icon: DollarSign, color: '#10B981' },
  { id: 'Receipt', icon: Receipt, color: '#F59E0B' },
  { id: 'CreditCard', icon: CreditCard, color: '#8B5CF6' }
];

export default function Accounts() {
  const navigate = useNavigate();
  const { type } = useParams(); // 'cash' or 'bank'
  const activeAccountType = (type || 'cash').toUpperCase();

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAuthorized = user.role === 'super_admin' || user.role === 'manager';

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/');
    }
  }, [isAuthorized, navigate]);

  if (!isAuthorized) return null;
  
  const { settings, updateSettings, formatDate } = useSettings();
  
  /* ─── State ──────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState('Payments');
  const [notified, setNotified] = useState(false);
  const tabs = ['Payments', 'Payment links', 'Refunds'];
  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [refundsPage, setRefundsPage] = useState(1);
  
  const [dbCustomers, setDbCustomers] = useState([]);
  const [dbOrders, setDbOrders] = useState([]);

  // Payment Links State
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [showNewLinkCard, setShowNewLinkCard] = useState(false);
  const [linkFormData, setLinkFormData] = useState({
    customerId: '',
    description: '',
    amount: '',
    channel: 'Apple Pay'
  });

  // Refunds State
  const [refunds, setRefunds] = useState([]);
  const [showNewRefundCard, setShowNewRefundCard] = useState(false);
  const [refundFormData, setRefundFormData] = useState({
    orderId: '',
    amount: '',
    reason: 'Damaged Garment',
    accountId: 'CASH' // CASH or bank card uuid
  });

  // Balances Tab Reconciliations
  const [reconciliations, setReconciliations] = useState([]);
  const [showReconcileCard, setShowReconcileCard] = useState(false);
  const [reconcileFormData, setReconcileFormData] = useState({
    cashCounted: ''
  });

  // Payroll Calculation State
  const [payrollEmployees, setPayrollEmployees] = useState([]);
  const [payrollPayments, setPayrollPayments] = useState([]);
  const [showPayrollCalcCard, setShowPayrollCalcCard] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('EMP-1');
  const [payrollInputData, setPayrollInputData] = useState({
    daysWorked: 30,
    overtimeHours: 0,
    bonus: 0,
    deduction: 0,
    paymentAccount: 'CASH'
  });
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [activePayslip, setActivePayslip] = useState(null);

  // Payroll Accruals State
  const [accrualLogs, setAccrualLogs] = useState([]);
  const [showNewAccrualCard, setShowNewAccrualCard] = useState(false);
  const [accrualFormData, setAccrualFormData] = useState({
    employeeName: 'John Doe',
    type: 'Leave Salary Accrual',
    monthYear: 'June 2026',
    amount: ''
  });
  const [receivablesTotal, setReceivablesTotal] = useState(1450.00);
  const [advancesTotal, setAdvancesTotal] = useState(320.00);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('Today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  
  const [activeBankAccountId, setActiveBankAccountId] = useState(
    settings.bankAccounts && settings.bankAccounts.length > 0 ? settings.bankAccounts[0].id : ''
  );
  const [transferTargetId, setTransferTargetId] = useState('CASH');

  const [newAccountData, setNewAccountData] = useState({
    bankName: '',
    accountNumber: '',
    iban: ''
  });

  useEffect(() => {
    setCurrentPage(1);
    setRefundsPage(1);
  }, [searchTerm, dateRange, customStart, customEnd, activeAccountType, activeBankAccountId, activeTab]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setShowTransferModal(false);
        setShowAddAccountModal(false);
        setShowPayslipModal(false);
        setActivePayslip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const isAnyOpen = showAddModal || showTransferModal || showAddAccountModal || showPayslipModal;
    if (isAnyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddModal, showTransferModal, showAddAccountModal, showPayslipModal]);

  useEffect(() => {
    const list = settings.bankAccounts || [];
    if (list.length > 0) {
      if (!activeBankAccountId || !list.some(b => b.id === activeBankAccountId)) {
        setActiveBankAccountId(list[0].id);
      }
    } else {
      setActiveBankAccountId('');
    }
  }, [settings.bankAccounts, activeBankAccountId]);
  
  const [formData, setFormData] = useState({
    type: 'INCOME',
    category: 'Service Payment',
    amount: '',
    description: '',
    icon: 'DollarSign'
  });

  const [transferData, setTransferData] = useState({
    amount: '',
    note: ''
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        // Ensure table exists and has correct columns
        await window.electronAPI.dbQuery(`
          CREATE TABLE IF NOT EXISTS account_transactions (
            id TEXT PRIMARY KEY,
            shopId TEXT,
            accountType TEXT,
            type TEXT,
            category TEXT,
            amount REAL,
            description TEXT,
            date TEXT,
            isSynced INTEGER DEFAULT 0,
            updatedAt TEXT,
            icon TEXT,
            bankAccountId TEXT
          )
        `, []);

        // Compatibility checks
        try { await window.electronAPI.dbQuery('ALTER TABLE account_transactions ADD COLUMN icon TEXT', []); } catch(e) {}
        try { await window.electronAPI.dbQuery('ALTER TABLE account_transactions ADD COLUMN bankAccountId TEXT', []); } catch(e) {}

        // Fetch ALL transactions to compute balances for both cards in real-time
        const res = await window.electronAPI.dbQuery(
          'SELECT * FROM account_transactions ORDER BY date DESC', 
          []
        );
        
        if (res.success) {
          setTransactions(res.data);
          
          // Fetch order-customer lookup
          const orderCustomerRes = await window.electronAPI.dbQuery(`
            SELECT o.id, c.name AS customerName 
            FROM orders o 
            LEFT JOIN customers c ON o.customerId = c.id
            UNION ALL
            SELECT id, customerName 
            FROM deleted_orders
          `, []);
          
          const orderCustomerMap = {};
          if (orderCustomerRes.success) {
            orderCustomerRes.data.forEach(row => {
              orderCustomerMap[row.id] = row.customerName;
            });
          }

          // Build refunds list dynamically from returns/refund transactions
          const returnTxns = res.data.filter(t => t.category === 'Return' || t.category === 'Refund Return');
          const mappedRefunds = returnTxns.map(t => {
            const orderIdMatch = t.description.match(/Bill\s*(?:#|##)?([A-Za-z0-9_-]+)/i);
            const orderId = orderIdMatch ? orderIdMatch[1] : '';
            
            let reason = 'Damaged Garment';
            if (t.description.startsWith('Return - Bill')) {
              reason = 'Order Deleted';
            } else {
              const reasonParts = t.description.split(' - ');
              if (reasonParts.length > 1) {
                reason = reasonParts[1];
              }
            }

            let accountLabel = 'Cash';
            if (t.accountType === 'BANK') {
              const bank = settings.bankAccounts?.find(b => b.id === t.bankAccountId);
              accountLabel = bank ? bank.bankName : 'Bank';
            }

            return {
              id: t.id,
              date: t.date,
              orderId: orderId,
              customerName: orderCustomerMap[orderId] || 'Walk-in Customer',
              amount: t.amount,
              reason: reason,
              account: accountLabel,
              status: 'Processed'
            };
          });
          setRefunds(mappedRefunds);
        }

        // Fetch Customers
        const custRes = await window.electronAPI.dbQuery('SELECT * FROM customers ORDER BY name ASC', []);
        if (custRes.success) {
          setDbCustomers(custRes.data);
        }

        // Fetch Orders for Refund Dropdown
        const orderRes = await window.electronAPI.dbQuery("SELECT * FROM orders WHERE paymentStatus IN ('Paid', 'Partially Paid') ORDER BY createdAt DESC", []);
        if (orderRes.success) {
          setDbOrders(orderRes.data);
        }

        // Outstanding receivables
        const recRes = await window.electronAPI.dbQuery("SELECT SUM(dueAmount) as total FROM orders WHERE status != 'Cancelled' AND paymentStatus != 'Paid'", []);
        if (recRes.success && recRes.data[0]?.total !== null) {
          setReceivablesTotal(recRes.data[0].total);
        }

        // Customer advances
        const advRes = await window.electronAPI.dbQuery("SELECT SUM(ABS(balance)) as total FROM customers WHERE balance < 0", []);
        if (advRes.success && advRes.data[0]?.total !== null) {
          setAdvancesTotal(advRes.data[0].total);
        }

        // Load Payment Links
        const paymentLinksRes = await window.electronAPI.dbQuery("SELECT * FROM payment_links ORDER BY date DESC", []);
        if (paymentLinksRes.success) {
          setPaymentLinks(paymentLinksRes.data);
        }

        // Load Reconciliations
        const reconciliationsRes = await window.electronAPI.dbQuery("SELECT * FROM reconciliations ORDER BY date DESC", []);
        if (reconciliationsRes.success) {
          setReconciliations(reconciliationsRes.data);
        }

        // Load Payroll Employees
        const payrollEmployeesRes = await window.electronAPI.dbQuery("SELECT * FROM payroll_employees ORDER BY name ASC", []);
        if (payrollEmployeesRes.success) {
          setPayrollEmployees(payrollEmployeesRes.data);
        }

        // Load Payroll Payments
        const payrollPaymentsRes = await window.electronAPI.dbQuery("SELECT * FROM payroll_payments ORDER BY date DESC", []);
        if (payrollPaymentsRes.success) {
          setPayrollPayments(payrollPaymentsRes.data);
        }

        // Load Accrual Logs
        const accrualLogsRes = await window.electronAPI.dbQuery("SELECT * FROM accrual_logs ORDER BY date DESC", []);
        if (accrualLogsRes.success) {
          setAccrualLogs(accrualLogsRes.data);
        }
      } catch (err) {
        console.error("Fetch account data error:", err);
      } finally {
        setLoading(false);
      }
    } else {
      // Mock Data for Demo
      const mockData = [
        { id: '1', date: '2026-06-15 10:30', accountType: 'CASH', category: 'Service Payment', description: 'Order #AG-8829', amount: 125.50, type: 'INCOME', icon: 'DollarSign' },
        { id: '2', date: '2026-06-15 09:15', accountType: 'CASH', category: 'Supplies', description: 'Bought Detergent', amount: 45.00, type: 'EXPENSE', icon: 'Receipt' },
        { id: '3', date: '2026-06-14 16:45', accountType: 'BANK', category: 'Service Payment', description: 'Order #AG-8828', amount: 85.00, type: 'INCOME', icon: 'CreditCard' },
      ];
      setTransactions(mockData);

      const mockRefunds = [
        { id: 'RFD-1001', date: '2026-06-15 11:30', orderId: 'AG-44282', customerName: 'David Miller', amount: 75.00, reason: 'Damaged Garment', account: 'Cash', status: 'Processed' },
        { id: 'RFD-1002', date: '2026-06-14 15:40', orderId: 'AG-44283', customerName: 'Emily Watson', amount: 110.00, reason: 'Customer Dissatisfied', account: 'Emirates NBD', status: 'Processed' }
      ];
      setRefunds(mockRefunds);

      const mockCusts = [
        { id: 'CUST-001', name: 'Muhammed Ali', phone: '0501111111', balance: 350.00 },
        { id: 'CUST-002', name: 'Sarah Connor', phone: '0502222222', balance: 0 },
        { id: 'CUST-003', name: 'John Doe', phone: '0503333333', balance: 480.00 }
      ];
      setDbCustomers(mockCusts);

      const mockOrders = [
        { id: 'AG-44280', billNumber: '44280', customerId: 'CUST-001', totalAmount: 350.00, paidAmount: 0.00, dueAmount: 350.00, paymentStatus: 'Unpaid', createdAt: '2026-06-16' },
        { id: 'AG-44281', billNumber: '44281', customerId: 'CUST-002', totalAmount: 125.00, paidAmount: 125.00, dueAmount: 0.00, paymentStatus: 'Paid', createdAt: '2026-06-15' },
        { id: 'AG-44282', billNumber: '44282', customerId: 'CUST-003', totalAmount: 480.00, paidAmount: 480.00, dueAmount: 0.00, paymentStatus: 'Paid', createdAt: '2026-06-14' }
      ];
      setDbOrders(mockOrders);

      const mockPaymentLinks = [
        { id: 'LNK-1001', customerName: 'Muhammed Ali', description: 'Order #AG-44280', amount: 350.00, channel: 'Apple Pay', date: '2026-06-16 10:15', status: 'Active', url: 'https://pay.lundry.ae/lnk/AG-44280' },
        { id: 'LNK-1002', customerName: 'Sarah Connor', description: 'Order #AG-44281', amount: 125.00, channel: 'Visa', date: '2026-06-15 14:20', status: 'Paid', url: 'https://pay.lundry.ae/lnk/AG-44281' },
        { id: 'LNK-1003', customerName: 'John Doe', description: 'Outstanding Balance', amount: 480.00, channel: 'Google Pay', date: '2026-06-14 09:00', status: 'Expired', url: 'https://pay.lundry.ae/lnk/AG-JD02' }
      ];
      setPaymentLinks(mockPaymentLinks);

      const mockReconciliations = [
        { id: 'REC-1001', date: '2026-06-15 22:00', cashCounted: 450.00, cashExpected: 450.00, status: 'Matched', verifiedBy: 'Super Admin' },
        { id: 'REC-1002', date: '2026-06-14 22:00', cashCounted: 320.00, cashExpected: 325.00, status: 'Discrepancy (-5.00)', verifiedBy: 'Super Admin' }
      ];
      setReconciliations(mockReconciliations);

      const mockPayrollEmployees = [
        { id: 'EMP-1', name: 'John Doe', role: 'Cashier', baseSalary: 3500 },
        { id: 'EMP-2', name: 'Alice Smith', role: 'Washer', baseSalary: 4000 },
        { id: 'EMP-3', name: 'Bob Jones', role: 'Delivery Agent', baseSalary: 3200 },
        { id: 'EMP-4', name: 'Emily Rose', role: 'Ironer', baseSalary: 3800 }
      ];
      setPayrollEmployees(mockPayrollEmployees);

      const mockPayrollPayments = [
        { id: 'PR-1001', month: 'May 2026', employeeName: 'John Doe', role: 'Cashier', base: 3500, daysWorked: 30, overtime: 12, bonus: 150, deduction: 0, net: 3770, status: 'Paid', date: '2026-05-31' },
        { id: 'PR-1002', month: 'May 2026', employeeName: 'Alice Smith', role: 'Washer', base: 4000, daysWorked: 28, overtime: 5, bonus: 0, deduction: 100, net: 3733, status: 'Paid', date: '2026-05-31' }
      ];
      setPayrollPayments(mockPayrollPayments);

      const mockAccrualLogs = [
        { id: 'ACR-1001', date: '2026-06-15', employeeName: 'John Doe', type: 'Leave Salary Accrual', monthYear: 'June 2026', amount: 291.67, status: 'Accrued' },
        { id: 'ACR-1002', date: '2026-06-15', employeeName: 'Alice Smith', type: 'Gratuity / End of Service Accrual', monthYear: 'June 2026', amount: 333.33, status: 'Accrued' },
        { id: 'ACR-1003', date: '2026-06-15', employeeName: 'Bob Jones', type: 'Leave Salary Accrual', monthYear: 'June 2026', amount: 266.67, status: 'Accrued' }
      ];
      setAccrualLogs(mockAccrualLogs);

      setLoading(false);
    }
  };

  /* ─── Balance Calculations ────────────────────────── */
  const cashTxns = useMemo(() => transactions.filter(t => t.accountType === 'CASH'), [transactions]);

  const cashBalance = useMemo(() => {
    const income = cashTxns.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const expense = cashTxns.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    return income - expense;
  }, [cashTxns]);

  const bankBalances = useMemo(() => {
    const balances = {};
    const bankAccountsList = settings.bankAccounts || [];
    
    bankAccountsList.forEach(bank => {
      balances[bank.id] = 0;
    });
    
    let unassigned = 0;
    
    transactions.forEach(t => {
      if (t.accountType === 'BANK') {
        const amt = t.type === 'INCOME' ? t.amount : -t.amount;
        if (t.bankAccountId && balances[t.bankAccountId] !== undefined) {
          balances[t.bankAccountId] += amt;
        } else {
          unassigned += amt;
        }
      }
    });
    
    if (bankAccountsList.length > 0) {
      balances[bankAccountsList[0].id] += unassigned;
    } else {
      balances['default'] = unassigned;
    }
    
    return balances;
  }, [transactions, settings.bankAccounts]);

  const bankBalance = useMemo(() => {
    return Object.values(bankBalances).reduce((sum, val) => sum + val, 0);
  }, [bankBalances]);

  /* ─── Quick Actions ──────────────────────────────── */
  const handleOpenAddModal = (txnType) => {
    setFormData({
      type: txnType,
      category: txnType === 'INCOME' ? 'Service Payment' : 'Supplies',
      amount: '',
      description: '',
      icon: txnType === 'INCOME' ? 'DollarSign' : 'Receipt'
    });
    setShowAddModal(true);
  };

  const handleOpenTransferModal = () => {
    const source = activeAccountType;
    if (source === 'CASH') {
      setTransferTargetId(settings.bankAccounts?.length > 0 ? settings.bankAccounts[0].id : 'BANK');
    } else {
      setTransferTargetId('CASH');
    }
    setTransferData({ amount: '', note: '' });
    setShowTransferModal(true);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (window.electronAPI?.dbQuery) {
      try {
        const id = `TXN-${Date.now()}`;
        const timestamp = getLocalDateTime();
        const nowIso = getLocalISOString();
        
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            id, 
            DEFAULT_SHOP_ID, 
            activeAccountType, 
            formData.type, 
            formData.category, 
            parseFloat(formData.amount), 
            formData.description, 
            timestamp, 
            nowIso,
            formData.icon,
            activeAccountType === 'BANK' ? activeBankAccountId : null
          ]
        );
        
        if (formData.type === 'EXPENSE') {
          await window.electronAPI.dbQuery(
            `INSERT INTO expenses 
             (id, shopId, title, amount, taxAmount, isTaxEnabled, taxMethod, category, date, updatedAt) 
             VALUES (?, ?, ?, ?, 0, 0, 'inclusive', ?, ?, ?)`,
            [
              id,
              DEFAULT_SHOP_ID,
              formData.description,
              parseFloat(formData.amount),
              formData.category,
              timestamp,
              nowIso
            ]
          );
        }
        
        setShowAddModal(false);
        fetchData();
      } catch (err) {
        console.error("Add transaction error:", err);
        alert("Failed to save transaction.");
      }
    } else {
      // Mock insert
      const newTx = {
        id: `TXN-${Date.now()}`,
        date: getLocalDateTime(),
        accountType: activeAccountType,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type,
        icon: formData.icon,
        bankAccountId: activeAccountType === 'BANK' ? activeBankAccountId : null
      };
      setTransactions(prev => [newTx, ...prev]);
      setShowAddModal(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    const amount = parseFloat(transferData.amount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }

    const source = activeAccountType;
    const target = transferTargetId === 'CASH' ? 'CASH' : 'BANK';
    const targetBankId = transferTargetId !== 'CASH' ? (transferTargetId === 'BANK' ? null : transferTargetId) : null;
    const sourceBankId = source === 'BANK' ? activeBankAccountId : null;

    let sourceName = '';
    let sourceBalanceVal = 0;
    if (source === 'CASH') {
      sourceName = 'Cash';
      sourceBalanceVal = cashBalance;
    } else {
      const activeBank = settings.bankAccounts?.find(b => b.id === activeBankAccountId);
      sourceName = activeBank ? activeBank.bankName : 'Bank';
      sourceBalanceVal = activeBank ? (bankBalances[activeBank.id] || 0) : 0;
    }

    let targetName = '';
    if (transferTargetId === 'CASH') {
      targetName = 'Cash';
    } else {
      const targetBank = settings.bankAccounts?.find(b => b.id === transferTargetId);
      targetName = targetBank ? targetBank.bankName : 'Bank';
    }

    if (amount > sourceBalanceVal) {
      if (!window.confirm(`Warning: Source account "${sourceName}" has insufficient funds (${sourceBalanceVal.toFixed(2)} available). Proceed anyway?`)) return;
    }

    if (window.electronAPI?.dbQuery) {
      try {
        const timestamp = getLocalDateTime();
        const nowIso = getLocalISOString();
        
        // 1. Create Expense from Source Account
        const sourceTxnId = `TXN-XFER-OUT-${Date.now()}`;
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            sourceTxnId,
            DEFAULT_SHOP_ID,
            source,
            'EXPENSE',
            'Transfer',
            amount,
            `Transfer to ${targetName}${transferData.note ? ` (${transferData.note})` : ''}`,
            timestamp,
            nowIso,
            'Receipt',
            sourceBankId
          ]
        );

        // 2. Create Income to Target Account
        const targetTxnId = `TXN-XFER-IN-${Date.now()}`;
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            targetTxnId,
            DEFAULT_SHOP_ID,
            target,
            'INCOME',
            'Transfer',
            amount,
            `Transfer from ${sourceName}${transferData.note ? ` (${transferData.note})` : ''}`,
            timestamp,
            nowIso,
            'DollarSign',
            targetBankId
          ]
        );

        setShowTransferModal(false);
        setTransferData({ amount: '', note: '' });
        fetchData();
        alert(`Successfully transferred ${amount.toFixed(2)} ${settings.currencySymbol || 'AED'} from ${sourceName} to ${targetName}.`);
      } catch (err) {
        console.error("Transfer error:", err);
        alert("Transfer failed: " + err.message);
      }
    } else {
      // Mock transfer
      const timestamp = getLocalDateTime();
      const mockOut = {
        id: `TXN-XFER-OUT-${Date.now()}`,
        date: timestamp,
        accountType: source,
        category: 'Transfer',
        description: `Transfer to ${targetName}`,
        amount: amount,
        type: 'EXPENSE',
        icon: 'Receipt',
        bankAccountId: sourceBankId
      };
      const mockIn = {
        id: `TXN-XFER-IN-${Date.now()}`,
        date: timestamp,
        accountType: target,
        category: 'Transfer',
        description: `Transfer from ${sourceName}`,
        amount: amount,
        type: 'INCOME',
        icon: 'DollarSign',
        bankAccountId: targetBankId
      };
      setTransactions(prev => [mockOut, mockIn, ...prev]);
      setShowTransferModal(false);
      setTransferData({ amount: '', note: '' });
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction? This will not affect any customer statements if it was linked to an order payment.")) return;
    
    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery('DELETE FROM account_transactions WHERE id = ?', [id]);
        await window.electronAPI.dbQuery('DELETE FROM expenses WHERE id = ?', [id]);
        fetchData();
      } catch (err) {
        console.error("Delete transaction error:", err);
        alert("Failed to delete transaction.");
      }
    } else {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  /* ─── Filtering & Search ──────────────────────────── */
  const activeTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (activeAccountType === 'CASH') {
        return t.accountType === 'CASH';
      } else {
        if (settings.bankAccounts && settings.bankAccounts.length > 0) {
          const firstBankId = settings.bankAccounts[0].id;
          if (activeBankAccountId === firstBankId) {
            return t.accountType === 'BANK' && 
              (t.bankAccountId === activeBankAccountId || 
               !t.bankAccountId || 
               !settings.bankAccounts.some(b => b.id === t.bankAccountId));
          } else {
            return t.accountType === 'BANK' && t.bankAccountId === activeBankAccountId;
          }
        } else {
          return t.accountType === 'BANK';
        }
      }
    });
  }, [transactions, activeAccountType, activeBankAccountId, settings.bankAccounts]);

  const filteredTransactions = useMemo(() => {
    const bounds = getLocalDateBounds(dateRange, customStart, customEnd);
    return activeTransactions.filter(t => {
      const matchesSearch = 
        t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (bounds === false) return false; // Custom bounds selected but empty
      if (bounds === null) return true;   // All time
      return localStrIsWithinBounds(t.date, bounds);
    });
  }, [activeTransactions, searchTerm, dateRange, customStart, customEnd]);

  // Aggregate stats for the active filtered set
  const filteredIncome = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const filteredExpense = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * 20;
    return filteredTransactions.slice(startIndex, startIndex + 20);
  }, [filteredTransactions, currentPage]);

  const paginatedRefunds = useMemo(() => {
    const startIndex = (refundsPage - 1) * 20;
    return refunds.slice(startIndex, startIndex + 20);
  }, [refunds, refundsPage]);

  // Payment link handler
  const handleCreatePaymentLink = async (e) => {
    e.preventDefault();
    if (!linkFormData.customerId || !linkFormData.amount) {
      alert("Please fill in all fields");
      return;
    }
    const customer = dbCustomers.find(c => c.id === linkFormData.customerId) || { name: 'Walk-in Customer' };
    const linkId = `LNK-${Date.now().toString().slice(-4)}`;
    const orderRef = linkFormData.description.trim() || `Ref #${Math.floor(1000 + Math.random() * 9000)}`;
    const amountVal = parseFloat(linkFormData.amount);
    
    const newLink = {
      id: linkId,
      customerId: linkFormData.customerId,
      customerName: customer.name,
      description: orderRef,
      amount: amountVal,
      channel: linkFormData.channel,
      date: getLocalDateTime(),
      status: 'Active',
      url: `https://pay.lundry.ae/lnk/${linkId.toLowerCase()}`
    };

    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery(
          `INSERT INTO payment_links (id, customerId, customerName, description, amount, channel, date, status, url) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newLink.id, newLink.customerId, newLink.customerName, newLink.description, newLink.amount, newLink.channel, newLink.date, newLink.status, newLink.url]
        );
        fetchData();
      } catch (err) {
        console.error("Database payment link insert failed:", err);
      }
    } else {
      setPaymentLinks(prev => [newLink, ...prev]);
    }
    setShowNewLinkCard(false);
    setLinkFormData({ customerId: '', description: '', amount: '', channel: 'Apple Pay' });
  };

  // Refund handler
  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!refundFormData.orderId || !refundFormData.amount) {
      alert("Please select an order and amount");
      return;
    }
    const order = dbOrders.find(o => o.id === refundFormData.orderId);
    const amountVal = parseFloat(refundFormData.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    let accountLabel = 'Cash';
    if (refundFormData.accountId !== 'CASH') {
      const bank = settings.bankAccounts?.find(b => b.id === refundFormData.accountId);
      accountLabel = bank ? bank.bankName : 'Bank';
    }

    if (window.electronAPI?.dbQuery) {
      try {
        const id = `TXN-RFD-${Date.now()}`;
        const timestamp = getLocalDateTime();
        const nowIso = getLocalISOString();
        
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            id, 
            DEFAULT_SHOP_ID, 
            refundFormData.accountId === 'CASH' ? 'CASH' : 'BANK', 
            'EXPENSE', 
            'Return', 
            amountVal, 
            `Refund for Bill #${refundFormData.orderId} - ${refundFormData.reason}`, 
            timestamp, 
            nowIso,
            'Receipt',
            refundFormData.accountId === 'CASH' ? null : refundFormData.accountId
          ]
        );
        fetchData();
      } catch (err) {
        console.error("Database refund insertion failed:", err);
      }
    }

    const newRefund = {
      id: `RFD-${Date.now().toString().slice(-4)}`,
      date: getLocalDateTime(),
      orderId: refundFormData.orderId,
      customerName: order ? (dbCustomers.find(c => c.id === order.customerId)?.name || 'Customer') : 'Walk-in Customer',
      amount: amountVal,
      reason: refundFormData.reason,
      account: accountLabel,
      status: 'Processed'
    };

    setRefunds(prev => [newRefund, ...prev]);
    setShowNewRefundCard(false);
    setRefundFormData({ orderId: '', amount: '', reason: 'Damaged Garment', accountId: 'CASH' });
    alert(`Refund of ${amountVal.toFixed(2)} ${settings.currencySymbol || 'AED'} successfully processed.`);
  };

  // Reconciliation handler
  const handlePostReconciliation = async (e) => {
    e.preventDefault();
    const countedVal = parseFloat(reconcileFormData.cashCounted);
    if (isNaN(countedVal) || countedVal < 0) {
      alert("Please enter a valid count");
      return;
    }

    const difference = countedVal - cashBalance;
    let statusLabel = 'Matched';
    if (difference !== 0) {
      statusLabel = `Discrepancy (${difference > 0 ? '+' : ''}${difference.toFixed(2)})`;
    }

    const newRec = {
      id: `REC-${Date.now().toString().slice(-4)}`,
      date: getLocalDateTime(),
      cashCounted: countedVal,
      cashExpected: cashBalance,
      status: statusLabel,
      verifiedBy: user.name || 'Manager'
    };

    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery(
          `INSERT INTO reconciliations (id, date, cashCounted, cashExpected, status, verifiedBy) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newRec.id, newRec.date, newRec.cashCounted, newRec.cashExpected, newRec.status, newRec.verifiedBy]
        );
        fetchData();
      } catch (err) {
        console.error("Database reconciliation insert failed:", err);
      }
    } else {
      setReconciliations(prev => [newRec, ...prev]);
    }
    setShowReconcileCard(false);
    setReconcileFormData({ cashCounted: '' });
  };

  // Payroll calculate handler
  const handleCalculatePayroll = (e) => {
    e.preventDefault();
    const employee = payrollEmployees.find(emp => emp.id === selectedEmployeeId);
    if (!employee) return;

    const days = parseInt(payrollInputData.daysWorked);
    const otHours = parseFloat(payrollInputData.overtimeHours);
    const bonusVal = parseFloat(payrollInputData.bonus) || 0;
    const deductionVal = parseFloat(payrollInputData.deduction) || 0;

    const baseVal = employee.baseSalary;
    const dailyRate = baseVal / 30;
    const otRate = (baseVal / 30 / 8) * 1.5;

    const netSalary = Math.round((dailyRate * days) + (otRate * otHours) + bonusVal - deductionVal);

    const newPayslip = {
      id: `PR-${Date.now().toString().slice(-4)}`,
      month: 'June 2026',
      employeeName: employee.name,
      role: employee.role,
      base: baseVal,
      daysWorked: days,
      overtime: otHours,
      bonus: bonusVal,
      deduction: deductionVal,
      net: netSalary,
      status: 'Calculated',
      date: getLocalDateTime()
    };

    setActivePayslip(newPayslip);
    setShowPayslipModal(true);
  };

  // Payroll payout handler
  const handlePaySalary = async () => {
    if (!activePayslip) return;
    
    if (window.electronAPI?.dbQuery) {
      try {
        const id = `TXN-PR-${Date.now()}`;
        const timestamp = getLocalDateTime();
        const nowIso = getLocalISOString();
        
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            id, 
            DEFAULT_SHOP_ID, 
            payrollInputData.paymentAccount === 'CASH' ? 'CASH' : 'BANK', 
            'EXPENSE', 
            'Salaries', 
            activePayslip.net, 
            `Salary Payment for ${activePayslip.employeeName} - June 2026`, 
            timestamp, 
            nowIso,
            'Receipt',
            payrollInputData.paymentAccount === 'CASH' ? null : payrollInputData.paymentAccount
          ]
        );
        const expenseId = `EXP-PR-${Date.now()}`;
        await window.electronAPI.dbQuery(
          `INSERT INTO expenses 
           (id, shopId, title, amount, taxAmount, isTaxEnabled, taxMethod, category, date, updatedAt) 
           VALUES (?, ?, ?, ?, 0, 0, 'inclusive', 'Salaries', ?, ?)`,
          [
            expenseId,
            DEFAULT_SHOP_ID,
            `Salary Payment for ${activePayslip.employeeName} - June 2026`,
            activePayslip.net,
            timestamp,
            nowIso
          ]
        );

        // Also insert into payroll_payments table
        await window.electronAPI.dbQuery(
          `INSERT INTO payroll_payments (id, month, employeeName, role, base, daysWorked, overtime, bonus, deduction, net, status, date) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', ?)`,
          [
            activePayslip.id,
            activePayslip.month,
            activePayslip.employeeName,
            activePayslip.role,
            activePayslip.base,
            activePayslip.daysWorked,
            activePayslip.overtime,
            activePayslip.bonus,
            activePayslip.deduction,
            activePayslip.net,
            activePayslip.date.split(' ')[0]
          ]
        );

        fetchData();
      } catch (err) {
        console.error("Database salary payment insertion failed:", err);
      }
    }

    const paidPayslip = {
      ...activePayslip,
      status: 'Paid',
      date: getLocalDateTime().split(' ')[0]
    };

    if (!window.electronAPI?.dbQuery) {
      setPayrollPayments(prev => [paidPayslip, ...prev]);
    }
    setShowPayslipModal(false);
    setShowPayrollCalcCard(false);
    setActivePayslip(null);
    alert(`Salary payment of ${paidPayslip.net.toFixed(2)} ${settings.currencySymbol || 'AED'} to ${paidPayslip.employeeName} processed successfully.`);
  };

  // Accrual post handler
  const handlePostAccrual = async (e) => {
    e.preventDefault();
    const amt = parseFloat(accrualFormData.amount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    const newAccrual = {
      id: `ACR-${Date.now().toString().slice(-4)}`,
      date: getLocalDateTime().split(' ')[0],
      employeeName: accrualFormData.employeeName,
      type: accrualFormData.type,
      monthYear: accrualFormData.monthYear,
      amount: amt,
      status: 'Accrued'
    };

    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery(
          `INSERT INTO accrual_logs (id, date, employeeName, type, monthYear, amount, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newAccrual.id, newAccrual.date, newAccrual.employeeName, newAccrual.type, newAccrual.monthYear, newAccrual.amount, newAccrual.status]
        );
        fetchData();
      } catch (err) {
        console.error("Database accrual insert failed:", err);
      }
    } else {
      setAccrualLogs(prev => [newAccrual, ...prev]);
    }
    setShowNewAccrualCard(false);
    setAccrualFormData({ employeeName: 'John Doe', type: 'Leave Salary Accrual', monthYear: 'June 2026', amount: '' });
  };

  /* ─── Print Report ────────────────────────────────── */
  const handlePrint = () => {
    window.print();
  };

  const renderDescriptionWithLinks = (description) => {
    if (!description) return 'Manual Entry';

    // 1. Check if it is a settlement description with a customer name
    if (description.startsWith('Settlement from ')) {
      const remainingText = description.substring('Settlement from '.length);
      const matchedCustomer = [...dbCustomers]
        .sort((a, b) => b.name.length - a.name.length)
        .find(c => remainingText.toLowerCase().startsWith(c.name.toLowerCase()));

      if (matchedCustomer) {
        const nameLen = matchedCustomer.name.length;
        const customerNameInText = remainingText.substring(0, nameLen);
        const suffix = remainingText.substring(nameLen);
        return (
          <>
            Settlement from{' '}
            <span
              className={styles.billLink}
              onClick={() => navigate(`/reports/customer-statement/${matchedCustomer.id}`)}
            >
              {customerNameInText}
            </span>
            {suffix}
          </>
        );
      }
    }

    // 2. Default order ID linker
    const regex = /(#[a-zA-Z0-9_-]+)/g;
    const parts = description.split(regex);
    if (parts.length === 1) return description;
    
    return parts.map((part, index) => {
      if (regex.test(part)) {
        const orderIdClean = part.replace('#', '');
        return (
          <span 
            key={index} 
            className={styles.billLink} 
            onClick={() => navigate(`/invoice/${orderIdClean}`)}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={styles.page}>
      
      <div className={styles.topTabBar} data-noprint="true">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Payments' ? (
        <div className={styles.splitLayout}>
        
        {/* ── Left Sidebar (Accounts Cards) ──────────────── */}
        <div className={styles.sidebarCol} data-noprint="true">
          
          {/* Cash Card */}
          <div 
            className={`${styles.accountCard} ${activeAccountType === 'CASH' ? styles.accountCardActive : ''}`}
            onClick={() => navigate('/accounts/cash')}
          >
            <div className={styles.cardHeaderSmall}>
              <span className={styles.accountLabel}>CASH</span>
              <Wallet size={18} className={styles.accountIcon} />
            </div>
            <div className={styles.accountBalance}>
              {cashBalance.toFixed(2)} <span className={styles.curr}>{settings.currencySymbol || 'AED'}</span>
            </div>
            
            {activeAccountType === 'CASH' && (
              <div className={styles.cardQuickActions} onClick={e => e.stopPropagation()}>
                <div className={styles.actionRow}>
                  <button className={styles.cardBtnGreen} onClick={() => handleOpenAddModal('INCOME')}>+ Income</button>
                  <button className={styles.cardBtnRed} onClick={() => handleOpenAddModal('EXPENSE')}>- Expense</button>
                </div>
                <button className={styles.cardBtnOutline} onClick={handleOpenTransferModal}>
                  <ArrowLeftRight size={14} /> Transfer
                </button>
              </div>
            )}
          </div>

          {/* Bank Cards */}
          {settings.bankAccounts && settings.bankAccounts.length > 0 ? (
            settings.bankAccounts.map((bank) => {
              const isCardActive = activeAccountType === 'BANK' && activeBankAccountId === bank.id;
              const bal = bankBalances[bank.id] || 0;
              
              return (
                <div 
                  key={bank.id}
                  className={`${styles.accountCard} ${isCardActive ? styles.accountCardActive : ''}`}
                  onClick={() => {
                    navigate('/accounts/bank');
                    setActiveBankAccountId(bank.id);
                  }}
                >
                  <div className={styles.cardHeaderSmall}>
                    <span className={styles.accountLabel}>{bank.bankName.toUpperCase()}</span>
                    <Landmark size={18} className={styles.accountIcon} />
                  </div>
                  <div className={styles.accountBalance}>
                    {bal.toFixed(2)} <span className={styles.curr}>{settings.currencySymbol || 'AED'}</span>
                  </div>
                  
                  {isCardActive && (
                    <div className={styles.cardQuickActions} onClick={e => e.stopPropagation()}>
                      <div className={styles.actionRow}>
                        <button className={styles.cardBtnGreen} onClick={() => handleOpenAddModal('INCOME')}>+ Income</button>
                        <button className={styles.cardBtnRed} onClick={() => handleOpenAddModal('EXPENSE')}>- Expense</button>
                      </div>
                      <button className={styles.cardBtnOutline} onClick={handleOpenTransferModal}>
                        <ArrowLeftRight size={14} /> Transfer
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            /* Fallback generic Bank Card */
            <div 
              className={`${styles.accountCard} ${activeAccountType === 'BANK' ? styles.accountCardActive : ''}`}
              onClick={() => {
                navigate('/accounts/bank');
                setActiveBankAccountId('');
              }}
            >
              <div className={styles.cardHeaderSmall}>
                <span className={styles.accountLabel}>BANK (GENERAL)</span>
                <Landmark size={18} className={styles.accountIcon} />
              </div>
              <div className={styles.accountBalance}>
                {(bankBalances['default'] || 0).toFixed(2)} <span className={styles.curr}>{settings.currencySymbol || 'AED'}</span>
              </div>
              
              {activeAccountType === 'BANK' && (
                <div className={styles.cardQuickActions} onClick={e => e.stopPropagation()}>
                  <div className={styles.actionRow}>
                    <button className={styles.cardBtnGreen} onClick={() => handleOpenAddModal('INCOME')}>+ Income</button>
                    <button className={styles.cardBtnRed} onClick={() => handleOpenAddModal('EXPENSE')}>- Expense</button>
                  </div>
                  <button className={styles.cardBtnOutline} onClick={handleOpenTransferModal}>
                    <ArrowLeftRight size={14} /> Transfer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Add Account Button */}
          <button className={styles.addAccountBtn} onClick={() => setShowAddAccountModal(true)}>
            <Plus size={16} /> + Add account
          </button>
        </div>

        {/* ── Right Detail Pane (Transactions table) ─────── */}
        <div className={styles.detailCol}>
          
          {/* Detail Header Row (Title left, Controls right) */}
          <div className={styles.detailHeader}>
            <h2>
              Payments for accounts "{activeAccountType === 'CASH' ? 'Cash' : (
                settings.bankAccounts?.find(b => b.id === activeBankAccountId)?.bankName || 'Bank'
              )}"
            </h2>
            
            <div className={styles.headerControls} data-noprint="true">
              <div className={styles.filterGroup}>
                <label className={styles.fieldLabel}>Period</label>
                <div className={styles.dateSelectorInput}>
                  <Calendar size={14} color="#64748B" />
                  <select 
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className={styles.selectNative}
                  >
                    <option value="All">All Time</option>
                    <option value="Today">Today</option>
                    <option value="This Month">This Month</option>
                    <option value="This Year">This Year</option>
                    <option value="Custom">Custom Range</option>
                  </select>
                </div>
              </div>

              {dateRange === 'Custom' && (
                <div className={styles.customDateWrapper}>
                  <div className={styles.filterGroup}>
                    <label className={styles.fieldLabel}>From</label>
                    <input 
                      type="date" 
                      value={customStart} 
                      onChange={(e) => setCustomStart(e.target.value)} 
                      className={styles.datePickerInput}
                    />
                  </div>
                  <span className={styles.rangeSep}>to</span>
                  <div className={styles.filterGroup}>
                    <label className={styles.fieldLabel}>To</label>
                    <input 
                      type="date" 
                      value={customEnd} 
                      onChange={(e) => setCustomEnd(e.target.value)} 
                      className={styles.datePickerInput}
                    />
                  </div>
                </div>
              )}

              <div className={styles.filterGroup}>
                <label className={styles.fieldLabel}>Search</label>
                <div className={styles.searchWrapper}>
                  <Search size={14} color="#64748B" />
                  <input 
                    type="text" 
                    placeholder="Search comments..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>

              <div className={styles.actionButtons}>
                <button className={styles.applyBtn} onClick={fetchData}>Apply</button>
                <button className={styles.printBtn} onClick={handlePrint} title="Print Statements">
                  <Printer size={16} /> Print
                </button>
              </div>
            </div>
          </div>

          {/* Transaction Ledger Table */}
          <div className={styles.tableCard}>
            <table className={styles.ledgerTable}>
              <thead>
                <tr>
                  <th>CREATED</th>
                  <th>COMMENT</th>
                  <th className={styles.numCol}>TYPE</th>
                  <th className={styles.numCol}>AMOUNT</th>
                  <th className={styles.actionCol} data-noprint="true"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className={styles.emptyRow}>Loading entries…</td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={styles.emptyRow}>No transactions found matching criteria.</td>
                  </tr>
                ) : (
                  paginatedTransactions.map(t => {
                    // Parse user/cashier name who created the transaction
                    const matchesCashier = t.description?.match(/Settlement from (.+?)(?:\s+via|$)/i) || t.description?.match(/Settlement for Bill #(.+?)(?:\s+via|$)/i);
                    const creatorName = matchesCashier ? 'System' : (user.name || 'Mohammed');
                    
                    return (
                      <tr key={t.id} className={styles.ledgerRow}>
                        <td>
                          <div className={styles.createdCell}>
                            <div className={styles.creatorBold}>{creatorName}</div>
                            <div className={styles.dateGray}>
                              {formatDate(t.date)} {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.commentCell}>
                            <div className={styles.commentMain}>{renderDescriptionWithLinks(t.description)}</div>
                            <div className={styles.commentSub}>{t.category}</div>
                          </div>
                        </td>
                        <td className={styles.numCol}>
                          <span className={`${styles.typeBadge} ${t.type === 'INCOME' ? styles.incomeBadge : styles.expenseBadge}`}>
                            {t.type === 'INCOME' ? 'INCOME' : 'EXPENSE'}
                          </span>
                        </td>
                        <td className={`${styles.numCol} ${t.type === 'INCOME' ? styles.incomeAmt : styles.expenseAmt}`}>
                          {t.type === 'INCOME' ? '+' : '-'}{t.amount.toFixed(2)} <span className={styles.currencyMini}>{settings.currencySymbol || 'AED'}</span>
                        </td>
                        <td className={styles.actionCol} data-noprint="true">
                          <button className={styles.deleteRowBtn} onClick={() => handleDeleteTransaction(t.id)}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className={styles.footerTotalsRow}>
                  <td colSpan="2" className={styles.totalsLabel}>TOTALS</td>
                  <td className={styles.numCol}>
                    <div className={styles.totalsText}>In: +{filteredIncome.toFixed(2)}</div>
                    <div className={styles.totalsText}>Out: -{filteredExpense.toFixed(2)}</div>
                  </td>
                  <td className={`${styles.numCol} ${styles.totalBalance}`}>
                    {(filteredIncome - filteredExpense).toFixed(2)} <span className={styles.currencyMini}>{settings.currencySymbol || 'AED'}</span>
                  </td>
                  <td className={styles.actionCol} data-noprint="true"></td>
                </tr>
              </tfoot>
            </table>
            {/* Pagination Controls */}
            {!loading && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredTransactions.length / 20)}
                onPageChange={setCurrentPage}
                totalItems={filteredTransactions.length}
                pageSize={20}
                itemLabel="transactions"
              />
            )}
          </div>

        </div>

      </div>
      ) : activeTab === 'Payment links' ? (
        <div className={styles.detailCol}>
          <div className={styles.tabContentHeader}>
            <h2 className={styles.tabTitle}>Online Payment Links</h2>
            <button className={styles.btnPrimary} onClick={() => setShowNewLinkCard(!showNewLinkCard)}>
              <Plus size={16} /> Create Payment Link
            </button>
          </div>

          {showNewLinkCard && (
            <form onSubmit={handleCreatePaymentLink} className={styles.tabFormCard}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Select Customer</label>
                  <select
                    value={linkFormData.customerId}
                    onChange={(e) => setLinkFormData({...linkFormData, customerId: e.target.value})}
                    className={styles.modalSelect}
                    required
                  >
                    <option value="">-- Choose Customer --</option>
                    {dbCustomers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Amount ({settings.currencySymbol || 'AED'})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={linkFormData.amount}
                    onChange={(e) => setLinkFormData({...linkFormData, amount: e.target.value})}
                    className={styles.modalInput}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Description / Order Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. Order #105103"
                    value={linkFormData.description}
                    onChange={(e) => setLinkFormData({...linkFormData, description: e.target.value})}
                    className={styles.modalInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Payment Channel</label>
                  <select
                    value={linkFormData.channel}
                    onChange={(e) => setLinkFormData({...linkFormData, channel: e.target.value})}
                    className={styles.modalSelect}
                  >
                    <option value="Apple Pay">Apple Pay</option>
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Google Pay">Google Pay</option>
                  </select>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowNewLinkCard(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Generate Link</button>
              </div>
            </form>
          )}

          <div className={styles.tabTableContainer}>
            <table className={styles.tabTable}>
              <thead>
                <tr>
                  <th>LINK ID</th>
                  <th>DATE</th>
                  <th>CUSTOMER</th>
                  <th>DESCRIPTION</th>
                  <th className={styles.numCol}>AMOUNT</th>
                  <th>METHOD</th>
                  <th>STATUS</th>
                  <th className={styles.actionCol}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paymentLinks.length === 0 ? (
                  <tr>
                    <td colSpan="8" className={styles.emptyRow}>No payment links generated yet.</td>
                  </tr>
                ) : (
                  paymentLinks.map(link => (
                    <tr key={link.id} className={styles.tabTableRow}>
                      <td><span className={styles.boldId}>{link.id}</span></td>
                      <td>{link.date ? link.date.split(' ')[0] : 'N/A'}</td>
                      <td>{link.customerName}</td>
                      <td>{link.description}</td>
                      <td className={`${styles.numCol} ${styles.incomeAmt}`}>
                        {link.amount.toFixed(2)} <span className={styles.currencyMini}>{settings.currencySymbol || 'AED'}</span>
                      </td>
                      <td><span className={styles.tagBadge}>{link.channel}</span></td>
                      <td>
                        <span className={`${
                          link.status === 'Paid' ? styles.badgePaid : 
                          link.status === 'Active' ? styles.badgeActive : styles.badgeExpired
                        }`}>
                          {link.status}
                        </span>
                      </td>
                      <td className={styles.actionCol}>
                        <div className={styles.linkActionButtons} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button 
                            className={styles.shareBtn} 
                            onClick={() => {
                              const customer = dbCustomers.find(c => c.name === link.customerName);
                              const phoneNum = customer ? customer.phone : '';
                              const text = `Dear ${link.customerName},\n\n` +
                                           `Here is your payment link of *${(settings.currencySymbol || 'AED')} ${link.amount.toFixed(2)}* for *${link.description}*.\n\n` +
                                           `Please pay online using this link: ${link.url}\n\n` +
                                           `Thank you!\n*${(settings.shopName || 'Laundry Box')}*`;
                              
                              let cleanPhone = phoneNum;
                              if (cleanPhone) {
                                if (cleanPhone.startsWith('+')) {
                                  cleanPhone = cleanPhone.replace(/[^\d+]/g, '');
                                } else {
                                  const code = (settings.waCountryCode || '971').replace(/[^\d]/g, '');
                                  cleanPhone = code + cleanPhone.replace(/[^\d]/g, '');
                                }
                              }
                              
                              const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
                              if (window.electronAPI?.openExternal) {
                                window.electronAPI.openExternal(url);
                              } else {
                                window.open(url, '_blank');
                              }
                            }}
                            title="Share via WhatsApp"
                            style={{ 
                              background: '#10b981', 
                              color: 'white', 
                              border: 'none', 
                              padding: '5px 10px', 
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '600'
                            }}
                          >
                            <Share2 size={12} /> Share WhatsApp
                          </button>
                          
                          {link.status === 'Active' && (
                            <button
                              onClick={async () => {
                                if (window.confirm('Mark this payment link as PAID?')) {
                                  if (window.electronAPI?.dbQuery) {
                                    try {
                                      await window.electronAPI.dbQuery("UPDATE payment_links SET status = 'Paid' WHERE id = ?", [link.id]);
                                      
                                      const txnId = `TXN-LNK-PAY-${Date.now()}`;
                                      const timestamp = getLocalDateTime();
                                      const nowIso = getLocalISOString();
                                      
                                      await window.electronAPI.dbQuery(
                                        `INSERT INTO account_transactions 
                                         (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
                                        [
                                          txnId, 
                                          DEFAULT_SHOP_ID, 
                                          'BANK', 
                                          'INCOME', 
                                          'Service Payment', 
                                          link.amount, 
                                          `Online Payment - ${link.customerName} - ${link.description} (Link ${link.id})`, 
                                          timestamp, 
                                          nowIso,
                                          'CreditCard',
                                          settings.bankAccounts && settings.bankAccounts.length > 0 ? settings.bankAccounts[0].id : null
                                        ]
                                      );
                                      
                                      fetchData();
                                    } catch (err) {
                                      console.error('Failed to mark payment link as paid:', err);
                                    }
                                  } else {
                                    setPaymentLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: 'Paid' } : l));
                                  }
                                }
                              }}
                              title="Mark as Paid"
                              style={{
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}
                            >
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.detailCol}>
          <div className={styles.tabContentHeader}>
            <h2 className={styles.tabTitle}>Customer Refund Transactions</h2>
            <button className={styles.btnPrimary} onClick={() => setShowNewRefundCard(!showNewRefundCard)}>
              <Plus size={16} /> New Refund
            </button>
          </div>

          {showNewRefundCard && (
            <form onSubmit={handleProcessRefund} className={styles.tabFormCard}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Select Paid Order</label>
                  <select
                    value={refundFormData.orderId}
                    onChange={(e) => {
                      const selectedOrder = dbOrders.find(o => o.id === e.target.value);
                      setRefundFormData({
                        ...refundFormData,
                        orderId: e.target.value,
                        amount: selectedOrder ? selectedOrder.paidAmount : ''
                      });
                    }}
                    className={styles.modalSelect}
                    required
                  >
                    <option value="">-- Choose Order --</option>
                    {dbOrders.map(o => (
                      <option key={o.id} value={o.id}>Order #{o.id} (Paid: {o.paidAmount.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Refund Amount ({settings.currencySymbol || 'AED'})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={refundFormData.amount}
                    onChange={(e) => setRefundFormData({...refundFormData, amount: e.target.value})}
                    className={styles.modalInput}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Reason for Refund</label>
                  <select
                    value={refundFormData.reason}
                    onChange={(e) => setRefundFormData({...refundFormData, reason: e.target.value})}
                    className={styles.modalSelect}
                  >
                    <option value="Damaged Garment">Damaged Garment</option>
                    <option value="Wrong Charge / Pricing error">Wrong Charge / Pricing error</option>
                    <option value="Lost Garment">Lost Garment</option>
                    <option value="Customer Dissatisfied">Customer Dissatisfied</option>
                    <option value="Double Payment">Double Payment</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Deduct From Account</label>
                  <select
                    value={refundFormData.accountId}
                    onChange={(e) => setRefundFormData({...refundFormData, accountId: e.target.value})}
                    className={styles.modalSelect}
                  >
                    <option value="CASH">Cash Account</option>
                    {settings.bankAccounts?.map(b => (
                      <option key={b.id} value={b.id}>{b.bankName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowNewRefundCard(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} style={{ background: '#EF4444' }}>Process Refund</button>
              </div>
            </form>
          )}

          <div className={styles.tabTableContainer}>
            <table className={styles.tabTable}>
              <thead>
                <tr>
                  <th>REFUND ID</th>
                  <th>DATE</th>
                  <th>ORDER ID</th>
                  <th>CUSTOMER</th>
                  <th>AMOUNT REFUNDED</th>
                  <th>REASON</th>
                  <th>PAID FROM</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRefunds.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.id}</strong></td>
                    <td>{r.date}</td>
                    <td><span className={styles.billLink} onClick={() => navigate(`/invoice/${r.orderId}`)}>#{r.orderId}</span></td>
                    <td>{r.customerName}</td>
                    <td style={{ color: '#DC2626', fontWeight: 700 }}>-{r.amount.toFixed(2)} {settings.currencySymbol || 'AED'}</td>
                    <td>{r.reason}</td>
                    <td>{r.account}</td>
                    <td>
                      <span className={styles.badgePaid}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination Controls */}
            {!loading && (
              <Pagination
                currentPage={refundsPage}
                totalPages={Math.ceil(refunds.length / 20)}
                onPageChange={setRefundsPage}
                totalItems={refunds.length}
                pageSize={20}
                itemLabel="refunds"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Add Transaction ────────────────────── */}
      {showAddModal && (
        <div className={styles.modalOverlay} data-noprint="true" onClick={() => setShowAddModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add New {formData.type === 'INCOME' ? 'Income' : 'Expense'} Entry ({activeAccountType})</h2>
              <button className={styles.closeBtn} onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddTransaction}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className={styles.modalSelect}
                  >
                    {formData.type === 'INCOME' ? (
                      <>
                        <option value="Service Payment">Service Payment</option>
                        <option value="Credit Settlement">Credit Settlement</option>
                        <option value="Refund Return">Refund Return</option>
                        <option value="Opening Balance">Opening Balance</option>
                        <option value="Other Income">Other Income</option>
                      </>
                    ) : (
                      <>
                        <option value="Supplies">Supplies (Detergents, bags)</option>
                        <option value="Salaries">Staff Salaries</option>
                        <option value="Rent">Shop Rent</option>
                        <option value="Utilities">Utilities (Internet, Gas)</option>
                        <option value="Electricity">Electricity / Water Utility</option>
                        <option value="Maintenance">Maintenance & Repairs</option>
                        <option value="Return">Return Refund</option>
                        <option value="Other Expense">Other Expense</option>
                      </>
                    )}
                  </select>
                </div>
                
                <div className={styles.formGroup}>
                  <label>Amount ({settings.currencySymbol || 'AED'})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className={styles.modalInput}
                    autoFocus
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Description / Notes</label>
                  <textarea 
                    placeholder="Provide details about this entry..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className={styles.modalTextarea}
                    required
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className={styles.saveBtn}>Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Transfer Funds ─────────────────────── */}
      {showTransferModal && (
        <div className={styles.modalOverlay} data-noprint="true" onClick={() => setShowTransferModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Transfer Funds</h2>
              <button className={styles.closeBtn} onClick={() => setShowTransferModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleTransfer}>
              <div className={styles.modalBody}>
                <div className={styles.transferFlowInfo}>
                  <div className={styles.flowNode}>
                    <span className={styles.flowLabel}>From Account</span>
                    <strong>{activeAccountType === 'CASH' ? 'Cash' : (settings.bankAccounts?.find(b => b.id === activeBankAccountId)?.bankName || 'Bank')}</strong>
                    <span className={styles.flowBalSmall}>
                      Bal: {(activeAccountType === 'CASH' ? cashBalance : (bankBalances[activeBankAccountId] || 0)).toFixed(2)} {settings.currencySymbol}
                    </span>
                  </div>
                  <div className={styles.flowArrow}><ArrowLeftRight size={20} /></div>
                  <div className={styles.flowNode}>
                    <span className={styles.flowLabel}>To Account</span>
                    <strong>{transferTargetId === 'CASH' ? 'Cash' : (settings.bankAccounts?.find(b => b.id === transferTargetId)?.bankName || 'Bank')}</strong>
                    <span className={styles.flowBalSmall}>
                      Bal: {(transferTargetId === 'CASH' ? cashBalance : (bankBalances[transferTargetId] || 0)).toFixed(2)} {settings.currencySymbol}
                    </span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>To Account</label>
                  <select
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                    className={styles.modalSelect}
                  >
                    {activeAccountType === 'CASH' ? (
                      settings.bankAccounts?.length > 0 ? (
                        settings.bankAccounts.map(b => (
                          <option key={b.id} value={b.id}>{b.bankName}</option>
                        ))
                      ) : (
                        <option value="BANK">General Bank</option>
                      )
                    ) : (
                      <>
                        <option value="CASH">Cash</option>
                        {settings.bankAccounts
                          ?.filter(b => b.id !== activeBankAccountId)
                          .map(b => (
                            <option key={b.id} value={b.id}>{b.bankName}</option>
                          ))
                        }
                      </>
                    )}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Amount to Transfer ({settings.currencySymbol || 'AED'})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    required
                    value={transferData.amount}
                    onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                    className={styles.modalInput}
                    autoFocus
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Note / Remarks</label>
                  <textarea 
                    placeholder="Reason or notes about this transfer..."
                    value={transferData.note}
                    onChange={(e) => setTransferData({...transferData, note: e.target.value})}
                    className={styles.modalTextarea}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowTransferModal(false)}>Cancel</button>
                <button type="submit" className={styles.saveBtn} style={{ background: '#2563EB' }}>Confirm Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add Bank Account ────────────────────── */}
      {showAddAccountModal && (
        <div className={styles.modalOverlay} data-noprint="true" onClick={() => setShowAddAccountModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add New Bank Account</h2>
              <button className={styles.closeBtn} onClick={() => setShowAddAccountModal(false)}>&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newAccountData.bankName.trim()) {
                alert("Please enter a bank name.");
                return;
              }
              try {
                const newBank = {
                  id: `BANK-${Date.now()}`,
                  bankName: newAccountData.bankName.trim(),
                  accountNumber: newAccountData.accountNumber.trim(),
                  iban: newAccountData.iban.trim()
                };
                
                const newAccounts = [...(settings.bankAccounts || []), newBank];
                await updateSettings({ bankAccounts: newAccounts });
                
                setActiveBankAccountId(newBank.id);
                setNewAccountData({ bankName: '', accountNumber: '', iban: '' });
                setShowAddAccountModal(false);
                alert(`Bank account "${newBank.bankName}" added successfully.`);
              } catch (err) {
                console.error("Failed to add bank account:", err);
                alert("Failed to add bank account.");
              }
            }}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Bank Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Emirates NBD, ADCB" 
                    required
                    value={newAccountData.bankName}
                    onChange={(e) => setNewAccountData({...newAccountData, bankName: e.target.value})}
                    className={styles.modalInput}
                    autoFocus
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Account Number (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 101xxxxxx" 
                    value={newAccountData.accountNumber}
                    onChange={(e) => setNewAccountData({...newAccountData, accountNumber: e.target.value})}
                    className={styles.modalInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>IBAN (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. AE83022xxxxxxxxxxxxxx" 
                    value={newAccountData.iban}
                    onChange={(e) => setNewAccountData({...newAccountData, iban: e.target.value})}
                    className={styles.modalInput}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddAccountModal(false)}>Cancel</button>
                <button type="submit" className={styles.saveBtn} style={{ background: '#2563EB' }}>Add Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Payslip Preview ───────────────────── */}
      {showPayslipModal && activePayslip && (
        <div className={styles.payslipOverlay} data-noprint="true" onClick={() => { setShowPayslipModal(false); setActivePayslip(null); }}>
          <div className={styles.payslipCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.payslipHeader}>
              <h2>STAFF PAY SLIP</h2>
              <p>LAUNDRY BILLING SOFTWARE</p>
              <p>Month: {activePayslip.month}</p>
            </div>
            <div className={styles.payslipBody}>
              <div className={styles.payslipRow}>
                <span>Employee Name:</span>
                <strong>{activePayslip.employeeName}</strong>
              </div>
              <div className={styles.payslipRow}>
                <span>Role / Title:</span>
                <span>{activePayslip.role}</span>
              </div>
              <div className={styles.payslipRow}>
                <span>Base Contract Salary:</span>
                <span>{activePayslip.base.toFixed(2)} {settings.currencySymbol || 'AED'}</span>
              </div>
              <div className={styles.payslipRow}>
                <span>Worked Days (Out of 30):</span>
                <span>{activePayslip.daysWorked} days</span>
              </div>
              <div className={styles.payslipRow}>
                <span>Overtime Hours Worked:</span>
                <span>{activePayslip.overtime} hrs</span>
              </div>
              <div className={styles.payslipRow} style={{ color: '#16A34A' }}>
                <span>Bonuses:</span>
                <span>+{activePayslip.bonus.toFixed(2)} {settings.currencySymbol || 'AED'}</span>
              </div>
              <div className={styles.payslipRow} style={{ color: '#DC2626' }}>
                <span>Deductions:</span>
                <span>-{activePayslip.deduction.toFixed(2)} {settings.currencySymbol || 'AED'}</span>
              </div>
              <div className={styles.payslipRowBold}>
                <span>NET PAYABLE AMOUNT:</span>
                <span>{activePayslip.net.toFixed(2)} {settings.currencySymbol || 'AED'}</span>
              </div>
            </div>
            <div className={styles.modalFooter} style={{ padding: '1rem 0 0 0', background: 'white', borderTop: '1px solid #E2E8F0' }}>
              <button type="button" className={styles.cancelBtn} onClick={() => {
                setShowPayslipModal(false);
                setActivePayslip(null);
              }}>
                Close
              </button>
              <button type="button" className={styles.saveBtn} style={{ background: '#10B981' }} onClick={handlePaySalary}>
                Process Payout & Record Expense
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
