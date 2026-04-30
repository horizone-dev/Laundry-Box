import React from 'react';
import { 
  Search, UserPlus, Download, Calendar, MoreHorizontal, 
  TrendingUp, Star, Clock, ChevronLeft, ChevronRight
} from 'lucide-react';
import styles from './Customers.module.css';

const MOCK_CUSTOMERS = [
  { name: 'Julianne Moore', email: 'j.moore@example.com', phone: '(555) 012-3456', orders: '24 Orders', lastDate: 'Oct 12, 2023', tag: 'Premium Member', avatar: 'https://ui-avatars.com/api/?name=Julianne+Moore&background=F1F5F9&color=64748B' },
  { name: 'Thomas Hegarty', email: 't.hegarty@cloud.com', phone: '(555) 012-9876', orders: '12 Orders', lastDate: 'Oct 10, 2023', tag: 'Standard', avatar: 'https://ui-avatars.com/api/?name=Thomas+Hegarty&background=F1F5F9&color=64748B' },
  { name: 'Sarah Chen', email: 'sarah.c@techcorp.io', phone: '(555) 014-2233', orders: '48 Orders', lastDate: 'Oct 09, 2023', tag: 'Corporate', avatar: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=F1F5F9&color=64748B' },
  { name: 'Marcus Brown', email: 'mbrown@mail.com', phone: '(555) 018-4455', orders: '2 Orders', lastDate: 'Oct 05, 2023', tag: 'New', avatar: 'https://ui-avatars.com/api/?name=Marcus+Brown&background=F1F5F9&color=64748B' },
  { name: 'Linda White', email: 'linda.white@domain.com', phone: '(555) 011-3322', orders: '8 Orders', lastDate: 'Sep 28, 2023', tag: 'Standard', avatar: 'https://ui-avatars.com/api/?name=Linda+White&background=F1F5F9&color=64748B' },
];

export default function Customers() {
  return (
    <div className={styles.customersPage}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <h1>Customers</h1>
          <p>Manage and view your customer database and order history.</p>
        </div>
        <button className="btn btn-primary">
          <UserPlus size={18} /> Add Customer
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filtersCard}>
        <div className={styles.searchBox}>
          <Search size={18} color="#94A3B8" />
          <input type="text" placeholder="Filter by name, email or phone..." />
        </div>
        <div className={styles.filterActions}>
          <button className={styles.secondaryBtn}><Download size={18} /> Export</button>
          <button className={styles.secondaryBtn}><Calendar size={18} /> This Month</button>
        </div>
      </div>

      {/* Table Section */}
      <div className={styles.tableCard}>
        <table className={styles.customersTable}>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Email</th>
              <th>Phone Number</th>
              <th>Total Orders</th>
              <th>Last Order Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CUSTOMERS.map((customer, idx) => (
              <tr key={idx}>
                <td>
                  <div className={styles.customerInfo}>
                    <img src={customer.avatar} alt={customer.name} className={styles.avatar} />
                    <div className={styles.customerDetails}>
                      <span className={styles.customerName}>{customer.name}</span>
                      <span className={styles.customerTag}>{customer.tag}</span>
                    </div>
                  </div>
                </td>
                <td>{customer.email}</td>
                <td>{customer.phone}</td>
                <td><span className={styles.ordersBadge}>{customer.orders}</span></td>
                <td>{customer.lastDate}</td>
                <td><MoreHorizontal size={18} className={styles.actionsBtn} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>Showing 1 to 5 of 1,248 customers</span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn}><ChevronLeft size={16} /></button>
            <button className={`${styles.pageBtn} ${styles.active}`}>1</button>
            <button className={styles.pageBtn}>2</button>
            <button className={styles.pageBtn}>3</button>
            <button className={styles.pageBtn}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Bottom KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
          <div className={styles.kpiIcon}><TrendingUp size={20} /></div>
          <div className={styles.kpiValueWrapper}>
            <span className={styles.kpiValue}>1,248</span>
            <span className={styles.kpiTrend} style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>+12%</span>
          </div>
          <span className={styles.kpiLabel}>Total Active Customers</span>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><Star size={20} color="#2563EB" /></div>
          <div className={styles.kpiValueWrapper}>
            <span className={styles.kpiValue}>156</span>
          </div>
          <span className={styles.kpiLabel}>Premium Subscriptions</span>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><Clock size={20} color="#2563EB" /></div>
          <div className={styles.kpiValueWrapper}>
            <span className={styles.kpiValue}>4.8d</span>
          </div>
          <span className={styles.kpiLabel}>Avg. Order Frequency</span>
        </div>
      </div>
    </div>
  );
}
