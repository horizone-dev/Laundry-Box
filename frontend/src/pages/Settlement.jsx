import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Search, User, DollarSign, Calendar, Clock, CheckCircle, 
  AlertCircle, CreditCard, Wallet, FileText, Send, Printer,
  ChevronRight, ArrowRight, History, Trash2, Download
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Settlement.module.css';

export default function Settlement() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialCustomerId = queryParams.get('customerId');
  const initialAmount = queryParams.get('amount');
  
  const { settings } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [pendingBills, setPendingBills] = useState([]);
  const [settlementHistory, setSettlementHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialCustomerId) {
      fetchSpecificCustomer(initialCustomerId);
    }
  }, [initialCustomerId]);

  const fetchSpecificCustomer = async (id) => {
    if (window.electronAPI?.dbQuery) {
      try {
        const res = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE id = ?', [id]);
        if (res.success && res.data.length > 0) {
          setSelectedCustomer(res.data[0]);
        }
      } catch (err) {
        console.error("Fetch specific customer failed:", err);
      }
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm]);



  useEffect(() => {
    if (initialAmount && !paymentAmount) {
      setPaymentAmount(initialAmount);
    }
  }, [initialAmount]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerDetails(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const fetchCustomers = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        let query = 'SELECT * FROM customers';
        let params = [];
        
        if (searchTerm) {
          query += ' WHERE (name LIKE ? OR phone LIKE ?)';
          const term = `%${searchTerm}%`;
          params = [term, term];
        } else {
          query += ' WHERE balance > 0';
        }
        
        query += ' ORDER BY balance DESC, name ASC LIMIT 50';
        const res = await window.electronAPI.dbQuery(query, params);
        if (res.success) setCustomers(res.data);
      } catch (err) {
        console.error("Fetch customers failed:", err);
      }
    }
  };

  const fetchCustomerDetails = async (customerId) => {
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        // 1. Fetch Pending Bills
        const billsRes = await window.electronAPI.dbQuery(
          'SELECT * FROM orders WHERE customerId = ? AND (dueAmount > 0 OR paymentStatus != "Paid") ORDER BY createdAt ASC',
          [customerId]
        );
        if (billsRes.success) setPendingBills(billsRes.data);

        // 2. Fetch Settlement History
        const historyRes = await window.electronAPI.dbQuery(
          'SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt DESC LIMIT 10',
          [customerId]
        );
        if (historyRes.success) setSettlementHistory(historyRes.data);
      } catch (err) {
        console.error("Fetch details failed:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSettle = async () => {
    const amount = parseFloat(paymentAmount);
    if (!selectedCustomer || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid payment amount greater than zero.");
      return;
    }

    const timestamp = new Date().toISOString();
    
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        let remaining = amount;
        console.log(`Processing settlement of ${amount} for customer ${selectedCustomer.name}`);
        
        // FIFO Logic
        if (pendingBills.length === 0) {
           // If no pending bills but there is a balance, we still update the balance
           console.log("No pending bills found, updating general balance.");
        } else {
          for (const bill of pendingBills) {
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

            // Update Bill
            await window.electronAPI.dbQuery(
              'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, updatedAt = ? WHERE id = ?',
              [newPaid, newDue, newStatus, timestamp, bill.id]
            );

            // Record Payment
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [`PAY-${Date.now()}-${bill.id}`, selectedCustomer.id, bill.id, 'SHOP_01', allocate, paymentMethod, 'SUCCESS', timestamp]
            );
          }
        }

        // Update Customer Balance
        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, updatedAt = ? WHERE id = ?',
          [amount, timestamp, selectedCustomer.id]
        );

        // Record Transaction
        const txnId = `TXN-${Date.now()}`;
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions (id, shopId, accountType, type, category, amount, description, date, updatedAt, icon) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txnId, 'SHOP_01', paymentMethod, 'INCOME', 'Credit Settlement', amount, `Credit settlement from ${selectedCustomer.name}`, timestamp.replace('T', ' ').slice(0, 16), timestamp, 'Wallet']
        );

        alert("Settlement completed successfully!");
        setPaymentAmount('');
        setNotes('');
        await fetchCustomerDetails(selectedCustomer.id);
        await fetchCustomers();
      } catch (err) {
        console.error("Settlement failed:", err);
        alert("Settlement failed: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const totalDue = pendingBills.reduce((sum, b) => sum + (b.dueAmount || (b.totalAmount - (b.paidAmount || 0))), 0);
  const remainingDue = Math.max(0, totalDue - (parseFloat(paymentAmount) || 0));
  const excessPayment = Math.max(0, (parseFloat(paymentAmount) || 0) - totalDue);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Credit Settlement</h1>
          <p>Process pending bills and manage customer credit balances.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.receiptBtn}><History size={18} /> Full History</button>
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* Left Col: Customer Selection & Payment */}
        <div className={styles.leftCol}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <User size={20} />
              <h3>Customer Selection</h3>
            </div>
            <div className={styles.searchRow}>
              <div className={styles.searchBox}>
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Enter name or phone..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchCustomers()}
                />
              </div>
              <button className={styles.searchBtn} onClick={fetchCustomers}>
                Search
              </button>
            </div>
            <div className={styles.customerList}>
              {customers.map(c => (
                <div 
                  key={c.id} 
                  className={`${styles.customerItem} ${selectedCustomer?.id === c.id ? styles.selected : ''}`}
                  onClick={() => setSelectedCustomer(c)}
                >
                  <div className={styles.custInfo}>
                    <span className={styles.custName}>{c.name}</span>
                    <span className={styles.custPhone}>{c.phone}</span>
                  </div>
                  <div className={styles.custBalance}>
                    <CurrencySymbol size={14} /> {c.balance.toFixed(2)}
                  </div>
                </div>
              ))}
              {customers.length === 0 && <div className={styles.noData}>No customers with balance found.</div>}
            </div>
          </div>

          {selectedCustomer && (
            <div className={styles.card} style={{ marginTop: '1.5rem' }}>
              <div className={styles.cardHeader}>
                <Wallet size={20} />
                <h3>Process Payment</h3>
              </div>
              <div className={styles.paymentForm}>
                <div className={styles.formGroup}>
                  <label>Received Amount</label>
                  <div className={styles.inputWrapper}>
                    <CurrencySymbol size={18} />
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Payment Method</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="UPI">UPI / Digital</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Date</label>
                    <input type="text" value={new Date().toLocaleDateString()} disabled />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Notes (Optional)</label>
                  <textarea 
                    placeholder="Reference number, check details etc." 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className={styles.calculationBox}>
                  <div className={styles.calcRow}>
                    <span>Total Due</span>
                    <strong><CurrencySymbol size={14} /> {totalDue.toFixed(2)}</strong>
                  </div>
                  <div className={styles.calcRow}>
                    <span>Amount Received</span>
                    <span style={{ color: '#10B981' }}>+ <CurrencySymbol size={14} /> {(parseFloat(paymentAmount) || 0).toFixed(2)}</span>
                  </div>
                  <div className={styles.divider}></div>
                  <div className={styles.calcRow}>
                    <span>Remaining Balance</span>
                    <strong style={{ color: remainingDue > 0 ? '#EF4444' : '#10B981' }}>
                      <CurrencySymbol size={14} /> {remainingDue.toFixed(2)}
                    </strong>
                  </div>
                  {excessPayment > 0 && (
                    <div className={styles.calcRow} style={{ marginTop: '0.5rem' }}>
                      <span>Excess Payment</span>
                      <strong style={{ color: '#3B82F6' }}><CurrencySymbol size={14} /> {excessPayment.toFixed(2)}</strong>
                    </div>
                  )}
                </div>

                <button 
                  className={styles.settleBtn} 
                  onClick={handleSettle}
                  disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                >
                  Confirm Settlement <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Bill Details & History */}
        <div className={styles.rightCol}>
          {!selectedCustomer ? (
            <div className={styles.emptyState}>
              <User size={64} opacity={0.1} />
              <h3>Select a Customer</h3>
              <p>Please select a customer from the left to view their pending bills and payment history.</p>
            </div>
          ) : (
            <>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <FileText size={20} />
                  <h3>Pending Bills</h3>
                </div>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Bill ID</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingBills.map(bill => (
                        <tr key={bill.id}>
                          <td style={{ fontWeight: 700 }}>{bill.id}</td>
                          <td>{new Date(bill.createdAt).toLocaleDateString()}</td>
                          <td><CurrencySymbol size={13} /> {bill.totalAmount.toFixed(2)}</td>
                          <td><CurrencySymbol size={13} /> {(bill.paidAmount || 0).toFixed(2)}</td>
                          <td style={{ color: '#EF4444', fontWeight: 600 }}>
                            <CurrencySymbol size={13} /> {(bill.dueAmount || (bill.totalAmount - (bill.paidAmount || 0))).toFixed(2)}
                          </td>
                          <td>
                            <span className={`${styles.statusBadge} ${bill.paymentStatus === 'Partial' ? styles.partial : styles.credit}`}>
                              {bill.paymentStatus || 'Credit'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {pendingBills.length === 0 && (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No pending bills for this customer.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={styles.card} style={{ marginTop: '1.5rem' }}>
                <div className={styles.cardHeader}>
                  <History size={20} />
                  <h3>Recent Settlements</h3>
                </div>
                <div className={styles.historyList}>
                  {settlementHistory.map(h => (
                    <div key={h.id} className={styles.historyItem}>
                      <div className={styles.historyInfo}>
                        <div className={styles.historyIcon}><DollarSign size={16} /></div>
                        <div>
                          <span className={styles.historyDate}>{new Date(h.createdAt).toLocaleString()}</span>
                          <span className={styles.historyMethod}>{h.method} Payment</span>
                        </div>
                      </div>
                      <div className={styles.historyAmount}>
                        <strong><CurrencySymbol size={14} /> {h.amount.toFixed(2)}</strong>
                        <div className={styles.historyActions}>
                          <Printer size={14} title="Print Receipt" />
                          <Send size={14} title="Send via WhatsApp" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {settlementHistory.length === 0 && <div className={styles.noData}>No payment history found.</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
