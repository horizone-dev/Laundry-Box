export function getDiscountScope(payment) {
  if (payment?.discountScope === 'order' || payment?.discountScope === 'settlement') {
    return payment.discountScope;
  }

  // Existing records have no scope column. Keep their current meaning without
  // rewriting financial history: old SETDISC receipts and unlinked discounts
  // are settlement discounts; linked legacy DISC receipts are order discounts.
  const reference = String(payment?.paymentReference || payment?.id || '');
  if (reference.startsWith('SETDISC-') || !payment?.orderId) return 'settlement';
  return 'order';
}
