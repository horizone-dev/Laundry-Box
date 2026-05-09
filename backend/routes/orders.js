const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// GET /api/orders/search - Search orders
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    const searchRegex = new RegExp(q, 'i');
    const orders = await Order.find({
      $or: [
        { id: searchRegex },
        { billNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex }
      ]
    }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/:id - Get single order
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  const orderId = req.params.id;
  console.log(`Updating status for order: ${orderId}`);
  try {
    const { status, updatedBy } = req.body;
    
    // Try matching by multiple fields for robustness
    let order = await Order.findOne({ 
      $or: [
        { id: orderId },
        { id: orderId.replace('#', '') },
        { id: '#' + orderId.replace('#', '') },
        { billNumber: orderId }
      ]
    });

    // If not found by custom ID, try by MongoDB _id if it looks like one
    if (!order && orderId.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderId);
    }

    if (!order) {
      console.error(`Order not found in MongoDB: ${orderId}`);
      return res.status(404).json({ message: `Order ${orderId} not found` });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      updatedBy: updatedBy || 'Staff',
      timestamp: new Date()
    });
    order.updatedAt = new Date();
    
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/orders - Create order (for sync or direct creation)
router.post('/', async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
