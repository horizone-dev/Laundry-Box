import React, { useState, useEffect } from 'react';
import {
  Upload, CheckCircle, Image as ImageIcon, X, Sliders, Scissors,
  Mail, Phone, Globe, Building2, MapPin, CreditCard, Hash, FileText,
  Percent, Settings2, Info, Plus
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { useSettings } from '../context/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import InvoiceTemplate from '../components/InvoiceTemplate';
import styles from './Settings.module.css';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Company Info');
  const { settings, updateSettings } = useSettings();

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
        {['Company Info', 'Tax Settings', 'Bill Templates', 'User Permissions', 'Inventory Rules', 'Payment Gateways'].map(tab => (
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

                <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
                  <label>Legal Business Name</label>
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
                <div className={styles.formGroup}>
                  <label>Street Address / Building</label>
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
                      value={settings.currencySymbol || 'AED'}
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

          {activeTab === 'User Permissions' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Staff Roles</h2>
              {/* Permissions table content... */}
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


