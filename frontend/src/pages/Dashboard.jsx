import React, { useState, useEffect } from 'react';
import { 
  DollarSign, ShoppingBag, Users, Clock, TrendingUp, 
  TrendingDown, Calendar, Package, MoreHorizontal 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [dateRange, setDateRange] = useState('Today');
  const [stats, setStats] = useState({
    revenue: 0,
    orders: 0,
    processing: 0,
    customers: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [revenueData, setRevenueData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        // 1. Basic KPIs & Trends (Current vs Previous 30 days)
        const revRes = await window.electronAPI.dbQuery('SELECT SUM(totalAmount) as total FROM orders', []);
        const prevRevRes = await window.electronAPI.dbQuery("SELECT SUM(totalAmount) as total FROM orders WHERE createdAt <= date('now', '-30 days') AND createdAt > date('now', '-60 days')", []);
        
        const ordRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM orders', []);
        const prevOrdRes = await window.electronAPI.dbQuery("SELECT COUNT(*) as count FROM orders WHERE createdAt <= date('now', '-30 days') AND createdAt > date('now', '-60 days')", []);
        
        const procRes = await window.electronAPI.dbQuery("SELECT COUNT(*) as count FROM orders WHERE status = 'Processing' OR status = 'Confirmed'", []);
        const custRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM customers', []);
        const prevCustRes = await window.electronAPI.dbQuery("SELECT COUNT(*) as count FROM customers WHERE updatedAt <= date('now', '-30 days')", []);

        // Calculate Trends
        const calculateTrend = (curr, prev) => {
          if (!prev || prev === 0) return { val: '+100%', isUp: true };
          const change = ((curr - prev) / prev) * 100;
          return {
            val: (change >= 0 ? '+' : '') + change.toFixed(1) + '%',
            isUp: change >= 0
          };
        };

        const revTrend = calculateTrend(revRes.data?.[0]?.total || 0, prevRevRes.data?.[0]?.total || 0);
        const ordTrend = calculateTrend(ordRes.data?.[0]?.count || 0, prevOrdRes.data?.[0]?.count || 0);
        const custTrend = calculateTrend(custRes.data?.[0]?.count || 0, prevCustRes.data?.[0]?.count || 0);

        setStats({
          revenue: revRes?.data?.[0]?.total || 0,
          orders: ordRes?.data?.[0]?.count || 0,
          processing: procRes?.data?.[0]?.count || 0,
          customers: custRes?.data?.[0]?.count || 0,
          revTrend,
          ordTrend,
          custTrend
        });

        const recentRes = await window.electronAPI.dbQuery('SELECT * FROM orders ORDER BY createdAt DESC LIMIT 5', []);
        if (recentRes.success) {
          setRecentOrders(recentRes.data.map(o => ({
            id: o.id || o.orderId || 'N/A',
            customer: o.customerName || 'Walk-in',
            amount: (o.totalAmount || 0).toFixed(2),
            status: o.status,
            statusClass: styles[`status${(o.status || '').replace(/\s+/g, '')}`] || styles.statusProcessing
          })));
        }

        // 7-day Revenue Chart
        const chartRes = await window.electronAPI.dbQuery(`
          SELECT strftime('%m/%d', createdAt) as date, SUM(totalAmount) as revenue 
          FROM orders 
          WHERE createdAt > date('now', '-7 days')
          GROUP BY date 
          ORDER BY createdAt ASC
        `, []);

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          last7Days.push(d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }));
        }

        const formattedChart = last7Days.map(date => {
          const match = chartRes.data?.find(d => d.date === date);
          return { name: date, revenue: match ? match.revenue : 0 };
        });

        setRevenueData(formattedChart);

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    }
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <h1>Dashboard Overview</h1>
          <p>Welcome back! Here's what's happening with your store today.</p>
        </div>
        <div className={styles.dateFilter}>
          {['Today', 'Week', 'Month'].map(range => (
            <button 
              key={range} 
              className={`${styles.dateBtn} ${dateRange === range ? styles.active : ''}`}
              onClick={() => setDateRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard title="Total Revenue" value={<><CurrencySymbol size={22} /> {(stats.revenue || 0).toLocaleString()}</>} trend={stats.revTrend?.val || '0%'} isUp={stats.revTrend?.isUp} icon={<DollarSign size={24} />} color="primary" />
        <StatCard title="Total Orders" value={(stats.orders || 0).toLocaleString()} trend={stats.ordTrend?.val || '0%'} isUp={stats.ordTrend?.isUp} icon={<ShoppingBag size={24} />} color="success" />
        <StatCard title="Processing" value={(stats.processing || 0).toLocaleString()} trend="Live" isUp={true} icon={<Clock size={24} />} color="warning" />
        <StatCard title="Total Customers" value={(stats.customers || 0).toLocaleString()} trend={stats.custTrend?.val || '0%'} isUp={stats.custTrend?.isUp} icon={<Users size={24} />} color="danger" />
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span>Revenue Analytics</span>
            <Calendar size={18} color="#94A3B8" />
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={revenueData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span>Recent Orders</span>
            <MoreHorizontal size={18} color="#94A3B8" />
          </div>
          <div className={styles.recentOrders}>
            {recentOrders.length > 0 ? recentOrders.map((order, idx) => (
              <div key={idx} className={styles.orderItem} onClick={() => navigate(`/invoice/${order.id.replace('#', '')}`)} style={{ cursor: 'pointer' }}>
                <div>
                  <span className={styles.orderId}>{order.id}</span>
                  <span className={styles.orderCust}>{order.customer}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                    <CurrencySymbol size={14} /> {order.amount}
                  </div>
                  <span className={`${styles.orderStatus} ${order.statusClass}`}>{order.status}</span>
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>No recent orders found.</div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.insightsGrid}>
        <div className={styles.capacityCard}>
          <h3 className={styles.capacityTitle}>Storage Capacity</h3>
          <div className={styles.capacityItem}>
            <div className={styles.capacityHeader}><span>Shelving Unit A</span><span>85%</span></div>
            <div className={styles.capacityBar}><div className={styles.capacityFill} style={{ width: '85%', background: '#2563EB' }}></div></div>
          </div>
          <div className={styles.capacityItem}>
            <div className={styles.capacityHeader}><span>Ready-to-Go</span><span>42%</span></div>
            <div className={styles.capacityBar}><div className={styles.capacityFill} style={{ width: '42%', background: '#10B981' }}></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, isUp, icon, color }) {
  return (
    <div className={styles.statCard}>
      <div className={`${styles.iconWrapper} ${styles[color]}`}>{icon}</div>
      <div className={styles.statInfo}>
        <span className={styles.statTitle}>{title}</span>
        <span className={styles.statValue}>{value}</span>
        <span className={`${styles.statTrend} ${isUp ? styles.up : styles.down}`}>
          {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend} <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: '0.75rem' }}>from last month</span>
        </span>
      </div>
    </div>
  );
}
