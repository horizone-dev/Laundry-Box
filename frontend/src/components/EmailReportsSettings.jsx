import React, { useState, useEffect } from 'react';
import { Mail, Save, AlertCircle, Trash2 } from 'lucide-react';
import CustomSelect from './CustomSelect';
import styles from '../pages/Settings.module.css';

export default function EmailReportsSettings({ registerSave, setIsSettingsDirty }) {
  const initialEmailSettingsRef = React.useRef(null);
  const [emailSettings, setEmailSettings] = useState({
    enabled: false,
    ownerEmail: '',
    sendTime: '23:50',
    provider: 'Gmail',
    smtpHost: '',
    smtpPort: 465,
    username: '',
    password: '',
    includePdf: true,
    includeSalesCsv: false,
    includeExpensesCsv: false,
    includeCollectionsCsv: false,
    includeOutstandingCsv: false
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [ownerEmails, setOwnerEmails] = useState(['']);

  const addEmailField = () => {
    setOwnerEmails([...ownerEmails, '']);
    if (setIsSettingsDirty) setIsSettingsDirty(true);
  };

  const removeEmailField = (index) => {
    const updated = ownerEmails.filter((_, idx) => idx !== index);
    setOwnerEmails(updated.length > 0 ? updated : ['']);
    if (setIsSettingsDirty) setIsSettingsDirty(true);
  };

  const handleEmailChange = (index, value) => {
    const updated = [...ownerEmails];
    updated[index] = value;
    setOwnerEmails(updated);
    if (setIsSettingsDirty) setIsSettingsDirty(true);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      if (window.electronAPI && window.electronAPI.getEmailSettings) {
        const settings = await window.electronAPI.getEmailSettings();
        if (settings) {
          const provider = settings.provider || 'Gmail';
          let defaultHost = settings.smtpHost;
          let defaultPort = settings.smtpPort;
          if (!defaultHost || defaultHost.trim() === '') {
            if (provider === 'Gmail') defaultHost = 'smtp.gmail.com';
            else if (provider === 'Outlook') defaultHost = 'smtp.office365.com';
            else if (provider === 'Zoho') defaultHost = 'smtp.zoho.com';
          }
          if (!defaultPort) {
            if (provider === 'Gmail' || provider === 'Zoho') defaultPort = 465;
            else if (provider === 'Outlook') defaultPort = 587;
          }

          const fetchedObj = {
            enabled: settings.enabled === 1,
            ownerEmail: settings.ownerEmail || '',
            sendTime: settings.sendTime || '23:50',
            provider,
            smtpHost: defaultHost || '',
            smtpPort: defaultPort || 465,
            username: settings.username || '',
            password: settings.password || '',
            includePdf: settings.includePdf !== 0 && settings.includePdf !== false,
            includeSalesCsv: settings.includeSalesCsv === 1 || settings.includeSalesCsv === true,
            includeExpensesCsv: settings.includeExpensesCsv === 1 || settings.includeExpensesCsv === true,
            includeCollectionsCsv: settings.includeCollectionsCsv === 1 || settings.includeCollectionsCsv === true,
            includeOutstandingCsv: settings.includeOutstandingCsv === 1 || settings.includeOutstandingCsv === true
          };
          const fetchedEmails = settings.ownerEmail
            ? settings.ownerEmail.split(/[;,]/).map(e => e.trim()).filter(Boolean)
            : [];
          setOwnerEmails(fetchedEmails.length > 0 ? fetchedEmails : ['']);
          setEmailSettings(fetchedObj);
          initialEmailSettingsRef.current = fetchedObj;
        }
      }
    } catch (err) {
      console.error('Failed to load email settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;
    
    setEmailSettings(prev => {
      const next = { ...prev, [name]: newValue };
      if (name === 'provider') {
        if (value === 'Gmail') {
          next.smtpHost = 'smtp.gmail.com';
          next.smtpPort = 465;
        } else if (value === 'Outlook') {
          next.smtpHost = 'smtp.office365.com';
          next.smtpPort = 587;
        } else if (value === 'Zoho') {
          next.smtpHost = 'smtp.zoho.com';
          next.smtpPort = 465;
        } else {
          next.smtpHost = '';
          next.smtpPort = 465;
        }
      }
      return next;
    });
  };

  const handleSave = async (silent = false) => {
    setSaving(true);
    setError('');
    
    const cleanedEmails = ownerEmails.map(e => e.trim()).filter(Boolean).join(', ');
    const settingsToSave = { ...emailSettings, ownerEmail: cleanedEmails };
    if (settingsToSave.provider === 'Gmail') {
      settingsToSave.smtpHost = 'smtp.gmail.com';
      settingsToSave.smtpPort = 465;
    } else if (settingsToSave.provider === 'Outlook') {
      settingsToSave.smtpHost = 'smtp.office365.com';
      settingsToSave.smtpPort = 587;
    } else if (settingsToSave.provider === 'Zoho') {
      settingsToSave.smtpHost = 'smtp.zoho.com';
      settingsToSave.smtpPort = 465;
    }

    try {
      if (window.electronAPI && window.electronAPI.saveEmailSettings) {
        const result = await window.electronAPI.saveEmailSettings(settingsToSave);
        if (result && result.success) {
          if (!silent) {
            alert('Email settings saved successfully');
          }
          initialEmailSettingsRef.current = settingsToSave;
          if (setIsSettingsDirty) {
            setIsSettingsDirty(false);
          }
          fetchSettings(); // reload settings
          return true;
        } else {
          setError(result?.error || 'Failed to save settings');
          return false;
        }
      } else {
        setError('electronAPI not available');
        return false;
      }
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (initialEmailSettingsRef.current && setIsSettingsDirty) {
      const cleanedEmails = ownerEmails.map(e => e.trim()).filter(Boolean).join(', ');
      const currentWithEmails = { ...emailSettings, ownerEmail: cleanedEmails };
      const isModified = JSON.stringify(currentWithEmails) !== JSON.stringify(initialEmailSettingsRef.current);
      setIsSettingsDirty(isModified);
    }
  }, [emailSettings, ownerEmails, setIsSettingsDirty]);

  useEffect(() => {
    return () => {
      if (setIsSettingsDirty) {
        setIsSettingsDirty(false);
      }
    };
  }, [setIsSettingsDirty]);

  useEffect(() => {
    if (registerSave) {
      registerSave(() => handleSave(true));
    }
    return () => {
      if (registerSave) registerSave(null);
    };
  }, [emailSettings, ownerEmails, registerSave]);

  const handleTestEmail = async () => {
    setTesting(true);
    setError('');
    try {
      if (window.electronAPI && window.electronAPI.testEmail) {
        const result = await window.electronAPI.testEmail();
        if (result && result.success) {
          alert('Test email sent successfully');
        } else {
          setError(result?.error || result?.message || 'Failed to send test email');
        }
      } else {
        setError('electronAPI not available');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className={styles.profileContainer}>
      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className={styles.cardTitle}>Daily Email Reports Configuration</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleTestEmail}
              disabled={testing}
              style={{
                padding: '8px 16px',
                background: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: testing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Mail size={16} />
              {testing ? 'Sending Test...' : 'Send Test Email'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#FEF2F2', color: '#EF4444', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
        )}

        <div className={styles.formGrid}>
          <div className={styles.formGroup} style={{ display: 'flex', alignItems: 'center', gap: '10px', gridColumn: '1 / -1' }}>
            <input 
              type="checkbox" 
              name="enabled"
              checked={emailSettings.enabled}
              onChange={handleChange}
              style={{ width: '18px', height: '18px' }}
              id="enableReports"
            />
            <label htmlFor="enableReports" style={{ fontWeight: 600, margin: 0, cursor: 'pointer' }}>Enable Automated Daily Email Reports</label>
          </div>
          
          <div className={styles.formGroup}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span>Owner Email Addresses</span>
              <button
                type="button"
                className={styles.addEmailBtn}
                onClick={addEmailField}
                disabled={!emailSettings.enabled}
                style={{ 
                  background: '#EFF6FF', 
                  border: 'none', 
                  color: '#2563EB', 
                  padding: '0.25rem 0.6rem', 
                  borderRadius: '6px', 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                + Add Email
              </button>
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ownerEmails.map((email, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="email"
                    required
                    className={styles.inputField}
                    placeholder="owner@example.com"
                    value={email}
                    onChange={(e) => handleEmailChange(index, e.target.value)}
                    disabled={!emailSettings.enabled}
                    style={{ flex: 1 }}
                  />
                  {ownerEmails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailField(index)}
                      disabled={!emailSettings.enabled}
                      style={{ 
                        background: '#FEE2E2', 
                        border: 'none', 
                        color: '#EF4444', 
                        padding: '0.5rem', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '38px',
                        width: '38px'
                      }}
                      title="Remove Email"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Closing Time (Auto-Mail)</label>
            <input
              type="time"
              className={styles.inputField}
              name="sendTime"
              value={emailSettings.sendTime}
              onChange={handleChange}
            />
          </div>
        </div>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #E2E8F0' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1E293B', marginBottom: '0.5rem' }}>Report Attachments Selection</h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Choose which reports/files will be generated and attached to the closing email.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                name="includePdf"
                checked={emailSettings.includePdf}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                id="includePdf"
              />
              <label htmlFor="includePdf" style={{ margin: 0, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>Daily Summary (PDF)</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                name="includeSalesCsv"
                checked={emailSettings.includeSalesCsv}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                id="includeSalesCsv"
              />
              <label htmlFor="includeSalesCsv" style={{ margin: 0, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>Detailed Sales list (PDF)</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                name="includeExpensesCsv"
                checked={emailSettings.includeExpensesCsv}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                id="includeExpensesCsv"
              />
              <label htmlFor="includeExpensesCsv" style={{ margin: 0, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>Detailed Expenses list (PDF)</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                name="includeCollectionsCsv"
                checked={emailSettings.includeCollectionsCsv}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                id="includeCollectionsCsv"
              />
              <label htmlFor="includeCollectionsCsv" style={{ margin: 0, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>Detailed Collections list (PDF)</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                name="includeOutstandingCsv"
                checked={emailSettings.includeOutstandingCsv}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                id="includeOutstandingCsv"
              />
              <label htmlFor="includeOutstandingCsv" style={{ margin: 0, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>Customer Outstanding list (PDF)</label>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #E2E8F0' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1E293B', marginBottom: '1.5rem' }}>SMTP Credentials</h3>
          
          {emailSettings.provider === 'Gmail' && (
            <div style={{ padding: '12px', background: '#FFFBEB', color: '#B45309', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              <strong>Note for Gmail:</strong> You must use an <strong>App Password</strong> generated from your Google Account Security settings. Your normal password will not work.
            </div>
          )}

          <div className={styles.formGrid}>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
              <label>Email Provider</label>
              <CustomSelect
                value={emailSettings.provider}
                onChange={(val) => handleChange({ target: { name: 'provider', value: val } })}
                options={[
                  { value: 'Gmail', label: 'Gmail' },
                  { value: 'Outlook', label: 'Outlook / Office365' },
                  { value: 'Zoho', label: 'Zoho Mail' },
                  { value: 'Custom SMTP', label: 'Custom SMTP' }
                ]}
                disabled={!emailSettings.enabled}
              />
            </div>

            <div className={styles.formGroup}>
              <label>SMTP Host</label>
              <input
                type="text"
                className={styles.inputField}
                name="smtpHost"
                value={emailSettings.smtpHost}
                onChange={handleChange}
                placeholder="smtp.gmail.com"
                disabled={emailSettings.provider !== 'Custom SMTP'}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>SMTP Port</label>
              <input
                type="number"
                className={styles.inputField}
                name="smtpPort"
                value={emailSettings.smtpPort}
                onChange={handleChange}
                placeholder="465"
                disabled={emailSettings.provider !== 'Custom SMTP'}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Email Username / Address</label>
              <input
                type="text"
                className={styles.inputField}
                name="username"
                value={emailSettings.username}
                onChange={handleChange}
                placeholder="shop@example.com"
              />
            </div>

            <div className={styles.formGroup}>
              <label>App Password / SMTP Password</label>
              <input
                type="password"
                className={styles.inputField}
                name="password"
                value={emailSettings.password}
                onChange={handleChange}
                placeholder="••••••••••••••••"
              />
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                Securely encrypted in database. Never saved in plain text.
              </span>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}

