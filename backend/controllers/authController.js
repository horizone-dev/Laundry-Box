const User = require('../models/Staff');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  try {
    const { shopId, name, phone, password, pin, userId, role } = req.body;
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
    
    let user;
    
    // Support PIN-only login if identifier is missing
    if (method === 'pin' && (!identifier || identifier.trim() === '')) {
      const allUsers = await User.find({});
      for (const u of allUsers) {
        if (await u.comparePin(secret)) {
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
      return res.status(401).json({ message: 'User not found or invalid PIN' });
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
      // Both 'password' and 'super_admin' methods use password comparison
      isMatch = await user.comparePassword(secret);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id, shopId: user.shopId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, phone: user.phone, userId: user.userId, shopId: user.shopId, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password -pin');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, phone, role, password, pin } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role) user.role = role;
    if (password) user.password = password;
    if (pin) user.pin = pin;

    await user.save();
    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
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

