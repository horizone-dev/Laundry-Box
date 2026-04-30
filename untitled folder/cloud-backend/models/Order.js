const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  localId: { type: String, required: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  branchId: String,
  customer: {
    name: String,
    phone: String
  },
  items: [{
    name: String,
    price: Number,
    qty: Number
  }],
  total: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
  isSynced: { type: Boolean, default: true }
}, { timestamps: true });

// Index for multi-tenant isolation performance
OrderSchema.index({ shopId: 1 });

module.exports = mongoose.model('Order', OrderSchema);
