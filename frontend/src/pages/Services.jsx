import React, { useState } from 'react';
import { Plus, Scissors, Zap, Sparkles, Tag } from 'lucide-react';
import styles from './Services.module.css';

export default function Services() {
  const [services] = useState([
    { id: 1, name: 'Wash & Fold', price: 2.50, icon: '🧺', category: 'Standard' },
    { id: 2, name: 'Wash & Iron', price: 4.00, icon: '👕', category: 'Standard' },
    { id: 3, name: 'Dry Cleaning', price: 8.00, icon: '👔', category: 'Premium' },
    { id: 4, name: 'Steam Press', price: 1.50, icon: '💨', category: 'Standard' },
  ]);

  const [types] = useState([
    { name: 'Normal Delivery', time: '24-48 Hours', charge: 'Free' },
    { name: 'Express Delivery', time: '6-12 Hours', charge: '+$5.00' },
    { name: 'Same Day', time: 'Under 4 Hours', charge: '+50%' },
  ]);

  const [addons] = useState([
    { name: 'Fragrance Boost', price: 1.00, icon: '🌸' },
    { name: 'Stain Removal', price: 3.00, icon: '✨' },
    { name: 'Hanger Packing', price: 0.50, icon: '👗' },
    { name: 'Folding Only', price: 0.00, icon: '📦' },
    { name: 'Fabric Softener', price: 1.00, icon: '🧴' },
    { name: 'Eco-Friendly Wash', price: 2.00, icon: '🌱' },
  ]);

  return (
    <div className={styles.servicesPage}>
      <div className={styles.header}>
        <h1>Service Management</h1>
        <button className="btn btn-primary"><Plus size={18} /> Add New</button>
      </div>

      <div className={styles.sectionGrid}>
        {/* 1. Service List */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Service List</h3>
            <Tag size={18} color="var(--text-secondary)" />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.list}>
              {services.map(s => (
                <div key={s.id} className={styles.listItem}>
                  <div className={styles.itemInfo}>
                    <div className={styles.iconBox}>{s.icon}</div>
                    <div>
                      <div className={styles.itemName}>{s.name}</div>
                      <span className={styles.badge}>{s.category}</span>
                    </div>
                  </div>
                  <div className={styles.itemPrice}>${s.price.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Service Type */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Service Types (Delivery)</h3>
            <Zap size={18} color="var(--warning)" />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.list}>
              {types.map((t, idx) => (
                <div key={idx} className={styles.listItem}>
                  <div>
                    <div className={styles.itemName}>{t.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.time}</div>
                  </div>
                  <div style={{ fontWeight: 600, color: t.charge.includes('+') ? 'var(--danger)' : 'var(--secondary)' }}>
                    {t.charge}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Addons */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Service Addons</h3>
            <Sparkles size={18} color="var(--primary)" />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.addonList}>
              {addons.map((a, idx) => (
                <div key={idx} className={styles.addonItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.2rem' }}>{a.icon}</span>
                    <span className={styles.addonPrice}>+${a.price.toFixed(2)}</span>
                  </div>
                  <div className={styles.addonName}>{a.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
