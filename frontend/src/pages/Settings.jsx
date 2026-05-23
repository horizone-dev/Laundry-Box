import React, { useState, useEffect } from 'react';
import {
  Upload, CheckCircle, Image as ImageIcon, X, Sliders, Scissors,
  Mail, Phone, Globe, Building2, MapPin, CreditCard, Hash, FileText,
  Percent, Settings2, Info, Plus, Trash2, Star, DollarSign, Clock, Database, Save, AlertCircle, RefreshCw
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import InvoiceTemplate from '../components/InvoiceTemplate';
import { useNavigate } from 'react-router-dom';
import styles from './Settings.module.css';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('General');
  const { settings, updateSettings } = useSettings();
  
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'super_admin' || user.role === 'admin';
  const isManager = user.role === 'manager';
  const isAuthorized = isSuperAdmin || isManager;

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/');
    }
  }, [isAuthorized, navigate]);

  if (!isAuthorized) return null;

  const tabs = ['General', 'Company Info', 'Tax Settings', 'Bill Templates', 'Payment Gateways', 'Maintenance'];

  // Cropper States
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);


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

      <div className={styles.tabs}>
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

      <div className={styles.settingsGrid}>
        <div className={styles.mainContent}>


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
                      value={settings.defaultPaymentMethod || 'CASH'}
                      onChange={(e) => updateSettings({ defaultPaymentMethod: e.target.value })}
                    >
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="CREDIT">Store Credit</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Operational Rules</h2>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Default Overdue Period (Days)</label>
                    <div className={styles.inputWrapper}>
                      <Clock size={18} color="#94A3B8" />
                      <input 
                        type="number" 
                        className={styles.inputField}
                        value={settings.overdueDays || 7}
                        onChange={(e) => updateSettings({ overdueDays: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Default Credit Limit</label>
                    <div className={styles.inputWrapper}>
                      <CurrencySymbol size={18} />
                      <input 
                        type="number" 
                        className={styles.inputField}
                        value={settings.defaultCreditLimit || 500}
                        onChange={(e) => updateSettings({ defaultCreditLimit: parseFloat(e.target.value) })}
                      />
                    </div>
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
                      <ImageIcon size={24} color="#94A3B8" />
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
                        value={settings.taxRate}
                        onChange={(e) => updateSettings({ taxRate: parseFloat(e.target.value) || 0 })}
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
                    <span className={styles.statLabel}>{settings.taxName} ({settings.taxRate}%)</span>
                    <span className={styles.statValue}>
                      {settings.isTaxEnabled ? (
                        settings.taxMethod === 'inclusive' 
                          ? <><CurrencySymbol size={14} /> {(100 - (100 / (1 + (settings.taxRate / 100)))).toFixed(2)}</>
                          : <><CurrencySymbol size={14} /> {(100 * settings.taxRate / 100).toFixed(2)}</>
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
                          ? <><CurrencySymbol size={14} /> {(100 / (1 + (settings.taxRate / 100))).toFixed(2)}</>
                          : <><CurrencySymbol size={14} /> {(100 + (100 * settings.taxRate / 100)).toFixed(2)}</>
                      ) : <><CurrencySymbol size={14} /> 100.00</>}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Bill Templates' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Invoice Style Preview</h2>
              <div className={styles.templatesGrid} style={{ marginBottom: '2rem' }}>
                <TemplateCard id="standard" name="Standard" description="Office layout" active={settings.invoiceTemplate === 'standard'} onClick={() => updateSettings({ invoiceTemplate: 'standard' })} />
                <TemplateCard id="modern" name="Modern" description="Clean layout" active={settings.invoiceTemplate === 'modern'} onClick={() => updateSettings({ invoiceTemplate: 'modern' })} />
                <TemplateCard id="compact" name="Compact" description="Thermal layout" active={settings.invoiceTemplate === 'compact'} onClick={() => updateSettings({ invoiceTemplate: 'compact' })} />
              </div>

              <div className={styles.previewSection}>
                <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#64748B' }}>LIVE PREVIEW</h3>
                <div className={styles.previewContainer} style={{ background: '#f1f5f9', padding: '2rem', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', width: '100%' }}>
                    <InvoiceTemplate order={previewOrder} settings={settings} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Payment Gateways' && (
            <div className={styles.profileContainer}>
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
                          onClick={() => {
                            const newAccounts = settings.bankAccounts.filter((_, i) => i !== index);
                            const newDefault = settings.defaultBankId === account.id ? '' : settings.defaultBankId;
                            updateSettings({ bankAccounts: newAccounts, defaultBankId: newDefault });
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

                  <div className={styles.backupBox} style={{ background: '#F8FAFC', padding: '2rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '2rem', marginTop: '1.5rem' }}>
                    <div className={styles.backupIcon} style={{ background: '#ECFDF5', padding: '1rem', borderRadius: '12px' }}>
                      <RefreshCw size={32} color="#10B981" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: '0.5rem', color: '#1E293B' }}>Automatic USB Backup</h3>
                      <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Set a default folder (e.g., on your USB drive). The system will automatically save a backup there every time you sync or close the app.
                      </p>
                      
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
        </div>
      </div>
      {/* Cropper Modal */}
      {isCropping && (
        <div className={styles.cropperModalOverlay}>
          <div className={styles.cropperModal}>
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


