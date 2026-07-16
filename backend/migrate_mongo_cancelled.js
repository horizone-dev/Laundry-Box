const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/laundry');

const OrderSchema = new mongoose.Schema({
  id: String,
  status: String,
  // ... other fields are preserved by strict: false or lean()
}, { strict: false });

const DeletedOrderSchema = new mongoose.Schema({
  id: String,
  // ... other fields
}, { strict: false });

const Order = mongoose.model('Order', OrderSchema);
const DeletedOrder = mongoose.model('DeletedOrder', DeletedOrderSchema);

async function migrate() {
  try {
    const cancelledOrders = await Order.find({ status: 'Cancelled' }).lean();
    console.log(`Found ${cancelledOrders.length} Cancelled orders in MongoDB.`);

    let migrated = 0;
    for (const order of cancelledOrders) {
      // Check if already in DeletedOrder
      const exists = await DeletedOrder.findOne({ id: order.id });
      if (!exists) {
        // We will just copy the entire payload over and add deletion metadata
        const newDeleted = new DeletedOrder({
          ...order,
          deletedAt: order.updatedAt || new Date(),
          deletedBy: 'MigrationScript',
          originalPaymentStatus: order.paymentStatus || 'Pending',
          returnStatus: 'N/A',
          approvedBy: 'System',
          originalPaymentMethod: order.paymentMethod || 'CASH',
          refundMethod: 'None',
          refundStatus: 'Deleted'
        });
        await newDeleted.save();
        migrated++;
        console.log(`Migrated order ${order.id} to DeletedOrder.`);
      } else {
        console.log(`Order ${order.id} already exists in DeletedOrder collection.`);
      }
      
      // Delete from Order collection
      await Order.deleteOne({ id: order.id });
      console.log(`Deleted order ${order.id} from Order collection.`);
    }

    console.log(`Successfully migrated ${migrated} orders.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    mongoose.connection.close();
  }
}

migrate();
