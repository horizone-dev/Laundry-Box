const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDB(appPath) {
  // Use app data directory for production or local root for development
  const dbPath = path.join(appPath, 'laundry_pos.sqlite');
  db = new Database(dbPath, { verbose: console.log });

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      shopId TEXT PRIMARY KEY,
      name TEXT,
      settings JSON,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS branches (
      branchId TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      address TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      price REAL,
      icon TEXT,
      category TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      branchId TEXT,
      customerId TEXT,
      status TEXT,
      totalAmount REAL,
      items JSON,
      createdAt TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      orderId TEXT,
      shopId TEXT,
      amount REAL,
      method TEXT,
      status TEXT,
      isSynced INTEGER DEFAULT 0,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      title TEXT,
      amount REAL,
      category TEXT,
      date TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );
  `);
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

module.exports = { initDB, getDB };
