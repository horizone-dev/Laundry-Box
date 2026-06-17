const Role = require('../models/Role');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const ROLES_FILE = path.join(__dirname, '..', 'local_db_roles.json');

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function initLocalRoles() {
  if (!fs.existsSync(ROLES_FILE)) {
    const defaultRoles = [
      { 
        _id: 'role_super_admin',
        name: 'Super Admin', 
        slug: 'super_admin', 
        isSystem: true,
        permissions: {
          dashboard: true, pos: true, orders: true, customers: true, 
          services: true, reports: true, expenses: true, accounts: true, 
          settings: true, users: true 
        }
      },
      { 
        _id: 'role_manager',
        name: 'Manager', 
        slug: 'manager', 
        isSystem: true,
        permissions: {
          dashboard: true, pos: true, orders: true, customers: true, 
          services: true, reports: true, expenses: true, accounts: true, 
          settings: true, users: true 
        }
      },
      { 
        _id: 'role_cashier',
        name: 'Cashier', 
        slug: 'cashier', 
        isSystem: true,
        permissions: {
          dashboard: false, pos: true, orders: true, customers: true, 
          services: false, reports: false, expenses: false, accounts: false, 
          settings: false, users: false 
        }
      }
    ];
    fs.writeFileSync(ROLES_FILE, JSON.stringify(defaultRoles, null, 2), 'utf8');
  }
}

exports.getRoles = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      initLocalRoles();
      const roles = JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8'));
      return res.json(roles);
    }

    let roles = await Role.find();
    
    // Seed default roles if none exist
    if (roles.length === 0) {
      roles = await Role.insertMany([
        { 
          name: 'Super Admin', 
          slug: 'super_admin', 
          isSystem: true,
          permissions: {
            dashboard: true, pos: true, orders: true, customers: true, 
            services: true, reports: true, expenses: true, accounts: true, 
            settings: true, users: true 
          }
        },
        { 
          name: 'Manager', 
          slug: 'manager', 
          isSystem: true,
          permissions: {
            dashboard: true, pos: true, orders: true, customers: true, 
            services: true, reports: true, expenses: true, accounts: true, 
            settings: true, users: true 
          }
        },
        { 
          name: 'Cashier', 
          slug: 'cashier', 
          isSystem: true,
          permissions: {
            dashboard: false, pos: true, orders: true, customers: true, 
            services: false, reports: false, expenses: false, accounts: false, 
            settings: false, users: false 
          }
        }
      ]);
    }
    
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRolePermissions = async (req, res) => {
  try {
    const { permissions } = req.body;

    if (!isMongoConnected()) {
      initLocalRoles();
      const roles = JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8'));
      const roleIdx = roles.findIndex(r => r._id === req.params.id);
      if (roleIdx === -1) return res.status(404).json({ message: 'Role not found' });

      roles[roleIdx].permissions = permissions;
      fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2), 'utf8');
      return res.json(roles[roleIdx]);
    }

    const role = await Role.findByIdAndUpdate(
      req.params.id, 
      { permissions }, 
      { new: true }
    );
    if (!role) return res.status(404).json({ message: 'Role not found' });
    res.json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
