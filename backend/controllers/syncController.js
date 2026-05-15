const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Category = require('../models/Category');

exports.syncData = async (req, res) => {
  const { shopId, orders, customers, lastSyncTimestamp } = req.body;
  
  try {
    // 1. Process Orders from client
    if (orders && orders.length > 0) {
      for (const order of orders) {
        // Use the same 'id' for MongoDB and SQLite
        const { isSynced, ...rest } = order;
        
        // Parse JSON strings if necessary
        const statusHistory = typeof order.statusHistory === 'string' 
          ? JSON.parse(order.statusHistory) 
          : order.statusHistory;
        const items = typeof order.items === 'string' 
          ? JSON.parse(order.items) 
          : order.items;

        const mongoOrder = { 
          ...rest, 
          statusHistory,
          items,
          billNumber: order.billNumber || `BN-${Date.now().toString().slice(-6)}` 
        };
        
        await Order.findOneAndUpdate(
          { id: mongoOrder.id, shopId },
          { ...mongoOrder, shopId, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    // 2. Process Customers from client
    if (customers && customers.length > 0) {
      for (const cust of customers) {
        const { isSynced, ...rest } = cust;
        await Customer.findOneAndUpdate(
          { id: cust.id, shopId },
          { ...rest, shopId, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    // 3. Process Categories from client
    if (req.body.categories && req.body.categories.length > 0) {
      for (const cat of req.body.categories) {
        const { isSynced, ...rest } = cat;
        await Category.findOneAndUpdate(
          { id: cat.id, shopId },
          { ...rest, shopId, updatedAt: new Date() },
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
    const newCategories = await Category.find(query);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        orders: newOrders,
        customers: newCustomers,
        services: newServices,
        categories: newCategories
      }
    });
  } catch (error) {
    console.error('Sync Error:', error);
    res.status(500).json({ success: false, message: 'Sync failed' });
  }
};
