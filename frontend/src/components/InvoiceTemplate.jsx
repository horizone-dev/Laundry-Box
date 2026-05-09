import React from 'react';
import { QrCode, Activity } from 'lucide-react';
import CurrencySymbol from './CurrencySymbol';
import styles from '../pages/Invoice.module.css';

export default function InvoiceTemplate({ order, settings }) {
  if (!order) return null;

  return (
    <div className={`${styles.invoiceCard} ${styles[`template_${settings.invoiceTemplate}`]}`}>
      <div className={styles.invoiceHeader}>
        <div className={styles.companySide}>
          <div className={styles.logoBox}>
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" className={styles.invoiceLogo} />
            ) : (
              <Activity size={28} />
            )}
          </div>
          <div className={styles.invoiceInfo}>
            <h1>Invoice {order.id}</h1>
            <p>Issued on {order.date}</p>
          </div>
        </div>
        <div className={styles.billTo}>
          <div className={styles.statusBadge}>
            <span className={styles.statusDot}></span>
            {order.status}
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <span className={styles.billToLabel}>BILL TO</span>
            <span className={styles.customerName}>{order.customer}</span>
            <span className={styles.customerRes}>{order.residency}</span>
          </div>
        </div>
      </div>

      <table className={styles.itemsTable}>
        <thead>
          <tr>
            <th style={{ width: '60%' }}>ITEM DESCRIPTION</th>
            <th style={{ textAlign: 'center' }}>QTY</th>
            <th style={{ textAlign: 'center' }}>PRICE</th>
            <th style={{ textAlign: 'right' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <tr key={idx}>
              <td>
                <div className={styles.itemDesc}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemSub}>{item.sub}</span>
                </div>
              </td>
              <td style={{ textAlign: 'center' }} className={styles.cellValue}>{item.qty}</td>
              <td style={{ textAlign: 'center' }} className={styles.cellValue}><CurrencySymbol size={12} /> {item.price.toFixed(2)}</td>
              <td className={styles.cellTotal}><CurrencySymbol size={12} /> {item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.bottomSection}>
        <div className={styles.trackBox}>
          <div className={styles.qrCode}>
            <QrCode size={64} color="#0F172A" />
          </div>
          <div className={styles.trackInfo}>
            <h4>Track Progress</h4>
            <p>Scan this code to see real-time cleaning status of your items.</p>
          </div>
        </div>

        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span>{settings.taxMethod === 'inclusive' ? 'Base Price' : 'Subtotal'}</span>
            <span><CurrencySymbol size={12} /> {order.subtotal.toFixed(2)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>{settings.taxName || 'Tax'} ({settings.isTaxEnabled ? settings.taxRate : 0}%)</span>
            <span><CurrencySymbol size={12} /> {order.tax.toFixed(2)}</span>
          </div>
          <div className={styles.grandTotalRow}>
            <span className={styles.grandTotalLabel}>Total Amount</span>
            <span className={styles.grandTotalValue}><CurrencySymbol size={16} /> {order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
