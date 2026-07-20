const User = require('../models/Staff');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, '..', 'local_db_users.json');

function isMongoConnected() {
  return mongoose.connection.readyState === 1; // 1 = connected
}

async function initLocalDb() {
  if (!fs.existsSync(USERS_FILE)) {
    const adminPassHash = await bcrypt.hash('Admin@123', 10);
    const adminPinHash = await bcrypt.hash('disabled', 10);
    const defaultUsers = [
      {
        _id: 'local_admin_2',
        name: 'Horizon inc',
        phone: '+9710588851680',
        userId: 'super admin',
        password: adminPassHash,
        pin: adminPinHash,
        role: 'super_admin',
        shopId: 'SHOP_01',
        createdAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf8');
  }
}

function loadLocalUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
}

function saveLocalUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

exports.signup = async (req, res) => {
  try {
    const { shopId, name, phone, password, pin, userId, role } = req.body;

    if (!isMongoConnected()) {
      await initLocalDb();
      const users = loadLocalUsers();

      // Check if user already exists
      const exists = users.some(u => 
        (u.phone && phone && u.phone === phone) || 
        (u.userId && userId && u.userId === userId) ||
        (u.name && name && u.name.toLowerCase() === name.toLowerCase())
      );
      if (exists) {
        return res.status(400).json({ error: 'User already exists with this name, phone, or User ID.' });
      }

      // Check if PIN is already in use
      if (pin) {
        for (const u of users) {
          if (u.pin && await bcrypt.compare(pin, u.pin)) {
            return res.status(400).json({ error: 'This PIN is already in use by another user.' });
          }
        }
      }

      const passHash = await bcrypt.hash(password || '0000', 10);
      const pinHash = await bcrypt.hash(pin || '0000', 10);

      const newUser = {
        _id: 'local_user_' + Date.now(),
        shopId: shopId || 'SHOP_01',
        name,
        phone: phone || '',
        userId: userId || 'USER_' + Date.now(),
        password: passHash,
        pin: pinHash,
        role: role || 'cashier',
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveLocalUsers(users);

      const token = jwt.sign({ id: newUser._id, shopId: newUser.shopId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
      return res.status(201).json({ token, user: { id: newUser._id, name, phone, userId, shopId, role } });
    }

    // MongoDB path
    if (pin) {
      const allUsers = await User.find({});
      for (const u of allUsers) {
        if (u.pin && await u.comparePin(pin)) {
          return res.status(400).json({ error: 'This PIN is already in use by another user.' });
        }
      }
    }

    const user = new User({ shopId, name, phone, password, pin, userId, role });
    await user.save();
    
    const token = jwt.sign({ id: user._id, shopId: user.shopId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, phone, userId, shopId, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, secret, method } = req.body; // identifier: email/phone/name/userId, secret: password/pin

    if (!isMongoConnected()) {
      await initLocalDb();
      const users = loadLocalUsers();
      
      let user;
      if (method === 'pin' && (!identifier || identifier.trim() === '')) {
        // Support PIN-only login if identifier is missing
        for (const u of users) {
          if (u.pin && await bcrypt.compare(secret, u.pin)) {
            user = u;
            break;
          }
        }
      } else {
        // Standard login with identifier
        user = users.find(u => 
          u.userId === identifier || 
          u.phone === identifier || 
          u.name === identifier ||
          (u.email && u.email === identifier)
        );
      }

      if (!user) {
        return res.status(401).json({ message: 'User not found or invalid credentials' });
      }

      // Strict Role-Based Login Paths
      if (user.role === 'super_admin') {
        if (method !== 'super_admin') {
          return res.status(403).json({ message: 'Super Admin must use the dedicated Super Admin login portal.' });
        }
      } else {
        if (method === 'super_admin') {
          return res.status(403).json({ message: 'This portal is reserved for Super Admin only.' });
        }
      }

      let isMatch = false;
      if (method === 'pin') {
        isMatch = user.pin && await bcrypt.compare(secret, user.pin);
      } else {
        isMatch = await bcrypt.compare(secret, user.password);
      }

      if (!isMatch) {
        return res.status(401).json({ message: 'User not found or invalid credentials' });
      }

      const token = jwt.sign({ id: user._id, shopId: user.shopId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
      return res.json({ token, user: { id: user._id, name: user.name, phone: user.phone, userId: user.userId, shopId: user.shopId, role: user.role } });
    }

    // MongoDB path
    let user;
    
    // Support PIN-only login if identifier is missing
    if (method === 'pin' && (!identifier || identifier.trim() === '')) {
      const allUsers = await User.find({});
      for (const u of allUsers) {
        if (u.pin && await u.comparePin(secret)) {
          user = u;
          break;
        }
      }
    } else {
      // Standard login with identifier
      user = await User.findOne({
        $or: [
          { email: identifier },
          { phone: identifier },
          { userId: identifier },
          { name: identifier }
        ]
      });
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found or invalid credentials' });
    }

    // Strict Role-Based Login Paths
    if (user.role === 'super_admin') {
      if (method !== 'super_admin') {
        return res.status(403).json({ message: 'Super Admin must use the dedicated Super Admin login portal.' });
      }
    } else {
      if (method === 'super_admin') {
        return res.status(403).json({ message: 'This portal is reserved for Super Admin only.' });
      }
    }

    let isMatch = false;
    if (method === 'pin') {
      isMatch = await user.comparePin(secret);
    } else {
      isMatch = await user.comparePassword(secret);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'User not found or invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id, shopId: user.shopId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, phone: user.phone, userId: user.userId, shopId: user.shopId, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      await initLocalDb();
      const users = loadLocalUsers();
      // Remove sensitive details
      const safeUsers = users.map(({ password, pin, ...rest }) => rest);
      return res.json(safeUsers);
    }

    const users = await User.find({}, '-password -pin');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, phone, role, password, pin } = req.body;

    if (!isMongoConnected()) {
      await initLocalDb();
      const users = loadLocalUsers();
      const userIdx = users.findIndex(u => u._id === req.params.id);
      if (userIdx === -1) return res.status(404).json({ message: 'User not found' });

      // Check if PIN is already in use by another user
      if (pin) {
        for (const u of users) {
          if (u._id !== req.params.id && u.pin && await bcrypt.compare(pin, u.pin)) {
            return res.status(400).json({ error: 'This PIN is already in use by another user.' });
          }
        }
      }

      if (name) users[userIdx].name = name;
      if (phone !== undefined) users[userIdx].phone = phone;
      if (role) users[userIdx].role = role;
      if (password) users[userIdx].password = await bcrypt.hash(password, 10);
      if (pin) users[userIdx].pin = await bcrypt.hash(pin, 10);
      users[userIdx].updatedAt = new Date().toISOString();

      saveLocalUsers(users);
      const { password: _, pin: __, ...safeUser } = users[userIdx];
      return res.json({ message: 'User updated successfully', user: safeUser });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if PIN is already in use by another user in MongoDB
    if (pin) {
      const allUsers = await User.find({ _id: { $ne: req.params.id } });
      for (const u of allUsers) {
        if (u.pin && await u.comparePin(pin)) {
          return res.status(400).json({ error: 'This PIN is already in use by another user.' });
        }
      }
      user.pin = pin;
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role) user.role = role;
    if (password) user.password = password;

    await user.save();
    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      await initLocalDb();
      const users = loadLocalUsers();
      const newUsers = users.filter(u => u._id !== req.params.id);
      if (newUsers.length === users.length) return res.status(404).json({ message: 'User not found' });
      saveLocalUsers(newUsers);
      return res.json({ message: 'User deleted successfully' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyManagerPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ valid: false, message: 'PIN is required' });
    }

    if (!isMongoConnected()) {
      await initLocalDb();
      const users = loadLocalUsers();
      const managers = users.filter(u => u.role === 'manager' || u.role === 'super_admin');
      for (const u of managers) {
        if (await bcrypt.compare(pin, u.pin)) {
          return res.json({ valid: true, managerName: u.name });
        }
      }
      return res.status(401).json({ valid: false, message: 'Invalid Manager PIN' });
    }
    
    // Find all users (staff) with manager or super_admin roles
    const allUsers = await User.find({ role: { $in: ['manager', 'super_admin'] } });
    for (const u of allUsers) {
      if (await u.comparePin(pin)) {
        return res.json({ valid: true, managerName: u.name });
      }
    }
    
    return res.status(401).json({ valid: false, message: 'Invalid Manager PIN' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resetUsers = async (req, res) => {
  try {
    const adminPassHash = await bcrypt.hash('Admin@123', 10);
    const cashierPassHash = await bcrypt.hash('Admin123', 10);
    const managerPassHash = await bcrypt.hash('Admin123', 10);

    const adminPinHash = await bcrypt.hash('disabled', 10);
    const cashierPinHash = await bcrypt.hash('0000', 10);
    const managerPinHash = await bcrypt.hash('1234', 10);

    const defaultUsers = [
      {
        _id: 'local_admin_1',
        name: 'Horizon inc',
        phone: '+9710588851680',
        userId: 'super admin',
        password: adminPassHash,
        pin: adminPinHash,
        role: 'super_admin',
        shopId: 'SHOP_01',
        createdAt: '2026-06-20T07:43:00.000Z'
      },
      {
        _id: 'local_cashier_1',
        name: 'Cashier Test',
        phone: '+971000000000',
        userId: 'cashier',
        password: cashierPassHash,
        pin: cashierPinHash,
        role: 'cashier',
        shopId: 'SHOP_01',
        createdAt: '2026-06-20T07:43:00.000Z'
      },
      {
        _id: 'local_manager_1',
        name: 'Manager Test',
        phone: '+9710599999999',
        userId: 'manager',
        password: managerPassHash,
        pin: managerPinHash,
        role: 'manager',
        shopId: 'SHOP_01',
        createdAt: '2026-06-25T11:40:00.000Z'
      }
    ];

    if (!isMongoConnected()) {
      saveLocalUsers(defaultUsers);
    } else {
      await User.deleteMany({});
      const seedUsers = defaultUsers.map(u => {
        let pinVal = '0000';
        let passVal = 'Admin123';
        if (u.role === 'super_admin') {
          pinVal = 'disabled';
          passVal = 'Admin@123';
        } else if (u.role === 'manager') {
          pinVal = '1234';
        }

        return new User({
          name: u.name,
          phone: u.phone,
          userId: u.userId,
          password: passVal,
          pin: pinVal,
          role: u.role,
          shopId: u.shopId
        });
      });

      for (const u of seedUsers) {
        await u.save();
      }
    }

    res.json({ message: 'Users reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

