import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Wallet, Landmark, ArrowUpRight, ArrowDownLeft, 
  Plus, Search, Filter, Calendar, MoreHorizontal,
  DollarSign, Receipt, CreditCard, ChevronRight,
  ShoppingBag, Truck, Zap, Droplets, Star, Trash2
} from 'lucide-react';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Accounts.module.css';

const ICON_OPTIONS = [
  { id: 'DollarSign', icon: DollarSign, color: '#3B82F6' },
  { id: 'ShoppingBag', icon: ShoppingBag, color: '#10B981' },
  { id: 'Receipt', icon: Receipt, color: '#F59E0B' },
  { id: 'CreditCard', icon: CreditCard, color: '#8B5CF6' },
  { id: 'Truck', icon: Truck, color: '#6366F1' },
  { id: 'Zap', icon: Zap, color: '#F43F5E' },
  { id: 'Droplets', icon: Droplets, color: '#06B6D4' },
  { id: 'Star', icon: Star, color: '#FACC15' }
];

export default function Accounts() {
  const { type } = useParams(); // 'cash' or 'bank'
  const isCash = type === 'cash';
  
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'INCOME',
    category: 'Service Payment',
    amount: '',
    description: '',
    icon: 'DollarSign'
  });
  const [stats, setStats] = useState({ balance: 0, income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [type]);

  const fetchData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        // Ensure table exists (in case app wasn't restarted after schema update)
        await window.electronAPI.dbQuery(`
          CREATE TABLE IF NOT EXISTS account_transactions (
            id TEXT PRIMARY KEY,
            shopId TEXT,
            accountType TEXT,
            type TEXT,
            category TEXT,
            amount REAL,
            description TEXT,
            date TEXT,
            isSynced INTEGER DEFAULT 0,
            updatedAt TEXT
          )
        `, []);

        const accType = type.toUpperCase();
        const res = await window.electronAPI.dbQuery(
          'SELECT * FROM account_transactions WHERE accountType = ? ORDER BY date DESC', 
          [accType]
        );
        
        if (res.success) {
          const data = res.data;
          setTransactions(data);
          
          const income = data.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
          const expense = data.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
          setStats({ balance: income - expense, income, expense });
        }
      } catch (err) {
        console.error("Fetch account data error:", err);
      } finally {
        setLoading(false);
      }
    } else {
      // Mock Data for Demo
      const mockData = [
        { id: '1', date: '2023-10-24 10:30', category: 'Service Payment', description: 'Order #AG-8829', amount: 125.50, type: 'INCOME' },
        { id: '2', date: '2023-10-24 09:15', category: 'Supplies', description: 'Bought Detergent', amount: 45.00, type: 'EXPENSE' },
        { id: '3', date: '2023-10-23 16:45', category: 'Service Payment', description: 'Order #AG-8828', amount: 85.00, type: 'INCOME' },
      ];
      setTransactions(mockData);
      setStats({ balance: 165.50, income: 210.50, expense: 45.00 });
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (window.electronAPI?.dbQuery) {
      try {
        const id = `TXN-${Date.now()}`;
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
        
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, 
            'SHOP_01', 
            type.toUpperCase(), 
            formData.type, 
            formData.category, 
            parseFloat(formData.amount), 
            formData.description, 
            timestamp, 
            0, 
            new Date().toISOString(),
            formData.icon
          ]
        );
        
        setShowAddModal(false);
        setFormData({ type: 'INCOME', category: 'Service Payment', amount: '', description: '', icon: 'DollarSign' });
        fetchData();
      } catch (err) {
        console.error("Add transaction error:", err);
        alert("Failed to save transaction.");
      }
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction? This will not affect the customer balance if it was a settlement.")) return;
    
    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery('DELETE FROM account_transactions WHERE id = ?', [id]);
        fetchData();
      } catch (err) {
        console.error("Delete transaction error:", err);
        alert("Failed to delete transaction.");
      }
    }
  };

  const filteredTransactions = transactions.filter(t => 
    t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>{isCash ? 'Cash Account' : 'Bank Account'}</h1>
          <p>Monitor your {isCash ? 'physical cash flow' : 'bank transactions'} and balance.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Add Transaction
        </button>
      </header>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.iconBox} ${styles.balanceIcon}`}>
            {isCash ? <Wallet size={24} /> : <Landmark size={24} />}
          </div>
          <div className={styles.statInfo}>
            <span>Current Balance</span>
            <h3><CurrencySymbol size={22} /> {stats.balance.toFixed(2)}</h3>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.iconBox} ${styles.incomeIcon}`}>
            <ArrowUpRight size={24} />
          </div>
          <div className={styles.statInfo}>
            <span>Total Income</span>
            <h3 className={styles.incomeText}>+<CurrencySymbol size={22} /> {stats.income.toFixed(2)}</h3>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.iconBox} ${styles.expenseIcon}`}>
            <ArrowDownLeft size={24} />
          </div>
          <div className={styles.statInfo}>
            <span>Total Expense</span>
            <h3 className={styles.expenseText}>-<CurrencySymbol size={22} /> {stats.expense.toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainGridFull}>
        <div className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <h3>Transaction History</h3>
            <div className={styles.filters}>
              <div className={styles.search}>
                <Search size={16} />
                <input 
                  type="text" 
                  placeholder="Search transactions..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className={styles.filterBtn}><Filter size={16} /> Filter</button>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Category</th>
                <th>Description</th>
                <th>Type</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(t => {
                const IconComp = ICON_OPTIONS.find(i => i.id === t.icon)?.icon || DollarSign;
                return (
                  <tr key={t.id}>
                    <td className={styles.dateCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className={styles.tableIcon} style={{ background: ICON_OPTIONS.find(i => i.id === t.icon)?.color + '15', color: ICON_OPTIONS.find(i => i.id === t.icon)?.color }}>
                          <IconComp size={16} />
                        </div>
                        {t.date}
                      </div>
                    </td>
                    <td><span className={styles.categoryBadge}>{t.category}</span></td>
                    <td className={styles.descCell}>{t.description}</td>
                    <td>
                      <span className={`${styles.typeBadge} ${t.type === 'INCOME' ? styles.incomeBadge : styles.expenseBadge}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className={styles.amountCell}>
                      <span className={t.type === 'INCOME' ? styles.incomeText : styles.expenseText}>
                        {t.type === 'INCOME' ? '+' : '-'}<CurrencySymbol size={14} /> {t.amount.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <button className={styles.deleteBtn} onClick={() => handleDeleteTransaction(t.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="6" className={styles.empty}>No transactions found matching your criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Add New {isCash ? 'Cash' : 'Bank'} Entry</h2>
              <button className={styles.closeBtn} onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddTransaction}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Transaction Type</label>
                    <select 
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                    >
                      <option value="INCOME">Income / Deposit (+)</option>
                      <option value="EXPENSE">Expense / Withdrawal (-)</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Category</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Service Payment"
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Select Icon</label>
                  <div className={styles.iconPicker}>
                    {ICON_OPTIONS.map(opt => (
                      <div 
                        key={opt.id}
                        className={`${styles.iconOption} ${formData.icon === opt.id ? styles.selectedIcon : ''}`}
                        onClick={() => setFormData({...formData, icon: opt.id})}
                        style={{ color: opt.color }}
                      >
                        <opt.icon size={20} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Amount (<CurrencySymbol size={12} />)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Description</label>
                  <textarea 
                    placeholder="Details about this transaction..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className={styles.saveBtn}>Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
