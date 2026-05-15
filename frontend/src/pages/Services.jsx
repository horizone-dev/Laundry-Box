import React, { useState, useEffect } from 'react';
import { Plus, Scissors, Zap, Sparkles, Tag, X, Layout, Shirt, Bed, Wind, Droplet, Heart, Layers } from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Services.module.css';

export default function Services() {
  const { settings } = useSettings();
  const [services, setServices] = useState([]);
  const [types, setTypes] = useState([]);
  const [addons, setAddons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(null); // 'service', 'type', 'addon'
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        setLoading(true);
        const sRes = await window.electronAPI.dbQuery('SELECT * FROM services', []);
        const tRes = await window.electronAPI.dbQuery('SELECT * FROM service_types', []);
        const aRes = await window.electronAPI.dbQuery('SELECT * FROM addons', []);
        const cRes = await window.electronAPI.dbQuery('SELECT * FROM service_categories', []);
        
        if (sRes.success) setServices(sRes.data);
        if (tRes.success) setTypes(tRes.data);
        if (aRes.success) setAddons(aRes.data);
        if (cRes.success) setCategories(cRes.data);
      } catch (err) {
        console.error("Failed to fetch services:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  const handleOpenModal = (type) => {
    if (type === 'service') {
      setFormData({ name: '', price: '', category: categories[0]?.name || 'Laundry', icon: 'Shirt', taxRate: '' });
    } else if (type === 'category') {
      setFormData({ name: '', icon: 'Tag' });
    } else if (type === 'type') {
      setFormData({ name: '', price: '', icon: 'Zap' });
    } else {
      setFormData({ name: '', price: '', icon: 'Sparkles' });
    }
    setShowModal(type);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!window.electronAPI?.dbQuery) return;

    const id = Date.now().toString();
    const shopId = 'SHOP_01';
    const timestamp = new Date().toISOString();

    try {
      let query = '';
      let params = [];

      if (showModal === 'service') {
        query = 'INSERT INTO services (id, shopId, name, price, icon, category, taxRate, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        params = [id, shopId, formData.name, parseFloat(formData.price), formData.icon, formData.category, formData.taxRate ? parseFloat(formData.taxRate) : null, timestamp];
      } else if (showModal === 'category') {
        query = 'INSERT INTO service_categories (id, shopId, name, icon, updatedAt) VALUES (?, ?, ?, ?, ?)';
        params = [id, shopId, formData.name, formData.icon, timestamp];
      } else if (showModal === 'type') {
        query = 'INSERT INTO service_types (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)';
        params = [id, shopId, formData.name, parseFloat(formData.price), formData.icon, timestamp];
      } else if (showModal === 'addon') {
        query = 'INSERT INTO addons (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)';
        params = [id, shopId, formData.name, parseFloat(formData.price), formData.icon, timestamp];
      }

      const res = await window.electronAPI.dbQuery(query, params);
      if (res.success) {
        fetchData();
        setShowModal(null);
      } else {
        alert("Failed to save: " + res.error);
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const getIcon = (iconName) => {
    const icons = {
      'Shirt': '👕',
      'Bed': '🛌',
      'Wind': '💨',
      'Droplet': '💧',
      'Heart': '❤️',
      'Layers': '📦',
      'Zap': '⚡',
      'Sparkles': '✨',
      'Scissors': '✂️',
      'Tag': '🏷️'
    };
    return icons[iconName] || '🧺';
  };

  return (
    <div className={styles.servicesPage}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Service Management</h1>
          <p>Configure your laundry treatments, delivery types, and premium add-ons.</p>
        </div>
        <div className={styles.headerButtons}>
          <button className="btn btn-outline" onClick={() => handleOpenModal('category')} style={{ marginRight: '1rem' }}>
            <Tag size={18} /> Add Category
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal('service')}>
            <Plus size={18} /> Add Service
          </button>
        </div>
      </div>

      <div className={styles.sectionGrid}>
        {/* 1. Service List */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Tag size={20} color="#2563EB" />
              <h3>Base Services</h3>
            </div>
            <button className={styles.addSmall} onClick={() => handleOpenModal('service')}><Plus size={14} /></button>
          </div>
          <div className={styles.cardBody}>
            {loading ? <p className={styles.empty}>Loading...</p> : (
              <div className={styles.list}>
                {services.length > 0 ? services.map(s => (
                  <div key={s.id} className={styles.listItem}>
                    <div className={styles.itemInfo}>
                      <div className={styles.iconBox}>{getIcon(s.icon)}</div>
                      <div>
                        <div className={styles.itemName}>{s.name}</div>
                        <span className={styles.badge}>{s.category}</span>
                      </div>
                    </div>
                    <div className={styles.itemPrice}><CurrencySymbol size={14} /> {parseFloat(s.price).toFixed(2)}</div>
                  </div>
                )) : <p className={styles.empty}>No services found.</p>}
              </div>
            )}
          </div>
        </div>

        {/* 2. Service Type */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Zap size={20} color="#F59E0B" />
              <h3>Service Types</h3>
            </div>
            <button className={styles.addSmall} onClick={() => handleOpenModal('type')}><Plus size={14} /></button>
          </div>
          <div className={styles.cardBody}>
            {loading ? <p className={styles.empty}>Loading...</p> : (
              <div className={styles.list}>
                {types.length > 0 ? types.map((t, idx) => (
                  <div key={idx} className={styles.listItem}>
                    <div className={styles.itemInfo}>
                      <div className={styles.iconBox} style={{ background: '#FFFBEB' }}>{getIcon(t.icon)}</div>
                      <div className={styles.itemName}>{t.name}</div>
                    </div>
                    <div className={styles.itemPrice}><CurrencySymbol size={14} /> {parseFloat(t.price).toFixed(2)}</div>
                  </div>
                )) : <p className={styles.empty}>No types found.</p>}
              </div>
            )}
          </div>
        </div>

        {/* 3. Addons */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Sparkles size={20} color="#8B5CF6" />
              <h3>Add-ons</h3>
            </div>
            <button className={styles.addSmall} onClick={() => handleOpenModal('addon')}><Plus size={14} /></button>
          </div>
          <div className={styles.cardBody}>
            {loading ? <p className={styles.empty}>Loading...</p> : (
              <div className={styles.addonList}>
                {addons.length > 0 ? addons.map((a, idx) => (
                  <div key={idx} className={styles.addonItem}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className={styles.addonIcon}>{getIcon(a.icon)}</span>
                      <span className={styles.addonPrice}>+<CurrencySymbol size={12} /> {parseFloat(a.price).toFixed(2)}</span>
                    </div>
                    <div className={styles.addonName}>{a.name}</div>
                  </div>
                )) : <p className={styles.empty}>No addons found.</p>}
              </div>
            )}
          </div>
        </div>

        {/* 4. Categories */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Layout size={20} color="#EC4899" />
              <h3>Categories</h3>
            </div>
            <button className={styles.addSmall} onClick={() => handleOpenModal('category')}><Plus size={14} /></button>
          </div>
          <div className={styles.cardBody}>
            {loading ? <p className={styles.empty}>Loading...</p> : (
              <div className={styles.list}>
                {categories.length > 0 ? categories.map(c => (
                  <div key={c.id} className={styles.listItem}>
                    <div className={styles.itemInfo}>
                      <div className={styles.iconBox} style={{ background: '#FDF2F8' }}>{getIcon(c.icon)}</div>
                      <div className={styles.itemName}>{c.name}</div>
                    </div>
                    <div className={styles.badge} style={{ background: '#FDF2F8', color: '#EC4899' }}>
                      {services.filter(s => s.category === c.name).length} Services
                    </div>
                  </div>
                )) : <p className={styles.empty}>No categories found.</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Add New {showModal.charAt(0).toUpperCase() + showModal.slice(1)}</h2>
              <X size={24} className={styles.closeBtn} onClick={() => setShowModal(null)} />
            </div>
            <form onSubmit={handleSave}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Name</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                {showModal !== 'category' && (
                  <div className={styles.formGroup}>
                    <label>Base Price ({settings.currencySymbol || 'AED'})</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={formData.price} 
                      onChange={e => setFormData({...formData, price: e.target.value})}
                    />
                  </div>
                )}
                {showModal === 'service' && (
                  <>
                    <div className={styles.formGroup}>
                      <label>Category</label>
                      <select 
                        value={formData.category} 
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>Tax Rate (%) <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748B' }}>(Leave blank for default)</span></label>
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="e.g. 5.00"
                        value={formData.taxRate} 
                        onChange={e => setFormData({...formData, taxRate: e.target.value})}
                      />
                    </div>
                  </>
                )}
                <div className={styles.formGroup}>
                  <label>Icon</label>
                  <div className={styles.iconSelector}>
                    {['Shirt', 'Bed', 'Wind', 'Droplet', 'Heart', 'Layers', 'Zap', 'Sparkles', 'Scissors', 'Tag'].map(icon => (
                      <div 
                        key={icon} 
                        className={`${styles.iconOption} ${formData.icon === icon ? styles.active : ''}`}
                        onClick={() => setFormData({...formData, icon})}
                      >
                        {getIcon(icon)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowModal(null)}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>Save {showModal}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
