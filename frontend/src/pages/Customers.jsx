import React, { useState, useEffect } from 'react';
import { 
  Search, UserPlus, Download, Calendar, MoreHorizontal, 
  TrendingUp, Star, Clock, ChevronLeft, ChevronRight, X, Mail, Phone, MapPin, MessageCircle, CreditCard, Wallet, DollarSign, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID } from '../constants';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Customers.module.css';

export default function Customers() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBillsModal, setShowBillsModal] = useState(false);
  const [showQuickSettleModal, setShowQuickSettleModal] = useState(false);
  const [quickSettleSearch, setQuickSettleSearch] = useState('');
  const [customerBills, setCustomerBills] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentData, setPaymentData] = useState({ amount: '', method: 'CASH' });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    creditLimit: '0'
  });

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm]);

  const fetchCustomers = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        let query = 'SELECT * FROM customers';
        let params = [];
        
        if (searchTerm) {
          query += ' WHERE name LIKE ? OR phone LIKE ? OR id LIKE ? OR email LIKE ?';
          const param = `%${searchTerm}%`;
          params = [param, param, param, param];
        }
        
        query += ' ORDER BY updatedAt DESC';
        
        const result = await window.electronAPI.dbQuery(query, params);
        if (result.success) {
          setCustomers(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setCustomers([]);
      setLoading(false);
    }
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    const id = `CUST-${Date.now()}`;
    const timestamp = new Date().toISOString();

    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery(
          'INSERT INTO customers (id, shopId, name, phone, email, address, creditLimit, isSynced, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, DEFAULT_SHOP_ID, formData.name, formData.phone, formData.email, formData.address, parseFloat(formData.creditLimit) || 0, 0, timestamp]
        );
        fetchCustomers();
        setShowModal(false);
        setFormData({ name: '', email: '', phone: '', address: '' });
      } catch (err) {
        console.error("Failed to save customer:", err);
      }
    } else {
      // Web demo
      setCustomers([{ ...formData, id, orders: 0, lastDate: 'Just now', tag: 'New' }, ...customers]);
      setShowModal(false);
      setFormData({ name: '', email: '', phone: '', address: '' });
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentData.amount) return;

    if (window.electronAPI?.dbQuery) {
      try {
        let remainingPayment = parseFloat(paymentData.amount);
        const totalPaid = remainingPayment;
        const timestamp = new Date().toISOString();

        console.log(`Starting settlement for ${selectedCustomer.name}. Amount: ${totalPaid}`);

        // 1. Fetch oldest unpaid/partial bills first (FIFO)
        const billsRes = await window.electronAPI.dbQuery(
          'SELECT * FROM orders WHERE customerId = ? AND (dueAmount > 0 OR paymentStatus = "Credit" OR paymentStatus = "Partial") ORDER BY createdAt ASC',
          [selectedCustomer.id]
        );

        if (billsRes.success && billsRes.data.length > 0) {
          console.log(`Found ${billsRes.data.length} pending bills.`);
          for (const bill of billsRes.data) {
            if (remainingPayment <= 0) break;

            // Handle legacy data where dueAmount might be 0 but status is Credit
            const currentDue = bill.dueAmount > 0 ? bill.dueAmount : (bill.totalAmount - (bill.paidAmount || 0));
            if (currentDue <= 0) continue;

            let paymentForThisBill = 0;
            let newStatus = bill.paymentStatus || 'Credit';
            let newDue = currentDue;
            let newPaid = bill.paidAmount || 0;

            if (remainingPayment >= currentDue) {
              paymentForThisBill = currentDue;
              remainingPayment -= currentDue;
              newDue = 0;
              newPaid += paymentForThisBill;
              newStatus = 'Paid';
            } else {
              paymentForThisBill = remainingPayment;
              newDue -= remainingPayment;
              newPaid += remainingPayment;
              remainingPayment = 0;
              newStatus = 'Partial';
            }

            console.log(`Applying ${paymentForThisBill} to bill ${bill.id}. New status: ${newStatus}`);

            // Update Bill
            await window.electronAPI.dbQuery(
              'UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, updatedAt = ? WHERE id = ?',
              [newPaid, newDue, newStatus, timestamp, bill.id]
            );

            // Record Payment Entry linked to Bill
            await window.electronAPI.dbQuery(
              `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [`PAY-${Date.now()}-${bill.id}`, selectedCustomer.id, bill.id, DEFAULT_SHOP_ID, paymentForThisBill, paymentData.method, 'SUCCESS', timestamp]
            );
          }
        } else {
          console.log("No specific bills found to settle, applying to general balance.");
        }

        // 2. Update overall customer balance
        await window.electronAPI.dbQuery(
          'UPDATE customers SET balance = balance - ?, updatedAt = ? WHERE id = ?',
          [totalPaid, timestamp, selectedCustomer.id]
        );

        // 3. Record Transaction in Accounts
        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = timestamp.replace('T', ' ').slice(0, 16);
        
        await window.electronAPI.dbQuery(
          `INSERT INTO account_transactions 
           (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txnId, DEFAULT_SHOP_ID, paymentData.method, 'INCOME', 'Credit Settlement', totalPaid, `Settlement from ${selectedCustomer.name}`, txnTimestamp, 0, timestamp, 'DollarSign']
        );

        setShowPaymentModal(false);
        setPaymentData({ amount: '', method: 'CASH' });
        fetchCustomers();
        alert(`Settlement complete! Remaining unallocated: ${remainingPayment.toFixed(2)}`);
      } catch (err) {
        console.error("Payment error:", err);
        alert("Payment failed. Please check console for details.");
      }
    }
  };
  const handleDeleteCustomer = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer? All their order history will remain but they will be removed from the list.")) return;
    
    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery('DELETE FROM customers WHERE id = ?', [id]);
        fetchCustomers();
      } catch (err) {
        console.error("Delete customer error:", err);
        alert("Failed to delete customer.");
      }
    }
  };

  const fetchCustomerBills = async (customerId) => {
    if (window.electronAPI?.dbQuery) {
      try {
        const result = await window.electronAPI.dbQuery(
          'SELECT * FROM orders WHERE customerId = ? ORDER BY createdAt DESC',
          [customerId]
        );
        if (result.success) setCustomerBills(result.data);
      } catch (err) {
        console.error("Failed to fetch customer bills:", err);
      }
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Paid': return styles.statusPaid;
      case 'Credit': return styles.statusCredit;
      case 'Partial': return styles.statusPartial;
      default: return '';
    }
  };

  const handleWhatsApp = (phone) => {
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Prepend country code if not present
    const countryCode = settings.waCountryCode || '';
    if (countryCode && !cleanPhone.startsWith(countryCode)) {
      cleanPhone = countryCode + cleanPhone;
    }

    const message = `Hello! This is from the laundry shop. We're reaching out regarding your account.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className={styles.customersPage}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <h1>Customers</h1>
          <p>Manage and view your customer database and order history.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={styles.headerSettleBtn} onClick={() => navigate('/settlement')}>
            <DollarSign size={18} /> Settle Bill
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <UserPlus size={18} /> Add Customer
          </button>
        </div>
      </div>
      
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
          <div className={styles.kpiIcon}><TrendingUp size={20} /></div>
          <div className={styles.kpiValueWrapper}>
            <span className={styles.kpiValue}>{customers.length.toLocaleString()}</span>
          </div>
          <span className={styles.kpiLabel}>Total Active Customers</span>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><Star size={20} color="#2563EB" /></div>
          <div className={styles.kpiValueWrapper}>
            <span className={styles.kpiValue}>{Math.round(customers.length * 0.15)}</span>
          </div>
          <span className={styles.kpiLabel}>Premium Members</span>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><Clock size={20} color="#2563EB" /></div>
          <div className={styles.kpiValueWrapper}>
            <span className={styles.kpiValue}>4.2d</span>
          </div>
          <span className={styles.kpiLabel}>Avg. Order Frequency</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersCard}>
        <div className={styles.searchBox}>
          <Search size={18} color="#94A3B8" />
          <input 
            type="text" 
            placeholder="Search by ID, Name, Phone or Email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.filterActions}>
          <button className={styles.secondaryBtn}><Download size={18} /> Export</button>
          <button className={styles.secondaryBtn}><Calendar size={18} /> This Month</button>
        </div>
      </div>

      {/* Table Section */}
      <div className={styles.tableCard}>
        <table className={styles.customersTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer Name</th>
              <th>Email</th>
              <th>Phone Number</th>
              <th>Balance</th>
              <th>Credit Limit</th>
              <th>Last Order Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length > 0 ? customers.map((customer, idx) => (
              <tr key={customer.id || idx}>
                <td style={{ fontWeight: 700, color: '#64748B', fontSize: '0.8rem' }}>
                  {customer.id?.split('-')[1]?.substring(0, 8) || customer.id || idx + 1}
                </td>
                <td>
                  <div className={styles.customerInfo}>
                    <img src={customer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.name)}&background=F1F5F9&color=2563EB`} alt={customer.name} className={styles.avatar} />
                    <div className={styles.customerDetails}>
                      <span className={styles.customerName}>{customer.name}</span>
                      <span className={styles.customerTag}>{customer.tag || 'Regular'}</span>
                    </div>
                  </div>
                </td>
                <td>{customer.email}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {customer.phone}
                    <MessageCircle 
                      size={14} 
                      className={styles.waIcon} 
                      onClick={() => handleWhatsApp(customer.phone)} 
                    />
                  </div>
                </td>
                <td><span className={styles.balanceBadge} style={{ color: (customer.balance || 0) > 0 ? '#EF4444' : '#10B981' }}><CurrencySymbol size={16} /> {(customer.balance || 0).toFixed(2)}</span></td>
                <td><CurrencySymbol size={16} />{(customer.creditLimit || 0).toFixed(2)}</td>
                <td>{customer.lastDate || customer.updatedAt?.split('T')[0] || 'N/A'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className={styles.settleRowBtn}
                      onClick={() => navigate(`/settlement?customerId=${customer.id}&amount=${customer.balance}`)}
                    >
                      Settle
                    </button>
                    <button 
                      className={styles.secondaryBtn} 
                      style={{ padding: '0.4rem 0.6rem' }}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        fetchCustomerBills(customer.id);
                        setShowBillsModal(true);
                      }}
                    >
                      Bills
                    </button>
                    <button 
                      className={styles.secondaryBtn} 
                      style={{ padding: '0.4rem 0.6rem', color: '#10B981', borderColor: '#10B981' }}
                      onClick={() => handleWhatsApp(customer.phone)}
                      title="Send WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </button>
                    <button 
                      className={styles.secondaryBtn} 
                      style={{ padding: '0.4rem 0.6rem', color: '#EF4444', borderColor: '#EF4444' }}
                      onClick={() => handleDeleteCustomer(customer.id)}
                      title="Delete Customer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                  {loading ? 'Loading customers...' : 'No customers found. Click "Add Customer" to start.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>Showing 1 to {customers.length} of {customers.length} customers</span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn}><ChevronLeft size={16} /></button>
            <button className={`${styles.pageBtn} ${styles.active}`}>1</button>
            <button className={styles.pageBtn}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>


      {/* Add Customer Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Add New Customer</h2>
                <p>Register a new customer to your database</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowModal(false)} />
            </div>

            <form onSubmit={handleSaveCustomer}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Full Name</label>
                  <div className={styles.inputWrapper}>
                    <UserPlus size={18} />
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe" 
                      required 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Email Address (Optional)</label>
                    <div className={styles.inputWrapper}>
                      <Mail size={18} />
                      <input 
                        type="email" 
                        placeholder="john@example.com" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Phone Number</label>
                    <div className={styles.inputWrapper}>
                      <Phone size={18} />
                      <input 
                        type="tel" 
                        placeholder="+1 (555) 000-0000" 
                        required 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                  <div className={styles.formGroup}>
                    <label>Address (Optional)</label>
                    <div className={styles.inputWrapper}>
                      <MapPin size={18} />
                      <input 
                        type="text" 
                        placeholder="Street, City, State" 
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Credit Limit (Optional)</label>
                  <div className={styles.inputWrapper}>
                    <CreditCard size={18} />
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="e.g. 500.00" 
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({...formData, creditLimit: e.target.value})}
                    />
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.25rem' }}>Maximum amount this customer can carry as outstanding balance.</p>
                </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn}>Create Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bills Modal */}
      {showBillsModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ width: '800px', maxWidth: '95vw' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Billing History - {selectedCustomer?.name}</h2>
                <p>Outstanding Balance: <strong style={{ color: (selectedCustomer?.balance || 0) > 0 ? '#EF4444' : '#10B981' }}><CurrencySymbol size={16} /> {(selectedCustomer?.balance || 0).toFixed(2)}</strong></p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowBillsModal(false)} />
            </div>
            <div className={styles.modalBody} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table className={styles.customersTable}>
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
                  {customerBills.length > 0 ? customerBills.map((bill) => (
                    <tr key={bill.id}>
                      <td style={{ fontWeight: 700 }}>{bill.id}</td>
                      <td>{bill.createdAt?.split('T')[0]}</td>
                      <td><CurrencySymbol size={14} /> {bill.totalAmount.toFixed(2)}</td>
                      <td>
                        <CurrencySymbol size={14} /> {
                          bill.paymentStatus === 'Paid' 
                            ? bill.totalAmount.toFixed(2) 
                            : (bill.paidAmount || 0).toFixed(2)
                        }
                      </td>
                      <td><span style={{ color: (bill.dueAmount || 0) > 0 ? '#EF4444' : 'inherit' }}><CurrencySymbol size={14} /> {(bill.dueAmount || 0).toFixed(2)}</span></td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(bill.paymentStatus)}`}>
                          {bill.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No billing history found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={() => setShowBillsModal(false)}>Close</button>
              <button 
                className={styles.primaryBtn} 
                onClick={() => {
                  setShowBillsModal(false);
                  // Only auto-fill if balance is positive (due), otherwise let them enter amount
                  const autoAmount = selectedCustomer?.balance > 0 ? selectedCustomer.balance : '';
                  setPaymentData({ ...paymentData, amount: autoAmount });
                  setShowPaymentModal(true);
                }}
                disabled={!selectedCustomer}
              >
                Settle Balance
              </button>
            </div>
          </div>
        </div>
      )}
      {showPaymentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '450px' }}>
            <div className={styles.modalHeader} style={{ background: '#F8FAFC', paddingBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A' }}>Settle Customer Bill</h2>
                <p>Record payment and settle outstanding credit</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowPaymentModal(false)} />
            </div>
            
            <form onSubmit={handlePayment}>
              <div className={styles.modalBody}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '1.25rem', 
                  background: '#F1F5F9', 
                  borderRadius: '12px',
                  marginBottom: '0.5rem' 
                }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%', 
                    background: '#2563EB', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifySelf: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.2rem',
                    fontWeight: 800
                  }}>
                    {selectedCustomer?.name?.charAt(0)}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#1E293B' }}>{selectedCustomer?.name}</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>Total Balance: <strong style={{ color: (selectedCustomer?.balance || 0) > 0 ? '#EF4444' : '#10B981' }}><CurrencySymbol size={14} /> {(selectedCustomer?.balance || 0).toFixed(2)}</strong></p>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Settlement Amount</label>
                  <div className={styles.inputWrapper}>
                    <CreditCard size={18} />
                    <input 
                      type="number" 
                      step="0.01"
                      required 
                      autoFocus
                      placeholder="0.00"
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Payment Method</label>
                  <div className={styles.inputWrapper}>
                    <Wallet size={18} />
                    <select 
                      style={{ background: 'transparent', border: 'none', width: '100%', outline: 'none', fontSize: '0.95rem' }}
                      value={paymentData.method}
                      onChange={(e) => setPaymentData({...paymentData, method: e.target.value})}
                    >
                      <option value="CASH">Cash Payment</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="CARD">Card Payment</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} style={{ background: '#10B981' }}>
                  Complete Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showQuickSettleModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '450px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Quick Settle</h2>
                <p>Search customer to record payment</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => {
                setShowQuickSettleModal(false);
                setQuickSettleSearch('');
              }} />
            </div>
            <div className={styles.modalBody}>
              <div className={styles.inputWrapper}>
                <Search size={20} />
                <input 
                  type="text" 
                  placeholder="Enter name or phone..." 
                  autoFocus
                  value={quickSettleSearch}
                  onChange={(e) => setQuickSettleSearch(e.target.value)}
                />
              </div>

              <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                {quickSettleSearch.length > 1 && customers
                  .filter(c => 
                    c.name.toLowerCase().includes(quickSettleSearch.toLowerCase()) || 
                    c.phone?.includes(quickSettleSearch)
                  )
                  .map(customer => (
                    <div 
                      key={customer.id} 
                      className={styles.searchResultItem}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setPaymentData({ ...paymentData, amount: customer.balance });
                        setShowQuickSettleModal(false);
                        setQuickSettleSearch('');
                        setShowPaymentModal(true);
                      }}
                    >
                      <div className={styles.searchResultInfo}>
                        <strong>{customer.name}</strong>
                        <span>{customer.phone}</span>
                      </div>
                      <div className={styles.searchResultBalance}>
                        <CurrencySymbol size={14} /> {customer.balance.toFixed(2)}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
