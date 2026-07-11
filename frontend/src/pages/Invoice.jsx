import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, Printer, Send, FileText, Tag, RefreshCw, AlertCircle } from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import InvoiceTemplate from '../components/InvoiceTemplate';
import DressTag from '../components/DressTag';
import { getLocalDateTime } from '../utils/dateUtils';
import styles from './Invoice.module.css';
import { paymentService } from '../services/paymentService';

export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings, formatDate } = useSettings();
  const [order, setOrder] = useState(null);
  const [isPrintingTags, setIsPrintingTags] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const invoiceRef = React.useRef();

  const getDaysPending = (dateStr) => {
    if (!dateStr) return 0;
    const created = new Date(dateStr);
    const diffTime = Math.abs(new Date() - created);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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
              `SELECT orders.*, customers.name as customerName, customers.phone as customerPhone,
                      payment_links.date AS nomodLinkDate
               FROM orders 
               LEFT JOIN customers ON orders.customerId = customers.id 
               LEFT JOIN payment_links ON orders.nomodCheckoutId = payment_links.checkoutId
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

            let parsedBreakdown = null;
            try {
              if (rawOrder.paymentBreakdown && rawOrder.paymentBreakdown !== 'null') {
                parsedBreakdown = typeof rawOrder.paymentBreakdown === 'string'
                  ? JSON.parse(rawOrder.paymentBreakdown)
                  : rawOrder.paymentBreakdown;
              }
            } catch (e) {
              console.error("Failed to parse paymentBreakdown:", e);
            }

            let totalBalance = 0;
            let previousBalance = 0;

            if (rawOrder.customerId && rawOrder.customerId !== 'Walk-in') {
              totalBalance = customerBalance;
              
              let totalPaidManual = paidAmount;
              if (parsedBreakdown) {
                totalPaidManual = (parseFloat(parsedBreakdown.cash) || 0) +
                                  (parseFloat(parsedBreakdown.card) || 0) +
                                  (parseFloat(parsedBreakdown.upi) || 0) +
                                  (parseFloat(parsedBreakdown.bank) || 0) +
                                  (parseFloat(parsedBreakdown.nomod) || 0);
              }
              const balanceDiff = rawOrder.totalAmount - totalPaidManual;
              previousBalance = totalBalance - balanceDiff;
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
              } catch (e) {
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
              paymentMethod: rawOrder.paymentMethod,
              paymentBreakdown: parsedBreakdown,
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

    const unsubscribe = paymentService.subscribe(({ orderId, status }) => {
      if (orderId === id || orderId === id.replace('#', '') || (order && orderId === order.id)) {
        fetchOrder();
      }
    });

    return () => unsubscribe();
  }, [id, settings, order]);

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
      const clone = invoiceRef.current.cloneNode(true);
      const images = clone.getElementsByTagName('img');
      const originalImages = invoiceRef.current.getElementsByTagName('img');
      for (let i = 0; i < images.length; i++) {
        if (originalImages[i].src) {
          images[i].src = originalImages[i].src; // Force absolute URL
        }
      }
      const html = clone.outerHTML;

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

    const itemsSummaryNormal = order.items.map(item => `- ${item.qty} x ${item.name} (${settings.currencySymbol || 'AED'} ${item.total.toFixed(2)})`).join('\n');
    const due = order.dueAmount ?? (order.total - (order.paidAmount || 0));

    let message = '';
    if (settings.waInvoiceShareTemplate) {
      message = settings.waInvoiceShareTemplate
        .replace(/{customerName}/g, order.customer || 'Customer')
        .replace(/{orderId}/g, order.id)
        .replace(/{itemsSummary}/g, itemsSummaryNormal)
        .replace(/{total}/g, `${settings.currencySymbol || 'AED'} ${order.total.toFixed(2)}`)
        .replace(/{dueAmount}/g, `${settings.currencySymbol || 'AED'} ${due.toFixed(2)}`)
        .replace(/{deliveryDate}/g, order.expectedDeliveryDate || '');
    } else {
      message = `*INVOICE RECEIVED*\n\nHello! Here is your bill for order *${order.id}*.\n\n*Items:*\n${itemsSummaryNormal}\n\n*Total Amount: ${settings.currencySymbol || 'AED'} ${order.total.toFixed(2)}*`;
      if (order.expectedDeliveryDate) {
        message += `\n\n*Expected Delivery Date:* ${order.expectedDeliveryDate}`;
      }
      message += `\n\n_Your PDF invoice has been generated and downloaded. Please attach it here to share._`;
      if (due > 0) {
        message += `\n\nFriendly reminder: Your pending balance is ${settings.currencySymbol || 'AED'} ${due.toFixed(2)}.`;
      }
    }

    if (due > 0 && settings.enablePaymentLinks !== false && settings.enableNomod) {
      // Auto generate / retrieve payment link
      let paymentLinkUrl = '';
      if (window.electronAPI?.dbQuery) {
        try {
          const searchRes = await window.electronAPI.dbQuery(
            `SELECT * FROM payment_links WHERE (description LIKE ? OR id = ?) AND status IN ('Active', 'Pending') LIMIT 1`,
            [`%${order.id}%`, `LNK-${order.billNumber}`]
          );
          if (searchRes.success && searchRes.data.length > 0) {
            paymentLinkUrl = searchRes.data[0].url;
          } else {
            const linkId = `LNK-${order.billNumber || Date.now().toString().slice(-4)}`;
            let url = '';
            let checkoutIdVal = linkId;
            
            if (settings.enableNomod) {
              try {
                const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
                const checkoutRes = await window.electronAPI.createNomodCheckout({
                  amount: due,
                  currency: settings.nomodCurrency || 'AED',
                  customer: {
                    name: order.customer || 'Customer',
                    phone: order.customerPhone || ''
                  },
                  orderId: order.id,
                  userRole: currentUser.role || 'staff'
                });
 
                if (checkoutRes.success && checkoutRes.data && checkoutRes.data.url) {
                  url = checkoutRes.data.url;
                  checkoutIdVal = checkoutRes.data.id || linkId;
                  await window.electronAPI.dbQuery(
                    `UPDATE orders SET nomodCheckoutId = ?, nomodPaymentLink = ?, nomodPaymentStatus = 'Pending', isSynced = 0, updatedAt = ? 
                     WHERE id = ?`,
                    [checkoutIdVal, url, new Date().toISOString(), order.id]
                  );
                } else if (checkoutRes.error) {
                  console.warn("Nomod Backend API failed in Invoice handleWhatsApp:", checkoutRes.error);
                }
              } catch (apiErr) {
                console.warn("Nomod API failure in Invoice.jsx handleWhatsApp:", apiErr.message);
              }
              if (!url) {
                url = `https://link.nomod.com/pay?account=${settings.nomodMerchantId || 'default'}&amount=${due}&reference=${linkId}`;
              }
            } else {
              url = `https://pay.lundry.ae/lnk/${linkId.toLowerCase()}`;
            }
 
            const dateStr = getLocalDateTime();
            await window.electronAPI.dbQuery(
              `INSERT INTO payment_links (id, customerId, customerName, description, amount, channel, date, status, url, checkoutId) 
               VALUES (?, ?, ?, ?, ?, 'Nomod', ?, 'Pending', ?, ?)`,
              [
                linkId,
                order.customerId || 'Walk-in',
                order.customer || 'Walk-in Customer',
                `Order #${order.billNumber || order.id}`,
                due,
                dateStr,
                url,
                checkoutIdVal
              ]
            );
            
            paymentService.startTracking(order.id, checkoutIdVal);
            paymentLinkUrl = url;
          }
        } catch (err) {
          console.error("Failed to query or create payment link in database:", err);
        }
      } else {
        paymentLinkUrl = `https://pay.lundry.ae/lnk/lnk-${(order.billNumber || 'mock').toLowerCase()}`;
      }

      if (paymentLinkUrl) {
        message += `\n\nPlease pay online using this link: ${paymentLinkUrl}`;
      }
    }

    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
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
          <button className={styles.printBtn} style={{ height: '36px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid var(--primary)' }} onClick={() => window.print()}>
            <Printer size={16} /> Print Receipt
          </button>
          <button className={styles.printBtn} style={{ height: '36px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid var(--primary)' }} onClick={handlePrintTags}>
            <Tag size={16} /> Print Garment Tags
          </button>
          <button className={styles.pdfBtn} style={{ height: '36px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid var(--secondary)', background: 'white', color: 'var(--secondary)' }} onClick={generatePDF} disabled={pdfLoading}>
            <FileText size={16} /> {pdfLoading ? 'Generating...' : 'Download PDF'}
          </button>
          <button className={styles.waBtn} style={{ height: '36px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid #25D366', background: 'white', color: '#25D366' }} onClick={handleWhatsApp}>
            <Send size={16} /> Send via WhatsApp
          </button>
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

      {order && order.nomodCheckoutId && (
        <div style={{ maxWidth: '800px', margin: '1rem auto', padding: '1rem 2rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
              Nomod Status: {order.nomodPaymentStatus}
            </span>
            {order.nomodPaymentStatus === 'Pending' && getDaysPending(order.nomodLinkDate) >= (settings.pendingPaymentWarningDays || 3) && (
              <span style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={14} /> Link Pending {getDaysPending(order.nomodLinkDate)} Days
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {order.nomodPaymentStatus === 'Pending' && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', fontSize: '0.85rem', fontWeight: 700 }}
                onClick={async () => {
                  const res = await paymentService.checkNow(order.id, order.nomodCheckoutId);
                  if (res.success) {
                    alert(`Nomod status is: ${res.status}`);
                  } else {
                    alert("Status check failed: " + res.error);
                  }
                }}
              >
                <RefreshCw size={14} /> Check Status
              </button>
            )}
            {(order.nomodPaymentStatus === 'Pending' || order.nomodPaymentStatus === 'Expired' || order.nomodPaymentStatus === 'Failed') && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', fontSize: '0.85rem', fontWeight: 700, background: '#EC4899', borderColor: '#EC4899' }}
                onClick={async () => {
                  if (!window.electronAPI) return;
                  try {
                    if (order.nomodCheckoutId) {
                      await window.electronAPI.dbQuery(
                        "UPDATE payment_links SET status = 'Expired' WHERE checkoutId = ?",
                        [order.nomodCheckoutId]
                      );
                      paymentService.stopTracking(order.id);
                    }

                    const linkId = `LNK-${order.billNumber || Date.now().toString().slice(-4)}-${Date.now().toString().slice(-3)}`;
                    const due = order.dueAmount ?? (order.totalAmount - (order.paidAmount || 0));

                    const checkoutRes = await window.electronAPI.createNomodCheckout({
                      amount: due,
                      currency: settings.nomodCurrency || 'AED',
                      customer: { name: order.customerName || order.customer, phone: order.customerPhone },
                      orderId: order.id
                    });

                    if (checkoutRes.success && checkoutRes.data) {
                      const newUrl = checkoutRes.data.url;
                      const newCheckoutId = checkoutRes.data.id || linkId;

                      const dateStr = getLocalDateTime();
                      await window.electronAPI.dbQuery(
                        `INSERT INTO payment_links (id, customerId, customerName, description, amount, channel, date, status, url, checkoutId) 
                         VALUES (?, ?, ?, ?, ?, 'Nomod', ?, 'Pending', ?, ?)`,
                        [
                          linkId,
                          order.customerId || 'Walk-in',
                          order.customerName || order.customer || 'Walk-in Customer',
                          `Order #${order.billNumber || order.id}`,
                          due,
                          dateStr,
                          newUrl,
                          newCheckoutId
                        ]
                      );

                      await window.electronAPI.dbQuery(
                        "UPDATE orders SET nomodCheckoutId = ?, nomodPaymentStatus = 'Pending', updatedAt = ? WHERE id = ?",
                        [newCheckoutId, new Date().toISOString(), order.id]
                      );

                      paymentService.startTracking(order.id, newCheckoutId);
                      alert("New Nomod payment link generated!");
                      window.location.reload();
                    } else {
                      alert("Failed to generate link: " + (checkoutRes.error || "Unknown error"));
                    }
                  } catch (err) {
                    alert("Error: " + err.message);
                  }
                }}
              >
                <Send size={14} /> Resend Link
              </button>
            )}
          </div>
        </div>
      )}


      {/* Hidden Tag Printing Area */}
      {isPrintingTags && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'white', zIndex: 99999 }}>
          <DressTag order={order} />
        </div>
      )}
    </div>
  );
}
