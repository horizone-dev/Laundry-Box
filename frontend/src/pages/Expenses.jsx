import React, { useState, useEffect } from 'react';
import { 
  Plus, Filter, Calendar, Download, Printer, 
  ChevronLeft, ChevronRight, MoreHorizontal, ArrowRight,
  TrendingDown, X, Zap, Trash2
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Expenses.module.css';

export default function Expenses() {
  const { settings } = useSettings();
  const [expenses, setExpenses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    title: '', 
    amount: '', 
    category: 'Supplies', 
    date: new Date().toISOString().split('T')[0],
    paymentSource: 'CASH' 
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const res = await window.electronAPI.dbQuery('SELECT * FROM expenses ORDER BY date DESC', []);
        if (res.success) setExpenses(res.data);
      } catch (err) {
        console.error("Failed to fetch expenses:", err);
      }
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense? This will also remove the corresponding transaction in accounts.")) return;
    
    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery('DELETE FROM expenses WHERE id = ?', [id]);
        // Also delete from transactions
        await window.electronAPI.dbQuery('DELETE FROM account_transactions WHERE description LIKE ?', [`%${id}%`]);
        fetchExpenses();
      } catch (err) {
        console.error("Delete expense error:", err);
      }
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (window.electronAPI?.dbQuery) {
      try {
        const id = `EXP-${Date.now()}`;
        await window.electronAPI.dbQuery(
          'INSERT INTO expenses (id, shopId, title, amount, category, date, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, 'SHOP_01', formData.title, parseFloat(formData.amount), formData.category, formData.date, new Date().toISOString()]
        );

        // Also record in Accounts
        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txnId, 'SHOP_01', formData.paymentSource, 'EXPENSE', formData.category, parseFloat(formData.amount), formData.title, txnTimestamp, 0, new Date().toISOString(), 'Zap']
        );

        fetchExpenses();
        setShowModal(false);
        setFormData({ title: '', amount: '', category: 'Supplies', date: new Date().toISOString().split('T')[0], paymentSource: 'CASH' });
      } catch (err) {
        console.error("Add expense error:", err);
      }
    }
  };
  return (
    <div className={styles.expensesPage}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>Finance {'>'} Expenses</p>
          <h1>Expenses Tracking</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Expense
        </button>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Expenses</span>
          <span className={styles.kpiValue}><CurrencySymbol size={22} /> {expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
          <span className={styles.kpiTrend}><TrendingDown size={14} /> Tracking all time</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Recent Transaction</span>
          <span className={styles.kpiValue}><CurrencySymbol size={22} /> {expenses[0]?.amount?.toLocaleString() || '0.00'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>{expenses[0]?.title || 'No expenses yet'}</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Count</span>
          <span className={styles.kpiValue}>{expenses.length}</span>
          <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', marginTop: '1rem', width: '100%' }}>
            <div style={{ width: '100%', height: '100%', background: '#2563EB', borderRadius: '3px' }}></div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.primaryCard}`}>
          <span className={styles.kpiLabel}>Expense Status</span>
          <span className={styles.kpiValue}>Updated</span>
          <div className={styles.budgetFooter}>
            All records synchronized <ArrowRight size={14} />
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div className={styles.tableFilters}>
            <div className={`${styles.filterTab} ${styles.active}`}>All Time</div>
            <div className={styles.filterTab}>This Month</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className={styles.actionBtn}><Filter size={16} /> Category</button>
            <button className={styles.actionBtn}><Calendar size={16} /> Date Range</button>
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
            {expenses.length > 0 ? expenses.map((ex, idx) => (
              <tr key={ex.id || idx}>
                <td style={{ color: '#64748B', fontWeight: 600 }}>{ex.date}</td>
                <td>
                  <div className={styles.categoryCell}>
                    <span className={styles.categoryDot} style={{ background: '#3B82F6' }}></span>
                    {ex.category}
                  </div>
                </td>
                <td className={styles.descriptionCell}>{ex.title}</td>
                <td className={styles.amountCell}><CurrencySymbol size={14} /> {ex.amount.toFixed(2)}</td>
                <td>
                  <span className={`${styles.statusBadge} ${styles.paid}`}>
                    PAID
                  </span>
                </td>
                <td>
                  <button 
                    className={styles.deleteBtn} 
                    onClick={() => handleDeleteExpense(ex.id)}
                    style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No expenses found.</td></tr>
            )}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>Showing 1 to {expenses.length} of {expenses.length} entries</span>
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Add New Expense</h2>
              <X size={24} className={styles.closeBtn} onClick={() => setShowModal(false)} />
            </div>
            <form onSubmit={handleAddExpense}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Title / Description</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Amount</label>
                    <input 
                      type="number" 
                      required 
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Category</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                      <option>Supplies</option>
                      <option>Salaries</option>
                      <option>Rent</option>
                      <option>Utilities</option>
                      <option>Maintenance</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Date</label>
                    <input 
                      type="date" 
                      required 
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Paid From</label>
                    <select 
                      value={formData.paymentSource}
                      onChange={(e) => setFormData({...formData, paymentSource: e.target.value})}
                    >
                      <option value="CASH">Cash Account</option>
                      <option value="BANK">Bank Account</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn}>Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
