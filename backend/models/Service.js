const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Local SQLite ID
  shopId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  icon: { type: String },
  category: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
