const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('laundry.db');

db.serialize(() => {
  db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('orders', 'deleted_orders')", [], (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    rows.forEach(row => console.log(row.sql));

    db.all("SELECT id FROM orders WHERE status = 'Cancelled'", [], (err, cancelledOrders) => {
      console.log(`Found ${cancelledOrders.length} cancelled orders.`);
      db.close();
    });
  });
});
