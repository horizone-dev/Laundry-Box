import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, Activity, 
  Globe, Mail as MailIcon 
} from 'lucide-react';
import styles from './Login.module.css';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate login
    setTimeout(() => {
      localStorage.setItem('isAuthenticated', 'true');
      onLogin(true);
      navigate('/');
    }, 1500);
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
            <Activity size={48} />
          </div>
          <div className={styles.logoText}>
            <h1>Antigravity</h1>
            <p>Management System</p>
          </div>
        </motion.div>
        
        {/* Abstract Floating Elements (Decorations) */}
        <div className={styles.floatingElements}>
          <motion.div 
            style={{ 
              position: 'absolute', top: '15%', left: '15%', 
              width: '120px', height: '120px', 
              background: 'rgba(37, 99, 235, 0.1)', 
              borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
              filter: 'blur(20px)'
            }}
            animate={{ 
              y: [0, -30, 0],
              rotate: [0, 90, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            style={{ 
              position: 'absolute', bottom: '20%', right: '10%', 
              width: '180px', height: '180px', 
              background: 'rgba(139, 92, 246, 0.1)', 
              borderRadius: '50%',
              filter: 'blur(30px)'
            }}
            animate={{ 
              y: [0, 40, 0],
              scale: [1, 1.2, 1]
            }}
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
            <h2>Login to Account</h2>
            <p>Enter your credentials to access the system</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <div className={styles.inputWrapper}>
                <Mail className={styles.inputIcon} size={18} />
                <input 
                  type="email" 
                  placeholder="name@company.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Password</label>
              <div className={styles.inputWrapper}>
                <Lock className={styles.inputIcon} size={18} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
                <div 
                  className={styles.eyeIcon} 
                  style={{ position: 'absolute', right: '1rem', cursor: 'pointer', color: '#64748B' }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
              </div>
            </div>

            <div className={styles.formExtra}>
              <label className={styles.rememberMe}>
                <input type="checkbox" />
                <span>Remember Me</span>
              </label>
              <a href="#" className={styles.forgotPassword}>Forgot Password?</a>
            </div>

            <button type="submit" className={styles.signInBtn} disabled={isLoading}>
              {isLoading ? (
                <div className="spin" style={{ width: '20px', height: '20px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
              ) : (
                <>Sign In <ArrowRight size={20} /></>
              )}
            </button>
          </form>

          <div className={styles.divider}>Or continue with</div>

          <div className={styles.socialBtns}>
            <button className={styles.socialBtn}>
              <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: '18px' }} />
              Google Account
            </button>
            <button className={styles.socialBtn}>
              <img src="https://www.microsoft.com/favicon.ico" alt="Microsoft" style={{ width: '18px' }} />
              Microsoft 365
            </button>
          </div>

          <div className={styles.footer}>
            Don't have an account? <a href="#" className={styles.signUpLink}>Sign up</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
