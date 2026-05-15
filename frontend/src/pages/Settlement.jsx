import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, User, DollarSign, Calendar, Clock, CheckCircle, 
  AlertCircle, CreditCard, Wallet, FileText, Send, Printer,
  ChevronRight, ArrowRight, History, Trash2, Download, X,
  Filter, MoreVertical, Plus, Info, Eye, ArrowUpRight, TrendingUp,
  Share2, MessageSquare, FileDown, Layers, ArrowLeft
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Settlement.module.css';

export default function Settlement() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const initialCustomerId = queryParams.get('customerId');
  
  const { settings } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Outstanding');
  const [loading, setLoading] = useState(false);
  const [globalData, setGlobalData] = useState({ pending: [], history: [], advances: [] });
  const [kpis, setKpis] = useState({
    outstanding: 0,
    settlements: 0,
    pendingCount: 0,
    overdueCount: 0,
    advanceCredits: 0
  });

  // Payment State
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchCustomers();
    if (!selectedCustomer) {
      fetchGlobalData();
    }
  }, [searchTerm, activeTab, selectedCustomer]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerSpecificData(selectedCustomer);
    }
  }, [selectedCustomer]);

  const fetchCustomers = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        let query = 'SELECT * FROM customers';
        let params = [];
        let conditions = [];

        if (searchTerm) {
          conditions.push('(name LIKE ? OR phone LIKE ?)');
          const term = `%${searchTerm}%`;
          params.push(term, term);
        }

        if (activeTab === 'Outstanding') conditions.push('balance > 0');
        else if (activeTab === 'Advance') conditions.push('balance < 0');
        else if (activeTab === 'Paid') conditions.push('balance = 0');

        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY balance DESC, name ASC LIMIT 50';
        const res = await window.electronAPI.dbQuery(query, params);
        if (res.success) setCustomers(res.data);
      } catch (err) {
        console.error("Fetch customers failed:", err);
      }
    }
  };

  const fetchGlobalData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const pendingRes = await window.electronAPI.dbQuery(
          'SELECT orders.*, customers.name as customerName, customers.phone as customerPhone, customers.balance as customerBalance FROM orders LEFT JOIN customers ON orders.customerId = customers.id WHERE (orders.dueAmount > 0 OR orders.paymentStatus NOT IN ("Paid", "Settled")) ORDER BY orders.createdAt DESC LIMIT 8',
          []
        );
        const historyRes = await window.electronAPI.dbQuery(
          'SELECT payments.*, customers.name as customerName FROM payments LEFT JOIN customers ON payments.customerId = customers.id ORDER BY payments.createdAt DESC LIMIT 8',
          []
        );
        const advancesRes = await window.electronAPI.dbQuery(
          'SELECT * FROM customers WHERE balance < 0 ORDER BY updatedAt DESC LIMIT 8',
          []
        );

        setGlobalData({
          pending: pendingRes.success ? pendingRes.data : [],
          history: historyRes.success ? historyRes.data : [],
          advances: advancesRes.success ? advancesRes.data : []
        });

        const outstandingSum = await window.electronAPI.dbQuery('SELECT SUM(balance) as total FROM customers WHERE balance > 0', []);
        const advanceSum = await window.electronAPI.dbQuery('SELECT SUM(ABS(balance)) as total FROM customers WHERE balance < 0', []);
        const pendingCount = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM orders WHERE dueAmount > 0', []);
        const settlementsRes = await window.electronAPI.dbQuery("SELECT SUM(amount) as total FROM payments WHERE strftime('%m', createdAt) = strftime('%m', 'now')", []);
        const overdueRes = await window.electronAPI.dbQuery("SELECT COUNT(*) as count FROM orders WHERE dueAmount > 0 AND createdAt < date('now', '-2 days')", []);

        setKpis({
          outstanding: (outstandingSum.success && outstandingSum.data[0]?.total) || 0,
          settlements: (settlementsRes.success && settlementsRes.data[0]?.total) || 0,
          pendingCount: (pendingCount.success && pendingCount.data[0]?.count) || 0,
          overdueCount: (overdueRes.success && overdueRes.data[0]?.count) || 0,
          advanceCredits: (advanceSum.success && advanceSum.data[0]?.total) || 0
        });
      } catch (err) {
        console.error("Global data fetch failed:", err);
      }
    }
  };

  const fetchCustomerSpecificData = async (customer) => {
    if (!customer || !customer.id) return;
    
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        const customerId = customer.id;
        
        const pendingRes = await window.electronAPI.dbQuery(
          'SELECT * FROM orders WHERE customerId = ? AND (dueAmount > 0 OR paymentStatus NOT IN ("Paid", "Settled")) ORDER BY createdAt DESC',
          [customerId]
        );
        const historyRes = await window.electronAPI.dbQuery(
          'SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt DESC LIMIT 10',
          [customerId]
        );
        
        setGlobalData(prev => ({
          ...prev,
          pending: pendingRes.success ? pendingRes.data.map(d => ({
            ...d, 
            customerName: customer.name,
            customerPhone: customer.phone,
            customerBalance: customer.balance
          })) : [],
          history: historyRes.success ? historyRes.data.map(d => ({
            ...d, 
            customerName: customer.name
          })) : [],
        }));
      } catch (err) {
        console.error("Fetch specific failed:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSettle = async () => {
    const amount = parseFloat(paymentAmount);
    if (!selectedCustomer || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    const timestamp = new Date().toISOString();
    
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        let remaining = amount;
        
        // Fetch fresh pending bills just for the settlement logic to be safe
        const billsRes = await window.electronAPI.dbQuery(
          'SELECT * FROM orders WHERE customerId = ? AND (dueAmount > 0 OR paymentStatus != "Paid") ORDER BY createdAt ASC',
          [selectedCustomer.id]
        );
        const bills = billsRes.success ? billsRes.data : [];

        if (bills.length > 0) {
          for (const bill of bills) {
            if (remaining <= 0) break;
            const currentDue = bill.dueAmount > 0 ? bill.dueAmount : (bill.totalAmount - (bill.paidAmount || 0));
            if (currentDue <= 0) continue;

            let allocate = 0;
            let newStatus = 'Paid';
            let newDue = 0;
            let newPaid = (bill.paidAmount || 0);

            if (remaining >= currentDue) {
              allocate = currentDue;
              remaining -= currentDue;
              newPaid += allocate;
              newDue = 0;
              newStatus = 'Paid';
            } else {
              allocate = remaining;
              newPaid += allocate;
              newDue = currentDue - remaining;
              remaining = 0;
              newStatus = 'Partial';
            }

            await window.electronAPI.dbQuery(
              'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, updatedAt = ? WHERE id = ?',
              [newPaid, newDue, newStatus, timestamp, bill.id]
            );

            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [`PAY-${Date.now()}-${bill.id}`, selectedCustomer.id, bill.id, 'SHOP_01', allocate, paymentMethod, 'SUCCESS', timestamp]
            );
          }
        }

        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, updatedAt = ? WHERE id = ?',
          [amount, timestamp, selectedCustomer.id]
        );

        alert("Settlement completed successfully!");
        setPaymentAmount('');
        setShowPayModal(false);
        // Refresh data
        fetchCustomerSpecificData(selectedCustomer.id);
        // We need to refresh the customer object itself to get updated balance
        const updatedCust = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE id = ?', [selectedCustomer.id]);
        if (updatedCust.success) setSelectedCustomer(updatedCust.data[0]);
        
        fetchGlobalData();
        fetchCustomers();
      } catch (err) {
        console.error("Settlement failed:", err);
        alert("Settlement failed: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const displayDue = selectedCustomer ? Math.max(0, selectedCustomer.balance) : 0;
  const newBalance = displayDue - (parseFloat(paymentAmount) || 0);

  return (
    <div className={styles.settlementPage}>

      <div className={styles.mainContent}>
        <div className={styles.stickyHeader}>
          <div className={styles.headerInfo}>
            <h1>{selectedCustomer ? `Managing: ${selectedCustomer.name}` : 'Credit Settlement Dashboard'}</h1>
            <div className={styles.headerActions}>
              {selectedCustomer && (
                <button className={styles.backBtn} onClick={() => setSelectedCustomer(null)}>
                  <ArrowLeft size={16} /> Back to Dashboard
                </button>
              )}
              <button className={styles.fullHistoryBtn}>
                <History size={16} /> Full History
              </button>
            </div>
          </div>

          <div className={styles.kpiRow}>
            <KPICard icon={<DollarSign size={18} />} label={selectedCustomer ? "Current Balance" : "Total Outstanding"} value={<><CurrencySymbol size={16} /> {selectedCustomer ? Math.abs(selectedCustomer.balance).toFixed(2) : kpis.outstanding.toFixed(2)}</>} subText={selectedCustomer ? (selectedCustomer.balance > 0 ? "Amount Due" : "Advance Credit") : "Across all customers"} color={selectedCustomer ? (selectedCustomer.balance > 0 ? "#ef4444" : "#10b981") : "#2563eb"} bgColor={selectedCustomer ? (selectedCustomer.balance > 0 ? "#fef2f2" : "#f0fdf4") : "#eff6ff"} />
            <KPICard icon={<CheckCircle size={18} />} label="Settlements (Monthly)" value={<><CurrencySymbol size={16} /> {kpis.settlements.toFixed(2)}</>} subText="Completed this month" color="#10b981" bgColor="#f0fdf4" />
            <KPICard icon={<TrendingUp size={18} />} label="Pending Bills" value={selectedCustomer ? globalData.pending.length : kpis.pendingCount} subText="Require processing" color="#8b5cf6" bgColor="#f5f3ff" />
            <KPICard icon={<AlertCircle size={18} />} label="Overdue Bills" value={kpis.overdueCount} subText="Need attention" color="#f97316" bgColor="#fff7ed" />
            <KPICard icon={<Wallet size={18} />} label="Advance Credits" value={<><CurrencySymbol size={16} /> {selectedCustomer ? (selectedCustomer.balance < 0 ? Math.abs(selectedCustomer.balance).toFixed(2) : "0.00") : kpis.advanceCredits.toFixed(2)}</>} subText="Prepaid balances" color="#06b6d4" bgColor="#ecfeff" />
          </div>
        </div>

        <div className={styles.dashboardGrid}>
          <div className={styles.leftSide}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.headerLeft}>
                  <User size={18} color="#2563eb" />
                  <h3>Customer Selection</h3>
                </div>
                <Filter size={16} color="#94a3b8" />
              </div>
              
              <div className={styles.cardContent}>
                <div className={styles.searchBox}>
                  <Search size={16} color="#94a3b8" />
                  <input 
                    type="text" 
                    placeholder="Search by name or phone..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className={styles.tabList}>
                  {['All', 'Outstanding', 'Advance', 'Paid'].map(tab => (
                    <button 
                      key={tab} 
                      className={`${styles.tabItem} ${activeTab === tab ? styles.activeTab : ''}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className={styles.scrollableList}>
                  {customers.map((customer, idx) => (
                    <div 
                      key={customer.id} 
                      className={`${styles.customerRow} ${selectedCustomer?.id === customer.id ? styles.selectedRow : ''}`}
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <div className={styles.rowLeft}>
                        <div className={`${styles.avatar} styles.avatarColor${idx % 5}`}>{customer.name.charAt(0)}</div>
                        <div className={styles.rowInfo}>
                          <span className={styles.rowName}>{customer.name}</span>
                          <span className={styles.rowPhone}>{customer.phone}</span>
                        </div>
                      </div>
                      <div className={styles.rowRight}>
                        <span className={styles.rowAmount}><CurrencySymbol size={10} /> {Math.abs(customer.balance).toFixed(2)}</span>
                        <span className={`${styles.rowStatus} ${customer.balance > 0 ? styles.statusDue : styles.statusAdv}`}>
                          {customer.balance > 0 ? 'Outstanding' : 'Advance'}
                        </span>
                        <ChevronRight size={14} color="#94a3b8" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedCustomer && (
              <button className={styles.mainPayBtn} onClick={() => setShowPayModal(true)}>
                <DollarSign size={20} /> Process Payment for {selectedCustomer.name.split(' ')[0]}
              </button>
            )}
          </div>

          <div className={styles.rightSide}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.headerLeft}>
                  <FileText size={18} color="#2563eb" />
                  <h3>{selectedCustomer ? `Pending Bills (${selectedCustomer.name})` : 'Recent Pending Bills (All)'}</h3>
                </div>
                <div className={styles.headerActions}>
                  <select className={styles.compactSelect}>
                    <option>All Branches</option>
                  </select>
                </div>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.compactTable}>
                  <thead>
                    <tr>
                      <th>Bill ID</th>
                      { !selectedCustomer && <th>Customer</th> }
                      <th>Bill Date</th>
                      <th>Due Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalData.pending.map(bill => (
                      <tr key={bill.id} onClick={() => !selectedCustomer && setSelectedCustomer({id: bill.customerId, name: bill.customerName, phone: bill.customerPhone, balance: bill.customerBalance})} style={{cursor: 'pointer'}}>
                        <td className={styles.boldText}>{bill.id}</td>
                        { !selectedCustomer && <td>{bill.customerName}</td> }
                        <td>{new Date(bill.createdAt).toLocaleDateString()}</td>
                        <td>{new Date(new Date(bill.createdAt).getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString()}</td>
                        <td className={styles.greenText}><CurrencySymbol size={10} /> {bill.dueAmount.toFixed(2)}</td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgeRed}`}>Pending</span>
                        </td>
                        <td>
                          <button className={styles.payActionBtn} title="Settle This Bill" onClick={(e) => { e.stopPropagation(); if(!selectedCustomer) setSelectedCustomer({id: bill.customerId, name: bill.customerName, phone: bill.customerPhone, balance: bill.customerBalance}); setShowPayModal(true); }}>
                            <DollarSign size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {globalData.pending.length === 0 && (
                      <tr><td colSpan="7" style={{textAlign: 'center', padding: '3rem', color: '#94a3b8'}}>No pending bills found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.bottomGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.headerLeft}>
                <History size={18} color="#10b981" />
                <h3>{selectedCustomer ? `Settlements (${selectedCustomer.name})` : 'Latest Settlements (All)'}</h3>
              </div>
              <button className={styles.viewLink} onClick={() => navigate('/reports/revenue')}>View All <ChevronRight size={14} /></button>
            </div>
            <div className={styles.internalScroll}>
              {globalData.history.map(item => (
                <div key={item.id} className={styles.historyItem}>
                  <div className={styles.itemLeft}>
                    <div className={styles.iconCircle}><CheckCircle size={14} /></div>
                    <div className={styles.itemMeta}>
                      <span className={styles.itemName}>{item.customerName}</span>
                      <span className={styles.itemSub}>{item.method} • {new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={styles.itemAmount}><CurrencySymbol size={10} /> {item.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {globalData.history.length === 0 && (
                <div style={{textAlign: 'center', padding: '2rem', color: '#94a3b8'}}>No history found.</div>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.headerLeft}>
                <ArrowUpRight size={18} color="#8b5cf6" />
                <h3>{selectedCustomer ? `Advance Details (${selectedCustomer.name})` : 'Advance Payments / Credits'}</h3>
              </div>
              <button className={styles.viewLink} onClick={() => navigate('/outstanding-bills')}>View All <ChevronRight size={14} /></button>
            </div>
            <div className={styles.internalScroll}>
              <table className={styles.compactTable}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Advance Amount</th>
                    <th>Last Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  { !selectedCustomer ? globalData.advances.map(adv => (
                    <tr key={adv.id} onClick={() => setSelectedCustomer(adv)} style={{cursor: 'pointer'}}>
                      <td className={styles.boldText}>{adv.name}</td>
                      <td className={styles.greenText}><CurrencySymbol size={10} /> {Math.abs(adv.balance).toFixed(2)}</td>
                      <td>{new Date(adv.updatedAt || adv.createdAt).toLocaleDateString()}</td>
                      <td><Eye size={14} color="#2563eb" className={styles.clickable} /></td>
                    </tr>
                  )) : (
                    <tr>
                      <td className={styles.boldText}>{selectedCustomer.name}</td>
                      <td className={styles.greenText}><CurrencySymbol size={10} /> {selectedCustomer.balance < 0 ? Math.abs(selectedCustomer.balance).toFixed(2) : "0.00"}</td>
                      <td>Today</td>
                      <td><Plus size={14} color="#2563eb" className={styles.clickable} title="Add More Advance" /></td>
                    </tr>
                  )}
                  { !selectedCustomer && globalData.advances.length === 0 && (
                    <tr><td colSpan="4" style={{textAlign: 'center', padding: '2rem', color: '#94a3b8'}}>No advance accounts.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Settlement Modal */}
      {showPayModal && selectedCustomer && (
        <div className={styles.modalOverlay}>
          <div className={styles.payModal}>
            <div className={styles.modalHeader}>
              <div className={styles.headerLeft}>
                <div className={styles.modalIcon}><Wallet size={20} /></div>
                <div>
                  <h3>Process Settlement</h3>
                  <p>{selectedCustomer.name} • {selectedCustomer.phone}</p>
                </div>
              </div>
              <X size={20} className={styles.closeBtn} onClick={() => { setShowPayModal(false); }} />
            </div>

            <div className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label>Received Amount</label>
                <div className={styles.amountInput}>
                  <CurrencySymbol size={20} />
                  <input 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <div className={styles.quickPay}>
                  <button onClick={() => setPaymentAmount(displayDue.toFixed(2))}>Full: {displayDue.toFixed(2)}</button>
                  <button onClick={() => setPaymentAmount((displayDue/2).toFixed(2))}>50%</button>
                </div>
              </div>

              <div className={styles.modalRow}>
                <div className={styles.inputGroup}>
                  <label>Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="UPI">UPI / Digital</option>
                  </select>
                </div>
              </div>

              <div className={styles.summaryBox}>
                <div className={styles.sumRow}>
                  <span>Account Balance (Due)</span>
                  <span><CurrencySymbol size={12} /> {displayDue.toFixed(2)}</span>
                </div>
                <div className={styles.sumRow}>
                  <span>Payment Amount</span>
                  <span style={{color: '#10b981'}}>+ <CurrencySymbol size={12} /> {(parseFloat(paymentAmount) || 0).toFixed(2)}</span>
                </div>
                <div className={styles.sumDivider}></div>
                <div className={styles.sumRowTotal}>
                  <span>{newBalance < 0 ? 'New Advance' : 'New Balance'}</span>
                  <span style={{ color: newBalance < 0 ? '#10b981' : '#0f172a' }}>
                    <CurrencySymbol size={14} /> {Math.abs(newBalance).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => { setShowPayModal(false); }}>Cancel</button>
              <button 
                className={styles.confirmBtn} 
                onClick={handleSettle}
                disabled={!paymentAmount || loading}
              >
                {loading ? 'Processing...' : 'Confirm Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon, label, color, onClick }) {
  return (
    <div className={styles.actionBtnWrapper}>
      <button className={styles.actionBtn} style={{ color: color }} onClick={onClick}>
        {icon}
      </button>
      <span className={styles.actionTooltip}>{label}</span>
    </div>
  );
}

function KPICard({ icon, label, value, subText, color, bgColor }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIconBox} style={{ backgroundColor: bgColor, color: color }}>
        {icon}
      </div>
      <div className={styles.kpiContent}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>{value}</span>
        <span className={styles.kpiSub}>{subText}</span>
      </div>
    </div>
  );
}
