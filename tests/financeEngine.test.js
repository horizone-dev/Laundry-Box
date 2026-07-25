const assert = require('node:assert/strict');
const { calculateCustomerFinancialState } = require('../financeEngine');

function state(data) {
  return calculateCustomerFinancialState({
    customer: { id: 'C1', openingBalance: 0 },
    orders: [],
    payments: [],
    allocations: [],
    deletedOrders: [],
    ...data
  });
}

// A credit order is a customer due.
assert.equal(state({ orders: [{ id: 'O1', status: 'Confirmed', totalAmount: 100 }] }).balance, 100);

// A normal receipt settles the order exactly once.
assert.equal(state({
  orders: [{ id: 'O1', status: 'Confirmed', totalAmount: 100 }],
  payments: [{ id: 'P1', orderId: 'O1', amount: 100, method: 'Cash', status: 'SUCCESS' }]
}).balance, 0);

// An earlier cash advance is one credit. Its linked technical Advance row must
// not create a second credit when the advance is spent on a later order.
assert.equal(state({
  orders: [{ id: 'O1', status: 'Confirmed', totalAmount: 100 }],
  payments: [
    { id: 'ADV-1', orderId: null, amount: 150, method: 'Cash', status: 'SUCCESS' },
    { id: 'USE-1', orderId: 'O1', amount: 100, method: 'Advance', status: 'SUCCESS' }
  ],
  allocations: [{ id: 'A1', paymentId: 'ADV-1', orderId: 'O1', amountUsed: 100 }]
}).balance, -50);

// A returned deleted order has no current customer debt or credit, even if an
// old linked receipt still exists in the data.
assert.equal(state({
  orders: [{ id: 'D1', status: 'Deleted', totalAmount: 100, paidAmount: 100, deletedAction: 'refund' }],
  payments: [{ id: 'P1', orderId: 'D1', amount: 100, method: 'Card', status: 'SUCCESS' }],
  deletedOrders: [{ id: 'D1', refundStatus: 'Returned', paidAmount: 100 }]
}).balance, 0);

// A converted deleted order keeps the moved receipt as one customer advance.
assert.equal(state({
  orders: [{ id: 'D1', status: 'Deleted', totalAmount: 100, paidAmount: 100, deletedAction: 'advance', payments: '[{"id":"P1","amount":100,"method":"Cash"}]' }],
  payments: [{ id: 'P1', orderId: null, amount: 100, method: 'Cash', status: 'SUCCESS' }]
}).balance, -100);

// Failed payment-gateway callbacks never alter a customer balance.
assert.equal(state({
  orders: [{ id: 'O1', status: 'Confirmed', totalAmount: 100 }],
  payments: [{ id: 'P1', orderId: 'O1', amount: 100, method: 'Nomod', status: 'FAILED' }]
}).balance, 100);

const overAllocated = state({
  payments: [{ id: 'ADV-1', orderId: null, amount: 100, method: 'Cash', status: 'SUCCESS' }],
  allocations: [{ id: 'A1', paymentId: 'ADV-1', orderId: 'O1', amountUsed: 120 }]
});
assert.equal(overAllocated.audit.overAllocatedSources.length, 1);

console.log('financeEngine tests passed');
