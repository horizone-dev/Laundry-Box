const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const DeletedOrder = require('../models/DeletedOrder');

// GET /api/orders/deleted - Fetch all deleted orders
router.get('/deleted', async (req, res) => {
  try {
    const deletedOrders = await DeletedOrder.find({}).sort({ deletedAt: -1 });
    res.json(deletedOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
    const { status, paymentStatus, paidAmount, dueAmount, updatedBy } = req.body;
    
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

    if (status) order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (paidAmount !== undefined) order.paidAmount = paidAmount;
    if (dueAmount !== undefined) order.dueAmount = dueAmount;

    if (!order.statusHistory || !Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      status: status || order.status,
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

// DELETE /api/orders/:id - Delete order
router.delete('/:id', async (req, res) => {
  const orderId = req.params.id;
  const { deletedBy } = req.body;
  const finalDeletedBy = deletedBy || req.query.deletedBy || 'Manager';
  try {
    let order = await Order.findOne({
      $or: [
        { id: orderId },
        { id: orderId.replace('#', '') },
        { id: '#' + orderId.replace('#', '') },
        { billNumber: orderId }
      ]
    });

    if (!order && orderId.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderId);
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // 0. Save to DeletedOrder audit log collection in MongoDB
    const deletedRecord = new DeletedOrder({
      id: order.id,
      shopId: order.shopId,
      billNumber: order.billNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalAmount: order.totalAmount,
      items: order.items,
      deletedBy: finalDeletedBy,
      deletedAt: new Date()
    });
    await deletedRecord.save();

    // 1. Delete associated payments in MongoDB
    await Payment.deleteMany({ orderId: order.id, shopId: order.shopId });

    // 2. Delete the order
    await Order.deleteOne({ _id: order._id });

    // 3. Recalculate and update customer balance in MongoDB
    if (order.customerId) {
      const customerId = order.customerId;
      const shopId = order.shopId;

      // Get all non-cancelled orders for this customer
      const activeOrders = await Order.find({ customerId, shopId, status: { $ne: 'Cancelled' } });
      const totalDue = activeOrders.reduce((sum, o) => sum + (o.dueAmount ?? 0), 0);

      // Get all unlinked payments for this customer (where orderId is null or empty)
      const unlinkedPayments = await Payment.find({
        customerId,
        shopId,
        $or: [{ orderId: { $exists: false } }, { orderId: null }, { orderId: '' }]
      });
      const totalPayments = unlinkedPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

      const newBalance = totalDue - totalPayments;

      await Customer.findOneAndUpdate(
        { id: customerId, shopId },
        { balance: newBalance, updatedAt: new Date() }
      );
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
