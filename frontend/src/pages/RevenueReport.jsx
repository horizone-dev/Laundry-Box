import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, Calendar, Download, Filter, 
  CreditCard, Wallet, Smartphone, Landmark,
  ArrowUpRight, ArrowDownRight, Search, Printer
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import Pagination from '../components/Pagination';
import styles from './Reports.module.css';

export default function RevenueReport() {
  const { settings, formatDate } = useSettings();
  const formatDateTimeSplit = (dateVal) => {
    if (!dateVal) return { date: 'N/A', time: '' };
    const formattedDate = formatDate(dateVal);
    if (formattedDate === 'N/A' || formattedDate === 'Invalid Date') return { date: formattedDate, time: '' };
    
    let d;
    try {
      d = new Date(dateVal);
    } catch(e) {
      return { date: formattedDate, time: '' };
    }
    if (isNaN(d.getTime())) return { date: formattedDate, time: '' };

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    let ampm = '';
    if (settings.timeFormat === '12h' || !settings.timeFormat) {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
    }
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
    return { date: formattedDate, time: formattedTime };
  };

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState('All');
  const [filterDate, setFilterDate] = useState('Today');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMethod, filterDate]);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const res = await window.electronAPI.dbQuery('SELECT * FROM payments ORDER BY createdAt DESC', []);
        if (res.success) setPayments(res.data);
      } catch (err) {
        console.error("Revenue fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.orderId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = filterMethod === 'All' || p.method?.toUpperCase() === filterMethod.toUpperCase();
    
    let matchesDate = true;
    if (filterDate !== 'All') {
      const pDate = new Date(p.createdAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (filterDate === 'Today') {
        matchesDate = pDate >= today;
      } else if (filterDate === 'Yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        matchesDate = pDate >= yesterday && pDate < today;

      } else if (filterDate === 'This Month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        matchesDate = pDate >= startOfMonth;
      }
    }

    return matchesSearch && matchesMethod && matchesDate;
  });

  const totalRevenue = filteredPayments.reduce((s, p) => s + p.amount, 0);

  const paginatedPayments = React.useMemo(() => {
    return filteredPayments.slice((currentPage - 1) * 20, currentPage * 20);
  }, [filteredPayments, currentPage]);

  const stats = [
    { label: 'Total Collected', value: totalRevenue, icon: DollarSign, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Cash Payments', value: filteredPayments.filter(p => p.method === 'Cash' || p.method === 'CASH').reduce((s, p) => s + p.amount, 0), icon: Wallet, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Bank/Card', value: filteredPayments.filter(p => ['BANK', 'BANK TRANSFER', 'CARD'].includes(p.method?.toUpperCase())).reduce((s, p) => s + p.amount, 0), icon: Landmark, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'Digital/Other', value: filteredPayments.filter(p => ['UPI', 'WALLET', 'ONLINE'].includes(p.method?.toUpperCase())).reduce((s, p) => s + p.amount, 0), icon: Smartphone, color: '#F59E0B', bg: '#FFFBEB' },
  ];

  const handleExportCSV = () => {
    const headers = ['Date', 'Order ID', 'Method', 'Amount', 'Status'];
    const rows = filteredPayments.map(p => [
      formatDate(p.createdAt),
      p.orderId || 'Direct Payment',
      p.method,
      p.amount,
      'SUCCESS'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.reportsPage}>
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <h1>Revenue Statement</h1>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={18} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={18} /> Print PDF
          </button>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        {stats.map((s, i) => (
          <div key={i} className={styles.kpiCard}>
            <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ background: s.bg, padding: '0.4rem', borderRadius: '12px' }}>
                <s.icon size={20} color={s.color} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10B981', background: '#ECFDF5', padding: '0.25rem 0.5rem', borderRadius: '100px' }}>
                +12.5%
              </span>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>{s.label}</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1E293B', marginTop: '0.15rem' }}>
                <CurrencySymbol size={18} /> {s.value.toLocaleString()}
              </h2>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.tableCard} style={{ marginTop: '0.75rem', background: 'white', borderRadius: '16px', padding: '0.75rem 1rem', border: '1px solid #E2E8F0' }}>
        <div className={styles.tableToolbar} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div className={styles.searchBox} style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input 
              type="text" 
              placeholder="Search by Order ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
             <select 
               value={filterDate} 
               onChange={(e) => setFilterDate(e.target.value)}
               style={{ padding: '0.5rem 0.75rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', fontWeight: 600, color: '#475569' }}
             >
               <option value="All">All Time</option>
               <option value="Today">Today</option>
               <option value="Yesterday">Yesterday</option>
               <option value="This Month">This Month</option>
             </select>

             <select 
               value={filterMethod} 
               onChange={(e) => setFilterMethod(e.target.value)}
               style={{ padding: '0.5rem 0.75rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', fontWeight: 600, color: '#475569' }}
             >
               <option value="All">All Methods</option>
               <option value="Cash">Cash</option>
               <option value="Bank">Bank Transfer</option>
               <option value="Card">Card</option>
               <option value="UPI">UPI</option>
             </select>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #F1F5F9' }}>
              <th style={{ padding: '0.5rem 0.75rem', color: '#64748B', fontSize: '0.85rem' }}>DATE</th>
              <th style={{ padding: '0.5rem 0.75rem', color: '#64748B', fontSize: '0.85rem' }}>ORDER ID</th>
              <th style={{ padding: '0.5rem 0.75rem', color: '#64748B', fontSize: '0.85rem' }}>METHOD</th>
              <th style={{ padding: '0.5rem 0.75rem', color: '#64748B', fontSize: '0.85rem' }}>STATUS</th>
              <th style={{ padding: '0.5rem 0.75rem', color: '#64748B', fontSize: '0.85rem', textAlign: 'right' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPayments.map((p, i) => {
              const { date: payDate, time: payTime } = formatDateTimeSplit(p.createdAt);
              return (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>
                    <div>{payDate}</div>
                    {payTime && (
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.15rem', fontWeight: 500 }}>
                        {payTime}
                      </div>
                    )}
                  </td>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#1E293B' }}>{p.orderId || 'Direct Payment'}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     {(() => {
                       const m = p.method?.toUpperCase();
                       if (m === 'CASH') return <Wallet size={14} color="#3B82F6" />;
                       if (m === 'CARD') return <CreditCard size={14} color="#8B5CF6" />;
                       if (m === 'UPI') return <Smartphone size={14} color="#F59E0B" />;
                       return <Landmark size={14} color="#10B981" />;
                     })()}
                     <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.method}</span>
                   </div>
                </td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                  <span style={{ padding: '0.25rem 0.75rem', background: '#DCFCE7', color: '#166534', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700 }}>
                    SUCCESS
                  </span>
                </td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#1E293B' }}>
                  <CurrencySymbol size={14} /> {p.amount.toFixed(2)}
                </td>
              </tr>
            );
            })}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                  No revenue records found for the selected criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredPayments.length / 20)}
            onPageChange={setCurrentPage}
            totalItems={filteredPayments.length}
            pageSize={20}
            itemLabel="transactions"
          />
        )}
      </div>
    </div>
  );
}
