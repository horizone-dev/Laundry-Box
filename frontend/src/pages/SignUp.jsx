import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Mail, Lock, User, ArrowRight, Activity, 
  Key, ShieldCheck, ShoppingBag
} from 'lucide-react';
import { authApi } from '../services/api';
import { useSettings } from '../store/SettingsContext';
import defaultLogo from '../assets/logo.png';
import styles from './Login.module.css'; // Reusing some styles from Login

export default function SignUp() {
  const { settings } = useSettings();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    userId: '',
    pin: '',
    shopId: 'SHOP_' + Math.random().toString(36).substr(2, 5).toUpperCase(),
    role: 'super_admin'
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await authApi.register(formData);
      if (response.data.token) {
        alert("Registration successful! Please login.");
        navigate('/login');
      }
    } catch (err) {
      console.error("Signup failed:", err);
      alert(err.response?.data?.error || "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.visualSection} style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}>
        <motion.div 
          className={styles.logoWrapper}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.logoIcon}>
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" />
            ) : (
              <img src={defaultLogo} alt="Logo" />
            )}
          </div>
          <div className={styles.logoText}>
            <h1>Join {settings.companyName}</h1>
            <p>Start managing your laundry business with precision.</p>
          </div>
        </motion.div>
      </div>

      <div className={styles.formSection}>
        <motion.div 
          className={styles.loginCard}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className={styles.cardHeader}>
            <h2>Create Account</h2>
            <p>Set up your shop and admin profile</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label>Full Name</label>
              <div className={styles.inputWrapper}>
                <User size={18} />
                <input 
                  type="text" 
                  placeholder="John Doe" 
                  required 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <div className={styles.inputWrapper}>
                <Mail size={18} />
                <input 
                  type="email" 
                  placeholder="john@example.com" 
                  required 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.inputGroup}>
                <label>Staff ID / User ID</label>
                <div className={styles.inputWrapper}>
                  <ShoppingBag size={18} />
                  <input 
                    type="text" 
                    placeholder="E.g. JD001" 
                    required 
                    value={formData.userId}
                    onChange={(e) => setFormData({...formData, userId: e.target.value})}
                  />
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label>4-Digit PIN</label>
                <div className={styles.inputWrapper}>
                  <Key size={18} />
                  <input 
                    type="password" 
                    maxLength="4" 
                    placeholder="0000" 
                    required 
                    value={formData.pin}
                    onChange={(e) => setFormData({...formData, pin: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Password</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <button type="submit" className={styles.signInBtn} disabled={isLoading} style={{ background: '#8b5cf6' }}>
              {isLoading ? (
                <div className={styles.spinner}></div>
              ) : (
                <>Register Account <ArrowRight size={20} /></>
              )}
            </button>
          </form>

          <div className={styles.footer}>
            Already have an account? <a onClick={() => navigate('/login')} className={styles.signUpLink} style={{ color: '#8b5cf6' }}>Login</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
