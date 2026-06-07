import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Users, ClipboardList, Settings, Layers,
  BarChart3, Zap, Plus, Search, Bell, HelpCircle, LifeBuoy, Wifi, WifiOff, RefreshCw, Activity, LogOut, Wallet,
  DollarSign, X, CheckCircle, CreditCard, ShoppingBag, Trash2, Building2, Hash, FileText,
  AlertTriangle, ShieldCheck, Clock, Package, Truck, MessageCircle, Phone, Cpu
} from 'lucide-react';
import axios from 'axios';
import { syncData } from '../services/syncService';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID, API_BASE_URL } from '../constants';
import { t } from '../utils/translations';
import { getLocalDateTime, getLocalISOString } from '../utils/dateUtils';
import styles from './MainLayout.module.css';

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


  const [showQuickDeliver, setShowQuickDeliver] = useState(false);
  const [showQuickSettle, setShowQuickSettle] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [settleSearch, setSettleSearch] = useState('');
  const [foundOrder, setFoundOrder] = useState(null);
  const [foundCustomer, setFoundCustomer] = useState(null); // Keep for compatibility if any other code refers to it, but define new ones:
  const [selectedSettleTarget, setSelectedSettleTarget] = useState(null);
  const [quickSettleResults, setQuickSettleResults] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('CASH');
  const [logoClicks, setLogoClicks] = useState(0);
  const [selectedBank, setSelectedBank] = useState('');

  useEffect(() => {
    if (settings.bankAccounts && settings.bankAccounts.length > 0 && !selectedBank) {
      const defaultBank = settings.bankAccounts.find(acc => acc.id === settings.defaultBankId) || settings.bankAccounts[0];
      setSelectedBank(defaultBank.bankName);
    }
  }, [settings.bankAccounts, settings.defaultBankId, selectedBank]);

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
    await syncData();

    // Auto-backup to USB/Folder if configured (read from settingsRef to avoid stale path)
    const currentSettings = settingsRef.current;
    if (currentSettings.autoBackupPath && window.electronAPI?.silentBackup) {
      console.log('Performing auto-backup to:', currentSettings.autoBackupPath);
      await window.electronAPI.silentBackup(currentSettings.autoBackupPath);
    }

    setIsSyncing(false);
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
  try {
    user = JSON.parse(sessionStorage.getItem('user') || '{}');
  } catch (e) {
    console.error("Failed to parse user data", e);
  }
  let role = user.role || 'super_admin';

  // Backward compatibility for old roles
  if (role === 'admin') role = 'super_admin';
  if (role === 'staff') role = 'cashier';

  const [userPermissions, setUserPermissions] = useState(null);

  useEffect(() => {
    fetchPermissions();
  }, [role]);

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
        { path: '/reports', label: 'Analytics' },
        { path: '/reports/revenue', label: 'Revenue' },
        { path: '/reports/expenses', label: 'Expenses' },
        { path: '/reports/tax', label: 'Tax Statements' },
        { path: '/reports/daily-tax', label: 'Daily Tax Report' },
        { path: '/reports/credit-overrides', label: 'Credit Overrides' },
      ]
    },
    {
      label: 'Accounts',
      icon: Wallet,
      permissionKey: 'accounts',
      subItems: [
        { path: '/accounts/cash', label: 'Cash Account' },
        { path: '/accounts/bank', label: 'Bank Account' },
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

  const handleQuickDeliverSearch = async (val) => {
    setQuickSearch(val);
    if (!val || val.trim().length < 2) {
      setFoundOrder(null);
      return;
    }

    if (window.electronAPI?.dbQuery) {
      const cleanVal = val.replace('#', '').replace('ORDER:', '').trim();
      const term = `%${cleanVal}%`;
      const rawTerm = `%${val}%`;

      const res = await window.electronAPI.dbQuery(
        `SELECT * FROM orders 
         WHERE id LIKE ? OR billNumber LIKE ? 
         OR id LIKE ? OR billNumber LIKE ? 
         OR customerName LIKE ? OR customerPhone LIKE ?`,
        [term, term, rawTerm, rawTerm, term, term]
      );
      if (res.success && res.data.length > 0) {
        const cleanSearch = val.replace('#', '').replace('ORDER:', '').trim().toLowerCase();
        // Sort to find the best match
        const sorted = [...res.data].sort((a, b) => {
          const aId = (a.id || '').toString().toLowerCase().replace('#', '');
          const bId = (b.id || '').toString().toLowerCase().replace('#', '');
          const aBill = (a.billNumber || '').toString().toLowerCase().replace('#', '');
          const bBill = (b.billNumber || '').toString().toLowerCase().replace('#', '');

          if (aId === cleanSearch || aBill === cleanSearch) return -1;
          if (bId === cleanSearch || bBill === cleanSearch) return 1;
          return 0;
        });
        setFoundOrder(sorted[0]);
        return; // Success, stop here
      }
    }

    // Fallback to Remote API if Local DB fails or has no results
    try {
      const res = await axios.get(`${API_BASE}/orders/search?q=${encodeURIComponent(val)}`);
      if (res.data && res.data.length > 0) {
        setFoundOrder(res.data[0]);
      } else {
        setFoundOrder(null);
      }
    } catch (apiErr) {
      console.error("Remote search failed:", apiErr);
      setFoundOrder(null);
    }
  };

  const processQuickDelivery = async () => {
    if (!foundOrder) return;
    setIsUpdating(true);
    try {
      if (window.electronAPI?.dbQuery) {
        let history = [];
        try {
          history = typeof foundOrder.statusHistory === 'string'
            ? JSON.parse(foundOrder.statusHistory || '[]')
            : (foundOrder.statusHistory || []);
          if (!Array.isArray(history)) history = [];
        } catch (e) {
          history = [];
        }
        const newHistory = [...history, { status: 'Delivered', updatedBy: 'Admin Staff', timestamp: new Date().toISOString() }];

        await window.electronAPI.dbQuery(
          'UPDATE orders SET status = ?, statusHistory = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          ['Delivered', JSON.stringify(newHistory), new Date().toISOString(), foundOrder.id]
        );

        // Sync with cloud backend if online
        try {
          await axios.patch(`${API_BASE}/orders/${encodeURIComponent(foundOrder.id)}/status`, {
            status: 'Delivered',
            updatedBy: 'Admin Staff'
          });
        } catch (syncErr) {
          console.warn("Cloud sync failed, will retry later:", syncErr);
        }

        alert(`Order #${foundOrder.id} marked as Delivered!`);
        setShowQuickDeliver(false);
        setQuickSearch('');
        setFoundOrder(null);

        // Refresh page if on Orders page
        if (location.pathname.includes('/orders')) {
          window.location.reload();
        }
      }
    } catch (err) {
      alert("Failed to update status: " + err.message);
    } finally {
      setIsUpdating(false);
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

  const processQuickSettle = async () => {
    if (!selectedSettleTarget || !settleAmount || parseFloat(settleAmount) <= 0) return;

    setIsUpdating(true);
    try {
      const amount = parseFloat(settleAmount);
      const timestamp = getLocalISOString();

      if (selectedSettleTarget.type === 'customer') {
        const customer = selectedSettleTarget.data;

        // 1. Update Customer Balance
        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [amount, timestamp, customer.id]
        );

        // 2. Record Payment
        await window.electronAPI.dbQuery(
          `INSERT INTO payments (id, customerId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [`PAY-QUICK-${Date.now()}`, customer.id, DEFAULT_SHOP_ID, amount, settleMethod, 'SUCCESS', timestamp, timestamp]
        );

        // Record Transaction in Accounts
        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = getLocalDateTime();
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            txnId,
            DEFAULT_SHOP_ID,
            settleMethod,
            'INCOME',
            'Credit Settlement',
            amount,
            `Settlement from ${customer.name}${settleMethod === 'BANK' && selectedBank ? ` via ${selectedBank}` : ''}`,
            txnTimestamp,
            timestamp,
            'DollarSign',
            settleMethod === 'BANK' ? selectedBank : null
          ]
        );

        // 3. Try to settle orders (simplified FIFO)
        const billsRes = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND dueAmount > 0 ORDER BY createdAt ASC",
          [customer.id]
        );

        let remaining = amount;
        if (billsRes.success && billsRes.data.length > 0) {
          for (const bill of billsRes.data) {
            if (remaining <= 0) break;
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
              [newPaid, newDue, newStatus, updatedOrderStatus, settleMethod, timestamp, bill.id]
            );
            remaining -= allocate;
          }
        }

        alert(`Successfully settled ${amount} for ${customer.name}`);
      } else if (selectedSettleTarget.type === 'bill') {
        const bill = selectedSettleTarget.data;
        const currentDue = bill.dueAmount;
        let allocate = Math.min(amount, currentDue);
        let newPaid = (bill.paidAmount || 0) + allocate;
        let newDue = currentDue - allocate;
        let newStatus = newDue <= 0 ? 'Paid' : 'Partial';

        let updatedOrderStatus = bill.status;
        if (newDue <= 0 && bill.status === 'Payment Pending') {
          updatedOrderStatus = 'Confirmed';
        }

        // 1. Update the order
        await window.electronAPI.dbQuery(
          'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [newPaid, newDue, newStatus, updatedOrderStatus, settleMethod, timestamp, bill.id]
        );

        // 2. Record Payment linked to specific order
        await window.electronAPI.dbQuery(
          `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [`PAY-QUICK-${Date.now()}-${bill.id}`, bill.customerId, bill.id, DEFAULT_SHOP_ID, amount, settleMethod, 'SUCCESS', timestamp, timestamp]
        );

        // 3. Update Customer Balance
        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [amount, timestamp, bill.customerId]
        );

        // Record Transaction in Accounts
        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = getLocalDateTime();
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            txnId,
            DEFAULT_SHOP_ID,
            settleMethod,
            'INCOME',
            'Sales Settlement',
            amount,
            `Settlement for Bill #${bill.billNumber || bill.id}${settleMethod === 'BANK' && selectedBank ? ` via ${selectedBank}` : ''}`,
            txnTimestamp,
            timestamp,
            'DollarSign',
            settleMethod === 'BANK' ? selectedBank : null
          ]
        );

        alert(`Successfully settled ${amount} for Bill #${bill.billNumber || bill.id}`);
      }

      setShowQuickSettle(false);
      setSettleSearch('');
      setSelectedSettleTarget(null);
      setSettleAmount('');
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
      if (role === 'super_admin') return true;
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

        <div className={styles.sidebarFooter}>
          <NavLink to="/help" className={styles.helpLink}>
            <HelpCircle size={18} /> <span className={styles.sidebarText}>Help Center</span>
          </NavLink>
        </div>
      </aside>

      {/* Main Area */}
      <main className={styles.main}>
        <header className={styles.header}>
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

          <div className={styles.headerRight}>
            <div className={styles.headerIcons}>
              <button
                className={styles.headerNewOrderBtn}
                onClick={() => navigate('/pos')}
                title="New Order"
              >
                <Plus size={18} /> New Order
              </button>
              <button
                className={styles.headerDeliverBtn}
                onClick={() => setShowQuickDeliver(true)}
                title="Quick Delivery"
              >
                <Truck size={18} /> Deliver
              </button>
              <button className={styles.headerSettleBtn} onClick={() => setShowQuickSettle(true)}>
                <DollarSign size={18} /> Settle Bill
              </button>
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
                            <p>Order <strong>{n.id}</strong> updated to <strong>{n.status}</strong></p>
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
                      <MessageCircle size={16} /> WhatsApp Support
                    </div>
                    <div className={styles.dropdownItem} onClick={() => window.location.href = 'tel:+971588851680'}>
                      <Phone size={16} /> Call Support
                    </div>
                  </div>
                )}
              </div>
            </div>

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

      {/* Quick Delivery Modal */}
      {showQuickDeliver && (
        <div className={styles.modalOverlay}>
          <div className={styles.quickModal}>
            <div className={styles.modalHeader}>
              <div className={styles.titleWithIcon}>
                <Truck color="#2563EB" size={24} />
                <h2>Quick Delivery</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => { setShowQuickDeliver(false); setQuickSearch(''); setFoundOrder(null); }}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label>Enter Bill No or Order ID</label>
                <div className={styles.searchWrapper}>
                  <Search size={18} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="e.g. #AG-50504"
                    value={quickSearch}
                    onChange={(e) => handleQuickDeliverSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {foundOrder ? (
                <div className={styles.orderResult}>
                  <div className={styles.resultHeader}>
                    <span className={styles.orderId}>{foundOrder.id}</span>
                    <span className={`${styles.statusBadge} ${foundOrder.status === 'Delivered' ? styles.statusDone : ''}`}>
                      {foundOrder.status}
                    </span>
                  </div>
                  <div className={styles.resultRow}>
                    <span className={styles.label}>Customer:</span>
                    <span className={styles.value}>{foundOrder.customerName || 'Walk-in'}</span>
                  </div>
                  <div className={styles.resultRow}>
                    <span className={styles.label}>Amount:</span>
                    <span className={styles.value}>{(settings.currencySymbol || 'AED')} {foundOrder.totalAmount?.toFixed(2)}</span>
                  </div>

                  {foundOrder.status === 'Delivered' ? (
                    <div className={styles.alreadyDelivered}>
                      <CheckCircle size={16} /> Already Delivered
                    </div>
                  ) : (
                    <button
                      className={styles.confirmDeliverBtn}
                      onClick={processQuickDelivery}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Updating...' : 'Mark as Delivered'}
                    </button>
                  )}
                </div>
              ) : quickSearch.length >= 3 ? (
                <div className={styles.noOrder}>No order found with this ID</div>
              ) : null}
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
                            {result.type === 'customer' ? result.data.name : `Bill #${result.data.billNumber || result.data.id}`}
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
                        : `Bill #${selectedSettleTarget.data.billNumber || selectedSettleTarget.data.id}`}
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
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '1.25rem', fontWeight: 700 }}
                      />
                    </div>

                    <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                      <label>Method</label>
                      <select
                        value={settleMethod}
                        onChange={(e) => setSettleMethod(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                      >
                        <option value="CASH">Cash</option>
                        <option value="BANK">Bank Transfer</option>
                        <option value="UPI">Digital (UPI)</option>
                      </select>
                    </div>

                    {settleMethod === 'BANK' && settings.bankAccounts?.length > 0 && (
                      <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                        <label>Select Bank Account</label>
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
                      onClick={processQuickSettle}
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

    </div>
  );
}
