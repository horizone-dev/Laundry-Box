import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Plus, Minus, ShoppingBag, Trash2, CheckCircle, 
  X, ChevronDown, Shirt, Bed, Wind, Layers, 
  Droplet, Zap, Heart, Sparkles, User, CreditCard, Wallet, 
  Gift, Printer, Receipt, Edit3, UserPlus, Phone, Mail, MapPin, MessageCircle
} from 'lucide-react';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './POS.module.css';


export default function POS() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [services, setServices] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [addons, setAddons] = useState([]);
  
  const [step, setStep] = useState('pos'); // pos, checkout
  const [cart, setCart] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceConfig, setServiceConfig] = useState({ type: 'wf', addons: [], qty: 1 });
  
  useEffect(() => {
    fetchPOSData();
  }, []);

  const fetchPOSData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const sRes = await window.electronAPI.dbQuery('SELECT * FROM services', []);
        const tRes = await window.electronAPI.dbQuery('SELECT * FROM service_types', []);
        const aRes = await window.electronAPI.dbQuery('SELECT * FROM addons', []);
        
        if (sRes.success) setServices(sRes.data);
        if (tRes.success) setServiceTypes(tRes.data);
        if (aRes.success) setAddons(aRes.data);
      } catch (err) {
        console.error("Failed to fetch POS data:", err);
      }
    }
  };

  const getIcon = (iconName, size = 24) => {
    const icons = {
      'Shirt': <Shirt size={size} />,
      'Heart': <Heart size={size} />,
      'Layers': <Layers size={size} />,
      'Bed': <Bed size={size} />,
      'Wind': <Wind size={size} />,
      'Droplet': <Droplet size={size} />,
      'Sparkles': <Sparkles size={size} />,
      'Zap': <Zap size={size} />
    };
    return icons[iconName] || <Shirt size={size} />;
  };

  // Checkout states
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [printReceipt, setPrintReceipt] = useState(true);

  // Customer states
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderInfo, setLastOrderInfo] = useState(null);
  const [customerFormData, setCustomerFormData] = useState({ name: '', phone: '', email: '', address: '' });

  useEffect(() => {
    if (customerSearch.length > 0 && !selectedCustomer) {
      const timer = setTimeout(() => searchCustomers(), 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [customerSearch]);

  const searchCustomers = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const param = `%${customerSearch}%`;
        const result = await window.electronAPI.dbQuery(
          'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR id LIKE ? LIMIT 5',
          [param, param, param]
        );
        if (result.success) setSearchResults(result.data);
      } catch (err) {
        console.error("Customer search failed:", err);
      }
    }
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setSearchResults([]);
  };

  const handleSaveNewCustomer = async (e) => {
    e.preventDefault();
    const id = `CUST-${Date.now()}`;
    const timestamp = new Date().toISOString();

    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery(
          'INSERT INTO customers (id, shopId, name, phone, email, address, creditLimit, isSynced, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, 'SHOP_01', customerFormData.name, customerFormData.phone, customerFormData.email, customerFormData.address, customerFormData.creditLimit || 0, 0, timestamp]
        );
        handleSelectCustomer({ id, ...customerFormData });
        setShowCustomerModal(false);
        setCustomerFormData({ name: '', phone: '', email: '', address: '' });
      } catch (err) {
        console.error("Failed to save customer:", err);
      }
    } else {
      handleSelectCustomer({ id, ...customerFormData });
      setShowCustomerModal(false);
    }
  };

  // POS Features
  const [selectedCategory, setSelectedCategory] = useState('Laundry');
  const [discount, setDiscount] = useState(0);

  const handleDiscount = () => {
    const val = prompt("Enter discount amount (د.إ):", discount);
    if (val !== null) setDiscount(parseFloat(val) || 0);
  };

  const handleQuote = () => {
    alert("Quote generated successfully!");
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  // Calculate total tax by summing per-item tax
  let totalTax = 0;
  let finalTotal = 0;
  const defaultRate = (settings.taxRate || 0) / 100;

  cart.forEach(item => {
    const itemSubtotal = item.price * item.qty;
    // Apply discount proportionally to each item subtotal for accurate per-item tax
    const proportion = subtotal > 0 ? itemSubtotal / subtotal : 0;
    const itemDiscount = discount * proportion;
    const itemBase = itemSubtotal - itemDiscount;
    
    const rate = (item.taxRate !== null && item.taxRate !== undefined) 
      ? (item.taxRate / 100) 
      : defaultRate;

    if (settings.isTaxEnabled) {
      if (settings.taxMethod === 'inclusive') {
        totalTax += itemBase - (itemBase / (1 + rate));
      } else {
        totalTax += itemBase * rate;
      }
    }
  });

  const total = settings.taxMethod === 'inclusive' 
    ? (subtotal - discount) 
    : (subtotal - discount + totalTax);
  const tax = totalTax;
  
  const changeDue = parseFloat(tenderedAmount || 0) - total;

  const handleWhatsApp = (phone, text = null) => {
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Prepend country code if not present
    const countryCode = settings.waCountryCode || '';
    if (countryCode && !cleanPhone.startsWith(countryCode)) {
      cleanPhone = countryCode + cleanPhone;
    }

    const message = text || `Hello! This is from the laundry shop. We're reaching out regarding your order.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleServiceClick = (service) => {
    setSelectedService(service);
    setServiceConfig({ type: 'wf', addons: [], qty: 1 });
  };

  const addToCart = () => {
    const type = serviceTypes.find(t => t.id === serviceConfig.type);
    const selectedAddons = addons.filter(a => serviceConfig.addons.includes(a.id));
    const addonPrice = selectedAddons.reduce((sum, a) => sum + a.price, 0);
    
    const newItem = {
      id: Date.now().toString(),
      serviceId: selectedService.id,
      name: selectedService.name,
      price: type.price + addonPrice,
      type: type.name,
      addons: selectedAddons.map(a => a.name),
      qty: serviceConfig.qty,
      taxRate: selectedService.taxRate // Store product-wise rate
    };
    
    setCart([...cart, newItem]);
    setSelectedService(null);
  };

  const getModalPrice = () => {
    if (!selectedService) return 0;
    const type = serviceTypes.find(t => t.id === serviceConfig.type);
    const selectedAddons = addons.filter(a => serviceConfig.addons.includes(a.id));
    const addonPrice = selectedAddons.reduce((sum, a) => sum + a.price, 0);
    const basePrice = type ? type.price : 0;
    return (basePrice + addonPrice) * serviceConfig.qty;
  };

  // Helper to format currency
  const formatCurrency = (amount) => {
    return `${settings.currencySymbol || 'AED'} ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const removeCartItem = (idx) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const updateCartQty = (idx, delta) => {
    const newCart = [...cart];
    const newQty = newCart[idx].qty + delta;
    if (newQty <= 0) {
      removeCartItem(idx);
    } else {
      newCart[idx].qty = newQty;
      setCart(newCart);
    }
  };

  const toggleAddon = (id) => {
    setServiceConfig(prev => ({
      ...prev,
      addons: prev.addons.includes(id) 
        ? prev.addons.filter(a => a !== id) 
        : [...prev.addons, id]
    }));
  };

  const handleCompletePayment = async () => {
    const orderId = `#AG-${Math.floor(10000 + Math.random() * 90000)}`;
    const billNumber = `BN-${Date.now().toString().slice(-6)}`;
    
    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery(
          `INSERT INTO orders (id, shopId, branchId, customerId, status, totalAmount, paidAmount, dueAmount, paymentStatus, items, createdAt, isSynced, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            'SHOP_01',
            'BRANCH_01',
            selectedCustomer ? selectedCustomer.id : 'Walk-in',
            paymentMethod === 'credit' ? 'Payment Pending' : 'Paid',
            total,
            paymentMethod === 'credit' ? 0 : total,
            paymentMethod === 'credit' ? total : 0,
            paymentMethod === 'credit' ? 'Credit' : 'Paid',
            JSON.stringify(cart),
            new Date().toISOString(),
            0,
            new Date().toISOString()
          ]
        );

        // Sync to MongoDB Backend
        try {
          await axios.post('http://localhost:3000/api/orders', {
            id: orderId,
            billNumber,
            customerId: selectedCustomer ? selectedCustomer.id : 'Walk-in',
            customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
            customerPhone: selectedCustomer ? selectedCustomer.phone : '',
            shopId: 'SHOP_01',
            branchId: 'BRANCH_01',
            status: paymentMethod === 'credit' ? 'Credit' : 'Paid',
            totalAmount: total,
            paymentMethod: paymentMethod === 'cash' ? 'Cash' : (paymentMethod === 'card' ? 'Card' : (paymentMethod === 'credit' ? 'Credit' : 'UPI / QR Payment')),
            items: cart,
            statusHistory: [{ status: paymentMethod === 'credit' ? 'Credit' : 'Paid', updatedBy: 'POS System' }]
          });
        } catch (syncErr) {
          console.warn('Backend sync failed, but local order saved:', syncErr);
        }

        if (paymentMethod === 'credit' && selectedCustomer) {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance + ? WHERE id = ?',
            [total, selectedCustomer.id]
          );
        }

        // Record Transaction in Accounts
        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
        const accountType = paymentMethod === 'card' || paymentMethod === 'upi' ? 'BANK' : 'CASH';
        
        if (paymentMethod !== 'credit') {
          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [txnId, 'SHOP_01', accountType, 'INCOME', 'Sales', total, `Order ${orderId}`, txnTimestamp, 0, new Date().toISOString(), 'ShoppingBag']
          );
        }

        navigate(`/invoice/${orderId.replace('#', '')}`);
      } catch (err) {
        console.error("Failed to save order:", err);
        alert("CRITICAL ERROR: Failed to save order to local database. Please check logs.");
      }
    } else {
      alert("Electron API not found. Order cannot be saved locally.");
    }
  };

  const handleSaveOrder = async () => {
    if (cart.length === 0) return;
    
    if (!selectedCustomer) {
      alert("Please select or add a customer to save the bill.");
      return;
    }
    
    const orderId = `#AG-${Math.floor(10000 + Math.random() * 90000)}`;
    const billNumber = `BN-${Date.now().toString().slice(-6)}`;
    
    if (window.electronAPI?.dbQuery) {
      try {
        const isCredit = paymentMethod === 'credit';
        const paidAmount = isCredit ? 0 : total;
        const dueAmount = isCredit ? total : 0;
        const paymentStatus = isCredit ? 'Credit' : 'Paid';

        await window.electronAPI.dbQuery(
          `INSERT INTO orders 
           (id, shopId, branchId, customerId, status, totalAmount, paidAmount, dueAmount, paymentStatus, items, createdAt, isSynced, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            'SHOP_01',
            'BRANCH_01',
            selectedCustomer ? selectedCustomer.id : 'Walk-in',
            'Payment Pending',
            total,
            paidAmount,
            dueAmount,
            paymentStatus,
            JSON.stringify(cart),
            new Date().toISOString(),
            0,
            new Date().toISOString()
          ]
        );

        // Record Payment if not full credit
        if (!isCredit) {
          await window.electronAPI.dbQuery(
            `INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `PAY-${Date.now()}`,
              selectedCustomer ? selectedCustomer.id : 'Walk-in',
              orderId,
              'SHOP_01',
              total,
              paymentMethod.toUpperCase(),
              'SUCCESS',
              new Date().toISOString()
            ]
          );
        }

        // Sync to MongoDB Backend
        try {
          await axios.post('http://localhost:3000/api/orders', {
            id: orderId,
            billNumber,
            customerId: selectedCustomer ? selectedCustomer.id : 'Walk-in',
            customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
            customerPhone: selectedCustomer ? selectedCustomer.phone : '',
            shopId: 'SHOP_01',
            branchId: 'BRANCH_01',
            status: isCredit ? 'Credit' : 'Payment Pending',
            totalAmount: total,
            paidAmount: paidAmount,
            dueAmount: dueAmount,
            paymentStatus: paymentStatus,
            paymentMethod: paymentMethod.toUpperCase(),
            items: cart,
            statusHistory: [{ status: isCredit ? 'Credit' : 'Payment Pending', updatedBy: 'POS System', timestamp: new Date().toISOString() }]
          });
        } catch (syncErr) {
          console.warn('Backend sync failed, but local order saved:', syncErr);
        }

        // Update balance ONLY if paid by credit
        if (selectedCustomer && paymentMethod === 'credit') {
          // Check credit limit
          const currentBalance = selectedCustomer.balance || 0;
          const limit = selectedCustomer.creditLimit || 0;
          if (limit > 0 && (currentBalance + total) > limit) {
             alert(`Payment failed: Credit limit of ${settings.currencySymbol || 'AED'} ${limit.toFixed(2)} exceeded. Current balance: ${settings.currencySymbol || 'AED'} ${currentBalance.toFixed(2)}`);
             return;
          }

          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance + ? WHERE id = ?',
            [total, selectedCustomer.id]
          );
        } else if (selectedCustomer && paymentMethod !== 'credit') {
           // Maybe record transaction? (Optional, handle separately if needed)
        }

        setLastOrderInfo({
          orderId,
          total,
          customerName: selectedCustomer.name,
          customerPhone: selectedCustomer.phone,
          newBalance: (selectedCustomer.balance || 0) + total
        });
        
        setShowSuccessModal(true);
        setCart([]);
      } catch (err) {
        console.error("Failed to save order:", err);
      }
    } else {
      setLastOrderInfo({
        orderId,
        total,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        newBalance: (selectedCustomer.balance || 0) + total
      });
      setShowSuccessModal(true);
      setCart([]);
    }
  };

  if (step === 'checkout') {
    return (
      <div className={styles.checkoutContainer}>
        {/* Left: Order Summary */}
        <div className={styles.summarySection}>
          <div className={styles.summaryHeader}>
            <h2>Order Summary</h2>
            <Edit3 size={18} className={styles.clearCart} onClick={() => setStep('pos')} />
          </div>
          <div className={styles.summaryCard}>
            <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Ticket #7721 • Customer: Julian Reed</p>
            {cart.map((item, idx) => (
              <div key={idx} className={styles.cartItem}>
                <div className={styles.cartItemIcon}>{getIcon(services.find(s => s.name === item.name)?.icon)}</div>
                <div className={styles.cartItemDetails}>
                  <span className={styles.cartItemName}>{item.name}</span>
                  <span className={styles.cartItemPrice}><CurrencySymbol size={14} /> {item.price.toFixed(2)}</span>
                  <span className={styles.cartItemMeta}>{item.type.toUpperCase()}</span>
                  {item.addons && item.addons.length > 0 && (
                    <span className={styles.cartItemAddons}>
                      + {item.addons.join(', ')}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={styles.cartItemTotal}><CurrencySymbol size={14} /> {(item.price * item.qty).toFixed(2)}</span>
                </div>
              </div>
            ))}
            
            <div style={{ marginTop: 'auto', borderTop: '1px solid #F1F5F9', paddingTop: '1rem' }}>
              <div className={styles.cartRow}><span>Subtotal</span><span><CurrencySymbol size={14} /> {subtotal.toFixed(2)}</span></div>
              <div className={styles.cartRow}><span>{settings.taxName || 'Tax'} ({settings.isTaxEnabled ? settings.taxRate : 0}%)</span><span><CurrencySymbol size={14} /> {tax.toFixed(2)}</span></div>
              <div className={`${styles.cartRow} ${styles.totalRow}`}><span>Grand Total</span><span className={styles.totalValue}><CurrencySymbol size={16} /> {total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        {/* Right: Payment */}
        <div className={styles.paymentSection}>
          <div className={styles.amountGrid}>
            <div className={styles.amountBox}>
              <span className={styles.amountBoxLabel}>Amount Due</span>
              <span className={styles.amountBoxValue}><CurrencySymbol size={16} /> {total.toFixed(2)}</span>
            </div>
            <div className={styles.amountBox}>
              <span className={styles.amountBoxLabel}>Tendered</span>
              <span className={styles.amountBoxValue}><CurrencySymbol size={16} /> {tenderedAmount || '0.00'}</span>
            </div>
            <div className={`${styles.amountBox} ${changeDue > 0 ? styles.amountBoxChange : ''}`}>
              <span className={styles.amountBoxLabel}>Change Due</span>
              <span className={styles.amountBoxValue}><CurrencySymbol size={16} /> {changeDue > 0 ? changeDue.toFixed(2) : '0.00'}</span>
            </div>
          </div>

          <div>
            <h3 className={styles.modalSectionTitle}>Payment Method</h3>
            <div className={styles.paymentMethods}>
              <MethodCard id="cash" label="Cash" icon={<Wallet />} active={paymentMethod === 'cash'} onClick={setPaymentMethod} />
              <MethodCard id="card" label="Card" icon={<CreditCard />} active={paymentMethod === 'card'} onClick={setPaymentMethod} />
              <MethodCard id="wallet" label="Wallet" icon={<Wallet />} active={paymentMethod === 'wallet'} onClick={setPaymentMethod} />
              <MethodCard id="credit" label="Store Credit" icon={<User />} active={paymentMethod === 'credit'} onClick={setPaymentMethod} />
            </div>
          </div>

          <div className={styles.checkoutBottom}>
            <div>
              <h3 className={styles.modalSectionTitle}>Enter Amount</h3>
              <div className={styles.numpad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
                  <button key={n} className={styles.numBtn} onClick={() => setTenderedAmount(prev => prev + n.toString())}>{n}</button>
                ))}
                <button className={`${styles.numBtn} ${styles.numBtnAction}`} onClick={() => setTenderedAmount('')}><X size={24} /></button>
                <button className={`${styles.numBtn} ${styles.numBtnSpecial}`} style={{ gridColumn: 'span 3', height: '48px' }} onClick={() => setTenderedAmount(total.toFixed(2))}>Exact Cash</button>
              </div>
            </div>

            <div className={styles.checkoutActions}>
              <div className={styles.checkoutOptions}>
                <div className={styles.optionToggle} onClick={() => setPrintReceipt(!printReceipt)}>
                  <div className={`${styles.switch} ${printReceipt ? styles.switchOn : ''}`}>
                    <div className={styles.switchHandle}></div>
                  </div>
                  <div className={styles.optionToggleText}>
                    <span className={styles.optionToggleLabel}>Print Receipt</span>
                    <span className={styles.optionToggleSub}>Automatically print after payment</span>
                  </div>
                </div>
              </div>

              <button className={styles.completeBtn} onClick={handleCompletePayment}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Printer size={28} />
                  Complete Payment & {printReceipt ? 'Print' : 'Finalize'} Receipt
                </div>
                {selectedCustomer?.email && <p>Send digital receipt to {selectedCustomer.email}</p>}
              </button>

              {selectedCustomer && (
                <button 
                  className={styles.waReceiptBtn}
                  onClick={() => {
                    const msg = `Hello ${selectedCustomer.name}! Your laundry order totaling ${total.toFixed(2)} has been received and is now being processed. Thank you for choosing us!`;
                    handleWhatsApp(selectedCustomer.phone, msg);
                  }}
                >
                  <MessageCircle size={24} /> Send WhatsApp Receipt
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.posContainer}>
      {/* Left: Service Selection */}
      <div className={styles.mainSection}>
        <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
          <div className={styles.searchBar} style={{ flex: 1 }}>
            <Search size={20} color="#94A3B8" />
            <input type="text" placeholder="Search orders, customers, or items..." />
          </div>
          <button className={styles.manageCustBtn} onClick={() => navigate('/customers')}>
            <User size={18} /> Customers
          </button>
        </div>

        <div className={styles.categoriesRow}>
          <div className={styles.categoryTabs}>
            {['Laundry', 'Dry Cleaning', 'Alterations', 'Add-ons'].map(cat => (
              <button 
                key={cat} 
                className={`${styles.categoryTab} ${selectedCategory === cat ? styles.active : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className={styles.activeStation}>
            <span className={styles.statusDot}></span>
            Active Station
          </div>
        </div>

        <div className={styles.itemsGrid}>
          {services.map((service) => (
            <div key={service.id} className={styles.itemCard} onClick={() => handleServiceClick(service)}>
              <div className={styles.itemIcon}>{getIcon(service.icon)}</div>
              <span className={styles.itemName}>{service.name}</span>
              <span className={styles.itemPrice}><CurrencySymbol size={16} /> {service.price.toFixed(2)}</span>
            </div>
          ))}
          <div className={`${styles.itemCard} ${styles.addItemCard}`} onClick={() => navigate('/services')}>
            <Plus size={32} color="#CBD5E1" />
          </div>
        </div>
      </div>

      {/* Right: Cart Sidebar */}
      <aside className={styles.cartSection}>
        <div className={styles.cartHeader}>
          <div className={styles.cartTitle}>
            <h3>Current Order</h3>
            <div className={styles.customerSearchContainer}>
              {!selectedCustomer ? (
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <div className={styles.customerSearchInput} style={{ flex: 1 }}>
                    <Search size={14} />
                    <input 
                      type="text" 
                      placeholder="Search Customer..." 
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>
                  <button 
                    className={styles.sidebarAddBtn} 
                    onClick={() => setShowCustomerModal(true)}
                    title="Add New Customer"
                  >
                    <UserPlus size={16} />
                  </button>
                </div>
              ) : (
                <div className={styles.selectedCustomerCard}>
                  <User size={14} />
                  <div className={styles.selCustInfo}>
                    <span className={styles.selCustName}>{selectedCustomer.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className={styles.selCustPhone}>{selectedCustomer.phone}</span>
                      <MessageCircle 
                        size={12} 
                        className={styles.waIconMini} 
                        onClick={() => handleWhatsApp(selectedCustomer.phone)} 
                      />
                    </div>
                    {selectedCustomer.balance > 0 && (
                      <span className={styles.overdueBadge}>
                        Overdue: <CurrencySymbol size={10} /> {selectedCustomer.balance.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <X size={14} className={styles.removeCust} onClick={() => setSelectedCustomer(null)} />
                </div>
              )}

              {customerSearch && !selectedCustomer && (
                <div className={styles.customerDropdown}>
                  {searchResults.length > 0 ? (
                    searchResults.map(c => (
                      <div key={c.id} className={styles.customerResult} onClick={() => handleSelectCustomer(c)}>
                        <span className={styles.resName}>{c.name}</span>
                        <span className={styles.resMeta}>{c.phone} • {c.id}</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.noRes}>
                      <span>No results</span>
                      <button className={styles.addNewBtn} onClick={() => setShowCustomerModal(true)}>
                        <UserPlus size={14} /> Add New
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <Trash2 size={18} className={styles.clearCart} onClick={() => setCart([])} />
        </div>

        <div className={styles.cartItems}>
          {cart.map((item, idx) => (
            <div key={idx} className={styles.cartItem}>
              <div className={styles.cartItemIcon}>
                {getIcon(services.find(s => s.name === item.name)?.icon, 20)}
              </div>
              <div className={styles.cartItemDetails}>
                <span className={styles.cartItemName}>{item.name}</span>
                <span className={styles.cartItemMeta}>{item.type} • <CurrencySymbol size={10} /> {item.price.toFixed(2)}</span>
                {item.addons && item.addons.length > 0 && (
                  <span className={styles.cartItemAddons}>
                    + {item.addons.join(', ')}
                  </span>
                )}
              </div>
              <div className={styles.qtyControl}>
                <button className={styles.qtyBtn} onClick={() => updateCartQty(idx, -1)}><Minus size={14} /></button>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', minWidth: '1.5rem', textAlign: 'center' }}>{item.qty}</span>
                <button className={styles.qtyBtn} onClick={() => updateCartQty(idx, 1)}><Plus size={14} /></button>
              </div>
              <div className={styles.cartItemPrice}><CurrencySymbol size={14} /> {(item.price * item.qty).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className={styles.cartFooter}>
          <div className={styles.cartRow}><span>Subtotal</span><span><CurrencySymbol size={14} /> {subtotal.toFixed(2)}</span></div>
          {discount > 0 && (
            <div className={styles.cartRow} style={{ color: '#EF4444' }}>
              <span>Discount</span>
              <span>-<CurrencySymbol size={14} /> {discount.toFixed(2)}</span>
            </div>
          )}
          <div className={styles.cartRow}><span>{settings.taxName || 'Tax'} ({settings.isTaxEnabled ? settings.taxRate : 0}%)</span><span><CurrencySymbol size={14} /> {tax.toFixed(2)}</span></div>
          <div className={`${styles.cartRow} ${styles.totalRow}`}><span>Total</span><span className={styles.totalValue}><CurrencySymbol size={16} /> {total.toFixed(2)}</span></div>
          
          <div className={styles.cartActions}>
            <button className={styles.secondaryBtn} onClick={handleDiscount}><Receipt size={18} /> Discount</button>
            <button className={styles.secondaryBtn} onClick={handleQuote}><Receipt size={18} /> Quote</button>
            {selectedCustomer && selectedCustomer.balance > 0 && (
              <button className={styles.overdueBtn} onClick={() => alert('Generating Overdue Statement...')}>
                <Printer size={18} /> Overdue Receipt
              </button>
            )}
            <button 
              className={`${styles.saveBtn} ${(!selectedCustomer || cart.length === 0) ? styles.disabled : ''}`} 
              onClick={handleSaveOrder}
            >
              <ShoppingBag size={18} /> Save Bill
            </button>
            <button 
              className={`${styles.paymentBtn} ${(!selectedCustomer || cart.length === 0) ? styles.disabled : ''}`} 
              onClick={() => {
                if (cart.length === 0) return;
                if (!selectedCustomer) {
                  alert("Please select or add a customer to proceed to payment.");
                  return;
                }
                setStep('checkout');
              }}
            >
              <CreditCard size={18} /> Payment Bill
            </button>
          </div>
        </div>
      </aside>

      {/* Service Modal */}
      {selectedService && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <h2>Select Service - {selectedService.name}</h2>
                <p>Configure your treatment and options</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setSelectedService(null)} />
            </div>
            
            <div className={styles.modalBody}>
              <div>
                <h3 className={styles.modalSectionTitle}>Service Type</h3>
                <div className={styles.optionGrid}>
                  {serviceTypes.map(type => (
                    <div 
                      key={type.id} 
                      className={`${styles.optionCard} ${serviceConfig.type === type.id ? styles.active : ''}`}
                      onClick={() => setServiceConfig(prev => ({ ...prev, type: type.id }))}
                    >
                      <div className={styles.optionIcon}>{getIcon(type.icon, 18)}</div>
                      <div className={styles.optionDetails}>
                        <span className={styles.optionName}>{type.name}</span>
                        <span className={styles.optionPrice}><CurrencySymbol size={10} /> {type.price.toFixed(2)} / item</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className={styles.modalSectionTitle}>Add-ons</h3>
                <div className={styles.optionGrid}>
                  {addons.map(addon => (
                    <div 
                      key={addon.id} 
                      className={`${styles.optionCard} ${serviceConfig.addons.includes(addon.id) ? styles.active : ''}`}
                      onClick={() => toggleAddon(addon.id)}
                    >
                      <div className={styles.optionIcon}>{getIcon(addon.icon, 14)}</div>
                      <span className={styles.optionName}>{addon.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.qtySection}>
                <div className={styles.qtyLabel}>
                  <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>QUANTITY</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Number of identical items</span>
                </div>
                <div className={styles.qtyLarge}>
                  <button className={styles.qtyControlBtn} onClick={() => setServiceConfig(prev => ({ ...prev, qty: Math.max(1, prev.qty - 1) }))}>-</button>
                  <input type="text" value={serviceConfig.qty.toString().padStart(2, '0')} readOnly />
                  <button className={`${styles.qtyControlBtn} ${styles.qtyControlBtnPrimary}`} onClick={() => setServiceConfig(prev => ({ ...prev, qty: prev.qty + 1 }))}>+</button>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={() => setSelectedService(null)}>Cancel</button>
              <button className={styles.submitBtn} onClick={addToCart}>
                Add to Order • ${getModalPrice().toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Customer Modal */}
      {showCustomerModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ width: '450px' }}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <h2>Add New Customer</h2>
                <p>Enter details for the new customer</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowCustomerModal(false)} />
            </div>
            <form onSubmit={handleSaveNewCustomer}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>FULL NAME</label>
                  <div className={styles.posInputWrapper}>
                    <User size={18} />
                    <input 
                      type="text" 
                      required 
                      placeholder="Customer name"
                      value={customerFormData.name}
                      onChange={(e) => setCustomerFormData({...customerFormData, name: e.target.value})}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>MOBILE NUMBER</label>
                  <div className={styles.posInputWrapper}>
                    <Phone size={18} />
                    <input 
                      type="tel" 
                      required 
                      placeholder="Phone number"
                      value={customerFormData.phone}
                      onChange={(e) => setCustomerFormData({...customerFormData, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>EMAIL (OPTIONAL)</label>
                    <div className={styles.posInputWrapper}>
                      <Mail size={18} />
                      <input 
                        type="email" 
                        placeholder="Email address"
                        value={customerFormData.email}
                        onChange={(e) => setCustomerFormData({...customerFormData, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Credit Limit (د.إ)</label>
                    <div className={styles.posInputWrapper}>
                      <CreditCard size={18} />
                      <input 
                        type="number" 
                        placeholder="Limit (e.g. 100)"
                        value={customerFormData.creditLimit || ''}
                        onChange={(e) => setCustomerFormData({...customerFormData, creditLimit: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>ADDRESS (OPTIONAL)</label>
                  <div className={styles.posInputWrapper}>
                    <MapPin size={18} />
                    <input 
                      type="text" 
                      placeholder="Customer address"
                      value={customerFormData.address}
                      onChange={(e) => setCustomerFormData({...customerFormData, address: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowCustomerModal(false)}>Cancel</button>
                <button type="submit" className={styles.saveBtn} style={{ padding: '0.75rem 1.5rem', flex: 1 }}>Save & Select</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && lastOrderInfo && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModal}>
            <div className={styles.successHeader}>
              <div className={styles.checkIcon}>
                <CheckCircle size={40} />
              </div>
              <h2>Bill Saved Successfully!</h2>
              <p>Order {lastOrderInfo.orderId} has been recorded.</p>
            </div>

            <div className={styles.successBody}>
              <div className={styles.summaryRow}>
                <span>Order Total</span>
                <span className={styles.summaryValue}><CurrencySymbol size={14} /> {lastOrderInfo.total.toFixed(2)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Customer Balance</span>
                <span className={styles.summaryValue} style={{ color: '#EF4444' }}>
                  <CurrencySymbol size={14} /> {lastOrderInfo.newBalance.toFixed(2)}
                </span>
              </div>

              <div className={styles.successActions}>
                <button 
                  className={styles.waSuccessBtn}
                  onClick={() => {
                    const msg = `Hello ${lastOrderInfo.customerName}! Your laundry bill for ${lastOrderInfo.orderId} of ${formatCurrency(lastOrderInfo.total)} has been saved. Your total outstanding balance is ${formatCurrency(lastOrderInfo.newBalance)}. Thank you!`;
                    handleWhatsApp(lastOrderInfo.customerPhone, msg);
                  }}
                >
                  <MessageCircle size={20} /> Send via WhatsApp
                </button>
                <button 
                  className={styles.doneBtn}
                  onClick={() => {
                    setShowSuccessModal(false);
                    setSelectedCustomer(null);
                  }}
                >
                  Done & New Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MethodCard({ id, label, icon, active, onClick }) {
  return (
    <div className={`${styles.methodCard} ${active ? styles.active : ''}`} onClick={() => onClick(id)}>
      <div className={styles.methodIcon}>{icon}</div>
      <span className={styles.methodName}>{label}</span>
    </div>
  );
}
