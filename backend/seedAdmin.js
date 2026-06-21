const mongoose = require('mongoose');
const User = require('./models/Staff');

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/laundry_saas');
    console.log('Connected to MongoDB');

    // Remove any old admin with this ID or phone to avoid unique conflicts
    await User.deleteMany({ $or: [{ userId: 'super admin' }, { phone: '+9710588851680' }, { name: 'Horizon inc' }, { userId: '142' }, { phone: '+971547825153' }, { name: 'muhammed' }] });
    
    const admin = new User({
      name: 'Horizon inc',
      phone: '+9710588851680',
      password: 'Admin123',
      pin: 'Admin123',
      role: 'super_admin',
      shopId: 'SHOP_01',
      userId: 'super admin'
    });

    await admin.save();
    console.log('--- Super Admin "Horizon inc" set successfully ---');
    console.log('User ID: super admin');
    console.log('Phone: +9710588851680');
    console.log('Password: Admin123');
    console.log('PIN: Admin123');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Seeding error:', err);
  }
};

seedSuperAdmin();
