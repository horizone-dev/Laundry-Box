import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { DEFAULT_SHOP_ID } from '../constants';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(null);
  const [settings, setSettings] = useState({
    companyName: 'Laundry Box',
    companyNameAr: '',
    shopName: 'Laundry Box',
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
    taxMethod: 'inclusive',
    invoiceTemplate: 'standard',
    waCountryCode: '971',
    currencySymbol: 'د.إ',
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
    defaultPaymentMethod: 'Cash',
    cardCommission: 0,
    cardDefaultAccountId: '',
    upiDefaultAccountId: '',
    overdueDays: 7,
    defaultCreditLimit: 500,
    lateDeliveryDays: 3,
    enableCreditLimitProtection: true,
    enableManagerOverride: true,
    workflowStatuses: ['Confirmed', 'Picked Up', 'Washing', 'Drying', 'Ironing', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered'],
    presetDamageNotes: ['Stain on collar', 'Fading colour', 'Missing button', 'Tear on sleeve', 'Handle with care', 'Dry Clean Only'],
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
    invoiceTermsText: '1. Please present this invoice at the time of pickup.\n2. We are not responsible for color fading or shrinkage.\n3. Orders must be collected within 30 days.',
    billingPrinter: '',
    tagPrinter: '',
    enablePaymentLinks: true,
    paymentBaseUrl: 'https://pay.laundry.ae',
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
    nomodExpiry: 30,
    waNewOrderTemplate: 'Hello {customerName}! Your laundry invoice for order {orderId} of {total} has been saved. {dueAmount} is pending. Thank you!',
    waOrderReadyTemplate: 'Dear {customerName}, your order {orderId} is now ready for pick-up! Total due is {dueAmount}. Thank you!',
    waReminderTemplate: 'Hello {customerName}, this is a gentle reminder that an amount of {dueAmount} is pending for order {orderId}. Kindly settle at your earliest convenience.',
    waStatementTemplate: 'Hello {customerName}, your current outstanding balance is {dueAmount}. Please find your statement attached.',
    waCheckoutReceiptTemplate: 'Hello {customerName}! Your laundry order totaling {total} has been received and is now being processed. Thank you for choosing us!',
    waStatusUpdateTemplate: 'Hello! Regarding your laundry order #{orderId}, the current status is "{status}". Expected delivery date is {deliveryDate}. Thank you!',
    waCustomerBalanceTemplate: 'Hello {customerName}! This is a friendly reminder regarding your outstanding balance of {dueAmount} at {shopName}. Please settle it at your earliest convenience. Thank you!',
    waGeneralTemplate: 'Hello! This is from {shopName}. We\'re reaching out regarding your account.',
    waInvoiceShareTemplate: '*INVOICE RECEIVED*\n\nHello! Here is your invoice for order *{orderId}*.\n\n*Items:*\n{itemsSummary}\n\n*Total Amount: {total}*',
    // ─── Web Dashboard ──────────────────────────────────────────
    branchName: '',          // e.g., "Dubai Mall Branch" — shown on web dashboard
    branchApiKey: '',        // Cryptographically secure sync API key
    // ─── System Configuration Module toggles ─────────────────────
    workflowEnabled: true,
    zReportEnabled: true,
    noModPayEnabled: true,
    paymentHistoryEnabled: true,
    zReportClosingType: 'Day Close',
    silentPrinting: true,
    pdfDownloadPath: '',
  });

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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

          let defaultBackupPath = shopSettings?.autoBackupPath || '';
          if (!defaultBackupPath && window.electronAPI?.getDesktopPath) {
            try {
              defaultBackupPath = await window.electronAPI.getDesktopPath();
            } catch (err) {
              console.error("Failed to get desktop path:", err);
            }
          }

          setSettings({
            companyName: shop.name || 'Laundry Box',
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
            taxMethod: shopSettings?.taxMethod || 'inclusive',
            invoiceTemplate: shopSettings?.invoiceTemplate || 'standard',
            waCountryCode: shopSettings?.waCountryCode || '971',
            currencySymbol: shopSettings?.currencySymbol || 'د.إ',
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
            autoBackupPath: defaultBackupPath,
            autoBackupInterval: shopSettings?.autoBackupInterval ?? 60,
            lastBackupTime: shopSettings?.lastBackupTime || '',
            language: shopSettings?.language || 'English',
            dateFormat: shopSettings?.dateFormat || 'DD/MM/YYYY',
            timeFormat: shopSettings?.timeFormat || '12h',
            autoPrint: shopSettings?.autoPrint ?? false,
            defaultPaymentMethod: shopSettings?.defaultPaymentMethod || 'Cash',
            cardCommission: shopSettings?.cardCommission ?? 0,
            cardDefaultAccountId: shopSettings?.cardDefaultAccountId || '',
            upiDefaultAccountId: shopSettings?.upiDefaultAccountId || '',
            overdueDays: shopSettings?.overdueDays ?? 7,
            defaultCreditLimit: shopSettings?.defaultCreditLimit ?? 500,
            lateDeliveryDays: shopSettings?.lateDeliveryDays ?? 3,
            enableCreditLimitProtection: shopSettings?.enableCreditLimitProtection ?? true,
            enableManagerOverride: shopSettings?.enableManagerOverride ?? true,
            workflowStatuses: shopSettings?.workflowStatuses || ['Confirmed', 'Picked Up', 'Washing', 'Drying', 'Ironing', 'Ready', 'Ready to Pick up', 'Out for Delivery', 'Delivered'],
            presetDamageNotes: shopSettings?.presetDamageNotes || ['Stain on collar', 'Fading colour', 'Missing button', 'Tear on sleeve', 'Handle with care', 'Dry Clean Only'],
            deliveryMethods: shopSettings?.deliveryMethods || [
              { name: 'Hanger', nameAr: 'علاقة', isDefault: true },
              { name: 'Folded', nameAr: 'مطوي', isDefault: false },
              { name: 'Bagged', nameAr: 'مكيس', isDefault: false }
            ],
            invoiceShowLogo: shopSettings?.invoiceShowLogo ?? true,
            invoiceShowQrCode: shopSettings?.invoiceShowQrCode ?? true,
            invoiceShowTerms: shopSettings?.invoiceShowTerms ?? true,
            invoiceShowBankDetails: shopSettings?.invoiceShowBankDetails ?? true,
            invoiceShowBilingual: shopSettings?.invoiceShowBilingual ?? true,
            invoiceTermsText: shopSettings?.invoiceTermsText ?? '1. Please present this invoice at the time of pickup.\n2. We are not responsible for color fading or shrinkage.\n3. Orders must be collected within 30 days.',
            billingPrinter: shopSettings?.billingPrinter || '',
            tagPrinter: shopSettings?.tagPrinter || '',
            enablePaymentLinks: shopSettings?.enablePaymentLinks ?? true,
            paymentBaseUrl: shopSettings?.paymentBaseUrl || 'https://pay.laundry.ae',
            allowManagerStripeConfig: shopSettings?.allowManagerStripeConfig ?? false,
            enableStripe: shopSettings?.enableStripe ?? false,
            stripeApiKey: shopSettings?.stripeApiKey || '',
            stripeMerchantId: shopSettings?.stripeMerchantId || '',
            stripeEnv: shopSettings?.stripeEnv || 'sandbox',
            stripeCurrency: shopSettings?.stripeCurrency || 'AED',
            stripeSuccessUrl: shopSettings?.stripeSuccessUrl || '',
            stripeFailureUrl: shopSettings?.stripeFailureUrl || '',
            stripeWebhookSecret: shopSettings?.stripeWebhookSecret || '',
            stripeExpiry: shopSettings?.stripeExpiry ?? 30,
            allowManagerTapConfig: shopSettings?.allowManagerTapConfig ?? false,
            enableTap: shopSettings?.enableTap ?? false,
            tapApiKey: shopSettings?.tapApiKey || '',
            tapMerchantId: shopSettings?.tapMerchantId || '',
            tapEnv: shopSettings?.tapEnv || 'sandbox',
            tapCurrency: shopSettings?.tapCurrency || 'AED',
            tapSuccessUrl: shopSettings?.tapSuccessUrl || '',
            tapFailureUrl: shopSettings?.tapFailureUrl || '',
            tapWebhookSecret: shopSettings?.tapWebhookSecret || '',
            tapExpiry: shopSettings?.tapExpiry ?? 30,
            allowManagerMyFatoorahConfig: shopSettings?.allowManagerMyFatoorahConfig ?? false,
            enableMyFatoorah: shopSettings?.enableMyFatoorah ?? false,
            myfatoorahApiKey: shopSettings?.myfatoorahApiKey || '',
            myfatoorahMerchantId: shopSettings?.myfatoorahMerchantId || '',
            myfatoorahEnv: shopSettings?.myfatoorahEnv || 'sandbox',
            myfatoorahCurrency: shopSettings?.myfatoorahCurrency || 'AED',
            myfatoorahSuccessUrl: shopSettings?.myfatoorahSuccessUrl || '',
            myfatoorahFailureUrl: shopSettings?.myfatoorahFailureUrl || '',
            myfatoorahWebhookSecret: shopSettings?.myfatoorahWebhookSecret || '',
            myfatoorahExpiry: shopSettings?.myfatoorahExpiry ?? 30,
            allowManagerNomodConfig: shopSettings?.allowManagerNomodConfig ?? false,
            enableNomod: shopSettings?.enableNomod ?? false,
            nomodApiKey: shopSettings?.nomodApiKey || '',
            nomodMerchantId: shopSettings?.nomodMerchantId || '',
            nomodEnv: shopSettings?.nomodEnv || 'sandbox',
            nomodCurrency: shopSettings?.nomodCurrency || 'AED',
            nomodSuccessUrl: shopSettings?.nomodSuccessUrl || '',
            nomodFailureUrl: shopSettings?.nomodFailureUrl || '',
            nomodWebhookSecret: shopSettings?.nomodWebhookSecret || '',
            nomodExpiry: shopSettings?.nomodExpiry ?? 30,
            waNewOrderTemplate: shopSettings?.waNewOrderTemplate ?? 'Hello {customerName}! Your laundry invoice for order {orderId} of {total} has been saved. {dueAmount} is pending. Thank you!',
            waOrderReadyTemplate: shopSettings?.waOrderReadyTemplate ?? 'Dear {customerName}, your order {orderId} is now ready for pick-up! Total due is {dueAmount}. Thank you!',
            waReminderTemplate: shopSettings?.waReminderTemplate ?? 'Hello {customerName}, this is a gentle reminder that an amount of {dueAmount} is pending for order {orderId}. Kindly settle at your earliest convenience.',
            waStatementTemplate: shopSettings?.waStatementTemplate ?? 'Hello {customerName}, your current outstanding balance is {dueAmount}. Please find your statement attached.',
            waCheckoutReceiptTemplate: shopSettings?.waCheckoutReceiptTemplate ?? 'Hello {customerName}! Your laundry order totaling {total} has been received and is now being processed. Thank you for choosing us!',
            waStatusUpdateTemplate: shopSettings?.waStatusUpdateTemplate ?? 'Hello! Regarding your laundry order #{orderId}, the current status is "{status}". Expected delivery date is {deliveryDate}. Thank you!',
            waCustomerBalanceTemplate: shopSettings?.waCustomerBalanceTemplate ?? 'Hello {customerName}! This is a friendly reminder regarding your outstanding balance of {dueAmount} at {shopName}. Please settle it at your earliest convenience. Thank you!',
            waGeneralTemplate: shopSettings?.waGeneralTemplate ?? 'Hello! This is from {shopName}. We\'re reaching out regarding your account.',
            waInvoiceShareTemplate: shopSettings?.waInvoiceShareTemplate ?? '*INVOICE RECEIVED*\n\nHello! Here is your invoice for order *{orderId}*.\n\n*Items:*\n{itemsSummary}\n\n*Total Amount: {total}*',
            // ─── Web Dashboard ───────────────────────────────────────
            branchName:   shopSettings?.branchName   || '',
            branchApiKey: shopSettings?.branchApiKey || '',
            branchId:     shopSettings?.branchId     || 'BRANCH_01',
            // System Configuration Module toggles
            workflowEnabled: shopSettings?.workflowEnabled ?? true,
            zReportEnabled: shopSettings?.zReportEnabled ?? true,
            noModPayEnabled: shopSettings?.noModPayEnabled ?? true,
            paymentHistoryEnabled: shopSettings?.paymentHistoryEnabled ?? true,
            zReportClosingType: shopSettings?.zReportClosingType || 'Day Close',
            silentPrinting: shopSettings?.silentPrinting ?? true,
            pdfDownloadPath: shopSettings?.pdfDownloadPath || '',
          });
          window.localStorage.setItem('billingPrinter', shopSettings?.billingPrinter || '');
          window.localStorage.setItem('tagPrinter', shopSettings?.tagPrinter || '');
          window.localStorage.setItem('silentPrinting', (shopSettings?.silentPrinting ?? true) !== false ? 'true' : 'false');
          // Also mirror dashboard settings to localStorage for syncService
          window.localStorage.setItem('laundry_settings', JSON.stringify({
            branchName:   shopSettings?.branchName   || '',
            branchApiKey: shopSettings?.branchApiKey || '',
            branchId:     shopSettings?.branchId     || 'BRANCH_01',
          }));
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      }
    }
  };

  const updateSettings = async (newSettings) => {
    const updated = { ...settingsRef.current, ...newSettings };
    settingsRef.current = updated;
    setSettings(updated);

    if (newSettings.hasOwnProperty('billingPrinter')) {
      window.localStorage.setItem('billingPrinter', newSettings.billingPrinter || '');
    }
    if (newSettings.hasOwnProperty('tagPrinter')) {
      window.localStorage.setItem('tagPrinter', newSettings.tagPrinter || '');
    }
    if (newSettings.hasOwnProperty('silentPrinting')) {
      window.localStorage.setItem('silentPrinting', newSettings.silentPrinting !== false ? 'true' : 'false');
    }


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
          cardCommission: updated.cardCommission,
          cardDefaultAccountId: updated.cardDefaultAccountId,
          upiDefaultAccountId: updated.upiDefaultAccountId,
          overdueDays: updated.overdueDays,
          defaultCreditLimit: updated.defaultCreditLimit,
          lateDeliveryDays: updated.lateDeliveryDays,
          enableCreditLimitProtection: updated.enableCreditLimitProtection,
          enableManagerOverride: updated.enableManagerOverride,
          workflowStatuses: updated.workflowStatuses,
          presetDamageNotes: updated.presetDamageNotes,
          deliveryMethods: updated.deliveryMethods,
          invoiceShowLogo: updated.invoiceShowLogo,
          invoiceShowQrCode: updated.invoiceShowQrCode,
          invoiceShowTerms: updated.invoiceShowTerms,
          invoiceShowBankDetails: updated.invoiceShowBankDetails,
          invoiceShowBilingual: updated.invoiceShowBilingual,
          invoiceTermsText: updated.invoiceTermsText,
          billingPrinter: updated.billingPrinter,
          tagPrinter: updated.tagPrinter,
          silentPrinting: updated.silentPrinting,
          pdfDownloadPath: updated.pdfDownloadPath,
          enablePaymentLinks: updated.enablePaymentLinks,
          paymentBaseUrl: updated.paymentBaseUrl,
          allowManagerStripeConfig: updated.allowManagerStripeConfig,
          enableStripe: updated.enableStripe,
          stripeApiKey: updated.stripeApiKey,
          stripeMerchantId: updated.stripeMerchantId,
          stripeEnv: updated.stripeEnv,
          stripeCurrency: updated.stripeCurrency,
          stripeSuccessUrl: updated.stripeSuccessUrl,
          stripeFailureUrl: updated.stripeFailureUrl,
          stripeWebhookSecret: updated.stripeWebhookSecret,
          stripeExpiry: updated.stripeExpiry,
          allowManagerTapConfig: updated.allowManagerTapConfig,
          enableTap: updated.enableTap,
          tapApiKey: updated.tapApiKey,
          tapMerchantId: updated.tapMerchantId,
          tapEnv: updated.tapEnv,
          tapCurrency: updated.tapCurrency,
          tapSuccessUrl: updated.tapSuccessUrl,
          tapFailureUrl: updated.tapFailureUrl,
          tapWebhookSecret: updated.tapWebhookSecret,
          tapExpiry: updated.tapExpiry,
          allowManagerMyFatoorahConfig: updated.allowManagerMyFatoorahConfig,
          enableMyFatoorah: updated.enableMyFatoorah,
          myfatoorahApiKey: updated.myfatoorahApiKey,
          myfatoorahMerchantId: updated.myfatoorahMerchantId,
          myfatoorahEnv: updated.myfatoorahEnv,
          myfatoorahCurrency: updated.myfatoorahCurrency,
          myfatoorahSuccessUrl: updated.myfatoorahSuccessUrl,
          myfatoorahFailureUrl: updated.myfatoorahFailureUrl,
          myfatoorahWebhookSecret: updated.myfatoorahWebhookSecret,
          myfatoorahExpiry: updated.myfatoorahExpiry,
          allowManagerNomodConfig: updated.allowManagerNomodConfig,
          enableNomod: updated.enableNomod,
          nomodApiKey: updated.nomodApiKey,
          nomodMerchantId: updated.nomodMerchantId,
          nomodEnv: updated.nomodEnv,
          nomodCurrency: updated.nomodCurrency,
          nomodSuccessUrl: updated.nomodSuccessUrl,
          nomodFailureUrl: updated.nomodFailureUrl,
          nomodWebhookSecret: updated.nomodWebhookSecret,
          nomodExpiry: updated.nomodExpiry,
          waNewOrderTemplate: updated.waNewOrderTemplate,
          waOrderReadyTemplate: updated.waOrderReadyTemplate,
          waReminderTemplate: updated.waReminderTemplate,
          waStatementTemplate: updated.waStatementTemplate,
          waCheckoutReceiptTemplate: updated.waCheckoutReceiptTemplate,
          waStatusUpdateTemplate: updated.waStatusUpdateTemplate,
          waCustomerBalanceTemplate: updated.waCustomerBalanceTemplate,
          waGeneralTemplate: updated.waGeneralTemplate,
          waInvoiceShareTemplate: updated.waInvoiceShareTemplate,
          // ─── Web Dashboard ───────────────────────────────────────
          branchName:   updated.branchName,
          branchApiKey: updated.branchApiKey,
          branchId:     updated.branchId,
          // System Configuration Module toggles
          workflowEnabled: updated.workflowEnabled,
          zReportEnabled: updated.zReportEnabled,
          noModPayEnabled: updated.noModPayEnabled,
          paymentHistoryEnabled: updated.paymentHistoryEnabled,
          zReportClosingType: updated.zReportClosingType,
        });
        // Mirror dashboard settings to localStorage for syncService
        window.localStorage.setItem('laundry_settings', JSON.stringify({
          branchName:   updated.branchName   || '',
          branchApiKey: updated.branchApiKey || '',
          branchId:     updated.branchId     || 'BRANCH_01',
        }));

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

    let d;
    if (typeof dateVal === 'string') {
      if (dateVal.includes('T') || dateVal.endsWith('Z')) {
        // ISO 8601 string — parse with timezone awareness
        d = new Date(dateVal);
      } else {
        // Local "YYYY-MM-DD HH:MM[:SS]" or "YYYY-MM-DD" string — parse as local date
        const parts = dateVal.split(' ')[0].split('-');
        if (parts.length === 3) {
          d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          d = new Date(dateVal);
        }
      }
    } else {
      d = new Date(dateVal);
    }

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
    <SettingsContext.Provider value={{ settings, updateSettings, fetchSettings, formatDate, isSettingsDirty, setIsSettingsDirty, originalSettings, setOriginalSettings }}>
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
