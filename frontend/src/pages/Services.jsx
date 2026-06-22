import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Scissors, Zap, Sparkles, Tag, X, Layout, 
  Shirt, Bed, Wind, Droplet, Heart, Layers, Camera, 
  Image as ImageIcon, Trash2, Edit2, ChevronDown, ChevronUp, Package 
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { DEFAULT_SHOP_ID, CATEGORIES } from '../constants';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Services.module.css';

export default function Services({ defaultTab = 'list' }) {
  const { settings, updateSettings } = useSettings();
  const [services, setServices] = useState([]);
  const [types, setTypes] = useState([]);
  const [addons, setAddons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, selectedCategoryFilter]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const renderPagination = (items, page, setPage, label) => {
    const totalPages = Math.ceil(items.length / 20);
    if (totalPages <= 1 || loading) return null;
    return (
      <div className={styles.paginationRow} data-noprint="true" style={{ marginTop: '1.5rem' }}>
        <span className={styles.paginationInfo}>
          Showing {Math.min(items.length, (page - 1) * 20 + 1)}-{Math.min(items.length, page * 20)} of {items.length} {label}
        </span>
        <div className={styles.paginationBtns}>
          <button 
            type="button"
            className={styles.paginationBtn} 
            disabled={page === 1}
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
          >
            Previous
          </button>
          {[...Array(totalPages)].map((_, idx) => {
            const pageNum = idx + 1;
            return (
              <button 
                type="button"
                key={pageNum}
                className={`${styles.paginationBtn} ${page === pageNum ? styles.paginationActiveBtn : ''}`}
                onClick={() => setPage(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}
          <button 
            type="button"
            className={styles.paginationBtn} 
            disabled={page === totalPages}
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // Form & view states
  const [showModal, setShowModal] = useState(null); // 'service', 'type', 'addon', 'category'
  const [formData, setFormData] = useState({});
  const [editId, setEditId] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Custom states for Multiple Pricing
  const [selectedTypesList, setSelectedTypesList] = useState([]);
  const [typePricingMap, setTypePricingMap] = useState({}); // { typeId: price }
  const [expandedServices, setExpandedServices] = useState([]);

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

  const toggleExpandService = (id) => {
    setExpandedServices(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleOpenModal = (type) => {
    if (type === 'service') {
      setFormData({ name: '', price: '', category: categories[0]?.name || CATEGORIES.LAUNDRY, taxRate: '', image: null, defaultDeliveryMethod: 'Hanger' });
      // Pre-fill types pricing grid with empty values
      const defaultMap = {};
      types.forEach(t => {
        defaultMap[t.id] = '';
      });
      setSelectedTypesList(types.map(t => t.id)); // select all by default
      setTypePricingMap(defaultMap);
    } else if (type === 'category') {
      setFormData({ name: '', image: null });
    } else if (type === 'type') {
      setFormData({ name: '', image: null });
    } else {
      setFormData({ name: '', price: '', image: null });
    }
    setEditId(null);
    setShowModal(type);
  };

  const handleEdit = (item, type) => {
    setEditId(item.id);
    setFormData({ ...item });
    
    if (type === 'service') {
      let parsedPricing = [];
      try {
        parsedPricing = typeof item.pricing === 'string' ? JSON.parse(item.pricing || '[]') : (item.pricing || []);
      } catch (e) {}
      
      const selectedList = parsedPricing.map(p => p.serviceTypeId);
      const priceMap = {};
      // Initialize with empty prices for all types first
      types.forEach(t => {
        priceMap[t.id] = '';
      });
      // Overwrite with actual configured prices
      parsedPricing.forEach(p => {
        priceMap[p.serviceTypeId] = p.price;
      });
      setSelectedTypesList(selectedList);
      setTypePricingMap(priceMap);
    }
    
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

  const processImage = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, or WEBP).');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, image: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) processImage(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImage(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: null }));
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
        const pricingArray = selectedTypesList.map(typeId => ({
          serviceTypeId: typeId,
          price: parseFloat(typePricingMap[typeId] || 0)
        }));
        const pricingJson = JSON.stringify(pricingArray);
        const basePrice = pricingArray.length > 0 ? pricingArray[0].price : 0;

        if (editId) {
          query = 'UPDATE services SET name=?, price=?, image=?, category=?, taxRate=?, pricing=?, defaultDeliveryMethod=?, updatedAt=? WHERE id=?';
          params = [formData.name, basePrice, formData.image, formData.category, formData.taxRate ? parseFloat(formData.taxRate) : null, pricingJson, formData.defaultDeliveryMethod || 'Hanger', timestamp, editId];
        } else {
          query = 'INSERT INTO services (id, shopId, name, price, image, category, taxRate, pricing, defaultDeliveryMethod, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
          params = [id, shopId, formData.name, basePrice, formData.image, formData.category, formData.taxRate ? parseFloat(formData.taxRate) : null, pricingJson, formData.defaultDeliveryMethod || 'Hanger', timestamp];
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

  const getRandomGradient = (id) => {
    const gradients = [
      '#3B82F6, #1D4ED8', // blue
      '#8B5CF6, #6D28D9', // purple
      '#EC4899, #BE185D', // pink
      '#10B981, #047857', // emerald
      '#F59E0B, #B45309', // amber
      '#06B6D4, #0891B2', // cyan
    ];
    const index = parseInt(id, 10) || 0;
    return gradients[index % gradients.length];
  };

  const tabs = [
    { id: 'list', label: 'Base Services', icon: <Layers size={18} />, count: services.length, color: '#3B82F6' },
    { id: 'type', label: 'Service Treatments', icon: <Zap size={18} />, count: types.length, color: '#F59E0B' },
    { id: 'addons', label: 'Premium Add-ons', icon: <Sparkles size={18} />, count: addons.length, color: '#8B5CF6' },
    { id: 'category', label: 'Categories', icon: <Layout size={18} />, count: categories.length, color: '#EC4899' },
    { id: 'delivery', label: 'Packaging Methods', icon: <Package size={18} />, count: (settings.deliveryMethods || []).length, color: '#10B981' }
  ];

  return (
    <div className={styles.servicesPage}>
      {/* 1. Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Service Management</h1>
          <p>Configure and manage your laundry items, pricing models, categories, and custom enhancements.</p>
        </div>
      </div>

      {/* 2. Interactive Navigation Tabs */}
      <div className={styles.tabsContainer}>
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className={styles.tabCountBadge}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* 3. Search & Control Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder={`Search ${activeTab === 'list' ? 'services' : activeTab === 'type' ? 'treatments' : activeTab === 'addons' ? 'add-ons' : 'categories'}...`} 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {activeTab === 'list' && (
            <button className="btn btn-primary" onClick={() => handleOpenModal('service')}>
              <Plus size={18} /> Add Service
            </button>
          )}
          {activeTab === 'type' && (
            <button className="btn btn-primary" style={{ background: '#D97706' }} onClick={() => handleOpenModal('type')}>
              <Plus size={18} /> Add Treatment
            </button>
          )}
          {activeTab === 'addons' && (
            <button className="btn btn-primary" style={{ background: '#7C3AED' }} onClick={() => handleOpenModal('addon')}>
              <Plus size={18} /> Add Add-on
            </button>
          )}
          {activeTab === 'category' && (
            <button className="btn btn-primary" style={{ background: '#DB2777' }} onClick={() => handleOpenModal('category')}>
              <Plus size={18} /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* 4. Category Filter Chips (Only for Base Services) */}
      {activeTab === 'list' && (
        <div className={styles.categoryChips}>
          <button 
            className={`${styles.chip} ${selectedCategoryFilter === 'All' ? styles.chipActive : ''}`}
            onClick={() => setSelectedCategoryFilter('All')}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              className={`${styles.chip} ${selectedCategoryFilter === cat.name ? styles.chipActive : ''}`}
              onClick={() => setSelectedCategoryFilter(cat.name)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* 5. Main Tab Panels Content */}
      {(() => {
        const searchLower = (searchTerm || '').toLowerCase();
        let filteredServices = services.filter(s => (s?.name || '').toLowerCase().includes(searchLower));
        if (selectedCategoryFilter !== 'All') {
          filteredServices = filteredServices.filter(s => s.category === selectedCategoryFilter);
        }
        const filteredTypes = types.filter(t => (t?.name || '').toLowerCase().includes(searchLower));
        const filteredAddons = addons.filter(a => (a?.name || '').toLowerCase().includes(searchLower));
        const filteredCategories = categories.filter(c => (c?.name || '').toLowerCase().includes(searchLower));

        const paginatedServices = filteredServices.slice((currentPage - 1) * 20, currentPage * 20);
        const paginatedTypes = filteredTypes.slice((currentPage - 1) * 20, currentPage * 20);
        const paginatedAddons = filteredAddons.slice((currentPage - 1) * 20, currentPage * 20);
        const paginatedCategories = filteredCategories.slice((currentPage - 1) * 20, currentPage * 20);

        if (loading) {
          return (
            <div className={styles.emptyStateContainer}>
              <div className={styles.emptyStateIcon} style={{ animation: 'spin 2s linear infinite' }}>
                <Layers size={28} />
              </div>
              <h3>Loading items...</h3>
              <p>Fetching database configuration files.</p>
            </div>
          );
        }

        /* TAB: BASE SERVICES */
        if (activeTab === 'list') {
          if (filteredServices.length === 0) {
            return (
              <div className={styles.emptyStateContainer}>
                <div className={styles.emptyStateIcon}>
                  <Shirt size={28} />
                </div>
                <h3>No services found</h3>
                <p>Add your first laundry base service item to start processing POS orders.</p>
                <button className="btn btn-primary" onClick={() => handleOpenModal('service')}>
                  <Plus size={16} /> Add Base Service
                </button>
              </div>
            );
          }

          return (
            <div className={styles.listItemWrapper}>
              <div className={styles.list}>
                {paginatedServices.map(s => {
                  let pricingList = [];
                  try {
                    pricingList = typeof s.pricing === 'string' ? JSON.parse(s.pricing || '[]') : (s.pricing || []);
                  } catch (e) {}

                  return (
                    <div key={s.id} className={styles.listItem}>
                      <div className={styles.itemInfo}>
                        {s.image ? (
                          <div className={styles.iconBox}>
                            <img src={s.image} alt={s.name} className={styles.serviceImage} />
                          </div>
                        ) : (
                          <div className={styles.iconBox} style={{ fontSize: '1.1rem' }}>
                            🧺
                          </div>
                        )}
                        <div>
                          <div className={styles.itemName}>{s.name}</div>
                          <div className={styles.listItemMeta}>
                            <span className={styles.badge}>{s.category}</span>
                            <span className={styles.badge} style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}>
                              📦 {s.defaultDeliveryMethod || 'Hanger'}
                            </span>
                            <div className={styles.pricingInlineList}>
                              {pricingList.length > 0 ? (
                                pricingList.map((p, pIdx) => {
                                  const typeObj = types.find(t => t.id === p.serviceTypeId);
                                  const typeName = typeObj ? typeObj.name : 'Unknown Type';
                                  return (
                                    <span key={pIdx} className={styles.pricingInlineItem}>
                                      <span className={styles.inlineTypeName}>{typeName}</span>
                                      <span className={styles.inlinePriceVal}>
                                        {settings.currencySymbol || 'AED'} {parseFloat(p.price || 0).toFixed(2)}
                                      </span>
                                    </span>
                                  );
                                })
                              ) : (
                                <span className={styles.inlineEmpty}>No treatments configured</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div className={styles.itemActions}>
                          <button className={styles.actionBtn} onClick={() => handleEdit(s, 'service')}><Edit2 size={16} /></button>
                          <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(s.id, 'services')}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {renderPagination(filteredServices, currentPage, setCurrentPage, 'services')}
            </div>
          );
        }

        /* TAB: SERVICE TREATMENTS */
        if (activeTab === 'type') {
          if (filteredTypes.length === 0) {
            return (
              <div className={styles.emptyStateContainer}>
                <div className={styles.emptyStateIcon} style={{ background: 'rgba(245, 158, 11, 0.05)', color: '#D97706' }}>
                  <Zap size={28} />
                </div>
                <h3>No treatments found</h3>
                <p>Register global laundry treatments (e.g. Wash & Iron, Dry Cleaning) to apply rates on services.</p>
                <button className="btn btn-primary" style={{ background: '#D97706' }} onClick={() => handleOpenModal('type')}>
                  <Plus size={16} /> Add Service Treatment
                </button>
              </div>
            );
          }

          return (
            <div>
              <div className={styles.treatmentsGrid}>
                {paginatedTypes.map((t, idx) => (
                  <div key={idx} className={styles.treatmentCard}>
                    <div className={styles.treatmentIconBox}>
                      <Zap size={20} />
                    </div>
                    <div className={styles.treatmentInfo}>
                      <h4 className={styles.treatmentName}>{t.name}</h4>
                      <span className={styles.treatmentMeta}>Active treatment model</span>
                    </div>
                    <div className={styles.treatmentActions}>
                      <button className={styles.iconActionBtn} onClick={() => handleEdit(t, 'type')} title="Edit"><Edit2 size={15} /></button>
                      <button className={`${styles.iconActionBtn} ${styles.delete}`} onClick={() => handleDelete(t.id, 'service_types')} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
              {renderPagination(filteredTypes, currentPage, setCurrentPage, 'treatments')}
            </div>
          );
        }

        /* TAB: PREMIUM ADD-ONS */
        if (activeTab === 'addons') {
          if (filteredAddons.length === 0) {
            return (
              <div className={styles.emptyStateContainer}>
                <div className={styles.emptyStateIcon} style={{ background: 'rgba(139, 92, 246, 0.05)', color: '#7C3AED' }}>
                  <Sparkles size={28} />
                </div>
                <h3>No add-ons found</h3>
                <p>Add fragrance choices, starching, softener options, or express services for orders.</p>
                <button className="btn btn-primary" style={{ background: '#7C3AED' }} onClick={() => handleOpenModal('addon')}>
                  <Plus size={16} /> Add Premium Add-on
                </button>
              </div>
            );
          }

          return (
            <div>
              <div className={styles.addonsGrid}>
                {paginatedAddons.map((a, idx) => (
                  <div key={idx} className={styles.addonCard}>
                    <div className={styles.addonIconBox}>
                      <Sparkles size={20} />
                    </div>
                    <div className={styles.addonDetails}>
                      <h4 className={styles.addonTitle}>{a.name}</h4>
                      <span className={styles.addonPriceBadge}>
                        +<CurrencySymbol size={12} /> {parseFloat(a.price).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.addonActions}>
                      <button className={styles.iconActionBtn} onClick={() => handleEdit(a, 'addon')} title="Edit"><Edit2 size={15} /></button>
                      <button className={`${styles.iconActionBtn} ${styles.delete}`} onClick={() => handleDelete(a.id, 'addons')} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
              {renderPagination(filteredAddons, currentPage, setCurrentPage, 'add-ons')}
            </div>
          );
        }

        /* TAB: CATEGORIES */
        if (activeTab === 'category') {
          if (filteredCategories.length === 0) {
            return (
              <div className={styles.emptyStateContainer}>
                <div className={styles.emptyStateIcon} style={{ background: 'rgba(236, 72, 153, 0.05)', color: '#DB2777' }}>
                  <Layout size={28} />
                </div>
                <h3>No categories found</h3>
                <p>Build service groups (e.g. Laundry, Bedding, Ironing) to sort items in POS terminal layout.</p>
                <button className="btn btn-primary" style={{ background: '#DB2777' }} onClick={() => handleOpenModal('category')}>
                  <Plus size={16} /> Add Category
                </button>
              </div>
            );
          }

          return (
            <div>
              <div className={styles.categoriesGrid}>
                {paginatedCategories.map(c => {
                  const serviceCount = services.filter(s => s.category === c.name).length;
                  return (
                    <div key={c.id} className={styles.categoryCard}>
                      <div className={styles.categoryIconBox}>
                        <Layout size={20} />
                      </div>
                      <div className={styles.categoryInfo}>
                        <h4 className={styles.categoryName}>{c.name}</h4>
                        <span className={styles.categoryCount}>{serviceCount} Service{serviceCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className={styles.categoryActions}>
                        <button className={styles.iconActionBtn} onClick={() => handleEdit(c, 'category')} title="Edit"><Edit2 size={15} /></button>
                        <button className={`${styles.iconActionBtn} ${styles.delete}`} onClick={() => handleDelete(c.id, 'service_categories')} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {renderPagination(filteredCategories, currentPage, setCurrentPage, 'categories')}
            </div>
          );
        }

        /* TAB: PACKAGING METHODS */
        if (activeTab === 'delivery') {
          const methods = settings.deliveryMethods || [];
          return (
            <div className={styles.listItemWrapper}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F172A', fontWeight: 800 }}>Manage Packaging Methods</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>Configure dynamic options available for service packaging and receipts.</p>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ background: '#10B981' }} 
                    onClick={() => {
                      const name = prompt("Enter Packaging Method Name (English):", "");
                      if (!name || !name.trim()) return;
                      const nameAr = prompt("Enter Packaging Method Name (Arabic):", "");
                      const updated = [...methods, { name: name.trim(), nameAr: (nameAr || '').trim(), isDefault: false }];
                      updateSettings({ deliveryMethods: updated });
                    }}
                  >
                    <Plus size={16} /> Add Method
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  {methods.map((method, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      background: '#F8FAFC',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0'
                    }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                         <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B' }}>{method.name}</span>
                         {method.nameAr && <span style={{ fontSize: '0.85rem', color: '#64748B' }}>({method.nameAr})</span>}
                         {method.isDefault && (
                           <span style={{ fontSize: '0.7rem', color: '#047857', background: '#D1FAE5', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>DEFAULT</span>
                         )}
                       </div>
                       <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                         {!method.isDefault && (
                           <button 
                             type="button" 
                             style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                             onClick={() => {
                               const updated = methods.map((m, i) => ({ ...m, isDefault: i === idx }));
                               updateSettings({ deliveryMethods: updated });
                             }}
                           >
                             Set Default
                           </button>
                         )}
                         <button 
                           type="button" 
                           style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                           onClick={() => {
                             const name = prompt("Edit English Name:", method.name);
                             if (!name || !name.trim()) return;
                             const nameAr = prompt("Edit Arabic Name:", method.nameAr || '');
                             const updated = [...methods];
                             updated[idx] = { ...method, name: name.trim(), nameAr: (nameAr || '').trim() };
                             updateSettings({ deliveryMethods: updated });
                           }}
                         >
                           Rename
                         </button>
                         <button 
                           type="button" 
                           style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }}
                           onClick={() => {
                             if (method.isDefault) {
                               alert("Cannot delete the default packaging method. Set another option as default first!");
                               return;
                             }
                             if (confirm(`Delete packaging method "${method.name}"?`)) {
                               const updated = methods.filter((_, i) => i !== idx);
                               updateSettings({ deliveryMethods: updated });
                             }
                           }}
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }
      })()}

      {/* Slide-over Drawer for Service */}
      {showModal === 'service' && (
        <div className={styles.slideOverOverlay}>
          <div className={styles.slideOver}>
            <div className={styles.slideOverHeader}>
              <h2>{editId ? 'Edit' : 'Add New'} Service</h2>
              <X size={24} className={styles.closeBtn} onClick={() => setShowModal(null)} />
            </div>
            <form onSubmit={handleSave}>
              <div className={styles.slideOverBody}>
                <div className={styles.imageUploadSection}>
                  <div 
                    className={`${styles.imagePreview} ${dragActive ? styles.dragActive : ''} ${formData.image ? styles.hasImage : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                  >
                    {formData.image ? (
                      <>
                        <img src={formData.image} alt="Preview" />
                        <div className={styles.imageOverlay}>
                          <button type="button" className={styles.removeImageBtn} onClick={handleRemoveImage} title="Remove image">
                            <Trash2 size={18} />
                          </button>
                          <label className={styles.changeImageLabel} title="Change image">
                            <Edit2 size={18} />
                            <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                          </label>
                        </div>
                      </>
                    ) : (
                      <label className={styles.dropZoneLabel}>
                        <ImageIcon size={36} className={styles.dropZoneIcon} />
                        <span className={styles.dropZoneText}>Drag & drop image here or <strong>browse</strong></span>
                        <span className={styles.dropZoneSubtext}>Optimized PNG, JPG, or WEBP</span>
                        <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                      </label>
                    )}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Name</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select 
                    value={formData.category || ''} 
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
                    value={formData.taxRate || ''} 
                    onChange={e => setFormData({...formData, taxRate: e.target.value})}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Default Delivery / Packaging Method</label>
                  <select 
                    value={formData.defaultDeliveryMethod || (settings.deliveryMethods?.find(m => m.isDefault)?.name || 'Hanger')} 
                    onChange={e => setFormData({...formData, defaultDeliveryMethod: e.target.value})}
                  >
                    {(settings.deliveryMethods || [
                      { name: 'Hanger' },
                      { name: 'Folded' }
                    ]).map((method, mIdx) => (
                      <option key={mIdx} value={method.name}>{method.name}</option>
                    ))}
                  </select>
                </div>

                {/* Dynamic Pricing Grid */}
                <div className={styles.pricingGridContainer}>
                  <div className={styles.pricingGridTitle}>Service Types & Pricing</div>
                  {types.map(type => {
                    const isChecked = selectedTypesList.includes(type.id);
                    const typePrice = typePricingMap[type.id] !== undefined ? typePricingMap[type.id] : '';
                    return (
                      <div key={type.id} className={styles.pricingGridRow}>
                        <label className={styles.gridCheckLabel}>
                          <input 
                            type="checkbox"
                            className={styles.gridCheckInput}
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (checked) {
                                setSelectedTypesList(prev => [...prev, type.id].filter((x, i, self) => self.indexOf(x) === i));
                              } else {
                                setSelectedTypesList(prev => prev.filter(id => id !== type.id));
                              }
                            }}
                          />
                          <span>{type.name}</span>
                        </label>
                        {isChecked && (
                          <div className={styles.gridPriceInputWrapper}>
                            <span className={styles.gridCurrency}>{settings.currencySymbol || 'AED'}</span>
                            <input 
                              type="number"
                              step="0.01"
                              required
                              placeholder="0.00"
                              className={styles.gridPriceInput}
                              value={typePrice}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTypePricingMap(prev => ({ ...prev, [type.id]: val }));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={styles.slideOverFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowModal(null)}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>Save Service</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standard Modal for Category/Type/Addon */}
      {showModal && showModal !== 'service' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editId ? 'Edit' : 'Add New'} {showModal.charAt(0).toUpperCase() + showModal.slice(1)}</h2>
              <X size={24} className={styles.closeBtn} onClick={() => setShowModal(null)} />
            </div>
            <form onSubmit={handleSave}>
              <div className={styles.modalBody}>
                {showModal === 'category' || showModal === 'type' ? (
                  <div className={styles.formGroup}>
                    <label>Name</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.name || ''} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                ) : (
                  <>
                    <div className={styles.formGroup}>
                      <label>Name</label>
                      <input 
                        type="text" 
                        required 
                        value={formData.name || ''} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Add-on Price ({settings.currencySymbol || 'AED'})</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        required 
                        value={formData.price || ''} 
                        onChange={e => setFormData({...formData, price: e.target.value})}
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
