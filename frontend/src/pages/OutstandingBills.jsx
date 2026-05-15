import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, DollarSign, Clock, AlertCircle, 
  ChevronRight, ArrowRight, Printer, MessageCircle,
  CheckCircle, MoreHorizontal, Download, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './OutstandingBills.module.css';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

export default function OutstandingBills() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All'); // All, Overdue, Due Soon
  const [globalOutstanding, setGlobalOutstanding] = useState(0);

  useEffect(() => {
    fetchOutstandingBills();
  }, []);

  const fetchOutstandingBills = async () => {
    try {
      setLoading(true);
      if (window.electronAPI?.dbQuery) {
        const query = `
          SELECT o.*, c.name as customerName, c.phone as customerPhone, c.balance as customerBalance 
          FROM orders o 
          LEFT JOIN customers c ON o.customerId = c.id
          WHERE (o.dueAmount > 0 OR o.paymentStatus NOT IN ('Paid', 'Settled'))
          AND o.status != 'Cancelled'
          ORDER BY o.createdAt DESC
        `;
        const res = await window.electronAPI.dbQuery(query, []);
        if (res.success) {
          setBills(res.data);
          
          // Also fetch the global outstanding sum to match Settlement page
          const globalRes = await window.electronAPI.dbQuery('SELECT SUM(balance) as total FROM customers WHERE balance > 0', []);
          if (globalRes.success) {
            setGlobalOutstanding(globalRes.data[0]?.total || 0);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch outstanding bills:", err);
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (order) => {
    const overdueDays = settings?.overduePeriod || 7;
    const diffTime = Math.abs(new Date() - new Date(order.createdAt));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > overdueDays;
  };

  const filteredBills = bills.filter(bill => {
    const matchesSearch = 
      (bill.id || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bill.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bill.billNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'Overdue') return matchesSearch && isOverdue(bill);
    if (filterType === 'Due Soon') {
      const diffDays = Math.ceil(Math.abs(new Date() - new Date(bill.createdAt)) / (1000 * 60 * 60 * 24));
      return matchesSearch && diffDays <= 7 && !isOverdue(bill);
    }
    return matchesSearch;
  });

  const totalOutstanding = globalOutstanding || bills.reduce((sum, b) => sum + (b.dueAmount || b.totalAmount || 0), 0);
  const overdueCount = bills.filter(b => isOverdue(b)).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Outstanding Bills</h1>
          <p>Track and manage all unpaid invoices and customer credit.</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search by Bill ID, Customer..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className={styles.exportBtn}>
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#EEF2FF' }}><DollarSign color="#4F46E5" /></div>
          <div className={styles.statInfo}>
            <span>Total Outstanding</span>
            <h3><CurrencySymbol /> {totalOutstanding.toFixed(2)}</h3>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#FEF2F2' }}><AlertCircle color="#EF4444" /></div>
          <div className={styles.statInfo}>
            <span>Overdue Bills</span>
            <h3 style={{ color: '#EF4444' }}>{overdueCount} Invoices</h3>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#F0FDF4' }}><CheckCircle color="#10B981" /></div>
          <div className={styles.statInfo}>
            <span>Active Customers</span>
            <h3>{new Set(bills.map(b => b.customerId)).size}</h3>
          </div>
        </div>
      </div>

      <div className={styles.filterRow}>
        <button 
          className={`${styles.filterBtn} ${filterType === 'All' ? styles.active : ''}`}
          onClick={() => setFilterType('All')}
        >
          All Bills
        </button>
        <button 
          className={`${styles.filterBtn} ${filterType === 'Overdue' ? styles.active : ''}`}
          onClick={() => setFilterType('Overdue')}
        >
          Overdue
        </button>
        <button 
          className={`${styles.filterBtn} ${filterType === 'Due Soon' ? styles.active : ''}`}
          onClick={() => setFilterType('Due Soon')}
        >
          Due Soon
        </button>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Status</th>
              <th>Total Amount</th>
              <th>Due Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.map(bill => (
              <tr key={bill.id} className={isOverdue(bill) ? styles.overdueRow : ''}>
                <td className={styles.boldText}>{bill.id}</td>
                <td>
                  <div className={styles.custCell}>
                    <span className={styles.custName}>{bill.customerName || 'Walk-in'}</span>
                    <span className={styles.custPhone}>{bill.customerPhone}</span>
                  </div>
                </td>
                <td>{new Date(bill.createdAt).toLocaleDateString()}</td>
                <td>
                  <span className={`${styles.badge} ${isOverdue(bill) ? styles.badgeRed : styles.badgeYellow}`}>
                    {isOverdue(bill) ? 'Overdue' : 'Pending'}
                  </span>
                </td>
                <td className={styles.amount}><CurrencySymbol size={12} /> {(bill.totalAmount || 0).toFixed(2)}</td>
                <td className={styles.dueAmount}><CurrencySymbol size={12} /> {(bill.dueAmount || bill.totalAmount || 0).toFixed(2)}</td>
                <td>
                  <div className={styles.actionGroup}>
                    <button 
                      className={styles.settleBtn}
                      onClick={() => navigate(`/settlement?customerId=${bill.customerId}`)}
                    >
                      Settle
                    </button>
                    <button className={styles.iconBtn} onClick={() => navigate(`/invoice/${bill.id}`)}>
                      <Eye size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredBills.length === 0 && (
              <tr>
                <td colSpan="7" className={styles.noData}>
                  {loading ? 'Loading...' : 'No outstanding bills found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
