const { calculateCustomerFinancialState, roundCurrency, EPSILON } = require('./financeEngine');

const PAYMENT_ACCOUNT_TYPES = {
  Cash: 'CASH',
  Card: 'BANK',
  UPI: 'BANK',
  Bank: 'BANK',
  Nomod: 'GATEWAY'
};

function nowIso() {
  return new Date().toISOString();
}

function toAmount(value) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

function getDiscountScope(payment) {
  if (payment?.discountScope === 'order' || payment?.discountScope === 'settlement') {
    return payment.discountScope;
  }
  const reference = String(payment?.paymentReference || payment?.id || '');
  if (reference.startsWith('SETDISC-') || !payment?.orderId) return 'settlement';
  return 'order';
}

function getFinanceState(db, customerId) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) throw new Error('Customer not found');

  const orders = db.prepare('SELECT * FROM orders WHERE customerId = ?').all(customerId);
  const payments = db.prepare('SELECT * FROM payments WHERE customerId = ?').all(customerId);
  const allocations = db.prepare(`
    SELECT a.* FROM advance_allocations a
    JOIN payments p ON p.id = a.paymentId
    WHERE p.customerId = ?
  `).all(customerId);
  const deletedOrders = db.prepare('SELECT * FROM deleted_orders WHERE customerId = ?').all(customerId);

  return calculateCustomerFinancialState({ customer, orders, payments, allocations, deletedOrders });
}

function getNextFinanceReference(db, type = 'PAY') {
  // Discounts are accounting adjustments, not money receipts. They retain a
  // dedicated record ID and never consume the customer-facing RV sequence.
  if (type === 'DISC' || type === 'SETDISC') {
    const info = db.prepare('INSERT INTO discount_sequence DEFAULT VALUES').run();
    const sequence = Number(info.lastInsertRowid);
    db.prepare('DELETE FROM discount_sequence WHERE id < ?').run(sequence);
    const paymentId = `DISC-${String(sequence).padStart(7, '0')}`;
    return {
      paymentId,
      paymentReference: paymentId,
      sequence,
      accountTransactionId: `FIN-TXN-${paymentId}`,
      usesRv: false
    };
  }

  const info = db.prepare('INSERT INTO payment_sequence DEFAULT VALUES').run();
  const sequence = Number(info.lastInsertRowid);
  db.prepare('DELETE FROM payment_sequence WHERE id < ?').run(sequence);
  const padded = String(sequence).padStart(6, '0');
  return {
    paymentId: `RV-${padded}`,
    paymentReference: `${type}-${padded}`,
    sequence,
    accountTransactionId: `FIN-TXN-${padded}`,
    usesRv: true
  };
}

function getAccountType(method) {
  return PAYMENT_ACCOUNT_TYPES[method] || 'CASH';
}

function writeCustomerState(db, customerId, state, timestamp) {
  db.prepare(`
    UPDATE customers
    SET balance = ?, advanceBalance = ?, isSynced = 0, updatedAt = ?
    WHERE id = ?
  `).run(state.balance, state.availableAdvance, timestamp, customerId);
}

function addAuditEvent(db, { event, details, actor, timestamp }) {
  db.prepare(`
    INSERT INTO audit_logs (id, event, details, userId, userRole, timestamp, device)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `AUDIT-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    event,
    JSON.stringify(details),
    actor?.id || actor?.name || 'System',
    actor?.role || 'system',
    timestamp,
    process.platform || 'Desktop'
  );
}

/**
 * Posts a customer settlement as one SQLite transaction.
 *
 * This is intentionally opt-in while old screens are migrated. New callers
 * must not separately write orders, payments, customer balances or accounts.
 */
