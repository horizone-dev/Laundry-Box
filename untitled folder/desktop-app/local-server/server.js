const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
const DB_PATH = path.join(__dirname, 'db', 'database.sqlite');
const db = new Database(DB_PATH);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    shopId TEXT,
    branchId TEXT,
    customerName TEXT,
    customerPhone TEXT,
    itemsData TEXT,
    total REAL,
    paymentStatus TEXT,
    isSynced INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// API Routes
app.post('/api/orders', (req, res) => {
  const { id, shopId, branchId, customerName, customerPhone, items, total, paymentStatus } = req.body;
  const itemsData = JSON.stringify(items);

  const stmt = db.prepare(`
    INSERT INTO orders (id, shopId, branchId, customerName, customerPhone, itemsData, total, paymentStatus, isSynced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  try {
    stmt.run(id, shopId, branchId, customerName, customerPhone, itemsData, total, paymentStatus);
    res.json({ success: true, message: 'Order saved locally' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all();
  res.json(orders.map(o => ({ ...o, items: JSON.parse(o.itemsData) })));
});

// Background Sync Logic
const CLOUD_API_URL = 'http://localhost:5001/api/sync/orders';

const syncOrders = async () => {
  const unsyncedOrders = db.prepare('SELECT * FROM orders WHERE isSynced = 0').all();
  if (unsyncedOrders.length === 0) return;

  console.log(`Syncing ${unsyncedOrders.length} orders to cloud...`);

  try {
    const ordersToSync = unsyncedOrders.map(o => ({
      ...o,
      items: JSON.parse(o.itemsData)
    }));

    const response = await axios.post(CLOUD_API_URL, 
      { orders: ordersToSync },
      { headers: { 'x-shop-id': unsyncedOrders[0].shopId } } // In real app, use JWT
    );

    if (response.data.success) {
      const syncedIds = response.data.syncedIds;
      const updateStmt = db.prepare('UPDATE orders SET isSynced = 1 WHERE id = ?');
      const transaction = db.transaction((ids) => {
        for (const id of ids) updateStmt.run(id);
      });
      transaction(syncedIds);
      console.log('Sync completed successfully');
    }
  } catch (err) {
    console.error('Sync failed:', err.message);
  }
};

// Start Sync Polling (Every 30 seconds)
setInterval(syncOrders, 30000);

app.listen(PORT, () => {
  console.log(`Local server running on port ${PORT}`);
});
