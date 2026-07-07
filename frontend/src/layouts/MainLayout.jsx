import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Users, ClipboardList, Settings, Layers,
  BarChart3, Zap, Plus, Search, Bell, HelpCircle, LifeBuoy, Wifi, WifiOff, RefreshCw, Activity, LogOut, Wallet,
  DollarSign, X, CheckCircle, CreditCard, ShoppingBag, Trash2, Building2, Hash, FileText,
  AlertTriangle, ShieldCheck, Clock, Package, Truck, Phone, Cpu
} from 'lucide-react';
import axios from 'axios';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { syncData } from '../services/syncService';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID, API_BASE_URL } from '../constants';
import { t } from '../utils/translations';
import { getLocalDateTime, getLocalISOString } from '../utils/dateUtils';
import styles from './MainLayout.module.css';
import { checkCreditLimit } from '../utils/creditLimit';
import { QRCodeCanvas } from 'qrcode.react';

const API_BASE = API_BASE_URL;

export default function MainLayout() {
  const { settings, updateSettings } = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();


  const [deliveryToast, setDeliveryToast] = useState(null);
  const [showQuickSettle, setShowQuickSettle] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [settleSearch, setSettleSearch] = useState('');
  const [foundOrder, setFoundOrder] = useState(null);
  const [foundCustomer, setFoundCustomer] = useState(null); // Keep for compatibility if any other code refers to it, but define new ones:
  const [selectedSettleTarget, setSelectedSettleTarget] = useState(null);
  const [quickSettleResults, setQuickSettleResults] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');
  const [logoClicks, setLogoClicks] = useState(0);
  const [selectedBank, setSelectedBank] = useState('');

  const [quickCashAmount, setQuickCashAmount] = useState('');
  const [quickCardAmount, setQuickCardAmount] = useState('');
  const [quickUpiAmount, setQuickUpiAmount] = useState('');
  const [quickBankAmount, setQuickBankAmount] = useState('');
  const [quickDiscountAmount, setQuickDiscountAmount] = useState('');
  const [nomodLinkModal, setNomodLinkModal] = useState({ show: false, url: '', linkId: '', amount: 0 });

  const quickCashVal = parseFloat(quickCashAmount) || 0;
  const quickCardVal = parseFloat(quickCardAmount) || 0;
  const quickUpiVal = parseFloat(quickUpiAmount) || 0;
  const quickBankVal = parseFloat(quickBankAmount) || 0;

  useEffect(() => {
    if (settleMethod === 'Mixed') {
      const sum = quickCashVal + quickCardVal + quickUpiVal + quickBankVal;
      setSettleAmount(sum > 0 ? sum.toString() : '');
    }
  }, [quickCashAmount, quickCardAmount, quickUpiAmount, quickBankAmount, settleMethod]);

  useEffect(() => {
    if (!showQuickSettle) {
      setQuickCashAmount('');
      setQuickCardAmount('');
      setQuickUpiAmount('');
      setQuickBankAmount('');
      setQuickDiscountAmount('');
      setSelectedSettleTarget(null);
      setSettleAmount('');
      setSettleMethod('Cash');
    }
  }, [showQuickSettle]);

  useEffect(() => {
    if (settleMethod !== 'Mixed') {
      setQuickCashAmount('');
      setQuickCardAmount('');
      setQuickUpiAmount('');
      setQuickBankAmount('');
    }
  }, [settleMethod]);

  useEffect(() => {
    if (settings.bankAccounts && settings.bankAccounts.length > 0) {
      if (settleMethod === 'Card') {
        const cardBank = settings.bankAccounts.find(acc => acc.id === settings.cardDefaultAccountId) || 
                         settings.bankAccounts.find(acc => acc.id === settings.defaultBankId) || 
                         settings.bankAccounts[0];
        setSelectedBank(cardBank.bankName);
      } else if (settleMethod === 'UPI') {
        const upiBank = settings.bankAccounts.find(acc => acc.id === settings.upiDefaultAccountId) || 
                        settings.bankAccounts.find(acc => acc.id === settings.defaultBankId) || 
                        settings.bankAccounts[0];
        setSelectedBank(upiBank.bankName);
      } else if (!selectedBank) {
        const defaultBank = settings.bankAccounts.find(acc => acc.id === settings.defaultBankId) || settings.bankAccounts[0];
        setSelectedBank(defaultBank.bankName);
      }
    }
  }, [settleMethod, settings.bankAccounts, settings.cardDefaultAccountId, settings.upiDefaultAccountId, settings.defaultBankId, selectedBank]);

  // Software Update States
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  // Header Dropdown States
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationRef = useRef(null);
  const supportRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const res = await window.electronAPI.dbQuery('SELECT id, status, createdAt FROM orders ORDER BY createdAt DESC LIMIT 5', []);
        if (res.success) setNotifications(res.data);
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      }
    }
  };

  // Scroll to top when route changes
  useEffect(() => {
    const contentArea = document.querySelector(`.${styles.content}`);
    if (contentArea) {
      contentArea.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // 1. Connection status monitoring
  useEffect(() => {
    const checkStatus = async () => {
      if (window.electronAPI) {
        const status = await window.electronAPI.checkConnection();
        setIsOnline(status);
      } else {
        setIsOnline(navigator.onLine);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Synchronization Interval (Runs every 60 seconds when online)
  useEffect(() => {
    if (!isOnline) return;
    const syncInterval = setInterval(() => {
      handleSync();
    }, 60000);
    return () => clearInterval(syncInterval);
  }, [isOnline]);

  // Software Update Checker and Listener Effect
  useEffect(() => {
    const handleGlobalUpdate = (event, status) => {
      if (status.type === 'available') {
        // Store update info silently — visible only on Settings → Software Update
        setUpdateInfo(status);
        // No popup modal — user can check updates from Settings
      }
    };

    if (window.electronAPI?.onUpdateStatus) {
      window.electronAPI.onUpdateStatus(handleGlobalUpdate);
    }

    // Auto-check for updates 3 seconds after startup
    const timer = setTimeout(() => {
      if (window.electronAPI?.checkForUpdates) {
        window.electronAPI.checkForUpdates();
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      if (window.electronAPI?.offUpdateStatus) {
        window.electronAPI.offUpdateStatus(handleGlobalUpdate);
      }
    };
  }, [location.pathname, location.search]);

  // 3. Dedicated Local Auto-Backup Interval (Recreated when backup settings change)
  useEffect(() => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.autoBackupPath || currentSettings.autoBackupInterval === 0 || !window.electronAPI?.silentBackup) {
      return;
    }

    const intervalTime = currentSettings.autoBackupInterval * 1000;
    console.log('Setting up auto-backup interval:', intervalTime, 'ms');

    const backupInterval = setInterval(async () => {
      const activeSettings = settingsRef.current;
      console.log('Auto-backing up to USB path:', activeSettings.autoBackupPath);
      const result = await window.electronAPI.silentBackup(activeSettings.autoBackupPath);
      if (result.success) {
        updateSettings({ lastBackupTime: new Date().toLocaleString() });
      }
    }, intervalTime);

    return () => clearInterval(backupInterval);
  }, [settings.autoBackupPath, settings.autoBackupInterval]);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncData();

      // Auto-backup to USB/Folder if configured (read from settingsRef to avoid stale path)
      const currentSettings = settingsRef.current;
      if (currentSettings.autoBackupPath && window.electronAPI?.silentBackup) {
        console.log('Performing auto-backup to:', currentSettings.autoBackupPath);
        await window.electronAPI.silentBackup(currentSettings.autoBackupPath);
      }
    } catch (err) {
      console.error('handleSync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogoClick = () => {
    const newCount = logoClicks + 1;
    setLogoClicks(newCount);
    if (newCount >= 10) {
      sessionStorage.clear();
      window.location.href = '/login';
    }
    // Reset counter after 5 seconds of inactivity
    setTimeout(() => setLogoClicks(0), 5000);
  };



  let user = {};
  let normalized = false;
  try {
    user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (user.role === 'admin') {
      user.role = 'super_admin';
      normalized = true;
    }
    if (user.role === 'staff') {
      user.role = 'cashier';
      normalized = true;
    }
    if (normalized) {
      sessionStorage.setItem('user', JSON.stringify(user));
    }
  } catch (e) {
    console.error("Failed to parse user data", e);
  }
  let role = user.role || '';

  const [userPermissions, setUserPermissions] = useState(null);

  useEffect(() => {
    fetchPermissions();
  }, [role]);

  useEffect(() => {
    if (role === 'super_admin' && location.pathname !== '/activation' && location.pathname !== '/settings') {
      navigate('/activation', { replace: true });
    }
  }, [role, location.pathname, navigate]);

  const fetchPermissions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/roles`);
      const currentRole = res.data.find(r => r.slug === role);
      if (currentRole) {
        setUserPermissions(currentRole.permissions);
      }
    } catch (err) {
      console.error("Failed to fetch permissions", err);
    }
  };

  const [expandedMenus, setExpandedMenus] = useState([]);

  const toggleMenu = (label) => {
    setExpandedMenus(prev =>
      prev.includes(label) ? [] : [label]
    );
  };

  // Close dropdowns and sidebar menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close profile
      if (isProfileOpen && profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }

      // Close notifications
      if (isNotificationsOpen && notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }

      // Close support
      if (isSupportOpen && supportRef.current && !supportRef.current.contains(event.target)) {
        setIsSupportOpen(false);
      }

      // Close sidebar menus if clicking outside sidebar
      const sidebar = document.querySelector(`.${styles.sidebar}`);
      if (sidebar && !sidebar.contains(event.target) && expandedMenus.length > 0) {
        setExpandedMenus([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen, isNotificationsOpen, isSupportOpen, expandedMenus]);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permissionKey: 'dashboard' },
    { path: '/pos', label: 'POS', icon: ShoppingCart, permissionKey: 'pos' },
    { path: '/workflow', label: 'Workflow', icon: Zap, permissionKey: 'orders' },
    {
      label: 'Orders',
      icon: ClipboardList,
      permissionKey: 'orders',
      subItems: [
        { path: '/orders', label: 'All Orders' },
        { path: '/orders/pending', label: 'Pending Payments' },
        { path: '/orders/expected-delivery', label: 'Expected Deliveries' },
        { path: '/orders/deleted', label: 'Deleted Orders' },
        { path: '/reports/cancelled', label: 'Cancelled Orders' },
      ]
    },
    {
      label: 'Customers',
      icon: Users,
      permissionKey: 'customers',
      subItems: [
        { path: '/customers', label: 'Customer List' },
        { path: '/reports/customer-statement', label: 'Customer Statement' },
      ]
    },
    { path: '/services', label: 'Services', icon: Layers, permissionKey: 'services' },
    {
      label: 'Settle Bill',
      icon: DollarSign,
      permissionKey: 'pos',
      subItems: [
        { path: '/settlement', label: 'Settle Bill' },
        { path: '/outstanding-bills', label: 'Outstanding Bills' },
      ]
    },
    {
      label: 'Reports',
      icon: BarChart3,
      permissionKey: 'reports',
      subItems: [
        { path: '/reports/services', label: 'Services Report' },
        { path: '/reports/revenue', label: 'Revenue' },
        { path: '/reports/expenses', label: 'Expenses' },
        { path: '/reports/tax', label: 'Tax Statements' },
        { path: '/reports/daily-tax', label: 'Daily Tax Report' },
        { path: '/reports/z-report', label: 'Z Report' },
        { path: '/reports/credit-overrides', label: 'Credit Overrides' },
        { path: '/reports/nomod-history', label: 'Nomod History' },
      ]
    },
    {
      label: 'Accounts',
      icon: Wallet,
      permissionKey: 'accounts',
      subItems: [
        { path: '/accounts/cash', label: 'Cash Account' },
        { path: '/accounts/bank', label: 'Bank Account' },
        { path: '/accounts/gateway', label: 'Payment Link' },
      ]
    },
    {
      label: 'User & Roles',
      icon: Users,
      roleOnly: ['super_admin', 'manager'],
      subItems: [
        { path: '/users', label: 'Manage Users' },
        { path: '/users?tab=roles', label: 'Permissions', roleOnly: ['super_admin', 'manager'] },
      ]
    },
    {
      path: '/activation',
      label: 'License Settings',
      icon: ShieldCheck,
      roleOnly: 'super_admin'
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: Settings,
      roleOnly: ['super_admin', 'manager']
    },
  ];

  const showToast = (message, type = 'success') => {
    setDeliveryToast({ message, type });
    setTimeout(() => {
      setDeliveryToast(null);
    }, 4000);
  };

  const handleQuickDeliverKeyPress = async (e) => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      if (!val) return;

      const cleanVal = val.replace('#', '').trim();
      if (!cleanVal) return;

      e.target.value = '';

      try {
        if (window.electronAPI?.dbQuery) {
          const queryRes = await window.electronAPI.dbQuery(
            'SELECT * FROM orders WHERE id = ? OR billNumber = ?',
            [cleanVal, cleanVal]
          );

          if (queryRes.success && queryRes.data.length > 0) {
            const order = queryRes.data[0];

            if (order.status === 'Delivered') {
              showToast(`Order #${order.id} is already Delivered!`, 'error');
              return;
            }

            let history = [];
            try {
              history = typeof order.statusHistory === 'string'
                ? JSON.parse(order.statusHistory || '[]')
                : (order.statusHistory || []);
              if (!Array.isArray(history)) history = [];
            } catch (err) {
              history = [];
            }
            const newHistory = [...history, { status: 'Delivered', updatedBy: 'Admin Staff', timestamp: new Date().toISOString() }];

            const updateRes = await window.electronAPI.dbQuery(
              'UPDATE orders SET status = ?, statusHistory = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
              ['Delivered', JSON.stringify(newHistory), new Date().toISOString(), order.id]
            );

            if (updateRes.success) {
              try {
                await axios.patch(`${API_BASE}/orders/${encodeURIComponent(order.id)}/status`, {
                  status: 'Delivered',
                  updatedBy: 'Admin Staff'
                });
              } catch (syncErr) {
                console.warn("Cloud sync failed, will retry later:", syncErr);
              }

              showToast(`Order #${order.id} marked as Delivered!`, 'success');

              setTimeout(() => {
                window.location.reload();
              }, 1500);
            } else {
              showToast(`Failed to update Order #${order.id}`, 'error');
            }
          } else {
            try {
              const remoteRes = await axios.get(`${API_BASE}/orders/search?q=${encodeURIComponent(cleanVal)}`);
              if (remoteRes.data && remoteRes.data.length > 0) {
                const order = remoteRes.data[0];
                if (order.status === 'Delivered') {
                  showToast(`Order #${order.id} is already Delivered!`, 'error');
                  return;
                }

                await axios.patch(`${API_BASE}/orders/${encodeURIComponent(order.id)}/status`, {
                  status: 'Delivered',
                  updatedBy: 'Admin Staff'
                });

                showToast(`Order #${order.id} marked as Delivered!`, 'success');
                setTimeout(() => {
                  window.location.reload();
                }, 1500);
              } else {
                showToast(`Order #${cleanVal} not found!`, 'error');
              }
            } catch (apiErr) {
              showToast(`Order #${cleanVal} not found!`, 'error');
            }
          }
        } else {
          showToast(`Mock: Order #${cleanVal} marked as Delivered!`, 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err) {
        console.error("Auto-delivery failed:", err);
        showToast("Auto-delivery failed: " + err.message, 'error');
      }
    }
  };
  const handleQuickSettleSearch = async (val) => {
    setSettleSearch(val);
    setSelectedSettleTarget(null);
    if (!val || val.trim().length < 2) {
      setQuickSettleResults([]);
      return;
    }

    if (window.electronAPI?.dbQuery) {
      const term = `%${val.trim()}%`;
      const custRes = await window.electronAPI.dbQuery(
        `SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 5`,
        [term, term]
      );

      const ordersRes = await window.electronAPI.dbQuery(
        `SELECT o.*, c.name as customerName, c.phone as customerPhone 
         FROM orders o 
         LEFT JOIN customers c ON o.customerId = c.id 
         WHERE (o.id LIKE ? OR o.billNumber LIKE ? OR c.name LIKE ? OR c.phone LIKE ?) 
           AND o.dueAmount > 0 
           AND o.status != 'Cancelled' 
         LIMIT 5`,
        [term, term, term, term]
      );

      const results = [];
      if (custRes.success && custRes.data.length > 0) {
        custRes.data.forEach(cust => {
          results.push({ type: 'customer', data: cust });
        });
      }
      if (ordersRes.success && ordersRes.data.length > 0) {
        ordersRes.data.forEach(order => {
          results.push({ type: 'bill', data: order });
        });
      }
      setQuickSettleResults(results);
    }
  };

  const processQuickSettle = async (isOverridden = false) => {
    if (!selectedSettleTarget || !settleAmount || parseFloat(settleAmount) <= 0) return;

    setIsUpdating(true);
    try {
      const amount = parseFloat(settleAmount);
      const discount = parseFloat(quickDiscountAmount || 0) || 0;
      const totalReduction = amount + discount;
      const timestamp = getLocalISOString();
      const customerId = selectedSettleTarget.type === 'customer' 
        ? selectedSettleTarget.data.id 
        : selectedSettleTarget.data.customerId;

      const checkRes = await checkCreditLimit(customerId, -amount, settings);
      if (checkRes.blocked) {
        if (!settings.enableManagerOverride) {
          alert("Credit Limit Protection is active and Manager Override is disabled. Cannot complete settlement.");
          setIsUpdating(false);
          return;
        }
        const pin = prompt("Credit Limit Exceeded! Enter Manager Secure PIN to approve override:");
        if (!pin) {
          alert("Access Denied: PIN is required.");
          setIsUpdating(false);
          return;
        }
        const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
        const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
        const userId = `${userRole}: ${userSession.name || userSession.username || 'User'}`;
        const verifyRes = await window.electronAPI.verifyManagerPin({
          pin,
          customerId,
          customerName: checkRes.details.customerName,
          orderId: selectedSettleTarget.type === 'bill' ? selectedSettleTarget.data.id : `QUICK-SETTLE-${customerId.substring(0, 5)}`,
          creditLimit: checkRes.details.creditLimit,
          outstandingBalance: checkRes.details.currentOutstanding,
          orderAmount: checkRes.details.orderAmount,
          exceededAmount: checkRes.details.exceededAmount,
          userId
        });
        if (!verifyRes.success) {
          alert("Incorrect PIN! Access Denied.");
          setIsUpdating(false);
          return;
        }
      }

      if (settleMethod === 'Nomod' && !isOverridden) {
        let linkId = `LNK-${Date.now().toString().slice(-4)}`;
        let checkoutUrl = '';
        
        if (window.electronAPI?.dbQuery) {
          try {
            const activeLnkRes = await window.electronAPI.dbQuery(
              `SELECT * FROM payment_links WHERE customerId = ? AND status IN ('Active', 'Pending') AND amount = ? LIMIT 1`,
              [customerId, amount]
            );
            if (activeLnkRes.success && activeLnkRes.data.length > 0) {
              checkoutUrl = activeLnkRes.data[0].url;
              linkId = activeLnkRes.data[0].id;
            }
          } catch (dbErr) {
            console.warn("Failed to check active payment link in Quick Settle:", dbErr);
          }
        }

        if (!checkoutUrl) {
          try {
            const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
            const checkoutRes = await window.electronAPI.createNomodCheckout({
              amount: amount,
              currency: settings.nomodCurrency || 'AED',
              customer: {
                name: selectedSettleTarget.type === 'customer' ? selectedSettleTarget.data.name : (selectedSettleTarget.data.customerName || 'Customer'),
                phone: selectedSettleTarget.type === 'customer' ? selectedSettleTarget.data.phone : (selectedSettleTarget.data.customerPhone || '')
              },
              orderId: selectedSettleTarget.type === 'bill' ? selectedSettleTarget.data.id : `QUICK-SETTLE-${customerId.substring(0, 5)}`,
              userRole: currentUser.role || 'staff'
            });

            if (checkoutRes.success && checkoutRes.data && checkoutRes.data.url) {
              checkoutUrl = checkoutRes.data.url;
              if (checkoutRes.data.id) {
                linkId = checkoutRes.data.id;
              }
            } else if (checkoutRes.error) {
              console.warn("Nomod Backend API failed in Quick Settle:", checkoutRes.error);
              alert("Nomod Checkout API connection failed: " + checkoutRes.error + ". Falling back to sandbox payment link.");
            }
          } catch (err) {
            console.warn("Nomod Checkout IPC failed in Quick Settle:", err.message);
          }
        }

        if (!checkoutUrl) {
          checkoutUrl = `https://link.nomod.com/pay?account=${settings.nomodMerchantId || 'default'}&amount=${amount}&reference=${linkId}`;
        }

        if (window.electronAPI?.logAuditEvent) {
          const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
          window.electronAPI.logAuditEvent({
            eventName: 'Payment Link Generated',
            details: `Nomod payment link generated for Customer ${customerId} Quick Settlement, Amount: ${amount}`,
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
        setShowQuickSettle(false);
        setIsUpdating(false);
        return;
      }

      let splits = [];
      if (settleMethod === 'Mixed') {
        if (quickCashVal > 0) splits.push({ method: 'Cash', amount: quickCashVal });
        if (quickCardVal > 0) splits.push({ method: 'Card', amount: quickCardVal });
        if (quickUpiVal > 0) splits.push({ method: 'UPI', amount: quickUpiVal });
        if (quickBankVal > 0) splits.push({ method: 'Bank', amount: quickBankVal });
      } else {
        splits.push({ method: settleMethod, amount: amount });
      }
      if (discount > 0) {
        splits.push({ method: 'Discount', amount: discount });
      }

      if (selectedSettleTarget.type === 'customer') {
        const customer = selectedSettleTarget.data;

        // Process splits sequentially
        for (const split of splits) {
          let remaining = split.amount;

          // Re-fetch pending bills sequentially to get updated dues
          const billsRes = await window.electronAPI.dbQuery(
            "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND dueAmount > 0 AND status != 'Cancelled' ORDER BY createdAt ASC",
            [customer.id]
          );
          const bills = billsRes.success ? billsRes.data : [];

          if (bills.length > 0) {
            for (const bill of bills) {
              if (remaining <= 0) break;
              const currentDue = bill.dueAmount > 0 ? bill.dueAmount : (bill.totalAmount - (bill.paidAmount || 0));
              if (currentDue <= 0) continue;

              let allocate = 0;
              let newStatus = 'Paid';
              let newDue = 0;
              let newPaid = (bill.paidAmount || 0);

              if (remaining >= currentDue) {
                allocate = currentDue;
                remaining -= currentDue;
                newPaid += allocate;
                newDue = 0;
                newStatus = 'Paid';
              } else {
                allocate = remaining;
                newPaid += allocate;
                newDue = currentDue - remaining;
                remaining = 0;
                newStatus = 'Partial';
              }

              const newWorkflowStatus = newDue <= 0 ? 'Confirmed' : bill.status;

              let newOrderPaymentMethod = split.method;
              if (newDue <= 0) {
                const prevPayRes = await window.electronAPI.dbQuery(
                  'SELECT DISTINCT method FROM payments WHERE orderId = ?',
                  [bill.id]
                );
                const prevMethods = prevPayRes.success ? prevPayRes.data.map(p => p.method) : [];
                const allMethods = [...new Set([...prevMethods, split.method])];
                const hasCash = allMethods.some(m => m === 'Cash');
                const hasCardOrBankOrUPI = allMethods.some(m => m === 'Card' || m === 'Bank' || m === 'UPI');
                if (hasCash && hasCardOrBankOrUPI) newOrderPaymentMethod = 'Mixed';
                else if (allMethods.includes('Card')) newOrderPaymentMethod = 'Card';
                else if (allMethods.includes('UPI')) newOrderPaymentMethod = 'UPI';
                else if (allMethods.includes('Bank')) newOrderPaymentMethod = 'Bank';
                else newOrderPaymentMethod = 'Cash';
              }

              await window.electronAPI.dbQuery(
                'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
                [newPaid, newDue, newStatus, newWorkflowStatus, newOrderPaymentMethod, timestamp, bill.id]
              );

              await window.electronAPI.dbQuery(
                `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
                [`PAY-QUICK-${Date.now()}-${bill.id}-${split.method}`, customer.id, bill.id, DEFAULT_SHOP_ID, allocate, split.method, 'SUCCESS', timestamp, timestamp]
              );
            }
          }

          if (remaining > 0) {
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
              [`PAY-ADV-${Date.now()}-${split.method}`, customer.id, null, DEFAULT_SHOP_ID, remaining, split.method, 'SUCCESS', timestamp, timestamp]
            );
          }
        }

        // Update Customer Balance
        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [totalReduction, timestamp, customer.id]
        );

        // Record Transactions in Accounts
        const txnTimestamp = getLocalDateTime();
        for (const split of splits) {
          if (split.method === 'Discount') {
            const splitTxnId = `TXN-${Date.now()}-Discount`;
            await window.electronAPI.dbQuery(
              `INSERT INTO account_transactions 
               (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
              [
                splitTxnId,
                DEFAULT_SHOP_ID,
                'CASH',
                'EXPENSE',
                'Discount Given',
                split.amount,
                `Discount given to ${customer.name} during quick settlement`,
                txnTimestamp,
                timestamp,
                'Percent',
                null
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
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
            [
              splitTxnId,
              DEFAULT_SHOP_ID,
              (split.method === 'Bank' || split.method === 'Card' || split.method === 'UPI') ? 'BANK' : 'CASH',
              'INCOME',
              'Credit Settlement',
              split.amount,
              `Settlement from ${customer.name} via ${split.method}${
                (split.method === 'Card' || split.method === 'UPI' || split.method === 'Bank') && selectedBank ? ` (${selectedBank})` : ''
              }`,
              txnTimestamp,
              timestamp,
              'DollarSign',
              splitMappedBankId
            ]
          );
        }

        alert(`Successfully settled ${amount} (Discount: ${discount}) for ${customer.name}`);
      } else if (selectedSettleTarget.type === 'bill') {
        const bill = selectedSettleTarget.data;
        
        for (const split of splits) {
          let remaining = split.amount;
          const currentDue = bill.dueAmount;
          let allocate = Math.min(remaining, currentDue);
          let newPaid = (bill.paidAmount || 0) + allocate;
          let newDue = currentDue - allocate;
          let newStatus = newDue <= 0 ? 'Paid' : 'Partial';

          let updatedOrderStatus = bill.status;
          if (newDue <= 0 && bill.status === 'Payment Pending') {
            updatedOrderStatus = 'Confirmed';
          }

          await window.electronAPI.dbQuery(
            'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [newPaid, newDue, newStatus, updatedOrderStatus, (split.method === 'Card' || split.method === 'UPI' || split.method === 'Bank') ? split.method : 'Cash', timestamp, bill.id]
          );

          await window.electronAPI.dbQuery(
            `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [`PAY-QUICK-${Date.now()}-${bill.id}-${split.method}`, bill.customerId, bill.id, DEFAULT_SHOP_ID, allocate, split.method, 'SUCCESS', timestamp, timestamp]
          );
        }

        // Update Customer Balance
        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [totalReduction, timestamp, bill.customerId]
        );

        // Record Transactions in Accounts
        const txnTimestamp = getLocalDateTime();
        for (const split of splits) {
          if (split.method === 'Discount') {
            const splitTxnId = `TXN-${Date.now()}-Discount`;
            await window.electronAPI.dbQuery(
              `INSERT INTO account_transactions 
               (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
              [
                splitTxnId,
                DEFAULT_SHOP_ID,
                'CASH',
                'EXPENSE',
                'Discount Given',
                split.amount,
                `Discount given for Bill #${bill.billNumber || bill.id}`,
                txnTimestamp,
                timestamp,
                'Percent',
                null
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
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
            [
              splitTxnId,
              DEFAULT_SHOP_ID,
              (split.method === 'Bank' || split.method === 'Card' || split.method === 'UPI') ? 'BANK' : 'CASH',
              'INCOME',
              'Sales Settlement',
              split.amount,
              `Settlement for Bill #${bill.billNumber || bill.id} via ${split.method}`,
              txnTimestamp,
              timestamp,
              'DollarSign',
              splitMappedBankId
            ]
          );
        }

        alert(`Successfully settled ${amount} (Discount: ${discount}) for Bill #${bill.billNumber || bill.id}`);
      }

      setShowQuickSettle(false);
      setSettleSearch('');
      setSelectedSettleTarget(null);
      setSettleAmount('');
      setQuickDiscountAmount('');
      setQuickCashAmount('');
      setQuickCardAmount('');
      setQuickUpiAmount('');
      setQuickBankAmount('');
      setQuickSettleResults([]);
    } catch (err) {
      console.error("Quick settle error:", err);
      alert("Failed to process settlement: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredNavItems = navItems
    .filter(item => {
      if (role === 'super_admin') return item.path === '/activation' || item.path === '/settings';
      if (item.roleOnly) {
        if (Array.isArray(item.roleOnly)) return item.roleOnly.includes(role);
        return item.roleOnly === role;
      }
      if (!userPermissions) return false;
      return userPermissions[item.permissionKey];
    })
    .map(item => {
      if (!item.subItems) return item;
      return {
        ...item,
        subItems: item.subItems.filter(sub => {
          if (!sub.roleOnly) return true;
          if (role === 'super_admin') return true;
          if (Array.isArray(sub.roleOnly)) return sub.roleOnly.includes(role);
          return sub.roleOnly === role;
        })
      };
    });

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo} onClick={handleLogoClick}>
          <div className={styles.logoBrand}>
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" className={styles.logoImg} />
            ) : (
              <Layers color="#2563EB" size={24} />
            )}
            <span className={styles.sidebarText}>{settings.companyName.toUpperCase()}</span>
          </div>
          {!settings.companyName.toUpperCase().includes('SYSTEM') && (
            <span className={styles.logoSub}>MANAGEMENT SYSTEM</span>
          )}
        </div>

        <nav className={styles.nav}>
          {filteredNavItems.map((item) => {
            const isExpanded = expandedMenus.includes(item.label);
            const hasSubItems = item.subItems && item.subItems.length > 0;

            if (hasSubItems) {
              return (
                <div key={item.label} className={styles.navGroup}>
                  <div
                    className={`${styles.navItem} ${isExpanded ? styles.expanded : ''}`}
                    onClick={() => toggleMenu(item.label)}
                  >
                    <item.icon size={20} />
                    <span className={styles.sidebarText}>{t(item.label.toLowerCase().replace(/ & /g, '').replace(/ /g, ''), settings.language)}</span>
                    <Plus
                      size={14}
                      className={`${styles.chevron} ${isExpanded ? styles.rotated : ''}`}
                    />
                  </div>
                  {isExpanded && (
                    <div className={styles.subMenu}>
                      {item.subItems.map(sub => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          className={({ isActive }) =>
                            isActive ? `${styles.subNavItem} ${styles.activeSub}` : styles.subNavItem
                          }
                        >
                          <div className={styles.dot} />
                          {t(sub.label.toLowerCase().replace(/ /g, ''), settings.language)}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  isActive ? `${styles.navItem} ${styles.active}` : styles.navItem
                }
                onClick={() => setExpandedMenus([])}
              >
                <item.icon size={20} />
                <span className={styles.sidebarText}>{t(item.label.toLowerCase().replace(/ /g, ''), settings.language)}</span>
                {item.path === '/settings' && updateInfo && (
                  <span className={styles.updateBadge} style={{
                    marginLeft: 'auto',
                    backgroundColor: '#10B981',
                    color: 'white',
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    fontWeight: 'bold'
                  }}>
                    Update
                  </span>
                )}
              </NavLink>
            );
          })}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Trial Countdown for all users */}
            {settings?.isActivated && (
              (() => {
                const expiry = new Date(settings.expiryDate);
                const today = new Date();
                const diffTime = expiry - today;
                const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (days > 0 && days <= 31) {
                  return (
                    <div className={styles.trialStatusSidebar} style={{ margin: '0 0.5rem 1rem 0.5rem' }}>
                      <div className={styles.trialInfoSidebar}>
                        <Clock size={14} />
                        <span>Trial: {days} Days Left</span>
                      </div>
                      <div className={styles.trialBarSidebar}>
                        <div
                          className={styles.trialProgressSidebar}
                          style={{ width: `${(days / 31) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                }
                return null;
              })()
            )}

            <div
              className={styles.navItem}
              style={{ color: '#EF4444', cursor: 'pointer' }}
              onClick={() => {
                sessionStorage.clear();
                window.location.reload();
              }}
            >
              <LogOut size={20} /> <span className={styles.sidebarText}>Logout</span>
            </div>
          </div>
        </nav>

        {role !== 'super_admin' && (
          <div className={styles.sidebarFooter}>
            <NavLink to="/help" className={styles.helpLink}>
              <HelpCircle size={18} /> <span className={styles.sidebarText}>Help Center</span>
            </NavLink>
          </div>
        )}
      </aside>

      {/* Main Area */}
      <main className={styles.main}>
        <header className={styles.header}>
          {role !== 'super_admin' && (
            <div className={styles.searchBar}>
              <Search size={18} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search orders, customers, or services..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate(`/orders?search=${e.target.value}`);
                  }
                }}
              />
            </div>
          )}

          <div className={styles.headerRight} style={role === 'super_admin' ? { marginLeft: 'auto' } : {}}>
            {role !== 'super_admin' && (
              <div className={styles.headerIcons}>
                <button
                  className={styles.headerNewOrderBtn}
                  onClick={() => navigate('/pos')}
                  title="New Order"
                >
                  <Plus size={18} /> New Order
                </button>
                <div className={styles.headerDeliverInput} title="Scan or type Order ID to mark as Delivered">
                  <Truck size={16} color="#94A3B8" />
                  <input
                    type="text"
                    placeholder="Deliver Order ID..."
                    onKeyDown={handleQuickDeliverKeyPress}
                  />
                </div>
                <button className={styles.headerSettleBtn} onClick={() => setShowQuickSettle(true)}>
                  <DollarSign size={18} /> Settle Bill
                </button>
                {(role === 'super_admin' || role === 'manager') && (
                  <button className={styles.headerSettleBtn} onClick={() => navigate('/reports/z-report')} title="Z Report">
                    <Activity size={18} /> Z Report
                  </button>
                )}
                <div
                  ref={notificationRef}
                  className={styles.iconBtn}
                  onClick={() => { setIsNotificationsOpen(!isNotificationsOpen); setIsSupportOpen(false); setIsProfileOpen(false); }}
                >
                  <Bell size={20} />
                  {notifications.length > 0 && <span className={styles.badge}></span>}

                  {isNotificationsOpen && (
                    <div className={styles.dropdownMenu}>
                      <div className={styles.dropdownHeader}>
                        <strong>Recent Notifications</strong>
                        <span>You have {notifications.length} recent events</span>
                      </div>
                      <div className={styles.dropdownDivider} />
                      <div className={styles.notificationList}>
                        {notifications.map(n => (
                          <div key={n.id} className={styles.notificationItem} onClick={() => navigate('/orders')}>
                            <div className={styles.notifIcon}><ShoppingBag size={14} /></div>
                            <div className={styles.notifContent}>
                              <p>Order <strong>{settings.invoicePrefix || ''}{n.id}</strong> updated to <strong>{n.status}</strong></p>
                              <span>{new Date(n.createdAt).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  ref={supportRef}
                  className={styles.iconBtn}
                  onClick={() => { setIsSupportOpen(!isSupportOpen); setIsNotificationsOpen(false); setIsProfileOpen(false); }}
                >
                  <HelpCircle size={20} />
                  <span>Support</span>

                  {isSupportOpen && (
                    <div className={styles.dropdownMenu} style={{ width: '200px' }}>
                      <div className={styles.dropdownHeader}>
                        <strong>Need Help?</strong>
                      </div>
                      <div className={styles.dropdownDivider} />
                      <div className={styles.dropdownItem} onClick={() => navigate('/help')}>
                        <HelpCircle size={16} /> Help Center
                      </div>
                      <div className={styles.dropdownItem} onClick={() => window.open('https://wa.me/971588851680', '_blank')}>
                        <WhatsAppIcon size={16} /> WhatsApp Support
                      </div>
                      <div className={styles.dropdownItem} onClick={() => window.location.href = 'tel:+971588851680'}>
                        <Phone size={16} /> Call Support
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              ref={profileRef}
              className={styles.userProfile}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              style={{ cursor: 'pointer', position: 'relative', flexDirection: 'column', gap: '0.25rem', justifyContent: 'center' }}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2563EB&color=fff`}
                alt={user.name}
                className={styles.avatar}
                style={{ width: '36px', height: '36px' }}
              />
              <span className={styles.userRole} style={{ fontSize: '0.7rem' }}>{(user.role || role).replace('_', ' ')}</span>

              {isProfileOpen && (
                <div className={styles.profileDropdown}>
                  <div className={styles.dropdownHeader}>
                    <strong>{user.name}</strong>
                    <span>{user.phone || 'No Phone'}</span>
                  </div>
                  <div className={styles.dropdownDivider} />
                  <div className={`${styles.dropdownItem} ${styles.logoutItem}`} onClick={() => {
                    sessionStorage.clear();
                    window.location.reload();
                  }}>
                    <LogOut size={16} />
                    <span>Logout</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={styles.content}>
          {settings && !settings.isActivated && role !== 'super_admin' ? (
            <div className={styles.licenseLock}>
              <AlertTriangle size={64} color="#EF4444" />
              <h2>System Activation Required</h2>
              <p>Your software license has expired or is not activated. Please contact your administrator to activate the system.</p>
              <div className={styles.deviceInfo}>Device ID: LAUN-POS-ADMIN</div>
            </div>
          ) : (
            <Outlet />
          )}
        </div>

        {/* Floating Sync Status */}
        <div
          className={`${styles.syncStatus} ${!isOnline ? styles.offline : ''}`}
          onClick={handleSync}
          title={isOnline ? "Click to sync now" : ""}
        >
          {isOnline ? (
            <>
              {isSyncing ? <RefreshCw size={14} className="spin" /> : <Wifi size={14} />}
              {isSyncing ? 'Syncing' : 'Online'}
            </>
          ) : (
            <>
              <WifiOff size={14} /> Offline
            </>
          )}
        </div>
      </main>

      {/* Quick Settlement Modal */}
      {showQuickSettle && (
        <div className={styles.modalOverlay}>
          <div className={styles.quickModal}>
            <div className={styles.modalHeader}>
              <div className={styles.titleWithIcon}>
                <DollarSign color="#10B981" size={24} />
                <h2>Quick Settlement</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => { setShowQuickSettle(false); setSettleSearch(''); setSelectedSettleTarget(null); setSettleAmount(''); setQuickSettleResults([]); }}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label>Search Customer (Name/Phone) or Bill No</label>
                <div className={styles.searchWrapper}>
                  <Search size={18} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search name, phone, or bill number..."
                    value={settleSearch}
                    onChange={(e) => handleQuickSettleSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {!selectedSettleTarget && quickSettleResults.length > 0 && (
                <div className={styles.quickSettleResults}>
                  {quickSettleResults.map((result, idx) => (
                    <div
                      key={idx}
                      className={styles.quickSettleResultItem}
                      onClick={() => {
                        setSelectedSettleTarget(result);
                        setQuickSettleResults([]);
                        if (result.type === 'customer') {
                          setSettleSearch(result.data.name);
                          setSettleAmount('');
                        } else {
                          setSettleSearch(result.data.billNumber || result.data.id);
                          setSettleAmount(result.data.dueAmount.toString());
                        }
                      }}
                    >
                      <div className={styles.resultItemLeft}>
                        <div className={`${styles.resultItemIcon} ${result.type === 'customer' ? styles.customer : styles.bill}`}>
                          {result.type === 'customer' ? <Users size={16} /> : <FileText size={16} />}
                        </div>
                        <div className={styles.resultItemText}>
                          <span className={styles.resultItemTitle}>
                            {result.type === 'customer' ? result.data.name : `Bill #${result.data.billNumber || `${settings.invoicePrefix || ''}${result.data.id}`}`}
                          </span>
                          <span className={styles.resultItemSub}>
                            {result.type === 'customer'
                              ? (result.data.phone ? `Phone: ${result.data.phone}` : 'No Phone Number')
                              : `Cust: ${result.data.customerName || 'Walk-in'} ${result.data.customerPhone ? `(${result.data.customerPhone})` : ''}`}
                          </span>
                        </div>
                      </div>
                      <div className={styles.resultItemRight}>
                        <span className={styles.resultItemPrice}>
                          {(settings.currencySymbol || 'AED')} {(result.type === 'customer' ? result.data.balance : result.data.dueAmount).toFixed(2)}
                        </span>
                        <span className={`${styles.resultTypeBadge} ${result.type === 'customer' ? styles.customer : styles.bill}`}>
                          {result.type === 'customer' ? 'Customer' : 'Bill'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedSettleTarget ? (
                <div className={styles.orderResult}>
                  <div className={styles.resultHeader}>
                    <span className={styles.orderId}>
                      {selectedSettleTarget.type === 'customer'
                        ? selectedSettleTarget.data.name
                        : `Bill #${selectedSettleTarget.data.billNumber || `${settings.invoicePrefix || ''}${selectedSettleTarget.data.id}`}`}
                    </span>
                    <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                      Due: {(settings.currencySymbol || 'AED')} {(selectedSettleTarget.type === 'customer' ? selectedSettleTarget.data.balance : selectedSettleTarget.data.dueAmount).toFixed(2)}
                    </span>
                  </div>

                  {selectedSettleTarget.type === 'bill' && (
                    <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0' }}>
                      <div className={styles.resultRow} style={{ marginBottom: '0.25rem' }}>
                        <span className={styles.label}>Customer Name:</span>
                        <span className={styles.value}>{selectedSettleTarget.data.customerName || 'Walk-in'}</span>
                      </div>
                      {selectedSettleTarget.data.customerPhone && (
                        <div className={styles.resultRow}>
                          <span className={styles.label}>Customer Phone:</span>
                          <span className={styles.value}>{selectedSettleTarget.data.customerPhone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.quickSettleForm}>
                    <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                      <label>Amount to Receive</label>
                      <input
                        type="number"
                        className={styles.amountInput}
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={settleMethod === 'Mixed'}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '1.25rem', fontWeight: 700 }}
                      />
                    </div>

                    <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                      <label>Discount Amount</label>
                      <input
                        type="number"
                        value={quickDiscountAmount}
                        onChange={(e) => setQuickDiscountAmount(e.target.value)}
                        placeholder="0.00"
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '1.1rem', fontWeight: 700 }}
                      />
                    </div>

                    <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                      <label>Method</label>
                      <select
                        value={settleMethod}
                        onChange={(e) => setSettleMethod(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="UPI">UPI</option>
                        {settings.enableNomod && <option value="Nomod">Nomod Link</option>}
                        <option value="Mixed">Mixed Payment</option>
                      </select>
                    </div>

                    {settleMethod === 'Mixed' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Cash</label>
                          <input type="number" placeholder="0.00" value={quickCashAmount} onChange={(e) => setQuickCashAmount(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Card</label>
                          <input type="number" placeholder="0.00" value={quickCardAmount} onChange={(e) => setQuickCardAmount(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>UPI</label>
                          <input type="number" placeholder="0.00" value={quickUpiAmount} onChange={(e) => setQuickUpiAmount(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Bank</label>
                          <input type="number" placeholder="0.00" value={quickBankAmount} onChange={(e) => setQuickBankAmount(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                        </div>
                      </div>
                    )}

                    {(settleMethod === 'Card' || settleMethod === 'UPI' || (settleMethod === 'Mixed' && (quickCardVal > 0 || quickUpiVal > 0 || quickBankVal > 0))) && settings.bankAccounts?.length > 0 && (
                      <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                        <label>{settleMethod === 'Card' ? 'Select Bank Account' : 'Select UPI Account'}</label>
                        <select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                        >
                          {settings.bankAccounts.map((acc, idx) => (
                            <option key={idx} value={acc.bankName}>{acc.bankName}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      className={styles.confirmDeliverBtn}
                      style={{ background: '#10B981', marginTop: '1.5rem' }}
                      onClick={() => processQuickSettle(false)}
                      disabled={isUpdating || !settleAmount}
                    >
                      {isUpdating ? 'Processing...' : 'Confirm Settlement'}
                    </button>
                  </div>
                </div>
              ) : settleSearch.length >= 2 && quickSettleResults.length === 0 ? (
                <div className={styles.noOrder}>No matching customer or bill found</div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {nomodLinkModal.show && (
        <div className={styles.modalOverlay} style={{ zIndex: 9999 }}>
          <div className={styles.quickModal} style={{ width: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.titleWithIcon}>
                <CreditCard color="#2563EB" size={24} />
                <h2>Nomod Payment Link</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => setNomodLinkModal({ show: false, url: '', linkId: '', amount: 0 })}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 800 }}>SETTLEMENT AMOUNT</span>
                <h1 style={{ margin: '0.25rem 0 0 0', color: '#1E293B', fontSize: '2rem', fontWeight: 800 }}>
                  {settings.currencySymbol || 'AED'} {nomodLinkModal.amount.toFixed(2)}
                </h1>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                <div style={{ padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <QRCodeCanvas 
                    id="nomod-quick-settle-qr-canvas"
                    value={nomodLinkModal.url}
                    size={160}
                    level="H"
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Nomod Checkout URL</label>
                <input
                  type="text"
                  readOnly
                  value={nomodLinkModal.url}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F1F5F9', marginTop: '0.25rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {deliveryToast && (
        <div className={deliveryToast.type === 'error' ? styles.toastNotificationError : styles.toastNotification}>
          {deliveryToast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{deliveryToast.message}</span>
        </div>
      )}
    </div>
  );
}
