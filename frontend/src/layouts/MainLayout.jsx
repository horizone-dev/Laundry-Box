import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Users, ClipboardList, Settings, Layers,
  BarChart3, Zap, Plus, Search, Bell, HelpCircle, LifeBuoy, Wifi, WifiOff, RefreshCw, Activity, LogOut, Wallet,
  DollarSign, X, CheckCircle, CreditCard, ShoppingBag
} from 'lucide-react';
import axios from 'axios';
import { syncData } from '../services/syncService';
import { useSettings } from '../context/SettingsContext';
import styles from './MainLayout.module.css';

export default function MainLayout() {
  const { settings } = useSettings();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();
  const API_BASE = 'http://localhost:3000/api';

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
    const syncInterval = setInterval(() => { if (isOnline) handleSync(); }, 60000);

    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, [isOnline]);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    await syncData();
    setIsSyncing(true); // Wait, should be false
    setIsSyncing(false);
  };



  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (e) {
    console.error("Failed to parse user data", e);
  }
  let role = user.role || 'super_admin';

  // Backward compatibility for old roles
  if (role === 'admin') role = 'super_admin';
  if (role === 'staff') role = 'cashier';

  const [expandedMenus, setExpandedMenus] = useState(['Services', 'Accounts', 'Customers']); // Services, Accounts, and Customers expanded by default

  const toggleMenu = (label) => {
    setExpandedMenus(prev => 
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'manager'] },
    { path: '/pos', label: 'POS', icon: ShoppingCart, roles: ['super_admin', 'manager', 'cashier'] },
    { 
      label: 'Orders', 
      icon: ClipboardList, 
      roles: ['super_admin', 'manager', 'cashier'],
      subItems: [
        { path: '/orders', label: 'All Orders' },
        { path: '/orders/pending', label: 'Pending Payments' },
      ]
    },
    { 
      label: 'Customers', 
      icon: Users, 
      roles: ['super_admin', 'manager', 'cashier'],
      subItems: [
        { path: '/customers', label: 'Customer List' },
      ]
    },
    { 
      label: 'Services', 
      icon: Layers, 
      roles: ['super_admin', 'manager'],
      subItems: [
        { path: '/services', label: 'Overview' },
        { path: '/services/list', label: 'Service List' },
        { path: '/services/type', label: 'Service Type' },
        { path: '/services/addons', label: 'Add-ons' },
      ]
    },
    { path: '/settlement', label: 'Settle Bill', icon: DollarSign, roles: ['super_admin', 'manager', 'cashier'] },
    { 
      label: 'Reports', 
      icon: BarChart3, 
      roles: ['super_admin', 'manager'],
      subItems: [
        { path: '/reports', label: 'Analytics' },
        { path: '/reports/revenue', label: 'Revenue' },
        { path: '/reports/expenses', label: 'Expenses' },
      ]
    },
    { path: '/expenses', label: 'Expenses', icon: Zap, roles: ['super_admin', 'manager'] },
    { 
      label: 'Accounts', 
      icon: Wallet, 
      roles: ['super_admin', 'manager'],
      subItems: [
        { path: '/accounts/cash', label: 'Cash Account' },
        { path: '/accounts/bank', label: 'Bank Account' },
      ]
    },
    { 
      label: 'Settings', 
      icon: Settings, 
      roles: ['super_admin'],
      subItems: [
        { path: '/settings', label: 'General' },
        { path: '/settings/shop', label: 'Shop Info' },
        { path: '/settings/database', label: 'Database' },
      ]
    },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(role));

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoBrand}>
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" className={styles.logoImg} />
            ) : (
              <Activity color="#2563EB" size={24} />
            )}
            {settings.companyName.toUpperCase()}
          </div>
          <span className={styles.logoSub}>MANAGEMENT SYSTEM</span>
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
                    <span>{item.label}</span>
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
                          {sub.label}
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
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            );
          })}
          
          <div 
            className={styles.navItem} 
            style={{ marginTop: 'auto', color: '#EF4444', cursor: 'pointer' }}
            onClick={() => {
              localStorage.removeItem('isAuthenticated');
              window.location.reload();
            }}
          >
            <LogOut size={20} /> Logout
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.newOrderBtn} onClick={() => navigate('/pos')}>
            <Plus size={20} /> New Order
          </button>
          <a href="#" className={styles.helpLink}>
            <HelpCircle size={18} /> Help Center
          </a>
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
              <button className={styles.headerSettleBtn} onClick={() => navigate('/settlement')}>
                <DollarSign size={18} /> Settle Bill
              </button>
              <div className={styles.iconBtn}>
                <Bell size={20} />
                <span className={styles.badge}></span>
              </div>
              <div className={styles.iconBtn}>
                <HelpCircle size={20} />
              </div>
              <div className={styles.iconBtn}>
                Support
              </div>
            </div>

            <div className={styles.userProfile}>
              <div className={styles.userInfo}>
                <span className={styles.userName}>Alex Rivers</span>
                <span className={styles.userRole}>Facility Manager</span>
              </div>
              <img 
                src="https://ui-avatars.com/api/?name=Alex+Rivers&background=2563EB&color=fff" 
                alt="Alex Rivers" 
                className={styles.avatar}
              />
            </div>
          </div>
        </header>

        <div className={styles.content}>
          <Outlet />
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

    </div>
  );
}
