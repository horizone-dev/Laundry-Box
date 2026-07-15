const mongoose = require('mongoose');

const advanceAllocationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Local SQLite ID
  paymentId: { type: String, required: true },
  orderId: { type: String, required: true },
  amountUsed: { type: Number, required: true },
  date: { type: String },
  shopId: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('AdvanceAllocation', advanceAllocationSchema);
