import React, { useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import styles from '../Services.module.css';

export default function ServiceList() {
  const [services] = useState([
    { id: 1, name: 'Wash & Fold', price: 2.50, icon: '🧺', category: 'Standard' },
    { id: 2, name: 'Wash & Iron', price: 4.00, icon: '👕', category: 'Standard' },
    { id: 3, name: 'Dry Cleaning', price: 8.00, icon: '👔', category: 'Premium' },
    { id: 4, name: 'Steam Press', price: 1.50, icon: '💨', category: 'Standard' },
  ]);

  return (
    <div className={styles.servicesPage}>
      <div className={styles.header}>
        <h1>Service List</h1>
        <button className="btn btn-primary"><Plus size={18} /> Add Service</button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>Active Services</h3>
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
    </div>
  );
}
