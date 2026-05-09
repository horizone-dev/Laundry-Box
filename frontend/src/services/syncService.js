import api from '../api';

export const syncData = async () => {
  if (!window.electronAPI || !window.electronAPI.dbQuery) {
    console.warn("Electron API not available, skipping sync.");
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const shopId = user.shopId || 'SHOP_01';

    // 1. Fetch unsynced local data
    const resOrders = await window.electronAPI.dbQuery('SELECT * FROM orders WHERE isSynced = 0', []);
    const resCustomers = await window.electronAPI.dbQuery('SELECT * FROM customers WHERE isSynced = 0', []);
    
    const unsyncedOrders = resOrders.data || [];
    const unsyncedCustomers = resCustomers.data || [];

    if (unsyncedOrders.length === 0 && unsyncedCustomers.length === 0) {
      console.log('No local data to sync.');
    }

    // 2. Get last sync timestamp from local storage
    const lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp') || null;

    // 3. Send payload to backend
    const payload = {
      shopId,
      orders: unsyncedOrders.map(order => ({
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
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
        const itemsJson = typeof order.items === 'string' ? order.items : JSON.stringify(order.items);
        await window.electronAPI.dbQuery(`
          INSERT OR REPLACE INTO orders 
          (id, shopId, customerId, status, totalAmount, items, createdAt, isSynced, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [order.id, order.shopId, order.customerId, order.status, order.totalAmount, itemsJson, order.createdAt, order.updatedAt || new Date().toISOString()]);
      }

      for (const cust of incomingCustomers) {
        await window.electronAPI.dbQuery(`
          INSERT OR REPLACE INTO customers 
          (id, shopId, name, phone, email, address, creditLimit, balance, isSynced, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [cust.id, cust.shopId, cust.name, cust.phone, cust.email, cust.address, cust.creditLimit || 0, cust.balance || 0, cust.updatedAt || new Date().toISOString()]);
      }

      // Update last sync time
      localStorage.setItem('lastSyncTimestamp', response.data.timestamp);
      console.log('Sync completed successfully');
      return true;
    }
  } catch (error) {
    console.error('Sync failed:', error);
    return false;
  }
};
