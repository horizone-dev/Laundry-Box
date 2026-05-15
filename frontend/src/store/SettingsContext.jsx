import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    companyName: 'Laundry Management System',
    shopName: 'Laundry Management System',
    logo: null,
    email: '',
    phone: '',
    alternatePhone: '',
    website: '',
    address: '',
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
    lastBackupTime: ''
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
            logo: shopSettings?.logo || null,
            email: shopSettings?.email || '',
            phone: shopSettings?.phone || '',
            alternatePhone: shopSettings?.alternatePhone || '',
            website: shopSettings?.website || '',
            address: shopSettings?.address || '',
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
            lastBackupTime: shopSettings?.lastBackupTime || ''
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
          logo: updated.logo,
          email: updated.email,
          phone: updated.phone,
          alternatePhone: updated.alternatePhone,
          website: updated.website,
          address: updated.address,
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
          lastBackupTime: updated.lastBackupTime
        });

        await window.electronAPI.dbQuery(
          'UPDATE shops SET name = ?, settings = ?, updatedAt = ? WHERE shopId = ?',
          [updated.companyName, settingsJson, new Date().toISOString(), 'SHOP_01']
        );
      } catch (err) {
        console.error("Failed to save settings:", err);
      }
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, fetchSettings }}>
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
