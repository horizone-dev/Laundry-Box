import React, { useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import styles from '../Services.module.css';

export default function ServiceType() {
  const [types] = useState([
    { name: 'Normal Delivery', time: '24-48 Hours', charge: 'Free' },
    { name: 'Express Delivery', time: '6-12 Hours', charge: '+$5.00' },
    { name: 'Same Day', time: 'Under 4 Hours', charge: '+50%' },
  ]);

  return (
    <div className={styles.servicesPage}>
      <div className={styles.header}>
        <h1>Service Types</h1>
        <button className="btn btn-primary"><Plus size={18} /> Add Type</button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>Delivery Options</h3>
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
    </div>
  );
}
