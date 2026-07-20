import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, Activity, 
  User, Key, ShieldCheck, Fingerprint, ShieldAlert, Cpu, X
} from 'lucide-react';
import { authApi } from '../services/api';
import { useSettings } from '../store/SettingsContext';
import defaultLogo from '../assets/logo.png';
import styles from './Login.module.css';

export default function Login({ onLogin }) {
  const { settings } = useSettings();
  const [method, setMethod] = useState('pin'); // 'pin' or 'password'
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  
  const [version, setVersion] = useState('1.0.1');
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [twoFactor, setTwoFactor] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Forgot PIN State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Select User, 2: Enter OTP, 3: Reset PIN
  const [userList, setUserList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [forgotEmailTarget, setForgotEmailTarget] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [timerCount, setTimerCount] = useState(0);

  const handleOpenForgotModal = async () => {
    setShowForgotModal(true);
    setForgotStep(1);
    setSelectedUser(null);
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setNewPin('');
    setNewPinConfirm('');
    try {
      const res = await authApi.getUsers();
      // Filter out admin users
      setUserList(res.data.filter(u => u.role !== 'admin' && u.role !== 'super_admin'));
    } catch (err) {
      console.error('Failed to load user list for Forgot PIN:', err);
    }
  };

  const handleSendOtp = async () => {
    if (!selectedUser) return;
    setIsSendingOtp(true);
    setOtpError('');

    // Generate 6-digit random OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Figure out target email
    let targetEmail = selectedUser.email;
    if (!targetEmail) {
      if (window.electronAPI?.getEmailSettings) {
        const emailSettings = await window.electronAPI.getEmailSettings();
        targetEmail = emailSettings?.ownerEmail;
      }
    }

    if (!targetEmail) {
      setOtpError('No recipient email configured for this user or shop settings.');
      setIsSendingOtp(false);
      return;
    }

    try {
      if (window.electronAPI?.sendOtpEmail) {
        const result = await window.electronAPI.sendOtpEmail({
          recipient: targetEmail,
          otp,
          username: selectedUser.name
        });

        if (result.success) {
          setGeneratedOtp(otp);
          setOtpExpiry(expiry);
          setForgotEmailTarget(targetEmail);
          setForgotStep(2);
          setTimerCount(300); // 5 minutes
        } else {
          setOtpError(result.error || 'Failed to send OTP email.');
        }
      } else {
        setOtpError('Email dispatch API not available.');
      }
    } catch (err) {
      setOtpError('Failed to send verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  useEffect(() => {
    if (timerCount > 0 && showForgotModal && forgotStep === 2) {
      const interval = setInterval(() => {
        setTimerCount(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timerCount, showForgotModal, forgotStep]);

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.substring(value.length - 1);
    setOtpDigits(newDigits);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerifyOtp = () => {
    const enteredOtp = otpDigits.join('');
    if (enteredOtp.length < 6) {
      setOtpError('Please enter the 6-digit code.');
      return;
    }
    if (Date.now() > otpExpiry) {
      setOtpError('OTP has expired. Please request a new one.');
      return;
    }
    if (enteredOtp !== generatedOtp) {
      setOtpError('Invalid OTP code.');
      return;
    }
    setOtpError('');
    setForgotStep(3);
  };

  const handleResetPin = async () => {
    if (!newPin || newPin.length < 4) {
      setOtpError('PIN must be at least 4 digits.');
      return;
    }
    if (newPin !== newPinConfirm) {
      setOtpError('PIN entries do not match.');
      return;
    }

    setIsUpdatingPin(true);
    setOtpError('');

    try {
      const res = await authApi.updateUser(selectedUser._id, {
        ...selectedUser,
        pin: newPin
      });

      if (res.data) {
        alert('PIN reset successful! You can now log in.');
        setShowForgotModal(false);
      } else {
        setOtpError('Failed to update PIN.');
      }
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to reset PIN.');
    } finally {
      setIsUpdatingPin(false);
    }
  };

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

  // Fetch dynamic version on mount
  useEffect(() => {
    const fetchVersion = async () => {
      if (window.electronAPI?.getAppVersion) {
        const ver = await window.electronAPI.getAppVersion();
        setVersion(ver);
      }
    };
    fetchVersion();
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
        twoFactor
      });
      
      if (response.data.token) {
        const userProfile = { ...response.data.user };
        if (userProfile.role === 'admin') userProfile.role = 'super_admin';
        if (userProfile.role === 'staff') userProfile.role = 'cashier';

        sessionStorage.setItem('token', response.data.token);
        sessionStorage.setItem('user', JSON.stringify(userProfile));
        sessionStorage.setItem('isAuthenticated', 'true');
        onLogin(true);
        const destination = userProfile.role === 'super_admin' ? '/activation' : '/pos';
        navigate(destination, { replace: true });
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
                <img src={defaultLogo} alt="Logo" />
              )}
            </div>
          </motion.div>
          
          <motion.div 
            className={styles.brandText}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1>{settings.companyName || 'Laundry Box'}</h1>
            <p>Next-Generation POS Ecosystem</p>
          </motion.div>

          <div className={styles.visualFooter}>
            <div className={styles.statusIndicator}>
              <div className={styles.pulse}></div>
              <span>System Core v{version} - Secure</span>
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
                  type={showSecret ? 'text' : 'password'} 
                  inputMode={method === 'pin' ? 'numeric' : undefined}
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

            {method === 'pin' && (
              <div className={styles.forgotPinContainer}>
                <button type="button" className={styles.forgotPinLink} onClick={handleOpenForgotModal}>
                  Forgot PIN?
                </button>
              </div>
            )}

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
            <p>© 2026 Laundry Box. All rights reserved.</p>
          </footer>
        </motion.div>
      </div>
      {/* Forgot PIN Modal */}
      {showForgotModal && (
        <div className={styles.modalOverlay} onClick={() => setShowForgotModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3><Lock size={20} /> Forgot Access PIN</h3>
              <button className={styles.closeBtn} onClick={() => setShowForgotModal(false)} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {forgotStep === 1 && (
                <>
                  <p>Select your user profile to request a PIN reset verification code:</p>
                  <div className={styles.userList}>
                    {userList.map((usr) => (
                      <div
                        key={usr._id}
                        className={`${styles.userItem} ${selectedUser?._id === usr._id ? styles.userItemActive : ''}`}
                        onClick={() => setSelectedUser(usr)}
                      >
                        <div>
                          <div className={styles.userName}>{usr.name}</div>
                          <div className={styles.userRole}>{usr.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {otpError && <p style={{ color: '#EF4444', fontSize: '0.85rem', margin: 0 }}>{otpError}</p>}
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={handleSendOtp}
                    disabled={!selectedUser || isSendingOtp}
                  >
                    {isSendingOtp ? 'Sending OTP...' : 'Send Verification OTP'}
                  </button>
                </>
              )}

              {forgotStep === 2 && (
                <>
                  <p>
                    Enter the 6-digit verification code sent to the configured email:
                  </p>
                  <div className={styles.otpPreviewBox}>
                    <Mail size={18} />
                    <span>
                      Sent to: {forgotEmailTarget.replace(/^(..)(.*)(@.*)$/, (_, p1, p2, p3) => p1 + '*'.repeat(p2.length) + p3)}
                    </span>
                  </div>
                  <div className={styles.otpInputWrapper}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`otp-input-${idx}`}
                        type="text"
                        maxLength="1"
                        className={styles.otpDigitInput}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        autoComplete="off"
                        inputMode="numeric"
                      />
                    ))}
                  </div>
                  {timerCount > 0 ? (
                    <div className={styles.timerText}>
                      Code expires in: <span className={styles.timerActive}>{Math.floor(timerCount / 60)}:{(timerCount % 60).toString().padStart(2, '0')}</span>
                    </div>
                  ) : (
                    <div className={styles.timerText} style={{ color: '#EF4444' }}>
                      Code expired. Please request a new one.
                    </div>
                  )}
                  {otpError && <p style={{ color: '#EF4444', fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>{otpError}</p>}
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.secondaryBtn}`}
                      onClick={() => setForgotStep(1)}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={handleVerifyOtp}
                      disabled={timerCount <= 0}
                    >
                      Verify Code
                    </button>
                  </div>
                </>
              )}

              {forgotStep === 3 && (
                <>
                  <p>Reset PIN for <strong>{selectedUser?.name}</strong>. Enter your new 4-digit access PIN:</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="Enter new 4-digit PIN"
                      maxLength="4"
                      className={styles.otpDigitInput}
                      style={{ width: '100%', height: '50px', fontSize: '1.25rem', letterSpacing: '4px' }}
                      value={newPin}
                      onChange={(e) => { if (!isNaN(e.target.value)) setNewPin(e.target.value); }}
                      autoComplete="off"
                    />
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="Confirm new 4-digit PIN"
                      maxLength="4"
                      className={styles.otpDigitInput}
                      style={{ width: '100%', height: '50px', fontSize: '1.25rem', letterSpacing: '4px' }}
                      value={newPinConfirm}
                      onChange={(e) => { if (!isNaN(e.target.value)) setNewPinConfirm(e.target.value); }}
                      autoComplete="off"
                    />
                  </div>

                  {otpError && <p style={{ color: '#EF4444', fontSize: '0.85rem', margin: 0 }}>{otpError}</p>}
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={handleResetPin}
                    disabled={isUpdatingPin || newPin.length < 4 || newPin !== newPinConfirm}
                  >
                    {isUpdatingPin ? 'Updating PIN...' : 'Save New PIN'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
