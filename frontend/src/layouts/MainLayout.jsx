import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Users, ClipboardList, Settings, Layers,
  BarChart3, Zap, Plus, Search, Bell, HelpCircle, LifeBuoy, Wifi, WifiOff, RefreshCw, Activity, LogOut, Wallet,
  DollarSign, X, CheckCircle, CreditCard, ShoppingBag, Trash2, Building2, Hash, FileText,
  AlertTriangle, ShieldCheck, Clock, Package, Truck, Phone, Cpu, Lock
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
import { paymentService } from '../services/paymentService';

const API_BASE = API_BASE_URL;

export default function MainLayout() {
  const { settings, updateSettings, isSettingsDirty, setIsSettingsDirty, originalSettings, setOriginalSettings } = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [overrideModal, setOverrideModal] = useState({ show: false, resolve: null, reject: null, pinValue: '', error: '' });
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [pendingOptions, setPendingOptions] = useState(null);

  const customNavigate = (path, options) => {
    if (isSettingsDirty) {
      setPendingPath(path);
      setPendingOptions(options);
      setShowUnsavedModal(true);
    } else {
      navigate(path, options);
    }
  };
  const handleNavClick = (e, path) => {
    if (isSettingsDirty) {
      if (e && e.preventDefault) e.preventDefault();
      setPendingPath(path);
      setPendingOptions(null);
      setShowUnsavedModal(true);
    }
  };
  const executeLogout = () => {
    sessionStorage.clear();
    window.location.reload();
  };
  const handleLogoutClick = (e) => {
    if (isSettingsDirty) {
      if (e && e.preventDefault) e.preventDefault();
      setPendingPath('LOGOUT');
      setPendingOptions(null);
      setShowUnsavedModal(true);
    } else {
      executeLogout();
    }
  };
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
    if (settleMethod === 'Multipayment') {
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
    if (settleMethod !== 'Multipayment') {
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

  // Set up global printing helper
  useEffect(() => {
    window.appPrint = async (options = {}) => {
      if (window.electronAPI?.printInvoice) {

        // ── 1. Find the invoice or tag element to print ──
        const isTag = options.printerType === 'tag';
        let printTarget = isTag
          ? document.querySelector('.printing-tags') || document.querySelector('[class*="dressTag"]') || document.querySelector('[class*="tagCard"]')
          : document.querySelector('[class*="invoiceCard"]') || document.querySelector('[class*="thermalHeader"]')?.closest('[class*="invoiceCard"], [class*="invoice"]');

        // Fallback: use whole body if no specific target found
        const sourceEl = printTarget || document.body;

        // ── 2. Deep clone the target element ──
        const clone = sourceEl.cloneNode(true);

        // ── 3. Remove all noprint / UI-only elements ──
        clone.querySelectorAll('[data-noprint="true"], [class*="editMode"], [class*="noprint"], button').forEach(el => el.remove());

        // ── 4. Fix image srcs (cloneNode does not copy live src) ──
        const originalImages = sourceEl.getElementsByTagName('img');
        const clonedImages = clone.getElementsByTagName('img');
        for (let i = 0; i < clonedImages.length; i++) {
          if (originalImages[i]?.src) {
            clonedImages[i].src = originalImages[i].src;
          }
        }

        // ── 5. Extract all CSS from the page ──
        let css = '';
        for (const sheet of document.styleSheets) {
          try {
            const rules = Array.from(sheet.cssRules || []);
            css += rules.map(r => r.cssText).join('\n') + '\n';
          } catch (_) { }
        }

        // ── 6. Add solid black print override ──
        css += `
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body, * { color: #000 !important; background-color: transparent !important; box-shadow: none !important; }
          .thermalTotalBold span, .thermalGrandTotal span { color: #000 !important; font-weight: 900 !important; }
          svg { display: none !important; }
        `;

        const html = clone.outerHTML || `<div>${clone.innerHTML}</div>`;

        // ── 7. Select printer ──
        const billingPrinter = window.localStorage.getItem('billingPrinter') || '';
        const tagPrinter = window.localStorage.getItem('tagPrinter') || '';
        const selectedPrinter = options.printerName || (isTag ? tagPrinter : billingPrinter);

        if (!selectedPrinter) {
          alert(isTag
            ? "No default tag printer is selected. Please configure it in settings under the Printers tab."
            : "No default printer is selected. Please configure a default printer in settings under the Printers tab."
          );
          return;
        }

        const res = await window.electronAPI.printInvoice({
          html,
          css,
          printerName: selectedPrinter,
          silent: true
        });

        if (res && !res.success) {
          alert("Printing failed: " + (res.error || "Selected printer is offline or unavailable."));
        }
      } else {
        window.print();
      }
    };

    return () => {
      delete window.appPrint;
    };
  }, []);

  // Scroll to top when route changes
  useEffect(() => {
    const contentArea = document.querySelector(`.${styles.content}`);
    if (contentArea) {
      contentArea.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // 1. Connection status monitoring
  useEffect(() => {
    let active = true;
    let timer = null;

    const checkStatus = async () => {
      if (!navigator.onLine) {
        if (active) setIsOnline(false);
        return;
      }

      try {
        // 1. Check local backend server status
        const response = await fetch(`${API_BASE}/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout ? AbortSignal.timeout(2000) : null
        });
        if (!response.ok) {
          if (active) setIsOnline(false);
          return;
        }
        const data = await response.json();
        if (data.status !== 'ok') {
          if (active) setIsOnline(false);
          return;
        }

        // 2. Check actual internet access to ensure Atlas MongoDB connection is reachable
        await fetch('https://clients3.google.com/generate_204', {
          mode: 'no-cors',
          cache: 'no-store',
          signal: AbortSignal.timeout ? AbortSignal.timeout(2000) : null
        });

        if (active) setIsOnline(true);
      } catch (err) {
        if (active) setIsOnline(false);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 30 seconds
    timer = setInterval(checkStatus, 30000);

    const handleOnline = () => {
      if (active) {
        setIsOnline(true);
        checkStatus();
      }
    };
    const handleOffline = () => {
      if (active) setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
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

  // Payment status changed global listener & OS Notification click redirect
  useEffect(() => {
    const unsubscribe = paymentService.subscribe((data) => {
      if (data.status === 'Paid') {
        const custName = data.customerName || 'Customer';
        const orderId = data.orderId;
        const amountPaid = data.amount ? `${settings.currencySymbol || 'AED'} ${data.amount.toFixed(2)}` : 'N/A';
        showToast(
          `✅ Payment Received Successfully\n\nCustomer: ${custName}\nInvoice: ${orderId}\nAmount: ${amountPaid}`,
          'success'
        );
      }
    });

    let unsubscribeNav = () => { };
    if (window.electronAPI && window.electronAPI.onNavigateToPendingPayments) {
      unsubscribeNav = window.electronAPI.onNavigateToPendingPayments(() => {
        customNavigate('/orders');
      });
    }

    return () => {
      unsubscribe();
      unsubscribeNav();
    };
  }, [settings, navigate]);

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



  const [currentUser, setCurrentUser] = useState(() => {
    let u = {};
    try {
      u = JSON.parse(sessionStorage.getItem('user') || '{}');
      let normalized = false;
      if (u.role === 'admin') {
        u.role = 'super_admin';
        normalized = true;
      }
      if (u.role === 'staff') {
        u.role = 'cashier';
        normalized = true;
      }
      if (normalized) {
        sessionStorage.setItem('user', JSON.stringify(u));
      }
    } catch (e) {
      console.error("Failed to parse user data", e);
    }
    return u;
  });

  useEffect(() => {
    const handleUserUpdate = () => {
      let u = {};
      try {
        u = JSON.parse(sessionStorage.getItem('user') || '{}');
        let normalized = false;
        if (u.role === 'admin') {
          u.role = 'super_admin';
          normalized = true;
        }
        if (u.role === 'staff') {
          u.role = 'cashier';
          normalized = true;
        }
        if (normalized) {
          sessionStorage.setItem('user', JSON.stringify(u));
        }
      } catch (e) {
        console.error("Failed to parse user data on update", e);
      }
      setCurrentUser(u);
    };
    window.addEventListener('user-profile-updated', handleUserUpdate);
    return () => window.removeEventListener('user-profile-updated', handleUserUpdate);
  }, []);

  const user = currentUser;
  const role = user.role || '';
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
        { path: '/settlement', label: 'Settle Invoice' },
        { path: '/orders/expected-delivery', label: 'Expected Deliveries' },
        { path: '/orders/deleted', label: 'Deleted Orders' }
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

  const getManagerPinViaModal = () => {
    return new Promise((resolve, reject) => {
      setOverrideModal({
        show: true,
        resolve,
        reject,
        pinValue: '',
        error: ''
      });
    });
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
        let pin = '';
        try {
          pin = await getManagerPinViaModal();
        } catch (err) {
          setIsUpdating(false);
          return;
        };
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
            } else {
              const errorMsg = checkoutRes?.error || 'Unknown error';
              console.warn("Nomod Backend API failed in Quick Settle:", errorMsg);
              if (settings.nomodEnv === 'live') {
                alert("Nomod Checkout API connection failed: " + errorMsg + ". Please check your API key configuration in settings.");
                return;
              } else {
                alert("Nomod Checkout API connection failed: " + errorMsg + ". Falling back to sandbox payment link.");
              }
            }
          } catch (err) {
            console.warn("Nomod Checkout IPC failed in Quick Settle:", err.message);
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
      if (settleMethod === 'Multipayment') {
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
              const payRef = await window.electronAPI.getNextPaymentReference('QPY');
              await window.electronAPI.dbQuery(
                `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                [payId, customer.id, bill.id, DEFAULT_SHOP_ID, allocate, split.method, 'SUCCESS', timestamp, timestamp, payRef]
              );
            }
          }

          if (remaining > 0) {
            const payId = await getNextRvNumber();
            const payRef = await window.electronAPI.getNextPaymentReference('QPY');
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
              [payId, customer.id, null, DEFAULT_SHOP_ID, remaining, split.method, 'SUCCESS', timestamp, timestamp, payRef]
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
        const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
        const creatorName = userSession.name || userSession.username || 'System';
        const creatorId = userSession.id || 'SYSTEM';
        const creatorRole = userSession.role || 'system';

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
                `Discount given to ${customer.name} during quick settlement`,
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
              (split.method === 'Bank' || split.method === 'Card' || split.method === 'UPI') ? 'BANK' : 'CASH',
              'INCOME',
              'Credit Settlement',
              split.amount,
              `Settlement from ${customer.name} via ${split.method}${(split.method === 'Card' || split.method === 'UPI' || split.method === 'Bank') && selectedBank ? ` (${selectedBank})` : ''
              }`,
              txnTimestamp,
              timestamp,
              'DollarSign',
              splitMappedBankId,
              creatorName,
              creatorId,
              creatorRole
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

          const payId = await getNextRvNumber();
          const payRef = await window.electronAPI.getNextPaymentReference('QPY');
          await window.electronAPI.dbQuery(
            `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [payId, bill.customerId, bill.id, DEFAULT_SHOP_ID, allocate, split.method, 'SUCCESS', timestamp, timestamp, payRef]
          );
        }

        // Update Customer Balance
        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [totalReduction, timestamp, bill.customerId]
        );

        // Record Transactions in Accounts
        const txnTimestamp = getLocalDateTime();
        const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
        const creatorName = userSession.name || userSession.username || 'System';
        const creatorId = userSession.id || 'SYSTEM';
        const creatorRole = userSession.role || 'system';

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
                `Discount given for Order #${settings.invoicePrefix || ''}${bill.id}`,
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
              (split.method === 'Bank' || split.method === 'Card' || split.method === 'UPI') ? 'BANK' : 'CASH',
              'INCOME',
              'Sales Settlement',
              split.amount,
              `Settlement for Order #${settings.invoicePrefix || ''}${bill.id} via ${split.method}`,
              txnTimestamp,
              timestamp,
              'DollarSign',
              splitMappedBankId,
              creatorName,
              creatorId,
              creatorRole
            ]
          );
        }

        alert(`Successfully settled ${amount} (Discount: ${discount}) for Order #${settings.invoicePrefix || ''}${bill.id}`);
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
      window.location.reload();
    } catch (err) {
      console.error("Quick settle error:", err);
      alert("Failed to process settlement: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredNavItems = navItems
    .filter(item => {
      if (item.path === '/workflow' && !settings.workflowEnabled) return false;
      if (item.path === '/reports/z-report' && !settings.zReportEnabled) return false;

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
          if (sub.path === '/workflow' && !settings.workflowEnabled) return false;
          if (sub.path === '/reports/z-report' && !settings.zReportEnabled) return false;
          if (sub.path === '/reports/nomod-history' && (!settings.noModPayEnabled || !settings.paymentHistoryEnabled)) return false;
          if (sub.path === '/accounts/gateway' && !settings.noModPayEnabled) return false;

          if (!sub.roleOnly) return true;
          if (role === 'super_admin') return true;
          if (Array.isArray(sub.roleOnly)) return sub.roleOnly.includes(role);
          return sub.roleOnly === role;
        })
      };
    })
    .filter(item => !item.subItems || item.subItems.length > 0);

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
                          onClick={(e) => handleNavClick(e, sub.path)}
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
                onClick={(e) => {
                  setExpandedMenus([]);
                  handleNavClick(e, item.path);
                }}
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
              onClick={handleLogoutClick}
            >
              <LogOut size={20} /> <span className={styles.sidebarText}>Logout</span>
            </div>
          </div>
        </nav>

        {role !== 'super_admin' && (
          <div className={styles.sidebarFooter}>
            <NavLink
              to="/help"
              className={styles.helpLink}
              onClick={(e) => handleNavClick(e, '/help')}
            >
              <HelpCircle size={18} /> <span className={styles.sidebarText}>Help Center</span>
            </NavLink>
          </div>
        )}
      </aside>

      {/* Main Area */}
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerRight} style={{ marginLeft: 'auto' }}>
            {role !== 'super_admin' && (
              <div className={styles.headerIcons}>
                <button
                  className={styles.headerNewOrderBtn}
                  onClick={() => customNavigate('/pos')}
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
                  <button className={styles.headerSettleBtn} onClick={() => customNavigate('/reports/z-report')} title="Z Report">
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
                          <div key={n.id} className={styles.notificationItem} onClick={() => customNavigate('/orders')}>
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
                      <div className={styles.dropdownItem} onClick={() => customNavigate('/help')}>
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
                  <div className={`${styles.dropdownItem} ${styles.logoutItem}`} onClick={handleLogoutClick}>
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

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUnsavedModal(false)} style={{ zIndex: 9999 }}>
          <div className={styles.quickModal} style={{ maxWidth: '450px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem' }}>
              <div className={styles.titleWithIcon} style={{ display: 'flex', alignItems: 'center' }}>
                <AlertTriangle color="#F59E0B" size={24} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginLeft: '0.5rem' }}>Unsaved Changes</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowUnsavedModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody} style={{ padding: '1.5rem 0' }}>
              <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>
                You have unsaved changes. Do you want to save your changes before leaving this page?
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.confirmModalBtn} ${styles.confirmModalBtnDiscard}`}
                onClick={async () => {
                  if (originalSettings) {
                    await updateSettings(originalSettings);
                  }
                  setIsSettingsDirty(false);
                  setShowUnsavedModal(false);
                  setTimeout(() => {
                    if (pendingPath === 'LOGOUT') {
                      executeLogout();
                    } else if (pendingPath) {
                      if (pendingOptions) navigate(pendingPath, pendingOptions);
                      else navigate(pendingPath);
                    }
                  }, 0);
                }}
              >
                Discard Changes
              </button>
              <button
                type="button"
                className={`${styles.confirmModalBtn} ${styles.confirmModalBtnSave}`}
                onClick={() => {
                  setOriginalSettings(JSON.parse(JSON.stringify(settings)));
                  setIsSettingsDirty(false);
                  setShowUnsavedModal(false);
                  setTimeout(() => {
                    if (pendingPath === 'LOGOUT') {
                      executeLogout();
                    } else if (pendingPath) {
                      if (pendingOptions) navigate(pendingPath, pendingOptions);
                      else navigate(pendingPath);
                    }
                  }, 0);
                }}
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}

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
                <label>Search Customer (Name/Phone) or Invoice/Order No</label>
                <div className={styles.searchWrapper}>
                  <Search size={18} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search name, phone, or invoice/order number..."
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
                          setSettleSearch(result.data.id);
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
                            {result.type === 'customer' ? result.data.name : `Invoice/Order #${settings.invoicePrefix || ''}${result.data.id}`}
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
                          {result.type === 'customer' ? (
                            result.data.balance < 0 ? (
                              <span style={{ color: '#15803D' }}>
                                {Math.abs(result.data.balance).toFixed(2)} {(settings.currencySymbol || 'AED')}
                              </span>
                            ) : result.data.balance > 0 ? (
                              <span style={{ color: '#B91C1C' }}>
                                {result.data.balance.toFixed(2)} {(settings.currencySymbol || 'AED')}
                              </span>
                            ) : (
                              <span>0.00 {(settings.currencySymbol || 'AED')}</span>
                            )
                          ) : (
                            <span>{result.data.dueAmount.toFixed(2)} {(settings.currencySymbol || 'AED')}</span>
                          )}
                        </span>
                        <span className={`${styles.resultTypeBadge} ${result.type === 'customer'
                            ? (result.data.balance < 0 ? styles.advance : (result.data.balance > 0 ? styles.due : styles.settled))
                            : styles.bill
                          }`}>
                          {result.type === 'customer'
                            ? (result.data.balance < 0 ? 'Advance' : (result.data.balance > 0 ? 'Credit/Due' : 'Settled'))
                            : 'Order'}
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
                        : `Invoice/Order #${settings.invoicePrefix || ''}${selectedSettleTarget.data.id}`}
                    </span>
                    <span className={`${styles.statusBadge} ${selectedSettleTarget.type === 'customer' && selectedSettleTarget.data.balance < 0
                        ? styles.statusDone
                        : ''
                      }`}>
                      {selectedSettleTarget.type === 'customer' && selectedSettleTarget.data.balance < 0
                        ? `Advance: ${(settings.currencySymbol || 'AED')} ${Math.abs(selectedSettleTarget.data.balance).toFixed(2)}`
                        : `Due: ${(settings.currencySymbol || 'AED')} ${(selectedSettleTarget.type === 'customer' ? selectedSettleTarget.data.balance : selectedSettleTarget.data.dueAmount).toFixed(2)}`}
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
                        disabled={settleMethod === 'Multipayment'}
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
                        <option value="Multipayment">Multipayment</option>
                      </select>
                    </div>

                    {settleMethod === 'Multipayment' && (
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

                    {(settleMethod === 'Card' || settleMethod === 'UPI' || (settleMethod === 'Multipayment' && (quickCardVal > 0 || quickUpiVal > 0 || quickBankVal > 0))) && settings.bankAccounts?.length > 0 && (
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

      {overrideModal.show && (
        <div className={styles.modalOverlay} onClick={() => {
          overrideModal.reject(new Error("Cancelled"));
          setOverrideModal({ show: false, resolve: null, reject: null, pinValue: '', error: '' });
        }}>
          <div className={styles.statusModal} style={{ maxWidth: '450px', borderRadius: '24px', background: 'white', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Lock size={24} color="#D97706" style={{ marginTop: '2px' }} />
              <div>
                <h2 style={{ color: '#D97706', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Manager Authorization</h2>
                <p style={{ color: '#64748B', margin: '2px 0 0 0', fontSize: '0.85rem', fontWeight: 500, opacity: 0.9 }}>Enter Manager secure PIN to approve override.</p>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                ENTER MANAGER SECURE PIN TO APPROVE
              </label>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '0.75rem 1rem', background: '#F8FAFC' }}>
                <Lock size={18} color="#94A3B8" />
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={overrideModal.pinValue}
                  onChange={(e) => setOverrideModal(prev => ({ ...prev, pinValue: e.target.value.replace(/\D/g, ''), error: '' }))}
                  placeholder="••••"
                  style={{ 
                    width: '100%', 
                    padding: '0px', 
                    fontSize: '1.5rem', 
                    letterSpacing: '0.5rem', 
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    color: '#1E293B'
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && overrideModal.pinValue) {
                      overrideModal.resolve(overrideModal.pinValue);
                      setOverrideModal({ show: false, resolve: null, reject: null, pinValue: '', error: '' });
                    }
                  }}
                />
              </div>

              {overrideModal.error && (
                <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>
                  {overrideModal.error}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  overrideModal.reject(new Error("Cancelled"));
                  setOverrideModal({ show: false, resolve: null, reject: null, pinValue: '', error: '' });
                }}
                style={{ background: 'none', border: 'none', color: '#64748B', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', padding: '0.5rem 0' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (overrideModal.pinValue) {
                    overrideModal.resolve(overrideModal.pinValue);
                    setOverrideModal({ show: false, resolve: null, reject: null, pinValue: '', error: '' });
                  }
                }}
                style={{ background: '#D97706', color: 'white', border: 'none', borderRadius: '10px', padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.2)' }}
                disabled={!overrideModal.pinValue}
              >
                Approve Override
              </button>
            </div>
          </div>
        </div>
      )}

      {deliveryToast && (
        <div className={deliveryToast.type === 'error' ? styles.toastNotificationError : styles.toastNotification}>
          {deliveryToast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{deliveryToast.message}</span>
        </div>
      )}
    </div>
  );
}
