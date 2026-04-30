import React from 'react';
import { 
  Plus, Filter, Calendar, Download, Printer, 
  ChevronLeft, ChevronRight, MoreHorizontal, ArrowRight,
  TrendingDown
} from 'lucide-react';
import styles from './Expenses.module.css';

const EXPENSES = [
  { date: 'Oct 24, 2023', category: 'Salaries', dot: '#3B82F6', desc: 'Monthly payroll for store staff (12 employees)', amount: '$8,450.00', status: 'PAID' },
  { date: 'Oct 22, 2023', category: 'Rent', dot: '#A855F7', desc: 'Central Plaza facility rental - Unit 402', amount: '$2,200.00', status: 'PAID' },
  { date: 'Oct 20, 2023', category: 'Supplies', dot: '#F59E0B', desc: 'Industrial detergent bulk order (500L)', amount: '$845.50', status: 'PENDING' },
  { date: 'Oct 18, 2023', category: 'Utilities', dot: '#10B981', desc: 'Water and Electricity - Store 01', amount: '$612.20', status: 'PAID' },
  { date: 'Oct 15, 2023', category: 'Supplies', dot: '#F59E0B', desc: 'Paper packaging and hangers restock', amount: '$374.30', status: 'PENDING' },
];

export default function Expenses() {
  return (
    <div className={styles.expensesPage}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>Finance {'>'} Expenses</p>
          <h1>Expenses Tracking</h1>
        </div>
        <button className="btn btn-primary">
          <Plus size={18} /> Add Expense
        </button>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Expenses This Month</span>
          <span className={styles.kpiValue}>$12,482.00</span>
          <span className={styles.kpiTrend}><TrendingDown size={14} /> 4.2% from last month</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Pending Approval</span>
          <span className={styles.kpiValue}>$2,105.50</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', marginLeft: '0.5rem' }}>
              {[1, 2].map(i => (
                <div key={i} style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#E2E8F0', border: '2px solid white', marginLeft: '-8px' }}></div>
              ))}
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>8 items waiting</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Major Category</span>
          <span className={styles.kpiValue}>Salaries</span>
          <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', marginTop: '1rem', width: '100%' }}>
            <div style={{ width: '65%', height: '100%', background: '#2563EB', borderRadius: '3px' }}></div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.primaryCard}`}>
          <span className={styles.kpiLabel}>Remaining Budget</span>
          <span className={styles.kpiValue}>$5,518.00</span>
          <div className={styles.budgetFooter}>
            View Budget Details <ArrowRight size={14} />
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div className={styles.tableFilters}>
            <div className={`${styles.filterTab} ${styles.active}`}>All Time</div>
            <div className={styles.filterTab}>This Month</div>
            <div className={styles.filterTab}>Quarterly</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className={styles.actionBtn}><Filter size={16} /> Category</button>
            <button className={styles.actionBtn}><Calendar size={16} /> Date Range</button>
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', paddingLeft: '1.5rem', borderLeft: '1px solid #E2E8F0' }}>
              <Download size={18} color="#94A3B8" />
              <Printer size={18} color="#94A3B8" />
            </div>
          </div>
        </div>

        <table className={styles.expensesTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {EXPENSES.map((ex, idx) => (
              <tr key={idx}>
                <td style={{ color: '#64748B', fontWeight: 600 }}>{ex.date}</td>
                <td>
                  <div className={styles.categoryCell}>
                    <span className={styles.categoryDot} style={{ background: ex.dot }}></span>
                    {ex.category}
                  </div>
                </td>
                <td className={styles.descriptionCell}>{ex.desc}</td>
                <td className={styles.amountCell}>{ex.amount}</td>
                <td>
                  <span className={`${styles.statusBadge} ${ex.status === 'PAID' ? styles.paid : styles.pending}`}>
                    {ex.status}
                  </span>
                </td>
                <td><MoreHorizontal size={18} color="#94A3B8" /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>Showing 1 to 5 of 42 entries</span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn}><ChevronLeft size={16} /></button>
            <button className={`${styles.pageBtn} ${styles.active}`}>1</button>
            <button className={styles.pageBtn}>2</button>
            <button className={styles.pageBtn}>3</button>
            <span style={{ color: '#94A3B8' }}>...</span>
            <button className={styles.pageBtn}>9</button>
            <button className={styles.pageBtn}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
