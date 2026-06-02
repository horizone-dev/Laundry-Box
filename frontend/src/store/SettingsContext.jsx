import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_SHOP_ID } from '../constants';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    companyName: 'Laundry Management System',
    companyNameAr: '',
    shopName: 'Laundry Management System',
    logo: null,
    email: '',
    phone: '',
    alternatePhone: '',
    orderDeletePin: '0000',
    website: '',
    address: '',
    addressAr: '',
    city: '',
    emirate: 'Dubai',
    taxId: '',
    trn: '',
    licenseNumber: '',
    taxName: 'VAT',
    taxRate: 5,
    isTaxEnabled: true,
    taxMethod: 'exclusive',
    invoiceTemplate: 'standard',
    waCountryCode: '971',
    currencySymbol: '',
    activationCode: '',
    expiryDate: '',
    isActivated: true,
    activationDate: '',
    licenseFeatures: {
      barcode: true,
      quickItem: true,
      kot: false,
      multiUser: true,
      reports: true,
      cloudSync: true
    },
    bankAccounts: [],
    defaultBankId: '',
    autoBackupPath: '',
    autoBackupInterval: 60,
    lastBackupTime: '',
    language: 'English',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    autoPrint: false,
    defaultPaymentMethod: 'CASH',
    overdueDays: 7,
    defaultCreditLimit: 500,
    lateDeliveryDays: 3,
    workflowStatuses: ['Confirmed', 'Picked Up', 'Washing', 'Drying', 'Ironing', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered', 'Cancelled'],
    presetDamageNotes: ['Stain on collar', 'Fading colour', 'Missing button', 'Tear on sleeve', 'Handle with care', 'Dry Clean Only'],
    invoiceShowLogo: true,
    invoiceShowQrCode: true,
    invoiceShowTerms: true,
    invoiceShowBankDetails: true,
    invoiceShowBilingual: true,
    invoiceTermsText: '1. Please present this invoice at the time of pickup.\n2. We are not responsible for color fading or shrinkage.\n3. Orders must be collected within 30 days.'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const result = await window.electronAPI.dbQuery('SELECT * FROM shops LIMIT 1', []);
        if (result.success && result.data.length > 0) {
          const shop = result.data[0];
          const shopSettings = typeof shop.settings === 'string' ? JSON.parse(shop.settings) : shop.settings;
          setSettings({
            companyName: shop.name || 'Laundry Management System',
            companyNameAr: shopSettings?.companyNameAr || '',
            logo: shopSettings?.logo || null,
            email: shopSettings?.email || '',
            phone: shopSettings?.phone || '',
            alternatePhone: shopSettings?.alternatePhone || '',
            orderDeletePin: shopSettings?.orderDeletePin || '0000',
            website: shopSettings?.website || '',
            address: shopSettings?.address || '',
            addressAr: shopSettings?.addressAr || '',
            city: shopSettings?.city || '',
            emirate: shopSettings?.emirate || 'Dubai',
            taxId: shopSettings?.taxId || '',
            trn: shopSettings?.trn || '',
            licenseNumber: shopSettings?.licenseNumber || '',
            taxName: shopSettings?.taxName || 'VAT',
            taxRate: shopSettings?.taxRate || 5,
            isTaxEnabled: shopSettings?.isTaxEnabled ?? true,
            taxMethod: shopSettings?.taxMethod || 'exclusive',
            invoiceTemplate: shopSettings?.invoiceTemplate || 'standard',
            waCountryCode: shopSettings?.waCountryCode || '971',
            currencySymbol: shopSettings?.currencySymbol ?? '',
            activationCode: shopSettings?.activationCode || '',
            expiryDate: shopSettings?.expiryDate || '',
            isActivated: shop.isActivated === 1,
            activationDate: shop.activationDate || '',
            licenseFeatures: shopSettings?.licenseFeatures || {
              barcode: true,
              quickItem: true,
              kot: false,
              multiUser: true,
              reports: true,
              cloudSync: true
            },
            bankAccounts: shopSettings?.bankAccounts || [],
            defaultBankId: shopSettings?.defaultBankId || '',
            autoBackupPath: shopSettings?.autoBackupPath || '',
            autoBackupInterval: shopSettings?.autoBackupInterval ?? 60,
            lastBackupTime: shopSettings?.lastBackupTime || '',
            language: shopSettings?.language || 'English',
            dateFormat: shopSettings?.dateFormat || 'DD/MM/YYYY',
            timeFormat: shopSettings?.timeFormat || '12h',
            autoPrint: shopSettings?.autoPrint ?? false,
            defaultPaymentMethod: shopSettings?.defaultPaymentMethod || 'CASH',
            overdueDays: shopSettings?.overdueDays ?? 7,
            defaultCreditLimit: shopSettings?.defaultCreditLimit ?? 500,
            lateDeliveryDays: shopSettings?.lateDeliveryDays ?? 3,
            workflowStatuses: shopSettings?.workflowStatuses || ['Confirmed', 'Picked Up', 'Washing', 'Drying', 'Ironing', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered', 'Cancelled'],
            presetDamageNotes: shopSettings?.presetDamageNotes || ['Stain on collar', 'Fading colour', 'Missing button', 'Tear on sleeve', 'Handle with care', 'Dry Clean Only'],
            invoiceShowLogo: shopSettings?.invoiceShowLogo ?? true,
            invoiceShowQrCode: shopSettings?.invoiceShowQrCode ?? true,
            invoiceShowTerms: shopSettings?.invoiceShowTerms ?? true,
            invoiceShowBankDetails: shopSettings?.invoiceShowBankDetails ?? true,
            invoiceShowBilingual: shopSettings?.invoiceShowBilingual ?? true,
            invoiceTermsText: shopSettings?.invoiceTermsText ?? '1. Please present this invoice at the time of pickup.\n2. We are not responsible for color fading or shrinkage.\n3. Orders must be collected within 30 days.'
          });
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      }
    }
  };

  const updateSettings = async (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    if (window.electronAPI?.dbQuery) {
      try {
        const settingsJson = JSON.stringify({
          companyNameAr: updated.companyNameAr,
          logo: updated.logo,
          email: updated.email,
          phone: updated.phone,
          alternatePhone: updated.alternatePhone,
          orderDeletePin: updated.orderDeletePin,
          website: updated.website,
          address: updated.address,
          addressAr: updated.addressAr,
          city: updated.city,
          emirate: updated.emirate,
          taxId: updated.taxId,
          trn: updated.trn,
          licenseNumber: updated.licenseNumber,
          taxName: updated.taxName,
          taxRate: updated.taxRate,
          isTaxEnabled: updated.isTaxEnabled,
          taxMethod: updated.taxMethod,
          invoiceTemplate: updated.invoiceTemplate,
          waCountryCode: updated.waCountryCode,
          currencySymbol: updated.currencySymbol,
          activationCode: updated.activationCode,
          expiryDate: updated.expiryDate,
          licenseFeatures: updated.licenseFeatures,
          bankAccounts: updated.bankAccounts,
          defaultBankId: updated.defaultBankId,
          autoBackupPath: updated.autoBackupPath,
          autoBackupInterval: updated.autoBackupInterval,
          lastBackupTime: updated.lastBackupTime,
          language: updated.language,
          dateFormat: updated.dateFormat,
          timeFormat: updated.timeFormat,
          autoPrint: updated.autoPrint,
          defaultPaymentMethod: updated.defaultPaymentMethod,
          overdueDays: updated.overdueDays,
          defaultCreditLimit: updated.defaultCreditLimit,
          lateDeliveryDays: updated.lateDeliveryDays,
          workflowStatuses: updated.workflowStatuses,
          presetDamageNotes: updated.presetDamageNotes,
          invoiceShowLogo: updated.invoiceShowLogo,
          invoiceShowQrCode: updated.invoiceShowQrCode,
          invoiceShowTerms: updated.invoiceShowTerms,
          invoiceShowBankDetails: updated.invoiceShowBankDetails,
          invoiceShowBilingual: updated.invoiceShowBilingual,
          invoiceTermsText: updated.invoiceTermsText
        });

        await window.electronAPI.dbQuery(
          'UPDATE shops SET name = ?, settings = ?, updatedAt = ? WHERE shopId = ?',
          [updated.companyName, settingsJson, new Date().toISOString(), DEFAULT_SHOP_ID]
        );
      } catch (err) {
        console.error("Failed to save settings:", err);
      }
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Invalid Date';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mShort = monthsShort[d.getMonth()];
    switch (settings.dateFormat) {
      case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
      case 'DD-MM-YYYY': return `${day}-${month}-${year}`;
      case 'DD MMM YYYY': return `${day} ${mShort} ${year}`;
      case 'MMM DD, YYYY': return `${mShort} ${day}, ${year}`;
      case 'DD/MM/YYYY':
      default: return `${day}/${month}/${year}`;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, fetchSettings, formatDate }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
