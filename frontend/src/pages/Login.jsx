import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, Activity, 
  User, Key, ShieldCheck, Fingerprint, ShieldAlert, Cpu
} from 'lucide-react';
import { authApi } from '../services/api';
import { useSettings } from '../store/SettingsContext';
import styles from './Login.module.css';

export default function Login({ onLogin }) {
  const { settings } = useSettings();
  const [method, setMethod] = useState('pin'); // 'pin' or 'password'
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [twoFactor, setTwoFactor] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Hidden Shortcut Handler: CTRL + SHIFT + S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        triggerAdminMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const triggerAdminMode = () => {
    setIsAdminMode(true);
    setMethod('super_admin');
    // Subtle haptic or audio feedback could go here
  };

  const handleLogoClick = () => {
    const newCount = logoClicks + 1;
    setLogoClicks(newCount);
    if (newCount >= 5) {
      triggerAdminMode();
      setLogoClicks(0);
    }
    // Reset click counter after 2 seconds of inactivity
    setTimeout(() => setLogoClicks(0), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await authApi.login({ 
        identifier, 
        secret, 
        method,
        twoFactor // Optional 2FA
      });
      
      if (response.data.token) {
        sessionStorage.setItem('token', response.data.token);
        sessionStorage.setItem('user', JSON.stringify(response.data.user));
        sessionStorage.setItem('isAuthenticated', 'true');
        onLogin(true);
        navigate('/');
      }
    } catch (err) {
      console.error("Login failed:", err);
      alert(err.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const isAdminActive = method === 'super_admin';

  return (
    <div className={`${styles.loginPage} ${isAdminActive ? styles.adminBackground : ''}`}>
      {/* Left: Premium Branding Section */}
      <div className={styles.visualSection}>
        <div className={styles.brandingContent}>
          <motion.div 
            className={styles.logoWrapper}
            onClick={handleLogoClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className={styles.logoIcon}>
              {settings.logo ? (
                <img src={settings.logo} alt="Logo" />
              ) : (
                <Cpu size={42} color="white" />
              )}
            </div>
          </motion.div>
          
          <motion.div 
            className={styles.brandText}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1>{settings.companyName || 'Laundry Management System'}</h1>
            <p>Next-Generation POS Ecosystem</p>
          </motion.div>

          <div className={styles.visualFooter}>
            <div className={styles.statusIndicator}>
              <div className={styles.pulse}></div>
              <span>System Core v4.2.0 - Secure</span>
            </div>
          </div>
        </div>
        
        {/* Animated Background Elements */}
        <div className={styles.glowOrbs}>
          <div className={styles.orb1}></div>
          <div className={styles.orb2}></div>
        </div>
      </div>

      {/* Right: Login Form Section */}
      <div className={`${styles.formSection} ${isAdminActive ? styles.adminTheme : ''}`}>
        <motion.div 
          className={styles.loginCard}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.cardHeader}>
            <AnimatePresence mode="wait">
              {isAdminActive ? (
                <motion.div 
                  key="admin-header"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <ShieldAlert className={styles.adminIcon} size={32} />
                  <h2>Restricted Access</h2>
                  <p>Super Admin Authentication Required</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="user-header"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <h2>Welcome Back</h2>
                  <p>Secure login to your laundry portal</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={styles.methodToggle}>
            <button 
              className={method === 'pin' ? styles.activeMethod : ''} 
              onClick={() => { setMethod('pin'); setIdentifier(''); setSecret(''); }}
            >
              <Fingerprint size={16} />
              PIN
            </button>
            <button 
              className={method === 'password' ? styles.activeMethod : ''} 
              onClick={() => { setMethod('password'); setIdentifier(''); setSecret(''); }}
            >
              <Key size={16} />
              Password
            </button>
            
            <AnimatePresence>
              {isAdminMode && (
                <motion.button 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  className={`${styles.adminToggle} ${method === 'super_admin' ? styles.activeAdmin : ''}`}
                  onClick={() => setMethod('super_admin')}
                >
                  <ShieldCheck size={16} />
                  Admin
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label>
                {isAdminActive ? 'Administrator ID' : 
                 method === 'password' ? 'Email or Phone' : 'Staff ID (Optional)'}
              </label>
              <div className={styles.inputWrapper}>
                {isAdminActive ? <ShieldCheck size={18} /> : <User size={18} />}
                <input 
                  type="text" 
                  placeholder={isAdminActive ? "ADMIN-001" : "Credentials"} 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required={method !== 'pin'} 
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>
                {isAdminActive ? 'Master Password' : 
                 method === 'password' ? 'Account Password' : 'Access PIN'}
              </label>
              <div className={styles.inputWrapper}>
                <Lock size={18} />
                <input 
                  type={showSecret ? 'text' : (method === 'pin' ? 'tel' : 'password')} 
                  placeholder={method === 'pin' ? "••••" : "••••••••"} 
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  required 
                />
                <div className={styles.eyeIcon} onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
              </div>
            </div>

            {isAdminActive && (
              <motion.div 
                className={styles.inputGroup}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <label>2FA Authentication (Optional)</label>
                <div className={styles.inputWrapper}>
                  <ShieldCheck size={18} />
                  <input 
                    type="text" 
                    placeholder="6-Digit Token" 
                    value={twoFactor}
                    onChange={(e) => setTwoFactor(e.target.value)}
                  />
                </div>
              </motion.div>
            )}

            <button type="submit" className={styles.signInBtn} disabled={isLoading}>
              {isLoading ? (
                <div className={styles.spinner}></div>
              ) : (
                <>{isAdminActive ? 'Authorize Access' : 'Sign In'} <ArrowRight size={20} /></>
              )}
            </button>
          </form>

          <footer className={styles.formFooter}>
            <p>© 2026 Laundry Management System. All rights reserved.</p>
          </footer>
        </motion.div>
      </div>
    </div>
  );
}
