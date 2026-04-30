import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import styles from '../Services.module.css';

export default function Addons() {
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
        <h1>Service Addons</h1>
        <button className="btn btn-primary"><Plus size={18} /> Add Addon</button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>Available Addons</h3>
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
  );
}
