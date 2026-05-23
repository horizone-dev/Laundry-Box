import { DEFAULT_SHOP_ID } from '../constants';
import api from './api';

export const syncData = async () => {
  if (!window.electronAPI || !window.electronAPI.dbQuery) {
    console.warn("Electron API not available, skipping sync.");
    return;
  }

  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const shopId = user.shopId || DEFAULT_SHOP_ID;

    // 1. Fetch unsynced local data
    const resOrders = await window.electronAPI.dbQuery('SELECT * FROM orders WHERE isSynced = 0', []);
    const resCustomers = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE isSynced = 0', []);
    
    const unsyncedOrders = resOrders.data || [];
    const unsyncedCustomers = resCustomers.data || [];

    if (unsyncedOrders.length === 0 && unsyncedCustomers.length === 0) {
      console.log('No local data to sync.');
    }

    // 2. Get last sync timestamp from local storage
    const lastSyncTimestamp = sessionStorage.getItem('lastSyncTimestamp') || null;

    // 3. Send payload to backend
    const payload = {
      shopId,
      orders: unsyncedOrders.map(order => ({
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
        statusHistory: typeof order.statusHistory === 'string' ? JSON.parse(order.statusHistory) : (order.statusHistory || [])
      })),
      customers: unsyncedCustomers,
      lastSyncTimestamp
    };

    const response = await api.post('/sync', payload);
    
    if (response.data.success) {
      // 4. Mark local data as synced
      for (const order of unsyncedOrders) {
        await window.electronAPI.dbQuery('UPDATE orders SET isSynced = 1 WHERE id = ?', [order.id]);
      }
      for (const cust of unsyncedCustomers) {
        await window.electronAPI.dbQuery('UPDATE customers SET isSynced = 1 WHERE id = ?', [cust.id]);
      }

      // 5. Save new items from backend to local DB
      const incomingOrders = response.data.data?.orders || [];
      const incomingCustomers = response.data.data?.customers || [];

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
          (id, shopId, billNumber, branchId, customerId, status, totalAmount, paidAmount, dueAmount, paymentStatus, items, statusHistory, createdAt, isSynced, updatedAt, paymentMethod) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
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
          order.paymentMethod || 'CASH'
        ]);
      }

      for (const cust of incomingCustomers) {
        await window.electronAPI.dbQuery(`
          INSERT OR REPLACE INTO customers 
          (id, shopId, name, phone, email, address, creditLimit, balance, isSynced, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [cust.id, cust.shopId, cust.name, cust.phone, cust.email, cust.address, cust.creditLimit || 0, cust.balance || 0, cust.updatedAt || new Date().toISOString()]);
      }

      // Update last sync time
      sessionStorage.setItem('lastSyncTimestamp', response.data.timestamp);
      console.log('Sync completed successfully');
      return true;
    }
  } catch (error) {
    console.error('Sync failed:', error);
    return false;
  }
};
