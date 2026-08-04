/**
 * Builds a self-contained thermal receipt HTML string from order + settings data.
 * Used by both Invoice.jsx (fallback) and POS.jsx (direct background print on save).
 */
export function buildReceiptHtml(ord, stg) {
  const sym = stg.currencySymbol || 'AED';
  const taxRate = stg.isTaxEnabled ? (stg.taxRate || 0) / 100 : 0;
  const total = ord.total || 0;
  const subtotal = taxRate > 0 ? total / (1 + taxRate) : total;
  const tax = total - subtotal;
  const bi = stg.showBilingual !== false;
  const logoSrc = stg.logo || '';
  const fullAddress = [
    stg.address,
    [stg.city, stg.emirate, stg.country].filter(Boolean).join(', ')
  ].filter(Boolean).join(', ');
  const fullAddressAr = [
    stg.addressAr,
    [stg.cityAr, stg.emirateAr, stg.countryAr].filter(Boolean).join('، ')
  ].filter(Boolean).join('، ');

  const row = (label, value, bold = false) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin:2px 0;${bold ? 'font-weight:900;font-size:13px;border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 0;' : ''}">
      <span>${label}</span>
      <span>${value}</span>
    </div>`;

  const dash = `<div style="border-top:1px dashed #000;margin:6px 0;"></div>`;

  const itemsHtml = (ord.items || []).map(item => {
    const lineTotal = ((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)).toFixed(2);
    const delivery = item.deliveryMethod
      ? `<div style="font-size:11px;">${item.deliveryMethod}${bi && item.deliveryMethod === 'Hanger' ? ' / علاقة' : item.deliveryMethod === 'Folded' ? ' / مطوي' : item.deliveryMethod === 'Bagged' ? ' / مكيس' : ''}</div>`
      : '';
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
      ${fullAddress ? `<div style="text-align:center;font-size:11px;">${fullAddress}</div>` : ''}
      ${bi && fullAddressAr ? `<div style="text-align:center;font-size:11px;" dir="rtl">${fullAddressAr}</div>` : ''}
      ${stg.phone ? `<div style="text-align:center;font-size:11px;">Tel: ${stg.phone}</div>` : ''}
      ${dash}
      <div style="margin:2px 0;"><span style="font-size:11px;">Invoice No${bi ? ' / رقم الفاتورة' : ''}:</span> <b>${stg.invoicePrefix || ''}${ord.id}</b></div>
      <div style="margin:2px 0;"><span style="font-size:11px;">Date:</span> ${ord.date || ''}</div>
      ${ord.expectedDeliveryDate ? `<div style="margin:2px 0;"><span style="font-size:11px;">Exp. Delivery:</span> <b>${ord.expectedDeliveryDate}</b></div>` : ''}
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
}
