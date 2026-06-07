import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, User, DollarSign, Calendar, Clock, CheckCircle, 
  AlertCircle, CreditCard, Wallet, FileText, Send, Printer,
  ChevronRight, ArrowRight, History, Trash2, Download, X,
  Filter, MoreVertical, Plus, Info, Eye, ArrowUpRight, TrendingUp,
  Share2, MessageSquare, FileDown, Layers, ArrowLeft, Landmark, Check
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID } from '../constants';
import { t } from '../utils/translations';
import CurrencySymbol from '../components/CurrencySymbol';
import { getLocalISOString, getLocalDateTime } from '../utils/dateUtils';
import styles from './Settlement.module.css';

export default function Settlement() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const initialCustomerId = queryParams.get('customerId');
  
  const { settings, formatDate } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Outstanding'); // All | Outstanding | Advance | Paid
  const [workspaceTab, setWorkspaceTab] = useState('pending'); // pending | history
  const [loading, setLoading] = useState(false);
  const [globalData, setGlobalData] = useState({ pending: [], history: [], advances: [] });
  const [kpis, setKpis] = useState({
    outstanding: 0,
    settlements: 0,
    pendingCount: 0,
    overdueCount: 0,
    advanceCredits: 0
  });

  // Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [selectedBank, setSelectedBank] = useState('');

  useEffect(() => {
    if (settings.bankAccounts && settings.bankAccounts.length > 0 && !selectedBank) {
      const defaultBank = settings.bankAccounts.find(acc => acc.id === settings.defaultBankId) || settings.bankAccounts[0];
      setSelectedBank(defaultBank.bankName);
    }
  }, [settings.bankAccounts, settings.defaultBankId, selectedBank]);

  // 1. Initial Load of Customer from query params
  useEffect(() => {
    if (initialCustomerId && window.electronAPI?.dbQuery) {
      const loadInitialCustomer = async () => {
        const res = await window.electronAPI.dbQuery(
          'SELECT * FROM customers WHERE id = ?',
          [initialCustomerId]
        );
        if (res.success && res.data.length > 0) {
          setSelectedCustomer(res.data[0]);
        }
      };
      loadInitialCustomer();
    }
  }, [initialCustomerId]);

  // 2. Fetch customers and global dashboard data
  useEffect(() => {
    fetchCustomers();
    if (!selectedCustomer) {
      fetchGlobalData();
    }
  }, [searchTerm, activeTab, selectedCustomer]);

  // 3. Fetch specific customer data when selected
  useEffect(() => {
    if (selectedCustomer) {
      if (window.electronAPI?.runDataHealer) {
        window.electronAPI.runDataHealer()
          .catch(err => console.error("Data healer failed on customer select:", err))
          .finally(() => {
            fetchCustomerSpecificData(selectedCustomer);
          });
      } else {
        fetchCustomerSpecificData(selectedCustomer);
      }
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
        
        query += ' ORDER BY balance DESC, name ASC';
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
          "SELECT orders.*, customers.name as customerName, customers.phone as customerPhone, customers.balance as customerBalance FROM orders LEFT JOIN customers ON orders.customerId = customers.id WHERE orders.id IS NOT NULL AND orders.id != '' AND orders.dueAmount > 0 AND orders.status != 'Cancelled' ORDER BY orders.createdAt DESC LIMIT 8",
          []
        );
        const historyRes = await window.electronAPI.dbQuery(
          'SELECT payments.*, customers.name as customerName FROM payments LEFT JOIN customers ON payments.customerId = customers.id ORDER BY payments.createdAt DESC LIMIT 8',
          []
        );
        const advancesRes = await window.electronAPI.dbQuery(
          'SELECT * FROM customers WHERE balance < 0 ORDER BY balance ASC LIMIT 8',
          []
        );

        setGlobalData({
          pending: pendingRes.success ? pendingRes.data : [],
          history: historyRes.success ? historyRes.data : [],
          advances: advancesRes.success ? advancesRes.data : []
        });

        const outstandingSum = await window.electronAPI.dbQuery('SELECT SUM(balance) as total FROM customers WHERE balance > 0', []);
        const advanceSum = await window.electronAPI.dbQuery('SELECT SUM(ABS(balance)) as total FROM customers WHERE balance < 0', []);
        const pendingCount = await window.electronAPI.dbQuery("SELECT COUNT(*) as count FROM orders WHERE id IS NOT NULL AND id != '' AND dueAmount > 0 AND status != 'Cancelled'", []);
        const settlementsRes = await window.electronAPI.dbQuery("SELECT SUM(amount) as total FROM payments WHERE strftime('%m', createdAt) = strftime('%m', 'now')", []);
        const overdueDays = settings?.overdueDays || 7;
        const overdueRes = await window.electronAPI.dbQuery(
          "SELECT COUNT(*) as count FROM orders WHERE id IS NOT NULL AND id != '' AND dueAmount > 0 AND status != 'Cancelled' AND createdAt < date('now', ?)",
          [`-${overdueDays} days`]
        );

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
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND dueAmount > 0 AND status != 'Cancelled' ORDER BY createdAt DESC",
          [customerId]
        );
        const historyRes = await window.electronAPI.dbQuery(
          'SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt DESC',
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

    const timestamp = getLocalISOString();
    
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        let remaining = amount;
        
        // Fetch fresh pending bills
        const billsRes = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND dueAmount > 0 AND status != 'Cancelled' ORDER BY createdAt ASC",
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

            // Update workflow status to 'Confirmed' when fully paid
            const newWorkflowStatus = newDue <= 0 ? 'Confirmed' : bill.status;
            await window.electronAPI.dbQuery(
              'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?',
              [newPaid, newDue, newStatus, newWorkflowStatus, paymentMethod, timestamp, bill.id]
            );

            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
              [`PAY-${Date.now()}-${bill.id}`, selectedCustomer.id, bill.id, DEFAULT_SHOP_ID, allocate, paymentMethod, 'SUCCESS', timestamp, timestamp]
            );
          }
        }

        // If there's remaining unapplied payment (excess / advance payment)
        if (remaining > 0) {
          await window.electronAPI.dbQuery(
            `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [`PAY-ADV-${Date.now()}`, selectedCustomer.id, null, DEFAULT_SHOP_ID, remaining, paymentMethod, 'SUCCESS', timestamp, timestamp]
          );
        }

        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?',
          [amount, timestamp, selectedCustomer.id]
        );

        // 3. Record Transaction in Accounts
        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = getLocalDateTime();
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            txnId,
            DEFAULT_SHOP_ID,
            paymentMethod,
            'INCOME',
            'Credit Settlement',
            amount,
            `Settlement from ${selectedCustomer.name}${paymentMethod === 'BANK' && selectedBank ? ` via ${selectedBank}` : ''}`,
            txnTimestamp,
            timestamp,
            'DollarSign',
            paymentMethod === 'BANK' ? selectedBank : null
          ]
        );

        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }

        alert("Settlement completed successfully!");
        setPaymentAmount('');
        setShowPayModal(false);
        
        // Refresh customer state
        const updatedCust = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE id = ?', [selectedCustomer.id]);
        const refreshedCustomer = (updatedCust.success && updatedCust.data && updatedCust.data.length > 0) ? updatedCust.data[0] : selectedCustomer;
        if (updatedCust.success) setSelectedCustomer(refreshedCustomer);
        fetchCustomerSpecificData(refreshedCustomer);
        
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

  const displayDue = selectedCustomer ? Math.max(0, Number(selectedCustomer.balance) || 0) : 0;
  const currentNetBalance = selectedCustomer ? (Number(selectedCustomer.balance) || 0) : 0;
  const simulatedNewBalance = currentNetBalance - (parseFloat(paymentAmount) || 0);

  return (
    <div className={styles.settlementContainer}>
      
      {/* ── LEFT SIDEBAR: CUSTOMER SELECTION ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Credit Ledger</h2>
          <p>Manage customer accounts & settlements</p>
        </div>

        <div className={styles.searchContainer}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.sidebarSearch}
          />
        </div>

        <div className={styles.sidebarTabs}>
          {[
            { id: 'All', label: 'All' },
            { id: 'Outstanding', label: 'Dues' },
            { id: 'Advance', label: 'Advances' }
          ].map(tab => (
            <button 
              key={tab.id} 
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTabBtn : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.customerList}>
          {customers.map((customer, idx) => {
            const isSelected = selectedCustomer?.id === customer.id;
            const initials = customer.name 
              ? customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
              : '??';
            
            return (
              <div 
                key={customer.id} 
                className={`${styles.customerCard} ${isSelected ? styles.selectedCustomerCard : ''}`}
                onClick={() => setSelectedCustomer(customer)}
              >
                <div className={styles.custCardLeft}>
                  <div className={`${styles.avatarCircle} ${styles[`avatarColor${idx % 5}`]}`}>
                    {initials}
                  </div>
                  <div className={styles.custCardInfo}>
                    <span className={styles.custCardName}>{customer.name}</span>
                    <span className={styles.custCardPhone}>{customer.phone}</span>
                  </div>
                </div>
                <div className={styles.custCardRight}>
                  <span className={styles.custCardBalance}>
                    <CurrencySymbol size={11} /> {Math.abs(Number(customer.balance) || 0).toFixed(2)}
                  </span>
                  <span className={`${styles.statusBadge} ${
                    (Number(customer.balance) || 0) > 0 
                      ? styles.badgeDue 
                      : (Number(customer.balance) || 0) < 0 
                        ? styles.badgeAdv 
                        : styles.badgeSettled
                  }`}>
                    {(Number(customer.balance) || 0) > 0 ? 'Due' : (Number(customer.balance) || 0) < 0 ? 'Adv' : 'Settled'}
                  </span>
                </div>
              </div>
            );
          })}
          {customers.length === 0 && (
            <div className={styles.noCustomers}>No customers found.</div>
          )}
        </div>
      </aside>

      {/* ── RIGHT MAIN PANEL ── */}
      <main className={styles.mainPanel}>
        
        {/* If customer is NOT selected: Dashboard View */}
        {!selectedCustomer ? (
          <div className={styles.dashboardView}>
            <div className={styles.dashboardHeader}>
              <h1>Credit Settlements Dashboard</h1>
              <p>Global financial health, collections & credit accounts</p>
            </div>

            {/* Gradient KPI Cards */}
            <div className={styles.kpiGrid}>
              <div className={`${styles.kpiCardItem} ${styles.kpiReceivables}`}>
                <div className={styles.kpiIconWrapper}><AlertCircle size={24} /></div>
                <div className={styles.kpiItemContent}>
                  <span className={styles.kpiItemLabel}>Total Receivables</span>
                  <span className={styles.kpiItemValue}><CurrencySymbol size={18} /> {Number(kpis.outstanding || 0).toFixed(2)}</span>
                  <span className={styles.kpiItemSub}>{kpis.pendingCount || 0} pending collections</span>
                </div>
              </div>

              <div className={`${styles.kpiCardItem} ${styles.kpiAdvances}`}>
                <div className={styles.kpiIconWrapper}><Wallet size={24} /></div>
                <div className={styles.kpiItemContent}>
                  <span className={styles.kpiItemLabel}>Customer Advances</span>
                  <span className={styles.kpiItemValue}><CurrencySymbol size={18} /> {Number(kpis.advanceCredits || 0).toFixed(2)}</span>
                  <span className={styles.kpiItemSub}>Prepaid deposits</span>
                </div>
              </div>

              <div className={`${styles.kpiCardItem} ${styles.kpiSettled}`}>
                <div className={styles.kpiIconWrapper}><CheckCircle size={24} /></div>
                <div className={styles.kpiItemContent}>
                  <span className={styles.kpiItemLabel}>Monthly Collections</span>
                  <span className={styles.kpiItemValue}><CurrencySymbol size={18} /> {Number(kpis.settlements || 0).toFixed(2)}</span>
                  <span className={styles.kpiItemSub}>Collected this month</span>
                </div>
              </div>
            </div>

            {/* Urgent Collections & Overdue Table */}
            <div className={styles.overviewSection}>
              <div className={styles.sectionHeader}>
                <h3>Urgent Pending Collections</h3>
                <span className={styles.overdueDaysBadge}>{t('overdue', settings.language)} ({settings?.overdueDays || 7}+ Days)</span>
              </div>

              <div className={styles.collectionsTableCard}>
                <table className={styles.collectionsTable}>
                  <thead>
                    <tr>
                      <th>Bill ID</th>
                      <th>Customer Name</th>
                      <th>Invoice Date</th>
                      <th>Outstanding Dues</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalData.pending.slice(0, 6).map(bill => (
                      <tr key={bill.id} onClick={() => setSelectedCustomer({
                        id: bill.customerId,
                        name: bill.customerName || 'Unknown Customer',
                        phone: bill.customerPhone || 'N/A',
                        balance: Number(bill.customerBalance || 0)
                      })} className={styles.tableRowClickable}>
                        <td className={styles.billIdText}>{bill.id}</td>
                        <td>
                          <div className={styles.tableNameCell}>
                            <span className={styles.custNameBold}>{bill.customerName || 'Unknown Customer'}</span>
                            <span className={styles.custPhoneSub}>{bill.customerPhone || 'N/A'}</span>
                          </div>
                        </td>
                        <td>{bill.createdAt ? formatDate(bill.createdAt) : 'N/A'}</td>
                        <td className={styles.redAmountText}><CurrencySymbol size={11} /> {Number(bill.dueAmount || 0).toFixed(2)}</td>
                        <td>
                          <span className={`${styles.pillBadge} ${styles.pillBadgeRed}`}>Unpaid</span>
                        </td>
                        <td>
                          <button 
                            className={styles.quickPayActionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCustomer({
                                id: bill.customerId,
                                name: bill.customerName || 'Unknown Customer',
                                phone: bill.customerPhone || 'N/A',
                                balance: Number(bill.customerBalance || 0)
                              });
                              const balance = Number(bill.customerBalance || 0);
                              const due = Number(bill.dueAmount || 0);
                              const defaultAmount = balance > 0 ? Math.min(due, balance) : due;
                              setPaymentAmount(defaultAmount.toFixed(2));
                              setShowPayModal(true);
                            }}
                          >
                            Settle
                          </button>
                        </td>
                      </tr>
                    ))}
                    {globalData.pending.length === 0 && (
                      <tr>
                        <td colSpan="6" className={styles.emptyTableText}>
                          No pending bills found. All outstanding invoices are settled!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* If customer IS selected: Focused Workspace View */
          <div className={styles.workspaceView}>
            
            {/* Workspace Hero Profile Header */}
            <div className={styles.workspaceHeader}>
              <div className={styles.profileRow}>
                <button 
                  className={styles.profileBackBtn} 
                  onClick={() => setSelectedCustomer(null)}
                  title="Close and return to dashboard"
                >
                  <ArrowLeft size={16} /> Dashboard
                </button>
                <div className={styles.profileMainInfo}>
                  <div className={styles.profileAvatar}>
                    {(selectedCustomer.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2>{selectedCustomer.name || 'Unknown Customer'}</h2>
                    <p>{selectedCustomer.phone || 'No Phone'} {selectedCustomer.address ? `• ${selectedCustomer.address}` : ''}</p>
                  </div>
                </div>
              </div>
              
              <div className={styles.headerButtons}>
                <button 
                  className={styles.btnSecondary} 
                  onClick={() => navigate(`/overdue-statement/${selectedCustomer.id}`)}
                >
                  <Printer size={16} /> Print {t('overdue', settings.language)} Statement
                </button>
                <button 
                  className={styles.btnSecondary} 
                  onClick={() => navigate(`/reports/customer-statement/${selectedCustomer.id}`)}
                >
                  <FileText size={16} /> Full Statement
                </button>
              </div>
            </div>

            {/* Dynamic Balance Card */}
            <div className={`${styles.balanceHeroCard} ${
              (Number(currentNetBalance) || 0) > 0 
                ? styles.balanceDueCard 
                : (Number(currentNetBalance) || 0) < 0 
                  ? styles.balanceAdvCard 
                  : styles.balanceSettledCard
            }`}>
              <div className={styles.balanceCardContent}>
                <span className={styles.balanceSubtitle}>
                  {(Number(currentNetBalance) || 0) > 0 
                    ? 'OUTSTANDING DEBT' 
                    : (Number(currentNetBalance) || 0) < 0 
                      ? 'PREPAID ACCOUNT ADVANCE' 
                      : 'ACCOUNT FULLY SETTLED'}
                </span>
                <h1 className={styles.balanceBigAmount}>
                  <CurrencySymbol size={32} /> {Math.abs(Number(currentNetBalance) || 0).toFixed(2)}
                </h1>
                <p className={styles.balanceStatusText}>
                  {(Number(currentNetBalance) || 0) > 0 
                    ? `This customer owes the shop ${Math.abs(Number(currentNetBalance) || 0).toFixed(2)}. Please record a payment to settle.`
                    : (Number(currentNetBalance) || 0) < 0 
                      ? `The customer has a credit balance of ${Math.abs(Number(currentNetBalance) || 0).toFixed(2)} available for future orders.`
                      : 'All credit bills and payments for this customer are fully balanced.'}
                </p>
              </div>

              <div className={styles.balanceCardActions}>
                {(Number(currentNetBalance) || 0) > 0 ? (
                  <button 
                    className={`${styles.actionButton} ${styles.actionBtnSettle}`}
                    onClick={() => {
                      setPaymentAmount((Number(currentNetBalance) || 0).toFixed(2));
                      setShowPayModal(true);
                    }}
                  >
                    <DollarSign size={18} /> Settle Outstanding Dues
                  </button>
                ) : (
                  <button 
                    className={`${styles.actionButton} ${styles.actionBtnAdvance}`}
                    onClick={() => {
                      setPaymentAmount('');
                      setShowPayModal(true);
                    }}
                  >
                    <Plus size={18} /> Record Advance Deposit
                  </button>
                )}
                {(Number(currentNetBalance) || 0) > 0 && (
                  <button 
                    className={`${styles.actionButton} ${styles.actionBtnPrepay}`}
                    onClick={() => {
                      setPaymentAmount('');
                      setShowPayModal(true);
                    }}
                  >
                    <Plus size={16} /> Add Extra Advance
                  </button>
                )}
              </div>
            </div>

            {/* Workspace tabs for Pending Bills vs Settlement History */}
            <div className={styles.workspaceTabsCard}>
              <div className={styles.workspaceTabsHeader}>
                <div className={styles.tabsRow}>
                  <button 
                    className={`${styles.tabBtnItem} ${workspaceTab === 'pending' ? styles.activeTabBtnItem : ''}`}
                    onClick={() => setWorkspaceTab('pending')}
                  >
                    Pending Invoices ({globalData.pending.length})
                  </button>
                  <button 
                    className={`${styles.tabBtnItem} ${workspaceTab === 'history' ? styles.activeTabBtnItem : ''}`}
                    onClick={() => setWorkspaceTab('history')}
                  >
                    Settlement History ({globalData.history.length})
                  </button>
                </div>
              </div>

              <div className={styles.workspaceTabContent}>
                {workspaceTab === 'pending' ? (
                  <div className={styles.tableWrapper}>
                    <table className={styles.ledgerDetailsTable}>
                      <thead>
                        <tr>
                          <th>Bill Number</th>
                          <th>Invoice Date</th>
                          <th>Total Amount</th>
                          <th>Paid Amount</th>
                          <th>Remaining Due</th>
                          <th>Status</th>
                          <th>Quick Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalData.pending.map(bill => {
                          const invoiceDate = formatDate(bill.createdAt);
                          
                          return (
                            <tr key={bill.id}>
                              <td className={styles.billIdText}>{bill.id}</td>
                              <td>{invoiceDate}</td>
                              <td><CurrencySymbol size={10} /> {Number(bill.totalAmount || 0).toFixed(2)}</td>
                              <td className={styles.greenText}><CurrencySymbol size={10} /> {Number(bill.paidAmount || 0).toFixed(2)}</td>
                              <td className={styles.redAmountText}><CurrencySymbol size={10} /> {Number(bill.dueAmount || 0).toFixed(2)}</td>
                              <td>
                                <span className={`${styles.pillBadge} ${
                                  bill.paymentStatus === 'Partial' ? styles.pillBadgePartial : styles.pillBadgeRed
                                }`}>
                                  {bill.paymentStatus}
                                </span>
                              </td>
                              <td>
                                <button 
                                  className={styles.invoiceQuickPayBtn}
                                  onClick={() => {
                                    const due = Number(bill.dueAmount || 0);
                                    const defaultAmount = currentNetBalance > 0 ? Math.min(due, currentNetBalance) : due;
                                    setPaymentAmount(defaultAmount.toFixed(2));
                                    setShowPayModal(true);
                                  }}
                                >
                                  Settle Bill
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {globalData.pending.length === 0 && (
                          <tr>
                            <td colSpan="7">
                              <div className={styles.workspaceAllSettled}>
                                <CheckCircle size={48} className={styles.checkSuccessIcon} />
                                <h3>All Invoices Settled</h3>
                                <p>This customer does not have any pending credit bills.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.ledgerDetailsTable}>
                      <thead>
                        <tr>
                          <th>Receipt ID</th>
                          <th>Linked Invoice</th>
                          <th>Payment Date</th>
                          <th>Method</th>
                          <th>Amount Settled</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalData.history.map(pay => {
                          const payDate = formatDate(pay.createdAt);
                          
                          return (
                            <tr key={pay.id}>
                              <td className={styles.receiptIdText}>{(pay.id || '').split('-')[0] + '-' + ((pay.id || '').split('-')[1] || '')}</td>
                              <td className={styles.boldText}>{pay.orderId ? pay.orderId : <span className={styles.advanceLabel}>Unlinked (Advance)</span>}</td>
                              <td>{payDate}</td>
                              <td className={styles.boldText}>{pay.method}</td>
                              <td className={styles.greenText}><CurrencySymbol size={10} /> {Number(pay.amount || 0).toFixed(2)}</td>
                              <td>
                                <span className={`${styles.pillBadge} ${styles.pillBadgeGreen}`}>SUCCESS</span>
                              </td>
                            </tr>
                          );
                        })}
                        {globalData.history.length === 0 && (
                          <tr>
                            <td colSpan="6">
                              <div className={styles.workspaceAllSettled}>
                                <History size={40} style={{ color: '#94a3b8', marginBottom: '0.75rem' }} />
                                <h3>No Settlement History</h3>
                                <p>No payment or settlement records found for this customer.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── REDESIGNED PAYMENT MODAL ── */}
      {showPayModal && selectedCustomer && (
        <div className={styles.modalOverlay}>
          <div className={styles.payModalCard}>
            
            <div className={styles.modalHeaderRow}>
              <div>
                <h3>Record Settlement / Payment</h3>
                <p>{selectedCustomer.name || 'Unknown Customer'} • {selectedCustomer.phone || 'N/A'}</p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setShowPayModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBodyContent}>
              
              {/* Large Payment Input */}
              <div className={styles.modalInputGroup}>
                <label>Received Amount</label>
                <div className={styles.largeInputBox}>
                  <span className={styles.inputCurrency}><CurrencySymbol size={22} /></span>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                
                {/* Quick Presets */}
                <div className={styles.presetsRow}>
                  <button onClick={() => setPaymentAmount(Number(displayDue || 0).toFixed(2))} disabled={displayDue <= 0}>
                    Full Dues ({Number(displayDue || 0).toFixed(2)})
                  </button>
                  <button onClick={() => setPaymentAmount((Number(displayDue || 0) / 2).toFixed(2))} disabled={displayDue <= 0}>
                    50% Dues ({(Number(displayDue || 0) / 2).toFixed(2)})
                  </button>
                  <button onClick={() => setPaymentAmount('')} className={styles.presetClear}>
                    Clear
                  </button>
                </div>
              </div>

              {/* Payment Method Cards */}
              <div className={styles.modalInputGroup}>
                <label>Payment Method</label>
                <div className={styles.methodCardsGrid}>
                  {[
                    { id: 'CASH', label: 'Cash', icon: <Wallet size={20} /> },
                    { id: 'BANK', label: 'Bank Transfer', icon: <Landmark size={20} /> },
                    { id: 'UPI', label: 'Digital / UPI', icon: <CreditCard size={20} /> }
                  ].map(method => {
                    const isSelected = paymentMethod === method.id;
                    
                    return (
                      <div 
                        key={method.id} 
                        className={`${styles.methodCardItem} ${isSelected ? styles.activeMethodCard : ''}`}
                        onClick={() => setPaymentMethod(method.id)}
                      >
                        <div className={styles.methodCardIcon}>{method.icon}</div>
                        <span>{method.label}</span>
                        {isSelected && <div className={styles.methodCheck}><Check size={10} /></div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {paymentMethod === 'BANK' && settings.bankAccounts?.length > 0 && (
                <div className={styles.modalInputGroup} style={{ marginTop: '0.5rem' }}>
                  <label>Select Bank Account</label>
                  <div className={styles.largeInputBox} style={{ padding: '0.5rem 1rem' }}>
                    <Landmark size={18} color="#2563EB" />
                    <select
                      style={{ border: 'none', width: '100%', outline: 'none', background: 'transparent', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                    >
                      {settings.bankAccounts.map((acc, idx) => (
                        <option key={idx} value={acc.bankName}>{acc.bankName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Live Preview Summary Box */}
              <div className={styles.liveSummaryBox}>
                <div className={styles.summaryRowItem}>
                  <span>Current Balance</span>
                  <span className={(Number(currentNetBalance) || 0) > 0 ? styles.outstandingText : (Number(currentNetBalance) || 0) < 0 ? styles.advanceText : ''}>
                    {(Number(currentNetBalance) || 0) > 0 ? 'Due ' : (Number(currentNetBalance) || 0) < 0 ? 'Adv ' : ''}
                    <CurrencySymbol size={11} /> {Math.abs(Number(currentNetBalance) || 0).toFixed(2)}
                  </span>
                </div>
                
                <div className={styles.summaryRowItem}>
                  <span>Payment Amount</span>
                  <span className={styles.paymentAddedText}>
                    + <CurrencySymbol size={11} /> {(parseFloat(paymentAmount) || 0).toFixed(2)}
                  </span>
                </div>

                <div className={styles.summaryDividerLine}></div>

                <div className={styles.summaryRowTotal}>
                  <span>
                    {(Number(simulatedNewBalance) || 0) > 0 
                      ? 'New Outstanding Balance' 
                      : (Number(simulatedNewBalance) || 0) < 0 
                        ? 'New Prepaid Advance' 
                        : 'Account Balance'}
                  </span>
                  <span className={`${styles.totalResultText} ${
                    (Number(simulatedNewBalance) || 0) > 0 
                      ? styles.outstandingText 
                      : (Number(simulatedNewBalance) || 0) < 0 
                        ? styles.advanceText 
                        : styles.settledText
                  }`}>
                    {(Number(simulatedNewBalance) || 0) === 0 ? 'Fully Settled' : (
                      <>
                        <CurrencySymbol size={13} /> {Math.abs(Number(simulatedNewBalance) || 0).toFixed(2)}
                      </>
                    )}
                  </span>
                </div>
              </div>

            </div>

            <div className={styles.modalFooterActions}>
              <button className={styles.btnSecondary} onClick={() => setShowPayModal(false)}>
                Cancel
              </button>
              <button 
                className={styles.btnConfirmSettle}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || loading}
                onClick={handleSettle}
              >
                {loading ? 'Processing Settle...' : 'Confirm Payment Settlement'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
