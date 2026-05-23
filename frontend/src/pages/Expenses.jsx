import React, { useState, useEffect } from 'react';
import { 
  Plus, Filter, Calendar, Download, Printer, 
  ChevronLeft, ChevronRight, MoreHorizontal, ArrowRight,
  TrendingDown, X, Zap, Trash2
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID } from '../constants';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Expenses.module.css';

export default function Expenses() {
  const { settings } = useSettings();
  const [expenses, setExpenses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('All');
  const [customCategories, setCustomCategories] = useState([]);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [formData, setFormData] = useState({ 
    title: '', 
    amount: '', 
    category: 'Supplies', 
    date: new Date().toISOString().split('T')[0],
    paymentSource: 'CASH',
    isTaxEnabled: false,
    taxMethod: 'inclusive'
  });

  useEffect(() => {
    if (settings?.taxMethod) {
      setFormData(prev => ({ ...prev, taxMethod: settings.taxMethod }));
    }
  }, [settings]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Safe date parser to avoid timezone shifts
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length < 3) return new Date(dateStr);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  };

  const fetchExpenses = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const res = await window.electronAPI.dbQuery('SELECT * FROM expenses ORDER BY date DESC', []);
        if (res.success) {
          setExpenses(res.data);
          
          // Parse unique custom categories from DB
          const defaultCategories = ['Supplies', 'Salaries', 'Rent', 'Utilities', 'Maintenance'];
          const foundCustom = res.data
            .map(e => e.category)
            .filter(cat => cat && !defaultCategories.includes(cat));
          const uniqueCustom = [...new Set(foundCustom)];
          setCustomCategories(uniqueCustom);
        }
      } catch (err) {
        console.error("Failed to fetch expenses:", err);
      }
    }
  };

  const filteredExpenses = React.useMemo(() => {
    return expenses.filter(ex => {
      // Category filter
      const matchesCategory = selectedCategory === 'All' || ex.category === selectedCategory;
      
      // Date Range filter
      let matchesDate = true;
      if (selectedDateRange !== 'All' && ex.date) {
        const itemDate = parseLocalDate(ex.date);
        if (!itemDate) return false;
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (selectedDateRange === 'Today') {
          matchesDate = itemDate.getTime() === today.getTime();
        } else if (selectedDateRange === 'Yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          matchesDate = itemDate.getTime() === yesterday.getTime();
        } else if (selectedDateRange === 'This Week') {
          const diff = today.getDate() - today.getDay();
          const startOfWeek = new Date(today.setDate(diff));
          startOfWeek.setHours(0, 0, 0, 0);
          matchesDate = itemDate >= startOfWeek;
        } else if (selectedDateRange === 'This Month') {
          matchesDate = itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth();
        } else if (selectedDateRange === 'This Year') {
          matchesDate = itemDate.getFullYear() === now.getFullYear();
        }
      }
      
      return matchesCategory && matchesDate;
    });
  }, [expenses, selectedCategory, selectedDateRange]);

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
      try {
        const id = `EXP-${Date.now()}`;
        const categoryToSave = showCustomCategoryInput ? customCategoryName.trim() : formData.category;
        
        if (!categoryToSave) {
          alert("Please specify a category.");
          return;
        }

        const taxAmount = formData.isTaxEnabled ? (
          formData.taxMethod === 'inclusive' 
            ? (parseFloat(formData.amount) - (parseFloat(formData.amount) / (1 + (settings.taxRate / 100))))
            : (parseFloat(formData.amount) * (settings.taxRate / 100))
        ) : 0;

        const totalAmount = formData.taxMethod === 'exclusive' && formData.isTaxEnabled
          ? (parseFloat(formData.amount) + taxAmount)
          : parseFloat(formData.amount);

        await window.electronAPI.dbQuery(
          'INSERT INTO expenses (id, shopId, title, amount, taxAmount, isTaxEnabled, taxMethod, category, date, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, DEFAULT_SHOP_ID, formData.title, totalAmount, taxAmount, formData.isTaxEnabled ? 1 : 0, formData.taxMethod, categoryToSave, formData.date, new Date().toISOString()]
        );

        // Also record in Accounts
        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txnId, DEFAULT_SHOP_ID, formData.paymentSource, 'EXPENSE', categoryToSave, totalAmount, formData.title, txnTimestamp, 0, new Date().toISOString(), 'Zap']
        );

        fetchExpenses();
        setShowModal(false);
        setShowCustomCategoryInput(false);
        setCustomCategoryName('');
        setFormData({ title: '', amount: '', category: 'Supplies', date: new Date().toISOString().split('T')[0], paymentSource: 'CASH', isTaxEnabled: false, taxMethod: settings.taxMethod || 'inclusive' });
      } catch (err) {
        console.error("Add expense error:", err);
      }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Tax', 'Status'];
    const rows = filteredExpenses.map(ex => [
      `"${(ex.date || '').replace(/"/g, '""')}"`,
      `"${(ex.category || '').replace(/"/g, '""')}"`,
      `"${(ex.title || '').replace(/"/g, '""')}"`,
      ex.amount,
      ex.taxAmount,
      '"PAID"'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.expensesPage}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>Finance {'>'} Expenses</p>
          <h1>Expenses Tracking</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={18} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Add Expense
          </button>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Expenses</span>
          <span className={styles.kpiValue}><CurrencySymbol size={22} /> {filteredExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
          <span className={styles.kpiTrend}>
            <TrendingDown size={14} /> 
            {selectedDateRange === 'All' ? 'Tracking all time' : `Tracking: ${selectedDateRange}`}
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Recent Transaction</span>
          <span className={styles.kpiValue}><CurrencySymbol size={22} /> {filteredExpenses[0]?.amount?.toLocaleString() || '0.00'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>{filteredExpenses[0]?.title || 'No matching transactions'}</span>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Count</span>
          <span className={styles.kpiValue}>{filteredExpenses.length}</span>
          <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', marginTop: '1rem', width: '100%' }}>
            <div 
              style={{ 
                width: expenses.length > 0 ? `${(filteredExpenses.length / expenses.length) * 100}%` : '0%', 
                height: '100%', 
                background: '#2563EB', 
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }}
            ></div>
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
            <div 
              className={`${styles.filterTab} ${selectedDateRange === 'All' ? styles.active : ''}`}
              onClick={() => setSelectedDateRange('All')}
            >
              All Time
            </div>
            <div 
              className={`${styles.filterTab} ${selectedDateRange === 'This Month' ? styles.active : ''}`}
              onClick={() => setSelectedDateRange('This Month')}
            >
              This Month
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className={styles.filterWrapper}>
              <Filter size={14} className={styles.filterIcon} />
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="All">All Categories</option>
                <option value="Supplies">Supplies</option>
                <option value="Salaries">Salaries</option>
                <option value="Rent">Rent</option>
                <option value="Utilities">Utilities</option>
                <option value="Maintenance">Maintenance</option>
                {customCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.filterWrapper}>
              <Calendar size={14} className={styles.filterIcon} />
              <select 
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="This Year">This Year</option>
              </select>
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
              <th>Tax</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length > 0 ? filteredExpenses.map((ex, idx) => (
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
                <td style={{ color: '#94A3B8', fontSize: '0.85rem' }}>
                  {ex.taxAmount > 0 ? (
                    <><CurrencySymbol size={12} /> {ex.taxAmount.toFixed(2)}</>
                  ) : '-'}
                </td>
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
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No expenses found matching the selected filters.</td></tr>
            )}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Showing {filteredExpenses.length > 0 ? 1 : 0} to {filteredExpenses.length} of {filteredExpenses.length} entries
            {filteredExpenses.length < expenses.length && ` (filtered from ${expenses.length} total entries)`}
          </span>
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
                    {showCustomCategoryInput ? (
                      <div className={styles.customCategoryWrapper}>
                        <input 
                          type="text" 
                          placeholder="Category name (e.g. Marketing)" 
                          required 
                          value={customCategoryName}
                          onChange={(e) => setCustomCategoryName(e.target.value)}
                          className={styles.customCategoryInput}
                        />
                        <button 
                          type="button" 
                          className={styles.cancelCustomBtn}
                          onClick={() => {
                            setShowCustomCategoryInput(false);
                            setCustomCategoryName('');
                            setFormData({ ...formData, category: 'Supplies' });
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <select 
                        value={formData.category}
                        onChange={(e) => {
                          if (e.target.value === 'ADD_CUSTOM') {
                            setShowCustomCategoryInput(true);
                            setCustomCategoryName('');
                          } else {
                            setFormData({...formData, category: e.target.value});
                          }
                        }}
                      >
                        <option value="Supplies">Supplies</option>
                        <option value="Salaries">Salaries</option>
                        <option value="Rent">Rent</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Maintenance">Maintenance</option>
                        {customCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="ADD_CUSTOM">+ Add Custom Category...</option>
                      </select>
                    )}
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

                <div className={styles.taxToggleArea}>
                   <div className={styles.taxToggle}>
                      <div className={styles.toggleText}>
                        <span className={styles.toggleLabel}>Tax / VAT ({settings.taxRate}%)</span>
                        <span className={styles.toggleSubtext}>Apply {settings.taxName} to this expense</span>
                      </div>
                      <label className={styles.switch}>
                        <input 
                          type="checkbox" 
                          checked={formData.isTaxEnabled}
                          onChange={(e) => setFormData({...formData, isTaxEnabled: e.target.checked})}
                        />
                        <span className={`${styles.slider} ${styles.round}`}></span>
                      </label>
                   </div>
                   {formData.isTaxEnabled && (
                     <>
                       <div className={styles.taxMethodSelector}>
                          <button 
                            type="button"
                            className={`${styles.methodBtn} ${formData.taxMethod === 'inclusive' ? styles.activeMethod : ''}`}
                            onClick={() => setFormData({...formData, taxMethod: 'inclusive'})}
                          >
                            Tax Inclusive
                          </button>
                          <button 
                            type="button"
                            className={`${styles.methodBtn} ${formData.taxMethod === 'exclusive' ? styles.activeMethod : ''}`}
                            onClick={() => setFormData({...formData, taxMethod: 'exclusive'})}
                          >
                            Tax Exclusive
                          </button>
                       </div>

                       <div className={styles.taxPreview}>
                          <div className={styles.previewItem}>
                            <span>Net Amount:</span>
                            <span><CurrencySymbol size={12} /> {
                              formData.taxMethod === 'inclusive' 
                                ? (parseFloat(formData.amount || 0) / (1 + (settings.taxRate / 100))).toFixed(2)
                                : (parseFloat(formData.amount || 0)).toFixed(2)
                            }</span>
                          </div>
                          <div className={styles.previewItem}>
                            <span>{settings.taxName} Amount:</span>
                            <span><CurrencySymbol size={12} /> {
                              formData.taxMethod === 'inclusive' 
                                ? (parseFloat(formData.amount || 0) - (parseFloat(formData.amount || 0) / (1 + (settings.taxRate / 100)))).toFixed(2)
                                : (parseFloat(formData.amount || 0) * (settings.taxRate / 100)).toFixed(2)
                            }</span>
                          </div>
                          <div className={styles.previewDivider}></div>
                          <div className={styles.previewItem} style={{ fontWeight: 800, color: '#1E293B' }}>
                            <span>Total Payable:</span>
                            <span><CurrencySymbol size={12} /> {
                              formData.taxMethod === 'exclusive'
                                ? (parseFloat(formData.amount || 0) * (1 + (settings.taxRate / 100))).toFixed(2)
                                : (parseFloat(formData.amount || 0)).toFixed(2)
                            }</span>
                          </div>
                       </div>
                     </>
                   )}
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