function settleCustomerBalance(db, {
  customerId,
  shopId = 'SHOP_01',
  orderId = null,
  splits = [],
  discount = 0,
  cardCommissionRate = 0,
  actor = {},
  description = 'Customer settlement'
} = {}) {
  if (!customerId || customerId === 'Walk-in') {
    throw new Error('A saved customer is required for settlement');
  }

  const normalisedSplits = (Array.isArray(splits) ? splits : [])
    .map((split) => ({
      method: String(split?.method || '').trim(),
      amount: roundCurrency(split?.amount),
      bankAccountId: split?.bankAccountId || null
    }))
    .filter((split) => split.amount > EPSILON);
  const settlementPaymentAmount = roundCurrency(
    normalisedSplits.reduce((sum, split) => sum + split.amount, 0)
  );
  const discountAmount = roundCurrency(discount);
  const commissionRate = Math.max(0, toAmount(cardCommissionRate));

  if (normalisedSplits.length === 0 && discountAmount <= EPSILON) {
    throw new Error('Enter a payment or discount amount');
  }
  if (normalisedSplits.some((split) => !PAYMENT_ACCOUNT_TYPES[split.method])) {
    throw new Error('Unsupported payment method');
  }
  if (discountAmount < 0) throw new Error('Discount cannot be negative');

  return db.transaction(() => {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) throw new Error('Customer not found');

    // Do not let a new payment silently absorb an unresolved legacy mismatch.
    // The manager can inspect it in Financial Integrity before posting money.
    const initialState = getFinanceState(db, customerId);
    if (Math.abs(toAmount(customer.balance) - initialState.balance) > EPSILON) {
      throw new Error('This customer has a legacy balance difference. Review Financial Integrity before posting a new settlement.');
    }

    const allDueOrders = db.prepare(`
      SELECT * FROM orders
      WHERE customerId = ?
        AND IFNULL(status, '') NOT IN ('Deleted', 'Cancelled')
        AND IFNULL(dueAmount, 0) > ?
      ORDER BY createdAt ASC
    `).all(customerId, EPSILON);
    const selectedOrder = orderId
      ? db.prepare(`
          SELECT * FROM orders
          WHERE id = ? AND customerId = ? AND IFNULL(status, '') NOT IN ('Deleted', 'Cancelled')
        `).get(orderId, customerId)
      : null;

    if (orderId && !selectedOrder) throw new Error('Order is unavailable for settlement');

    // A selected invoice is settled first. Any remaining payment must then
    // settle this customer's other unpaid invoices before it can be advance.
    const targetOrders = selectedOrder
      ? [selectedOrder, ...allDueOrders.filter((order) => order.id !== selectedOrder.id)]
      : allDueOrders;
    const totalDue = roundCurrency(targetOrders.reduce((sum, order) => sum + Math.max(0, toAmount(order.dueAmount)), 0));
    let accountDueRemaining = roundCurrency(Math.max(0, initialState.outstanding - totalDue));
    const selectedInvoiceDue = Math.max(0, toAmount(selectedOrder?.dueAmount));
    if (selectedOrder && discountAmount > selectedInvoiceDue + EPSILON) {
      throw new Error('Discount is greater than the selected invoice due amount');
    }
    // General Customer / Quick Settle discounts belong to the settlement, not
    // to a particular invoice. When money is being received, validate the
    // discount against that settlement payment. A remaining settlement
    // discount is a customer credit, even when the current due is zero.
    if (!selectedOrder && settlementPaymentAmount > EPSILON && discountAmount > settlementPaymentAmount + EPSILON) {
      throw new Error('Discount is greater than the settlement payment amount');
    }
    if (!selectedOrder && settlementPaymentAmount <= EPSILON && discountAmount > initialState.outstanding + EPSILON) {
      throw new Error('Discount is greater than the customer due amount');
    }

    const timestamp = nowIso();
    const applied = [];
    const paymentIds = [];
    const transactionIds = [];
    const supportsPaymentBreakdown = db.prepare('PRAGMA table_info(orders)').all()
      .some((column) => column.name === 'paymentBreakdown');
    let orderCursor = 0;

    const applyCredit = (method, creditAmount, bankAccountId = null, discountScope = 'order') => {
      let remaining = roundCurrency(creditAmount);
      while (remaining > EPSILON && orderCursor < targetOrders.length) {
        const order = targetOrders[orderCursor];
        const due = Math.max(0, toAmount(order.dueAmount));
        if (due <= EPSILON) {
          orderCursor += 1;
          continue;
        }

        const appliedAmount = roundCurrency(Math.min(remaining, due));
        const newPaid = roundCurrency(toAmount(order.paidAmount) + appliedAmount);
        const newDue = roundCurrency(Math.max(0, toAmount(order.totalAmount) - newPaid));
        const newPaymentStatus = newDue <= EPSILON ? 'Paid' : 'Partial';
        const newStatus = newDue <= EPSILON && order.status === 'Payment Pending' ? 'Confirmed' : order.status;
        let paymentBreakdown = {};
        try {
          paymentBreakdown = typeof order.paymentBreakdown === 'string'
            ? (JSON.parse(order.paymentBreakdown || '{}') || {})
            : (order.paymentBreakdown || {});
        } catch (_) {
          paymentBreakdown = {};
        }
        if (method === 'Discount') {
          const discountKey = discountScope === 'settlement' ? 'settlementDiscount' : 'orderDiscount';
          paymentBreakdown[discountKey] = roundCurrency(toAmount(paymentBreakdown[discountKey]) + appliedAmount);
        } else {
          const methodKey = String(method || '').toLowerCase();
          paymentBreakdown[methodKey] = roundCurrency(toAmount(paymentBreakdown[methodKey]) + appliedAmount);
        }
        const reference = getNextFinanceReference(
          db,
          method === 'Discount' ? 'DISC' : 'SET'
        );

        if (supportsPaymentBreakdown) {
          db.prepare(`
            UPDATE orders
            SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, paymentMethod = ?, paymentBreakdown = ?, isSynced = 0, updatedAt = ?
            WHERE id = ?
          `).run(newPaid, newDue, newPaymentStatus, newStatus, method, JSON.stringify(paymentBreakdown), timestamp, order.id);
        } else {
          db.prepare(`
            UPDATE orders
            SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, paymentMethod = ?, isSynced = 0, updatedAt = ?
            WHERE id = ?
          `).run(newPaid, newDue, newPaymentStatus, newStatus, method, timestamp, order.id);
        }
        db.prepare(`
          INSERT INTO payments
            (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference, discountScope)
          VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?, 0, ?, ?, ?)
        `).run(reference.paymentId, customerId, order.id, shopId, appliedAmount, method, timestamp, timestamp, reference.paymentReference, method === 'Discount' ? discountScope : null);

        const accountTransactionId = reference.accountTransactionId;
        db.prepare(`
          INSERT INTO account_transactions
            (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
        `).run(
          accountTransactionId,
          shopId,
          method === 'Discount' ? 'CASH' : getAccountType(method),
          method === 'Discount' ? 'EXPENSE' : 'INCOME',
          method === 'Discount' ? 'Discount Given' : 'Credit Settlement',
          appliedAmount,
          `${description} — Order ${order.id} via ${method}`,
          timestamp.replace('T', ' ').substring(0, 19),
          timestamp,
          method === 'Discount' ? 'Percent' : 'DollarSign',
          bankAccountId,
          actor.name || actor.id || 'System',
          actor.id || 'SYSTEM',
          actor.role || 'system'
        );

        paymentIds.push(reference.paymentId);
        transactionIds.push(accountTransactionId);
        applied.push({ orderId: order.id, method, amount: appliedAmount, paymentId: reference.paymentId, discountScope: method === 'Discount' ? discountScope : null });
        order.paidAmount = newPaid;
        order.dueAmount = newDue;
        order.paymentBreakdown = paymentBreakdown;
        remaining = roundCurrency(remaining - appliedAmount);
        if (newDue <= EPSILON) orderCursor += 1;
      }
      return remaining;
    };

    const postUnlinkedReceipt = ({
      method,
      amount,
      bankAccountId,
      referenceType,
      category,
      receiptDescription,
      accountType = getAccountType(method),
      transactionType = 'INCOME',
      icon = 'DollarSign'
    }) => {
      const reference = getNextFinanceReference(db, referenceType);
      const accountTransactionId = reference.accountTransactionId;
      const discountScope = method === 'Discount' ? 'settlement' : null;
      db.prepare(`
        INSERT INTO payments
          (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference, discountScope)
        VALUES (?, ?, NULL, ?, ?, ?, 'SUCCESS', ?, 0, ?, ?, ?)
      `).run(reference.paymentId, customerId, shopId, amount, method, timestamp, timestamp, reference.paymentReference, discountScope);
      db.prepare(`
        INSERT INTO account_transactions
          (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
      `).run(
        accountTransactionId,
        shopId,
        accountType,
        transactionType,
        category,
        amount,
        `${description} - ${receiptDescription} via ${method}`,
        timestamp.replace('T', ' ').substring(0, 19),
        timestamp,
        icon,
        bankAccountId,
        actor.name || actor.id || 'System',
        actor.id || 'SYSTEM',
        actor.role || 'system'
      );
      paymentIds.push(reference.paymentId);
      transactionIds.push(accountTransactionId);
    };

    // A selected invoice gets an order discount. A customer/quick settlement
    // gets a settlement discount, kept distinct in the receipt reference.
    const discountScope = selectedOrder ? 'order' : 'settlement';
    let remainingDiscount = applyCredit('Discount', discountAmount, null, discountScope);
    let settlementDiscountApplied = 0;
    if (remainingDiscount > EPSILON && discountScope === 'settlement' && accountDueRemaining > EPSILON) {
      const accountDiscount = roundCurrency(Math.min(remainingDiscount, accountDueRemaining));
      postUnlinkedReceipt({
        method: 'Discount',
        amount: accountDiscount,
        bankAccountId: null,
        referenceType: 'SETDISC',
        category: 'Discount Given',
        receiptDescription: 'Settlement discount',
        accountType: 'CASH',
        transactionType: 'EXPENSE',
        icon: 'Percent'
      });
      accountDueRemaining = roundCurrency(accountDueRemaining - accountDiscount);
      settlementDiscountApplied = accountDiscount;
      remainingDiscount = roundCurrency(remainingDiscount - accountDiscount);
    }
    if (remainingDiscount > EPSILON && discountScope === 'settlement') {
      // A Quick Settle discount may be entered against the payment amount even
      // when there is no outstanding invoice. Keep that remainder as a clear
      // settlement-discount credit; it is never attached to an invoice.
      postUnlinkedReceipt({
        method: 'Discount',
        amount: remainingDiscount,
        bankAccountId: null,
        referenceType: 'SETDISC',
        category: 'Discount Given',
        receiptDescription: 'Settlement discount credit',
        accountType: 'CASH',
        transactionType: 'EXPENSE',
        icon: 'Percent'
      });
      settlementDiscountApplied = roundCurrency(settlementDiscountApplied + remainingDiscount);
      remainingDiscount = 0;
    }
    if (remainingDiscount > EPSILON) {
      throw new Error('Discount could not be applied to the selected invoice');
    }

    let accountPaymentApplied = 0;
    let advanceCreated = 0;
    normalisedSplits.forEach((split) => {
      let remaining = applyCredit(split.method, split.amount, split.bankAccountId);
      if (remaining <= EPSILON) return;

      // Opening/account debt is a real due even when it has no order row.
      // Record it separately so the UI and accounts never call it an advance.
      if (accountDueRemaining > EPSILON) {
        const accountPayment = roundCurrency(Math.min(remaining, accountDueRemaining));
        postUnlinkedReceipt({
          method: split.method,
          amount: accountPayment,
          bankAccountId: split.bankAccountId,
          referenceType: 'ACC',
          category: 'Account Settlement',
          receiptDescription: 'Opening/account due payment'
        });
        accountDueRemaining = roundCurrency(accountDueRemaining - accountPayment);
        accountPaymentApplied = roundCurrency(accountPaymentApplied + accountPayment);
        remaining = roundCurrency(remaining - accountPayment);
      }

      if (remaining <= EPSILON) return;

      const reference = getNextFinanceReference(db, 'ADV');
      const accountTransactionId = reference.accountTransactionId;
      db.prepare(`
        INSERT INTO payments
          (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference)
        VALUES (?, ?, NULL, ?, ?, ?, 'SUCCESS', ?, 0, ?, ?)
      `).run(reference.paymentId, customerId, shopId, remaining, split.method, timestamp, timestamp, reference.paymentReference);
      db.prepare(`
        INSERT INTO account_transactions
          (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole)
        VALUES (?, ?, ?, 'INCOME', 'Customer Advance', ?, ?, ?, 0, ?, 'DollarSign', ?, ?, ?, ?)
      `).run(
        accountTransactionId,
        shopId,
        getAccountType(split.method),
        remaining,
        `${description} — Customer advance via ${split.method}`,
        timestamp.replace('T', ' ').substring(0, 19),
        timestamp,
        split.bankAccountId,
        actor.name || actor.id || 'System',
        actor.id || 'SYSTEM',
        actor.role || 'system'
      );
      paymentIds.push(reference.paymentId);
      transactionIds.push(accountTransactionId);
      advanceCreated = roundCurrency(advanceCreated + remaining);
    });

    let cardCommission = 0;
    normalisedSplits
      .filter((split) => split.method === 'Card' && commissionRate > EPSILON)
      .forEach((split, index) => {
        const commissionAmount = roundCurrency(split.amount * (commissionRate / 100));
        if (commissionAmount <= EPSILON) return;
        const transactionId = `FIN-COMM-${Date.now()}-${index}`;
        db.prepare(`
          INSERT INTO account_transactions
            (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole)
          VALUES (?, ?, 'BANK', 'EXPENSE', 'Card Commission', ?, ?, ?, 0, ?, 'Percent', ?, ?, ?, ?)
        `).run(
          transactionId,
          shopId,
          commissionAmount,
          `${description} â€” Card commission`,
          timestamp.replace('T', ' ').substring(0, 19),
          timestamp,
          split.bankAccountId,
          actor.name || actor.id || 'System',
          actor.id || 'SYSTEM',
          actor.role || 'system'
        );
        transactionIds.push(transactionId);
        cardCommission = roundCurrency(cardCommission + commissionAmount);
      });

    // An order can be paid using several receipts. Store a clear display value
    // only after all receipts have been posted, rather than overwriting it for
    // every split payment.
    targetOrders.forEach((order) => {
      const methods = db.prepare(`
        SELECT DISTINCT method
        FROM payments
        WHERE orderId = ?
          AND method NOT IN ('Discount', 'Advance', 'Refund Advance', 'System Auto')
      `).all(order.id).map((payment) => payment.method).filter(Boolean);
      const paymentMethod = methods.length > 1 ? 'Multipayment' : (methods[0] || 'Not Paid');
      db.prepare('UPDATE orders SET paymentMethod = ?, updatedAt = ? WHERE id = ?')
        .run(paymentMethod, timestamp, order.id);
    });

    const state = getFinanceState(db, customerId);
    writeCustomerState(db, customerId, state, timestamp);
    db.prepare(`
      INSERT INTO customer_ledger
        (id, shopId, customerId, orderId, transactionType, debit, credit, balance, description, createdAt)
      VALUES (?, ?, ?, ?, 'PAYMENT', 0, ?, ?, ?, ?)
    `).run(
      `CUST-PAY-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      shopId,
      customerId,
      orderId || null,
      roundCurrency(normalisedSplits.reduce((sum, split) => sum + split.amount, 0) + discountAmount),
      state.balance,
      description,
      timestamp
    );
    addAuditEvent(db, {
      event: 'CUSTOMER_SETTLEMENT_POSTED',
      actor,
      timestamp,
      details: {
        customerId,
        orderId,
        paymentIds,
        transactionIds,
        applied,
        discount: discountAmount,
        discountScope,
        settlementDiscountApplied,
        accountPaymentApplied,
        advanceCreated,
        cardCommission,
        finalBalance: state.balance
      }
    });

    return { success: true, customerId, applied, paymentIds, transactionIds, discount: discountAmount, discountScope, settlementDiscountApplied, accountPaymentApplied, advanceCreated, cardCommission, state };
  })();
}

function editDiscountReceipt(db, {
  paymentId,
  amount,
  actor = {}
} = {}) {
  const newAmount = roundCurrency(amount);
  if (!paymentId) throw new Error('Discount receipt is required');
  if (newAmount < 0) throw new Error('Discount cannot be negative');

  return db.transaction(() => {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    if (!payment || payment.method !== 'Discount') throw new Error('Discount receipt not found');

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(payment.customerId);
    if (!customer) throw new Error('Customer not found');
    const initialState = getFinanceState(db, payment.customerId);
    if (Math.abs(toAmount(customer.balance) - initialState.balance) > EPSILON) {
      throw new Error('This customer has a legacy balance difference. Review Financial Integrity before editing a discount.');
    }

    const oldAmount = roundCurrency(payment.amount);
    const difference = roundCurrency(newAmount - oldAmount);
    const timestamp = nowIso();
    const supportsPaymentBreakdown = db.prepare('PRAGMA table_info(orders)').all()
      .some((column) => column.name === 'paymentBreakdown');

    if (payment.orderId) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND customerId = ?').get(payment.orderId, payment.customerId);
      if (!order) throw new Error('Linked invoice is unavailable');

      const newPaid = roundCurrency(toAmount(order.paidAmount) + difference);
      if (newPaid < -EPSILON || newPaid > toAmount(order.totalAmount) + EPSILON) {
        throw new Error('Discount amount is outside the linked invoice amount');
      }
      const newDue = roundCurrency(Math.max(0, toAmount(order.totalAmount) - newPaid));
      const newPaymentStatus = newDue <= EPSILON ? 'Paid' : (newPaid > EPSILON ? 'Partial' : 'Credit');
      const newStatus = newDue <= EPSILON && order.status === 'Payment Pending' ? 'Confirmed' : order.status;
      let paymentBreakdown = {};
      try {
        paymentBreakdown = typeof order.paymentBreakdown === 'string'
          ? (JSON.parse(order.paymentBreakdown || '{}') || {})
          : (order.paymentBreakdown || {});
      } catch (_) {
        paymentBreakdown = {};
      }
      const discountKey = getDiscountScope(payment) === 'settlement'
        ? 'settlementDiscount'
        : 'orderDiscount';
      paymentBreakdown[discountKey] = roundCurrency(Math.max(0, toAmount(paymentBreakdown[discountKey]) + difference));
      if (supportsPaymentBreakdown) {
        db.prepare(`
          UPDATE orders
          SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, paymentBreakdown = ?, isSynced = 0, updatedAt = ?
          WHERE id = ?
        `).run(newPaid, newDue, newPaymentStatus, newStatus, JSON.stringify(paymentBreakdown), timestamp, order.id);
      } else {
        db.prepare(`
          UPDATE orders
          SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, isSynced = 0, updatedAt = ?
          WHERE id = ?
        `).run(newPaid, newDue, newPaymentStatus, newStatus, timestamp, order.id);
      }
    } else if (difference > EPSILON && difference > initialState.outstanding + EPSILON) {
      throw new Error('Discount is greater than the remaining customer due amount');
    }

    db.prepare('UPDATE payments SET amount = ?, isSynced = 0, updatedAt = ? WHERE id = ?')
      .run(newAmount, timestamp, payment.id);

    const sequence = String(payment.paymentReference || payment.id || '').split('-').pop();
    const accountTransactionId = /^(DISC|SETDISC)-/.test(String(payment.id || ''))
      ? `FIN-TXN-${payment.id}`
      : (sequence ? `FIN-TXN-${sequence}` : null);
    if (accountTransactionId) {
      db.prepare('UPDATE account_transactions SET amount = ?, isSynced = 0, updatedAt = ? WHERE id = ?')
        .run(newAmount, timestamp, accountTransactionId);
    }

    const state = getFinanceState(db, payment.customerId);
    writeCustomerState(db, payment.customerId, state, timestamp);
    db.prepare(`
      INSERT INTO customer_ledger
        (id, shopId, customerId, orderId, transactionType, debit, credit, balance, description, createdAt)
      VALUES (?, ?, ?, ?, 'DISCOUNT_EDIT', 0, ?, ?, ?, ?)
    `).run(
      `CUST-DISC-EDIT-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      payment.shopId || 'SHOP_01',
      payment.customerId,
      payment.orderId || null,
      difference,
      state.balance,
      `${getDiscountScope(payment) === 'settlement' ? 'Settlement' : 'Order'} discount edited from ${oldAmount} to ${newAmount}`,
      timestamp
    );
    addAuditEvent(db, {
      event: 'DISCOUNT_RECEIPT_EDITED',
      actor,
      timestamp,
      details: {
        paymentId: payment.id,
        paymentReference: payment.paymentReference,
        customerId: payment.customerId,
        orderId: payment.orderId || null,
        scope: getDiscountScope(payment),
        oldAmount,
        newAmount,
        finalBalance: state.balance
      }
    });

    return { success: true, paymentId, oldAmount, newAmount, difference, state };
  })();
}

module.exports = {
  getFinanceState,
  settleCustomerBalance,
  editDiscountReceipt
};
