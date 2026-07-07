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
    
    const unsyncedOrders    = resOrders.data    || [];
    const unsyncedCustomers = resCustomers.data || [];
    const unsyncedPayments  = resPayments.data  || [];
    const unsyncedTxns      = resTxns.data      || [];

    if (unsyncedOrders.length === 0 && unsyncedCustomers.length === 0 && unsyncedPayments.length === 0 && unsyncedTxns.length === 0) {
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

      // 5. Save new items from backend to local DB
      const incomingOrders = response.data.data?.orders || [];
      const incomingCustomers = response.data.data?.customers || [];
      const incomingPayments = response.data.data?.payments || [];
      const incomingTxns = response.data.data?.accountTransactions || [];

      for (const order of incomingOrders) {
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
          INSERT OR REPLACE INTO orders 
          (id, shopId, billNumber, branchId, customerId, status, totalAmount, paidAmount, dueAmount, paymentStatus, items, statusHistory, createdAt, isSynced, updatedAt, paymentMethod, expectedDeliveryDate, specialInstructions) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
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
          INSERT OR REPLACE INTO customers 
          (id, shopId, name, phone, email, address, creditLimit, balance, isSynced, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
          cust.id, 
          cust.shopId, 
          cust.name, 
          cust.phone || '', 
          cust.email || '', 
          cust.address || '', 
          cust.creditLimit || 0, 
          cust.balance || 0, 
          cust.updatedAt || new Date().toISOString()
        ]);
      }

      for (const payment of incomingPayments) {
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
          INSERT OR REPLACE INTO payments 
          (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
          payment.id,
          payment.customerId || null,
          payment.orderId || null,
          payment.shopId,
          payment.amount,
          payment.method,
          payment.status,
          payment.createdAt,
          payment.updatedAt || new Date().toISOString()
        ]);
      }

      for (const txn of incomingTxns) {
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
    console.error('Sync failed:', error);
    return false;
  }
};
