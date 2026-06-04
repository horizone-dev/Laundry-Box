import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ChevronLeft, MessageCircle, Landmark } from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { t } from '../utils/translations';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './OverdueStatement.module.css';

export default function OverdueStatement() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { settings, formatDate } = useSettings();
  const [customer, setCustomer] = useState(null);
  const [pendingBills, setPendingBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [customerId]);

  const fetchData = async () => {
    if (window.electronAPI?.dbQuery) {
      try {
        const cRes = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (cRes.success && cRes.data.length > 0) {
          setCustomer(cRes.data[0]);
        }

        const bRes = await window.electronAPI.dbQuery(
          "SELECT * FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND (dueAmount > 0 OR paymentStatus != 'Paid') ORDER BY createdAt ASC",
          [customerId]
        );
        if (bRes.success) {
          setPendingBills(bRes.data);
        }
      } catch (err) {
        console.error("Fetch statement data failed:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const totalOverdue = pendingBills.reduce((sum, b) => sum + (b.dueAmount || (b.totalAmount - (b.paidAmount || 0))), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    if (!customer) return;
    const message = `Hello ${customer.name}! This is a friendly reminder regarding your outstanding balance of ${settings.currencySymbol || 'AED'} ${totalOverdue.toFixed(2)} at ${settings.shopName || 'our laundry'}. Please visit us to settle the payment. Thank you!`;
    const url = `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (loading) return <div className={styles.container}>Generating Statement...</div>;
  if (!customer) return <div className={styles.container}>Customer not found.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.actions}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <ChevronLeft size={20} /> Back to POS
        </button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleWhatsApp} className={styles.whatsappBtn}>
            <MessageCircle size={18} /> WhatsApp Reminder
          </button>
          <button onClick={handlePrint} className={styles.printBtn}>
            <Printer size={18} /> Print Statement
          </button>
        </div>
      </div>

      <div className={styles.statementCard}>
        <div className={styles.header}>
          <div className={styles.shopInfo}>
             <img src="/logo.png" alt="" className={styles.logo} onError={(e) => e.target.style.display='none'} />
             <div className={styles.shopDetails}>
                <h2>{settings.shopName || 'Laundry Management System'}</h2>
                <p>{settings.shopAddress || 'Dubai, UAE'}</p>
                <p>Tel: {settings.shopPhone || '+971 00 000 0000'}</p>
             </div>
          </div>
          <div className={styles.titleSection}>
            <h1>STATEMENT</h1>
            <p>AS OF {formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.customerInfo}>
            <p className={styles.sectionLabel}>CUSTOMER DETAILS</p>
            <h3>{customer.name}</h3>
            <p>{customer.phone}</p>
            {customer.address && <p>{customer.address}</p>}
          </div>
          <div className={styles.summaryBox}>
             <p className={styles.sectionLabel}>SUMMARY</p>
             <div className={styles.summaryRow}>
                <span>Outstanding Bills</span>
                <strong>{pendingBills.length}</strong>
             </div>
             <div className={styles.summaryRow}>
                <span>Total {t('overdue', settings.language)} Amount</span>
                <strong className={styles.totalDueValue}><CurrencySymbol size={18} /> {totalOverdue.toFixed(2)}</strong>
             </div>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Bill ID</th>
              <th>Date</th>
              <th className={styles.alignRight}>Original Total</th>
              <th className={styles.alignRight}>Paid</th>
              <th className={styles.alignRight}>Due Amount</th>
            </tr>
          </thead>
          <tbody>
            {pendingBills.map(bill => (
              <tr key={bill.id}>
                <td className={styles.billId}>{bill.id}</td>
                <td>{formatDate(bill.createdAt)}</td>
                <td className={styles.alignRight}><CurrencySymbol size={12} /> {bill.totalAmount.toFixed(2)}</td>
                <td className={styles.alignRight}><CurrencySymbol size={12} /> {(bill.paidAmount || 0).toFixed(2)}</td>
                <td className={styles.dueCell}><CurrencySymbol size={14} /> {(bill.dueAmount || (bill.totalAmount - (bill.paidAmount || 0))).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.footer}>
          <div className={styles.notes}>
            <p><strong>IMPORTANT:</strong> This statement reflects all unpaid transactions as of today. If you have already made a payment, please share the transaction reference for reconciliation.</p>
          </div>

          <p className={styles.sectionLabel}>PAYMENT OPTIONS</p>
          <div className={styles.bankSection}>
            {settings.bankAccounts && settings.bankAccounts.map((acc, i) => (
              <div key={i} className={styles.bankCard}>
                <span className={styles.bankName}>{acc.bankName}</span>
                <div className={styles.bankDetails}>
                  <div>Account: {acc.accountNumber}</div>
                  <div>IBAN: {acc.iban}</div>
                </div>
              </div>
            ))}
            {(!settings.bankAccounts || settings.bankAccounts.length === 0) && (
              <div className={styles.bankCard}>
                <span className={styles.bankName}>Cash Payment</span>
                <p className={styles.bankDetails}>Please visit our counter for cash payments.</p>
              </div>
            )}
          </div>
        </div>

        <div className={styles.watermark}>Generated by Laundry Management System</div>
      </div>
    </div>
  );
}
