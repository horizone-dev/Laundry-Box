const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/laundry-saas')
  .then(() => console.log('Cloud MongoDB Connected'))
  .catch(err => console.log(err));

// Simple Middleware for Tenant Filtering (Mock for now)
const tenantFilter = (req, res, next) => {
  const shopId = req.headers['x-shop-id'];
  if (!shopId) return res.status(401).json({ message: 'Shop ID required' });
  req.shopId = shopId;
  next();
};

// Routes
const Order = require('./models/Order');

app.post('/api/sync/orders', tenantFilter, async (req, res) => {
  try {
    const { orders } = req.body;
    const shopId = req.shopId;

    const results = [];
    for (let orderData of orders) {
      // Upsert order based on localId and shopId
      const order = await Order.findOneAndUpdate(
        { localId: orderData.id, shopId: shopId },
        { ...orderData, shopId: shopId, localId: orderData.id },
        { upsert: true, new: true }
      );
      results.push(order.localId);
    }

    res.json({ success: true, syncedIds: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Cloud server running on port ${PORT}`);
});
