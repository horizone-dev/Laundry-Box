import axios from 'axios';

const BASE_URL = "http://127.0.0.1:3000";
const BACKEND_URL = `${BASE_URL}/api/sync`;

export const syncData = async () => {
  if (!window.electronAPI || !window.electronAPI.dbQuery) {
    console.warn("Electron API not available, skipping sync.");
    return;
  }

  try {
    // 1. Fetch unsynced local data
    const res = await window.electronAPI.dbQuery('SELECT * FROM orders WHERE isSynced = 0', []);
    const unsyncedOrders = res.data || [];

    if (unsyncedOrders.length === 0) {
      console.log('No local data to sync.');
    }

    // 2. Get last sync timestamp from local storage
    const lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp') || null;

    // 3. Send payload to backend
    const payload = {
      shopId: 'SHOP_1',
      orders: unsyncedOrders.map(order => ({
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
      })),
      lastSyncTimestamp
    };

    const response = await axios.post(BACKEND_URL, payload);
    
    if (response.data.success) {
      // 4. Mark local data as synced
      if (unsyncedOrders.length > 0) {
        for (const order of unsyncedOrders) {
          await window.electronAPI.dbQuery('UPDATE orders SET isSynced = 1 WHERE id = ?', [order.id]);
        }
      }

      // 5. Save new items from backend to local DB
      const incomingOrders = response.data.data?.orders || [];
      for (const order of incomingOrders) {
        const itemsJson = typeof order.items === 'string' ? order.items : JSON.stringify(order.items);
        await window.electronAPI.dbQuery(`
          INSERT OR REPLACE INTO orders 
          (id, shopId, customerId, status, totalAmount, items, createdAt, isSynced, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
          order.id, 
          order.shopId, 
          order.customerId, 
          order.status, 
          order.totalAmount, 
          itemsJson, 
          order.createdAt, 
          order.updatedAt || new Date().toISOString()
        ]);
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
