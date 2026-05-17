import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Key, Package, Calendar, Cpu, CheckCircle, 
  Printer, Zap, Coffee, Users, Cloud, BarChart3, Save, RefreshCw, 
  Info, AlertTriangle, Clock, Building2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID } from '../constants';
import { useNavigate } from 'react-router-dom';
import styles from './Activation.module.css';

const Activation = () => {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAuthorized = user.role === 'super_admin' || user.role === 'admin' || user.role === 'manager';

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/');
    }
  }, [isAuthorized, navigate]);

  if (!isAuthorized) return null;
  const [deviceId] = useState('LAUN-POS-ADMIN');
  const [activationKey, setActivationKey] = useState(settings.activationCode || '');
  const [licensePlan, setLicensePlan] = useState('Pro');
  const [expiryDate, setExpiryDate] = useState(settings.expiryDate || '2027-05-11');
  const [isActivated, setIsActivated] = useState(settings.isActivated);
  const [features, setFeatures] = useState(settings.licenseFeatures || {
    barcode: true,
    quickItem: true,
    kot: false,
    multiUser: true,
    reports: true,
    cloudSync: true
  });

  // Sync with global settings when they load
  useEffect(() => {
    setIsActivated(settings.isActivated);
    setActivationKey(settings.activationCode || '');
    setExpiryDate(settings.expiryDate || '');
    if (settings.licenseFeatures) {
      setFeatures(settings.licenseFeatures);
    }
  }, [settings]);

  const toggleFeature = (feature) => {
    setFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
  };

  const handleActivate = async () => {
    const payload = {
      isActivated: true,
      activationCode: activationKey,
      expiryDate: expiryDate,
      licenseFeatures: features
    };
    
    // In a real app, we would verify the key here
    await updateSettings(payload);
    
    // Also update local database columns directly for safety
    if (window.electronAPI?.dbQuery) {
      const now = new Date().toISOString();
      await window.electronAPI.dbQuery('UPDATE shops SET isActivated = 1, activationDate = ? WHERE shopId = ?', [now, DEFAULT_SHOP_ID]);
      // Refresh settings in context
      await updateSettings({ 
        isActivated: true, 
        activationDate: now,
        activationCode: activationKey,
        expiryDate: expiryDate
      });
    }
    
    alert('License activated successfully!');
    setIsActivated(true);
  };

  const handleReset = async () => {
    if (window.confirm('Reset activation and set a 1-month trial period?')) {
      const trialDate = new Date();
      trialDate.setDate(trialDate.getDate() + 30);
      const trialDateStr = trialDate.toISOString().split('T')[0];
      const now = new Date().toISOString();

      await updateSettings({ 
        isActivated: true, 
        expiryDate: trialDateStr,
        activationDate: now 
      });

      if (window.electronAPI?.dbQuery) {
        await window.electronAPI.dbQuery('UPDATE shops SET isActivated = 1, activationDate = ? WHERE shopId = ?', [now, DEFAULT_SHOP_ID]);
      }
      
      setIsActivated(true);
      setExpiryDate(trialDateStr);
      alert('Software reset to a 1-month trial period.');
    }
  };

  const handleSaveFeatures = async () => {
    await updateSettings({ licenseFeatures: features });
    alert('Features updated successfully!');
  };

  const getRemainingDays = () => {
    if (!expiryDate) return 0;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const remainingDays = getRemainingDays();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Software License Activation</h1>
          <p className={styles.subtitle}>Manage your system license and premium features</p>
        </div>
        <div className={styles.statusBadge}>
          {isActivated ? (
            remainingDays <= 31 ? (
              <div className={`${styles.activeTag} ${styles.trialTag}`}>
                <Clock size={16} />
                <span>Trial Period Active</span>
              </div>
            ) : (
              <div className={styles.activeTag}>
                <CheckCircle size={16} />
                <span>Activated & Secure</span>
              </div>
            )
          ) : (
            <div className={styles.inactiveTag}>
              <AlertTriangle size={16} />
              <span>Not Activated</span>
            </div>
          )}
        </div>
      </header>

      <div className={styles.grid}>
        {/* Card 1: Activation Form */}
        <motion.div 
          className={styles.card}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.cardHeader}>
            <ShieldCheck size={20} className={styles.iconBlue} />
            <h3>System Activation</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.formGroup}>
              <label>Device ID</label>
              <div className={styles.inputWrapper}>
                <Cpu size={18} />
                <input type="text" value={deviceId} readOnly />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Activation Key</label>
              <div className={styles.inputWrapper}>
                <Key size={18} />
                <input 
                  type="text" 
                  placeholder="XXXX-XXXX-XXXX-XXXX" 
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Registered To</label>
              <div className={styles.inputWrapper}>
                <Building2 size={18} />
                <input 
                  type="text" 
                  placeholder="e.g. Laundry Management System" 
                  value={settings.companyName}
                  onChange={(e) => updateSettings({ companyName: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <label>Expiry Date</label>
                <div className={styles.inputWrapper}>
                  <Calendar size={18} />
                  <input 
                    type="date" 
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <button className={styles.activateBtn} onClick={handleActivate}>
              Activate License
            </button>
          </div>
        </motion.div>



        {/* Card 3: License Status */}
        <motion.div 
          className={styles.card}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className={styles.cardHeader}>
            <CheckCircle size={20} className={styles.iconGreen} />
            <h3>License Status</h3>
          </div>
          <div className={styles.statusContent}>
            <div className={styles.statusRow}>
              <span>Status</span>
              <p className={!isActivated ? styles.statusExpired : (remainingDays <= 31 ? styles.statusTrial : styles.statusActive)}>
                {!isActivated ? 'Inactive' : (remainingDays <= 31 ? 'Trial Period' : 'Activated')}
              </p>
            </div>
            <div className={styles.statusRow}>
              <span>Registered To</span>
              <p>{settings.companyName || 'ABC Laundry'}</p>
            </div>
            <div className={styles.statusRow}>
              <span>Expiry Date</span>
              <p>{expiryDate ? new Date(expiryDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className={styles.statusRow}>
              <span>Remaining Days</span>
              <p className={styles.daysHighlight}>{remainingDays} Days Left</p>
            </div>
            <div className={styles.statusRow}>
              <span>Last Activated</span>
              <p>{settings.activationDate ? new Date(settings.activationDate).toLocaleString() : 'Never'}</p>
            </div>

            <div className={styles.terminalInfo}>
              <Info size={16} />
              <p>Your license is valid for 1 machine. Contact support to add more terminals.</p>
            </div>
          </div>
        </motion.div>
      </div>

      <footer className={styles.footer}>
        <button className={styles.resetBtn} onClick={handleReset}>
          <RefreshCw size={18} />
          <span>Reset Activation</span>
        </button>
        <button className={styles.saveBtn} onClick={handleSaveFeatures}>
          <Save size={18} />
          <span>Save License</span>
        </button>
      </footer>
    </div>
  );
};

export default Activation;
