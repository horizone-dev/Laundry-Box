import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, ShoppingBag, Trash2, CheckCircle,
  X, ChevronDown, Shirt, Bed, Wind, Layers, Package,
  Droplet, Zap, Heart, Sparkles, User, CreditCard, Wallet,
  Gift, Printer, Receipt, Edit3, UserPlus, Phone, MapPin, MessageCircle, Landmark,
  Calendar, FileText, AlertTriangle, AlertCircle, Info, Lock, Clock
} from 'lucide-react';
import axios from 'axios';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import { DEFAULT_SHOP_ID, DEFAULT_BRANCH_ID, API_BASE_URL, CATEGORIES, PAYMENT_STATUS, ORDER_STATUS, PAYMENT_METHODS } from '../constants';
import { t } from '../utils/translations';
import { getLocalISOString, getLocalDateTime } from '../utils/dateUtils';
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
  const [serviceConfig, setServiceConfig] = useState({ selectedTypeIds: [], addons: [], qty: 1, customPrice: null, description: '' });
  const [editingCartIdx, setEditingCartIdx] = useState(null); // index of cart item being edited

  const servicePricing = React.useMemo(() => {
    if (!selectedService || selectedService.isTemporary) return [];
    try {
      return typeof selectedService.pricing === 'string'
        ? JSON.parse(selectedService.pricing || '[]')
        : (selectedService.pricing || []);
    } catch (e) {
      return [];
    }
  }, [selectedService]);

  const availableTypesForService = React.useMemo(() => {
    if (!selectedService || selectedService.isTemporary) return [];
    return servicePricing.map(p => {
      const globalType = serviceTypes.find(t => t.id === p.serviceTypeId);
      return {
        id: p.serviceTypeId,
        name: globalType ? globalType.name : 'Unknown Type',
        icon: globalType ? globalType.icon : 'Shirt',
        price: p.price
      };
    }).filter(t => t.id);
  }, [selectedService, servicePricing, serviceTypes]);

  const selectedTypePrice = React.useMemo(() => {
    if (!selectedService || selectedService.isTemporary) return 0;
    const matches = servicePricing.filter(p => (serviceConfig.selectedTypeIds || []).includes(p.serviceTypeId));
    return matches.reduce((sum, p) => sum + (p.price || 0), 0);
  }, [selectedService, servicePricing, serviceConfig.selectedTypeIds]);

  const activeSelectedAddons = selectedService ? addons.filter(a => serviceConfig.addons.includes(a.id)) : [];
  const activeAddonPrice = activeSelectedAddons.reduce((sum, a) => sum + a.price, 0);
  const activeCalculatedPrice = selectedService?.isTemporary
    ? (selectedService.price || 0)
    : (selectedTypePrice + activeAddonPrice);

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
  const [expectedDeliveryTime, setExpectedDeliveryTime] = useState('17:00');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showSpecialPresets, setShowSpecialPresets] = useState(false);
  const [showItemPresets, setShowItemPresets] = useState(false);

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

  // Credit Limit Protection states
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [showManagerPinModal, setShowManagerPinModal] = useState(false);
  const [creditWarningDetails, setCreditWarningDetails] = useState(null);
  const [managerPinValue, setManagerPinValue] = useState('');
  const [managerPinError, setManagerPinError] = useState('');
  const [pendingOrderAction, setPendingOrderAction] = useState(null); // 'completePayment' or 'saveOrder'
  const [pendingOrderId, setPendingOrderId] = useState(null);

  const checkCreditLimitBeforeAction = (actionType) => {
    if (!selectedCustomer || selectedCustomer.id === 'Walk-in') return false;
    if (!settings.enableCreditLimitProtection) return false;

    if (actionType === 'saveOrder' || (actionType === 'completePayment' && paymentMethod === 'credit')) {
      const currentOutstanding = selectedCustomer.balance || 0;
      const creditLimit = selectedCustomer.creditLimit !== undefined && selectedCustomer.creditLimit !== null && selectedCustomer.creditLimit !== 0
        ? selectedCustomer.creditLimit
        : (settings.defaultCreditLimit ?? 500);
      const orderAmount = total;
      const newOutstanding = currentOutstanding + orderAmount;

      // Block if ALREADY at/over limit OR if new order would exceed limit
      if (currentOutstanding >= creditLimit || newOutstanding > creditLimit) {
        const exceededAmount = newOutstanding > creditLimit
          ? newOutstanding - creditLimit
          : currentOutstanding - creditLimit + orderAmount;
        const overrideAllowed = true;

        // Pre-generate orderId if not already generated
        const generatedId = pendingOrderId || `#AG-${Math.floor(10000 + Math.random() * 90000)}`;
        setPendingOrderId(generatedId);

        setCreditWarningDetails({
          orderId: generatedId,
          customerName: selectedCustomer.name,
          creditLimit,
          currentOutstanding,
          orderAmount,
          newOutstanding,
          exceededAmount: Math.max(0, exceededAmount),
          overrideAllowed
        });
        setPendingOrderAction(actionType);
        setShowCreditWarning(true);
        return true; // blocked
      }
    }
    return false; // allowed
  };

  const handleVerifyManagerPin = async (e) => {
    e.preventDefault();
    setManagerPinError('');
    const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
    const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
    const userId = `${userRole}: ${userSession.name || userSession.username || 'User'}`;

    try {
      const res = await window.electronAPI.verifyManagerPin({
        pin: managerPinValue,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        orderId: creditWarningDetails?.orderId || pendingOrderId,
        creditLimit: creditWarningDetails.creditLimit,
        outstandingBalance: creditWarningDetails.currentOutstanding,
        orderAmount: creditWarningDetails.orderAmount,
        exceededAmount: creditWarningDetails.exceededAmount,
        userId
      });

      if (res.success) {
        // Close all modals first, then execute the action after React re-renders
        setShowManagerPinModal(false);
        setShowCreditWarning(false);
        setManagerPinValue('');

        const action = pendingOrderAction;
        setTimeout(() => {
          if (action === 'completePayment') {
            handleCompletePayment(true);
          } else if (action === 'saveOrder') {
            handleSaveOrder(true);
          }
        }, 50);
      } else {
        setManagerPinError(res.error || "Incorrect PIN! Access Denied.");
      }
    } catch (err) {
      setManagerPinError("An error occurred during verification");
    }
  };

  const handleCancelOverride = async () => {
    const userSession = JSON.parse(sessionStorage.getItem('user') || '{}');
    const userRole = userSession.role ? (userSession.role === 'super_admin' ? 'Super Admin' : userSession.role.charAt(0).toUpperCase() + userSession.role.slice(1).replace('_', ' ')) : 'Staff';
    const userId = `${userRole}: ${userSession.name || userSession.username || 'User'}`;

    try {
      await window.electronAPI.logOverrideRejection({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        orderId: creditWarningDetails?.orderId || pendingOrderId,
        creditLimit: creditWarningDetails.creditLimit,
        outstandingBalance: creditWarningDetails.currentOutstanding,
        orderAmount: creditWarningDetails.orderAmount,
        exceededAmount: creditWarningDetails.exceededAmount,
        userId,
        actionType: 'REJECTED'
      });
    } catch (err) {
      console.error("Failed to log override rejection:", err);
    }

    setShowCreditWarning(false);
    setShowManagerPinModal(false);
    setManagerPinValue('');
    setManagerPinError('');
    setPendingOrderId(null);
  };

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
    const timestamp = getLocalISOString();

    if (window.electronAPI?.dbQuery) {
      try {
        const res = await window.electronAPI.dbQuery('SELECT id FROM customers');
        let nextNum = 1;
        if (res.success && res.data) {
          const numbers = res.data.map(c => {
            const parts = c.id.split('-');
            const num = parseInt(parts[1]);
            return isNaN(num) || num > 999999 ? 0 : num;
          });
          nextNum = Math.max(0, ...numbers) + 1;
        }
        const id = `CUST-${nextNum}`;

        await window.electronAPI.dbQuery(
          'INSERT INTO customers (id, shopId, name, phone, email, address, creditLimit, isSynced, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, DEFAULT_SHOP_ID, customerFormData.name, customerFormData.phone, '', customerFormData.address, 0, 0, timestamp]
        );
        handleSelectCustomer({ id, ...customerFormData });
        setShowCustomerModal(false);
        setCustomerFormData({ name: '', phone: '', address: '' });
      } catch (err) {
        console.error("Failed to save customer:", err);
      }
    } else {
      const id = `CUST-temp`;
      handleSelectCustomer({ id, ...customerFormData });
      setShowCustomerModal(false);
    }
  };

  // POS Features
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [itemSearch, setItemSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState('flat'); // 'flat' or 'percent'
  const [discountInput, setDiscountInput] = useState('');

  const handleDiscount = () => {
    setDiscountInput(discount > 0 ? discount.toString() : '');
    setDiscountType('flat');
    setShowDiscountModal(true);
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
    let defaultTypeId = '';
    let parsedPricing = [];
    try {
      parsedPricing = typeof service.pricing === 'string' ? JSON.parse(service.pricing || '[]') : (service.pricing || []);
    } catch (e) { }
    if (parsedPricing.length > 0) {
      defaultTypeId = parsedPricing[0].serviceTypeId;
    } else if (serviceTypes.length > 0) {
      defaultTypeId = serviceTypes[0].id;
    }
    setServiceConfig({ selectedTypeIds: defaultTypeId ? [defaultTypeId] : [], addons: [], qty: 1, customPrice: null, description: '' });
  };

  const addToCart = () => {
    if (!selectedService) return;

    if (selectedService.isTemporary && !selectedService.name.trim()) {
      alert("Please enter a name for the temporary item.");
      return;
    }

    if (!selectedService.isTemporary && (!serviceConfig.selectedTypeIds || serviceConfig.selectedTypeIds.length === 0)) {
      alert("Please select at least one treatment/service type.");
      return;
    }

    if (selectedService.isTemporary) {
      const unitPrice = serviceConfig.customPrice !== null && serviceConfig.customPrice !== ''
        ? parseFloat(serviceConfig.customPrice)
        : activeCalculatedPrice;

      const newItem = {
        id: editingCartIdx !== null ? cart[editingCartIdx].id : Date.now().toString(),
        serviceId: selectedService.id,
        name: selectedService.name.trim(),
        price: unitPrice,
        type: 'Custom',
        types: [{ id: 'custom', name: 'Custom', price: unitPrice }],
        addons: [],
        qty: serviceConfig.qty,
        taxRate: selectedService.taxRate || settings.taxRate || 0,
        description: serviceConfig.description || '',
        category: selectedService.category || 'Standard'
      };

      if (editingCartIdx !== null) {
        const newCart = [...cart];
        newCart[editingCartIdx] = newItem;
        setCart(newCart);
        setEditingCartIdx(null);
      } else {
        setCart([...cart, newItem]);
      }
    } else {
      // Gather all selected types
      const selectedTypes = serviceConfig.selectedTypeIds.map(typeId => {
        const selectedTypeObj = availableTypesForService.find(t => t.id === typeId);
        return {
          id: typeId,
          name: selectedTypeObj ? selectedTypeObj.name : 'Unknown',
          price: selectedTypeObj ? parseFloat(selectedTypeObj.price || 0) : 0
        };
      });

      const sumTypesPrice = selectedTypes.reduce((sum, t) => sum + t.price, 0);
      const calculatedUnitPrice = sumTypesPrice + activeAddonPrice;
      const finalPrice = serviceConfig.customPrice !== null && serviceConfig.customPrice !== ''
        ? parseFloat(serviceConfig.customPrice)
        : calculatedUnitPrice;

      const joinedTypeName = selectedTypes.map(t => t.name).join(' + ');

      const newItem = {
        id: editingCartIdx !== null ? cart[editingCartIdx].id : Date.now().toString(),
        serviceId: selectedService.id,
        name: selectedService.name.trim(),
        price: finalPrice,
        type: joinedTypeName, // legacy fallback type string
        types: selectedTypes,  // new types array
        addons: activeSelectedAddons.map(a => a.name),
        qty: serviceConfig.qty,
        taxRate: selectedService.taxRate || settings.taxRate || 0,
        description: serviceConfig.description || '',
        category: selectedService.category || 'Standard'
      };

      if (editingCartIdx !== null) {
        const newCart = [...cart];
        newCart[editingCartIdx] = newItem;
        setCart(newCart);
        setEditingCartIdx(null);
      } else {
        setCart([...cart, newItem]);
      }
    }

    setSelectedService(null);
    setItemSearch('');
    setShowItemPresets(false);
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
    const svc = services.find(s => s.id === item.serviceId || s.name === item.name) || {
      id: item.serviceId || 'temp',
      name: item.name,
      price: item.price,
      icon: 'Package',
      isTemporary: !services.find(s => s.name === item.name)
    };

    // Resolve type IDs from item.types, falling back to split item.type (legacy)
    let resolvedTypeIds = [];
    if (item.types && Array.isArray(item.types) && item.types.length > 0) {
      resolvedTypeIds = item.types.map(t => t.id);
    } else if (item.type) {
      const typeNames = item.type.split(' + ');
      resolvedTypeIds = typeNames.map(name => {
        const matchingType = serviceTypes.find(t => t.name === name);
        return matchingType ? matchingType.id : '';
      }).filter(Boolean);
    }

    // Resolve addon IDs from names
    const resolvedAddonIds = addons
      .filter(a => (item.addons || []).includes(a.name))
      .map(a => a.id);

    setEditingCartIdx(idx);
    setSelectedService(svc);
    setServiceConfig({
      selectedTypeIds: resolvedTypeIds,
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
      const isSelected = (prev.selectedTypeIds || []).includes(id);
      const newTypeIds = isSelected
        ? prev.selectedTypeIds.filter(x => x !== id)
        : [...prev.selectedTypeIds, id];
      return {
        ...prev,
        selectedTypeIds: newTypeIds
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

  const handleCompletePayment = async (isOverridden = false) => {
    if (!isOverridden && checkCreditLimitBeforeAction('completePayment')) {
      return;
    }
    const orderId = pendingOrderId || `#AG-${Math.floor(10000 + Math.random() * 90000)}`;
    const billNumber = `BN-${Date.now().toString().slice(-6)}`;
    const combinedExpectedDelivery = expectedDeliveryDate ? `${expectedDeliveryDate} ${expectedDeliveryTime || '17:00'}` : '';

    if (window.electronAPI?.dbQuery) {
      try {
        const insertResult = await window.electronAPI.dbQuery(
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
            JSON.stringify([{ status: paymentMethod === 'credit' ? ORDER_STATUS.CREDIT : ORDER_STATUS.CONFIRMED, updatedBy: 'POS System', timestamp: getLocalISOString() }]),
            getLocalISOString(),
            0,
            getLocalISOString(),
            paymentMethod === 'cash' ? PAYMENT_METHODS.CASH : (paymentMethod === 'bank' ? PAYMENT_METHODS.BANK : PAYMENT_METHODS.NOT_PAID),
            combinedExpectedDelivery,
            specialInstructions
          ]
        );

        // CRITICAL: If DB blocked the insert (e.g. credit limit), stop here and show the override modal
        if (!insertResult || !insertResult.success) {
          const errMsg = insertResult?.error || '';
          if (errMsg.includes('CREDIT_LIMIT_EXCEEDED') || errMsg.includes('Credit limit exceeded')) {
            const currentOutstanding = selectedCustomer?.balance || 0;
            const creditLimit = (selectedCustomer?.creditLimit && selectedCustomer.creditLimit !== 0)
              ? selectedCustomer.creditLimit
              : (settings.defaultCreditLimit ?? 500);
            const newOutstanding = currentOutstanding + total;
            setCreditWarningDetails({
              orderId: orderId,
              customerName: selectedCustomer?.name,
              creditLimit,
              currentOutstanding,
              orderAmount: total,
              newOutstanding,
              exceededAmount: Math.max(0, newOutstanding - creditLimit),
              overrideAllowed: true
            });
            setPendingOrderId(orderId);
            setPendingOrderAction('completePayment');
            setShowCreditWarning(true);
          } else {
            alert('Failed to save order: ' + (errMsg || 'Unknown error'));
          }
          return; // STOP — do not proceed
        }

        // Sync to MongoDB Backend (Background invocation - non-blocking)
        axios.post(`${API_BASE_URL}/orders`, {
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
          paymentMethod: paymentMethod === 'cash' ? PAYMENT_METHODS.CASH : (paymentMethod === 'bank' ? PAYMENT_METHODS.BANK : PAYMENT_METHODS.NOT_PAID),
          items: cart,
          statusHistory: [{ status: paymentMethod === 'credit' ? ORDER_STATUS.CREDIT : ORDER_STATUS.CONFIRMED, updatedBy: 'POS System', timestamp: getLocalISOString() }],
          expectedDeliveryDate: combinedExpectedDelivery,
          specialInstructions
        }).catch(syncErr => {
          console.warn('Backend sync failed, but local order saved:', syncErr);
        });

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
            paymentMethod: paymentMethod === 'cash' ? PAYMENT_METHODS.CASH : (paymentMethod === 'bank' ? PAYMENT_METHODS.BANK : PAYMENT_METHODS.NOT_PAID),
            items: cart,
            statusHistory: [{ status: paymentMethod === 'credit' ? ORDER_STATUS.CREDIT : ORDER_STATUS.CONFIRMED, updatedBy: 'POS System', timestamp: getLocalISOString() }],
            expectedDeliveryDate: combinedExpectedDelivery,
            specialInstructions
          }
        }));

        if (paymentMethod === 'credit' && selectedCustomer) {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance + ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [total, getLocalISOString(), selectedCustomer.id]
          );
        }

        // Record Transaction in Accounts
        const txnId = `TXN-${Date.now()}`;
        const _nowP = new Date();
        const txnTimestamp = `${_nowP.getFullYear()}-${String(_nowP.getMonth()+1).padStart(2,'0')}-${String(_nowP.getDate()).padStart(2,'0')} ${String(_nowP.getHours()).padStart(2,'0')}:${String(_nowP.getMinutes()).padStart(2,'0')}`;
        const accountType = paymentMethod === 'bank' ? 'BANK' : 'CASH';

        if (paymentMethod !== 'credit') {
          const desc = `Order ${orderId}${accountType === 'BANK' ? ` via ${selectedBank}` : ''}`;
          const mappedBankId = accountType === 'BANK' ? (settings.bankAccounts?.find(acc => acc.bankName === selectedBank || acc.id === selectedBank)?.id || selectedBank) : null;
          await window.electronAPI.dbQuery(
            `INSERT INTO account_transactions 
             (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [txnId, DEFAULT_SHOP_ID, accountType, 'INCOME', 'Sales', total, desc, txnTimestamp, 0, getLocalISOString(), 'ShoppingBag', mappedBankId]
          );
        }

        setPendingOrderId(null);
        navigate(`/invoice/${orderId.replace('#', '')}?print=true`);
      } catch (err) {
        console.error("Failed to save order:", err);
        // If DB-level credit limit check blocked the order, show the override modal
        if (err?.message?.includes('CREDIT_LIMIT_EXCEEDED') || err?.message?.includes('Credit limit exceeded')) {
          const currentOutstanding = selectedCustomer?.balance || 0;
          const creditLimit = selectedCustomer?.creditLimit && selectedCustomer.creditLimit !== 0
            ? selectedCustomer.creditLimit
            : (settings.defaultCreditLimit ?? 500);
          const orderAmount = total;
          const newOutstanding = currentOutstanding + orderAmount;
          const generatedId = pendingOrderId || `#AG-${Math.floor(10000 + Math.random() * 90000)}`;
          setPendingOrderId(generatedId);
          setCreditWarningDetails({
            orderId: generatedId,
            customerName: selectedCustomer?.name,
            creditLimit,
            currentOutstanding,
            orderAmount,
            newOutstanding,
            exceededAmount: Math.max(0, newOutstanding - creditLimit),
            overrideAllowed: true
          });
          setPendingOrderAction('completePayment');
          setShowCreditWarning(true);
        } else {
          alert("CRITICAL ERROR: Failed to save order to local database. Please check logs.");
        }
      }
    } else {
      alert("Electron API not found. Order cannot be saved locally.");
    }
  };

  const handleSaveOrder = async (isOverridden = false) => {
    if (cart.length === 0) return;

    if (!selectedCustomer) {
      alert("Please select or add a customer to save the bill.");
      return;
    }

    if (!isOverridden && checkCreditLimitBeforeAction('saveOrder')) {
      return;
    }

    const orderId = pendingOrderId || `#AG-${Math.floor(10000 + Math.random() * 90000)}`;
    const billNumber = `BN-${Date.now().toString().slice(-6)}`;
    const combinedExpectedDelivery = expectedDeliveryDate ? `${expectedDeliveryDate} ${expectedDeliveryTime || '17:00'}` : '';

    if (window.electronAPI?.dbQuery) {
      try {
        const insertResult = await window.electronAPI.dbQuery(
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
            JSON.stringify([{ status: ORDER_STATUS.PAYMENT_PENDING, updatedBy: 'POS System', timestamp: getLocalISOString() }]),
            getLocalISOString(),
            getLocalISOString(),
            PAYMENT_STATUS.CREDIT,
            0,
            PAYMENT_METHODS.NOT_PAID,
            combinedExpectedDelivery,
            specialInstructions
          ]
        );

        // CRITICAL: If DB blocked the insert (e.g. credit limit), stop here and show the override modal
        if (!insertResult || !insertResult.success) {
          const errMsg = insertResult?.error || '';
          if (errMsg.includes('CREDIT_LIMIT_EXCEEDED') || errMsg.includes('Credit limit exceeded')) {
            const currentOutstanding = selectedCustomer?.balance || 0;
            const creditLimit = (selectedCustomer?.creditLimit && selectedCustomer.creditLimit !== 0)
              ? selectedCustomer.creditLimit
              : (settings.defaultCreditLimit ?? 500);
            const newOutstanding = currentOutstanding + total;
            setCreditWarningDetails({
              orderId: orderId,
              customerName: selectedCustomer?.name,
              creditLimit,
              currentOutstanding,
              orderAmount: total,
              newOutstanding,
              exceededAmount: Math.max(0, newOutstanding - creditLimit),
              overrideAllowed: true
            });
            setPendingOrderId(orderId);
            setPendingOrderAction('saveOrder');
            setShowCreditWarning(true);
          } else {
            alert('Failed to save order: ' + (errMsg || 'Unknown error'));
          }
          return; // STOP — do not update balance or show success
        }

        // Update customer balance in DB
        if (selectedCustomer) {
          await window.electronAPI.dbQuery('UPDATE customers SET balance = balance + ?, isSynced = 0, updatedAt = ? WHERE id = ?', [total, getLocalISOString(), selectedCustomer.id]);
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
            paymentMethod: PAYMENT_METHODS.NOT_PAID,
            items: cart,
            statusHistory: [{ status: ORDER_STATUS.PAYMENT_PENDING, updatedBy: 'POS System', timestamp: getLocalISOString() }],
            expectedDeliveryDate: combinedExpectedDelivery,
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
            paymentMethod: PAYMENT_METHODS.NOT_PAID.toUpperCase(),
            items: cart,
            statusHistory: [{ status: ORDER_STATUS.PAYMENT_PENDING, updatedBy: 'POS System', timestamp: getLocalISOString() }],
            expectedDeliveryDate: combinedExpectedDelivery,
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
        setExpectedDeliveryTime('17:00');
        setSpecialInstructions('');
        setPendingOrderId(null);
      } catch (err) {
        console.error("Failed to save order:", err);
        // If DB-level credit limit check blocked the order, show the override modal
        if (err?.message?.includes('CREDIT_LIMIT_EXCEEDED') || err?.message?.includes('Credit limit exceeded')) {
          const currentOutstanding = selectedCustomer?.balance || 0;
          const creditLimit = selectedCustomer?.creditLimit && selectedCustomer.creditLimit !== 0
            ? selectedCustomer.creditLimit
            : (settings.defaultCreditLimit ?? 500);
          const orderAmount = total;
          const newOutstanding = currentOutstanding + orderAmount;
          const generatedId = pendingOrderId || `#AG-${Math.floor(10000 + Math.random() * 90000)}`;
          setPendingOrderId(generatedId);
          setCreditWarningDetails({
            orderId: generatedId,
            customerName: selectedCustomer?.name,
            creditLimit,
            currentOutstanding,
            orderAmount,
            newOutstanding,
            exceededAmount: Math.max(0, newOutstanding - creditLimit),
            overrideAllowed: true
          });
          setPendingOrderAction('saveOrder');
          setShowCreditWarning(true);
        }
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
      setPendingOrderId(null);
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
                  <span className={styles.cartItemMeta}>
                    {(() => {
                      const treatments = item.type || '';
                      const addonsList = (item.addons || []).join(' + ');
                      return [treatments, addonsList].filter(Boolean).join(' + ').toUpperCase();
                    })()}
                    {item.qty > 1 && (
                      <>
                        {' • '}
                        {item.qty} × <CurrencySymbol size={12} /> {item.price.toFixed(2)}
                      </>
                    )}
                  </span>
                  {item.description && (
                    <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600, marginTop: '0.15rem' }}>
                      ⚠️ Damage Notes: {item.description}
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
              <MethodCard id="bank" label="Bank" icon={<Landmark />} active={paymentMethod === 'bank'} onClick={setPaymentMethod} />
              <MethodCard id="credit" label="Store Credit" icon={<User />} active={paymentMethod === 'credit'} onClick={setPaymentMethod} />
            </div>
          </div>

          {paymentMethod === 'bank' && settings.bankAccounts?.length > 0 && (
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
          <Trash2 size={18} className={styles.clearCart} onClick={() => { setCart([]); setExpectedDeliveryDate(getTomorrowDateString()); setExpectedDeliveryTime('17:00'); setSpecialInstructions(''); }} />
        </div>
        <div className={styles.cartMetadata}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
            <div className={styles.metadataRow} style={{ flex: 1 }}>
              <label className={styles.metadataLabel}>
                <Calendar size={13} style={{ marginRight: '4px' }} />
                Expected Date
              </label>
              <input
                type="date"
                className={styles.metadataInput}
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              />
            </div>
            <div className={styles.metadataRow} style={{ flex: 1 }}>
              <label className={styles.metadataLabel}>
                <Clock size={13} style={{ marginRight: '4px' }} />
                Expected Time
              </label>
              <input
                type="time"
                className={styles.metadataInput}
                value={expectedDeliveryTime}
                onChange={(e) => setExpectedDeliveryTime(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.metadataRow}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.metadataLabel}>
                <FileText size={13} style={{ marginRight: '4px' }} />
                ⚠️ Special Instructions
              </label>
              <button
                type="button"
                className={styles.togglePresetsBtn}
                onClick={() => setShowSpecialPresets(!showSpecialPresets)}
              >
                {showSpecialPresets ? 'Hide Presets' : 'Show Presets'}
              </button>
            </div>
            <input
              type="text"
              className={styles.metadataInput}
              placeholder="e.g. Starch, hang, handle with care..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
            />
            {showSpecialPresets && (
              <div className={styles.presetNotesContainer} style={{ marginTop: '0.4rem' }}>
                {(settings.presetDamageNotes || []).map((note, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.presetNoteChip}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={() => {
                      const current = (specialInstructions || '').trim();
                      if (!current) {
                        setSpecialInstructions(note);
                        return;
                      }
                      const parts = current.split(',').map(p => p.trim());
                      if (parts.includes(note)) return;
                      setSpecialInstructions(`${current}, ${note}`);
                    }}
                  >
                    {note}
                  </button>
                ))}
              </div>
            )}
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
                <span className={styles.cartItemMeta}>
                  {(() => {
                    const treatments = item.type || '';
                    const addonsList = (item.addons || []).join(' + ');
                    return [treatments, addonsList].filter(Boolean).join(' + ');
                  })()}
                  {item.qty > 1 && (
                    <>
                      {' • '}
                      {item.qty} × <CurrencySymbol size={10} /> {item.price.toFixed(2)}
                    </>
                  )}
                </span>
                {item.description && (
                  <span className={styles.cartItemRemarks}>
                    ⚠️ Fabric Notes: {item.description}
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
            <button
              className={`${styles.saveBtn} ${(!selectedCustomer || cart.length === 0) ? styles.disabled : ''}`}
              onClick={handleSaveOrder}
            >
              <ShoppingBag size={18} /> Save Bill
            </button>
            {selectedCustomer && selectedCustomer.balance > 0 && (
              <button
                className={styles.overdueBtn}
                onClick={() => navigate(`/overdue-statement/${selectedCustomer.id}`)}
              >
                <Printer size={18} /> {t('overdue', settings.language)} Receipt
              </button>
            )}
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
              <button className={styles.modalCloseBtn} onClick={() => { setSelectedService(null); setEditingCartIdx(null); setShowItemPresets(false); }} aria-label="Close modal">
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
                      {availableTypesForService.map(type => {
                        const isSelected = (serviceConfig.selectedTypeIds || []).includes(type.id);
                        return (
                          <div
                            key={type.id}
                            className={`${styles.serviceTypeCard} ${isSelected ? styles.active : ''}`}
                            onClick={() => toggleServiceType(type.id)}
                          >
                            <div className={styles.selectionIndicator}>
                              <div className={styles.checkboxOutline} style={{ borderRadius: '4px' }}>
                                {isSelected && <CheckCircle size={10} className={styles.checkIconMini} />}
                              </div>
                            </div>
                            <div className={styles.serviceTypeIcon}>{getIcon(type.icon, 16)}</div>
                            <span className={styles.serviceTypeName}>{type.name}</span>
                            <span className={styles.serviceTypePrice}>{formatCurrency(type.price)}</span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className={styles.fieldLabel} htmlFor="damageRemarks">
                    <span>Damage Remarks / Fabric Notes</span>
                  </label>
                  <button
                    type="button"
                    className={styles.togglePresetsBtn}
                    onClick={() => setShowItemPresets(!showItemPresets)}
                  >
                    {showItemPresets ? 'Hide Presets' : 'Show Presets'}
                  </button>
                </div>
                <span className={styles.fieldSub}>Describe stains, tears, fading, or special requirements</span>
                <textarea
                  id="damageRemarks"
                  placeholder="e.g., Small yellow stain on collar, missing middle button, handle with care..."
                  value={serviceConfig.description || ''}
                  onChange={(e) => setServiceConfig(prev => ({ ...prev, description: e.target.value }))}
                  className={styles.remarksTextarea}
                />
                {showItemPresets && (
                  <div className={styles.presetNotesContainer}>
                    {(settings.presetDamageNotes || []).map((note, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={styles.presetNoteChip}
                        onClick={() => {
                          setServiceConfig(prev => {
                            const current = (prev.description || '').trim();
                            if (!current) {
                              return { ...prev, description: note };
                            }
                            const parts = current.split(',').map(p => p.trim());
                            if (parts.includes(note)) return prev;
                            return { ...prev, description: `${current}, ${note}` };
                          });
                        }}
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalFooterRedesign}>
              <button className={styles.modalCancelBtn} onClick={() => { setSelectedService(null); setEditingCartIdx(null); setShowItemPresets(false); }}>
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
                      onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
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
                      onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
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
                      onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooterRedesign}>
                <button type="button" className={styles.modalCancelBtn} onClick={() => setShowCustomerModal(false)}>Cancel</button>
                <button type="submit" className={styles.modalSubmitBtn}>Save & Select</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ width: '400px' }}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <div className={styles.modalHeaderIcon} style={{ background: '#EFF6FF', color: '#2563EB', borderColor: '#DBEAFE' }}>
                  <Receipt size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Apply Discount</h2>
                  <p style={{ margin: '0.15rem 0 0 0' }}>Select or enter discount details</p>
                </div>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowDiscountModal(false)} />
            </div>

            <div className={styles.modalBody} style={{ padding: '1.5rem' }}>
              {/* Toggle between Flat and Percentage */}
              <div className={styles.paymentMethods} style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div
                  className={`${styles.methodCard} ${discountType === 'flat' ? styles.active : ''}`}
                  onClick={() => { setDiscountType('flat'); setDiscountInput(''); }}
                  style={{ padding: '1rem', gap: '0.5rem' }}
                >
                  <span className={styles.methodName} style={{ fontSize: '0.9rem' }}>Flat (د.إ)</span>
                </div>
                <div
                  className={`${styles.methodCard} ${discountType === 'percent' ? styles.active : ''}`}
                  onClick={() => { setDiscountType('percent'); setDiscountInput(''); }}
                  style={{ padding: '1rem', gap: '0.5rem' }}
                >
                  <span className={styles.methodName} style={{ fontSize: '0.9rem' }}>Percentage (%)</span>
                </div>
              </div>

              {/* Presets */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                  Quick Presets
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {discountType === 'flat' ? (
                    [5, 10, 20, 50].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDiscountInput(val.toString())}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          background: discountInput === val.toString() ? '#EFF6FF' : 'white',
                          borderColor: discountInput === val.toString() ? '#2563EB' : '#E2E8F0',
                          color: discountInput === val.toString() ? '#1E3A8A' : '#0F172A',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        د.إ {val}
                      </button>
                    ))
                  ) : (
                    [5, 10, 15, 20].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDiscountInput(val.toString())}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          background: discountInput === val.toString() ? '#EFF6FF' : 'white',
                          borderColor: discountInput === val.toString() ? '#2563EB' : '#E2E8F0',
                          color: discountInput === val.toString() ? '#1E3A8A' : '#0F172A',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {val}%
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Custom Input */}
              <div className={styles.formGroup}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                  Custom {discountType === 'flat' ? 'Amount' : 'Percentage'}
                </label>
                <div className={styles.posInputWrapper}>
                  {discountType === 'flat' ? (
                    <CurrencySymbol size={16} />
                  ) : (
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#64748B', width: '18px', display: 'inline-block', textAlign: 'center' }}>%</span>
                  )}
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'percent' ? "100" : undefined}
                    step="any"
                    placeholder="0.00"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    style={{ fontWeight: 700 }}
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooterRedesign}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setShowDiscountModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalSubmitBtn}
                onClick={() => {
                  const val = parseFloat(discountInput) || 0;
                  if (discountType === 'percent') {
                    setDiscount((subtotal * val) / 100);
                  } else {
                    setDiscount(val);
                  }
                  setShowDiscountModal(false);
                }}
              >
                Apply Discount
              </button>
            </div>
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

      {/* Credit Limit Warning Modal */}
      {showCreditWarning && creditWarningDetails && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.tempModal}`} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader} style={{ background: '#FEF2F2', borderBottom: '1px solid #FEE2E2' }}>
              <div className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={24} color="#EF4444" />
                <div>
                  <h2 style={{ color: '#991B1B', margin: 0 }}>Credit Limit Exceeded</h2>
                  <p style={{ color: '#B91C1C', margin: 0, fontSize: '0.8rem' }}>This customer has exceeded their credit threshold.</p>
                </div>
              </div>
            </div>
            <div className={styles.modalBody} style={{ padding: '1.5rem' }}>
              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1rem', border: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Customer Name:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{creditWarningDetails.customerName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Credit Limit:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.creditLimit.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Outstanding Balance:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.currentOutstanding.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Current Order Amount:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.orderAmount.toFixed(2)}</span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.5rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>New Outstanding Balance:</span>
                  <span style={{ color: '#1E293B', fontWeight: 700 }}>{settings.currencySymbol} {creditWarningDetails.newOutstanding.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444', fontWeight: 700 }}>
                  <span>Exceeded Amount:</span>
                  <span>{settings.currencySymbol} {creditWarningDetails.exceededAmount.toFixed(2)}</span>
                </div>
              </div>

              {settings.enableManagerOverride ? (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '0.75rem 1rem', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <Info size={18} />
                  <span>This order can be authorized using the secure PIN.</span>
                </div>
              ) : (
                <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '12px', padding: '0.75rem 1rem', color: '#C53030', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <AlertCircle size={18} />
                  <span>Credit Limit Protection is active and Manager Override is disabled.</span>
                </div>
              )}
            </div>
            <div className={styles.modalFooter} style={{ display: 'flex', gap: '1rem', padding: '1rem 1.5rem' }}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleCancelOverride}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              {creditWarningDetails.overrideAllowed && settings.enableManagerOverride && (
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={() => setShowManagerPinModal(true)}
                  style={{ flex: 1, background: '#D97706', color: 'white' }}
                >
                  Manager Override
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manager PIN Modal */}
      {showManagerPinModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.tempModal}`} style={{ maxWidth: '400px' }}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <h2>Manager Verification</h2>
                <p>Enter the PIN to approve this credit</p>
              </div>
            </div>
            <form onSubmit={handleVerifyManagerPin}>
              <div className={styles.modalBody} style={{ padding: '1.5rem' }}>
                <div className={styles.formGroup}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>SECURE PIN</label>
                  <div className={styles.posInputWrapper}>
                    <Lock size={18} />
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="Enter 4-Digit PIN"
                      value={managerPinValue}
                      onChange={(e) => setManagerPinValue(e.target.value.replace(/\D/g, ''))}
                      style={{ fontSize: '1.25rem', letterSpacing: '0.25rem' }}
                    />
                  </div>
                  {managerPinError && (
                    <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>{managerPinError}</p>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter} style={{ display: 'flex', gap: '1rem', padding: '1rem 1.5rem' }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setShowManagerPinModal(false);
                    setManagerPinValue('');
                    setManagerPinError('');
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  style={{ flex: 1 }}
                >
                  Verify
                </button>
              </div>
            </form>
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
