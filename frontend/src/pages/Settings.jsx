import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, CheckCircle, Image as ImageIcon, X, Sliders, Scissors,
  Mail, Phone, Globe, Building2, MapPin, CreditCard, Hash, FileText,
  Percent, Settings2, Info, Plus, Trash2, Star, DollarSign, Clock, Database, Save, AlertCircle, RefreshCw, Lock, Unlock, Download, Cpu,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { useSettings } from '../store/SettingsContext';
import Activation from './Activation';
import { t } from '../utils/translations';
import CurrencySymbol from '../components/CurrencySymbol';
import InvoiceTemplate from '../components/InvoiceTemplate';
import EmailReportsSettings from '../components/EmailReportsSettings';
import { useNavigate, useLocation } from 'react-router-dom';
import defaultLogo from '../assets/logo.png';
import styles from './Settings.module.css';

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const tabParam = queryParams.get('tab');

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'super_admin' || user.role === 'admin';
  const isManager = user.role === 'manager';
  const isAuthorized = isSuperAdmin || isManager;

  const [activeTab, setActiveTab] = useState(
    isSuperAdmin
      ? (tabParam || 'Payment Gateway')
      : (tabParam === 'Maintenance' && !(isSuperAdmin || isManager)) || (tabParam === 'Software Update' && !(isSuperAdmin || isManager))
        ? 'General'
        : (tabParam || 'General')
  );
  const { settings, updateSettings } = useSettings();
  const tabsRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isCreditLimitUnlocked, setIsCreditLimitUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState('');

  // System Reset States
  const [resetOptions, setResetOptions] = useState({
    generalSettings: false,
    workflowStatuses: false,
    presetDamageNotes: false,
    companyInfo: false,
    taxSettings: false,
    billTemplates: false,
    waTemplates: false,
    printers: false,
    gateways: false,
    ordersPayments: false,
    customers: false,
    services: false,
    expensesBank: false,
    staffPayroll: false
  });
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [enteredResetPin, setEnteredResetPin] = useState('');
  const [resetPinError, setResetPinError] = useState('');
  const [resetPinAction, setResetPinAction] = useState('custom'); // 'custom' | 'factory'
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetTextConfirmation, setResetTextConfirmation] = useState('');
  const [resetConfirmError, setResetConfirmError] = useState('');
  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
  const [showSuccessSummary, setShowSuccessSummary] = useState(false);
  const [resetSummary, setResetSummary] = useState([]);
  const [backupError, setBackupError] = useState('');


  // Cropper States
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  // Workflow Status States
  const [newStatusInput, setNewStatusInput] = useState('');
  const [editingStatusIdx, setEditingStatusIdx] = useState(-1);
  const [editingStatusVal, setEditingStatusVal] = useState('');

  // Damage Notes States
  const [newDamageNoteInput, setNewDamageNoteInput] = useState('');
  const [editingDamageNoteIdx, setEditingDamageNoteIdx] = useState(-1);
  const [editingDamageNoteVal, setEditingDamageNoteVal] = useState('');

  // Printer settings states
  const [availablePrinters, setAvailablePrinters] = useState([]);

  // Software Update States
  const [updateStatus, setUpdateStatus] = useState({ type: 'idle' });
  const [lastCheckTime, setLastCheckTime] = useState(localStorage.getItem('update_last_check') || '');
  const [currentVersion, setCurrentVersion] = useState('1.0.0');

  // Nomod History States
  const [nomodTxns, setNomodTxns] = useState([]);
  const [nomodAudits, setNomodAudits] = useState([]);
  const [nomodSearch, setNomodSearch] = useState('');
  const [nomodLoading, setNomodLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'Nomod History') {
      fetchNomodData();
    }
  }, [activeTab]);

  const fetchNomodData = async () => {
    if (!window.electronAPI?.dbQuery) return;
    setNomodLoading(true);
    try {
      const txnsRes = await window.electronAPI.dbQuery(`SELECT * FROM nomod_transactions ORDER BY createdAt DESC`);
      setNomodTxns(txnsRes);
    } catch (err) {
      console.error(err);
    } finally {
      setNomodLoading(false);
    }
  };

  const handleAddDamageNote = () => {
    const trimmed = newDamageNoteInput.trim();
    if (!trimmed) return;
    const currentList = settings.presetDamageNotes || [];
    if (currentList.includes(trimmed)) {
      alert('Preset note already exists!');
      return;
    }
    const updatedList = [...currentList, trimmed];
    updateSettings({ presetDamageNotes: updatedList });
    setNewDamageNoteInput('');
  };

  const handleEditDamageNote = (index) => {
    const trimmed = editingDamageNoteVal.trim();
    if (!trimmed) return;
    const currentList = settings.presetDamageNotes || [];
    if (currentList[index] === trimmed) {
      setEditingDamageNoteIdx(-1);
      return;
    }
    const updatedList = [...currentList];
    updatedList[index] = trimmed;
    updateSettings({ presetDamageNotes: updatedList });
    setEditingDamageNoteIdx(-1);
  };

  const handleDeleteDamageNote = (index) => {
    const currentList = settings.presetDamageNotes || [];
    const noteToDelete = currentList[index];
    if (confirm(`Are you sure you want to delete the preset note "${noteToDelete}"?`)) {
      const updatedList = currentList.filter((_, idx) => idx !== index);
      updateSettings({ presetDamageNotes: updatedList });
    }
  };

  const checkScroll = () => {
    const el = tabsRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 5);
      setCanScrollRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 5);
    }
  };

  const scrollTabs = (direction) => {
    const el = tabsRef.current;
    if (el) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/');
    }
  }, [isAuthorized, navigate]);

  // Sync local credit limit input when settings load
  useEffect(() => {
    setCreditLimitInput(String(settings.defaultCreditLimit ?? 500));
  }, [settings.defaultCreditLimit]);

  useEffect(() => {
    const timer = setTimeout(checkScroll, 150);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [activeTab]);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    const handleUpdate = (event, status) => {
      setUpdateStatus(status);
      if (status.type === 'checking') {
        const checkTimeString = new Date().toLocaleString();
        setLastCheckTime(checkTimeString);
        localStorage.setItem('update_last_check', checkTimeString);
      }
    };

    if (window.electronAPI?.onUpdateStatus) {
      window.electronAPI.onUpdateStatus(handleUpdate);
    }

    // Load app version dynamically
    const loadVersion = async () => {
      if (window.electronAPI?.getAppVersion) {
        const ver = await window.electronAPI.getAppVersion();
        setCurrentVersion(ver);
      }
    };
    loadVersion();

    return () => {
      if (window.electronAPI?.offUpdateStatus) {
        window.electronAPI.offUpdateStatus(handleUpdate);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsCropping(false);
        setShowPinModal(false);
        setEnteredPin('');
        setPinError('');
        setShowResetPinModal(false);
        setEnteredResetPin('');
        setResetPinError('');
        setShowBackupPrompt(false);
        setBackupError('');
        setShowResetConfirmModal(false);
        setResetTextConfirmation('');
        setResetConfirmError('');
        setShowFinalConfirmModal(false);
        setShowSuccessSummary(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const isAnyOpen = isCropping || showPinModal || showResetPinModal || showBackupPrompt || showResetConfirmModal || showFinalConfirmModal || showSuccessSummary;
    if (isAnyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isCropping, showPinModal, showResetPinModal, showBackupPrompt, showResetConfirmModal, showFinalConfirmModal, showSuccessSummary]);

  useEffect(() => {
    const fetchPrinters = async () => {
      if (window.electronAPI?.getPrinters) {
        try {
          const list = await window.electronAPI.getPrinters();
          setAvailablePrinters(list || []);
        } catch (err) {
          console.error("Failed to load printers:", err);
        }
      }
    };
    fetchPrinters();
  }, [activeTab]);

  if (!isAuthorized) return null;

  const tabs = isSuperAdmin
    ? ['Email Reports', 'Payment Gateway', 'Import Backup', 'System Reset']
    : [
        'General',
        'Order Workflow',
        'Company Info',
        'Tax Settings',
        'Bill Templates',
        'Bank',
        ...((isManager && settings.allowManagerNomodConfig) ? ['Payment Gateway'] : []),
        'WhatsApp Config',
        'Damage Notes',
        'Printers',
        ...(isManager ? ['Maintenance'] : []),
        ...(isManager ? ['Software Update'] : []),
        'Web Dashboard',
        'Email Reports',
        'System Reset'
      ];

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveCroppedImage = async () => {
    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      updateSettings({ logo: croppedImage });
      setIsCropping(false);
      setImageToCrop(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddWorkflowStatus = () => {
    if (!newStatusInput.trim()) return;
    const trimmed = newStatusInput.trim();
    const currentList = settings.workflowStatuses || [];
    if (currentList.includes(trimmed)) {
      alert('Status already exists!');
      return;
    }
    const updatedList = [...currentList, trimmed];
    updateSettings({ workflowStatuses: updatedList });
    setNewStatusInput('');
  };

  const handleEditWorkflowStatus = (index) => {
    const trimmed = editingStatusVal.trim();
    if (!trimmed) return;
    const currentList = settings.workflowStatuses || [];
    if (currentList[index] === trimmed) {
      setEditingStatusIdx(-1);
      return;
    }
    const coreStatuses = ['Confirmed', 'Delivered', 'Cancelled'];
    if (coreStatuses.includes(currentList[index])) {
      alert('Cannot edit system core statuses!');
      return;
    }
    const updatedList = [...currentList];
    updatedList[index] = trimmed;
    updateSettings({ workflowStatuses: updatedList });
    setEditingStatusIdx(-1);
  };

  const handleDeleteWorkflowStatus = (index) => {
    const currentList = settings.workflowStatuses || [];
    const statusToDelete = currentList[index];
    const coreStatuses = ['Confirmed', 'Delivered', 'Cancelled'];
    if (coreStatuses.includes(statusToDelete)) {
      alert('Cannot delete system core statuses!');
      return;
    }
    if (confirm(`Are you sure you want to delete the status "${statusToDelete}"?`)) {
      const updatedList = currentList.filter((_, idx) => idx !== index);
      updateSettings({ workflowStatuses: updatedList });
    }
  };

  const handleResetExecute = async () => {
    const isFactory = resetPinAction === 'factory';
    const toReset = isFactory ? {
      generalSettings: true,
      workflowStatuses: true,
      presetDamageNotes: true,
      companyInfo: true,
      taxSettings: true,
      billTemplates: true,
      waTemplates: true,
      printers: true,
      gateways: true,
      ordersPayments: true,
      customers: true,
      services: true,
      expensesBank: true,
      staffPayroll: true
    } : resetOptions;

    // Retrieve current user details for audit logging
    const userObj = JSON.parse(sessionStorage.getItem('user') || '{}');
    const userName = userObj.name || 'Manager';
    const userRole = userObj.role || 'manager';
    const modulesStr = Object.keys(toReset).filter(k => toReset[k]).map(k => {
      const mapping = {
        generalSettings: 'General Settings',
        workflowStatuses: 'Order Workflow Stages',
        presetDamageNotes: 'Damage Notes',
        companyInfo: 'Company Info',
        taxSettings: 'Tax Settings',
        billTemplates: 'Invoice Templates',
        waTemplates: 'WhatsApp Templates',
        printers: 'Printers',
        gateways: 'Payment Gateways',
        ordersPayments: 'Orders & Payments',
        customers: 'Customers',
        services: 'Services & Products',
        expensesBank: 'Ledger & Expenses',
        staffPayroll: 'Staff & Payroll'
      };
      return mapping[k] || k;
    }).join(', ');

    const resetType = isFactory ? 'Full Factory Reset' : 'Custom Reset';

    // Start building updated settings
    let newSettings = { ...settings };

    if (toReset.generalSettings) {
      newSettings = {
        ...newSettings,
        language: 'English',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h',
        autoPrint: false,
        defaultPaymentMethod: 'Cash',
        cardCommission: 0,
        cardDefaultAccountId: '',
        upiDefaultAccountId: '',
        overdueDays: 7,
        defaultCreditLimit: 500,
        lateDeliveryDays: 3,
        enableCreditLimitProtection: true,
        enableManagerOverride: true
      };
    }

    if (toReset.workflowStatuses) {
      newSettings.workflowStatuses = ['Confirmed', 'Picked Up', 'Washing', 'Drying', 'Ironing', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered', 'Cancelled'];
    }

    if (toReset.presetDamageNotes) {
      newSettings.presetDamageNotes = ['Stain on collar', 'Fading colour', 'Missing button', 'Tear on sleeve', 'Handle with care', 'Dry Clean Only'];
    }

    if (toReset.companyInfo) {
      newSettings = {
        ...newSettings,
        companyName: 'Laundry Box',
        companyNameAr: '',
        logo: null,
        email: '',
        phone: '',
        alternatePhone: '',
        website: '',
        address: '',
        addressAr: '',
        city: '',
        emirate: 'Dubai'
      };
    }

    if (toReset.taxSettings) {
      newSettings = {
        ...newSettings,
        taxId: '',
        trn: '',
        licenseNumber: '',
        taxName: 'VAT',
        taxRate: 5,
        isTaxEnabled: true,
        taxMethod: 'inclusive'
      };
    }

    if (toReset.billTemplates) {
      newSettings = {
        ...newSettings,
        invoiceTemplate: 'standard',
        deliveryMethods: [
          { name: 'Hanger', nameAr: 'علاقة', isDefault: true },
          { name: 'Folded', nameAr: 'مطوي', isDefault: false },
          { name: 'Bagged', nameAr: 'مكيس', isDefault: false }
        ],
        invoiceShowLogo: true,
        invoiceShowQrCode: true,
        invoiceShowTerms: true,
        invoiceShowBankDetails: true,
        invoiceShowBilingual: true,
        invoiceTermsText: '1. Please present this invoice at the time of pickup.\n2. We are not responsible for color fading or shrinkage.\n3. Orders must be collected within 30 days.'
      };
    }

    if (toReset.waTemplates) {
      newSettings = {
        ...newSettings,
        waNewOrderTemplate: 'Hello {customerName}! Your laundry bill for {orderId} of {total} has been saved. {dueAmount} is pending. Thank you!',
        waOrderReadyTemplate: 'Dear {customerName}, your order {orderId} is now ready for pick-up! Total due is {dueAmount}. Thank you!',
        waReminderTemplate: 'Hello {customerName}, this is a gentle reminder that an amount of {dueAmount} is pending for order {orderId}. Kindly settle at your earliest convenience.',
        waStatementTemplate: 'Hello {customerName}, your current outstanding balance is {dueAmount}. Please find your statement attached.',
        waCheckoutReceiptTemplate: 'Hello {customerName}! Your laundry order totaling {total} has been received and is now being processed. Thank you for choosing us!',
        waStatusUpdateTemplate: 'Hello! Regarding your laundry order #{orderId}, the current status is "{status}". Expected delivery date is {deliveryDate}. Thank you!',
        waCustomerBalanceTemplate: 'Hello {customerName}! This is a friendly reminder regarding your outstanding balance of {dueAmount} at {shopName}. Please settle it at your earliest convenience. Thank you!',
        waGeneralTemplate: 'Hello! This is from {shopName}. We\'re reaching out regarding your account.',
        waInvoiceShareTemplate: '*INVOICE RECEIVED*\n\nHello! Here is your bill for order *{orderId}*.\n\n*Items:*\n{itemsSummary}\n\n*Total Amount: {total}*'
      };
    }

    if (toReset.printers) {
      newSettings.billingPrinter = '';
      newSettings.tagPrinter = '';
      localStorage.removeItem('billingPrinter');
      localStorage.removeItem('tagPrinter');
    }

    if (toReset.gateways) {
      newSettings = {
        ...newSettings,
        enablePaymentLinks: true,
        allowManagerStripeConfig: false,
        enableStripe: false,
        stripeApiKey: '',
        stripeMerchantId: '',
        stripeEnv: 'sandbox',
        stripeCurrency: 'AED',
        stripeSuccessUrl: '',
        stripeFailureUrl: '',
        stripeWebhookSecret: '',
        stripeExpiry: 30,
        allowManagerTapConfig: false,
        enableTap: false,
        tapApiKey: '',
        tapMerchantId: '',
        tapEnv: 'sandbox',
        tapCurrency: 'AED',
        tapSuccessUrl: '',
        tapFailureUrl: '',
        tapWebhookSecret: '',
        tapExpiry: 30,
        allowManagerMyFatoorahConfig: false,
        enableMyFatoorah: false,
        myfatoorahApiKey: '',
        myfatoorahMerchantId: '',
        myfatoorahEnv: 'sandbox',
        myfatoorahCurrency: 'AED',
        myfatoorahSuccessUrl: '',
        myfatoorahFailureUrl: '',
        myfatoorahWebhookSecret: '',
        myfatoorahExpiry: 30,
        allowManagerNomodConfig: false,
        enableNomod: false,
        nomodApiKey: '',
        nomodMerchantId: '',
        nomodEnv: 'sandbox',
        nomodCurrency: 'AED',
        nomodSuccessUrl: '',
        nomodFailureUrl: '',
        nomodWebhookSecret: '',
        nomodExpiry: 30
      };
    }

    if (toReset.expensesBank) {
      newSettings.bankAccounts = [];
      newSettings.defaultBankId = '';
    }

    if (isFactory) {
      newSettings.orderDeletePin = '0000';
    }

    // Execute all DB reset operations inside a single SQLite transaction
    const runQuery = async (query, params = []) => {
      const res = await window.electronAPI.dbQuery(query, params);
      if (!res.success) {
        throw new Error(res.error || 'Database query failed');
      }
      return res.data;
    };

    const summaryList = [];

    try {
      await runQuery('BEGIN TRANSACTION');
      try {
        if (toReset.ordersPayments) {
          await runQuery('DELETE FROM orders');
          await runQuery('DELETE FROM payments');
          await runQuery('DELETE FROM deleted_orders');
          await runQuery('DELETE FROM payment_links');
          await runQuery('DELETE FROM nomod_transactions');
          await runQuery('DELETE FROM reconciliations');
          await runQuery('DELETE FROM credit_override_logs');
          summaryList.push('Transactions (Orders & Payments): Deleted all records');
        }

        if (toReset.customers) {
          await runQuery('DELETE FROM customers');
          summaryList.push('Customers: Deleted all customer profiles');
          
          // Cascaded delete to prevent orphaned records in order/payment tables
          await runQuery('DELETE FROM orders');
          await runQuery('DELETE FROM payments');
          await runQuery('DELETE FROM deleted_orders');
          await runQuery('DELETE FROM payment_links');
          await runQuery('DELETE FROM nomod_transactions');
          await runQuery('DELETE FROM reconciliations');
          await runQuery('DELETE FROM credit_override_logs');
          if (!summaryList.includes('Transactions (Orders & Payments): Deleted all records')) {
            summaryList.push('Transactions (Orders & Payments): Deleted all records (cascaded from Customers reset)');
          }
        }

        if (toReset.expensesBank) {
          await runQuery('DELETE FROM expenses');
          await runQuery('DELETE FROM account_transactions');
          summaryList.push('Expenses & Cash Register ledger: Cleared accounts transaction logs');
        }

        if (toReset.staffPayroll) {
          await runQuery('DELETE FROM payroll_employees');
          await runQuery('DELETE FROM payroll_payments');
          await runQuery('DELETE FROM accrual_logs');
          summaryList.push('Staff & Payroll: Erased employee and pay registers');
        }

        if (toReset.services) {
          await runQuery('DELETE FROM services');
          await runQuery('DELETE FROM service_types');
          await runQuery('DELETE FROM addons');
          await runQuery('DELETE FROM service_categories');

          // Re-seed default services
          const shopId = 'SHOP_01';
          const now = new Date().toISOString();

          const generateSVG = (name, category) => {
            let startColor = '#3B82F6';
            let endColor = '#1D4ED8';
            let iconPath = '';
            const catStr = String(category || '').toLowerCase();
            if (catStr === 'dry cleaning') {
              startColor = '#8B5CF6';
              endColor = '#6D28D9';
            } else if (catStr === 'alterations') {
              startColor = '#EC4899';
              endColor = '#BE185D';
            }
            const nameLower = String(name || '').toLowerCase();
            if (nameLower.includes('shirt')) {
              iconPath = `<path d="M30 25 L40 33 L45 28 L55 28 L60 33 L70 25 L75 35 L70 50 L65 50 L65 75 C65 77 63 79 61 79 L39 79 C37 79 35 77 35 75 L35 50 L30 50 L25 35 Z" fill="white" />
                          <path d="M50 35 L50 75" stroke="${endColor}" stroke-width="2" stroke-dasharray="3 3" />
                          <circle cx="50" cy="45" r="2" fill="white" />
                          <circle cx="50" cy="55" r="2" fill="white" />
                          <circle cx="50" cy="65" r="2" fill="white" />`;
            } else if (nameLower.includes('dress')) {
              iconPath = `<path d="M38 25 C38 25 45 28 50 28 C55 28 62 25 62 25 L70 75 C70 77 68 79 66 79 L34 79 C32 79 30 77 30 75 Z" fill="white" />
                          <path d="M42 35 C45 38 55 38 58 35" stroke="${startColor}" stroke-width="2" fill="none" />
                          <path d="M44 48 C46 51 54 51 56 48" stroke="${startColor}" stroke-width="2" fill="none" />`;
            } else if (nameLower.includes('jacket') || nameLower.includes('suit')) {
              iconPath = `<path d="M28 28 L40 22 L50 26 L60 22 L72 28 L75 48 L70 50 L70 75 C70 77 68 79 66 79 L34 79 C32 79 30 77 30 75 L30 50 L25 48 Z" fill="white" />
                          <path d="M42 22 L50 35 L58 22" stroke="${startColor}" stroke-width="2" fill="none" />
                          <line x1="50" y1="35" x2="50" y2="79" stroke="${endColor}" stroke-width="2" />
                          <path d="M38 45 H44" stroke="${endColor}" stroke-width="2" />
                          <path d="M56 45 H62" stroke="${endColor}" stroke-width="2" />`;
            } else if (nameLower.includes('pants') || nameLower.includes('trousers')) {
              iconPath = `<path d="M32 22 H68 L64 75 C64 77 62 79 60 79 H52 C50 79 49 77 48 75 L45 42 L42 75 C41 77 40 79 38 79 H30 C28 79 26 77 26 75 Z" fill="white" />
                          <line x1="32" y1="30" x2="68" y2="30" stroke="${endColor}" stroke-width="2" />`;
            } else if (nameLower.includes('bedding') || nameLower.includes('blanket') || nameLower.includes('bed')) {
              iconPath = `<path d="M20 30 C20 28 22 26 24 26 H76 C78 26 80 28 80 30 V70 C80 72 78 74 76 74 H24 C22 74 20 72 20 70 Z" fill="white" opacity="0.9" />
                          <path d="M25 40 H75 V68 H25 Z" fill="${startColor}" opacity="0.15" />
                          <path d="M28 32 H46 V42 H28 Z" fill="${endColor}" opacity="0.75" rx="2" />
                          <path d="M54 32 H72 V42 H54 Z" fill="${endColor}" opacity="0.75" rx="2" />
                          <path d="M20 50 H80" stroke="${endColor}" stroke-width="3" />`;
            } else {
              iconPath = `<path d="M25 35 H75 L70 72 C70 76 66 79 62 79 H38 C34 79 30 76 30 72 Z" fill="white" />
                          <ellipse cx="50" cy="35" rx="25" ry="5" fill="${endColor}" />
                          <path d="M30 45 L35 70" stroke="${startColor}" stroke-width="2" stroke-linecap="round" />
                          <path d="M50 45 L50 70" stroke="${startColor}" stroke-width="2" stroke-linecap="round" />
                          <path d="M70 45 L65 70" stroke="${startColor}" stroke-width="2" stroke-linecap="round" />`;
            }

            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
              <defs>
                <linearGradient id="grad-${name.replace(/[^a-zA-Z]/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${startColor};stop-opacity:1" />
                  <stop offset="100%" style="stop-color:${endColor};stop-opacity:1" />
                </linearGradient>
                <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.15"/>
                </filter>
              </defs>
              <rect width="100" height="100" rx="16" fill="url(#grad-${name.replace(/[^a-zA-Z]/g, '')})" />
              <g filter="url(#shadow)">
                ${iconPath}
              </g>
            </svg>`;
            return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
          };

          // Re-insert services
          await runQuery('INSERT INTO services (id, shopId, name, price, icon, category, image, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['1', shopId, "Men's Shirt", 3.50, 'Shirt', 'Laundry', generateSVG("Men's Shirt", 'Laundry'), now]);
          await runQuery('INSERT INTO services (id, shopId, name, price, icon, category, image, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['2', shopId, "Women's Dress", 8.00, 'Heart', 'Laundry', generateSVG("Women's Dress", 'Laundry'), now]);
          await runQuery('INSERT INTO services (id, shopId, name, price, icon, category, image, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['3', shopId, "Suit Jacket", 12.50, 'Layers', 'Dry Cleaning', generateSVG("Suit Jacket", 'Dry Cleaning'), now]);
          await runQuery('INSERT INTO services (id, shopId, name, price, icon, category, image, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['4', shopId, "Pants", 5.00, 'Shirt', 'Laundry', generateSVG("Pants", 'Laundry'), now]);
          await runQuery('INSERT INTO services (id, shopId, name, price, icon, category, image, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['5', shopId, "Bedding", 15.00, 'Bed', 'Laundry', generateSVG("Bedding", 'Laundry'), now]);

          // Re-insert types
          await runQuery('INSERT INTO service_types (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', ['wf', shopId, 'Wash & Fold', 4.50, 'Droplet', now]);
          await runQuery('INSERT INTO service_types (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', ['dc', shopId, 'Dry Clean', 7.25, 'Wind', now]);
          await runQuery('INSERT INTO service_types (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', ['po', shopId, 'Pressing Only', 3.00, 'Layers', now]);

          // Re-insert addons
          await runQuery('INSERT INTO addons (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', ['sd', shopId, 'Scented Detergent', 0.50, 'Droplet', now]);
          await runQuery('INSERT INTO addons (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', ['fs', shopId, 'Fabric Softener', 0.50, 'Sparkles', now]);
          await runQuery('INSERT INTO addons (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', ['ex', shopId, 'Express 4h', 5.00, 'Zap', now]);

          // Re-insert categories
          await runQuery('INSERT INTO service_categories (id, shopId, name, icon, updatedAt) VALUES (?, ?, ?, ?, ?)', ['cat1', shopId, 'Laundry', 'Droplet', now]);
          await runQuery('INSERT INTO service_categories (id, shopId, name, icon, updatedAt) VALUES (?, ?, ?, ?, ?)', ['cat2', shopId, 'Dry Cleaning', 'Wind', now]);
          await runQuery('INSERT INTO service_categories (id, shopId, name, icon, updatedAt) VALUES (?, ?, ?, ?, ?)', ['cat3', shopId, 'Alterations', 'Scissors', now]);
          await runQuery('INSERT INTO service_categories (id, shopId, name, icon, updatedAt) VALUES (?, ?, ?, ?, ?)', ['cat4', shopId, 'Premium', 'Sparkles', now]);

          summaryList.push('Services & Categories: Re-seeded default inventory services');
        }

        await runQuery('COMMIT');
      } catch (dbErr) {
        await runQuery('ROLLBACK');
        throw dbErr;
      }

      // Format audit log text for SUCCESS
      const auditDetails = `Reset Type: ${resetType}. Result: Success. Reset Modules: [${modulesStr}]`;
      if (window.electronAPI?.dbQuery) {
        const auditId = 'AUD_' + Math.random().toString(36).substr(2, 9).toUpperCase();
        await window.electronAPI.dbQuery(
          'INSERT INTO audit_logs (id, event, details, userId, userRole, timestamp, device) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [auditId, 'SYSTEM_RESET', auditDetails, userName, userRole, new Date().toISOString(), 'Desktop-App']
        );
      }

      // Add summary messages for settings
      if (toReset.generalSettings) summaryList.push('General settings: Restored to defaults');
      if (toReset.workflowStatuses) summaryList.push('Order Workflow Stages: Restored default 10 statuses');
      if (toReset.presetDamageNotes) summaryList.push('Damage Notes: Restored default 6 templates');
      if (toReset.companyInfo) summaryList.push('Company & Shop Info: Cleared details');
      if (toReset.taxSettings) summaryList.push('Tax & UAE Compliance: Restored 5% VAT exclusive');
      if (toReset.billTemplates) summaryList.push('Bill Templates & Terms: Restored standard invoice template');
      if (toReset.waTemplates) summaryList.push('WhatsApp Templates: Restored default message formats');
      if (toReset.printers) summaryList.push('Printers Configuration: Cleared tag and billing printers');
      if (toReset.gateways) summaryList.push('Payment Gateways: Cleared Nomod/Stripe/Tap/Fatoorah credentials');

      // Update actual setting context
      await updateSettings(newSettings);

      setResetSummary(summaryList);
      setShowSuccessSummary(true);
    } catch (err) {
      console.error(err);
      
      // Format audit log text for FAILURE
      const auditDetails = `Reset Type: ${resetType}. Result: Failed. Selected Modules: [${modulesStr}]. Error: ${err.message}`;
      if (window.electronAPI?.dbQuery) {
        try {
          const auditId = 'AUD_' + Math.random().toString(36).substr(2, 9).toUpperCase();
          await window.electronAPI.dbQuery(
            'INSERT INTO audit_logs (id, event, details, userId, userRole, timestamp, device) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [auditId, 'SYSTEM_RESET_FAILED', auditDetails, userName, userRole, new Date().toISOString(), 'Desktop-App']
          );
        } catch (logErr) {
          console.error('Failed to write failure audit log:', logErr);
        }
      }
      
      alert('Reset Failed: ' + err.message);
    }
  };

  const previewOrder = {
    id: '#AG-PREVIEW',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    customer: 'John Doe',
    residency: 'Sample Residency, Suite 101',
    status: 'PAID',
    items: [
      { name: 'Standard Wash & Fold', sub: 'Regular treatment', qty: 10, price: 1.5, total: 15.0 },
      { name: 'Business Shirt', sub: 'Laundered & Pressed', qty: 5, price: 3.5, total: 17.5 }
    ],
    subtotal: 32.5,
    tax: 2.6,
    total: 35.1
  };

  console.log("Settings rendering tabs:", tabs, "isSuperAdmin:", isSuperAdmin, "userRole:", user.role);

  return (
    <div className={styles.settingsPage}>
      <div className={styles.headerRow}>
        <div className={styles.headerMain}>
          <h1>Settings</h1>
          <p>Configure company profiles, bill templates, and system preferences.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.saveBtn} onClick={() => alert('All settings saved successfully!')}>
            <CheckCircle size={18} /> Save All Changes
          </button>
        </div>
      </div>

      <div className={`${styles.tabsContainer} ${canScrollLeft ? styles.hasScrollLeft : ''} ${canScrollRight ? styles.hasScrollRight : ''}`}>
        {canScrollLeft && (
          <button
            type="button"
            className={`${styles.scrollArrow} ${styles.scrollArrowLeft}`}
            onClick={() => scrollTabs('left')}
            aria-label="Scroll tabs left"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <div className={styles.tabs} ref={tabsRef} onScroll={checkScroll}>
          {tabs.map(tab => (
            <div
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </div>
          ))}
        </div>

        {canScrollRight && (
          <button
            type="button"
            className={`${styles.scrollArrow} ${styles.scrollArrowRight}`}
            onClick={() => scrollTabs('right')}
            aria-label="Scroll tabs right"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      <div className={styles.settingsGrid}>
        <div className={styles.mainContent}>


          {activeTab === 'Payment Gateway' && (
            <div className={styles.profileContainer}>
              <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
                <h2 className={styles.cardTitle}>Nomod Payment Gateway Settings</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.25rem' }}>Configure API credentials and payment preferences for Nomod.</p>

                <div className={styles.toggleWrapper} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #F1F5F9', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>Enable Nomod</label>
                    <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>Use Nomod for POS payment link generation.</p>
                  </div>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={settings.enableNomod ?? false}
                      onChange={(e) => updateSettings({ enableNomod: e.target.checked })}
                    />
                    <span className={`${styles.slider} ${styles.round}`}></span>
                  </label>
                </div>
                {settings.enableNomod && !settings.nomodApiKey && (
                  <div style={{ marginTop: '0.75rem', marginBottom: '1.25rem', padding: '0.6rem 0.9rem', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', fontSize: '0.8rem', color: '#92400E', fontWeight: 600 }}>
                    ⚠️ Demo Mode — No API key configured. A sandbox link will be generated. Add your Nomod API key below to exit demo mode.
                  </div>
                )}

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>API Key</label>
                    <input
                      type="password"
                      className={styles.inputField}
                      placeholder="Live or Sandbox API Key (X-API-KEY)"
                      value={settings.nomodApiKey || ''}
                      onChange={(e) => updateSettings({ nomodApiKey: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Merchant ID</label>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder="Nomod Account / Merchant ID"
                      value={settings.nomodMerchantId || ''}
                      onChange={(e) => updateSettings({ nomodMerchantId: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Environment</label>
                    <select
                      className={styles.inputField}
                      value={settings.nomodEnv || 'sandbox'}
                      onChange={(e) => updateSettings({ nomodEnv: e.target.value })}
                    >
                      <option value="sandbox">Sandbox</option>
                      <option value="live">Live</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Default Currency</label>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder="e.g. AED"
                      value={settings.nomodCurrency || 'AED'}
                      onChange={(e) => updateSettings({ nomodCurrency: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>Webhook Secret (Optional)</label>
                    <input
                      type="password"
                      className={styles.inputField}
                      placeholder="Nomod Webhook Signature Secret Key"
                      value={settings.nomodWebhookSecret || ''}
                      onChange={(e) => updateSettings({ nomodWebhookSecret: e.target.value })}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Used to securely verify payment success notifications sent directly from Nomod.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Import Backup' && (
            <div className={styles.profileContainer}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Import / Restore Database Backup</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Choose a previously exported backup file to restore all data.</p>
                  </div>
                </div>
                <div className={styles.maintenanceContent} style={{ marginTop: '2rem' }}>
                  <div className={styles.backupBox} style={{ background: '#F8FAFC', padding: '2rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div className={styles.backupIcon} style={{ background: '#F3E8FF', padding: '1rem', borderRadius: '12px' }}>
                      <Upload size={32} color="#7C3AED" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: '0.5rem', color: '#1E293B' }}>Import / Restore Database Backup</h3>
                      <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Choose a previously exported backup file (`laundry_pos_backup.sqlite` or any `.sqlite`/`.db` backup) to restore all data.
                        This will completely replace the active database and reload the application.
                      </p>
                      <button
                        className={styles.saveBtn}
                        style={{ background: '#7C3AED', padding: '0.75rem 1.5rem' }}
                        onClick={async () => {
                          if (window.electronAPI?.importDatabase) {
                            if (confirm('WARNING: Importing a backup will completely replace your current database and restart the application view. Are you sure you want to proceed?')) {
                              const result = await window.electronAPI.importDatabase();
                              if (result.success) {
                                alert('Database imported and restored successfully!');
                              } else if (result.error !== 'Cancelled') {
                                alert('Restore failed: ' + result.error);
                              }
                            }
                          }
                        }}
                      >
                        <Upload size={18} /> Choose Backup File & Restore
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'License Settings' && (
            <Activation />
          )}

          {activeTab === 'General' && (
            <div className={styles.profileContainer}>
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Regional & System Preferences</h2>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>System Language</label>
                    <select
                      className={styles.inputField}
                      value={settings.language || 'English'}
                      onChange={(e) => updateSettings({ language: e.target.value })}
                    >
                      <option value="English">English</option>
                      <option value="Arabic">Arabic (العربية)</option>
                      <option value="Hindi">Hindi (हिन्दी)</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Currency Symbol</label>
                    <div className={styles.inputWrapper}>
                      <DollarSign size={18} color="#94A3B8" />
                      <input
                        type="text"
                        className={styles.inputField}
                        value={settings.currencySymbol || ''}
                        onChange={(e) => updateSettings({ currencySymbol: e.target.value })}
                        placeholder="AED"
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Date Format</label>
                    <select
                      className={styles.inputField}
                      value={settings.dateFormat || 'DD/MM/YYYY'}
                      onChange={(e) => updateSettings({ dateFormat: e.target.value })}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                      <option value="DD MMM YYYY">DD MMM YYYY (e.g. 25 May 2026)</option>
                      <option value="MMM DD, YYYY">MMM DD, YYYY (e.g. May 25, 2026)</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Time Format</label>
                    <select
                      className={styles.inputField}
                      value={settings.timeFormat || '12h'}
                      onChange={(e) => updateSettings({ timeFormat: e.target.value })}
                    >
                      <option value="12h">12-Hour (AM/PM)</option>
                      <option value="24h">24-Hour</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Automation & Defaults</h2>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Auto-Print Receipt</label>
                    <div className={styles.toggleRow}>
                      <span className={styles.toggleLabel}>Automatically trigger print dialog after order</span>
                      <div
                        className={`${styles.switch} ${settings.autoPrint ? styles.switchOn : ''}`}
                        onClick={() => updateSettings({ autoPrint: !settings.autoPrint })}
                      >
                        <div className={styles.switchHandle}></div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Default Payment Method</label>
                    <select
                      className={styles.inputField}
                      value={settings.defaultPaymentMethod || 'Cash'}
                      onChange={(e) => updateSettings({ defaultPaymentMethod: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="UPI">UPI</option>
                      <option value="Not Paid">Not Paid</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Card Commission (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className={styles.inputField}
                      value={settings.cardCommission ?? ''}
                      onChange={(e) => updateSettings({ cardCommission: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Card Default Account</label>
                    <select
                      className={styles.inputField}
                      value={settings.cardDefaultAccountId || ''}
                      onChange={(e) => updateSettings({ cardDefaultAccountId: e.target.value })}
                    >
                      <option value="">Select Account</option>
                      {(settings.bankAccounts || []).map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bankName} ({acc.accountNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>UPI Default Account</label>
                    <select
                      className={styles.inputField}
                      value={settings.upiDefaultAccountId || ''}
                      onChange={(e) => updateSettings({ upiDefaultAccountId: e.target.value })}
                    >
                      <option value="">Select Account</option>
                      {(settings.bankAccounts || []).map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bankName} ({acc.accountNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Operational Rules</h2>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Default {t('overdue', settings.language)} Period (Days)</label>
                    <div className={styles.inputWrapper}>
                      <Clock size={18} color="#94A3B8" />
                      <input
                        type="number"
                        className={styles.inputField}
                        placeholder="7"
                        value={settings.overdueDays ?? ''}
                        onChange={(e) => updateSettings({ overdueDays: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Default Credit Limit</label>
                    <div
                      className={styles.inputWrapper}
                      style={{
                        background: !isCreditLimitUnlocked ? '#F8FAFC' : 'white',
                        cursor: !isCreditLimitUnlocked ? 'pointer' : 'default'
                      }}
                      onClick={() => {
                        if (!isCreditLimitUnlocked) {
                          setShowPinModal(true);
                        }
                      }}
                    >
                      <CurrencySymbol size={18} />
                      <input
                        type="number"
                        className={styles.inputField}
                        value={creditLimitInput}
                        onChange={(e) => setCreditLimitInput(e.target.value)}
                        onBlur={(e) => {
                          const parsed = parseFloat(e.target.value);
                          const val = isNaN(parsed) ? 0 : parsed;
                          setCreditLimitInput(String(val));
                          updateSettings({ defaultCreditLimit: val });
                        }}
                        disabled={!isCreditLimitUnlocked}
                        style={{ cursor: !isCreditLimitUnlocked ? 'pointer' : 'text' }}
                        min="0"
                      />
                      {!isCreditLimitUnlocked ? (
                        <Lock size={16} color="#EF4444" style={{ cursor: 'pointer' }} />
                      ) : (
                        <Unlock size={16} color="#10B981" />
                      )}
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Late Delivery Threshold (Days)</label>
                    <div className={styles.inputWrapper}>
                      <Clock size={18} color="#94A3B8" />
                      <input
                        type="number"
                        className={styles.inputField}
                        placeholder="3"
                        value={settings.lateDeliveryDays ?? ''}
                        onChange={(e) => updateSettings({ lateDeliveryDays: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <div className={styles.toggleWrapper} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                      <div>
                        <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>Enable Credit Limit Protection</label>
                        <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>Block orders when a customer exceeds their credit limit.</p>
                      </div>
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={settings.enableCreditLimitProtection || false}
                          onChange={(e) => updateSettings({ enableCreditLimitProtection: e.target.checked })}
                        />
                        <span className={`${styles.slider} ${styles.round}`}></span>
                      </label>
                    </div>
                  </div>

                  {settings.enableCreditLimitProtection && (
                    <>
                      <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                        <div className={styles.toggleWrapper} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                          <div>
                            <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>Enable Manager Override</label>
                            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>Allow bypassing the credit limit using the Order Deletion PIN.</p>
                          </div>
                          <label className={styles.switch}>
                            <input
                              type="checkbox"
                              checked={settings.enableManagerOverride || false}
                              onChange={(e) => updateSettings({ enableManagerOverride: e.target.checked })}
                            />
                            <span className={`${styles.slider} ${styles.round}`}></span>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Order Workflow' && (
            <div className={styles.profileContainer}>
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Order Workflow Statuses</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1rem' }}>
                  Configure custom workflow stages for your laundry. Core statuses (Confirmed, Delivered, Cancelled) are required by the system.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {(settings.workflowStatuses || []).map((status, idx) => {
                    const isCore = ['Confirmed', 'Delivered', 'Cancelled'].includes(status);
                    const isEditing = editingStatusIdx === idx;
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        background: '#F8FAFC',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0'
                      }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                            <input
                              type="text"
                              className={styles.inputField}
                              style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
                              value={editingStatusVal}
                              onChange={(e) => setEditingStatusVal(e.target.value)}
                            />
                            <button className={styles.saveChangesBtn} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => handleEditWorkflowStatus(idx)}>Save</button>
                            <button className={styles.discardBtn} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => setEditingStatusIdx(-1)}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1E293B' }}>{status}</span>
                              {isCore && <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: '#94A3B8', background: '#F1F5F9', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}><Lock size={10} /> SYSTEM</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              {!isCore && (
                                <>
                                  <span className={styles.editBtn} style={{ fontSize: '0.825rem' }} onClick={() => {
                                    setEditingStatusIdx(idx);
                                    setEditingStatusVal(status);
                                  }}>Rename</span>
                                  <button style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} onClick={() => handleDeleteWorkflowStatus(idx)}>
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.5rem' }}>Add New Status</h4>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder="e.g. Dry Cleaning, Stain Treatment..."
                      value={newStatusInput}
                      onChange={(e) => setNewStatusInput(e.target.value)}
                    />
                    <button className={styles.saveChangesBtn} style={{ whiteSpace: 'nowrap' }} onClick={handleAddWorkflowStatus}>Add Stage</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Damage Notes' && (
            <div className={styles.profileContainer}>
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Preset Damage Notes & Fabric Remarks</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1rem' }}>
                  Configure preset damage tags and remarks to speed up order creation at the POS.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {(settings.presetDamageNotes || []).map((note, idx) => {
                    const isEditing = editingDamageNoteIdx === idx;
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        background: '#F8FAFC',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0'
                      }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                            <input
                              type="text"
                              className={styles.inputField}
                              style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
                              value={editingDamageNoteVal}
                              onChange={(e) => setEditingDamageNoteVal(e.target.value)}
                            />
                            <button className={styles.saveChangesBtn} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => handleEditDamageNote(idx)}>Save</button>
                            <button className={styles.discardBtn} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => setEditingDamageNoteIdx(-1)}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1E293B' }}>{note}</span>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              <span className={styles.editBtn} style={{ fontSize: '0.825rem' }} onClick={() => {
                                setEditingDamageNoteIdx(idx);
                                setEditingDamageNoteVal(note);
                              }}>Rename</span>
                              <button style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} onClick={() => handleDeleteDamageNote(idx)}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.5rem' }}>Add New Preset Note</h4>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder="e.g. Colour Bleeding, Loose Threads, Torn Lining..."
                      value={newDamageNoteInput}
                      onChange={(e) => setNewDamageNoteInput(e.target.value)}
                    />
                    <button className={styles.saveChangesBtn} style={{ whiteSpace: 'nowrap' }} onClick={handleAddDamageNote}>Add Note</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Company Info' && (
            <div className={styles.profileContainer}>
              {/* Section 1: Branding */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Business Branding</h2>
                <div className={styles.logoUploadArea}>
                  <div className={styles.previewCircle}>
                    {settings.logo ? (
                      <img src={settings.logo} alt="Preview" />
                    ) : (
                      <img src={defaultLogo} alt="Preview" onError={(e) => { e.target.style.display = 'none'; }} />
                    )}
                  </div>
                  <div className={styles.uploadActions}>
                    <label className={styles.uploadBtn}>
                      <Upload size={14} /> Upload Logo
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handleImageUpload}
                      />
                    </label>
                    <button className={styles.removeBtn} onClick={() => updateSettings({ logo: null })}>Remove Logo</button>
                  </div>
                </div>

                <div className={styles.formGrid} style={{ marginTop: '1.5rem' }}>
                  <div className={styles.formGroup}>
                    <label>Legal Business Name (English)</label>
                    <div className={styles.inputWrapper}>
                      <Building2 size={18} color="#94A3B8" />
                      <input
                        type="text"
                        className={styles.inputField}
                        value={settings.companyName}
                        onChange={(e) => updateSettings({ companyName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Legal Business Name (Arabic / عربي)</label>
                    <div className={styles.inputWrapper} style={{ direction: 'rtl' }}>
                      <input
                        type="text"
                        className={styles.inputField}
                        style={{ textAlign: 'right' }}
                        placeholder="الاسم التجاري باللغة العربية"
                        value={settings.companyNameAr || ''}
                        onChange={(e) => updateSettings({ companyNameAr: e.target.value })}
                      />
                      <Building2 size={18} color="#94A3B8" style={{ marginLeft: '0.75rem' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact Details */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Contact Information</h2>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Email Address</label>
                    <div className={styles.inputWrapper}>
                      <Mail size={18} color="#94A3B8" />
                      <input
                        type="email"
                        className={styles.inputField}
                        placeholder="info@yourcompany.ae"
                        value={settings.email}
                        onChange={(e) => updateSettings({ email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Website</label>
                    <div className={styles.inputWrapper}>
                      <Globe size={18} color="#94A3B8" />
                      <input
                        type="url"
                        className={styles.inputField}
                        placeholder="www.yourcompany.ae"
                        value={settings.website}
                        onChange={(e) => updateSettings({ website: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Primary Phone</label>
                    <div className={styles.inputWrapper}>
                      <Phone size={18} color="#94A3B8" />
                      <input
                        type="tel"
                        className={styles.inputField}
                        placeholder="+971 50 000 0000"
                        value={settings.phone}
                        onChange={(e) => updateSettings({ phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Alternate / Office Number</label>
                    <div className={styles.inputWrapper}>
                      <Phone size={18} color="#94A3B8" />
                      <input
                        type="tel"
                        className={styles.inputField}
                        placeholder="+971 4 000 0000"
                        value={settings.alternatePhone}
                        onChange={(e) => updateSettings({ alternatePhone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                  <label>WhatsApp Country Code</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#64748B' }}>+</span>
                    <input
                      type="text"
                      className={styles.inputField}
                      style={{ width: '80px' }}
                      value={settings.waCountryCode}
                      onChange={(e) => updateSettings({ waCountryCode: e.target.value.replace(/\D/g, '') })}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Used for sending automated billing messages.</p>
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                  <label>Manager / Deletion PIN</label>
                  <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.5rem' }}>
                    A 4-digit PIN required for manager overrides (like credit limit approvals) and confirming order deletions.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '300px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>New PIN</span>
                      <div className={styles.inputWrapper}>
                        <Lock size={18} color="#94A3B8" />
                        <input
                          type="password"
                          maxLength={4}
                          className={styles.inputField}
                          placeholder="••••"
                          value={newPinInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setNewPinInput(val);
                            setPinChangeError('');
                            setPinChangeSuccess('');
                          }}
                        />
                      </div>
                    </div>

                    {pinChangeError && (
                      <p style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>
                        {pinChangeError}
                      </p>
                    )}

                    {pinChangeSuccess && (
                      <p style={{ color: '#10B981', fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>
                        {pinChangeSuccess}
                      </p>
                    )}

                    {newPinInput.length === 4 && (
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        style={{ alignSelf: 'flex-start', marginTop: '0.25rem', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => {
                          updateSettings({ orderDeletePin: newPinInput });
                          setPinChangeSuccess('PIN updated successfully!');
                          setNewPinInput('');
                        }}
                      >
                        Update PIN
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: UAE Compliance */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>UAE Compliance & Registration</h2>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>TRN (Tax Registration Number)</label>
                    <div className={styles.inputWrapper}>
                      <Hash size={18} color="#94A3B8" />
                      <input
                        type="text"
                        className={styles.inputField}
                        placeholder="100XXXXXXXXXXXX"
                        value={settings.trn}
                        onChange={(e) => updateSettings({ trn: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Trade License Number</label>
                    <div className={styles.inputWrapper}>
                      <FileText size={18} color="#94A3B8" />
                      <input
                        type="text"
                        className={styles.inputField}
                        placeholder="License # / Reg #"
                        value={settings.licenseNumber}
                        onChange={(e) => updateSettings({ licenseNumber: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Location & Address */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Address & Location</h2>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Street Address (English)</label>
                    <div className={styles.inputWrapper}>
                      <MapPin size={18} color="#94A3B8" />
                      <input
                        type="text"
                        className={styles.inputField}
                        placeholder="e.g. Shop 12, Business Bay, Marasi Dr"
                        value={settings.address}
                        onChange={(e) => updateSettings({ address: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Street Address (Arabic / عربي)</label>
                    <div className={styles.inputWrapper} style={{ direction: 'rtl' }}>
                      <input
                        type="text"
                        className={styles.inputField}
                        style={{ textAlign: 'right' }}
                        placeholder="العنوان باللغة العربية"
                        value={settings.addressAr || ''}
                        onChange={(e) => updateSettings({ addressAr: e.target.value })}
                      />
                      <MapPin size={18} color="#94A3B8" style={{ marginLeft: '0.75rem' }} />
                    </div>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>City / Area</label>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder="e.g. Business Bay"
                      value={settings.city}
                      onChange={(e) => updateSettings({ city: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Emirate</label>
                    <select
                      className={styles.inputField}
                      value={settings.emirate}
                      onChange={(e) => updateSettings({ emirate: e.target.value })}
                    >
                      {['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'].map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {/* Section 5: System Preferences */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>System Preferences</h2>
                <div className={styles.formGroup}>
                  <label>Currency Symbol</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className={styles.inputField}
                      style={{ width: '120px' }}
                      value={settings.currencySymbol || ''}
                      placeholder="AED"
                      onChange={(e) => updateSettings({ currencySymbol: e.target.value })}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#94A3B8' }}>This symbol will be used across the POS, Reports, and Invoices.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Tax Settings' && (
            <div className={styles.profileContainer}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Tax Configuration</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Manage how taxes are applied to your orders.</p>
                  </div>
                  <div className={styles.toggleWrapper}>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={settings.isTaxEnabled}
                        onChange={(e) => updateSettings({ isTaxEnabled: e.target.checked })}
                      />
                      <span className={`${styles.slider} ${styles.round}`}></span>
                    </label>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: settings.isTaxEnabled ? '#2563EB' : '#94A3B8' }}>
                      {settings.isTaxEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                </div>

                <div className={settings.isTaxEnabled ? styles.formGrid : styles.formDisabled}>
                  <div className={styles.formGroup}>
                    <label>Tax Label (e.g. VAT, GST)</label>
                    <div className={styles.inputWrapper}>
                      <Info size={18} color="#94A3B8" />
                      <input
                        type="text"
                        disabled={!settings.isTaxEnabled}
                        placeholder="VAT"
                        value={settings.taxName}
                        onChange={(e) => updateSettings({ taxName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>TRN / Tax Number</label>
                    <div className={styles.inputWrapper}>
                      <Hash size={18} color="#94A3B8" />
                      <input
                        type="text"
                        disabled={!settings.isTaxEnabled}
                        placeholder="e.g. 100234567800003"
                        value={settings.trn}
                        onChange={(e) => updateSettings({ trn: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className={settings.isTaxEnabled ? styles.formGrid : styles.formDisabled}>
                  <div className={styles.formGroup}>
                    <label>Default Tax Rate (%)</label>
                    <div className={styles.inputWrapper}>
                      <Percent size={18} color="#94A3B8" />
                      <input
                        type="number"
                        step="0.01"
                        disabled={!settings.isTaxEnabled}
                        placeholder="5.00"
                        value={settings.taxRate ?? ''}
                        onChange={(e) => updateSettings({ taxRate: e.target.value })}
                      />
                    </div>
                    <div className={styles.presets}>
                      {[0, 5, 12, 15].map(rate => (
                        <button
                          key={rate}
                          type="button"
                          className={`${styles.presetBtn} ${settings.taxRate === rate ? styles.activePreset : ''}`}
                          onClick={() => settings.isTaxEnabled && updateSettings({ taxRate: rate })}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={settings.isTaxEnabled ? styles.methodSelection : styles.formDisabled}>
                  <label className={styles.methodLabel}>Tax Calculation Method</label>
                  <div className={styles.methodGrid}>
                    <div
                      className={`${styles.methodCard} ${settings.taxMethod === 'exclusive' ? styles.methodActive : ''}`}
                      onClick={() => settings.isTaxEnabled && updateSettings({ taxMethod: 'exclusive' })}
                    >
                      <div className={styles.methodIcon}><Plus size={16} /></div>
                      <div className={styles.methodInfo}>
                        <h4>Tax Exclusive</h4>
                        <p>Tax is added on top of the item price.</p>
                      </div>
                    </div>
                    <div
                      className={`${styles.methodCard} ${settings.taxMethod === 'inclusive' ? styles.methodActive : ''}`}
                      onClick={() => settings.isTaxEnabled && updateSettings({ taxMethod: 'inclusive' })}
                    >
                      <div className={styles.methodIcon}><CheckCircle size={16} /></div>
                      <div className={styles.methodInfo}>
                        <h4>Tax Inclusive</h4>
                        <p>Item price already includes the tax.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {!settings.isTaxEnabled && (
                  <div className={styles.warningBox}>
                    <Info size={18} color="#92400E" />
                    <p>Tax is currently disabled. Prices shown in POS and invoices will not include any tax calculations.</p>
                  </div>
                )}
              </div>

              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Tax Summary Preview</h3>
                <div className={styles.previewStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>
                      {settings.taxMethod === 'inclusive' ? 'Selling Price (Inclusive)' : 'Subtotal'}
                    </span>
                    <span className={styles.statValue}><CurrencySymbol size={14} /> 100.00</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>{settings.taxName} ({(parseFloat(settings.taxRate) || 0)}%)</span>
                    <span className={styles.statValue}>
                      {settings.isTaxEnabled ? (
                        settings.taxMethod === 'inclusive'
                          ? <><CurrencySymbol size={14} /> {(100 - (100 / (1 + ((parseFloat(settings.taxRate) || 0) / 100)))).toFixed(2)}</>
                          : <><CurrencySymbol size={14} /> {(100 * (parseFloat(settings.taxRate) || 0) / 100).toFixed(2)}</>
                      ) : <><CurrencySymbol size={14} /> 0.00</>}
                    </span>
                  </div>
                  <div className={styles.divider}></div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel} style={{ fontWeight: 800, color: '#1E293B' }}>
                      {settings.taxMethod === 'inclusive' ? 'Base Price' : 'Total Amount'}
                    </span>
                    <span className={styles.statValue} style={{ fontWeight: 800, color: '#2563EB' }}>
                      {settings.isTaxEnabled ? (
                        settings.taxMethod === 'inclusive'
                          ? <><CurrencySymbol size={14} /> {(100 / (1 + ((parseFloat(settings.taxRate) || 0) / 100))).toFixed(2)}</>
                          : <><CurrencySymbol size={14} /> {(100 + (100 * (parseFloat(settings.taxRate) || 0) / 100)).toFixed(2)}</>
                      ) : <><CurrencySymbol size={14} /> 100.00</>}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Bill Templates' && (
            <div className={styles.profileContainer}>

              {/* Template Style Picker */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Invoice Layout Style</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.25rem' }}>Choose the overall look of your printed invoice.</p>
                <div className={styles.templatesGrid} style={{ marginBottom: '1rem' }}>
                  <TemplateCard id="standard" name="Standard" description="Bilingual office layout" active={settings.invoiceTemplate === 'standard'} onClick={() => updateSettings({ invoiceTemplate: 'standard' })} />
                  <TemplateCard id="modern" name="Modern" description="Clean single-language" active={settings.invoiceTemplate === 'modern'} onClick={() => updateSettings({ invoiceTemplate: 'modern' })} />
                  <TemplateCard id="compact" name="Compact" description="Thermal / small receipt" active={settings.invoiceTemplate === 'compact'} onClick={() => updateSettings({ invoiceTemplate: 'compact' })} />
                </div>
              </div>

              {/* Visible Elements */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Invoice Elements</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.5rem' }}>Toggle which sections appear on printed / downloaded invoices.</p>
                <div className={styles.formGrid}>
                  {[
                    { label: 'Shop Logo', sub: 'Company logo in header', key: 'invoiceShowLogo' },
                    { label: 'Compliance QR Code', sub: 'Order QR code for tracking', key: 'invoiceShowQrCode' },
                    { label: 'Bilingual Text', sub: 'Headings in English & Arabic', key: 'invoiceShowBilingual' },
                    { label: 'Terms & Conditions', sub: 'Print note at bottom', key: 'invoiceShowTerms' },
                    { label: 'Bank Transfer Details', sub: 'Payment bank accounts', key: 'invoiceShowBankDetails' },
                  ].map(({ label, sub, key }) => (
                    <div className={styles.formGroup} key={key}>
                      <label>{label}</label>
                      <div className={styles.toggleRow}>
                        <span className={styles.toggleLabel}>{sub}</span>
                        <div
                          className={`${styles.switch} ${settings[key] !== false ? styles.switchOn : ''}`}
                          onClick={() => updateSettings({ [key]: settings[key] === false })}
                        >
                          <div className={styles.switchHandle}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {settings.invoiceShowTerms !== false && (
                  <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
                    <label>Terms & Conditions / Invoice Note</label>
                    <textarea
                      className={styles.inputField}
                      style={{ width: '100%', height: '90px', padding: '0.75rem', borderRadius: '10px', border: '1px solid #E2E8F0', outline: 'none', resize: 'vertical', marginTop: '0.5rem', fontSize: '0.875rem', color: '#1E293B', fontFamily: 'inherit' }}
                      placeholder="Enter terms & conditions to print on invoice..."
                      value={settings.invoiceTermsText || ''}
                      onChange={(e) => updateSettings({ invoiceTermsText: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Content Customization */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Content & Text Settings</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.25rem' }}>Customize labels, prefixes, and taglines printed on every invoice.</p>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Document Title</label>
                    <div className={styles.inputWrapper}>
                      <FileText size={18} color="#94A3B8" />
                      <input
                        type="text"
                        className={styles.inputField}
                        placeholder="TAX INVOICE"
                        value={settings.invoiceDocTitle || ''}
                        onChange={(e) => updateSettings({ invoiceDocTitle: e.target.value })}
                      />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.3rem' }}>Shown as the big title in the centre of the invoice (default: TAX INVOICE)</p>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Arabic Document Title</label>
                    <div className={styles.inputWrapper} style={{ direction: 'rtl' }}>
                      <input
                        type="text"
                        className={styles.inputField}
                        style={{ textAlign: 'right' }}
                        placeholder="فاتورة ضريبية"
                        value={settings.invoiceDocTitleAr || ''}
                        onChange={(e) => updateSettings({ invoiceDocTitleAr: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Invoice Number Prefix</label>
                    <div className={styles.inputWrapper}>
                      <Hash size={18} color="#94A3B8" />
                      <input
                        type="text"
                        className={styles.inputField}
                        placeholder="#AG-"
                        value={settings.invoicePrefix || ''}
                        onChange={(e) => updateSettings({ invoicePrefix: e.target.value })}
                      />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.3rem' }}>Prefix shown before the invoice number</p>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Footer Tagline</label>
                    <div className={styles.inputWrapper}>
                      <Info size={18} color="#94A3B8" />
                      <input
                        type="text"
                        className={styles.inputField}
                        placeholder="Thank you for your business!"
                        value={settings.invoiceFooterTagline || ''}
                        onChange={(e) => updateSettings({ invoiceFooterTagline: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Style Customization */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Style & Appearance</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.25rem' }}>Set the accent colour and text size for the invoice.</p>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Accent / Brand Colour</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="color"
                        value={settings.invoiceAccentColor || '#2563EB'}
                        onChange={(e) => updateSettings({ invoiceAccentColor: e.target.value })}
                        style={{ width: 44, height: 44, border: 'none', borderRadius: 10, cursor: 'pointer', padding: 2 }}
                      />
                      <input
                        type="text"
                        className={styles.inputField}
                        style={{ width: 110 }}
                        value={settings.invoiceAccentColor || '#2563EB'}
                        onChange={(e) => updateSettings({ invoiceAccentColor: e.target.value })}
                        placeholder="#2563EB"
                      />
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {['#2563EB', '#0F766E', '#7C3AED', '#DC2626', '#D97706', '#16A34A', '#0F172A'].map(c => (
                          <button key={c} onClick={() => updateSettings({ invoiceAccentColor: c })}
                            style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: settings.invoiceAccentColor === c ? '2.5px solid #0F172A' : '2px solid transparent', cursor: 'pointer' }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Invoice Font Size</label>
                    <select
                      className={styles.inputField}
                      value={settings.invoiceFontSize || 'normal'}
                      onChange={(e) => updateSettings({ invoiceFontSize: e.target.value })}
                    >
                      <option value="small">Small (compact, more items fit)</option>
                      <option value="normal">Normal (default)</option>
                      <option value="large">Large (easier to read)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className={styles.card}>
                <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.5px' }}>LIVE PREVIEW</h3>
                <div style={{ background: '#F1F5F9', padding: '2rem', borderRadius: '12px', display: 'flex', justifyContent: 'center', overflowY: 'auto', maxHeight: '600px' }}>
                  <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', width: '140%', marginBottom: '-15%' }}>
                    <InvoiceTemplate order={previewOrder} settings={settings} isPreview={true} />
                  </div>
                </div>

              </div>

            </div>
          )}


          {activeTab === 'Bank' && (
            <div className={styles.profileContainer}>

              {isSuperAdmin && (
                <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
                  <h2 className={styles.cardTitle}>Online Payment Links</h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.25rem' }}>Configure online payment link status.</p>

                  <div className={styles.toggleWrapper} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #F1F5F9', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>Enable Online Payment Links</label>
                      <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>Allows creating and sending payment links to customers.</p>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={settings.enablePaymentLinks ?? true}
                        onChange={(e) => updateSettings({ enablePaymentLinks: e.target.checked })}
                      />
                      <span className={`${styles.slider} ${styles.round}`}></span>
                    </label>
                  </div>

                  <div className={styles.toggleWrapper} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                    <div>
                      <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>Allow Managers to configure Nomod Payment Gateway</label>
                      <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>Allows Managers to view, edit and manage Nomod settings.</p>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={settings.allowManagerNomodConfig ?? false}
                        onChange={(e) => updateSettings({ allowManagerNomodConfig: e.target.checked })}
                      />
                      <span className={`${styles.slider} ${styles.round}`}></span>
                    </label>
                  </div>
                </div>
              )}




              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Bank Transfer Details</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Add one or more bank accounts for customer payments.</p>
                  </div>
                  <button
                    className={styles.saveBtn}
                    style={{ background: '#2563EB', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                    onClick={() => {
                      const newAccounts = [...(settings.bankAccounts || []), { id: Date.now().toString(), bankName: '', accountNumber: '', iban: '' }];
                      updateSettings({ bankAccounts: newAccounts });
                    }}
                  >
                    <Plus size={16} /> Add New Bank
                  </button>
                </div>

                <div className={styles.bankAccountsList} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                  {(settings.bankAccounts || []).map((account, index) => (
                    <div key={index} className={`${styles.bankAccountItem} ${settings.defaultBankId === account.id ? styles.defaultBank : ''}`} style={{ border: '1px solid #E2E8F0', padding: '1.5rem', borderRadius: '12px', position: 'relative' }}>
                      <div className={styles.bankItemActions} style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                          className={styles.defaultToggle}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: settings.defaultBankId === account.id ? '#F59E0B' : '#94A3B8', fontWeight: 700, fontSize: '0.8rem' }}
                          onClick={() => updateSettings({ defaultBankId: account.id })}
                        >
                          <Star size={18} fill={settings.defaultBankId === account.id ? '#F59E0B' : 'none'} />
                          {settings.defaultBankId === account.id ? 'Default Account' : 'Set as Default'}
                        </button>
                        <button
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                          onClick={async () => {
                            if (window.electronAPI?.dbQuery && account.id) {
                              try {
                                const res = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM account_transactions WHERE bankAccountId = ?', [account.id]);
                                const count = res?.data?.[0]?.count || 0;
                                if (count > 0) {
                                  alert("Restricted: Cannot delete this bank account because it has associated transaction history.");
                                  return;
                                }
                              } catch (err) {
                                console.error("Error checking bank transactions:", err);
                              }
                            }
                            if (window.confirm("Are you sure you want to delete this bank account?")) {
                              const newAccounts = settings.bankAccounts.filter((_, i) => i !== index);
                              const newDefault = settings.defaultBankId === account.id ? '' : settings.defaultBankId;
                              updateSettings({ bankAccounts: newAccounts, defaultBankId: newDefault });
                            }
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label>Bank Name</label>
                          <div className={styles.inputWrapper}>
                            <Building2 size={18} color="#94A3B8" />
                            <input
                              type="text"
                              className={styles.inputField}
                              placeholder="e.g. Emirates NBD"
                              value={account.bankName}
                              onChange={(e) => {
                                const newAccounts = [...settings.bankAccounts];
                                newAccounts[index].bankName = e.target.value;
                                updateSettings({ bankAccounts: newAccounts });
                              }}
                            />
                          </div>
                        </div>
                        <div className={styles.formGroup}>
                          <label>Account Number</label>
                          <div className={styles.inputWrapper}>
                            <Hash size={18} color="#94A3B8" />
                            <input
                              type="text"
                              className={styles.inputField}
                              placeholder="00000000000"
                              value={account.accountNumber}
                              onChange={(e) => {
                                const newAccounts = [...settings.bankAccounts];
                                newAccounts[index].accountNumber = e.target.value;
                                updateSettings({ bankAccounts: newAccounts });
                              }}
                            />
                          </div>
                        </div>
                        <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                          <label>IBAN Number</label>
                          <div className={styles.inputWrapper}>
                            <FileText size={18} color="#94A3B8" />
                            <input
                              type="text"
                              className={styles.inputField}
                              placeholder="AE00 0000 0000 0000 0000 000"
                              value={account.iban}
                              onChange={(e) => {
                                const newAccounts = [...settings.bankAccounts];
                                newAccounts[index].iban = e.target.value.toUpperCase();
                                updateSettings({ bankAccounts: newAccounts });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(settings.bankAccounts || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                      <Building2 size={40} color="#94A3B8" style={{ marginBottom: '1rem' }} />
                      <p style={{ color: '#64748B', fontSize: '0.9rem' }}>No bank accounts added yet.</p>
                      <button
                        style={{ marginTop: '1rem', color: '#2563EB', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => updateSettings({ bankAccounts: [{ bankName: '', accountNumber: '', iban: '' }] })}
                      >
                        Click to add your first bank account
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.card} style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
                <h3 className={styles.cardTitle} style={{ fontSize: '1rem', color: '#475569' }}>Payment Note</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: '1.6' }}>
                  These details will be displayed on your invoices to allow customers to pay via bank transfer.
                  Please ensure all information is accurate to avoid payment delays.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'WhatsApp Config' && (
            <div className={styles.profileContainer}>
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>WhatsApp Integration Preferences</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.5rem' }}>
                  Configure your default country prefix and customizable messaging templates for customer communications.
                </p>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>WhatsApp Default Country Code</label>
                    <div className={styles.inputWrapper}>
                      <Globe size={18} color="#94A3B8" />
                      <input
                        type="text"
                        className={styles.inputField}
                        placeholder="e.g. 971 for UAE, 91 for India"
                        value={settings.waCountryCode || ''}
                        onChange={(e) => updateSettings({ waCountryCode: e.target.value.replace(/\D/g, '') })}
                      />
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Automatically prepends this prefix to phone numbers when initiating chats.
                    </p>
                  </div>
                </div>
              </div>

              {/* Messaging templates */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>WhatsApp Message Templates</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.5rem' }}>
                  Define custom content templates for automated text notifications. Use placeholders like <code>{"{customerName}"}</code>, <code>{"{orderId}"}</code>, <code>{"{total}"}</code>, <code>{"{dueAmount}"}</code>, and <code>{"{deliveryDate}"}</code>.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className={styles.formGroup}>
                    <label>New Order / Invoice Confirmation Message</label>
                    <textarea
                      className={styles.inputField}
                      style={{ minHeight: '100px', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                      placeholder="e.g. Hello {customerName}! Your laundry bill for {orderId} of {total} has been saved. Thank you!"
                      value={settings.waNewOrderTemplate || ''}
                      onChange={(e) => updateSettings({ waNewOrderTemplate: e.target.value })}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Sent right after recording a new POS transaction.
                    </p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Order Ready / Pick-up Message</label>
                    <textarea
                      className={styles.inputField}
                      style={{ minHeight: '100px', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                      placeholder="e.g. Dear {customerName}, your order {orderId} is now ready for pick-up! Total due is {dueAmount}. Thank you!"
                      value={settings.waOrderReadyTemplate || ''}
                      onChange={(e) => updateSettings({ waOrderReadyTemplate: e.target.value })}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Sent when updating the workflow stage to "Ready" or "Ready to Pick up".
                    </p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Payment / Overdue Outstanding Reminder</label>
                    <textarea
                      className={styles.inputField}
                      style={{ minHeight: '100px', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                      placeholder="e.g. Hello {customerName}, this is a gentle reminder that an amount of {dueAmount} is pending for order {orderId}. Kindly settle at your earliest convenience."
                      value={settings.waReminderTemplate || ''}
                      onChange={(e) => updateSettings({ waReminderTemplate: e.target.value })}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Sent from the Order Management screen or Statement page.
                    </p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Statement / Credit Notification Template</label>
                    <textarea
                      className={styles.inputField}
                      style={{ minHeight: '100px', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                      placeholder="e.g. Hello {customerName}, your current outstanding balance is {dueAmount}. Please find your statement attached."
                      value={settings.waStatementTemplate || ''}
                      onChange={(e) => updateSettings({ waStatementTemplate: e.target.value })}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Sent from the Customer Statements page.
                    </p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>POS Checkout Receipt Confirmation Message</label>
                    <textarea
                      className={styles.inputField}
                      style={{ minHeight: '100px', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                      placeholder="e.g. Hello {customerName}! Your laundry order totaling {total} has been received. Thank you!"
                      value={settings.waCheckoutReceiptTemplate || ''}
                      onChange={(e) => updateSettings({ waCheckoutReceiptTemplate: e.target.value })}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Sent when choosing to WhatsApp a receipt during the checkout flow.
                    </p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>General Workflow Status Update Message</label>
                    <textarea
                      className={styles.inputField}
                      style={{ minHeight: '100px', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                      placeholder="e.g. Hello! Regarding your laundry order #{orderId}, the current status is {status}."
                      value={settings.waStatusUpdateTemplate || ''}
                      onChange={(e) => updateSettings({ waStatusUpdateTemplate: e.target.value })}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Sent when doing a general workflow status update from Expected Deliveries or Kanban board.
                    </p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Customer Outstanding Balance Reminder</label>
                    <textarea
                      className={styles.inputField}
                      style={{ minHeight: '100px', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                      placeholder="e.g. Hello {customerName}! Friendly reminder that your outstanding balance is {dueAmount}."
                      value={settings.waCustomerBalanceTemplate || ''}
                      onChange={(e) => updateSettings({ waCustomerBalanceTemplate: e.target.value })}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Sent from the main Customer database list or Overdue Statement view.
                    </p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>General Reach out / Quick Chat Template</label>
                    <textarea
                      className={styles.inputField}
                      style={{ minHeight: '100px', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                      placeholder="e.g. Hello! We are reaching out from {shopName} regarding your account."
                      value={settings.waGeneralTemplate || ''}
                      onChange={(e) => updateSettings({ waGeneralTemplate: e.target.value })}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Sent on general quick-chat WhatsApp click when no specific transaction context is present.
                    </p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Invoice Detail Share Template</label>
                    <textarea
                      className={styles.inputField}
                      style={{ minHeight: '100px', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                      placeholder="e.g. Hello {customerName}! Here is your bill for order {orderId}: {itemsSummary}."
                      value={settings.waInvoiceShareTemplate || ''}
                      onChange={(e) => updateSettings({ waInvoiceShareTemplate: e.target.value })}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem' }}>
                      Sent from the print Invoice page when choosing to send details via WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Printers' && (
            <div className={styles.profileContainer}>
              <div className={styles.card}>
                <div>
                  <h2 className={styles.cardTitle}>Printer Configuration</h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.5rem' }}>
                    Select specific printers for receipt printing and garment tags. Leave as default to show the native print dialog every time.
                  </p>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Billing & Receipt Printer</label>
                    <div className={styles.inputWrapper}>
                      <select
                        className={styles.inputField}
                        value={settings.billingPrinter || ''}
                        onChange={(e) => updateSettings({ billingPrinter: e.target.value })}
                      >
                        <option value="">Show Print Dialog (Ask Every Time)</option>
                        <option value="System Default Printer">System Default Printer (Silent)</option>
                        {availablePrinters.map(p => (
                          <option key={p.name} value={p.name}>{p.name} {p.isDefault ? '(Default)' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.5rem' }}>
                      Printers configured here will be used when printing billing invoices and receipts.
                    </p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Garment Tag Printer</label>
                    <div className={styles.inputWrapper}>
                      <select
                        className={styles.inputField}
                        value={settings.tagPrinter || ''}
                        onChange={(e) => updateSettings({ tagPrinter: e.target.value })}
                      >
                        <option value="">Show Print Dialog (Ask Every Time)</option>
                        <option value="System Default Printer">System Default Printer (Silent)</option>
                        {availablePrinters.map(p => (
                          <option key={p.name} value={p.name}>{p.name} {p.isDefault ? '(Default)' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.5rem' }}>
                      Printers configured here will be used when printing garment identification tags.
                    </p>
                  </div>
                </div>
              </div>

              {!window.electronAPI && (
                <div className={styles.warningBox}>
                  <Info size={18} color="#92400E" />
                  <p>Silent hardware printing options are only available when running in the Desktop App.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Maintenance' && (
            <div className={styles.profileContainer}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Data Backup & Security</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Export a manual copy of your local database to an external drive or cloud folder.</p>
                  </div>
                </div>

                <div className={styles.maintenanceContent} style={{ marginTop: '2rem' }}>
                  <div className={styles.backupBox} style={{ background: '#F8FAFC', padding: '2rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div className={styles.backupIcon} style={{ background: '#DBEAFE', padding: '1rem', borderRadius: '12px' }}>
                      <Database size={32} color="#2563EB" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: '0.5rem', color: '#1E293B' }}>Manual Database Export</h3>
                      <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        This will create a complete copy of your local database (laundry_pos.sqlite).
                        You can save this to a USB drive or any folder on your computer.
                      </p>
                      <button
                        className={styles.saveBtn}
                        style={{ background: '#2563EB', padding: '0.75rem 1.5rem' }}
                        onClick={async () => {
                          if (window.electronAPI?.backupDatabase) {
                            const result = await window.electronAPI.backupDatabase();
                            if (result.success) {
                              alert('Backup saved successfully to: ' + result.path);
                            } else if (result.error !== 'Cancelled') {
                              alert('Backup failed: ' + result.error);
                            }
                          }
                        }}
                      >
                        <Save size={18} /> Choose Path & Backup Now
                      </button>
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div className={styles.backupBox} style={{ background: '#F8FAFC', padding: '2rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '2rem', marginTop: '1.5rem' }}>
                      <div className={styles.backupIcon} style={{ background: '#F3E8FF', padding: '1rem', borderRadius: '12px' }}>
                        <Upload size={32} color="#7C3AED" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ marginBottom: '0.5rem', color: '#1E293B' }}>Import / Restore Database Backup</h3>
                        <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1rem' }}>
                          Choose a previously exported backup file (`laundry_pos_backup.sqlite` or any `.sqlite`/`.db` backup) to restore all data.
                          This will completely replace the active database and reload the application.
                        </p>
                        <button
                          className={styles.saveBtn}
                          style={{ background: '#7C3AED', padding: '0.75rem 1.5rem' }}
                          onClick={async () => {
                            if (window.electronAPI?.importDatabase) {
                              if (confirm('WARNING: Importing a backup will completely replace your current database and restart the application view. Are you sure you want to proceed?')) {
                                const result = await window.electronAPI.importDatabase();
                                if (result.success) {
                                  alert('Database imported and restored successfully!');
                                } else if (result.error !== 'Cancelled') {
                                  alert('Restore failed: ' + result.error);
                                }
                              }
                            }
                          }}
                        >
                          <Upload size={18} /> Choose Backup File & Restore
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={styles.backupBox} style={{ background: '#F8FAFC', padding: '2rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '2rem', marginTop: '1.5rem' }}>
                    <div className={styles.backupIcon} style={{ background: '#ECFDF5', padding: '1rem', borderRadius: '12px' }}>
                      <RefreshCw size={32} color="#10B981" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: '0.5rem', color: '#1E293B' }}>Automatic USB Backup</h3>
                      <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Set a default folder (e.g., on your USB drive). The system will automatically save a backup there based on the selected interval.
                      </p>

                      {settings.autoBackupPath && (
                        <div className={styles.formGroup} style={{ marginBottom: '1.25rem', maxWidth: '320px' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1E293B', display: 'block', marginBottom: '0.5rem' }}>Auto-Backup Interval</label>
                          <select
                            className={styles.inputField}
                            value={settings.autoBackupInterval ?? 60}
                            onChange={(e) => updateSettings({ autoBackupInterval: parseInt(e.target.value) })}
                          >
                            <option value={60}>Every 1 Minute</option>
                            <option value={300}>Every 5 Minutes</option>
                            <option value={900}>Every 15 Minutes</option>
                            <option value={1800}>Every 30 Minutes</option>
                            <option value={3600}>Every 1 Hour</option>
                            <option value={21600}>Every 6 Hours</option>
                            <option value={86400}>Daily</option>
                            <option value={0}>Disabled</option>
                          </select>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                          className={styles.saveBtn}
                          style={{ background: '#10B981', padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                          onClick={async () => {
                            if (window.electronAPI?.selectFolder) {
                              const path = await window.electronAPI.selectFolder();
                              if (path) {
                                await updateSettings({ autoBackupPath: path });
                                alert('Auto-backup path set to: ' + path);
                              }
                            }
                          }}
                        >
                          {settings.autoBackupPath ? 'Change USB Path' : 'Select USB Path'}
                        </button>

                        {settings.autoBackupPath && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10B981', fontSize: '0.85rem', fontWeight: 600 }}>
                              <CheckCircle size={14} />
                              <span>Path: {settings.autoBackupPath}</span>
                              <button
                                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', marginLeft: '0.5rem' }}
                                onClick={() => updateSettings({ autoBackupPath: '', lastBackupTime: '' })}
                              >
                                <X size={14} />
                              </button>
                            </div>
                            {settings.lastBackupTime && (
                              <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Clock size={12} />
                                <span>Last successful backup: <strong>{settings.lastBackupTime}</strong></span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.warningBox} style={{ marginTop: '2rem', display: 'flex', gap: '1rem', background: '#FFF7ED', border: '1px solid #FED7AA', padding: '1.5rem', borderRadius: '12px' }}>
                    <AlertCircle size={24} color="#F97316" />
                    <div>
                      <h4 style={{ color: '#9A3412', marginBottom: '0.25rem' }}>Important Note</h4>
                      <p style={{ color: '#C2410C', fontSize: '0.85rem' }}>
                        Manual backups are great for extra safety, but remember that the system already performs **automatic cloud syncs** every 60 seconds as long as you are online.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Software Update' && (
            <div className={styles.profileContainer}>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <div className={styles.card} style={{ background: '#FFFFFF', padding: '2.5rem', borderRadius: '16px', border: '1px solid #F1F5F9', boxShadow: '0 4px 20px -2px rgba(148, 163, 184, 0.12)' }}>
                <div className={styles.cardHeader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '1.25rem', marginBottom: '2.5rem' }}>
                  <div style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', padding: '1rem', borderRadius: '14px' }}>
                    <Cpu size={32} color="#2563EB" />
                  </div>
                  <div>
                    <h2 className={styles.cardTitle} style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.25rem' }}>Software Update</h2>
                    <p style={{ fontSize: '0.875rem', color: '#64748B' }}>Keep your POS software up to date for the latest features, security, and enhancements.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', background: '#F8FAFC', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ minWidth: '180px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Version</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', marginTop: '0.25rem' }}>v{currentVersion}</div>
                    </div>
                    <div style={{ minWidth: '180px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Checked</span>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#334155', marginTop: '0.25rem' }}>
                        {lastCheckTime || 'Never'}
                      </div>
                    </div>
                  </div>

                  {updateStatus.type === 'idle' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                      <p style={{ color: '#475569', fontSize: '0.9rem' }}>Click below to query the update server for any pending updates.</p>
                      <button
                        className={styles.saveBtn}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#2563EB', padding: '0.75rem 1.5rem' }}
                        onClick={() => {
                          if (window.electronAPI?.checkForUpdates) {
                            window.electronAPI.checkForUpdates();
                          }
                        }}
                      >
                        <RefreshCw size={18} /> Check for Updates
                      </button>
                    </div>
                  )}

                  {updateStatus.type === 'checking' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1.5rem', borderRadius: '12px' }}>
                      <div style={{ animation: 'spin 1.5s linear infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RefreshCw size={24} color="#2563EB" />
                      </div>
                      <div>
                        <h4 style={{ color: '#1E3A8A', margin: 0 }}>Checking for updates...</h4>
                        <p style={{ color: '#3B82F6', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>Connecting to remote software repository...</p>
                      </div>
                    </div>
                  )}

                  {updateStatus.type === 'not-available' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '1.5rem', borderRadius: '12px' }}>
                        <CheckCircle size={24} color="#10B981" />
                        <div>
                          <h4 style={{ color: '#065F46', margin: 0 }}>Application is up to date</h4>
                          <p style={{ color: '#059669', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>You are using the latest version.</p>
                        </div>
                      </div>
                      <button
                        className={styles.saveBtn}
                        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', padding: '0.75rem 1.5rem' }}
                        onClick={() => {
                          if (window.electronAPI?.checkForUpdates) {
                            window.electronAPI.checkForUpdates();
                          }
                        }}
                      >
                        <RefreshCw size={18} /> Check Again
                      </button>
                    </div>
                  )}

                  {updateStatus.type === 'available' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#FFF7ED', border: '1px solid #FFEDD5', padding: '1.5rem', borderRadius: '12px' }}>
                        <Info size={24} color="#F97316" />
                        <div>
                          <h4 style={{ color: '#7C2D12', margin: 0 }}>Update Available: v{updateStatus.version}</h4>
                          <p style={{ color: '#C2410C', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>A new version of the laundry software has been published and is ready to download.</p>
                        </div>
                      </div>

                      {updateStatus.releaseNotes && (
                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1.5rem', borderRadius: '12px' }}>
                          <h5 style={{ color: '#334155', margin: '0 0 0.75rem 0', fontWeight: 600 }}>What's New in this Version:</h5>
                          <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '0.875rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                            {updateStatus.releaseNotes}
                          </pre>
                        </div>
                      )}

                      <button
                        className={styles.saveBtn}
                        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#2563EB', padding: '0.75rem 1.5rem' }}
                        onClick={() => {
                          if (window.electronAPI?.downloadUpdate) {
                            window.electronAPI.downloadUpdate();
                          }
                        }}
                      >
                        <Download size={18} /> Download & Install Update
                      </button>
                    </div>
                  )}

                  {updateStatus.type === 'downloading' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '2rem', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>Downloading software update...</span>
                        <span style={{ fontWeight: 700, color: '#2563EB' }}>{updateStatus.progress}%</span>
                      </div>

                      <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${updateStatus.progress}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease-out'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Please do not close the application or disconnect from the internet.</span>
                    </div>
                  )}

                  {updateStatus.type === 'downloaded' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '1.5rem', borderRadius: '12px' }}>
                        <CheckCircle size={24} color="#10B981" />
                        <div>
                          <h4 style={{ color: '#065F46', margin: 0 }}>Download Complete!</h4>
                          <p style={{ color: '#059669', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>The update was downloaded successfully. A restart is required to apply the update.</p>
                        </div>
                      </div>

                      <button
                        className={styles.saveBtn}
                        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#10B981', padding: '0.75rem 1.5rem' }}
                        onClick={() => {
                          if (window.electronAPI?.installUpdate) {
                            window.electronAPI.installUpdate();
                          }
                        }}
                      >
                        <RefreshCw size={18} /> Restart and Apply Update
                      </button>
                    </div>
                  )}

                  {updateStatus.type === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '1.5rem', borderRadius: '12px' }}>
                        <AlertCircle size={24} color="#EF4444" />
                        <div>
                          <h4 style={{ color: '#991B1B', margin: 0 }}>Update Check Failed</h4>
                          <p style={{ color: '#B91C1C', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>{updateStatus.message || 'An error occurred while checking for updates.'}</p>
                        </div>
                      </div>
                      <button
                        className={styles.saveBtn}
                        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#2563EB', padding: '0.75rem 1.5rem' }}
                        onClick={() => {
                          if (window.electronAPI?.checkForUpdates) {
                            window.electronAPI.checkForUpdates();
                          }
                        }}
                      >
                        <RefreshCw size={18} /> Retry Check
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Web Dashboard' && (
            <div className={styles.profileContainer}>
              <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
                <h2 className={styles.cardTitle}>🌐 Web Dashboard — Branch Security Settings</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.5rem' }}>
                  Configure this branch's identity and security key for the online owner dashboard. The owner can view all branches live on a phone by logging in at the backend server's <strong>/dashboard</strong> URL.
                </p>

                <div style={{ background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.8rem', color: '#3730A3', fontWeight: 600, margin: 0 }}>
                    ℹ️ How it works: Each branch PC syncs using a unique security API Key. The owner logs in using their personal email/username and password. PINs are no longer used for security.
                  </p>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Branch Name <span style={{ color: '#6366F1', fontWeight: 600 }}>*</span></label>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder="e.g., Dubai Mall Branch"
                      value={settings.branchName || ''}
                      onChange={(e) => updateSettings({ branchName: e.target.value })}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.25rem 0 0' }}>This name appears on the owner's web dashboard.</p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Branch ID <span style={{ color: '#6366F1', fontWeight: 600 }}>*</span></label>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder="e.g., BRANCH_DUBAI_01"
                      value={settings.branchId || ''}
                      onChange={(e) => updateSettings({ branchId: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.25rem 0 0' }}>Unique identifier — must be different for each branch. No spaces allowed.</p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Branch Sync API Key <span style={{ color: '#6366F1', fontWeight: 600 }}>*</span></label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className={styles.inputField}
                        style={{ fontFamily: 'monospace' }}
                        placeholder="Generate a secure API Key"
                        value={settings.branchApiKey || ''}
                        onChange={(e) => updateSettings({ branchApiKey: e.target.value.trim() })}
                      />
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
                        onClick={() => {
                          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                          let key = 'LB_KEY_';
                          for (let i = 0; i < 24; i++) {
                            key += chars.charAt(Math.floor(Math.random() * chars.length));
                          }
                          updateSettings({ branchApiKey: key });
                        }}
                      >
                        Generate Key
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.25rem 0 0' }}>Cryptographically secure sync key. Enforces branch authenticity during database updates.</p>
                  </div>
                </div>

                {/* Status indicator */}
                {settings.branchName && settings.branchId && settings.branchApiKey && (
                  <div style={{ marginTop: '1rem', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ color: '#16A34A', fontSize: '1.2rem' }}>✅</span>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803D', margin: 0 }}>Ready! This branch is secured.</p>
                      <p style={{ fontSize: '0.75rem', color: '#16A34A', margin: 0 }}>
                        Branch <strong>"{settings.branchName}"</strong> (ID: {settings.branchId}) will synchronize with the server using its secure API Key.
                      </p>
                    </div>
                  </div>
                )}

                {(!settings.branchName || !settings.branchId || !settings.branchApiKey) && (
                  <div style={{ marginTop: '1rem', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ color: '#D97706', fontSize: '1.2rem' }}>⚠️</span>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400E', margin: 0 }}>Incomplete setup</p>
                      <p style={{ fontSize: '0.75rem', color: '#B45309', margin: 0 }}>Fill in all three fields above — Branch Name, Branch ID, and Branch Sync API Key — to activate secure sync.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.card}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.5rem' }}>Setup Instructions</h3>
                <ol style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', color: '#334155', lineHeight: '1.85', margin: 0 }}>
                  <li>Set a <strong>unique Branch Name</strong> on each PC (e.g., "Dubai Mall", "Abu Dhabi")</li>
                  <li>Set a <strong>unique Branch ID</strong> on each PC (e.g., "BRANCH_DUBAI", "BRANCH_ABU_DHABI")</li>
                  <li>Generate a <strong>Branch Sync API Key</strong> by clicking the "Generate Key" button</li>
                  <li>Make sure the app is <strong>syncing to the cloud</strong> (sync icon in the top bar)</li>
                  <li>The owner logs in with their email/username and password at the dashboard URL to monitor performance</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'Email Reports' && (
            <EmailReportsSettings />
          )}

          {activeTab === 'System Reset' && (

            <div className={styles.profileContainer}>
              <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
                <h2 className={styles.cardTitle}>System Reset Options</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.25rem' }}>
                  Reset system settings to defaults or wipe database records.
                </p>
                <div className={styles.resetWarningBanner}>
                  <Info size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Crucial System Operations:</strong> Resetting system preferences or clearing transactions is permanent and cannot be undone. Please ensure you have backed up any critical data first.
                  </div>
                </div>

                <div className={styles.resetGrid}>
                  {/* Factory Reset Card */}
                  <div className={`${styles.resetCard} ${styles.resetDestructiveCard}`}>
                    <div>
                      <h3 className={styles.resetSectionTitle}>
                        <Database size={20} color="#DC2626" /> Full Factory Reset
                      </h3>
                      <p className={styles.resetDescription}>
                        Resets all configuration preferences to system defaults and completely erases all orders, payments, customers, ledger logs, and staff registers. This returns the application to a fresh installation state.
                      </p>
                    </div>
                    <button
                      className={`${styles.resetButton} ${styles.resetButtonPrimary}`}
                      onClick={() => {
                        setResetPinAction('factory');
                        setShowResetPinModal(true);
                      }}
                    >
                      <RefreshCw size={18} /> Execute Factory Reset
                    </button>
                  </div>

                  {/* Custom Reset Card */}
                  <div className={styles.resetCard}>
                    <div>
                      <h3 className={styles.resetSectionTitle}>
                        <Sliders size={20} color="#2563EB" /> Custom Module Reset
                      </h3>
                      <p className={styles.resetDescription}>
                        Selectively choose which specific configurations or database registers to restore or clear. Non-selected modules will remain untouched.
                      </p>

                      <div className={styles.checklistHeader}>
                        <span className={styles.checklistTitle}>Select Modules to Reset</span>
                        <div className={styles.checklistActions}>
                          <button
                            type="button"
                            className={styles.checklistLink}
                            onClick={() => {
                              setResetOptions({
                                generalSettings: true,
                                workflowStatuses: true,
                                presetDamageNotes: true,
                                companyInfo: true,
                                taxSettings: true,
                                billTemplates: true,
                                waTemplates: true,
                                printers: true,
                                gateways: true,
                                ordersPayments: true,
                                customers: true,
                                services: true,
                                expensesBank: true,
                                staffPayroll: true
                              });
                            }}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className={styles.checklistLink}
                            onClick={() => {
                              setResetOptions({
                                generalSettings: false,
                                workflowStatuses: false,
                                presetDamageNotes: false,
                                companyInfo: false,
                                taxSettings: false,
                                billTemplates: false,
                                waTemplates: false,
                                printers: false,
                                gateways: false,
                                ordersPayments: false,
                                customers: false,
                                services: false,
                                expensesBank: false,
                                staffPayroll: false
                              });
                            }}
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      <div className={styles.resetChecklist}>
                        {/* 1. General Settings */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.generalSettings ? styles.active : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, generalSettings: !prev.generalSettings }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.generalSettings}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel}>General System Settings</span>
                            <span className={styles.resetSubLabel}>Resets language, date formats, overdue triggers, default payment options.</span>
                          </div>
                        </div>

                        {/* 2. Order Workflow */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.workflowStatuses ? styles.active : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, workflowStatuses: !prev.workflowStatuses }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.workflowStatuses}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel}>Order Workflow Stages</span>
                            <span className={styles.resetSubLabel}>Resets status stages list back to standard default statuses.</span>
                          </div>
                        </div>

                        {/* 3. Preset Damage Notes */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.presetDamageNotes ? styles.active : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, presetDamageNotes: !prev.presetDamageNotes }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.presetDamageNotes}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel}>Preset Damage Notes</span>
                            <span className={styles.resetSubLabel}>Restores the default list of pre-configured shirt/garment damage notes.</span>
                          </div>
                        </div>

                        {/* 4. Company Profile */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.companyInfo ? styles.active : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, companyInfo: !prev.companyInfo }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.companyInfo}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel}>Company & Shop Profile</span>
                            <span className={styles.resetSubLabel}>Clears logo, company name, address details, Emirate selection.</span>
                          </div>
                        </div>

                        {/* 5. Tax & Compliance */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.taxSettings ? styles.active : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, taxSettings: !prev.taxSettings }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.taxSettings}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel}>Tax & UAE VAT Settings</span>
                            <span className={styles.resetSubLabel}>Resets tax rates, TRN input, and UAE VAT exclusive configurations.</span>
                          </div>
                        </div>

                        {/* 6. Invoice Templates */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.billTemplates ? styles.active : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, billTemplates: !prev.billTemplates }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.billTemplates}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel}>Invoice & Bill Templates</span>
                            <span className={styles.resetSubLabel}>Resets terms text, delivery methods (hanger/fold), template layout.</span>
                          </div>
                        </div>

                        {/* 7. WhatsApp Messages */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.waTemplates ? styles.active : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, waTemplates: !prev.waTemplates }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.waTemplates}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel}>WhatsApp Message Formats</span>
                            <span className={styles.resetSubLabel}>Restores default text message templates for client notices.</span>
                          </div>
                        </div>

                        {/* 8. Local Printer Config */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.printers ? styles.active : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, printers: !prev.printers }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.printers}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel}>Local Printer Mappings</span>
                            <span className={styles.resetSubLabel}>Clears the tag and invoice printer selection.</span>
                          </div>
                        </div>

                        {/* 9. Payment Gateways */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.gateways ? styles.active : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, gateways: !prev.gateways }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.gateways}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel}>Payment Gateways Config</span>
                            <span className={styles.resetSubLabel}>Clears merchant API keys for Stripe, Tap, Nomod, Fatoorah.</span>
                          </div>
                        </div>

                        {/* 10. Destructive: Orders & Payments */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.ordersPayments ? `${styles.active} ${styles.destructive}` : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, ordersPayments: !prev.ordersPayments }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.ordersPayments}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel} style={{ color: resetOptions.ordersPayments ? '#DC2626' : 'inherit' }}>
                              Orders, Sales & Payments
                            </span>
                            <span className={styles.resetSubLabel}>Completely wipes the transaction table, order logs, payments, reconciliations.</span>
                            <span className={styles.destructiveBadge}>Destructive</span>
                          </div>
                        </div>

                        {/* 11. Destructive: Customer Directory */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.customers ? `${styles.active} ${styles.destructive}` : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, customers: !prev.customers }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.customers}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel} style={{ color: resetOptions.customers ? '#DC2626' : 'inherit' }}>
                              Customer Directory
                            </span>
                            <span className={styles.resetSubLabel}>Permanently erases all customer profile records, phone numbers, and balances.</span>
                            <span className={styles.destructiveBadge}>Destructive</span>
                          </div>
                        </div>

                        {/* 12. Destructive: Services & Pricing */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.services ? `${styles.active} ${styles.destructive}` : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, services: !prev.services }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.services}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel} style={{ color: resetOptions.services ? '#DC2626' : 'inherit' }}>
                              Services & Inventory Pricing
                            </span>
                            <span className={styles.resetSubLabel}>Clears custom services, categories, types, and restores default list of services.</span>
                            <span className={styles.destructiveBadge}>Destructive</span>
                          </div>
                        </div>

                        {/* 13. Destructive: Ledger & Cash Register */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.expensesBank ? `${styles.active} ${styles.destructive}` : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, expensesBank: !prev.expensesBank }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.expensesBank}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel} style={{ color: resetOptions.expensesBank ? '#DC2626' : 'inherit' }}>
                              Ledger Accounts & Expenses
                            </span>
                            <span className={styles.resetSubLabel}>Deletes all logged store expenses and bank account transfer records.</span>
                            <span className={styles.destructiveBadge}>Destructive</span>
                          </div>
                        </div>

                        {/* 14. Destructive: Payroll Registers */}
                        <div
                          className={`${styles.resetChecklistItem} ${resetOptions.staffPayroll ? `${styles.active} ${styles.destructive}` : ''}`}
                          onClick={() => setResetOptions(prev => ({ ...prev, staffPayroll: !prev.staffPayroll }))}
                        >
                          <input
                            type="checkbox"
                            className={styles.resetCheckbox}
                            checked={resetOptions.staffPayroll}
                            onChange={() => {}}
                          />
                          <div className={styles.resetLabelGroup}>
                            <span className={styles.resetLabel} style={{ color: resetOptions.staffPayroll ? '#DC2626' : 'inherit' }}>
                              Staff & Payroll Registers
                            </span>
                            <span className={styles.resetSubLabel}>Clears employee registers, wage payout histories, and accrual sheets.</span>
                            <span className={styles.destructiveBadge}>Destructive</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      className={`${styles.resetButton} ${styles.resetButtonSecondary}`}
                      style={{ marginTop: '1.5rem' }}
                      disabled={!Object.values(resetOptions).some(Boolean)}
                      onClick={() => {
                        setResetPinAction('custom');
                        setShowResetPinModal(true);
                      }}
                    >
                      <Save size={18} /> Execute Custom Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      {/* Cropper Modal */}
      {isCropping && (
        <div className={styles.cropperModalOverlay} onClick={() => setIsCropping(false)}>
          <div className={styles.cropperModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cropperHeader}>
              <div className={styles.modalTitle}>
                <Scissors size={20} color="#2563EB" />
                <h2>Crop Your Logo</h2>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setIsCropping(false)} />
            </div>

            <div className={styles.cropperContainer}>
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className={styles.cropperControls}>
              <div className={styles.zoomControl}>
                <Sliders size={16} color="#64748B" />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(e.target.value)}
                  className={styles.zoomRange}
                />
              </div>
              <div className={styles.cropperActions}>
                <button className={styles.secondaryBtn} onClick={() => setIsCropping(false)}>Cancel</button>
                <button className={styles.primaryBtn} onClick={saveCroppedImage}>Apply Crop</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Verification Modal */}
      {showPinModal && (
        <div className={styles.cropperModalOverlay} onClick={() => { setShowPinModal(false); setEnteredPin(''); setPinError(''); }}>
          <div className={styles.cropperModal} style={{ width: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cropperHeader}>
              <div className={styles.modalTitle}>
                <Lock size={20} color="#2563EB" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>Verify Deletion PIN</h2>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => { setShowPinModal(false); setEnteredPin(''); setPinError(''); }} />
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: '1.4' }}>
                Please enter the 4-digit **Order Deletion PIN** to unlock editing the Default Credit Limit.
              </p>

              <div className={styles.formGroup} style={{ margin: 0 }}>
                <div className={styles.inputWrapper}>
                  <Lock size={18} color="#94A3B8" />
                  <input
                    type="password"
                    maxLength={4}
                    className={styles.inputField}
                    placeholder="••••"
                    value={enteredPin}
                    onChange={(e) => {
                      setPinError('');
                      setEnteredPin(e.target.value.replace(/\D/g, ''));
                    }}
                    autoFocus
                    style={{ letterSpacing: '0.5rem', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}
                  />
                </div>
                {pinError && (
                  <p style={{ fontSize: '0.75rem', color: '#EF4444', margin: '0.25rem 0 0 0', fontWeight: '600' }}>
                    {pinError}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.cropperControls} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <div className={styles.cropperActions} style={{ width: '100%', gap: '0.75rem', display: 'flex' }}>
                <button
                  className={styles.secondaryBtn}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowPinModal(false);
                    setEnteredPin('');
                    setPinError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className={styles.primaryBtn}
                  style={{ flex: 1 }}
                  onClick={() => {
                    const correctPin = settings.orderDeletePin || '0000';
                    if (enteredPin === correctPin) {
                      setIsCreditLimitUnlocked(true);
                      setShowPinModal(false);
                      setEnteredPin('');
                      setPinError('');
                    } else {
                      setPinError('Incorrect PIN! Access Denied.');
                    }
                  }}
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Reset PIN Verification Modal */}
      {showResetPinModal && (
        <div className={styles.cropperModalOverlay} onClick={() => { setShowResetPinModal(false); setEnteredResetPin(''); setResetPinError(''); }}>
          <div className={styles.cropperModal} style={{ width: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cropperHeader}>
              <div className={styles.modalTitle}>
                <Lock size={20} color="#DC2626" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>Authorize System Reset</h2>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => { setShowResetPinModal(false); setEnteredResetPin(''); setResetPinError(''); }} />
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: '1.4' }}>
                Please enter the 4-digit **Manager / Deletion PIN** to authorize this system reset operation.
              </p>

              <div className={styles.formGroup} style={{ margin: 0 }}>
                <div className={styles.inputWrapper}>
                  <Lock size={18} color="#94A3B8" />
                  <input
                    type="password"
                    maxLength={4}
                    className={styles.inputField}
                    placeholder="••••"
                    value={enteredResetPin}
                    onChange={(e) => {
                      setResetPinError('');
                      setEnteredResetPin(e.target.value.replace(/\D/g, ''));
                    }}
                    autoFocus
                    style={{ letterSpacing: '0.5rem', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}
                  />
                </div>
                {resetPinError && (
                  <p style={{ fontSize: '0.75rem', color: '#EF4444', margin: '0.25rem 0 0 0', fontWeight: '600' }}>
                    {resetPinError}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.cropperControls} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <div className={styles.cropperActions} style={{ width: '100%', gap: '0.75rem', display: 'flex' }}>
                <button
                  className={styles.secondaryBtn}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowResetPinModal(false);
                    setEnteredResetPin('');
                    setResetPinError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className={styles.primaryBtn}
                  style={{ flex: 1, background: '#DC2626' }}
                  onClick={() => {
                    const correctPin = settings.orderDeletePin || '0000';
                    if (enteredResetPin === correctPin) {
                      setShowResetPinModal(false);
                      setEnteredResetPin('');
                      setResetPinError('');

                      const isFactory = resetPinAction === 'factory';
                      if (isFactory) {
                        setShowBackupPrompt(true);
                      } else {
                        const isDestructive = resetOptions.ordersPayments || resetOptions.customers || resetOptions.services || resetOptions.expensesBank || resetOptions.staffPayroll;
                        if (isDestructive) {
                          setShowResetConfirmModal(true);
                        } else {
                          setShowFinalConfirmModal(true);
                        }
                      }
                    } else {
                      setResetPinError('Incorrect PIN! Access Denied.');
                    }
                  }}
                >
                  Verify PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Prompt Modal */}
      {showBackupPrompt && (
        <div className={styles.cropperModalOverlay} onClick={() => { setShowBackupPrompt(false); setBackupError(''); }}>
          <div className={styles.cropperModal} style={{ width: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cropperHeader}>
              <div className={styles.modalTitle}>
                <Database size={20} color="#2563EB" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>Export Backup First?</h2>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => { setShowBackupPrompt(false); setBackupError(''); }} />
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: '1.5' }}>
                Before executing a Full Factory Reset, it is strongly recommended that you export a database backup file. This allows you to restore all your customer directory, pricing inventory, and order history if needed.
              </p>
              {backupError && (
                <div style={{ padding: '0.6rem 0.9rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', fontSize: '0.8.rem', color: '#B91C1C', fontWeight: 600, lineHeight: '1.4' }}>
                  ⚠️ {backupError}
                </div>
              )}
            </div>

            <div className={styles.cropperControls} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className={styles.primaryBtn}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#2563EB' }}
                onClick={async () => {
                  setBackupError('');
                  if (window.electronAPI?.backupDatabase) {
                    const result = await window.electronAPI.backupDatabase();
                    if (result && result.success) {
                      setShowBackupPrompt(false);
                      setShowResetConfirmModal(true);
                    } else if (result && result.error === 'Cancelled') {
                      setBackupError("Backup was cancelled. You can try again or click \"Reset Without Backup\" to continue.");
                    } else {
                      setBackupError(`Backup failed: ${result?.error || 'Unknown error'}. You can try again or click \"Reset Without Backup\" to continue.`);
                    }
                  } else {
                    setBackupError("Backup API not available in this environment. You can click \"Reset Without Backup\" to continue.");
                  }
                }}
              >
                <Download size={16} /> Create Backup & Continue
              </button>
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                <button
                  className={styles.secondaryBtn}
                  style={{ flex: 1, border: '1px solid #FCA5A5', color: '#DC2626', background: '#FEF2F2' }}
                  onClick={() => {
                    setShowBackupPrompt(false);
                    setBackupError('');
                    setShowResetConfirmModal(true);
                  }}
                >
                  Reset Without Backup
                </button>
                <button
                  className={styles.secondaryBtn}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowBackupPrompt(false);
                    setBackupError('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal (typing RESET) */}
      {showResetConfirmModal && (
        <div className={styles.cropperModalOverlay} onClick={() => { setShowResetConfirmModal(false); setResetTextConfirmation(''); setResetConfirmError(''); }}>
          <div className={styles.cropperModal} style={{ width: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cropperHeader}>
              <div className={styles.modalTitle}>
                <AlertCircle size={20} color="#DC2626" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>Required Text Confirmation</h2>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => { setShowResetConfirmModal(false); setResetTextConfirmation(''); setResetConfirmError(''); }} />
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: '1.5' }}>
                You have selected database modules that will permanently destroy transaction data. To authorize this reset, please type <strong>"RESET"</strong> in the box below.
              </p>

              <div className={styles.formGroup} style={{ margin: 0 }}>
                <input
                  type="text"
                  placeholder="RESET"
                  className={styles.inputField}
                  value={resetTextConfirmation}
                  onChange={(e) => {
                    setResetConfirmError('');
                    setResetTextConfirmation(e.target.value);
                  }}
                  autoFocus
                  style={{ textAlign: 'center', fontWeight: 'bold', letterSpacing: '0.1rem', fontSize: '1.1rem' }}
                />
                {resetConfirmError && (
                  <p style={{ fontSize: '0.75rem', color: '#EF4444', margin: '0.25rem 0 0 0', fontWeight: '600' }}>
                    {resetConfirmError}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.cropperControls} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <div className={styles.cropperActions} style={{ width: '100%', gap: '0.75rem', display: 'flex' }}>
                <button
                  className={styles.secondaryBtn}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowResetConfirmModal(false);
                    setResetTextConfirmation('');
                    setResetConfirmError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className={styles.primaryBtn}
                  style={{ flex: 1, background: '#DC2626' }}
                  disabled={resetTextConfirmation !== 'RESET'}
                  onClick={() => {
                    if (resetTextConfirmation === 'RESET') {
                      setShowResetConfirmModal(false);
                      setResetTextConfirmation('');
                      setResetConfirmError('');
                      setShowFinalConfirmModal(true);
                    } else {
                      setResetConfirmError('You must type exactly "RESET" in all capital letters.');
                    }
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Execution Confirmation Modal */}
      {showFinalConfirmModal && (
        <div className={styles.cropperModalOverlay} onClick={() => setShowFinalConfirmModal(false)}>
          <div className={styles.cropperModal} style={{ width: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cropperHeader}>
              <div className={styles.modalTitle}>
                <AlertCircle size={20} color="#DC2626" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>Final Warning</h2>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowFinalConfirmModal(false)} />
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#DC2626', margin: 0, lineHeight: '1.5', fontWeight: 600 }}>
                ⚠️ Warning: Are you absolutely sure? This is your final chance to cancel. Once executed, the database will be cleared of chosen modules, and setting preferences will revert instantly.
              </p>
            </div>

            <div className={styles.cropperControls} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <div className={styles.cropperActions} style={{ width: '100%', gap: '0.75rem', display: 'flex' }}>
                <button
                  className={styles.secondaryBtn}
                  style={{ flex: 1 }}
                  onClick={() => setShowFinalConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.primaryBtn}
                  style={{ flex: 1, background: '#DC2626' }}
                  onClick={() => {
                    setShowFinalConfirmModal(false);
                    handleResetExecute();
                  }}
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Summary Modal */}
      {showSuccessSummary && (
        <div className={styles.cropperModalOverlay} onClick={() => setShowSuccessSummary(false)}>
          <div className={styles.cropperModal} style={{ width: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cropperHeader}>
              <div className={styles.modalTitle}>
                <CheckCircle size={20} color="#10B981" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>System Reset Successful</h2>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setShowSuccessSummary(false)} />
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: '1.5' }}>
                The reset operations have been executed successfully inside a secure SQLite database transaction and written to the system audit logs. Below is a detailed report of the modules reset:
              </p>

              <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.75rem' }}>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8.rem', color: '#334155', lineHeight: '1.6' }}>
                  {resetSummary.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className={styles.cropperControls} style={{ padding: '1rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <button
                className={styles.primaryBtn}
                style={{ width: '100%', background: '#10B981' }}
                onClick={() => {
                  setShowSuccessSummary(false);
                  navigate('/dashboard');
                }}
              >
                Finish & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({ id, name, description, active, onClick }) {
  return (
    <div className={`${styles.templateCard} ${active ? styles.templateActive : ''}`} onClick={onClick}>
      <div className={styles.templateInfo}>
        <h4>{name}</h4>
        <p>{description}</p>
      </div>
      {active && <div className={styles.checkBadge}><CheckCircle size={14} /> Active</div>}
    </div>
  );
}


