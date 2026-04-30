import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { motion } from 'framer-motion';
import { 
  Download, Calendar, TrendingUp, TrendingDown, Users, 
  Clock, DollarSign, Package, Star, Zap, Droplets, Truck, AlertCircle
} from 'lucide-react';
import styles from './Reports.module.css';

const REVENUE_DATA = [
  { name: 'OCT 01', revenue: 2600, projections: 2200 },
  { name: 'OCT 07', revenue: 3200, projections: 2800 },
  { name: 'OCT 14', revenue: 4500, projections: 3800 },
  { name: 'OCT 21', revenue: 3800, projections: 3200 },
  { name: 'OCT 28', revenue: 4200, projections: 3600 },
  { name: 'CURRENT', revenue: 3500, projections: 3000 },
];

const SERVICE_DATA = [
  { name: 'Standard Laundry', value: 58, color: '#3B82F6' },
  { name: 'Dry Cleaning', value: 24, color: '#94A3B8' },
  { name: 'Ironing Only', value: 12, color: '#FDBA74' },
  { name: 'Other / Bulk', value: 6, color: '#F1F5F9' },
];

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
  visible: {
    y: 0,
    opacity: 1
  }
};

export default function Reports() {
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
          <button className="btn btn-primary">
            <Download size={18} /> Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <KPICard 
          title="Total Revenue" 
          value="$48,294.00" 
          trend="+12.5%" 
          subtext="vs. $42,920 last month"
          icon={<DollarSign size={20} color="#3B82F6" />}
          iconBg="#EFF6FF"
          positive={true}
        />
        <KPICard 
          title="Order Volume" 
          value="1,284" 
          trend="+8.2%" 
          subtext="vs. 1,186 last month"
          icon={<Package size={20} color="#8B5CF6" />}
          iconBg="#F5F3FF"
          positive={true}
        />
        <KPICard 
          title="Customer Growth" 
          value="342" 
          trend="+15.4%" 
          subtext="New registrations this month"
          icon={<Users size={20} color="#10B981" />}
          iconBg="#ECFDF5"
          positive={true}
        />
        <KPICard 
          title="Avg. Processing Time" 
          value="14.2h" 
          trend="-2.1%" 
          subtext="Average order turnaround"
          icon={<Clock size={20} color="#F59E0B" />}
          iconBg="#FFFBEB"
          positive={false}
        />
      </div>

      {/* Main Charts */}
      <div className={styles.chartsGrid}>
        <motion.div className={styles.chartCard} variants={itemVariants}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>
              <h3>Revenue Performance</h3>
              <p>Historical trend of daily earnings</p>
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <span className={styles.dot} style={{ background: '#3B82F6' }}></span>
                Revenue
              </div>
              <div className={styles.legendItem}>
                <span className={styles.dot} style={{ background: '#E2E8F0' }}></span>
                Projections
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={REVENUE_DATA} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#F8FAFF' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="projections" fill="#E2E8F0" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div className={styles.chartCard} variants={itemVariants}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>
              <h3>Volume by Service</h3>
              <p>Service type popularity</p>
            </div>
          </div>
          <div className={styles.donutContainer}>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={SERVICE_DATA}
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {SERVICE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.donutCenter}>
              <span className={styles.donutValue}>1,284</span>
              <span className={styles.donutLabel}>Total Orders</span>
            </div>
          </div>
          <div className={styles.donutLegend}>
            {SERVICE_DATA.map((item, idx) => (
              <div key={idx} className={styles.donutLegendItem}>
                <div className={styles.donutLegendLabel}>
                  <span className={styles.dot} style={{ background: item.color }}></span>
                  {item.name}
                </div>
                <span className={styles.donutLegendValue}>{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Insights */}
      <div className={styles.bottomGrid}>
        <motion.div className={styles.velocityCard} variants={itemVariants}>
          <div className={styles.velocityHeader}>
            <h3>Growth Velocity</h3>
            <a href="#" className={styles.viewCrm}>View CRM</a>
          </div>
          
          <div className={styles.signupCard}>
            <div className={styles.signupInfo}>
              <span className={styles.signupLabel}>New Member Signups</span>
              <span className={styles.signupValue}>342</span>
            </div>
            <div className={styles.progressBar}>
              <motion.div 
                className={styles.progressFill} 
                initial={{ width: 0 }}
                animate={{ width: '85%' }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
            <span className={styles.signupSubtext}>85% of monthly target achieved</span>
          </div>

          <div className={styles.velocityItems}>
            <div className={styles.velocityItem}>
              <div className={styles.itemIcon} style={{ background: '#ECFDF5' }}>
                <TrendingUp size={18} color="#10B981" />
              </div>
              <div className={styles.itemContent}>
                <h4>Retention Increase</h4>
                <p>Return customer rate up by 4.2% compared to the previous quarter.</p>
              </div>
            </div>
            <div className={styles.velocityItem}>
              <div className={styles.itemIcon} style={{ background: '#FFF7ED' }}>
                <Star size={18} color="#F97316" />
              </div>
              <div className={styles.itemContent}>
                <h4>CSAT Score: 4.8/5.0</h4>
                <p>Based on 1,200+ customer reviews after order completion.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div className={styles.chartCard} variants={itemVariants}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>
              <h3>Operational Efficiency</h3>
            </div>
          </div>
          <table className={styles.efficiencyTable}>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Current</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow name="Washing Throughput" current="84kg/hr" target="90kg/hr" status="IMPROVING" />
              <MetricRow name="Chemical Usage" current="0.4L/load" target="0.5L/load" status="OPTIMAL" />
              <MetricRow name="Express Delivery" current="98.2%" target="95.0%" status="EXCEEDING" />
              <MetricRow name="Machine Downtime" current="2.1%" target="1.5%" status="ALERT" />
            </tbody>
          </table>
        </motion.div>
      </div>
    </motion.div>
  );
}

function KPICard({ title, value, trend, subtext, icon, iconBg, positive }) {
  return (
    <motion.div className={styles.kpiCard} variants={itemVariants}>
      <div className={styles.kpiHeader}>
        <div className={styles.kpiIcon} style={{ background: iconBg }}>
          {icon}
        </div>
        <span className={`${styles.trendBadge} ${positive ? styles.trendPositive : styles.trendNegative}`}>
          {trend}
        </span>
      </div>
      <div>
        <span className={styles.kpiLabel}>{title}</span>
        <div className={styles.kpiValue}>{value}</div>
      </div>
      <span className={styles.kpiSubtext}>{subtext}</span>
    </motion.div>
  );
}

function MetricRow({ name, current, target, status }) {
  const getStatusClass = (s) => {
    switch(s) {
      case 'IMPROVING': return styles.statusImproving;
      case 'OPTIMAL': return styles.statusOptimal;
      case 'EXCEEDING': return styles.statusExceeding;
      case 'ALERT': return styles.statusAlert;
      default: return '';
    }
  };

  return (
    <tr>
      <td className={styles.metricName}>{name}</td>
      <td>{current}</td>
      <td>{target}</td>
      <td>
        <span className={`${styles.statusBadge} ${getStatusClass(status)}`}>
          {status}
        </span>
      </td>
    </tr>
  );
}
