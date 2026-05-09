const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  name: { type: String, required: true },
  icon: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create a compound index for id and shopId
CategorySchema.index({ id: 1, shopId: 1 }, { unique: true });

module.exports = mongoose.model('Category', CategorySchema);
