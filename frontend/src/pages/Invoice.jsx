import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, X, Printer, Send, MessageCircle, 
  QrCode, Activity, CheckCircle
} from 'lucide-react';
import styles from './Invoice.module.css';

export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      // Logic: id from params might already have AG- or be just the number
      // We stored it as #AG-12345
      const cleanId = id.replace('AG-', '').replace('#', '');
      const fullId = `#AG-${cleanId}`;
      
      console.log("Fetching order:", fullId);

      if (window.electronAPI?.dbQuery) {
        try {
          const res = await window.electronAPI.dbQuery('SELECT * FROM orders WHERE id = ?', [fullId]);
          if (res.success && res.data.length > 0) {
            const rawOrder = res.data[0];
            setOrder({
              id: rawOrder.id,
              date: new Date(rawOrder.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              customer: rawOrder.customerId,
              residency: 'Customer Residency',
              status: rawOrder.status,
              items: JSON.parse(rawOrder.items).map(item => ({
                name: item.name,
                sub: item.type || 'Standard Treatment',
                qty: item.qty,
                price: item.price,
                total: item.price * item.qty
              })),
              subtotal: rawOrder.totalAmount / 1.085,
              tax: rawOrder.totalAmount - (rawOrder.totalAmount / 1.085),
              total: rawOrder.totalAmount
            });
          } else {
            console.warn("Order not found in DB, using fallback");
            useFallback();
          }
        } catch (err) {
          console.error("DB Error:", err);
          useFallback();
        }
      } else {
        useFallback();
      }
    };

    const useFallback = () => {
      setOrder({
        id: `#AG-${id.replace('AG-', '')}`,
        date: 'Oct 24, 2023',
        customer: 'Eleanor Shellstrop',
        residency: '"The Good Place" Residency',
        status: 'PAID',
        items: [
          { name: 'Premium Suit Dry Clean', sub: 'Professional grade chemical cleaning & steaming', qty: 2, price: 25.00, total: 50.00 },
          { name: 'Egyptian Cotton Shirts', sub: 'Gentle wash, starch, and custom pressing', qty: 5, price: 8.00, total: 40.00 },
          { name: 'Silk Scarf Special Care', sub: 'Delicate hand-wash with eco-solvent treatment', qty: 1, price: 15.00, total: 15.00 },
        ],
        subtotal: 105.00,
        tax: 8.40,
        total: 113.40
      });
    };

    fetchOrder();
  }, [id]);

  if (!order) return <div className={styles.loading}>Loading Invoice...</div>;

  return (
    <div className={styles.invoicePage}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.backBtn} onClick={() => navigate('/orders')}>
          <ArrowLeft size={20} />
          <span>Invoice Management</span>
        </div>
        <div className={styles.topActions}>
          <button className={styles.closeBtn} onClick={() => navigate('/orders')}>
            <X size={18} /> Close
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            New Order
          </button>
        </div>
      </div>

      {/* Invoice Card */}
      <div className={styles.invoiceCard}>
        <div className={styles.invoiceHeader}>
          <div className={styles.companySide}>
            <div className={styles.logoBox}>
              <Activity size={28} />
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
                <td style={{ textAlign: 'center' }} className={styles.cellValue}>${item.price.toFixed(2)}</td>
                <td className={styles.cellTotal}>${item.total.toFixed(2)}</td>
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
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Service Tax (8%)</span>
              <span>${order.tax.toFixed(2)}</span>
            </div>
            <div className={styles.grandTotalRow}>
              <span className={styles.grandTotalLabel}>Total Amount</span>
              <span className={styles.grandTotalValue}>${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className={styles.footerActions}>
          <button className={styles.printBtn} onClick={() => window.print()}>
            <Printer size={20} /> Print Receipt
          </button>
          <button className={styles.waBtn}>
            <Send size={20} /> Send via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
