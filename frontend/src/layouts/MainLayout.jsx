import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Users, ClipboardList, Settings, 
  BarChart3, Zap, Plus, Search, Bell, HelpCircle, LifeBuoy, Wifi, WifiOff, RefreshCw, Activity, LogOut
} from 'lucide-react';
import { syncData } from '../services/syncService';
import styles from './MainLayout.module.css';

export default function MainLayout() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

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
    setIsSyncing(false);
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/orders', label: 'Orders', icon: ClipboardList },
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/reports', label: 'Reports', icon: BarChart3 },
    { path: '/expenses', label: 'Expenses', icon: Zap },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoBrand}>
            <Activity color="#2563EB" size={24} />
            ANTIGRAVITY
          </div>
          <span className={styles.logoSub}>MANAGEMENT SYSTEM</span>
        </div>
        
        <nav className={styles.nav}>
          {navItems.map((item) => (
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
          ))}
          
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
            <input type="text" placeholder="Search analytics and exports..." />
          </div>
          
          <div className={styles.headerRight}>
            <div className={styles.headerIcons}>
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
