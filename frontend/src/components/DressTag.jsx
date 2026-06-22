import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useSettings } from '../store/SettingsContext';
import styles from './DressTag.module.css';

export default function DressTag({ order }) {
  const { formatDate } = useSettings();
  if (!order || !order.items) return null;

  // Flatten items so if there are 3 shirts, we get 3 tags
  const tags = [];
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  
  items.forEach(item => {
    for (let i = 0; i < item.qty; i++) {
      tags.push({
        ...item,
        tagIndex: i + 1,
        totalInGroup: item.qty
      });
    }
  });

  return (
    <div className={styles.tagContainer}>
      {tags.map((tag, idx) => (
        <div key={idx} className={styles.dressTag}>
          <div className={styles.tagHeader}>
            <span className={styles.orderId}>{order.id}</span>
            <span className={styles.tagCount}>{tag.tagIndex}/{tag.totalInGroup}</span>
          </div>
          
          <div className={styles.tagBody}>
            <div className={styles.qrWrapper}>
              <QRCodeSVG value={`ORDER:${order.id}`} size={60} />
            </div>
            <div className={styles.itemDetails}>
              <h3 className={styles.itemName}>{tag.name}</h3>
              <p className={styles.itemType}>{tag.type}</p>
              {tag.deliveryMethod && (
                <p className={styles.itemDelivery} style={{ fontWeight: 'bold', color: '#16A34A', fontSize: '0.75rem', margin: '2px 0 0 0' }}>
                  📦 {tag.deliveryMethod}
                </p>
              )}
              <p className={styles.customerName}>{order.customerName}</p>
            </div>
          </div>
          
          <div className={styles.tagFooter}>
            <span>{formatDate(order.createdAt)}</span>
            {tag.addons && tag.addons.length > 0 && (
              <span className={styles.addons}>+ {tag.addons.join(', ')}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
