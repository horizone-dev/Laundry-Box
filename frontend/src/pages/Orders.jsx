import React from 'react';
import { 
  Search, Filter, ChevronLeft, ChevronRight, MoreHorizontal, 
  Clock, Package, CheckCircle, AlertCircle, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Orders.module.css';

const MOCK_ORDERS = [
  { id: '#1042', customer: 'Sarah Mitchell', email: 's.mitchell@email.com', service: 'Wash & Fold', date: 'Oct 24, 2023', amount: '$42.50', payment: 'Processing', status: 'Processing' },
  { id: '#1041', customer: 'James Doberman', email: 'j.doberman@work.com', service: 'Dry Clean', date: 'Oct 24, 2023', amount: '$18.00', payment: 'Completed', status: 'Completed' },
  { id: '#1040', customer: 'Elena Loft', email: 'elena@loftstudio.io', service: 'Premium Wash', date: 'Oct 23, 2023', amount: '$124.90', payment: 'Ready', status: 'Ready' },
  { id: '#1039', customer: 'Brian Kemp', email: 'b.kemp@gmail.com', service: 'Wash & Fold', date: 'Oct 23, 2023', amount: '$35.00', payment: 'Cancelled', status: 'Cancelled' },
  { id: '#1038', customer: 'Linda White', email: 'linda.w@outlook.com', service: 'Bedding', date: 'Oct 22, 2023', amount: '$89.15', payment: 'Completed', status: 'Completed' },
];

export default function Orders() {
  const navigate = useNavigate();

  return (
    <div className={styles.ordersPage}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <h1>Orders</h1>
          <p>Manage and track your customer laundry requests</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.filterBtn}>
            <Filter size={18} />
            Filter
            <ChevronDown size={14} />
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            Create New Order
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <KPIItem label="Active Orders" value="142" trend="+12%" trendClass={styles.trendPos} icon={<Package size={18} color="#2563EB" />} iconBg="#EFF6FF" />
        <KPIItem label="Processing" value="38" trend="5 Urgent" trendClass={styles.trendUrgent} icon={<Clock size={18} color="#F97316" />} iconBg="#FFF7ED" />
        <KPIItem label="Completed Today" value="64" trend="98% Goal" trendClass={styles.trendGoal} icon={<CheckCircle size={18} color="#10B981" />} iconBg="#ECFDF5" />
        <KPIItem label="Ready for Pickup" value="12" trend="Avg 2.4h" trendClass={styles.trendAvg} icon={<AlertCircle size={18} color="#94A3B8" />} iconBg="#F8FAFC" />
      </div>

      {/* Table Section */}
      <div className={styles.tableCard}>
        <table className={styles.ordersTable}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Service Type</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ORDERS.map((order, idx) => (
              <tr key={idx}>
                <td className={styles.orderId}>{order.id}</td>
                <td>
                  <div className={styles.customerInfo}>
                    <div className={styles.avatar}>{order.customer.split(' ').map(n => n[0]).join('')}</div>
                    <div className={styles.customerDetails}>
                      <span className={styles.customerName}>{order.customer}</span>
                      <span className={styles.customerEmail}>{order.email}</span>
                    </div>
                  </div>
                </td>
                <td>{order.service}</td>
                <td>{order.date}</td>
                <td className={styles.amount}>{order.amount}</td>
                <td><PaymentBadge status={order.payment} /></td>
                <td><StatusBadge status={order.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>Showing 1 to 5 of 142 orders</span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn}><ChevronLeft size={16} /></button>
            <button className={`${styles.pageBtn} ${styles.active}`}>1</button>
            <button className={styles.pageBtn}>2</button>
            <button className={styles.pageBtn}>3</button>
            <span style={{ color: '#94A3B8' }}>...</span>
            <button className={styles.pageBtn}>28</button>
            <button className={styles.pageBtn}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className={styles.bottomRow}>
        <div className={styles.insightCard}>
          <div>
            <div className={styles.insightTag}>Operational Insight</div>
            <p className={styles.insightText}>
              Average processing time has decreased by 14 minutes per load this week. Keep up the great pace!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {/* Visual placeholder for the wave/graph in mockup */}
            <div style={{ height: '40px', width: '100%', background: 'linear-gradient(90deg, #1E293B, #334155)', borderRadius: '8px' }}></div>
          </div>
        </div>

        <div className={styles.capacityCard}>
          <h3 className={styles.capacityTitle}>Storage Capacity</h3>
          <CapacityItem label="Shelving Unit A" value={85} color="#2563EB" />
          <CapacityItem label="Ready-to-Go" value={42} color="#10B981" />
        </div>
      </div>
    </div>
  );
}

function KPIItem({ label, value, trend, trendClass, icon, iconBg }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiHeader}>
        <div className={styles.kpiIcon} style={{ background: iconBg }}>{icon}</div>
        <span className={`${styles.trend} ${trendClass}`}>{trend}</span>
      </div>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  let cls = '';
  switch(status) {
    case 'Processing': cls = styles.statusProcessing; break;
    case 'Completed': cls = styles.statusCompleted; break;
    case 'Ready': cls = styles.statusReady; break;
    case 'Cancelled': cls = styles.statusCancelled; break;
  }
  return (
    <div className={`${styles.badge} ${cls}`}>
      <span className={styles.badgeDot}></span>
      {status}
    </div>
  );
}

function PaymentBadge({ status }) {
  let cls = '';
  switch(status) {
    case 'Processing': cls = styles.statusOutlineProcessing; break;
    case 'Completed': cls = styles.statusOutlineCompleted; break;
    case 'Ready': cls = styles.statusOutlineReady; break;
    case 'Cancelled': cls = styles.statusOutlineCancelled; break;
  }
  return (
    <div className={`${styles.statusBadgeOutline} ${cls}`}>
      {status === 'Processing' && <Clock size={14} />}
      {status === 'Completed' && <CheckCircle size={14} />}
      {status === 'Ready' && <Package size={14} />}
      {status === 'Cancelled' && <AlertCircle size={14} />}
      {status}
    </div>
  );
}

function CapacityItem({ label, value, color }) {
  return (
    <div className={styles.capacityItem}>
      <div className={styles.capacityHeader}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className={styles.capacityBar}>
        <div className={styles.capacityFill} style={{ width: `${value}%`, background: color }}></div>
      </div>
    </div>
  );
}
