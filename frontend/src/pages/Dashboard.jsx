import React, { useState } from 'react';
import { 
  DollarSign, ShoppingBag, Users, Clock, TrendingUp, 
  TrendingDown, Calendar, Package, MoreHorizontal 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import styles from './Dashboard.module.css';

const REVENUE_DATA = [
  { name: 'Mon', revenue: 2400 },
  { name: 'Tue', revenue: 1398 },
  { name: 'Wed', revenue: 9800 },
  { name: 'Thu', revenue: 3908 },
  { name: 'Fri', revenue: 4800 },
  { name: 'Sat', revenue: 3800 },
  { name: 'Sun', revenue: 4300 },
];

const RECENT_ORDERS = [
  { id: '#1042', customer: 'Sarah Mitchell', amount: '$42.50', status: 'Processing', statusClass: styles.statusProcessing },
  { id: '#1041', customer: 'James Doberman', amount: '$18.00', status: 'Delivered', statusClass: styles.statusDelivered },
  { id: '#1040', customer: 'Elena Loft', amount: '$124.90', status: 'Ready', statusClass: styles.statusReady },
  { id: '#1039', customer: 'Brian Kemp', amount: '$35.00', status: 'Delivered', statusClass: styles.statusDelivered },
];

export default function Dashboard() {
  const [dateRange, setDateRange] = useState('Today');

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
        <StatCard title="Total Revenue" value="$4,520.00" trend="+12.5%" isUp={true} icon={<DollarSign size={24} />} color="primary" />
        <StatCard title="Total Orders" value="142" trend="+5.2%" isUp={true} icon={<ShoppingBag size={24} />} color="success" />
        <StatCard title="Processing" value="38" trend="-2.1%" isUp={false} icon={<Clock size={24} />} color="warning" />
        <StatCard title="Total Customers" value="1,248" trend="+8.4%" isUp={true} icon={<Users size={24} />} color="danger" />
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span>Revenue Analytics</span>
            <Calendar size={18} color="#94A3B8" />
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={REVENUE_DATA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
            {RECENT_ORDERS.map((order, idx) => (
              <div key={idx} className={styles.orderItem}>
                <div>
                  <span className={styles.orderId}>{order.id}</span>
                  <span className={styles.orderCust}>{order.customer}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{order.amount}</div>
                  <span className={`${styles.orderStatus} ${order.statusClass}`}>{order.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.insightsGrid}>
        <div className={styles.insightCard}>
          <div className={styles.insightTag}>Operational Insight</div>
          <p className={styles.insightText}>
            Average processing time has decreased by 14 minutes per load this week. Keep up the great pace and ensure all machines are utilized optimally!
          </p>
          <div style={{ height: '30px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
        </div>

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
