import { QRCodeSVG } from 'qrcode.react';
import { Activity, GripVertical, Pencil, Check, Plus, Trash2, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import CurrencySymbol from './CurrencySymbol';
import defaultLogo from '../assets/logo.png';
import styles from '../pages/Invoice.module.css';

// ── Inline editable cell ──────────────────────────────────────────
function EditableCell({ value, onChange, type = 'text', align = 'left', className, editing }) {
  if (!editing) {
    return <span className={className}>{value}</span>;
  }
  return (
    <input
      type={type}
      value={value}
      min={type === 'number' ? 0 : undefined}
      step={type === 'number' ? 'any' : undefined}
      onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        border: '1.5px solid #3B82F6',
        borderRadius: 6,
        padding: '0.2rem 0.4rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        outline: 'none',
        background: '#EFF6FF',
        textAlign: align,
        minWidth: type === 'number' ? 60 : 80,
        boxSizing: 'border-box',
      }}
    />
  );
}

export default function InvoiceTemplate({ order, settings, isPreview = false, onOrderUpdate }) {
  if (!order) return null;

  // ── Edit mode ──
  const [editMode, setEditMode] = useState(false);

  // ── Items state (drag + edit) ──
  const [items, setItems] = useState(order.items || []);
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Sync items when order prop changes
  useEffect(() => {
    setItems(order.items || []);
  }, [order.items, order.id]);

  // ── Computed totals from items ──
  const itemsTotal = items.reduce((s, i) => s + ((parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0)), 0);
  const taxRate = settings.isTaxEnabled ? (settings.taxRate || 0) / 100 : 0;

  let computedSubtotal = 0;
  let computedTax = 0;
  let computedTotal = 0;
  let computedDiscount = 0;

  if (!editMode && order.total !== undefined) {
    computedTotal = order.total;
    computedSubtotal = computedTotal / (1 + taxRate);
    computedTax = computedTotal - computedSubtotal;
    if (settings.taxMethod === 'exclusive') {
      computedDiscount = itemsTotal - computedSubtotal;
    } else {
      computedDiscount = itemsTotal - computedTotal;
    }
  } else {
    // In edit mode or fallback when order.total is not defined
    if (settings.taxMethod === 'exclusive') {
      computedSubtotal = itemsTotal;
      computedTax = itemsTotal * taxRate;
      computedTotal = itemsTotal + computedTax;
      computedDiscount = 0;
    } else {
      computedTotal = itemsTotal;
      computedSubtotal = computedTotal / (1 + taxRate);
      computedTax = computedTotal - computedSubtotal;
      computedDiscount = 0;
    }
  }

  const advanceDeducted = (order.previousBalance || 0) < 0 ? Math.min(computedTotal, Math.abs(order.previousBalance)) : 0;
  const manualPaid = Math.max(0, (order.paidAmount || 0) - advanceDeducted);

  // ── Item edit helpers ──
  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      const qtyNum = parseFloat(next[idx].qty) || 0;
      const priceNum = parseFloat(next[idx].price) || 0;
      next[idx].total = qtyNum * priceNum;
      return next;
    });
  };

  const deleteItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { name: 'New Item', sub: 'Standard', qty: 1, price: 0, total: 0 }
    ]);
  };

  // ── Save manual edits to SQLite ──
  const handleSaveEdits = async () => {
    setEditMode(false);

    // Check if items changed
    const itemsChanged = JSON.stringify(items) !== JSON.stringify(order.items || []);
    if (!itemsChanged) return;

    if (window.electronAPI?.dbQuery) {
      try {
        const timestamp = new Date().toISOString();
        const oldTotal = order.total || 0;
        const newTotal = computedTotal;
        const diff = newTotal - oldTotal;

        const savedItems = items.map(item => {
          const { sub, ...rest } = item;
          return {
            ...rest,
            qty: parseFloat(item.qty) || 0,
            price: parseFloat(item.price) || 0,
            type: sub || item.type || 'Standard Treatment',
            types: item.types || (sub ? [{ id: 'legacy', name: sub, price: 0 }] : [])
          };
        });

        // 1. Update order in SQLite
        await window.electronAPI.dbQuery(
          `UPDATE orders 
           SET items = ?, totalAmount = ?, dueAmount = MAX(0, totalAmount - paidAmount), isSynced = 0, updatedAt = ? 
           WHERE id = ?`,
          [JSON.stringify(savedItems), newTotal, timestamp, order.id]
        );

        // 2. If customer exists, update customer balance by the difference
        if (order.customerId && order.customerId !== 'Walk-in') {
          await window.electronAPI.dbQuery(
            'UPDATE customers SET balance = balance + ?, isSynced = 0, updatedAt = ? WHERE id = ?',
            [diff, timestamp, order.customerId]
          );
        }

        // 3. Trigger local update in parent state
        if (onOrderUpdate) {
          const diff = newTotal - (order.total || 0);
          onOrderUpdate({
            ...order,
            items: items,
            total: newTotal,
            subtotal: computedSubtotal,
            tax: computedTax,
            dueAmount: Math.max(0, newTotal - (order.paidAmount || 0)),
            totalBalance: (order.totalBalance || 0) + diff
          });
        }
      } catch (err) {
        console.error('Failed to save edited invoice:', err);
        alert('Failed to save invoice edits: ' + err.message);
      }
    }
  };

  // ── Drag handlers ──
  const handleDragStart = (e, idx) => {
    dragIndex.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(idx);
  };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === idx) return;
    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex.current, 1);
    reordered.splice(idx, 0, moved);
    setItems(reordered);
    dragIndex.current = null;
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const isCompact = settings.invoiceTemplate === 'compact';
  const showLogo = settings.invoiceShowLogo !== false;
  const showQrCode = settings.invoiceShowQrCode !== false;
  const showBilingual = settings.invoiceShowBilingual !== false;
  const showTerms = settings.invoiceShowTerms !== false;
  const showBankDetails = settings.invoiceShowBankDetails !== false;
  const termsText = settings.invoiceTermsText || '';

  // ── Customization settings ──
  const accentColor = settings.invoiceAccentColor || '#2563EB';
  const fontSizeMap = { small: '0.82rem', normal: '0.9rem', large: '1rem' };
  const fontSize = fontSizeMap[settings.invoiceFontSize] || '0.9rem';
  const docTitle = settings.invoiceDocTitle || 'TAX INVOICE';
  const docTitleAr = settings.invoiceDocTitleAr || 'فاتورة ضريبية';
  const footerTagline = settings.invoiceFooterTagline || '';


  const formatLabel = (en, ar) => showBilingual ? `${en} / ${ar}` : en;

  const formatExpectedDate = (rawDate) => {
    if (!rawDate) return '';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) {
        return rawDate;
      }
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const datePart = `${day}/${month}/${year}`;
      
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      let ampm = '';
      if (settings.timeFormat === '12h') {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
      }
      const timePart = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
      return `${datePart} ${timePart}`;
    } catch (e) {
      return rawDate;
    }
  };

  const getExpectedDateAndTimeParts = (rawDate) => {
    if (!rawDate) return { datePart: '', timePart: '' };
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) {
        if (rawDate.includes(' ')) {
          const parts = rawDate.split(' ');
          return { datePart: parts[0], timePart: parts.slice(1).join(' ') };
        }
        return { datePart: rawDate, timePart: '' };
      }
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const datePart = `${day}/${month}/${year}`;
      
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      let ampm = '';
      if (settings.timeFormat === '12h') {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
      }
      const timePart = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
      return { datePart, timePart };
    } catch (e) {
      return { datePart: rawDate, timePart: '' };
    }
  };

  const getInvoiceStatus = () => {
    const payStatus = order.paymentStatus?.toLowerCase();
    const isPaid = payStatus === 'paid' || (order.total !== undefined && (order.total - (order.paidAmount || 0)) <= 0);
    if (isPaid) return 'Paid';
    if (payStatus === 'credit') return 'Credit';
    if (payStatus === 'partial') return 'Partial';
    return order.status;
  };

  const isCompact2 = settings.invoiceTemplate === 'compact 2' || settings.invoiceTemplate === 'horizon';

  if (isCompact2) {
    const totalBalanceVal = (order.totalBalance !== undefined) ? order.totalBalance : (order.dueAmount || 0);
    const invoiceStatus = getInvoiceStatus().toUpperCase();
    const formattedDate = order.date || '';

    return (
      <div className={`${styles.invoiceCard} ${styles.template_horizon}`} style={{ fontSize }}>


        {/* 1. Brand Header */}
        <div className={styles.horizonHeaderWrap}>
          {showLogo && (
            <div className={styles.horizonLogoBox}>
              {settings.logo ? (
                <img src={settings.logo} alt="Logo" className={styles.horizonLogo} />
              ) : (
                <img src={defaultLogo} alt="Logo" className={styles.horizonLogo} onError={(e) => { e.target.style.display = 'none'; }} />
              )}
            </div>
          )}
          <div className={styles.horizonHeader}>
            <div className={styles.horizonBrandName}>{settings.companyName || 'HORIZON LAUNDRY'}</div>
            {showBilingual && settings.companyNameAr && <div className={styles.horizonBrandNameAr} dir="rtl">{settings.companyNameAr}</div>}
            {settings.email && <div className={styles.horizonBrandSubline}>{settings.email}</div>}
            <div className={styles.horizonMetaLine}>
              {settings.address || ''}
            </div>
            <div className={styles.horizonMetaLine}>
              {settings.phone && `Tel: ${settings.phone}`} {settings.trn && `| TRN: ${settings.trn}`}
            </div>
          </div>
        </div>

        {/* Double-bordered title block */}
        <div className={styles.horizonTitleBlock}>
          <div className={styles.horizonTitleText}>{showBilingual ? `${docTitle} / ${docTitleAr}` : docTitle}</div>
        </div>

        {/* Metadata section */}
        <div className={styles.horizonMetaGrid}>
          <div className={styles.horizonMetaRow}>
            <span className={styles.horizonMetaLabel}>{formatLabel('INVOICE NO', 'رقم الفاتورة')}:</span>
            <span className={styles.horizonMetaValue}>{settings.invoicePrefix || ''}{order.id}</span>
          </div>
          <div className={styles.horizonMetaRow}>
            <span className={styles.horizonMetaLabel}>{formatLabel('DATE', 'التاريخ')}:</span>
            <span className={styles.horizonMetaValue}>{formattedDate}</span>
          </div>
          <div className={styles.horizonMetaRow}>
            <span className={styles.horizonMetaLabel}>{formatLabel('CUSTOMER NAME', 'اسم العميل')}:</span>
            <span className={styles.horizonMetaValue}>{order.customer || 'Walk-in Customer'}</span>
          </div>
          {order.customerPhone && (
            <div className={styles.horizonMetaRow}>
              <span className={styles.horizonMetaLabel}>{formatLabel('MOBILE NO', 'رقم الهاتف')}:</span>
              <span className={styles.horizonMetaValue}>{order.customerPhone}</span>
            </div>
          )}
          {order.expectedDeliveryDate && (
            <div className={styles.horizonMetaRow}>
              <span className={styles.horizonMetaLabel}>{formatLabel('EXP. DELIVERY', 'تاريخ التسليم')}:</span>
              <span className={styles.horizonMetaValue} style={{ color: '#E11D48', fontWeight: 'bold' }}>{formatExpectedDate(order.expectedDeliveryDate)}</span>
            </div>
          )}
        </div>

        {/* Services Table */}
        <table className={styles.horizonItemsTable}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>{formatLabel('SERVICES', 'الخدمات')}</th>
              <th style={{ textAlign: 'center', width: '15%' }}>{formatLabel('QTY', 'الكمية')}</th>
              <th style={{ textAlign: 'right', width: '25%' }}>{formatLabel('TOTAL', 'المجموع')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
              const servicesText = item.types && item.types.length > 0 
                ? item.types.map(t => t.name).join(' + ') 
                : (item.sub || item.category || '');
              return (
                <tr key={idx}>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <EditableCell
                        editing={editMode}
                        value={item.name}
                        onChange={(v) => updateItem(idx, 'name', v)}
                        className={styles.horizonItemName}
                      />
                      {servicesText && (
                        <span className={styles.horizonItemSubText}>
                          ◦ {servicesText}
                        </span>
                      )}
                      {item.description && (
                        <span className={styles.horizonItemSubText} style={{ color: '#DC2626' }}>
                          ⚠️ {item.description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <EditableCell
                      editing={editMode}
                      value={item.qty}
                      onChange={(v) => updateItem(idx, 'qty', v)}
                      type="number"
                      align="center"
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editMode ? (
                      <EditableCell
                        editing={editMode}
                        value={item.price}
                        onChange={(v) => updateItem(idx, 'price', v)}
                        type="number"
                        align="right"
                      />
                    ) : (
                      lineTotal.toFixed(2)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Divider line before totals */}
        <div className={styles.horizonLineDivider}></div>

        {/* Totals side */}
        <div className={styles.horizonTotalsBlock}>
          <div className={styles.horizonTotalRow}>
            <span>{formatLabel('Subtotal (Incl. Tax)', 'الإجمالي قبل الضريبة')}:</span>
            <span>{computedSubtotal.toFixed(2)}</span>
          </div>
          <div className={styles.horizonTotalRow}>
            <span>{formatLabel(`VAT Amount (${settings.isTaxEnabled ? settings.taxRate : 0}%)`, 'قيمة الضريبة')}:</span>
            <span>{computedTax.toFixed(2)}</span>
          </div>
          <div className={styles.horizonTotalRow}>
            <span>{formatLabel('Discounts', 'الخصومات')}:</span>
            <span>{(parseFloat(order.discount) || 0).toFixed(2)}</span>
          </div>
          
          <div className={styles.horizonTotalDashedLine}></div>

          <div className={styles.horizonGrandTotalRow}>
            <span>{formatLabel('TOTAL AMOUNT', 'المجموع الكلي')}:</span>
            <span>{computedTotal.toFixed(2)}</span>
          </div>

          <div className={styles.horizonTotalDashedLine}></div>

          <div className={styles.horizonStatusRow}>
            <span>{formatLabel('PAYMODE', 'طريقة الدفع')}:</span>
            <span style={{ textTransform: 'uppercase' }}>
              {(() => {
                const breakdown = order.paymentBreakdown;
                const activeMethods = [];
                if (breakdown) {
                  if (breakdown.cash > 0) activeMethods.push('CASH');
                  if (breakdown.card > 0) activeMethods.push('CARD');
                  if (breakdown.upi > 0) activeMethods.push('UPI');
                  if (breakdown.bank > 0) activeMethods.push('BANK');
                }
                if (activeMethods.length > 0) return activeMethods.join(' / ');
                return order.paymentMethod || 'CASH';
              })()}
            </span>
          </div>

          <div className={styles.horizonStatusRow}>
            <span>{formatLabel('STATUS', 'الحالة')}:</span>
            <span style={{ fontWeight: 800 }}>{invoiceStatus}</span>
          </div>
        </div>

        {/* Customer Statement Box */}
        <div className={styles.horizonStatementBox}>
          <div className={styles.horizonBoxTitle}>{formatLabel('CUSTOMER STATEMENT', 'كشف الحساب')}</div>
          <div className={styles.horizonBoxRow}>
            <span>{formatLabel('Prev. Balance', 'الرصيد السابق')}:</span>
            <span>{Math.abs(order.previousBalance || 0).toFixed(2)}</span>
          </div>
          <div className={styles.horizonBoxRow}>
            <span>{formatLabel('New Balance', 'الرصيد الجديد')}:</span>
            <span>{Math.abs(totalBalanceVal).toFixed(2)}</span>
          </div>
        </div>

        {/* Ready for Collection Box */}
        {order.expectedDeliveryDate && (() => {
          const parts = getExpectedDateAndTimeParts(order.expectedDeliveryDate);
          return (
            <div className={styles.horizonCollectionBox}>
              <div className={styles.horizonBoxTitle}>{formatLabel('READY FOR COLLECTION', 'جاهز للاستلام')}</div>
              <div className={styles.horizonCollectionDate}>
                {parts.datePart}
              </div>
              {parts.timePart && (
                <div className={styles.horizonCollectionTime}>
                  BY {parts.timePart}
                </div>
              )}
            </div>
          );
        })()}

        {/* Bullet guidelines */}
        {showTerms && termsText && (
          <div className={styles.horizonGuidelinesList}>
            {termsText.split('\n').filter(line => line.trim().length > 0).map((line, lidx) => (
              <div key={lidx} className={styles.horizonGuidelineItem}>
                <span className={styles.horizonBullet}>▪</span>
                <span>{line.replace(/^-\s*/, '').replace(/^▪\s*/, '')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Compliance QR corner */}
        {showQrCode && (
          <div className={styles.horizonQrContainer}>
            <QRCodeSVG value={`https://hzl.io/t/${order.id}`} size={85} />
            <div className={styles.horizonTrackText}>TRACK ORDER: hzl.io/t/{order.id}</div>
          </div>
        )}

        {/* Footer Tagline */}
        {footerTagline && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0 0.15rem', fontSize: '0.78rem', fontWeight: 700 }}>
            {footerTagline}
          </div>
        )}

        <div className={styles.horizonFooterDivider}></div>
        <div className={styles.horizonFooterText}>
          Thank you for choosing {settings.companyName || 'Horizon Laundry'}
          <div className={styles.horizonFooterSubText}>POWERED BY HORIZON INNOVATIONS</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.invoiceCard} ${styles[`template_${settings.invoiceTemplate}`]}`}
      style={{ fontSize, '--invoice-accent': accentColor }}
    >



      {/* 1. Header */}
      {isCompact ? (
        <div className={styles.thermalHeader}>
          {showLogo && (
            <div className={styles.thermalLogoWrap}>
              {settings.logo ? (
                <img src={settings.logo} alt="Logo" className={styles.thermalLogo} />
              ) : (
                <img src={defaultLogo} alt="Logo" className={styles.thermalLogo} onError={(e) => { e.target.style.display = 'none'; }} />
              )}
            </div>
          )}
          <div className={styles.thermalCompanyBlock}>
            <div className={styles.thermalCompanyName}>{settings.companyName || 'Laundry Box'}</div>
            {showBilingual && settings.companyNameAr && (
              <div className={styles.thermalCompanyNameAr} dir="rtl">{settings.companyNameAr}</div>
            )}
            {settings.address && <div className={styles.thermalCompanyMeta}>{settings.address}</div>}
            {showBilingual && settings.addressAr && (
              <div className={styles.thermalCompanyMeta} dir="rtl">{settings.addressAr}</div>
            )}
            {settings.phone && <div className={styles.thermalCompanyMeta}>Tel: {settings.phone}</div>}
            {settings.email && <div className={styles.thermalCompanyMeta}>{settings.email}</div>}
          </div>
          {showQrCode && (
            <div className={styles.thermalQrCorner}>
              <QRCodeSVG value={`https://hzl.io/t/${order.id}`} size={48} />
            </div>
          )}
        </div>
      ) : (
        <div className={styles.invoiceHeaderBilingual}>
          <div className={styles.companySideEn}>
            {showLogo && (
              settings.logo ? (
                <img src={settings.logo} alt="Logo" className={styles.invoiceLogo} />
              ) : (
                <img src={defaultLogo} alt="Logo" className={styles.invoiceLogo} onError={(e) => { e.target.style.display = 'none'; }} />
              )
            )}
            <div className={styles.companyInfoEn}>
              <h2>{settings.companyName || 'Laundry Box'}</h2>
              <p className={styles.companyAddress}>{settings.address || 'Address not set'}</p>
              {settings.phone && <p className={styles.companyContact}>Tel: {settings.phone}</p>}
              {settings.email && <p className={styles.companyContact}>Email: {settings.email}</p>}
            </div>
          </div>
          {showBilingual && (
            <div className={styles.companySideAr} style={{ direction: 'rtl', textAlign: 'right' }}>
              <h2>{settings.companyNameAr || 'محل غسيل ملابس'}</h2>
              <p className={styles.companyAddress}>{settings.addressAr || 'العنوان غير محدد'}</p>
              {settings.phone && <p className={styles.companyContact}>هاتف: {settings.phone}</p>}
              {settings.email && <p className={styles.companyContact}>البريد: {settings.email}</p>}
            </div>
          )}
        </div>
      )}

      {/* 2. Title & TRN */}
      <div className={styles.titleAndTrnContainer}>
        <div className={styles.taxInvoiceTitleBlock}>
          <div className={styles.dividerLine} style={{ borderColor: accentColor }}></div>
          <div className={styles.titleTextContainer}>
            <h1 style={{ color: accentColor }}>{showBilingual ? `${docTitle} / ${docTitleAr}` : docTitle}</h1>
          </div>
          <div className={styles.dividerLine} style={{ borderColor: accentColor }}></div>
        </div>
        {settings.trn && (
          <div className={styles.trnCenteredBlock}>
            <span>{formatLabel('TRN', 'الرقم الضريبي')}: {settings.trn}</span>
          </div>
        )}
      </div>

      {/* 3. Invoice Metadata */}
      <div className={styles.metaDataBlock}>
        <div className={styles.metaLeftColumn}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabelEnAr}>{formatLabel('Invoice No', 'رقم الفاتورة')}:</span>
            <span className={styles.metaValue}>{settings.invoicePrefix || ''}{order.id}</span>
          </div>

        </div>
        <div className={styles.metaRightColumn}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabelEnAr}>{formatLabel('Date & Time', 'التاريخ والوقت')}:</span>
            <span className={styles.metaValue} style={{ fontSize: '0.82rem' }}>{order.date}</span>
          </div>
          {order.expectedDeliveryDate && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabelEnAr}>{formatLabel('Exp. Delivery', 'تاريخ التسليم المتوقع')}:</span>
              <span className={styles.metaValue} style={{ color: '#E11D48', fontWeight: 'bold' }}>{order.expectedDeliveryDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Customer Details */}
      <div className={styles.customerBlockBilingual}>
        <h3>{formatLabel('CUSTOMER DETAILS', 'تفاصيل العميل')}</h3>
        <div className={styles.customerGrid}>
          <div className={styles.customerItem}>
            <span className={styles.customerLabelEn}>{formatLabel('Name', 'الاسم')}:</span>
            <strong className={styles.customerVal}>{order.customer}</strong>
          </div>
          {order.customerPhone && (
            <div className={styles.customerItem}>
              <span className={styles.customerLabelEn}>{formatLabel('Phone', 'الهاتف')}:</span>
              <strong className={styles.customerVal}>{order.customerPhone}</strong>
            </div>
          )}
        </div>
      </div>

      {/* 4b. Special Instructions */}
      {order.specialInstructions && (
        <div className={styles.specialInstructionsBlock} style={{
          marginTop: '0.5rem',
          marginBottom: '0.75rem',
          padding: '0.75rem 1.25rem',
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          borderRadius: '12px',
          color: '#B45309',
          fontSize: '0.88rem'
        }}>
          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
            {formatLabel('⚠️ Special Instructions', '⚠️ تعليمات خاصة')}:
          </strong>
          <span>{order.specialInstructions}</span>
        </div>
      )}



      {/* 5. Items */}
      {isCompact ? (
        /* ── Thermal: stacked item cards ── */
        <div className={styles.thermalItemsList}>
          {items.map((item, idx) => {
            const typesList = item.types && item.types.length > 0
              ? item.types
              : item.sub
                ? item.sub.split(' + ').map(n => ({ name: n }))
                : [];
            const addonsList = item.addons && item.addons.length > 0 ? item.addons : [];
            const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
            return (
              <div key={idx} className={styles.thermalItem}>
                {/* Service name — wraps naturally */}
                <div className={styles.thermalItemName}>{item.name}</div>
                {/* Treatment / service types on one line */}
                {typesList.length > 0 && (
                  <div className={styles.thermalItemTypes}>
                    {typesList.map(t => t.name).join(' · ')}
                  </div>
                )}
                {/* Add-ons inline — never letter-by-letter */}
                {addonsList.length > 0 && (
                  <div className={styles.thermalItemAddons}>+ {addonsList.join(', ')}</div>
                )}
                {/* Delivery method */}
                {item.deliveryMethod && (
                  <div className={styles.thermalItemDelivery}>
                    📦 {(() => {
                      const matchedMethod = settings.deliveryMethods?.find(m => m.name === item.deliveryMethod);
                      const arTranslation = matchedMethod ? matchedMethod.nameAr : (item.deliveryMethod === 'Hanger' ? 'علاقة' : (item.deliveryMethod === 'Folded' ? 'مطوي' : (item.deliveryMethod === 'Bagged' ? 'مكيس' : '')));
                      return showBilingual && arTranslation ? `${item.deliveryMethod} / ${arTranslation}` : item.deliveryMethod;
                    })()}
                  </div>
                )}
                {/* Special note */}
                {item.description && (
                  <div className={styles.thermalItemNote}>⚠️ {item.description}</div>
                )}
                {/* Qty × Price = Total — always single line, price right-aligned */}
                <div className={styles.thermalItemQtyRow}>
                  <span className={styles.thermalItemQtyText}>
                    Qty: {item.qty} &times; {(parseFloat(item.price) || 0).toFixed(2)}
                  </span>
                  <span className={styles.thermalItemTotal}>{lineTotal.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Standard: multi-column table ── */
        <table className={styles.itemsTableBilingual}>
          <thead>
            <tr>
              <th style={{ width: '5%' }}></th>
              <th style={{ width: editMode ? '17%' : '20%', textAlign: 'left' }}>
                <div>ITEM NAME</div>
                {showBilingual && <div className={styles.thAr}>اسم الصنف</div>}
              </th>
              <th style={{ width: editMode ? '11%' : '12%', textAlign: 'left' }}>
                <div>PACKAGE</div>
                {showBilingual && <div className={styles.thAr}>التغليف</div>}
              </th>
              <th style={{ width: '18%', textAlign: 'left' }}>
                <div>ADD-ONS</div>
                {showBilingual && <div className={styles.thAr}>الإضافات</div>}
              </th>
              <th style={{ width: '14%', textAlign: 'left' }}>
                <div>SERVICE</div>
                {showBilingual && <div className={styles.thAr}>الخدمة</div>}
              </th>
              <th style={{ width: '6%', textAlign: 'center' }}>
                <div>QTY</div>
                {showBilingual && <div className={styles.thAr}>الكمية</div>}
              </th>
              <th style={{ width: '12%', textAlign: 'center' }}>
                <div>PRICE</div>
                {showBilingual && <div className={styles.thAr}>السعر</div>}
              </th>
              <th style={{ width: '15%', textAlign: 'right' }}>
                <div>TOTAL</div>
                {showBilingual && <div className={styles.thAr}>الإجمالي</div>}
              </th>
              {editMode && <th style={{ width: '4%' }} data-noprint="true"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                style={{
                  background: dragOverIndex === idx ? 'rgba(59,130,246,0.08)' : 'transparent',
                  borderTop: dragOverIndex === idx ? '2px solid #3B82F6' : undefined,
                  cursor: editMode ? 'default' : 'grab',
                  transition: 'background 0.15s'
                }}
              >
                {/* Grip handle */}
                <td style={{ textAlign: 'center', padding: '0.4rem 0.2rem', color: '#CBD5E1' }}>
                  <GripVertical size={14} style={{ cursor: 'grab' }} />
                </td>

                {/* Item Name */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <EditableCell
                      editing={editMode}
                      value={item.name}
                      onChange={(v) => updateItem(idx, 'name', v)}
                      className={styles.itemName}
                    />
                    {item.description && (
                      <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600, marginTop: '0.15rem', display: 'block' }}>
                        ⚠️ {item.description}
                      </div>
                    )}
                  </div>
                </td>

                {/* Package Column */}
                <td>
                  {item.deliveryMethod && (
                    <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, lineHeight: 1.4 }}>
                      📦 {(() => {
                        const matchedMethod = settings.deliveryMethods?.find(m => m.name === item.deliveryMethod);
                        const arTranslation = matchedMethod ? matchedMethod.nameAr : (item.deliveryMethod === 'Hanger' ? 'علاقة' : (item.deliveryMethod === 'Folded' ? 'مطوي' : (item.deliveryMethod === 'Bagged' ? 'مكيس' : '')));
                        return formatLabel(item.deliveryMethod, arTranslation || item.deliveryMethod);
                      })()}
                    </div>
                  )}
                </td>

                {/* Add-ons */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    {item.addons && item.addons.length > 0 ? (
                      item.addons.map((a, ai) => (
                        <div key={ai} style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 700, lineHeight: 1.4 }}>
                          + {a}
                        </div>
                      ))
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>-</span>
                    )}
                  </div>
                </td>

                {/* Service (Treatments / Service Types) */}
                <td>
                  {editMode ? (
                    <EditableCell
                      editing={editMode}
                      value={item.sub || item.category}
                      onChange={(v) => updateItem(idx, 'sub', v)}
                      className={styles.itemServiceType}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      {(() => {
                        const typesList = item.types && item.types.length > 0
                          ? item.types
                          : item.sub
                            ? item.sub.split(' + ').map(n => ({ name: n }))
                            : [];
                        return typesList.length > 0 ? (
                          <div>
                            {typesList.map((t, ti) => (
                              <div key={ti} style={{ fontSize: '0.75rem', color: '#1E293B', fontWeight: 600, lineHeight: 1.4 }} className={styles.itemServiceType}>
                                {t.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>-</span>
                        );
                      })()}
                    </div>
                  )}
                </td>

                {/* Qty */}
                <td style={{ textAlign: 'center' }} className={styles.cellValue}>
                  <EditableCell
                    editing={editMode}
                    value={item.qty}
                    onChange={(v) => updateItem(idx, 'qty', v)}
                    type="number"
                    align="center"
                  />
                </td>

                {/* Price */}
                <td style={{ textAlign: 'center' }} className={styles.cellValue}>
                  {editMode ? (
                    <EditableCell
                      editing={editMode}
                      value={item.price}
                      onChange={(v) => updateItem(idx, 'price', v)}
                      type="number"
                      align="center"
                    />
                  ) : (
                    <><CurrencySymbol size={11} /> {item.price.toFixed(2)}</>
                  )}
                </td>

                {/* Total (auto-calculated) */}
                <td style={{ textAlign: 'right' }} className={styles.cellTotal}>
                  <CurrencySymbol size={11} /> {((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}
                </td>

                {/* Delete row button (edit mode only) */}
                {editMode && (
                  <td data-noprint="true" style={{ textAlign: 'center', padding: '0.2rem' }}>
                    <button
                      onClick={() => deleteItem(idx)}
                      style={{
                        background: '#FEF2F2',
                        border: '1px solid #FCA5A5',
                        borderRadius: 6,
                        color: '#EF4444',
                        cursor: 'pointer',
                        padding: '0.2rem 0.35rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add row button (edit mode only) */}
      {editMode && (
        <button
          data-noprint="true"
          onClick={addItem}
          className={styles.addItemRowBtn}
        >
          <Plus size={15} /> Add Item Row
        </button>
      )}

      {/* 6. Totals, Terms, Bank, QR Code */}
      {isCompact ? (
        /* ── Thermal: single-column totals ── */
        <div className={styles.thermalTotalsBlock}>
          {computedDiscount > 0.01 && (
            <div className={styles.thermalTotalRow}>
              <span>{formatLabel('Items Total', 'إجمالي المواد')}</span>
              <span><CurrencySymbol size={10} /> {itemsTotal.toFixed(2)}</span>
            </div>
          )}
          {computedDiscount > 0.01 && (
            <div className={styles.thermalTotalRow}>
              <span>{formatLabel('Discount', 'الخصم')}</span>
              <span className={styles.thermalTotalRed}>- <CurrencySymbol size={10} /> {computedDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className={styles.thermalTotalRow}>
            <span>{formatLabel('Subtotal', 'قبل الضريبة')}</span>
            <span><CurrencySymbol size={10} /> {computedSubtotal.toFixed(2)}</span>
          </div>
          <div className={styles.thermalTotalRow}>
            <span>{formatLabel(`VAT (${settings.isTaxEnabled ? settings.taxRate : 0}%)`, 'الضريبة')}</span>
            <span><CurrencySymbol size={10} /> {computedTax.toFixed(2)}</span>
          </div>
          <div className={`${styles.thermalTotalRow} ${styles.thermalTotalBold}`}>
            <span>{formatLabel('TOTAL', 'الإجمالي')}</span>
            <span><CurrencySymbol size={11} /> {computedTotal.toFixed(2)}</span>
          </div>
          <div className={styles.thermalDividerDash} />
          {manualPaid > 0 && (
            <div className={styles.thermalTotalRow}>
              <span>{formatLabel('Paid', 'المدفوع')}</span>
              <span><CurrencySymbol size={10} /> {manualPaid.toFixed(2)}</span>
            </div>
          )}
          {(order.previousBalance || 0) < 0 ? (
            <>
              <div className={styles.thermalTotalRow}>
                <span>{formatLabel('Advance Available', 'رصيد مسبق')}</span>
                <span><CurrencySymbol size={10} /> {Math.abs(order.previousBalance).toFixed(2)}</span>
              </div>
              {advanceDeducted > 0 && (
                <div className={styles.thermalTotalRow}>
                  <span>{formatLabel('Advance Deducted', 'الرصيد المخصوم')}</span>
                  <span className={styles.thermalTotalRed}>- <CurrencySymbol size={10} /> {advanceDeducted.toFixed(2)}</span>
                </div>
              )}
            </>
          ) : (order.previousBalance || 0) > 0 ? (
            <div className={styles.thermalTotalRow}>
              <span>{formatLabel('Previous Balance', 'الرصيد السابق')}</span>
              <span><CurrencySymbol size={10} /> {(order.previousBalance || 0).toFixed(2)}</span>
            </div>
          ) : null}
          <div className={`${styles.thermalTotalRow} ${styles.thermalGrandTotal} ${order.totalBalance > 0 ? styles.thermalBalanceDue : styles.thermalBalancePaid}`}>
            <span>{formatLabel('Balance', 'الرصيد')}</span>
            <span><CurrencySymbol size={12} /> {(order.totalBalance || 0).toFixed(2)}</span>
          </div>
          {/* Payment method */}
          {order.paymentMethod && order.paymentMethod !== 'Not Paid' && (
            <div className={styles.thermalPayMethod}>
              {formatLabel('Via', 'عبر')}: {order.paymentMethod}
            </div>
          )}
          {/* Bank details */}
          {showBankDetails && settings.bankAccounts && settings.bankAccounts.length > 0 && (
            <div className={styles.thermalBankBlock}>
              <div className={styles.thermalBankTitle}>BANK TRANSFER DETAILS</div>
              {settings.bankAccounts.map((account, bidx) => (
                <div key={account.id || bidx} className={styles.thermalBankRow}>
                  <strong>{account.bankName}</strong>: {account.accountNumber}
                  {account.iban && <span className={styles.thermalBankIban}>IBAN: {account.iban}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Standard: two-column totals with QR + bank ── */
        <div className={styles.bottomBilingualSection}>
          {(showQrCode || (showBankDetails && settings.bankAccounts && settings.bankAccounts.length > 0)) && (
            <div className={styles.trackingAndBankDetails}>
              {showQrCode && (
                <div className={styles.complianceQrBox}>
                  <div className={styles.qrWrapper}>
                    <QRCodeSVG value={`https://hzl.io/t/${order.id}`} size={85} />
                  </div>
                </div>
              )}
              {showBankDetails && settings.bankAccounts && settings.bankAccounts.length > 0 && (
                <div className={styles.bankTransferDetailsBox}>
                  <h4>BANK TRANSFER DETAILS</h4>
                  {settings.bankAccounts.map((account, idx) => (
                    <div
                      key={account.id || idx}
                      className={`${styles.bankAccountRow} ${settings.defaultBankId === account.id ? styles.defaultBankRow : ''}`}
                    >
                      <div className={styles.bankName}>
                        {account.bankName}
                        {settings.defaultBankId === account.id && <span className={styles.defaultBankBadge}>Default</span>}
                      </div>
                      <div className={styles.bankNumbers}>
                        <span>A/C: {account.accountNumber}</span>
                        {account.iban && <span>IBAN: {account.iban}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Totals summary — auto-recalculated when editing */}
          <div className={styles.totalsBilingualBox}>
            <div className={styles.totalsSubCard}>
              <div className={styles.totalsSubCardHeader}>
                <span>INVOICE CHARGES</span>
                {showBilingual && <span>رسوم الفاتورة</span>}
              </div>
              {computedDiscount > 0.01 && (
                <div className={styles.totalRowBilingual}>
                  <span>{formatLabel('Items Total', 'إجمالي المواد')}</span>
                  <span className={styles.totalVal}><CurrencySymbol size={11} /> {itemsTotal.toFixed(2)}</span>
                </div>
              )}
              {computedDiscount > 0.01 && (
                <div className={styles.totalRowBilingual}>
                  <span>{formatLabel('Discount', 'الخصم')}</span>
                  <span className={styles.totalVal} style={{ color: '#DC2626' }}>- <CurrencySymbol size={11} /> {computedDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className={styles.totalRowBilingual}>
                <span>{formatLabel('Before VAT', 'قبل الضريبة')}</span>
                <span className={styles.totalVal}><CurrencySymbol size={11} /> {computedSubtotal.toFixed(2)}</span>
              </div>
              <div className={styles.totalRowBilingual}>
                <span>{formatLabel(`VAT (${settings.isTaxEnabled ? settings.taxRate : 0}%)`, 'الضريبة')}</span>
                <span className={styles.totalVal}><CurrencySymbol size={11} /> {computedTax.toFixed(2)}</span>
              </div>
              <div className={`${styles.totalRowBilingual} ${styles.highlightRow}`}>
                <span>{formatLabel('Total (Inc. VAT)', 'الإجمالي شامل الضريبة')}</span>
                <span className={styles.totalVal}><CurrencySymbol size={11} /> {computedTotal.toFixed(2)}</span>
              </div>
              {computedTotal - (order.paidAmount || 0) > 0 && (
                <div className={styles.totalRowBilingual} style={{ color: '#E11D48', fontWeight: 'bold', background: '#FFF1F2', padding: '0.2rem 0.5rem', borderRadius: '4px', marginTop: '0.25rem' }}>
                  <span>{formatLabel('Invoice Due', 'المستحق للفاتورة')}</span>
                  <span className={styles.totalVal}><CurrencySymbol size={11} /> {Math.max(0, computedTotal - (order.paidAmount || 0)).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className={styles.totalsSubCard}>
              <div className={styles.totalsSubCardHeader}>
                <span>ACCOUNT STATEMENT</span>
                {showBilingual && <span>كشف الحساب</span>}
              </div>
              {manualPaid > 0 && (
                <div className={styles.totalRowBilingual}>
                  <span>{formatLabel('Total Paid', 'المبلغ المدفوع')}</span>
                  <span className={styles.totalVal}><CurrencySymbol size={11} /> {manualPaid.toFixed(2)}</span>
                </div>
              )}
              {(() => {
                const breakdown = order.paymentBreakdown;
                const hasBreakdown = breakdown && (
                  (breakdown.cash && breakdown.cash > 0) ||
                  (breakdown.card && breakdown.card > 0) ||
                  (breakdown.upi && breakdown.upi > 0) ||
                  (breakdown.bank && breakdown.bank > 0)
                );
                if (hasBreakdown) {
                  return (
                    <div style={{ borderTop: '1px dashed #CBD5E1', marginTop: '0.25rem', paddingTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', width: '100%' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
                        {formatLabel('Payment Details', 'تفاصيل الدفع')}:
                      </span>
                      {breakdown.cash > 0 && (
                        <div className={styles.totalRowBilingual} style={{ fontSize: '0.75rem', color: '#475569' }}>
                          <span>- {formatLabel('Cash', 'نقداً')}</span>
                          <span><CurrencySymbol size={9} /> {breakdown.cash.toFixed(2)}</span>
                        </div>
                      )}
                      {breakdown.card > 0 && (
                        <div className={styles.totalRowBilingual} style={{ fontSize: '0.75rem', color: '#475569' }}>
                          <span>- {formatLabel('Card', 'بطاقة')}</span>
                          <span><CurrencySymbol size={9} /> {breakdown.card.toFixed(2)}</span>
                        </div>
                      )}
                      {breakdown.upi > 0 && (
                        <div className={styles.totalRowBilingual} style={{ fontSize: '0.75rem', color: '#475569' }}>
                          <span>- {formatLabel('UPI', 'يو بي آي')}</span>
                          <span><CurrencySymbol size={9} /> {breakdown.upi.toFixed(2)}</span>
                        </div>
                      )}
                      {breakdown.bank > 0 && (
                        <div className={styles.totalRowBilingual} style={{ fontSize: '0.75rem', color: '#475569' }}>
                          <span>- {formatLabel('Bank Transfer', 'تحويل بنكي')}</span>
                          <span><CurrencySymbol size={9} /> {breakdown.bank.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                } else if (order.paymentMethod && order.paymentMethod !== 'Not Paid') {
                  return (
                    <div className={styles.totalRowBilingual} style={{ fontSize: '0.75rem', color: '#475569' }}>
                      <span>{formatLabel('Paid Via', 'طريقة الدفع')}</span>
                      <span>{order.paymentMethod}</span>
                    </div>
                  );
                }
                return null;
              })()}
              {(order.previousBalance || 0) < 0 ? (
                <>
                  <div className={styles.totalRowBilingual}>
                    <span>{formatLabel('Advance Available', 'رصيد مسبق')}</span>
                    <span className={styles.totalVal}><CurrencySymbol size={11} /> {Math.abs(order.previousBalance).toFixed(2)}</span>
                  </div>
                  {advanceDeducted > 0 && (
                    <div className={styles.totalRowBilingual}>
                      <span>{formatLabel('Advance Deducted', 'الرصيد المخصوم')}</span>
                      <span className={styles.totalVal} style={{ color: '#EF4444' }}>- <CurrencySymbol size={11} /> {advanceDeducted.toFixed(2)}</span>
                    </div>
                  )}
                </>
              ) : (order.previousBalance || 0) > 0 ? (
                <div className={styles.totalRowBilingual}>
                  <span>{formatLabel('Previous Balance', 'الرصيد السابق')}</span>
                  <span className={styles.totalVal}><CurrencySymbol size={11} /> {(order.previousBalance || 0).toFixed(2)}</span>
                </div>
              ) : null}
              <div className={`${styles.grandTotalBilingualRow} ${order.totalBalance > 0 ? styles.balanceOverdue : styles.balancePaid}`}>
                <div className={styles.grandLabelCol}>
                  <span className={styles.grandLabelEn}>Total Balance</span>
                  {showBilingual && <span className={styles.grandLabelAr}>الرصيد الإجمالي</span>}
                </div>
                <span className={styles.grandVal}><CurrencySymbol size={14} /> {(order.totalBalance || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Tagline */}
      {footerTagline && (
        <div style={{ textAlign: 'center', padding: '0.75rem 0 0.25rem', fontSize: '0.82rem', color: accentColor, fontWeight: 700 }}>
          {footerTagline}
        </div>
      )}

      {/* Terms & Conditions */}
      {showTerms && termsText && (
        <div className={styles.invoiceTermsBox}>
          <div className={styles.termsHeader}>
            {formatLabel('TERMS & CONDITIONS', 'الشروط والأحكام')}
          </div>
          <p className={styles.termsTextContent}>{termsText}</p>
        </div>
      )}
    </div>
  );
}
