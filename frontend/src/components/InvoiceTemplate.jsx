import { QRCodeSVG } from 'qrcode.react';
import { Activity } from 'lucide-react';
import CurrencySymbol from './CurrencySymbol';
import styles from '../pages/Invoice.module.css';

export default function InvoiceTemplate({ order, settings }) {
  if (!order) return null;

  const isCompact = settings.invoiceTemplate === 'compact';

  const translateStatus = (status) => {
    if (!status) return '';
    const statusMap = {
      'confirmed': { en: 'Confirmed', ar: 'مؤكد' },
      'picked up': { en: 'Picked Up', ar: 'تم الاستلام' },
      'washing': { en: 'Washing', ar: 'غسيل' },
      'drying': { en: 'Drying', ar: 'تجفيف' },
      'ironing': { en: 'Ironing', ar: 'كوي' },
      'ready': { en: 'Ready', ar: 'جاهز' },
      'ready to pick up': { en: 'Ready to Pick up', ar: 'جاهز للاستلام' },
      'out for delivery': { en: 'Out for Delivery', ar: 'خارج للتوصيل' },
      'delivered': { en: 'Delivered', ar: 'تم التسليم' },
      'cancelled': { en: 'Cancelled', ar: 'ملغى' },
      'payment pending': { en: 'Payment Pending', ar: 'المدفوعات المعلقة' },
      'paid': { en: 'Paid', ar: 'مدفوع' },
      'credit': { en: 'Credit', ar: 'ذمم' },
      'partial': { en: 'Partial Paid', ar: 'مدفوع جزئياً' }
    };
    const key = status.toLowerCase();
    const mapped = statusMap[key] || { en: status, ar: status };
    return `${mapped.en} / ${mapped.ar}`;
  };

  const getInvoiceStatus = () => {
    const payStatus = order.paymentStatus?.toLowerCase();
    const isPaid = payStatus === 'paid' || (order.total !== undefined && (order.total - (order.paidAmount || 0)) <= 0);
    if (isPaid) {
      return 'Paid';
    }
    if (payStatus === 'credit') {
      return 'Credit';
    }
    if (payStatus === 'partial') {
      return 'Partial';
    }
    return order.status;
  };

  return (
    <div className={`${styles.invoiceCard} ${styles[`template_${settings.invoiceTemplate}`]}`}>
      {/* 1. Header: Bilingual Company Profile & Logo */}
      <div className={styles.invoiceHeaderBilingual}>
        {/* Left Side: English Info */}
        <div className={styles.companySideEn}>
          {settings.logo ? (
            <img src={settings.logo} alt="Logo" className={styles.invoiceLogo} />
          ) : (
            <div className={styles.logoPlaceholder}>
              <Activity size={24} />
            </div>
          )}
          <div className={styles.companyInfoEn}>
            <h2>{settings.companyName || 'Laundry Shop'}</h2>
            <p className={styles.companyAddress}>{settings.address || 'Address not set'}</p>
            {settings.phone && <p className={styles.companyContact}>Tel: {settings.phone}</p>}
            {settings.email && <p className={styles.companyContact}>Email: {settings.email}</p>}
          </div>
        </div>

        {/* Right Side: Arabic Info (Hidden or stacked in compact view) */}
        {!isCompact && (
          <div className={styles.companySideAr} style={{ direction: 'rtl', textAlign: 'right' }}>
            <h2>{settings.companyNameAr || 'محل غسيل ملابس'}</h2>
            <p className={styles.companyAddress}>{settings.addressAr || 'العنوان غير محدد'}</p>
            {settings.phone && <p className={styles.companyContact}>هاتف: {settings.phone}</p>}
            {settings.email && <p className={styles.companyContact}>البريد: {settings.email}</p>}
          </div>
        )}
      </div>

      {/* 2. Document Title: TAX INVOICE / فاتورة ضريبية */}
      <div className={styles.taxInvoiceTitleBlock}>
        <div className={styles.dividerLine}></div>
        <div className={styles.titleTextContainer}>
          <h1>TAX INVOICE / فاتورة ضريبية</h1>
        </div>
        <div className={styles.dividerLine}></div>
      </div>

      {/* 3. Invoice Metadata & TRN Registration */}
      <div className={styles.metaDataBlock}>
        <div className={styles.metaLeftColumn}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabelEnAr}>Invoice No / رقم الفاتورة:</span>
            <span className={styles.metaValue}>{order.id}</span>
          </div>
          {order.billNumber && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabelEnAr}>Bill Number / رقم الحساب:</span>
              <span className={styles.metaValue}>{order.billNumber}</span>
            </div>
          )}
          <div className={styles.metaRow}>
            <span className={styles.metaLabelEnAr}>Date & Time / التاريخ والوقت:</span>
            <span className={styles.metaValue} style={{ fontSize: '0.82rem' }}>{order.date}</span>
          </div>
        </div>
        <div className={styles.metaRightColumn}>
          {settings.trn && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabelEnAr}>TRN / الرقم الضريبي:</span>
              <span className={styles.metaValue} style={{ fontWeight: 800 }}>{settings.trn}</span>
            </div>
          )}
          <div className={styles.metaRow}>
            <span className={styles.metaLabelEnAr}>Status / الحالة:</span>
            <span className={styles.statusValueBadge} style={{
              background: order.paymentStatus === 'Paid' || order.status?.toUpperCase() === 'DELIVERED' ? '#ECFDF5' : '#FEE2E2',
              color: order.paymentStatus === 'Paid' || order.status?.toUpperCase() === 'DELIVERED' ? '#10B981' : '#EF4444'
            }}>
              {translateStatus(getInvoiceStatus())}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Customer Details Block */}
      <div className={styles.customerBlockBilingual}>
        <h3>CUSTOMER DETAILS / تفاصيل العميل</h3>
        <div className={styles.customerGrid}>
          <div className={styles.customerItem}>
            <span className={styles.customerLabelEn}>Name / الاسم:</span>
            <strong className={styles.customerVal}>{order.customer}</strong>
          </div>
          {order.customerPhone && (
            <div className={styles.customerItem}>
              <span className={styles.customerLabelEn}>Phone / الهاتف:</span>
              <strong className={styles.customerVal}>{order.customerPhone}</strong>
            </div>
          )}
        </div>
      </div>

      {/* 5. Items Table */}
      <table className={styles.itemsTableBilingual}>
        <thead>
          <tr>
            <th style={{ width: '40%', textAlign: 'left' }}>
              <div>ITEM DESCRIPTION</div>
              <div className={styles.thAr}>وصف الصنف</div>
            </th>
            <th style={{ width: '20%', textAlign: 'left' }}>
              <div>SERVICE</div>
              <div className={styles.thAr}>نوع الخدمة</div>
            </th>
            <th style={{ width: '10%', textAlign: 'center' }}>
              <div>QTY</div>
              <div className={styles.thAr}>الكمية</div>
            </th>
            <th style={{ width: '15%', textAlign: 'center' }}>
              <div>PRICE</div>
              <div className={styles.thAr}>السعر</div>
            </th>
            <th style={{ width: '15%', textAlign: 'right' }}>
              <div>TOTAL</div>
              <div className={styles.thAr}>الإجمالي</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <tr key={idx}>
              <td>
                <span className={styles.itemName}>{item.name}</span>
              </td>
              <td>
                <span className={styles.itemServiceType}>{item.sub}</span>
              </td>
              <td style={{ textAlign: 'center' }} className={styles.cellValue}>{item.qty}</td>
              <td style={{ textAlign: 'center' }} className={styles.cellValue}>
                <CurrencySymbol size={11} /> {item.price.toFixed(2)}
              </td>
              <td style={{ textAlign: 'right' }} className={styles.cellTotal}>
                <CurrencySymbol size={11} /> {item.total.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 6. Totals, Terms, Bank, QR Code */}
      <div className={styles.bottomBilingualSection}>
        {/* Left column: QR code tracking */}
        <div className={styles.trackingAndBankDetails}>
          <div className={styles.complianceQrBox}>
            <div className={styles.qrWrapper}>
              <QRCodeSVG value={`ORDER:${order.id}`} size={85} />
            </div>
            <div className={styles.qrDetails}>
              <h4>Track Progress / تتبع الطلب</h4>
              <p>Scan to check cleaning status.</p>
              <p className={styles.arText}>امسح الرمز لتتبع حالة الغسيل.</p>
            </div>
          </div>
        </div>

        {/* Right column: Totals summary */}
        <div className={styles.totalsBilingualBox}>
          {/* Card 1: Invoice calculation */}
          <div className={styles.totalsSubCard}>
            <div className={styles.totalsSubCardHeader}>
              <span>INVOICE CHARGES</span>
              <span>رسوم الفاتورة</span>
            </div>
            <div className={styles.totalRowBilingual}>
              <span>Before VAT / قبل الضريبة</span>
              <span className={styles.totalVal}><CurrencySymbol size={11} /> {order.subtotal.toFixed(2)}</span>
            </div>
            <div className={styles.totalRowBilingual}>
              <span>VAT ({settings.isTaxEnabled ? settings.taxRate : 0}%) / الضريبة</span>
              <span className={styles.totalVal}><CurrencySymbol size={11} /> {order.tax.toFixed(2)}</span>
            </div>
            <div className={`${styles.totalRowBilingual} ${styles.highlightRow}`}>
              <span>Total (Inc. VAT) / الإجمالي شامل الضريبة</span>
              <span className={styles.totalVal}><CurrencySymbol size={11} /> {order.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Card 2: Account Statement balance */}
          <div className={styles.totalsSubCard}>
            <div className={styles.totalsSubCardHeader}>
              <span>ACCOUNT STATEMENT</span>
              <span>كشف الحساب</span>
            </div>
            <div className={styles.totalRowBilingual}>
              <span>Total Paid / المبلغ المدفوع</span>
              <span className={styles.totalVal}><CurrencySymbol size={11} /> {(order.paidAmount || 0).toFixed(2)}</span>
            </div>
            <div className={styles.totalRowBilingual}>
              <span>Previous Balance / الرصيد السابق</span>
              <span className={styles.totalVal}><CurrencySymbol size={11} /> {(order.previousBalance || 0).toFixed(2)}</span>
            </div>
            <div className={`${styles.grandTotalBilingualRow} ${order.totalBalance > 0 ? styles.balanceOverdue : styles.balancePaid}`}>
              <div className={styles.grandLabelCol}>
                <span className={styles.grandLabelEn}>Total Balance</span>
                <span className={styles.grandLabelAr}>الرصيد الإجمالي</span>
              </div>
              <span className={styles.grandVal}><CurrencySymbol size={14} /> {(order.totalBalance || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
