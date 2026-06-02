import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Plus, Minus, ShoppingBag, Trash2, CheckCircle, 
  X, ChevronDown, Shirt, Bed, Wind, Layers, Package, 
  Droplet, Zap, Heart, Sparkles, User, CreditCard, Wallet, 
  Gift, Printer, Receipt, Edit3, UserPlus, Phone, MapPin, MessageCircle, Landmark,
  Calendar, FileText
} from 'lucide-react';
import axios from 'axios';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import { DEFAULT_SHOP_ID, DEFAULT_BRANCH_ID, API_BASE_URL, CATEGORIES, PAYMENT_STATUS, ORDER_STATUS, PAYMENT_METHODS } from '../constants';
import styles from './POS.module.css';


export default function POS() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [services, setServices] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [addons, setAddons] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [step, setStep] = useState('pos'); // pos, checkout
  const [cart, setCart] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceConfig, setServiceConfig] = useState({ types: ['wf'], addons: [], qty: 1, customPrice: null, description: '' });
  const [editingCartIdx, setEditingCartIdx] = useState(null); // index of cart item being edited

  const activeServiceTypes = selectedService ? serviceTypes.filter(t => serviceConfig.types.includes(t.id)) : [];
  const activeSelectedAddons = selectedService ? addons.filter(a => serviceConfig.addons.includes(a.id)) : [];
  const activeServiceTypePrice = activeServiceTypes.reduce((sum, t) => sum + t.price, 0);
  const activeAddonPrice = activeSelectedAddons.reduce((sum, a) => sum + a.price, 0);
  const activeCalculatedPrice = (selectedService?.price || 0) + activeServiceTypePrice + activeAddonPrice;
  
  useEffect(() => {
    fetchPOSData();
  }, []);

  const fetchPOSData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const sRes = await window.electronAPI.dbQuery('SELECT * FROM services', []);
        const tRes = await window.electronAPI.dbQuery('SELECT * FROM service_types', []);
        const aRes = await window.electronAPI.dbQuery('SELECT * FROM addons', []);
        const cRes = await window.electronAPI.dbQuery('SELECT * FROM service_categories', []);
        
        if (sRes.success) setServices(sRes.data);
        if (tRes.success) setServiceTypes(tRes.data);
        if (aRes.success) setAddons(aRes.data);
        if (cRes.success) {
          setCategories(cRes.data);
          if (cRes.data.length > 0 && !selectedCategory) {
            setSelectedCategory('All');
          }
        }
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
      'Zap': <Zap size={size} />,
      'Package': <Package size={size} />
    };
    return icons[iconName] || <Shirt size={size} />;
  };

  const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(getTomorrowDateString());
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Checkout states
  const [paymentMethod, setPaymentMethod] = useState(settings.defaultPaymentMethod?.toLowerCase() || 'cash');
  const [selectedBank, setSelectedBank] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [printReceipt, setPrintReceipt] = useState(settings.autoPrint !== undefined ? settings.autoPrint : true);

  useEffect(() => {
    if (settings.bankAccounts && settings.bankAccounts.length > 0 && !selectedBank) {
      const defaultBank = settings.bankAccounts.find(acc => acc.id === settings.defaultBankId) || settings.bankAccounts[0];
      setSelectedBank(defaultBank.bankName);
    }
  }, [settings.bankAccounts, settings.defaultBankId]);

  // Customer states
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderInfo, setLastOrderInfo] = useState(null);
  const [customerFormData, setCustomerFormData] = useState({ name: '', phone: '', address: '' });

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
          [id, DEFAULT_SHOP_ID, customerFormData.name, customerFormData.phone, '', customerFormData.address, customerFormData.creditLimit || settings.defaultCreditLimit || 500, 0, timestamp]
        );
        handleSelectCustomer({ id, ...customerFormData });
        setShowCustomerModal(false);
        setCustomerFormData({ name: '', phone: '', address: '' });
      } catch (err) {
        console.error("Failed to save customer:", err);
      }
    } else {
      handleSelectCustomer({ id, ...customerFormData });
      setShowCustomerModal(false);
    }
  };

  // POS Features
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [itemSearch, setItemSearch] = useState('');
  const [discount, setDiscount] = useState(0);

  const handleDiscount = () => {
    const val = prompt("Enter discount amount (د.إ):", discount);
    if (val !== null) setDiscount(parseFloat(val) || 0);
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
    const defaultType = serviceTypes[0]?.id || 'wf';
    setServiceConfig({ types: [defaultType], addons: [], qty: 1, customPrice: null, description: '' });
  };

  const addToCart = () => {
    if (!selectedService) return;
    
    if (selectedService.isTemporary && !selectedService.name.trim()) {
      alert("Please enter a name for the temporary item.");
      return;
    }
    
    if (!selectedService.isTemporary && activeServiceTypes.length === 0) return;
    
    const unitPrice = serviceConfig.customPrice !== null && serviceConfig.customPrice !== '' 
      ? parseFloat(serviceConfig.customPrice) 
      : activeCalculatedPrice;
    
    const newItem = {
      id: editingCartIdx !== null ? cart[editingCartIdx].id : Date.now().toString(),
      serviceId: selectedService.id,
      name: selectedService.name.trim(),
      price: unitPrice,
      type: selectedService.isTemporary ? 'Custom' : activeServiceTypes.map(t => t.name).join(', '),
      addons: selectedService.isTemporary ? [] : activeSelectedAddons.map(a => a.name),
      qty: serviceConfig.qty,
      taxRate: selectedService.taxRate || settings.taxRate || 0,
      description: serviceConfig.description || ''
    };
    
    if (editingCartIdx !== null) {
      // Replace the existing cart item
      const newCart = [...cart];
      newCart[editingCartIdx] = newItem;
      setCart(newCart);
      setEditingCartIdx(null);
    } else {
      setCart([...cart, newItem]);
    }
    setSelectedService(null);
    setItemSearch('');
  };

  const getModalPrice = () => {
    if (!selectedService) return 0;
    const unitPrice = serviceConfig.customPrice !== null && serviceConfig.customPrice !== '' 
      ? parseFloat(serviceConfig.customPrice) 
      : activeCalculatedPrice;
    return unitPrice * serviceConfig.qty;
  };

  // Helper to format currency
  const formatCurrency = (amount) => {
    return `${settings.currencySymbol || 'AED'} ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const removeCartItem = (idx) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const handleEditCartItem = (idx) => {
    const item = cart[idx];
    // Find the matching service object
    const svc = services.find(s => s.name === item.name) || {
      id: item.serviceId || 'temp',
      name: item.name,
      price: item.price,
      icon: 'Package',
      isTemporary: !services.find(s => s.name === item.name)
    };
    // Resolve type IDs from names
    const typeNames = item.type ? item.type.split(', ') : [];
    const resolvedTypeIds = serviceTypes
      .filter(t => typeNames.includes(t.name))
      .map(t => t.id);
    // Resolve addon IDs from names
    const resolvedAddonIds = addons
      .filter(a => (item.addons || []).includes(a.name))
      .map(a => a.id);
    setEditingCartIdx(idx);
    setSelectedService(svc);
    setServiceConfig({
      types: resolvedTypeIds.length > 0 ? resolvedTypeIds : [serviceTypes[0]?.id || 'wf'],
      addons: resolvedAddonIds,
      qty: item.qty,
      customPrice: item.price,
      description: item.description || ''
    });
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

  const toggleServiceType = (id) => {
    setServiceConfig(prev => {
      const isSelected = prev.types.includes(id);
      if (isSelected && prev.types.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        types: isSelected
          ? prev.types.filter(t => t !== id)
          : [...prev.types, id]
      };
    });
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
          `INSERT INTO orders (id, shopId, billNumber, branchId, customerId, status, totalAmount, paidAmount, dueAmount, paymentStatus, items, statusHistory, createdAt, isSynced, updatedAt, paymentMethod, expectedDeliveryDate, specialInstructions) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            DEFAULT_SHOP_ID,
            billNumber,
            DEFAULT_BRANCH_ID,
            selectedCustomer ? selectedCustomer.id : 'Walk-in',
            paymentMethod === 'credit' ? ORDER_STATUS.PAYMENT_PENDING : ORDER_STATUS.CONFIRMED,
            total,
            paymentMethod === 'credit' ? 0 : total,
            paymentMethod === 'credit' ? total : 0,
            paymentMethod === 'credit' ? PAYMENT_STATUS.CREDIT : PAYMENT_STATUS.PAID,
            JSON.stringify(cart),
            JSON.stringify([{ status: paymentMethod === 'credit' ? ORDER_STATUS.CREDIT : ORDER_STATUS.CONFIRMED, updatedBy: 'POS System', timestamp: new Date().toISOString() }]),
            new Date().toISOString(),
            0,
            new Date().toISOString(),
            paymentMethod === 'cash' ? PAYMENT_METHODS.CASH : (paymentMethod === 'card' ? PAYMENT_METHODS.CARD : (paymentMethod === 'credit' ? PAYMENT_METHODS.CREDIT : PAYMENT_METHODS.UPI)),
            expectedDeliveryDate,
            specialInstructions
          ]
        );

        // Sync to MongoDB Backend
        try {
          await axios.post(`${API_BASE_URL}/orders`, {
            id: orderId,
            billNumber,
            customerId: selectedCustomer ? selectedCustomer.id : 'Walk-in',
            customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
            customerPhone: selectedCustomer ? selectedCustomer.phone : '',
            shopId: DEFAULT_SHOP_ID,
            branchId: DEFAULT_BRANCH_ID,
            status: paymentMethod === 'credit' ? ORDER_STATUS.PAYMENT_PENDING : ORDER_STATUS.CONFIRMED,
            totalAmount: total,
            paidAmount: paymentMethod === 'credit' ? 0 : total,
            dueAmount: paymentMethod === 'credit' ? total : 0,
            paymentStatus: paymentMethod === 'credit' ? PAYMENT_STATUS.CREDIT : PAYMENT_STATUS.PAID,
            paymentMethod: paymentMethod === 'cash' ? PAYMENT_METHODS.CASH : (paymentMethod === 'card' ? PAYMENT_METHODS.CARD : (paymentMethod === 'credit' ? PAYMENT_METHODS.CREDIT : PAYMENT_METHODS.UPI)),
            items: cart,
            statusHistory: [{ status: paymentMethod === 'credit' ? ORDER_STATUS.CREDIT : ORDER_STATUS.CONFIRMED, updatedBy: 'POS System', timestamp: new Date().toISOString() }],
            expectedDeliveryDate,
            specialInstructions
          });
        } catch (syncErr) {
          console.warn('Backend sync failed, but local order saved:', syncErr);
        }

        // Also trigger local sync event (for frontend components)
        window.dispatchEvent(new CustomEvent('order-created', { 
          detail: { 
            id: orderId,
            customerId: selectedCustomer ? selectedCustomer.id : 'Walk-in',
            customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
            customerPhone: selectedCustomer ? selectedCustomer.phone : '',
            shopId: DEFAULT_SHOP_ID,
            branchId: DEFAULT_BRANCH_ID,
            status: paymentMethod === 'credit' ? ORDER_STATUS.PAYMENT_PENDING : ORDER_STATUS.CONFIRMED,
            totalAmount: total,
            paidAmount: paymentMethod === 'credit' ? 0 : total,
            dueAmount: paymentMethod === 'credit' ? total : 0,
            paymentStatus: paymentMethod === 'credit' ? PAYMENT_STATUS.CREDIT : PAYMENT_STATUS.PAID,
            paymentMethod: paymentMethod === 'cash' ? PAYMENT_METHODS.CASH : (paymentMethod === 'card' ? PAYMENT_METHODS.CARD : (paymentMethod === 'credit' ? PAYMENT_METHODS.CREDIT : PAYMENT_METHODS.UPI)),
            items: cart,
            statusHistory: [{ status: paymentMethod === 'credit' ? ORDER_STATUS.CREDIT : ORDER_STATUS.CONFIRMED, updatedBy: 'POS System', timestamp: new Date().toISOString() }],
            expectedDeliveryDate,
            specialInstructions
          } 
        }));

        if (paymentMethod === 'credit' && selectedCustomer) {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance + ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [total, new Date().toISOString(), selectedCustomer.id]
          );
        }

        // Record Transaction in Accounts
        const txnId = `TXN-${Date.now()}`;
        const txnTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
        const accountType = (paymentMethod === 'card' || paymentMethod === 'wallet') ? 'BANK' : 'CASH';
        
        if (paymentMethod !== 'credit') {
          const desc = `Order ${orderId}${accountType === 'BANK' ? ` via ${selectedBank}` : ''}`;
          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [txnId, DEFAULT_SHOP_ID, accountType, 'INCOME', 'Sales', total, desc, txnTimestamp, 0, new Date().toISOString(), 'ShoppingBag', accountType === 'BANK' ? selectedBank : null]
          );
        }

        navigate(`/invoice/${orderId.replace('#', '')}?print=true`);
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
        await window.electronAPI.dbQuery(
          `INSERT INTO orders 
           (id, shopId, billNumber, branchId, customerId, status, totalAmount, paidAmount, dueAmount, items, statusHistory, createdAt, updatedAt, paymentStatus, isSynced, paymentMethod, expectedDeliveryDate, specialInstructions) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            DEFAULT_SHOP_ID,
            billNumber,
            DEFAULT_BRANCH_ID,
            selectedCustomer ? selectedCustomer.id : 'Walk-in',
            ORDER_STATUS.PAYMENT_PENDING,
            total,
            0,
            total,
            JSON.stringify(cart),
            JSON.stringify([{ status: ORDER_STATUS.PAYMENT_PENDING, updatedBy: 'POS System', timestamp: new Date().toISOString() }]),
            new Date().toISOString(),
            new Date().toISOString(),
            PAYMENT_STATUS.CREDIT,
            0,
            PAYMENT_METHODS.CREDIT,
            expectedDeliveryDate,
            specialInstructions
          ]
        );

        // Update customer balance in DB
        if (selectedCustomer) {
          await window.electronAPI.dbQuery('UPDATE customers SET balance = balance + ?, isSynced = 0, updatedAt = ? WHERE id = ?', [total, new Date().toISOString(), selectedCustomer.id]);
        }

        if (window.electronAPI?.runDataHealer) {
          await window.electronAPI.runDataHealer();
        }

        // Trigger local event
        window.dispatchEvent(new CustomEvent('order-created', { 
          detail: { 
            id: orderId,
            customerId: selectedCustomer ? selectedCustomer.id : 'Walk-in',
            customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
            customerPhone: selectedCustomer ? selectedCustomer.phone : '',
            shopId: DEFAULT_SHOP_ID,
            branchId: DEFAULT_BRANCH_ID,
            status: ORDER_STATUS.PAYMENT_PENDING,
            totalAmount: total,
            paidAmount: 0,
            dueAmount: total,
            paymentStatus: PAYMENT_STATUS.CREDIT,
            paymentMethod: PAYMENT_METHODS.CREDIT,
            items: cart,
            statusHistory: [{ status: ORDER_STATUS.PAYMENT_PENDING, updatedBy: 'POS System', timestamp: new Date().toISOString() }],
            expectedDeliveryDate,
            specialInstructions
          } 
        }));

        // Sync to MongoDB Backend
        try {
          await axios.post(`${API_BASE_URL}/orders`, {
            id: orderId,
            billNumber,
            customerId: selectedCustomer ? selectedCustomer.id : 'Walk-in',
            customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
            customerPhone: selectedCustomer ? selectedCustomer.phone : '',
            shopId: DEFAULT_SHOP_ID,
            branchId: DEFAULT_BRANCH_ID,
            status: ORDER_STATUS.PAYMENT_PENDING,
            totalAmount: total,
            paidAmount: 0,
            dueAmount: total,
            paymentStatus: PAYMENT_STATUS.CREDIT,
            paymentMethod: PAYMENT_METHODS.CREDIT.toUpperCase(),
            items: cart,
            statusHistory: [{ status: ORDER_STATUS.PAYMENT_PENDING, updatedBy: 'POS System', timestamp: new Date().toISOString() }],
            expectedDeliveryDate,
            specialInstructions
          });
        } catch (syncErr) {
          console.warn('Backend sync failed, but local order saved:', syncErr);
        }

        let freshBalance = (selectedCustomer?.balance || 0) + total;
        if (selectedCustomer) {
          const res = await window.electronAPI.dbQuery('SELECT balance FROM customers WHERE id = ?', [selectedCustomer.id]);
          if (res.success && res.data.length > 0) {
            freshBalance = res.data[0].balance;
          }
        }

        setLastOrderInfo({
          orderId,
          total,
          customerName: selectedCustomer.name,
          customerPhone: selectedCustomer.phone,
          newBalance: freshBalance
        });
        
        setShowSuccessModal(true);
        setCart([]);
        setExpectedDeliveryDate(getTomorrowDateString());
        setSpecialInstructions('');
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
                  {item.description && (
                    <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600, marginTop: '0.15rem' }}>
                      ⚠️ Damage Notes: {item.description}
                    </span>
                  )}
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

          {(paymentMethod === 'card' || paymentMethod === 'wallet') && settings.bankAccounts?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3 className={styles.modalSectionTitle}>Select Bank Account</h3>
              <div className={styles.inputWrapper} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.25rem 0.5rem' }}>
                <Landmark size={18} color="#2563EB" />
                <select 
                  className={styles.inputField} 
                  style={{ border: 'none', width: '100%', outline: 'none' }}
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
            <input 
              type="text" 
              placeholder="Search items..." 
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
          </div>
          <button className={styles.manageCustBtn} onClick={() => navigate('/customers')}>
            <User size={18} /> Customers
          </button>
        </div>

        <div className={styles.categoriesRow}>
          <div className={styles.categoryTabs}>
            <button 
              className={`${styles.categoryTab} ${selectedCategory === 'All' ? styles.active : ''}`}
              onClick={() => setSelectedCategory('All')}
            >
              All Services
            </button>
            {categories.map(cat => (
              <button 
                key={cat.id} 
                className={`${styles.categoryTab} ${selectedCategory === cat.name ? styles.active : ''}`}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className={styles.activeStation}>
            <span className={styles.statusDot}></span>
            Active Station
          </div>
        </div>

        <div className={styles.itemsGrid}>
          {services
            .filter(s => {
              const matchesSearch = s.name.toLowerCase().includes(itemSearch.toLowerCase());
              const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
              return matchesSearch && (itemSearch ? true : matchesCategory);
            })
            .map((service) => (
            <div key={service.id} className={styles.itemCard} onClick={() => handleServiceClick(service)}>
              <div className={styles.itemIcon}>
                {service.image ? (
                  <img src={service.image} alt={service.name} className={styles.itemImg} />
                ) : getIcon(service.icon)}
              </div>
              <span className={styles.itemName}>{service.name}</span>
              <span className={styles.itemPrice}><CurrencySymbol size={16} /> {service.price.toFixed(2)}</span>
            </div>
          ))}
          <div className={`${styles.itemCard} ${styles.addItemCard}`} style={{ borderStyle: 'solid', borderColor: '#3B82F6', background: '#EFF6FF', cursor: 'pointer' }} onClick={() => handleServiceClick({ id: 'temp-' + Date.now(), name: '', price: 0, icon: 'Package', isTemporary: true })}>
            <Plus size={32} color="#2563EB" />
            <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#2563EB', marginTop: '0.5rem' }}>TEMPORARY ITEM</span>
          </div>
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
                    {selectedCustomer.balance !== 0 && (
                      <span className={selectedCustomer.balance > 0 ? styles.overdueBadge : styles.advanceBadge}>
                        {selectedCustomer.balance > 0 ? 'Overdue: ' : 'Advance: '} 
                        <CurrencySymbol size={10} /> {Math.abs(selectedCustomer.balance).toFixed(2)}
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
          <Trash2 size={18} className={styles.clearCart} onClick={() => { setCart([]); setExpectedDeliveryDate(getTomorrowDateString()); setSpecialInstructions(''); }} />
        </div>

        <div className={styles.cartMetadata}>
          <div className={styles.metadataRow}>
            <label className={styles.metadataLabel}>
              <Calendar size={13} style={{ marginRight: '4px' }} />
              Expected Delivery Date
            </label>
            <input 
              type="date" 
              className={styles.metadataInput}
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
          </div>
          <div className={styles.metadataRow}>
            <label className={styles.metadataLabel}>
              <FileText size={13} style={{ marginRight: '4px' }} />
              ⚠️ Special Instructions
            </label>
            <input 
              type="text" 
              className={styles.metadataInput}
              placeholder="e.g. Starch, hang, handle with care..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
            />
          </div>
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
                {item.description && (
                  <span className={styles.cartItemRemarks}>
                    ⚠️ Fabric Notes: {item.description}
                  </span>
                )}
                {item.addons && item.addons.length > 0 && (
                  <span className={styles.cartItemAddons}>
                    + {item.addons.join(', ')}
                  </span>
                )}
              </div>
              <div className={styles.cartItemActions}>
                <div className={styles.qtyControl}>
                  <button className={styles.qtyBtn} onClick={() => updateCartQty(idx, -1)} title="Decrease quantity"><Minus size={12} /></button>
                  <span className={styles.qtyValue}>{item.qty}</span>
                  <button className={styles.qtyBtn} onClick={() => updateCartQty(idx, 1)} title="Increase quantity"><Plus size={12} /></button>
                </div>
                <div className={styles.cartItemRight}>
                  <span className={styles.cartItemPrice}><CurrencySymbol size={12} /> {(item.price * item.qty).toFixed(2)}</span>
                  <button className={styles.cartItemEditBtn} onClick={() => handleEditCartItem(idx)} title="Edit item">
                    <Edit3 size={13} />
                  </button>
                  <button className={styles.cartItemDeleteBtn} onClick={() => removeCartItem(idx)} title="Remove item">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
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
            {selectedCustomer && selectedCustomer.balance > 0 && (
              <button 
                className={styles.overdueBtn} 
                onClick={() => navigate(`/overdue-statement/${selectedCustomer.id}`)}
              >
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
          <div className={`${styles.modal} ${selectedService.isTemporary ? styles.tempModal : ''}`}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <div className={styles.modalHeaderIcon}>
                  {selectedService.isTemporary ? <Package size={24} /> : getIcon(selectedService.icon, 24)}
                </div>
                <div>
                  <h2>{selectedService.isTemporary ? 'Add Custom Temporary Item' : selectedService.name}</h2>
                  <p>{selectedService.isTemporary ? 'Enter name, price, and options' : selectedService.category || 'Configure Service Options'}</p>
                </div>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => { setSelectedService(null); setEditingCartIdx(null); }} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {selectedService.isTemporary && (
                <div className={styles.tempFormGroup}>
                  <label htmlFor="tempItemName">Item Name / Description</label>
                  <input 
                    id="tempItemName"
                    type="text" 
                    placeholder="e.g. Special Silk Dress, Custom Alteration..." 
                    value={selectedService.name} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedService(prev => ({ ...prev, name: val }));
                    }}
                    className={styles.tempInput}
                  />
                </div>
              )}

              {!selectedService.isTemporary && (
                <>
                  <div className={styles.modalSection}>
                    <h3 className={styles.modalSectionTitle}>Treatment / Service Type</h3>
                    <div className={styles.serviceTypeGrid}>
                      {serviceTypes.map(type => {
                        const isSelected = serviceConfig.types.includes(type.id);
                        return (
                          <div 
                            key={type.id} 
                            className={`${styles.serviceTypeCard} ${isSelected ? styles.active : ''}`}
                            onClick={() => toggleServiceType(type.id)}
                          >
                            <div className={styles.selectionIndicator}>
                              <div className={styles.checkboxOutline}>
                                {isSelected && <CheckCircle size={10} className={styles.checkIconMini} />}
                              </div>
                            </div>
                            <div className={styles.serviceTypeIcon}>{getIcon(type.icon, 16)}</div>
                            <span className={styles.serviceTypeName}>{type.name}</span>
                            <span className={styles.serviceTypePrice}>+ {formatCurrency(type.price)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.modalSection}>
                    <h3 className={styles.modalSectionTitle}>Add-ons & Enhancements</h3>
                    <div className={styles.addonChipsContainer}>
                      {addons.map(addon => {
                        const isSelected = serviceConfig.addons.includes(addon.id);
                        return (
                          <div 
                            key={addon.id} 
                            className={`${styles.addonChip} ${isSelected ? styles.active : ''}`}
                            onClick={() => toggleAddon(addon.id)}
                          >
                            <div className={styles.addonCheckbox}>
                              {isSelected && <CheckCircle size={12} className={styles.checkIconMini} />}
                            </div>
                            <span className={styles.addonChipName}>{addon.name}</span>
                            <span className={styles.addonChipPrice}>+{formatCurrency(addon.price)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className={styles.gridTwoColumns}>
                <div className={styles.modalSection}>
                  <label className={styles.fieldLabel} htmlFor="customPriceInput">
                    <span>Unit Price Override</span>
                    <span className={styles.fieldSub}>
                      {selectedService.isTemporary ? 'Set custom item price' : `Base + options: ${formatCurrency(activeCalculatedPrice)}`}
                    </span>
                  </label>
                  <div className={styles.priceInputWrapper}>
                    <div className={styles.currencyPrefix}>
                      <CurrencySymbol size={16} />
                    </div>
                    <input 
                      id="customPriceInput"
                      type="number" 
                      step="0.01"
                      min="0"
                      placeholder={activeCalculatedPrice.toFixed(2)}
                      value={serviceConfig.customPrice ?? ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setServiceConfig(prev => ({ ...prev, customPrice: val === '' ? null : val }));
                      }}
                      className={styles.priceInput}
                    />
                  </div>
                </div>

                <div className={styles.modalSection}>
                  <label className={styles.fieldLabel} htmlFor="qtyInput">
                    <span>Quantity</span>
                    <span className={styles.fieldSub}>Number of identical items</span>
                  </label>
                  <div className={styles.qtyControlLarge}>
                    <button 
                      type="button" 
                      className={styles.qtyLargeBtn} 
                      onClick={() => setServiceConfig(prev => ({ ...prev, qty: Math.max(1, prev.qty - 1) }))}
                    >
                      <Minus size={16} />
                    </button>
                    <input 
                      id="qtyInput"
                      type="number" 
                      value={serviceConfig.qty} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setServiceConfig(prev => ({ ...prev, qty: isNaN(val) || val < 1 ? 1 : val }));
                      }}
                      className={styles.qtyLargeInput}
                    />
                    <button 
                      type="button" 
                      className={`${styles.qtyLargeBtn} ${styles.primary}`} 
                      onClick={() => setServiceConfig(prev => ({ ...prev, qty: prev.qty + 1 }))}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.modalSection}>
                <label className={styles.fieldLabel} htmlFor="damageRemarks">
                  <span>Damage Remarks / Fabric Notes</span>
                  <span className={styles.fieldSub}>Describe stains, tears, fading, or special requirements</span>
                </label>
                <textarea 
                  id="damageRemarks"
                  placeholder="e.g., Small yellow stain on collar, missing middle button, handle with care..." 
                  value={serviceConfig.description || ''} 
                  onChange={(e) => setServiceConfig(prev => ({ ...prev, description: e.target.value }))}
                  className={styles.remarksTextarea}
                />
              </div>
            </div>

            <div className={styles.modalFooterRedesign}>
              <button className={styles.modalCancelBtn} onClick={() => { setSelectedService(null); setEditingCartIdx(null); }}>
                Cancel
              </button>
              <button className={styles.modalSubmitBtn} onClick={addToCart}>
                <ShoppingBag size={18} />
                <span>Add to Cart • {formatCurrency(getModalPrice())}</span>
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
                <div className={styles.formGroup}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>CREDIT LIMIT (OPTIONAL)</label>
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
                <span>
                  {lastOrderInfo.newBalance > 0 
                    ? 'Customer Balance (Due)' 
                    : lastOrderInfo.newBalance < 0 
                      ? 'Customer Balance (Advance)' 
                      : 'Customer Balance'}
                </span>
                <span 
                  className={styles.summaryValue} 
                  style={{ 
                    color: lastOrderInfo.newBalance > 0 
                      ? '#EF4444' 
                      : lastOrderInfo.newBalance < 0 
                        ? '#10B981' 
                        : '#64748B' 
                  }}
                >
                  {lastOrderInfo.newBalance !== 0 ? (
                    <>
                      <CurrencySymbol size={14} /> {Math.abs(lastOrderInfo.newBalance).toFixed(2)}
                    </>
                  ) : (
                    'Settled'
                  )}
                </span>
              </div>

              <div className={styles.successActions}>
                <button 
                  className={styles.waSuccessBtn}
                  onClick={() => {
                    const balMsg = lastOrderInfo.newBalance > 0 
                      ? `Your outstanding due is ${formatCurrency(lastOrderInfo.newBalance)}` 
                      : lastOrderInfo.newBalance < 0 
                        ? `Your prepaid advance is ${formatCurrency(Math.abs(lastOrderInfo.newBalance))}` 
                        : `Your balance is settled`;
                    const msg = `Hello ${lastOrderInfo.customerName}! Your laundry bill for ${lastOrderInfo.orderId} of ${formatCurrency(lastOrderInfo.total)} has been saved. ${balMsg}. Thank you!`;
                    handleWhatsApp(lastOrderInfo.customerPhone, msg);
                  }}
                >
                  <MessageCircle size={20} /> Send via WhatsApp
                </button>
                <button 
                  className={styles.printSuccessBtn}
                  onClick={() => {
                    navigate(`/invoice/${lastOrderInfo.orderId.replace('#', '')}?print=true`);
                  }}
                >
                  <Printer size={20} /> Print Receipt
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
