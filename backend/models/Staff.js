const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffSchema = new mongoose.Schema({
  shopId: { type: String, required: true },
  userId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  phone: { type: String, unique: true, sparse: true },
  password: { type: String },
  pin: { type: String, required: true, unique: true },
  role: { type: String, enum: ['super_admin', 'manager', 'cashier'], default: 'cashier' },
  branchId: { type: String },
}, { 
  timestamps: true,
  strict: true 
});

staffSchema.pre('save', async function() {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (this.isModified('pin') && this.pin) {
    this.pin = await bcrypt.hash(this.pin, 10);
  }
});

staffSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

staffSchema.methods.comparePin = async function(candidatePin) {
  if (!this.pin) return false;
  return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model('Staff', staffSchema);
