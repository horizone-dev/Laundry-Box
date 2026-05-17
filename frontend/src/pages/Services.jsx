import React, { useState, useEffect } from 'react';
import { Plus, Search, Scissors, Zap, Sparkles, Tag, X, Layout, Shirt, Bed, Wind, Droplet, Heart, Layers, Camera, Image as ImageIcon, Trash2, Edit2 } from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID, CATEGORIES } from '../constants';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Services.module.css';

export default function Services({ activeView = 'overview' }) {
  const { settings } = useSettings();
  const [services, setServices] = useState([]);
  const [types, setTypes] = useState([]);
  const [addons, setAddons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(null); // 'service', 'type', 'addon', 'category'
  const [formData, setFormData] = useState({});
  const [editId, setEditId] = useState(null);

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
      setFormData({ name: '', price: '', category: categories[0]?.name || CATEGORIES.LAUNDRY, taxRate: '', image: null });
    } else if (type === 'category') {
      setFormData({ name: '', image: null });
    } else if (type === 'type') {
      setFormData({ name: '', price: '', image: null });
    } else {
      setFormData({ name: '', price: '', image: null });
    }
    setEditId(null);
    setShowModal(type);
  };

  const handleEdit = (item, type) => {
    setEditId(item.id);
    setFormData({ ...item });
    setShowModal(type);
  };

  const handleDelete = async (id, table) => {
    if (!window.electronAPI?.dbQuery) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      const res = await window.electronAPI.dbQuery(`DELETE FROM ${table} WHERE id = ?`, [id]);
      if (res.success) {
        fetchData();
      } else {
        alert("Failed to delete: " + res.error);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!window.electronAPI?.dbQuery) return;

    const id = Date.now().toString();
    const shopId = DEFAULT_SHOP_ID;
    const timestamp = new Date().toISOString();

    try {
      let query = '';
      let params = [];

      if (showModal === 'service') {
        if (editId) {
          query = 'UPDATE services SET name=?, price=?, image=?, category=?, taxRate=?, updatedAt=? WHERE id=?';
          params = [formData.name, parseFloat(formData.price || 0), formData.image, formData.category, formData.taxRate ? parseFloat(formData.taxRate) : null, timestamp, editId];
        } else {
          query = 'INSERT INTO services (id, shopId, name, price, image, category, taxRate, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
          params = [id, shopId, formData.name, parseFloat(formData.price || 0), formData.image, formData.category, formData.taxRate ? parseFloat(formData.taxRate) : null, timestamp];
        }
      } else if (showModal === 'category') {
        if (editId) {
          query = 'UPDATE service_categories SET name=?, updatedAt=? WHERE id=?';
          params = [formData.name, timestamp, editId];
        } else {
          query = 'INSERT INTO service_categories (id, shopId, name, updatedAt) VALUES (?, ?, ?, ?)';
          params = [id, shopId, formData.name, timestamp];
        }
      } else if (showModal === 'type') {
        if (editId) {
          query = 'UPDATE service_types SET name=?, price=?, updatedAt=? WHERE id=?';
          params = [formData.name, parseFloat(formData.price || 0), timestamp, editId];
        } else {
          query = 'INSERT INTO service_types (id, shopId, name, price, updatedAt) VALUES (?, ?, ?, ?, ?)';
          params = [id, shopId, formData.name, parseFloat(formData.price || 0), timestamp];
        }
      } else if (showModal === 'addon') {
        if (editId) {
          query = 'UPDATE addons SET name=?, price=?, updatedAt=? WHERE id=?';
          params = [formData.name, parseFloat(formData.price || 0), timestamp, editId];
        } else {
          query = 'INSERT INTO addons (id, shopId, name, price, updatedAt) VALUES (?, ?, ?, ?, ?)';
          params = [id, shopId, formData.name, parseFloat(formData.price || 0), timestamp];
        }
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
    return '🧺';
  };

  return (
    <div className={styles.servicesPage}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Service Management</h1>
          <p>Configure your laundry treatments, delivery types, and premium add-ons.</p>
        </div>
        <div className={styles.headerButtons} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input 
              type="text" 
              placeholder="Search services..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #E2E8F0', outline: 'none', background: '#F8FAFC' }}
            />
          </div>
          <button className="btn btn-outline" onClick={() => handleOpenModal('category')}>
            <Tag size={18} /> Add Category
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal('service')}>
            <Plus size={18} /> Add Service
          </button>
        </div>
      </div>

      {/* Derived search arrays */}
      {(() => {
        const searchLower = (searchTerm || '').toLowerCase();
        const filteredServices = services.filter(s => (s?.name || '').toLowerCase().includes(searchLower));
        const filteredTypes = types.filter(t => (t?.name || '').toLowerCase().includes(searchLower));
        const filteredAddons = addons.filter(a => (a?.name || '').toLowerCase().includes(searchLower));
        const filteredCategories = categories.filter(c => (c?.name || '').toLowerCase().includes(searchLower));
        
        return (
          <div className={styles.sectionGrid}>
        {/* 1. Service List */}
        {(activeView === 'overview' || activeView === 'list') && (
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
                {filteredServices.length > 0 ? filteredServices.map(s => (
                  <div key={s.id} className={styles.listItem}>
                    <div className={styles.itemInfo}>
                      {s.image && (
                        <div className={styles.iconBox}>
                          <img src={s.image} alt={s.name} className={styles.serviceImage} />
                        </div>
                      )}
                      <div>
                        <div className={styles.itemName}>{s.name}</div>
                        <span className={styles.badge}>{s.category}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className={styles.itemPrice}><CurrencySymbol size={14} /> {parseFloat(s.price).toFixed(2)}</div>
                      <div className={styles.itemActions}>
                        <button className={styles.actionBtn} onClick={() => handleEdit(s, 'service')}><Edit2 size={16} /></button>
                        <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(s.id, 'services')}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                )) : <p className={styles.empty}>No services found.</p>}
              </div>
            )}
          </div>
        </div>
        )}

        {/* 2. Service Type */}
        {(activeView === 'overview' || activeView === 'type') && (
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
                {filteredTypes.length > 0 ? filteredTypes.map((t, idx) => (
                  <div key={idx} className={styles.listItem}>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{t.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className={styles.itemPrice}><CurrencySymbol size={14} /> {parseFloat(t.price).toFixed(2)}</div>
                      <div className={styles.itemActions}>
                        <button className={styles.actionBtn} onClick={() => handleEdit(t, 'type')}><Edit2 size={16} /></button>
                        <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(t.id, 'service_types')}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                )) : <p className={styles.empty}>No types found.</p>}
              </div>
            )}
          </div>
        </div>
        )}

        {/* 3. Addons */}
        {(activeView === 'overview' || activeView === 'addons') && (
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
                {filteredAddons.length > 0 ? filteredAddons.map((a, idx) => (
                  <div key={idx} className={styles.addonItem}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={styles.addonPrice}>+<CurrencySymbol size={12} /> {parseFloat(a.price).toFixed(2)}</span>
                        <div className={styles.itemActions}>
                          <button className={styles.actionBtn} onClick={() => handleEdit(a, 'addon')}><Edit2 size={14} /></button>
                          <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(a.id, 'addons')}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                    <div className={styles.addonName}>{a.name}</div>
                  </div>
                )) : <p className={styles.empty}>No addons found.</p>}
              </div>
            )}
          </div>
        </div>
        )}

        {/* 4. Categories */}
        {(activeView === 'overview' || activeView === 'list') && (
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
                {filteredCategories.length > 0 ? filteredCategories.map(c => (
                  <div key={c.id} className={styles.listItem}>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{c.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className={styles.badge} style={{ background: '#FDF2F8', color: '#EC4899' }}>
                        {services.filter(s => s.category === c.name).length} Services
                      </div>
                      <div className={styles.itemActions}>
                        <button className={styles.actionBtn} onClick={() => handleEdit(c, 'category')}><Edit2 size={16} /></button>
                        <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(c.id, 'service_categories')}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                )) : <p className={styles.empty}>No categories found.</p>}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      );
      })()}

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editId ? 'Edit' : 'Add New'} {showModal.charAt(0).toUpperCase() + showModal.slice(1)}</h2>
              <X size={24} className={styles.closeBtn} onClick={() => setShowModal(null)} />
            </div>
            <form onSubmit={handleSave}>
              <div className={styles.modalBody}>
                <div className={styles.imageUploadSection}>
                  <div className={styles.imagePreview}>
                    {formData.image ? (
                      <img src={formData.image} alt="Preview" />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        <ImageIcon size={32} />
                      </div>
                    )}
                    <label className={styles.uploadBtn}>
                      <Camera size={16} />
                      <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                  <p className={styles.uploadText}>Click camera to upload service image</p>
                </div>

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
