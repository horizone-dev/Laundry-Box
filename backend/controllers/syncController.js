const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Payment = require('../models/Payment');
const AccountTransaction = require('../models/AccountTransaction');
const DeletedOrder = require('../models/DeletedOrder');
const FinancialRecord = require('../models/FinancialRecord');
const mongoose = require('mongoose');
const AdvanceAllocation = require('../models/AdvanceAllocation');

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

exports.syncData = async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ success: false, message: 'Sync failed: MongoDB offline' });
  }

  const {
    shopId,
    orders,
    customers,
    payments,
    accountTransactions,
    advanceAllocations,
    deletedOrders,
    refunds,
    customerLedgerEntries,
    cashLedgerEntries,
    salesReturns,
    auditLogs,
    lastSyncTimestamp
  } = req.body;

  if (!shopId) {
    return res.status(400).json({ success: false, message: 'Missing required field: shopId' });
  }

  try {
    // ────────────────────────────────────────────────────────────
    // 1. Process Orders from client
    // ────────────────────────────────────────────────────────────
    if (orders && orders.length > 0) {
      for (const order of orders) {
        try {
          const { isSynced, customerName: rawCustomerName, customerPhone, nomodLinkDate, ...rest } = order;

          // Parse JSON strings if necessary
          const statusHistory = (() => {
            try {
              return typeof order.statusHistory === 'string'
                ? JSON.parse(order.statusHistory)
                : (order.statusHistory || []);
            } catch { return []; }
          })();

          const items = (() => {
            try {
              return typeof order.items === 'string'
                ? JSON.parse(order.items)
                : (order.items || []);
            } catch { return []; }
          })();

          // --- FIX: customerName is required in the schema but not stored in the
          //     SQLite orders table. Look it up from the customers collection or
          //     use a safe fallback so Mongoose validation never fails. ---
          let resolvedCustomerName = rawCustomerName;
          if (!resolvedCustomerName && order.customerId) {
            // Try to resolve from MongoDB customers collection first
            const custDoc = await Customer.findOne({ id: order.customerId, shopId }).lean();
            resolvedCustomerName = custDoc ? custDoc.name : (order.customerId || 'Unknown Customer');
          }
          resolvedCustomerName = resolvedCustomerName || 'Unknown Customer';

          const mongoOrder = {
            ...rest,
            statusHistory,
            items,
            shopId,
            branchId: order.branchId || 'BRANCH_01',           // required field — provide default
            customerName: resolvedCustomerName,                  // required field — always populated
            customerPhone: customerPhone || '',
            billNumber: order.billNumber || `ORD-${Date.now().toString().slice(-6)}`,
            totalAmount: Number(order.totalAmount) || 0,
            paidAmount:  Number(order.paidAmount)  || 0,
            dueAmount:   Number(order.dueAmount)   || 0,
            updatedAt: new Date(),
          };

          await Order.findOneAndUpdate(
            { id: mongoOrder.id },
            { $set: mongoOrder },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
        } catch (orderErr) {
          console.error(`[Sync] Failed to upsert order ${order.id}:`, orderErr.message, orderErr.stack);
          throw new Error(`Order ${order.id} was not synced: ${orderErr.message}`);
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // 2. Process Customers from client
    // ────────────────────────────────────────────────────────────
    if (customers && customers.length > 0) {
      for (const cust of customers) {
        try {
          const { isSynced, ...rest } = cust;
          await Customer.findOneAndUpdate(
            { id: cust.id },
            { $set: { ...rest, shopId, updatedAt: new Date() } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
        } catch (custErr) {
          console.error(`[Sync] Failed to upsert customer ${cust.id}:`, custErr.message, custErr.stack);
          throw new Error(`Customer ${cust.id} was not synced: ${custErr.message}`);
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // 3. Process Payments from client
    // ────────────────────────────────────────────────────────────
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        try {
          const { isSynced, ...rest } = payment;
          await Payment.findOneAndUpdate(
            { id: payment.id, shopId },
            { $set: { ...rest, shopId, updatedAt: new Date() } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
        } catch (payErr) {
          // E11000 duplicate key errors can occur on concurrent syncs — safe to ignore
          if (payErr.code === 11000) {
            console.warn(`[Sync] Duplicate payment skipped: ${payment.id}`);
          } else {
            console.error(`[Sync] Failed to upsert payment ${payment.id}:`, payErr.message, payErr.stack);
            throw new Error(`Payment ${payment.id} was not synced: ${payErr.message}`);
          }
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // 3.5 Process AccountTransactions from client
    // ────────────────────────────────────────────────────────────
    if (accountTransactions && accountTransactions.length > 0) {
      for (const txn of accountTransactions) {
        try {
          const { isSynced, ...rest } = txn;
          await AccountTransaction.findOneAndUpdate(
            { id: txn.id, shopId },
            { $set: { ...rest, shopId, updatedAt: new Date() } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
        } catch (txnErr) {
          if (txnErr.code === 11000) {
            console.warn(`[Sync] Duplicate account transaction skipped: ${txn.id}`);
          } else {
            console.error(`[Sync] Failed to upsert account_transaction ${txn.id}:`, txnErr.message, txnErr.stack);
            throw new Error(`Account transaction ${txn.id} was not synced: ${txnErr.message}`);
          }
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // 3.7 Process Advance Allocations from client
    // ────────────────────────────────────────────────────────────
    if (advanceAllocations && advanceAllocations.length > 0) {
      for (const alloc of advanceAllocations) {
        try {
          const { isSynced, ...rest } = alloc;
          await AdvanceAllocation.findOneAndUpdate(
            { id: alloc.id, shopId },
            { $set: { ...rest, shopId, updatedAt: new Date() } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
        } catch (allocErr) {
          if (allocErr.code === 11000) {
            console.warn(`[Sync] Duplicate advance allocation skipped: ${alloc.id}`);
          } else {
            console.error(`[Sync] Failed to upsert advance_allocation ${alloc.id}:`, allocErr.message, allocErr.stack);
            throw new Error(`Advance allocation ${alloc.id} was not synced: ${allocErr.message}`);
          }
        }
      }
    }

    // Deleted-order state includes whether money was refunded or converted to
    // advance. It must travel with its payment snapshot, not only as an order
    // status, otherwise another branch can recreate an already-refunded sale.
    if (deletedOrders && deletedOrders.length > 0) {
      for (const deletedOrder of deletedOrders) {
        try {
          const { isSynced, ...rest } = deletedOrder;
          const items = typeof deletedOrder.items === 'string'
            ? JSON.parse(deletedOrder.items || '[]')
            : (deletedOrder.items || []);
          const paymentSnapshot = typeof deletedOrder.payments === 'string'
            ? JSON.parse(deletedOrder.payments || '[]')
            : (deletedOrder.payments || []);
          await DeletedOrder.findOneAndUpdate(
            { id: deletedOrder.id, shopId },
            { $set: { ...rest, shopId, items, payments: paymentSnapshot, updatedAt: new Date() } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
        } catch (deletedOrderErr) {
          console.error(`[Sync] Failed to upsert deleted order ${deletedOrder.id}:`, deletedOrderErr.message);
          throw new Error(`Deleted order ${deletedOrder.id} was not synced: ${deletedOrderErr.message}`);
        }
      }
    }

    // Ledger, refund, return and audit records are append-only financial
    // evidence. Preserve their complete local payload in one idempotent cloud
    // collection; no balance is recalculated during sync.
    const financialBatches = [
      ['refunds', refunds],
      ['customerLedgerEntries', customerLedgerEntries],
      ['cashLedgerEntries', cashLedgerEntries],
      ['salesReturns', salesReturns],
      ['auditLogs', auditLogs]
    ];
    for (const [kind, records] of financialBatches) {
      for (const record of records || []) {
        try {
          const { isSynced, ...payload } = record;
          const occurredAt = payload.createdAt || payload.timestamp || payload.updatedAt || new Date();
          await FinancialRecord.findOneAndUpdate(
            { id: record.id, shopId, kind },
            { $set: { payload, occurredAt, updatedAt: new Date() } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
        } catch (financialRecordErr) {
          console.error(`[Sync] Failed to upsert ${kind} record ${record.id}:`, financialRecordErr.message);
          throw new Error(`${kind} record ${record.id} was not synced: ${financialRecordErr.message}`);
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // 4. Process Categories from client (if sent)
    // ────────────────────────────────────────────────────────────
    if (req.body.categories && req.body.categories.length > 0) {
      for (const cat of req.body.categories) {
        try {
          const { isSynced, ...rest } = cat;
          await Category.findOneAndUpdate(
            { id: cat.id, shopId },
            { $set: { ...rest, shopId, updatedAt: new Date() } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
        } catch (catErr) {
          console.error(`[Sync] Failed to upsert category ${cat.id}:`, catErr.message, catErr.stack);
          throw new Error(`Category ${cat.id} was not synced: ${catErr.message}`);
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // 5. Fetch cloud updates since last sync and return to client
    // ────────────────────────────────────────────────────────────
    const query = {
      shopId,
      updatedAt: { $gt: new Date(lastSyncTimestamp || 0) }
    };

    const [newOrders, newCustomers, newServices, newCategories, newPayments, newAccountTransactions, newAdvanceAllocations, newDeletedOrders, newFinancialRecords] =
      await Promise.all([
        Order.find(query).lean(),
        Customer.find(query).lean(),
        Service.find(query).lean(),
        Category.find(query).lean(),
        Payment.find(query).lean(),
        AccountTransaction.find(query).lean(),
        AdvanceAllocation.find(query).lean(),
        DeletedOrder.find(query).lean(),
        FinancialRecord.find(query).lean(),
      ]);

    const financialByKind = newFinancialRecords.reduce((result, record) => {
      if (!result[record.kind]) result[record.kind] = [];
      result[record.kind].push(record.payload);
      return result;
    }, {});

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        orders: newOrders,
        customers: newCustomers,
        services: newServices,
        categories: newCategories,
        payments: newPayments,
        accountTransactions: newAccountTransactions,
        advanceAllocations: newAdvanceAllocations,
        deletedOrders: newDeletedOrders,
        refunds: financialByKind.refunds || [],
        customerLedgerEntries: financialByKind.customerLedgerEntries || [],
        cashLedgerEntries: financialByKind.cashLedgerEntries || [],
        salesReturns: financialByKind.salesReturns || [],
        auditLogs: financialByKind.auditLogs || []
      }
    });

  } catch (error) {
    // Log the full error and stack trace — never suppress
    console.error('[Sync] Unhandled sync error:', error.message);
    console.error('[Sync] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      message: `Sync failed: ${error.message}`,
      errorCode: error.code || null
    });
  }
};
