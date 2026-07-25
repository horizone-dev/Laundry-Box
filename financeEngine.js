/**
 * Canonical, read-only customer finance calculation.
 *
 * This module deliberately contains no SQL and performs no writes.  It is the
 * foundation for moving every screen to one financial meaning before any live
 * transaction flow is changed.
 *
 * Balance convention:
 *   positive = customer owes the shop
 *   negative = shop holds customer advance
 */

const EPSILON = 0.005;
const SYNTHETIC_PAYMENT_METHODS = new Set(['System Auto', 'Advance']);
const FAILED_PAYMENT_STATUSES = new Set(['FAILED', 'CANCELLED', 'EXPIRED', 'VOIDED']);

function toAmount(value) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

function roundCurrency(value) {
  return Math.round((toAmount(value) + Number.EPSILON) * 100) / 100;
}

function normaliseStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function isSuccessfulPayment(payment) {
  return !FAILED_PAYMENT_STATUSES.has(normaliseStatus(payment?.status));
}

function isDeletedOrder(order) {
  return String(order?.status || '').trim() === 'Deleted';
}

function isReturnedDeletedOrder(order) {
  const status = String(order?.refundStatus || order?.returnStatus || order?.deletedAction || '').trim();
  return ['refund', 'Refund', 'Returned'].includes(status);
}

function isConvertedToAdvance(order) {
  const status = String(order?.refundStatus || order?.returnStatus || order?.deletedAction || '').trim();
  return status === 'Converted to Advance';
}

function getPaymentOrderId(payment) {
  return payment?.orderId || null;
}

function parsePaymentSnapshot(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function isUsablePayment(payment, returnedOrderIds) {
  if (!payment || !isSuccessfulPayment(payment)) return false;
  if (SYNTHETIC_PAYMENT_METHODS.has(payment.method)) return false;

  // If a deleted order was refunded, any receipt still linked to that order is
  // historical only; it must not remain as customer credit.
  const orderId = getPaymentOrderId(payment);
  if (orderId && returnedOrderIds.has(orderId)) return false;

  return true;
}

/**
 * Calculates a customer's financial state from immutable business records.
 *
 * `orders` must include the live orders table. `deletedOrders` is only used to
 * enrich deleted-order state when the live record is absent or incomplete.
 * The function never uses customers.balance as an input.
 */
function calculateCustomerFinancialState({
  customer = {},
  orders = [],
  payments = [],
  allocations = [],
  deletedOrders = []
} = {}) {
  const liveOrders = Array.isArray(orders) ? orders : [];
  const archivedDeletedOrders = Array.isArray(deletedOrders) ? deletedOrders : [];
  const allPayments = Array.isArray(payments) ? payments : [];
  const allAllocations = Array.isArray(allocations) ? allocations : [];

  const liveOrderIds = new Set(liveOrders.map((order) => order?.id).filter(Boolean));
  const deletedById = new Map();

  liveOrders.filter(isDeletedOrder).forEach((order) => {
    deletedById.set(order.id, order);
  });
  archivedDeletedOrders
    .filter((order) => order?.id && !liveOrderIds.has(order.id))
    .forEach((order) => deletedById.set(order.id, { ...order, status: 'Deleted' }));

  const deletedOrdersById = [...deletedById.values()];
  const returnedOrderIds = new Set(
    deletedOrdersById.filter(isReturnedDeletedOrder).map((order) => order.id)
  );

  const activeOrders = liveOrders.filter((order) => {
    const status = String(order?.status || '').trim();
    return status !== 'Deleted' && status !== 'Cancelled';
  });

  const openingBalance = toAmount(customer.openingBalance);
  const orderCharges = activeOrders.reduce(
    (sum, order) => sum + Math.max(0, toAmount(order.totalAmount)),
    0
  );

  const usablePayments = allPayments.filter((payment) => isUsablePayment(payment, returnedOrderIds));
  const paymentCredits = usablePayments.reduce(
    (sum, payment) => sum + toAmount(payment.amount),
    0
  );

  // A current converted deletion normally moves the original payment to an
  // unlinked receipt. When historic data has no usable receipt at all, flag it
  // for review instead of inventing a balance-changing entry.
  const usablePaymentOrderIds = new Set(
    usablePayments.map(getPaymentOrderId).filter(Boolean)
  );
  const usablePaymentIds = new Set(usablePayments.map((payment) => payment?.id).filter(Boolean));
  const ambiguousConvertedDeletes = deletedOrdersById
    .filter((order) => isConvertedToAdvance(order) && toAmount(order.paidAmount) > EPSILON)
    .filter((order) => {
      const snapshotIds = parsePaymentSnapshot(order.payments)
        .map((payment) => payment?.id)
        .filter(Boolean);
      return !usablePaymentOrderIds.has(order.id) && !snapshotIds.some((paymentId) => usablePaymentIds.has(paymentId));
    })
    .map((order) => ({
      orderId: order.id,
      customerId: order.customerId,
      paidAmount: roundCurrency(order.paidAmount),
      reason: 'Converted deleted order has no linked usable payment; check whether its receipt was moved to advance.'
    }));

  const sourceAllocations = new Map();
  allAllocations.forEach((allocation) => {
    if (!allocation?.paymentId) return;
    sourceAllocations.set(
      allocation.paymentId,
      (sourceAllocations.get(allocation.paymentId) || 0) + Math.max(0, toAmount(allocation.amountUsed))
    );
  });

  const paymentById = new Map(allPayments.map((payment) => [payment?.id, payment]));
  const overAllocatedSources = [...sourceAllocations.entries()]
    .map(([paymentId, amountUsed]) => {
      const payment = paymentById.get(paymentId);
      return {
        paymentId,
        customerId: payment?.customerId || null,
        method: payment?.method || 'Missing payment',
        sourceAmount: roundCurrency(payment?.amount),
        amountUsed: roundCurrency(amountUsed)
      };
    })
    .filter((source) => source.amountUsed > source.sourceAmount + EPSILON);

  const rawBalance = openingBalance + orderCharges - paymentCredits;
  const balance = roundCurrency(rawBalance);

  return {
    balance,
    outstanding: Math.max(0, balance),
    availableAdvance: Math.max(0, -balance),
    openingBalance: roundCurrency(openingBalance),
    orderCharges: roundCurrency(orderCharges),
    paymentCredits: roundCurrency(paymentCredits),
    activeOrderCount: activeOrders.length,
    paymentCount: usablePayments.length,
    audit: {
      ambiguousConvertedDeletes,
      overAllocatedSources
    }
  };
}

module.exports = {
  EPSILON,
  toAmount,
  roundCurrency,
  isSuccessfulPayment,
  isDeletedOrder,
  isReturnedDeletedOrder,
  isConvertedToAdvance,
  parsePaymentSnapshot,
  calculateCustomerFinancialState
};
