import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, Activity, 
  User, Key, ShieldCheck
} from 'lucide-react';
import { authApi } from '../api';
import { useSettings } from '../context/SettingsContext';
import styles from './Login.module.css';

export default function Login({ onLogin }) {
  const { settings } = useSettings();
  const [method, setMethod] = useState('password'); // 'password' or 'pin'
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await authApi.login({ 
        identifier, 
        secret, 
        method 
      });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('isAuthenticated', 'true');
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

  return (
    <div className={styles.loginPage}>
      {/* Left: Visual Branding Section */}
      <div className={styles.visualSection}>
        <motion.div 
          className={styles.logoWrapper}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className={styles.logoIcon}>
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Activity size={48} />
            )}
          </div>
          <div className={styles.logoText}>
            <h1>{settings.companyName}</h1>
            <p>Laundry Management</p>
          </div>
        </motion.div>
        
        <div className={styles.floatingElements}>
          <motion.div 
            className={styles.float1}
            animate={{ y: [0, -30, 0], rotate: [0, 90, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className={styles.float2}
            animate={{ y: [0, 40, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>

      {/* Right: Login Form Section */}
      <div className={styles.formSection}>
        <motion.div 
          className={styles.loginCard}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className={styles.cardHeader}>
            <h2>Welcome Back</h2>
            <p>Access your laundry dashboard</p>
          </div>

          <div className={styles.methodToggle}>
            <button 
              className={method === 'password' ? styles.activeMethod : ''} 
              onClick={() => { setMethod('password'); setIdentifier(''); setSecret(''); }}
            >
              Password
            </button>
            <button 
              className={method === 'pin' ? styles.activeMethod : ''} 
              onClick={() => { setMethod('pin'); setIdentifier(''); setSecret(''); }}
            >
              PIN Access
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label>{method === 'password' ? 'Email or Username' : 'User ID or Name'}</label>
              <div className={styles.inputWrapper}>
                {method === 'password' ? <Mail size={18} /> : <User size={18} />}
                <input 
                  type="text" 
                  placeholder={method === 'password' ? "name@company.com" : "Staff ID / Name"} 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>{method === 'password' ? 'Password' : 'Access PIN'}</label>
              <div className={styles.inputWrapper}>
                {method === 'password' ? <Lock size={18} /> : <Key size={18} />}
                <input 
                  type={showSecret ? 'text' : (method === 'pin' ? 'tel' : 'password')} 
                  placeholder={method === 'password' ? "••••••••" : "4-6 Digit PIN"} 
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  required 
                />
                <div 
                  className={styles.eyeIcon} 
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
              </div>
            </div>

            <div className={styles.formExtra}>
              <label className={styles.rememberMe}>
                <input type="checkbox" />
                <span>Stay logged in</span>
              </label>
              <a href="#" className={styles.forgotPassword}>Forgot?</a>
            </div>

            <button type="submit" className={styles.signInBtn} disabled={isLoading}>
              {isLoading ? (
                <div className={styles.spinner}></div>
              ) : (
                <>Sign In <ArrowRight size={20} /></>
              )}
            </button>
          </form>

          <div className={styles.footer}>
            Need a new account? <a onClick={() => navigate('/signup')} className={styles.signUpLink}>Sign up</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
