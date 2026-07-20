const mongoose = require('mongoose');

const uris = [
  'mongodb://localhost:27017/laundry',
  'mongodb://localhost:27017/laundry_saas'
];

(async () => {
  for (const uri of uris) {
    console.log(`\n========================================`);
    console.log(`Connecting to: ${uri}`);
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log('Connected!');
      
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      console.log('Collections:', collections.map(c => c.name).join(', '));
      
      if (collections.some(c => c.name === 'customers')) {
        const Customer = mongoose.model('Customer', new mongoose.Schema({}, { strict: false }), 'customers');
        const count = await Customer.countDocuments();
        console.log(`Customers count: ${count}`);
        
        const sarah = await Customer.findOne({ name: /Sarah/i });
        if (sarah) {
          console.log('Found Sarah Gonzalez in MongoDB:', sarah.toObject());
          
          // Find orders for Sarah
          const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }), 'orders');
          const orders = await Order.find({ customerId: sarah.id });
          console.log(`Found ${orders.length} orders for Sarah:`);
          console.log(orders);
          
          // Find payments for Sarah
          const Payment = mongoose.model('Payment', new mongoose.Schema({}, { strict: false }), 'payments');
          const payments = await Payment.find({ customerId: sarah.id });
          console.log(`Found ${payments.length} payments for Sarah:`);
          console.log(payments);
        }
      }
      
      await mongoose.connection.close();
    } catch (err) {
      console.log('Error:', err.message);
    }
  }
  process.exit(0);
})();
