export function getReceiptNumber(paymentOrReference) {
  const payment = typeof paymentOrReference === 'object' && paymentOrReference !== null
    ? paymentOrReference
    : { paymentReference: paymentOrReference };
  const candidates = [payment.receiptNumber, payment.id, payment.paymentReference]
    .filter(Boolean)
    .map((value) => String(value));

  if (payment.method === 'Discount') {
    return payment.paymentReference || payment.id || 'DISC-000000';
  }

  const existingRv = candidates.find((value) => /^RV-\d+$/i.test(value));
  if (existingRv) return `RV-${existingRv.split('-').pop().padStart(6, '0')}`;

  const source = candidates.find((value) => /\d/.test(value));
  const digits = source?.match(/(\d+)(?!.*\d)/)?.[1];
  if (!digits) return 'RV-000000';
  return `RV-${digits.slice(-6).padStart(6, '0')}`;
}
