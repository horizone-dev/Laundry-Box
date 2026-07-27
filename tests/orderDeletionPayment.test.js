const assert = require('node:assert/strict');
const {
  getOrderDiscountCredit,
  getRefundableOrderPaymentAmount
} = require('../database');

// Discount settles an invoice but is never customer money.  A deletion must
// refund/convert only the real tender that the customer paid.
{
  const order = { totalAmount: 1000, paidAmount: 1000 };
  const payments = [
    { method: 'Cash', amount: 100 },
    { method: 'Discount', amount: 900 }
  ];

  assert.equal(getOrderDiscountCredit(order, payments), 900);
  assert.equal(getRefundableOrderPaymentAmount(order, payments, []), 100);
}

// The same protection applies to older orders where discount existed only in
// paymentBreakdown and no separate DISC receipt was stored.
{
  const order = {
    totalAmount: 1000,
    paidAmount: 1000,
    paymentBreakdown: JSON.stringify({ discount: 900 })
  };
  const payments = [{ method: 'Cash', amount: 100 }];

  assert.equal(getOrderDiscountCredit(order, payments), 900);
  assert.equal(getRefundableOrderPaymentAmount(order, payments, []), 100);
}

// A consumed advance is a real customer credit and remains refundable when
// the manager selects refund rather than convert-to-advance.
{
  const order = { totalAmount: 1000, paidAmount: 1000 };
  const payments = [
    { method: 'Cash', amount: 100 },
    { method: 'Advance', amount: 900 }
  ];
  const allocations = [{ paymentId: 'ADV-1', amountUsed: 900 }];

  assert.equal(getRefundableOrderPaymentAmount(order, payments, allocations), 1000);
}

console.log('order deletion payment tests passed');
