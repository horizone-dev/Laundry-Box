const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Local SQLite ID
  shopId: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  creditLimit: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
