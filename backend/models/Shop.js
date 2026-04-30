const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  shopId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  settings: {
    currency: { type: String, default: 'USD' },
    taxRate: { type: Number, default: 5 },
    address: String,
    phone: String,
    logo: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Shop', shopSchema);
