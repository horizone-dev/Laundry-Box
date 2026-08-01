export function getReceiptNumber(paymentOrReference) {
  const payment = typeof paymentOrReference === 'object' && paymentOrReference !== null
    ? paymentOrReference
    : { paymentReference: paymentOrReference };
  const candidates = [payment.receiptNumber, payment.id, payment.paymentReference]
    .filter(Boolean)
    .map((value) => String(value));

  // Determine if it is a reversal
  const isReversal = candidates.some(val => 
    val.toUpperCase().includes('REV') || val.toUpperCase().startsWith('DEL-')
  );

  if (payment.method === 'Discount') {
    return payment.paymentReference || payment.id || 'DISC-000000';
  }

  const existingRv = candidates.find((value) => /^RV-\d+$/i.test(value));
  if (existingRv) {
    const numPart = existingRv.split('-').pop().padStart(6, '0');
    return isReversal ? `REV-${numPart}` : `RV-${numPart}`;
  }

  const existingRev = candidates.find((value) => /^REV-\d+$/i.test(value));
  if (existingRev) return existingRev;

  const source = candidates.find((value) => /\d/.test(value));
  const digits = source?.match(/(\d+)(?!.*\d)/)?.[1];
  if (!digits) return isReversal ? 'REV-000000' : 'RV-000000';
  const formattedDigits = digits.slice(-6).padStart(6, '0');
  return isReversal ? `REV-${formattedDigits}` : `RV-${formattedDigits}`;
}
