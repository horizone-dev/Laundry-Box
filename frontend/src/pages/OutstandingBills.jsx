import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, DollarSign, Clock, AlertCircle, 
  ChevronRight, ArrowRight, Printer, MessageCircle,
  CheckCircle, MoreHorizontal, Download, Eye, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../store/SettingsContext';
import { t } from '../utils/translations';
import CurrencySymbol from '../components/CurrencySymbol';
import { getLocalDateBounds, isWithinBounds } from '../utils/dateFilters';
import styles from './OutstandingBills.module.css';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

export default function OutstandingBills() {
  const navigate = useNavigate();
  const { settings, formatDate } = useSettings();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All'); // All, Overdue, Due Soon
  const [globalOutstanding, setGlobalOutstanding] = useState(0);
  const [dateRange, setDateRange] = useState('Today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

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
          WHERE o.id IS NOT NULL AND o.id != '' AND o.dueAmount > 0 AND o.status != 'Cancelled'
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
    const overdueDays = settings?.overdueDays || 7;
    const diffTime = Math.abs(new Date() - new Date(order.createdAt));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > overdueDays;
  };

  const filteredBills = React.useMemo(() => {
    const bounds = getLocalDateBounds(dateRange, customStart, customEnd);
    if (bounds === false) return [];
    return bills.filter(bill => {
      const matchesSearch =
        (bill.id || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bill.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bill.billNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (filterType === 'Overdue' && !isOverdue(bill)) return false;
      if (filterType === 'Due Soon') {
        const diffDays = Math.ceil(Math.abs(new Date() - new Date(bill.createdAt)) / (1000 * 60 * 60 * 24));
        if (!(diffDays <= 7 && !isOverdue(bill))) return false;
      }
      if (bounds !== null) return isWithinBounds(bill.createdAt, bounds);
      return true;
    });
  }, [bills, searchTerm, filterType, dateRange, customStart, customEnd]);

  const totalOutstanding = filteredBills.reduce((sum, b) => sum + (b.dueAmount || b.totalAmount || 0), 0);
  const overdueCount = filteredBills.filter(b => isOverdue(b)).length;

  const handleExportCSV = () => {
    const headers = ['Order ID', 'Bill Number', 'Customer Name', 'Customer Phone', 'Date', 'Status', 'Total Amount', 'Due Amount'];
    const rows = filteredBills.map(bill => [
      bill.id,
      bill.billNumber || '',
      bill.customerName || 'Walk-in',
      bill.customerPhone || '',
      formatDate(bill.createdAt),
      isOverdue(bill) ? 'Overdue' : 'Pending',
      (bill.totalAmount || 0).toFixed(2),
      (bill.dueAmount ?? bill.totalAmount ?? 0).toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `outstanding_bills_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          <button className={styles.exportBtn} onClick={handleExportCSV}>
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
            <span>{t('overdue', settings.language)} Bills</span>
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
          {t('overdue', settings.language)}
        </button>
        <button 
          className={`${styles.filterBtn} ${filterType === 'Due Soon' ? styles.active : ''}`}
          onClick={() => setFilterType('Due Soon')}
        >
          Due Soon
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={16} color="#64748B" />
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            style={{ border: '1px solid #E2E8F0', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 600, outline: 'none', fontSize: '0.85rem', background: 'white' }}
          >
            <option value="All">All Time</option>
            <option value="Today">Today</option>
            <option value="This Month">This Month</option>
            <option value="This Year">This Year</option>
            <option value="Custom">Custom Range</option>
          </select>

          {dateRange === 'Custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input 
                type="date" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ border: '1px solid #E2E8F0', padding: '0.35rem 0.5rem', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', background: 'white' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>to</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ border: '1px solid #E2E8F0', padding: '0.35rem 0.5rem', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', background: 'white' }}
              />
            </div>
          )}
        </div>
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
                <td>{formatDate(bill.createdAt)}</td>
                <td>
                  <span className={`${styles.badge} ${isOverdue(bill) ? styles.badgeRed : styles.badgeYellow}`}>
                    {isOverdue(bill) ? t('overdue', settings.language) : t('pending', settings.language)}
                  </span>
                </td>
                <td className={styles.amount}><CurrencySymbol size={12} /> {(bill.totalAmount || 0).toFixed(2)}</td>
                <td className={styles.dueAmount}><CurrencySymbol size={12} /> {(bill.dueAmount ?? bill.totalAmount ?? 0).toFixed(2)}</td>
                <td>
                  <div className={styles.actionGroup}>
                    <button 
                      className={styles.settleBtn}
                      onClick={() => navigate(`/settlement?customerId=${bill.customerId}`)}
                    >
                      Settle
                    </button>
                    <button className={styles.iconBtn} onClick={() => navigate(`/invoice/${encodeURIComponent(bill.id)}`)}>
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
