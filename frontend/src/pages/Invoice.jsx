import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, Printer, Send, FileText, Tag, RefreshCw, AlertCircle } from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import InvoiceTemplate from '../components/InvoiceTemplate';
import DressTag from '../components/DressTag';
import { getLocalDateTime } from '../utils/dateUtils';
import styles from './Invoice.module.css';
import rawInvoiceCss from './Invoice.module.css?inline';
import { paymentService } from '../services/paymentService';

export default function Invoice() {
  const electronAPI = window.electronAPI || window.parent?.electronAPI;
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings, formatDate, originalSettings } = useSettings();
  const [order, setOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isPrintingTags, setIsPrintingTags] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfToast, setPdfToast] = useState(null);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const invoiceRef = React.useRef();

  useEffect(() => {
    if (pdfToast) {
      const timer = setTimeout(() => {
        setPdfToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pdfToast]);

  useEffect(() => {
    console.log("Invoice component mounted: id =", id, "download =", searchParams.get('download'), "origin =", window.location.origin);
  }, [id, searchParams]);

  const getDaysPending = (dateStr) => {
    if (!dateStr) return 0;
    const created = new Date(dateStr);
    const diffTime = Math.abs(new Date() - created);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  useEffect(() => {
    const fetchOrder = async () => {
      console.log("Invoice page fetchOrder starting. ID =", id, "electronAPI =", !!electronAPI);
      if (electronAPI?.dbQuery) {
        try {
          // Try multiple ID formats for robustness
          const idVariations = [
            id,
            `#${id}`,
            id.startsWith('#') ? id.substring(1) : `#${id}`,
            id.replace('#', '').replace('AG-', ''),
            id.replace('#', '').replace(settings.invoicePrefix || '', '')
          ];
          console.log("ID Variations to query:", idVariations);
          let rawOrder = null;
          for (const variant of idVariations) {
            const res = await electronAPI.dbQuery(
              `SELECT orders.*, customers.name as customerName, customers.phone as customerPhone,
                      payment_links.date AS nomodLinkDate
               FROM orders 
               LEFT JOIN customers ON orders.customerId = customers.id 
               LEFT JOIN payment_links ON orders.nomodCheckoutId = payment_links.checkoutId
               WHERE orders.id = ?`,
              [variant]
            );
            const rows = res.results || res.data || [];
            if (res && res.success && rows.length > 0) {
              rawOrder = rows[0];
              break;
            }
          }

          if (rawOrder) {
            let items = [];
            let history = [];
            let payBreakdown = null;

            try {
              items = typeof rawOrder.items === 'string' ? JSON.parse(rawOrder.items || '[]') : (rawOrder.items || []);
            } catch (e) {
              console.error("JSON parse items error:", e);
            }
            try {
              history = typeof rawOrder.statusHistory === 'string' ? JSON.parse(rawOrder.statusHistory || '[]') : (rawOrder.statusHistory || []);
            } catch (e) {
              console.error("JSON parse history error:", e);
            }
            try {
              payBreakdown = typeof rawOrder.paymentBreakdown === 'string' ? JSON.parse(rawOrder.paymentBreakdown || 'null') : rawOrder.paymentBreakdown;
            } catch (e) {
              console.error("JSON parse paymentBreakdown error:", e);
            }

            let customerBalance = 0;
            if (rawOrder.customerId && rawOrder.customerId !== 'Walk-in') {
              const custRes = await electronAPI.dbQuery('SELECT balance FROM customers WHERE id = ?', [rawOrder.customerId]);
              const custRows = custRes.results || custRes.data || [];
              if (custRes.success && custRows.length > 0) {
                customerBalance = custRows[0].balance || 0;
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
            setErrorMsg(null);
          } else {
            console.log("No order found in database for variations, waiting for postMessage data...");
            setErrorMsg(`Order ID "${id}" was not found in the local database. Variations searched: ${idVariations.join(', ')}`);
          }
        } catch (err) {
          console.error("Database query failed, waiting for postMessage data...", err);
          setErrorMsg(`Database query failed: ${err.message}`);
        }
      } else {
        console.log("No electronAPI.dbQuery, waiting for postMessage data...");
        setErrorMsg("Electron database access (window.electronAPI) is not available. Please ensure the app is running inside Electron.");
      }
    };

    fetchOrder();

    const handlePostMessageData = (event) => {
      if (event.data && event.data.type === 'load-invoice-data') {
        console.log("Invoice page received postMessage data:", event.data.orderData);
        setOrder(event.data.orderData);
      }
    };
    window.addEventListener('message', handlePostMessageData);

    const unsubscribe = paymentService.subscribe(({ orderId, status }) => {
      const cleanOrderId = orderId ? orderId.replace('#', '') : '';
      const cleanId = id ? id.replace('#', '') : '';
      if (cleanOrderId === cleanId) {
        fetchOrder();
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('message', handlePostMessageData);
    };
  }, [id, settings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!order) {
        console.warn("Invoice data loading timed out.");
        setErrorMsg("Order details could not be loaded. Please ensure the order exists.");
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [order]);

  // ── Build a self-contained thermal receipt HTML from order data ──
  const buildReceiptHtml = (ord, stg) => {
    const sym = stg.currencySymbol || 'AED';
    const taxRate = stg.isTaxEnabled ? (stg.taxRate || 0) / 100 : 0;
    const total = ord.total || 0;
    const subtotal = taxRate > 0 ? total / (1 + taxRate) : total;
    const tax = total - subtotal;
    const bi = stg.showBilingual !== false;
    const logoSrc = stg.logo || '';

    const row = (label, value, bold = false) => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin:2px 0;${bold ? 'font-weight:900;font-size:13px;border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 0;' : ''}">
        <span>${label}</span>
        <span>${value}</span>
      </div>`;

    const dash = `<div style="border-top:1px dashed #000;margin:6px 0;"></div>`;

    const itemsHtml = (ord.items || []).map(item => {
      const lineTotal = ((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)).toFixed(2);
      const delivery = item.deliveryMethod ? `<div style="font-size:11px;">${item.deliveryMethod}${bi && item.deliveryMethod === 'Hanger' ? ' / علاقة' : item.deliveryMethod === 'Folded' ? ' / مطوي' : item.deliveryMethod === 'Bagged' ? ' / مكيس' : ''}</div>` : '';
      const types = (item.types && item.types.length > 0 ? item.types.map(t => t.name).join(', ') : item.sub) || '';
      return `
        <div style="margin:4px 0;padding-bottom:4px;border-bottom:1px dotted #ccc;">
          <div style="font-weight:700;font-size:13px;">${item.name}</div>
          ${types ? `<div style="font-size:11px;color:#000;">${types}</div>` : ''}
          ${delivery}
          <div style="display:flex;justify-content:space-between;font-size:12px;">
            <span>Qty: ${item.qty} &times; ${(parseFloat(item.price) || 0).toFixed(2)}</span>
            <span>${sym} ${lineTotal}</span>
          </div>
        </div>`;
    }).join('');

    const advanceDeducted = (ord.previousBalance || 0) < 0
      ? Math.min(total, Math.abs(ord.previousBalance)) : 0;
    const manualPaid = Math.max(0, (ord.paidAmount || 0) - advanceDeducted);

    return `
      <div style="font-family:'Courier New',Courier,monospace;font-size:12px;color:#000;background:#fff;width:100%;max-width:80mm;margin:0;padding:8px;">
        ${logoSrc ? `<div style="text-align:center;margin-bottom:4px;"><img src="${logoSrc}" style="max-height:50px;max-width:60mm;" /></div>` : ''}
        <div style="text-align:center;font-size:15px;font-weight:900;">${stg.companyName || 'Laundry Box'}</div>
        ${bi && stg.companyNameAr ? `<div style="text-align:center;font-size:13px;direction:rtl;">${stg.companyNameAr}</div>` : ''}
        ${stg.address ? `<div style="text-align:center;font-size:11px;">${stg.address}</div>` : ''}
        ${stg.phone ? `<div style="text-align:center;font-size:11px;">Tel: ${stg.phone}</div>` : ''}
        ${dash}
        <div style="margin:2px 0;"><span style="font-size:11px;">Invoice No${bi ? ' / رقم الفاتورة' : ''}:</span> <b>${stg.invoicePrefix || ''}${ord.id}</b></div>
        <div style="margin:2px 0;"><span style="font-size:11px;">Date${bi ? ' / التاريخ' : ''}:</span> ${ord.date || ''}</div>
        ${ord.expectedDeliveryDate ? `<div style="margin:2px 0;"><span style="font-size:11px;">Exp. Delivery${bi ? ' / تاريخ التسليم المتوقع' : ''}:</span> <b>${ord.expectedDeliveryDate}</b></div>` : ''}
        ${dash}
        <div style="margin:2px 0;"><span style="font-size:11px;">Name${bi ? ' / الاسم' : ''}:</span> <b>${ord.customer || ''}</b></div>
        ${ord.customerPhone ? `<div style="margin:2px 0;"><span style="font-size:11px;">Phone${bi ? ' / الهاتف' : ''}:</span> ${ord.customerPhone}</div>` : ''}
        ${dash}
        ${itemsHtml}
        ${dash}
        ${row(`Subtotal${bi ? ' / قبل الضريبة' : ''}`, `${sym} ${subtotal.toFixed(2)}`)}
        ${stg.isTaxEnabled ? row(`VAT (${stg.taxRate || 0}%)${bi ? ' / الضريبة' : ''}`, `${sym} ${tax.toFixed(2)}`) : ''}
        ${row(`TOTAL${bi ? ' / الإجمالي' : ''}`, `${sym} ${total.toFixed(2)}`, true)}
        ${dash}
        ${manualPaid > 0 ? row(`Paid${bi ? ' / المدفوع' : ''}`, `${sym} ${manualPaid.toFixed(2)}`) : ''}
        ${(ord.previousBalance || 0) < 0 ? row(`Advance Available${bi ? ' / رصيد مسبق' : ''}`, `${sym} ${Math.abs(ord.previousBalance).toFixed(2)}`) : ''}
        ${advanceDeducted > 0 ? row(`Advance Deducted${bi ? ' / الرصيد المخصوم' : ''}`, `- ${sym} ${advanceDeducted.toFixed(2)}`) : ''}
        ${row(`Balance${bi ? ' / الرصيد' : ''}`, `${sym} ${(ord.totalBalance || 0).toFixed(2)}`, true)}
        ${stg.invoiceTermsText ? `${dash}<div style="font-size:10px;text-align:center;">${stg.invoiceTermsText}</div>` : ''}
        <div style="text-align:center;font-size:10px;margin-top:8px;">Thank you!</div>
      </div>`;
  };

  // ── Build a self-contained garment tag HTML from order data ──
  const buildTagHtml = (ord, stg) => {
    if (!ord || !ord.items) return '';
    const tags = [];
    const items = typeof ord.items === 'string' ? JSON.parse(ord.items) : ord.items;

    items.forEach(item => {
      for (let i = 0; i < item.qty; i++) {
        tags.push({
          ...item,
          tagIndex: i + 1,
          totalInGroup: item.qty
        });
      }
    });

    const prefix = stg?.invoicePrefix || '';
    const formattedDate = formatDate(ord.createdAt);

    return `
      <div style="font-family:'Inter', sans-serif; background:white; color:black; width:100%; max-width:80mm; margin:0; padding:8px;">
        ${tags.map((tag, idx) => `
          <div style="border:1px dashed #000; padding:8px; display:flex; flex-direction:column; width:100%; height:140px; margin-bottom:10px; page-break-inside:avoid; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #000; padding-bottom:4px; margin-bottom:6px;">
              <span style="font-weight:800; font-size:14px;">${prefix}${ord.id}</span>
              <span style="font-size:12px; font-weight:600; color:#64748b;">${tag.tagIndex}/${tag.totalInGroup}</span>
            </div>
            
            <div style="display:flex; gap:10px; flex:1; align-items:center;">
              <div style="min-width:0; flex:1;">
                <h3 style="margin:0; font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tag.name}</h3>
                <p style="margin:2px 0 0 0; font-size:11px; color:#475569; text-transform:uppercase;">${tag.type || ''}</p>
                ${tag.deliveryMethod ? `
                  <p style="font-weight:bold; color:#16A34A; font-size:11px; margin:2px 0 0 0;">
                    📦 ${tag.deliveryMethod}
                  </p>
                ` : ''}
                <p style="margin:4px 0 0 0; font-size:12px; font-weight:600; color:#1e293b;">${ord.customer || ''}</p>
              </div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:auto; font-size:10px; color:#64748b; border-top:1px dotted #ccc; padding-top:4px;">
              <span>${formattedDate}</span>
              ${tag.addons && tag.addons.length > 0 ? `
                <span style="font-size:9px; font-style:italic; max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">+ ${tag.addons.join(', ')}</span>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  const executeNativePrint = async (forceSilent = null, printerType = 'billing') => {
    if (electronAPI?.printInvoice && order) {
      const printerName = printerType === 'tag' ? settings.tagPrinter : settings.billingPrinter;

      if (!printerName) {
        alert(printerType === 'tag'
          ? "No default tag printer selected. Configure it in Settings → Printers."
          : "No default printer selected. Configure it in Settings → Printers."
        );
        return;
      }

      let html = '';
      if (printerType === 'tag') {
        html = buildTagHtml(order, settings);
      } else {
        const area = document.getElementById('printable-invoice-area');
        html = area ? area.innerHTML : buildReceiptHtml(order, settings);
      }

      // Convert relative asset paths to absolute URLs so Electron print window can load them
      const origin = window.location.origin;
      html = html.replace(/src="\/src\/assets\//g, `src="${origin}/src/assets/`);
      html = html.replace(/src="\/assets\//g, `src="${origin}/assets/`);

      const printSize = settings.receiptPrintSize || 'auto';
      let pageSizeRule = '';
      let pageSizeArg = 'A5';
      if (printerType === 'tag') {
        pageSizeRule = 'size: 80mm auto;';
        pageSizeArg = { width: 80000, height: 200000 };
      } else if (printSize === 'thermal') {
        pageSizeRule = 'size: 80mm auto;';
        pageSizeArg = { width: 80000, height: 200000 };
      } else if (printSize === 'A5') {
        pageSizeRule = 'size: A5;';
        pageSizeArg = 'A5';
      } else if (printSize === 'A4') {
        pageSizeRule = 'size: A4;';
        pageSizeArg = 'A4';
      } else {
        const isCompactTemplate = ['compact', 'compact 2'].includes(settings.invoiceTemplate);
        pageSizeRule = isCompactTemplate ? 'size: 80mm auto;' : 'size: A5;';
        pageSizeArg = isCompactTemplate ? { width: 80000, height: 200000 } : 'A5';
      }
      const pageMargin = printerType === 'tag' ? '0' : '2mm';

      const res = await electronAPI.printInvoice({
        html,
        css: `
          ${rawInvoiceCss || ''}
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0; padding: 0; background: white; }
          @page { margin: ${pageMargin}; ${pageSizeRule} }
        `,
        printerName,
        silent: settings.silentPrinting !== false,
        pageSize: pageSizeArg
      });

      if (res && !res.success) {
        alert("Printing failed: " + (res.error || "Printer is offline or unavailable."));
      }

    } else if (window.appPrint) {
      await window.appPrint({
        printerName: printerType === 'tag' ? settings.tagPrinter : settings.billingPrinter,
        silent: true,
        printerType
      });
    } else {
      window.print();
    }
  };



  // Auto-print or Auto-download if query param is set
  useEffect(() => {
    if (!settings) return; // Wait until settings are loaded from DB
    const shouldPrint = searchParams.get('print') === 'force' || (searchParams.get('print') === 'true' && settings.autoPrint);
    const shouldDownload = searchParams.get('download') === 'force';
    if (order) {
      if (shouldPrint) {
        const timer = setTimeout(() => {
          executeNativePrint();
        }, 800);
        return () => clearTimeout(timer);
      } else if (shouldDownload) {
        const timer = setTimeout(() => {
          generatePDF();
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [order, searchParams, settings]);

  // Native Electron PDF — captures pre-rendered invoice HTML for perfect Arabic rendering
  const generatePDF = async (overridePageSize = null) => {
    const selectedSize = overridePageSize || settings.pdfPageSize || 'A5';
    console.log("generatePDF triggered inside Invoice.jsx! order =", order?.id, "selectedSize =", selectedSize);
    if (!electronAPI?.printToPDF) {
      executeNativePrint(false);
      return true;
    }
    if (!invoiceRef.current) return false;

    setPdfLoading(true);
    try {
      const isSilent = searchParams.get('download') === 'force';
      const filename = `Invoice_${order.id.replace(/[#/\\:*?"<>|]/g, '')}.pdf`;

      // ── Collect all CSS from the document ──
      let css = '';
      document.querySelectorAll('style').forEach(styleTag => {
        css += styleTag.innerHTML + '\n';
      });
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

      const result = await electronAPI.printToPDF({
        filename,
        html,
        css,
        pdfDownloadPath: settings.pdfDownloadPath || '',
        origin: window.location.origin,
        pageSize: selectedSize
      });
      if (result && result.success) {
        if (isSilent) {
          window.parent?.postMessage({ type: 'pdf-downloaded', filePath: result.filePath }, '*');
        } else {
          setPdfToast({ success: true, message: `Saved to Downloads: ${filename}` });
        }
      } else {
        if (isSilent) {
          window.parent?.postMessage({ type: 'pdf-error', error: result?.error || 'PDF saving failed' }, '*');
        } else {
          setPdfToast({ success: false, message: result?.error || 'Unknown error' });
        }
      }
      return result && result.success;
    } catch (err) {
      console.error('PDF failed:', err);
      if (isSilent) {
        window.parent?.postMessage({ type: 'pdf-error', error: err.message }, '*');
      } else {
        setPdfToast({ success: false, message: err.message });
      }
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
      if (electronAPI?.dbQuery) {
        try {
          const searchRes = await electronAPI.dbQuery(
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
                const checkoutRes = await electronAPI.createNomodCheckout({
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
                  await electronAPI.dbQuery(
                    `UPDATE orders SET nomodCheckoutId = ?, nomodPaymentLink = ?, nomodPaymentStatus = 'Pending', isSynced = 0, updatedAt = ? 
                     WHERE id = ?`,
                    [checkoutIdVal, url, new Date().toISOString(), order.id]
                  );
                } else {
                  const errorMsg = checkoutRes?.error || 'Unknown error';
                  console.warn("Nomod Backend API failed in Invoice handleWhatsApp:", errorMsg);
                  if (settings.nomodEnv === 'live') {
                    alert("Nomod Checkout API connection failed: " + errorMsg + ". Please check your API key configuration in settings.");
                    return; // Stop flow
                  }
                }
              } catch (apiErr) {
                console.warn("Nomod API failure in Invoice.jsx handleWhatsApp:", apiErr.message);
                if (settings.nomodEnv === 'live') {
                  alert("Nomod Checkout API failure: " + apiErr.message);
                  return;
                }
              }
              if (!url) {
                if (settings.nomodEnv === 'live') {
                  return;
                }
                url = `https://link.nomod.com/pay?account=${settings.nomodMerchantId || 'default'}&amount=${due}&reference=${linkId}`;
              }
            } else {
              const paymentBase = (settings.paymentBaseUrl || 'https://pay.laundry.ae').replace(/\/$/, '');
              url = `${paymentBase}/lnk/${linkId.toLowerCase()}`;
            }

            const dateStr = getLocalDateTime();
            await electronAPI.dbQuery(
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
        const paymentBase = (settings.paymentBaseUrl || 'https://pay.laundry.ae').replace(/\/$/, '');
        paymentLinkUrl = `${paymentBase}/lnk/lnk-${(order.billNumber || 'mock').toLowerCase()}`;
      }

      if (paymentLinkUrl) {
        const template = settings.waNomodPaymentTemplate || `*PAYMENT REQUEST - {shopName}*\n\nDear {customerName},\n\nHere is your payment link for Order #{orderId} totaling *{total}*.\n\n*Total Due:* {dueAmount}\n*Pay Securely Online:* {paymentLink}\n\nThank you for choosing {shopName}!`;
        message = template
          .replace(/{customerName}/g, order.customer || 'Customer')
          .replace(/{orderId}/g, order.id)
          .replace(/{total}/g, `${settings.currencySymbol || 'AED'} ${order.total.toFixed(2)}`)
          .replace(/{dueAmount}/g, `${settings.currencySymbol || 'AED'} ${due.toFixed(2)}`)
          .replace(/{paymentLink}/g, paymentLinkUrl)
          .replace(/{shopName}/g, settings.shopName || 'Laundry Box');
      }
    }

    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
    if (electronAPI?.openExternal) {
      electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handlePrintTags = () => {
    document.body.classList.add('printing-tags');
    setIsPrintingTags(true);
    setTimeout(async () => {
      await executeNativePrint(null, 'tag');
      setIsPrintingTags(false);
      document.body.classList.remove('printing-tags');
    }, 500);
  };

  if (errorMsg) {
    return (
      <div className={styles.invoicePage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <h2 style={{ color: '#DC2626' }}>Loading Failed</h2>
        <p style={{ color: '#64748B' }}>{errorMsg}</p>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

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
          <button className={styles.printBtn} style={{ height: '36px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid var(--primary)' }} onClick={() => executeNativePrint()}>
            <Printer size={16} /> Print Receipt
          </button>
          <button className={styles.printBtn} style={{ height: '36px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid var(--primary)' }} onClick={handlePrintTags}>
            <Tag size={16} /> Print Garment Tags
          </button>
          <div style={{ position: 'relative' }}>
            <button className={styles.pdfBtn} style={{ height: '36px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid var(--secondary)', background: 'white', color: 'var(--secondary)' }} onClick={() => setShowFormatDropdown(!showFormatDropdown)} disabled={pdfLoading}>
              <FileText size={16} /> {pdfLoading ? 'Generating...' : 'Download PDF'}
            </button>
            {showFormatDropdown && (
              <div style={{
                position: 'absolute',
                top: '42px',
                right: '0',
                zIndex: 1000,
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                padding: '0.5rem 0',
                minWidth: '220px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ padding: '0.5rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #F1F5F9', marginBottom: '0.35rem' }}>
                  Choose PDF Layout
                </div>
                {[
                  { value: 'A4', label: 'A4 (Standard Document)' },
                  { value: 'A5', label: 'A5 (Half-Page Receipt)' },
                  { value: 'A6', label: 'A6 (Small Slip)' },
                  { value: 'thermal', label: 'Thermal Roll (80mm)' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    style={{
                      padding: '0.6rem 1rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      fontSize: '0.85rem',
                      color: '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: (settings.pdfPageSize || 'A5') === opt.value ? 700 : 400
                    }}
                    onClick={() => {
                      setShowFormatDropdown(false);
                      generatePDF(opt.value);
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.target.style.background = 'none'}
                  >
                    <span>{opt.label}</span>
                    {(settings.pdfPageSize || 'A5') === opt.value && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--secondary)', fontWeight: 600 }}>[Default]</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.waBtn} style={{ height: '36px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid #25D366', background: 'white', color: '#25D366' }} onClick={handleWhatsApp}>
            <Send size={16} /> Send via WhatsApp
          </button>
        </div>
      </div>

      <div ref={invoiceRef} id="printable-invoice-area">
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
                  if (!electronAPI) return;
                  try {
                    if (order.nomodCheckoutId) {
                      await electronAPI.dbQuery(
                        "UPDATE payment_links SET status = 'Expired' WHERE checkoutId = ?",
                        [order.nomodCheckoutId]
                      );
                      paymentService.stopTracking(order.id);
                    }

                    const linkId = `LNK-${order.billNumber || Date.now().toString().slice(-4)}-${Date.now().toString().slice(-3)}`;
                    const due = order.dueAmount ?? (order.totalAmount - (order.paidAmount || 0));

                    const checkoutRes = await electronAPI.createNomodCheckout({
                      amount: due,
                      currency: settings.nomodCurrency || 'AED',
                      customer: { name: order.customerName || order.customer, phone: order.customerPhone },
                      orderId: order.id
                    });

                    if (checkoutRes.success && checkoutRes.data) {
                      const newUrl = checkoutRes.data.url;
                      const newCheckoutId = checkoutRes.data.id || linkId;

                      const dateStr = getLocalDateTime();
                      await electronAPI.dbQuery(
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

                      await electronAPI.dbQuery(
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
        <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '80mm', opacity: 0 }}>
          <DressTag order={order} />
        </div>
      )}

      {pdfToast && (
        <>
          <style>{`
            @keyframes toastSlideIn {
              0% { transform: translateX(120%) scale(0.9); opacity: 0; }
              70% { transform: translateX(-10px) scale(1.02); opacity: 1; }
              100% { transform: translateX(0) scale(1); opacity: 1; }
            }
            @keyframes toastProgress {
              0% { width: 100%; }
              100% { width: 0%; }
            }
            .premium-toast {
              position: fixed;
              top: 24px;
              right: 24px;
              background: rgba(15, 23, 42, 0.95);
              backdrop-filter: blur(8px);
              color: white;
              padding: 1rem 1.5rem;
              border-radius: 12px;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
              display: flex;
              align-items: center;
              gap: 16px;
              z-index: 999999;
              font-family: 'Inter', sans-serif;
              max-width: 400px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-left: 5px solid ${pdfToast.success ? '#10B981' : '#EF4444'};
              animation: toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              overflow: hidden;
            }
            .premium-toast-progress {
              position: absolute;
              bottom: 0;
              left: 0;
              height: 3px;
              background: ${pdfToast.success ? '#10B981' : '#EF4444'};
              animation: toastProgress 3s linear forwards;
            }
          `}</style>
          <div className="premium-toast">
            {pdfToast.success ? (
              <svg style={{ width: '22px', height: '22px', color: '#10B981', flexShrink: 0, fill: 'none', stroke: 'currentColor', strokeWidth: '2' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg style={{ width: '22px', height: '22px', color: '#EF4444', flexShrink: 0, fill: 'none', stroke: 'currentColor', strokeWidth: '2' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.01em' }}>
                {pdfToast.success ? 'Invoice PDF Saved' : 'Download Failed'}
              </span>
              <span style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '2px', wordBreak: 'break-all', fontWeight: 400 }}>
                {pdfToast.message}
              </span>
            </div>
            <div className="premium-toast-progress" />
          </div>
        </>
      )}
    </div>
  );
}
