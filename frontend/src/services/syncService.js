import { DEFAULT_SHOP_ID, DEFAULT_BRANCH_ID } from '../constants';
import api from './api';

export const syncData = async () => {
  if (!window.electronAPI || !window.electronAPI.dbQuery) {
    console.warn("Electron API not available, skipping sync.");
    return;
  }

  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const shopId = user.shopId || DEFAULT_SHOP_ID;

    // Read branch settings from localStorage (saved by Settings.jsx)
    const savedSettings = (() => {
      try { return JSON.parse(localStorage.getItem('laundry_settings') || '{}'); } catch { return {}; }
    })();
    const branchName   = savedSettings.branchName   || 'Main Branch';
    const branchApiKey = savedSettings.branchApiKey || 'default_sync_key_change_me';
    const branchId     = savedSettings.branchId     || DEFAULT_BRANCH_ID;

    // 1. Fetch unsynced local data
    const resOrders    = await window.electronAPI.dbQuery('SELECT * FROM orders WHERE isSynced = 0', []);
    const resCustomers = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE isSynced = 0', []);
    const resPayments  = await window.electronAPI.dbQuery('SELECT * FROM payments WHERE isSynced = 0', []);
    const resTxns      = await window.electronAPI.dbQuery('SELECT * FROM account_transactions WHERE isSynced = 0', []);
    const resAllocs    = await window.electronAPI.dbQuery('SELECT * FROM advance_allocations WHERE isSynced = 0', []);
    const resDeletedOrders = await window.electronAPI.dbQuery('SELECT * FROM deleted_orders WHERE isSynced = 0', []);
    const resRefunds = await window.electronAPI.dbQuery('SELECT * FROM refunds WHERE isSynced = 0', []);
    const resCustomerLedger = await window.electronAPI.dbQuery('SELECT * FROM customer_ledger WHERE isSynced = 0', []);
    const resCashLedger = await window.electronAPI.dbQuery('SELECT * FROM cash_ledger WHERE isSynced = 0', []);
    const resSalesReturns = await window.electronAPI.dbQuery('SELECT * FROM sales_returns WHERE isSynced = 0', []);
    const resAuditLogs = await window.electronAPI.dbQuery('SELECT * FROM audit_logs WHERE isSynced = 0', []);
    
    const unsyncedOrders    = resOrders.data    || [];
    const unsyncedCustomers = resCustomers.data || [];
    const unsyncedPayments  = resPayments.data  || [];
    const unsyncedTxns      = resTxns.data      || [];
    const unsyncedAllocs    = resAllocs.data    || [];
    const unsyncedDeletedOrders = resDeletedOrders.data || [];
    const unsyncedRefunds = resRefunds.data || [];
    const unsyncedCustomerLedger = resCustomerLedger.data || [];
    const unsyncedCashLedger = resCashLedger.data || [];
    const unsyncedSalesReturns = resSalesReturns.data || [];
    const unsyncedAuditLogs = resAuditLogs.data || [];
    // The sync response includes records that were just uploaded. Never write
    // that echo back into SQLite: backend projections can omit local-only
    // financial fields and were causing values to flip every sync cycle.
    const uploadedOrderIds = new Set(unsyncedOrders.map(order => order.id));
    const uploadedCustomerIds = new Set(unsyncedCustomers.map(customer => customer.id));
    const uploadedPaymentIds = new Set(unsyncedPayments.map(payment => payment.id));
    const uploadedTransactionIds = new Set(unsyncedTxns.map(transaction => transaction.id));
    const uploadedAllocationIds = new Set(unsyncedAllocs.map(allocation => allocation.id));
    const uploadedDeletedOrderIds = new Set(unsyncedDeletedOrders.map(order => order.id));
    const uploadedRefundIds = new Set(unsyncedRefunds.map(refund => refund.id));
    const uploadedCustomerLedgerIds = new Set(unsyncedCustomerLedger.map(entry => entry.id));
    const uploadedCashLedgerIds = new Set(unsyncedCashLedger.map(entry => entry.id));
    const uploadedSalesReturnIds = new Set(unsyncedSalesReturns.map(entry => entry.id));
    const uploadedAuditLogIds = new Set(unsyncedAuditLogs.map(entry => entry.id));

    if (unsyncedOrders.length === 0 && unsyncedCustomers.length === 0 && unsyncedPayments.length === 0 && unsyncedTxns.length === 0 && unsyncedAllocs.length === 0 && unsyncedDeletedOrders.length === 0 && unsyncedRefunds.length === 0 && unsyncedCustomerLedger.length === 0 && unsyncedCashLedger.length === 0 && unsyncedSalesReturns.length === 0 && unsyncedAuditLogs.length === 0) {
      console.log('No local data to sync.');
    }

    // 2. Get last sync timestamp from SQLite database
    const syncRes = await window.electronAPI.dbQuery('SELECT lastSyncTimestamp FROM sync_state WHERE shopId = ?', [shopId]);
    const lastSyncTimestamp = (syncRes.success && syncRes.data && syncRes.data.length > 0) 
      ? syncRes.data[0].lastSyncTimestamp 
      : null;

    // 3. Send payload to backend
    const payload = {
      shopId,
      orders: unsyncedOrders.map(order => ({
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
        statusHistory: typeof order.statusHistory === 'string' ? JSON.parse(order.statusHistory) : (order.statusHistory || [])
      })),
      customers: unsyncedCustomers,
      payments: unsyncedPayments,
      accountTransactions: unsyncedTxns,
      advanceAllocations: unsyncedAllocs,
      deletedOrders: unsyncedDeletedOrders,
      refunds: unsyncedRefunds,
      customerLedgerEntries: unsyncedCustomerLedger,
      cashLedgerEntries: unsyncedCashLedger,
      salesReturns: unsyncedSalesReturns,
      auditLogs: unsyncedAuditLogs,
      lastSyncTimestamp
    };

    // Include Branch authentication headers
    const response = await api.post('/sync', payload, {
      headers: {
        'X-Branch-Id': branchId,
        'X-Branch-API-Key': branchApiKey
      }
    });

    // 3.5 Register / heartbeat this branch in the dashboard registry
    try {
      await api.post('/dashboard/register-branch', {
        branchId,
        shopId,
        branchName,
        branchApiKey,
      });
    } catch (regErr) {
      console.warn('Branch dashboard registration skipped (backend may be offline):', regErr.message);
    }

    
    if (response.data.success) {
      // 4. Mark local data as synced
      for (const order of unsyncedOrders) {
        await window.electronAPI.dbQuery('UPDATE orders SET isSynced = 1 WHERE id = ?', [order.id]);
      }
      for (const cust of unsyncedCustomers) {
        await window.electronAPI.dbQuery('UPDATE customers SET isSynced = 1 WHERE id = ?', [cust.id]);
      }
      for (const payment of unsyncedPayments) {
        await window.electronAPI.dbQuery('UPDATE payments SET isSynced = 1 WHERE id = ?', [payment.id]);
      }
      for (const txn of unsyncedTxns) {
        await window.electronAPI.dbQuery('UPDATE account_transactions SET isSynced = 1 WHERE id = ?', [txn.id]);
      }
      for (const alloc of unsyncedAllocs) {
        await window.electronAPI.dbQuery('UPDATE advance_allocations SET isSynced = 1 WHERE id = ?', [alloc.id]);
      }
      for (const order of unsyncedDeletedOrders) {
        await window.electronAPI.dbQuery('UPDATE deleted_orders SET isSynced = 1 WHERE id = ?', [order.id]);
      }
      for (const refund of unsyncedRefunds) {
        await window.electronAPI.dbQuery('UPDATE refunds SET isSynced = 1 WHERE id = ?', [refund.id]);
      }
      for (const entry of unsyncedCustomerLedger) {
        await window.electronAPI.dbQuery('UPDATE customer_ledger SET isSynced = 1 WHERE id = ?', [entry.id]);
      }
      for (const entry of unsyncedCashLedger) {
        await window.electronAPI.dbQuery('UPDATE cash_ledger SET isSynced = 1 WHERE id = ?', [entry.id]);
      }
      for (const entry of unsyncedSalesReturns) {
        await window.electronAPI.dbQuery('UPDATE sales_returns SET isSynced = 1 WHERE id = ?', [entry.id]);
      }
      for (const entry of unsyncedAuditLogs) {
        await window.electronAPI.dbQuery('UPDATE audit_logs SET isSynced = 1 WHERE id = ?', [entry.id]);
      }

      // 5. Save new items from backend to local DB
      const incomingOrders = response.data.data?.orders || [];
      const incomingCustomers = response.data.data?.customers || [];
      const incomingPayments = response.data.data?.payments || [];
      const incomingTxns = response.data.data?.accountTransactions || [];
      const incomingAllocs = response.data.data?.advanceAllocations || [];
      const incomingDeletedOrders = response.data.data?.deletedOrders || [];

      for (const order of incomingOrders) {
        if (uploadedOrderIds.has(order.id)) continue;
        // LOCAL-WINS: If the local order was updated more recently than the incoming MongoDB data,
        // skip the overwrite. This prevents the 60-second sync from reverting a just-collected payment.
        const localRes = await window.electronAPI.dbQuery(
          'SELECT updatedAt, isSynced FROM orders WHERE id = ?', [order.id]
        );
        if (localRes.success && localRes.data[0]) {
          const localUpdatedAt = new Date(localRes.data[0].updatedAt).getTime();
          const remoteUpdatedAt = new Date(order.updatedAt).getTime();
          // If local has pending changes (isSynced=0) or local is newer, skip backend overwrite
          if (localRes.data[0].isSynced === 0 || localUpdatedAt > remoteUpdatedAt) {
            console.log(`Sync: Preserving local data for order ${order.id} (local is newer or has pending changes)`);
            continue;
          }
        }

        const itemsJson = typeof order.items === 'string' ? order.items : JSON.stringify(order.items);
        const statusHistoryJson = typeof order.statusHistory === 'string' ? order.statusHistory : JSON.stringify(order.statusHistory || []);
        await window.electronAPI.dbQuery(`
          INSERT INTO orders
          (id, shopId, billNumber, branchId, customerId, status, totalAmount, paidAmount, dueAmount, paymentStatus, items, statusHistory, createdAt, isSynced, updatedAt, paymentMethod, expectedDeliveryDate, specialInstructions)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            shopId = excluded.shopId,
            billNumber = excluded.billNumber,
            branchId = excluded.branchId,
            customerId = excluded.customerId,
            status = excluded.status,
            totalAmount = excluded.totalAmount,
            paidAmount = excluded.paidAmount,
            dueAmount = excluded.dueAmount,
            paymentStatus = excluded.paymentStatus,
            items = excluded.items,
            statusHistory = excluded.statusHistory,
            isSynced = 1,
            updatedAt = excluded.updatedAt,
            paymentMethod = excluded.paymentMethod,
            expectedDeliveryDate = excluded.expectedDeliveryDate,
            specialInstructions = excluded.specialInstructions
        `, [
          order.id, 
          order.shopId, 
          order.billNumber || `BN-${Date.now().toString().slice(-6)}`,
          order.branchId || 'BRANCH_01',
          order.customerId, 
          order.status, 
          order.totalAmount, 
          order.paidAmount || 0, 
          order.dueAmount || 0, 
          order.paymentStatus || 'Pending', 
          itemsJson, 
          statusHistoryJson,
          order.createdAt, 
          order.updatedAt || new Date().toISOString(),
          order.paymentMethod || 'Cash',
          order.expectedDeliveryDate || null,
          order.specialInstructions || null
        ]);
      }

      for (const cust of incomingCustomers) {
        if (uploadedCustomerIds.has(cust.id)) continue;
        // LOCAL-WINS: If the local customer was updated more recently or has pending changes (isSynced=0),
        // skip the cloud overwrite. This protects local balance updates from sync race conditions.
        const localRes = await window.electronAPI.dbQuery(
          'SELECT updatedAt, isSynced FROM customers WHERE id = ?', [cust.id]
        );
        if (localRes.success && localRes.data[0]) {
          const localUpdatedAt = new Date(localRes.data[0].updatedAt).getTime();
          const remoteUpdatedAt = new Date(cust.updatedAt).getTime();
          if (localRes.data[0].isSynced === 0 || localUpdatedAt > remoteUpdatedAt) {
            console.log(`Sync: Preserving local data for customer ${cust.id} (local is newer or has pending changes)`);
            continue;
          }
        }

        await window.electronAPI.dbQuery(`
          INSERT INTO customers
          (id, shopId, name, phone, email, address, creditLimit, balance, openingBalance, advanceBalance, isSynced, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            shopId = excluded.shopId,
            name = excluded.name,
            phone = excluded.phone,
            email = excluded.email,
            address = excluded.address,
            creditLimit = excluded.creditLimit,
            isSynced = 1,
            updatedAt = excluded.updatedAt
        `, [
          cust.id, 
          cust.shopId, 
          cust.name, 
          cust.phone || '', 
          cust.email || '', 
          cust.address || '', 
          cust.creditLimit || 0, 
          cust.balance || 0, 
          cust.createdAt || cust.updatedAt || new Date().toISOString(),
          cust.updatedAt || new Date().toISOString()
        ]);
      }

      for (const payment of incomingPayments) {
        if (uploadedPaymentIds.has(payment.id)) continue;
        // LOCAL-WINS: Check updatedAt to resolve conflicts or prevent overwrites of newer local changes.
        const localRes = await window.electronAPI.dbQuery(
          'SELECT updatedAt, isSynced FROM payments WHERE id = ?', [payment.id]
        );
        if (localRes.success && localRes.data[0]) {
          const localUpdatedAt = new Date(localRes.data[0].updatedAt).getTime();
          const remoteUpdatedAt = new Date(payment.updatedAt).getTime();
          if (localRes.data[0].isSynced === 0 || localUpdatedAt > remoteUpdatedAt) {
            console.log(`Sync: Preserving local data for payment ${payment.id} (local is newer or has pending changes)`);
            continue;
          }
        }

        await window.electronAPI.dbQuery(`
          INSERT INTO payments
          (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            customerId = excluded.customerId,
            orderId = excluded.orderId,
            shopId = excluded.shopId,
            amount = excluded.amount,
            method = excluded.method,
            status = excluded.status,
            isSynced = 1,
            updatedAt = excluded.updatedAt,
            paymentReference = COALESCE(excluded.paymentReference, payments.paymentReference)
        `, [
          payment.id,
          payment.customerId || null,
          payment.orderId || null,
          payment.shopId,
          payment.amount,
          payment.method,
          payment.status,
          payment.createdAt,
          payment.updatedAt || new Date().toISOString(),
          payment.paymentReference || null
        ]);
      }

      for (const txn of incomingTxns) {
        if (uploadedTransactionIds.has(txn.id)) continue;
        const localRes = await window.electronAPI.dbQuery(
          'SELECT updatedAt, isSynced FROM account_transactions WHERE id = ?', [txn.id]
        );
        if (localRes.success && localRes.data[0]) {
          const localUpdatedAt = new Date(localRes.data[0].updatedAt).getTime();
          const remoteUpdatedAt = new Date(txn.updatedAt).getTime();
          if (localRes.data[0].isSynced === 0 || localUpdatedAt > remoteUpdatedAt) {
            console.log(`Sync: Preserving local data for transaction ${txn.id} (local is newer or has pending changes)`);
            continue;
          }
        }

        await window.electronAPI.dbQuery(`
          INSERT OR REPLACE INTO account_transactions 
          (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `, [
          txn.id,
          txn.shopId,
          txn.accountType,
          txn.type,
          txn.category,
          txn.amount,
          txn.description || null,
          txn.date || null,
          txn.updatedAt || new Date().toISOString(),
          txn.icon || null,
          txn.bankAccountId || null
        ]);
      }

      for (const allocation of incomingAllocs) {
        if (uploadedAllocationIds.has(allocation.id)) continue;
        const localRes = await window.electronAPI.dbQuery(
          'SELECT updatedAt, isSynced FROM advance_allocations WHERE id = ?', [allocation.id]
        );
        if (localRes.success && localRes.data[0]) {
          const localUpdatedAt = new Date(localRes.data[0].updatedAt).getTime();
          const remoteUpdatedAt = new Date(allocation.updatedAt).getTime();
          if (localRes.data[0].isSynced === 0 || localUpdatedAt > remoteUpdatedAt) continue;
        }

        await window.electronAPI.dbQuery(`
          INSERT OR REPLACE INTO advance_allocations
          (id, paymentId, orderId, amountUsed, date, isSynced, updatedAt)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `, [
          allocation.id,
          allocation.paymentId,
          allocation.orderId,
          allocation.amountUsed,
          allocation.date || allocation.createdAt || null,
          allocation.updatedAt || new Date().toISOString()
        ]);
      }

      for (const order of incomingDeletedOrders) {
        if (uploadedDeletedOrderIds.has(order.id)) continue;
        const localRes = await window.electronAPI.dbQuery('SELECT isSynced FROM deleted_orders WHERE id = ?', [order.id]);
        if (localRes.success && localRes.data[0]?.isSynced === 0) continue;
        await window.electronAPI.dbQuery(`
          INSERT INTO deleted_orders
            (id, shopId, billNumber, customerId, customerName, customerPhone, totalAmount, items, createdAt, deletedAt, deletedBy, originalPaymentStatus, paidAmount, returnStatus, approvedBy, originalPaymentMethod, payments, refundMethod, returnedAt, refundStatus, isSynced, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
          ON CONFLICT(id) DO UPDATE SET
            returnStatus = excluded.returnStatus,
            refundStatus = excluded.refundStatus,
            refundMethod = excluded.refundMethod,
            returnedAt = excluded.returnedAt,
            payments = excluded.payments,
            isSynced = 1,
            updatedAt = excluded.updatedAt
        `, [
          order.id, order.shopId, order.billNumber || '', order.customerId || null,
          order.customerName || '', order.customerPhone || '', order.totalAmount || 0,
          typeof order.items === 'string' ? order.items : JSON.stringify(order.items || []),
          order.createdAt || null, order.deletedAt || null, order.deletedBy || null,
          order.originalPaymentStatus || null, order.paidAmount || 0, order.returnStatus || 'N/A',
          order.approvedBy || null, order.originalPaymentMethod || null,
          typeof order.payments === 'string' ? order.payments : JSON.stringify(order.payments || []),
          order.refundMethod || null, order.returnedAt || null, order.refundStatus || 'Deleted',
          order.updatedAt || new Date().toISOString()
        ]);
      }

      const importImmutableRecords = async (table, columns, records, uploadedIds) => {
        const placeholders = columns.map(() => '?').join(', ');
        for (const record of records || []) {
          if (uploadedIds.has(record.id)) continue;
          const values = columns.map((column) => {
            const value = record[column] ?? null;
            return column === 'details' && value && typeof value !== 'string'
              ? JSON.stringify(value)
              : value;
          });
          await window.electronAPI.dbQuery(
            `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}, isSynced, updatedAt) VALUES (${placeholders}, 1, ?)`,
            [...values, record.updatedAt || record.createdAt || record.timestamp || new Date().toISOString()]
          );
        }
      };

      await importImmutableRecords('refunds', ['id', 'shopId', 'orderId', 'customerId', 'amount', 'refundMethod', 'reason', 'createdBy', 'createdAt'], response.data.data?.refunds, uploadedRefundIds);
      await importImmutableRecords('customer_ledger', ['id', 'shopId', 'customerId', 'orderId', 'transactionType', 'debit', 'credit', 'balance', 'description', 'createdAt'], response.data.data?.customerLedgerEntries, uploadedCustomerLedgerIds);
      await importImmutableRecords('cash_ledger', ['id', 'shopId', 'branchId', 'orderId', 'paymentId', 'refundId', 'type', 'paymentMethod', 'amount', 'description', 'createdAt'], response.data.data?.cashLedgerEntries, uploadedCashLedgerIds);
      await importImmutableRecords('sales_returns', ['id', 'shopId', 'orderId', 'customerId', 'returnAmount', 'reason', 'createdBy', 'createdAt'], response.data.data?.salesReturns, uploadedSalesReturnIds);
      await importImmutableRecords('audit_logs', ['id', 'event', 'details', 'userId', 'userRole', 'timestamp', 'device'], response.data.data?.auditLogs, uploadedAuditLogIds);

      // 5.4 Save incoming services from backend
      const incomingServices = response.data.data?.services || [];
      for (const service of incomingServices) {
        const pricingJson = typeof service.pricing === 'string' ? service.pricing : JSON.stringify(service.pricing || []);
        await window.electronAPI.dbQuery(`
          INSERT OR REPLACE INTO services 
          (id, shopId, name, price, icon, image, category, taxRate, isSynced, updatedAt, pricing) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `, [
          service.id,
          service.shopId,
          service.name,
          service.price || 0,
          service.icon || null,
          service.image || null,
          service.category || null,
          service.taxRate || null,
          service.updatedAt || new Date().toISOString(),
          pricingJson
        ]);
      }

      // 5.8 Save incoming categories from backend
      const incomingCategories = response.data.data?.categories || [];
      for (const cat of incomingCategories) {
        await window.electronAPI.dbQuery(`
          INSERT OR REPLACE INTO service_categories 
          (id, shopId, name, icon, isSynced, updatedAt) 
          VALUES (?, ?, ?, ?, 1, ?)
        `, [
          cat.id,
          cat.shopId,
          cat.name,
          cat.icon || null,
          cat.updatedAt || new Date().toISOString()
        ]);
      }

      // Update last sync time in SQLite database
      await window.electronAPI.dbQuery(
        'INSERT OR REPLACE INTO sync_state (shopId, lastSyncTimestamp, updatedAt) VALUES (?, ?, ?)',
        [shopId, response.data.timestamp, new Date().toISOString()]
      );
      console.log('Sync completed successfully');
      return true;
    }
  } catch (error) {
    if (error.response && error.response.status === 503) {
      console.warn('Sync skipped: Cloud database is offline.');
    } else {
      console.error('Sync failed:', error.message || error);
    }
    return false;
  }
};
