import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { motion } from 'framer-motion';
import { 
  Download, Calendar, TrendingUp, TrendingDown, Users, 
  Clock, DollarSign, Package, Star, Zap, Droplets, Truck, AlertCircle
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Reports.module.css';

// Styles and variants remain same

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export default function Reports() {
  const { settings } = useSettings();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    orderCount: 0,
    customerCount: 0,
    avgTurnaround: '12.5h',
    newSignups: 0
  });

  const [revenueData, setRevenueData] = useState([]);
  const [serviceData, setServiceData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (window.electronAPI?.dbQuery) {
        try {
          // 1. Basic KPIs
          const revRes = await window.electronAPI.dbQuery('SELECT SUM(totalAmount) as total FROM orders', []);
          const ordRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM orders', []);
          const custRes = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM customers', []);
          const signupRes = await window.electronAPI.dbQuery("SELECT COUNT(*) as count FROM customers WHERE updatedAt > date('now', '-30 days')", []);
          
          setStats({
            totalRevenue: revRes.data[0]?.total || 0,
            orderCount: ordRes.data[0]?.count || 0,
            customerCount: custRes.data[0]?.count || 0,
            avgTurnaround: '12.5h',
            newSignups: signupRes.data[0]?.count || 0
          });

          // 2. Revenue Chart Data (Last 7 days)
          const trendRes = await window.electronAPI.dbQuery(`
            SELECT strftime('%m/%d', createdAt) as name, SUM(totalAmount) as revenue 
            FROM orders 
            WHERE createdAt > date('now', '-30 days')
            GROUP BY name 
            ORDER BY createdAt ASC 
            LIMIT 7
          `, []);
          setRevenueData(trendRes.data.map(d => ({ ...d, projections: d.revenue * 0.85 })));

          // 3. Service Distribution (Pie Chart)
          const allOrders = await window.electronAPI.dbQuery('SELECT items FROM orders', []);
          const categoryCounts = {};
          const COLORS = ['#3B82F6', '#94A3B8', '#FDBA74', '#10B981', '#8B5CF6'];

          allOrders.data.forEach(order => {
            const items = JSON.parse(order.items || '[]');
            items.forEach(item => {
              const cat = item.category || 'Standard';
              categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });
          });

          const totalItems = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
          const formattedServiceData = Object.entries(categoryCounts).map(([name, count], idx) => ({
            name,
            value: Math.round((count / totalItems) * 100),
            color: COLORS[idx % COLORS.length]
          }));

          setServiceData(formattedServiceData.length > 0 ? formattedServiceData : [
            { name: 'No Data', value: 100, color: '#F1F5F9' }
          ]);

        } catch (err) {
          console.error("Stats fetch error:", err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, []);

  const handleExport = () => window.print();

  return (
    <motion.div 
      className={styles.reportsPage}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Area */}
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <h1>Business Analytics</h1>
          <p>Real-time performance metrics and operational insights for Antigravity Laundry.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.datePicker}>
            <Calendar size={18} />
            <span>Last 30 Days</span>
          </div>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={18} /> Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <KPICard 
          title="Total Revenue" 
          value={<><CurrencySymbol size={22} /> {stats.totalRevenue.toLocaleString()}</>} 
          trend="+12.5%" 
          subtext="Total earnings to date"
          icon={<DollarSign size={20} color="#3B82F6" />}
          iconBg="#EFF6FF"
          positive={true}
        />
        <KPICard 
          title="Order Volume" 
          value={stats.orderCount.toLocaleString()} 
          trend="+8.2%" 
          subtext="Total orders processed"
          icon={<Package size={20} color="#8B5CF6" />}
          iconBg="#F5F3FF"
          positive={true}
        />
        <KPICard 
          title="Customer Base" 
          value={stats.customerCount.toLocaleString()} 
          trend="+15.4%" 
          subtext="Active customer accounts"
          icon={<Users size={20} color="#10B981" />}
          iconBg="#ECFDF5"
          positive={true}
        />
        <KPICard 
          title="Avg. Turnaround" 
          value={stats.avgTurnaround} 
          trend="-4.1%" 
          subtext="Average time per order"
          icon={<Clock size={20} color="#F59E0B" />}
          iconBg="#FFFBEB"
          positive={false}
        />
      </div>

      <div className={styles.mainGrid}>
        {/* Revenue Chart */}
        <motion.div className={styles.chartCard} variants={itemVariants}>
          <div className={styles.cardHeader}>
            <div>
              <h3>Revenue Performance</h3>
              <p>Daily revenue trends and projections.</p>
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}><span style={{ background: '#3B82F6' }}></span> Actual</div>
              <div className={styles.legendItem}><span style={{ background: '#94A3B8', borderStyle: 'dashed' }}></span> Projection</div>
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={revenueData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Service Distribution */}
        <motion.div className={styles.chartCard} variants={itemVariants}>
          <div className={styles.cardHeader}>
            <h3>Service Distribution</h3>
            <p>Popularity by laundry category.</p>
          </div>
          <div style={{ width: '100%', height: 300, position: 'relative' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={serviceData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.pieCenter}>
              <span className={styles.centerValue}>{serviceData.reduce((a, b) => a + b.value, 0)}%</span>
              <span className={styles.centerLabel}>Total</span>
            </div>
          </div>
          <div className={styles.pieLegend}>
            {serviceData.map((item, idx) => (
              <div key={idx} className={styles.pieLegendItem}>
                <span className={styles.dot} style={{ background: item.color }}></span>
                <span className={styles.label}>{item.name}</span>
                <span className={styles.value}>{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Detailed Insights */}
      <div className={styles.insightGrid}>
        <motion.div className={styles.insightCard} variants={itemVariants}>
          <div className={styles.insightIcon} style={{ background: '#DBEAFE' }}><Zap size={20} color="#3B82F6" /></div>
          <div className={styles.insightContent}>
            <h4>Top Performing Category</h4>
            <p><strong>Wash & Fold</strong> revenue increased by 22% this month. Consider adding more capacity or running a promotion on this service.</p>
          </div>
        </motion.div>
        
        <motion.div className={styles.insightCard} variants={itemVariants}>
          <div className={styles.insightIcon} style={{ background: '#ECFDF5' }}><Droplets size={20} color="#10B981" /></div>
          <div className={styles.insightContent}>
            <h4>Operational Efficiency</h4>
            <p>Machine utilization is at an all-time high (89%). Scheduled maintenance for Unit 4 is due in 3 days to prevent downtime.</p>
          </div>
        </motion.div>

        <motion.div className={styles.insightCard} variants={itemVariants}>
          <div className={styles.insightIcon} style={{ background: '#FFFBEB' }}><Star size={20} color="#F59E0B" /></div>
          <div className={styles.insightContent}>
            <h4>Customer Loyalty</h4>
            <p>New customer retention rate is 64%. The "First-Wash" discount campaign successfully converted 45 new users this week.</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function KPICard({ title, value, trend, subtext, icon, iconBg, positive }) {
  return (
    <motion.div className={styles.kpiCard} variants={itemVariants}>
      <div className={styles.kpiHeader}>
        <div className={styles.iconBox} style={{ background: iconBg }}>{icon}</div>
        <div className={`${styles.trend} ${positive ? styles.positive : styles.negative}`}>
          {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend}
        </div>
      </div>
      <div className={styles.kpiInfo}>
        <h3 className={styles.kpiValue}>{value}</h3>
        <span className={styles.kpiTitle}>{title}</span>
        <p className={styles.kpiSubtext}>{subtext}</p>
      </div>
    </motion.div>
  );
}
