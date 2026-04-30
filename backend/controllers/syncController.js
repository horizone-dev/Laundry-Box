const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Service = require('../models/Service');

exports.syncData = async (req, res) => {
  const { shopId, orders, customers, lastSyncTimestamp } = req.body;
  
  try {
    // 1. Process Orders from client
    if (orders && orders.length > 0) {
      for (const order of orders) {
        await Order.findOneAndUpdate(
          { id: order.id, shopId },
          { ...order, shopId, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    // 2. Process Customers from client
    if (customers && customers.length > 0) {
      for (const cust of customers) {
        await Customer.findOneAndUpdate(
          { id: cust.id, shopId },
          { ...cust, shopId, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    // 3. Fetch updates from cloud since last sync
    const query = { 
      shopId, 
      updatedAt: { $gt: new Date(lastSyncTimestamp || 0) } 
    };

    const newOrders = await Order.find(query);
    const newCustomers = await Customer.find(query);
    const newServices = await Service.find(query);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        orders: newOrders,
        customers: newCustomers,
        services: newServices
      }
    });
  } catch (error) {
    console.error('Sync Error:', error);
    res.status(500).json({ success: false, message: 'Sync failed' });
  }
};
