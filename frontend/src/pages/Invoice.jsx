import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, Printer, Send, FileText, Tag } from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import InvoiceTemplate from '../components/InvoiceTemplate';
import DressTag from '../components/DressTag';
import styles from './Invoice.module.css';

export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings, formatDate } = useSettings();
  const [order, setOrder] = useState(null);
  const [isPrintingTags, setIsPrintingTags] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const invoiceRef = React.useRef();

  useEffect(() => {
    const fetchOrder = async () => {
      if (window.electronAPI?.dbQuery) {
        try {
          // Try multiple ID formats for robustness
          const idVariations = [
            id,
            `#${id}`,
            id.startsWith('#') ? id.substring(1) : `#${id}`,
            id.replace('#', '').replace('AG-', ''),
            id.replace('#', '').replace(settings.invoicePrefix || '', '')
          ];
          
          let rawOrder = null;
          for (const variant of idVariations) {
            const res = await window.electronAPI.dbQuery(
              `SELECT orders.*, customers.name as customerName, customers.phone as customerPhone 
               FROM orders 
               LEFT JOIN customers ON orders.customerId = customers.id 
               WHERE orders.id = ? OR orders.billNumber = ?`,
              [variant, variant]
            );
            if (res.success && res.data.length > 0) {
              rawOrder = res.data[0];
              break;
            }
          }

          if (rawOrder) {
            let customerBalance = 0;
            if (rawOrder.customerId && rawOrder.customerId !== 'Walk-in') {
              const custRes = await window.electronAPI.dbQuery('SELECT balance FROM customers WHERE id = ?', [rawOrder.customerId]);
              if (custRes.success && custRes.data.length > 0) {
                customerBalance = custRes.data[0].balance || 0;
              }
            }

            const paidAmount = rawOrder.paidAmount || 0;
            const dueAmount = rawOrder.dueAmount ?? (rawOrder.totalAmount - paidAmount);
            
            let totalBalance = 0;
            let previousBalance = 0;

            if (rawOrder.customerId && rawOrder.customerId !== 'Walk-in') {
               totalBalance = customerBalance;
               previousBalance = totalBalance - dueAmount;
            } else {
               totalBalance = dueAmount;
               previousBalance = 0;
            }

            const formatDateTime = (dateVal) => {
              if (!dateVal) return 'N/A';
              const formattedDate = formatDate(dateVal);
              if (formattedDate === 'N/A' || formattedDate === 'Invalid Date') return formattedDate;
              
              let d;
              try {
                d = new Date(dateVal);
              } catch(e) {
                return formattedDate;
              }
              if (isNaN(d.getTime())) return formattedDate;

              let hours = d.getHours();
              const minutes = String(d.getMinutes()).padStart(2, '0');
              let ampm = '';
              if (settings.timeFormat === '12h') {
                ampm = hours >= 12 ? ' PM' : ' AM';
                hours = hours % 12;
                hours = hours ? hours : 12;
              }
              const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
              return `${formattedDate} ${formattedTime}`;
            };

            const taxRate = settings.isTaxEnabled ? (settings.taxRate || 0) / 100 : 0;
            const subtotal = rawOrder.totalAmount / (1 + taxRate);
            setOrder({
              id: rawOrder.id,
              billNumber: rawOrder.billNumber || '',
              date: formatDateTime(rawOrder.createdAt),
              createdAt: rawOrder.createdAt,
              customer: rawOrder.customerName || rawOrder.customerId,
              customerId: rawOrder.customerId,
              customerPhone: rawOrder.customerPhone || '',
              residency: 'Customer Residency',
              status: rawOrder.status,
              paymentStatus: rawOrder.paymentStatus,
              items: (() => {
                let parsed = [];
                try {
                  if (rawOrder.items && rawOrder.items !== 'null') {
                    parsed = JSON.parse(rawOrder.items);
                  }
                } catch (e) {
                  console.error("Failed to parse items:", e);
                }
                return Array.isArray(parsed) ? parsed.map(item => ({
                  name: item.name,
                  sub: item.type || 'Standard Treatment',
                  types: item.types || (item.type ? [{ id: 'legacy', name: item.type, price: 0 }] : []),
                  qty: item.qty,
                  price: item.price,
                  total: item.price * item.qty,
                  addons: item.addons || [],
                  description: item.description || '',
                  category: item.category || 'Standard',
                  serviceId: item.serviceId || null,
                  deliveryMethod: item.deliveryMethod || 'Hanger'
                })) : [];
              })(),
              subtotal: subtotal,
              tax: rawOrder.totalAmount - subtotal,
              total: rawOrder.totalAmount,
              paidAmount: paidAmount,
              previousBalance: previousBalance,
              totalBalance: totalBalance,
              expectedDeliveryDate: (() => {
                const rawDate = rawOrder.expectedDeliveryDate || '';
                if (rawDate.includes(' ')) {
                  const [datePart, timePart] = rawDate.split(' ');
                  return `${formatDate(datePart)} ${timePart}`;
                }
                return rawDate ? formatDate(rawDate) : '';
              })(),
              specialInstructions: rawOrder.specialInstructions || ''
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
        id: id,
        billNumber: `BN-${Date.now().toString().slice(-6)}`,
        date: 'Oct 24, 2023, 10:00 AM',
        createdAt: new Date().toISOString(),
        customer: 'Eleanor Shellstrop',
        customerPhone: '+971501234567',
        residency: '"The Good Place" Residency',
        status: 'PAID',
        paymentStatus: 'Paid',
        items: [
          { name: 'Premium Suit Dry Clean', sub: 'Professional grade chemical cleaning & steaming', qty: 2, price: 25.00, total: 50.00, deliveryMethod: 'Hanger' },
          { name: 'Egyptian Cotton Shirts', sub: 'Gentle wash, starch, and custom pressing', qty: 5, price: 8.00, total: 40.00, deliveryMethod: 'Folded' },
          { name: 'Silk Scarf Special Care', sub: 'Delicate hand-wash with eco-solvent treatment', qty: 1, price: 15.00, total: 15.00, deliveryMethod: 'Bagged' },
        ],
        subtotal: 105.00,
        tax: 8.40,
        total: 113.40,
        paidAmount: 113.40,
        previousBalance: 0.00,
        totalBalance: 0.00,
        expectedDeliveryDate: '2026-06-02 17:00',
        specialInstructions: 'Handle with care'
      });
    };

    fetchOrder();
  }, [id, settings]);

  // Auto-print if query param is set
  useEffect(() => {
    if (order && searchParams.get('print') === 'true') {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [order, searchParams]);

  // Native Electron PDF — captures pre-rendered invoice HTML for perfect Arabic rendering
  const generatePDF = async () => {
    if (!window.electronAPI?.printToPDF) {
      window.print();
      return true;
    }
    if (!invoiceRef.current) return false;

    setPdfLoading(true);
    try {
      const filename = `Invoice_${order.id.replace(/[#/\\:*?"<>|]/g, '')}.pdf`;

      // ── Collect all CSS from the document ──
      let css = '';
      for (const sheet of document.styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          css += rules.map(r => r.cssText).join('\n') + '\n';
        } catch (_) {
          // Cross-origin sheets (Google Fonts etc.) — skip silently
        }
      }

      // ── Get the fully-rendered invoice HTML ──
      const html = invoiceRef.current.outerHTML;

      const result = await window.electronAPI.printToPDF({ filename, html, css });
      return result.success;
    } catch (err) {
      console.error('PDF failed:', err);
      return false;
    } finally {
      setPdfLoading(false);
    }
  };

  const handleWhatsApp = async () => {
    // 1. Generate and download PDF
    const pdfSuccess = await generatePDF();

    // 2. Format WhatsApp Message
    const origPhone = order.customerPhone || '';
    const cleanPhone = origPhone.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    
    // Prepend country code if original phone doesn't start with '+'
    if (cleanPhone && !origPhone.trim().startsWith('+')) {
      const countryCode = settings.waCountryCode || '971';
      const cleanCountryCode = countryCode.replace(/\D/g, '');
      if (cleanCountryCode && !finalPhone.startsWith(cleanCountryCode)) {
        finalPhone = cleanCountryCode + finalPhone;
      }
    }

    const itemsSummary = order.items.map(item => `- ${item.qty} x ${item.name} (${settings.currencySymbol || 'AED'} ${item.total.toFixed(2)})`).join('%0A');
    let message = `*INVOICE RECEIVED* %0A%0AHello! Here is your bill for order *${order.id}*.%0A%0A*Items:*%0A${itemsSummary}%0A%0A*Total Amount: ${settings.currencySymbol || 'AED'} ${order.total.toFixed(2)}*`;
    
    if (order.expectedDeliveryDate) {
      message += `%0A%0A*Expected Delivery Date:* ${order.expectedDeliveryDate}`;
    }
    
    message += `%0A%0A_Your PDF invoice has been generated and downloaded. Please attach it here to share._`;
    
    if (order.dueAmount !== undefined && order.dueAmount > 0) {
      message += `%0A%0AFriendly reminder: Your pending balance is ${settings.currencySymbol || 'AED'} ${order.dueAmount.toFixed(2)}.`;
    }

    const url = `https://wa.me/${finalPhone}?text=${message}`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handlePrintTags = () => {
    document.body.classList.add('printing-tags');
    setIsPrintingTags(true);
    setTimeout(() => {
      window.print();
      setIsPrintingTags(false);
      document.body.classList.remove('printing-tags');
    }, 500);
  };

  if (!order) return <div className={styles.loading}>Loading Invoice...</div>;

  return (
    <div className={styles.invoicePage}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </div>
        <div className={styles.topActions}>
          <button className={styles.closeBtn} onClick={() => navigate(-1)}>
            <X size={18} /> Close
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            New Order
          </button>
        </div>
      </div>

      <div ref={invoiceRef}>
        <InvoiceTemplate order={order} settings={settings} onOrderUpdate={(updated) => setOrder(updated)} />
      </div>

      <div className={styles.footerActions} style={{ maxWidth: '800px', margin: '0 auto 2rem auto', padding: '0 2rem' }}>
        <button className={styles.printBtn} onClick={() => window.print()}>
          <Printer size={20} /> Print Receipt
        </button>
        <button className={styles.printBtn} onClick={handlePrintTags}>
          <Tag size={20} /> Print Garment Tags
        </button>
        <button className={styles.pdfBtn} onClick={generatePDF} disabled={pdfLoading}>
          <FileText size={20} /> {pdfLoading ? 'Generating...' : 'Download PDF'}
        </button>
        <button className={styles.waBtn} onClick={handleWhatsApp}>
          <Send size={20} /> Send via WhatsApp
        </button>
      </div>

      {/* Hidden Tag Printing Area */}
      {isPrintingTags && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'white', zIndex: 99999 }}>
          <DressTag order={order} />
        </div>
      )}
    </div>
  );
}
