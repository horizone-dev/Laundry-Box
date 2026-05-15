import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Printer, Send, FileText } from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import InvoiceTemplate from '../components/InvoiceTemplate';
import html2pdf from 'html2pdf.js';
import styles from './Invoice.module.css';

export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [order, setOrder] = useState(null);
  const invoiceRef = React.useRef();

  useEffect(() => {
    const fetchOrder = async () => {
      const cleanId = id.replace('AG-', '').replace('#', '');
      const fullId = `#AG-${cleanId}`;
      
      if (window.electronAPI?.dbQuery) {
        try {
          // Try multiple ID formats for robustness
          const idVariations = [
            id,
            `#${id}`,
            id.startsWith('#') ? id.substring(1) : `#${id}`,
            id.replace('#', '').replace('AG-', '#AG-'),
            id.replace('#', '').replace('AG-', '')
          ];
          
          let rawOrder = null;
          for (const variant of idVariations) {
            const res = await window.electronAPI.dbQuery('SELECT * FROM orders WHERE id = ? OR billNumber = ?', [variant, variant]);
            if (res.success && res.data.length > 0) {
              rawOrder = res.data[0];
              break;
            }
          }

          if (rawOrder) {
            const taxRate = settings.isTaxEnabled ? (settings.taxRate || 0) / 100 : 0;
            const subtotal = rawOrder.totalAmount / (1 + taxRate);
            setOrder({
              id: rawOrder.id,
              date: new Date(rawOrder.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              customer: rawOrder.customerName || rawOrder.customerId,
              customerPhone: rawOrder.customerPhone || '',
              residency: 'Customer Residency',
              status: rawOrder.status,
              items: JSON.parse(rawOrder.items || '[]').map(item => ({
                name: item.name,
                sub: item.type || 'Standard Treatment',
                qty: item.qty,
                price: item.price,
                total: item.price * item.qty
              })),
              subtotal: subtotal,
              tax: rawOrder.totalAmount - subtotal,
              total: rawOrder.totalAmount
            });
          } else {
            useFallback();
          }
        } catch (err) {
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

  const generatePDF = async () => {
    const element = invoiceRef.current;
    const opt = {
      margin: [10, 10],
      filename: `Invoice_${order.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
      return true;
    } catch (err) {
      console.error("PDF Generation failed:", err);
      return false;
    }
  };

  const handleWhatsApp = async () => {
    // 1. Generate and download PDF
    const pdfSuccess = await generatePDF();
    
    // 2. Format WhatsApp Message
    const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
    const countryCode = settings.waCountryCode || '';
    let finalPhone = cleanPhone;
    if (countryCode && !finalPhone.startsWith(countryCode)) {
      finalPhone = countryCode + finalPhone;
    }

    const itemsSummary = order.items.map(item => `- ${item.qty} x ${item.name} (${settings.currencySymbol || 'AED'} ${item.total.toFixed(2)})`).join('%0A');
    const message = `*INVOICE RECEIVED* %0A%0AHello! Here is your bill for order *${order.id}*.%0A%0A*Items:*%0A${itemsSummary}%0A%0A*Total Amount: ${settings.currencySymbol || 'AED'} ${order.total.toFixed(2)}*%0A%0A_Your PDF invoice has been generated and downloaded. Please attach it here to share._`;
    
    const url = `https://wa.me/${finalPhone}?text=${message}`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

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

      <div ref={invoiceRef} style={{ padding: '2rem' }}>
        <InvoiceTemplate order={order} settings={settings} />
      </div>

      <div className={styles.footerActions} style={{ maxWidth: '800px', margin: '0 auto 2rem auto', display: 'flex', gap: '1rem', padding: '0 2rem' }}>
        <button className={styles.printBtn} onClick={() => window.print()}>
          <Printer size={20} /> Print Receipt
        </button>
        <button className={styles.pdfBtn} onClick={generatePDF}>
          <FileText size={20} /> Download PDF
        </button>
        <button className={styles.waBtn} onClick={handleWhatsApp}>
          <Send size={20} /> Send via WhatsApp
        </button>
      </div>
    </div>
  );
}
