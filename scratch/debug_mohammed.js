const Database = require('better-sqlite3');
const db = new Database('C:\\Users\\Orbix Soft. Solution\\AppData\\Roaming\\laundry-box\\laundry_pos.sqlite');

try {
  const customer = db.prepare("SELECT * FROM customers WHERE phone = '+971588851680'").get();
  console.log("CUSTOMER:", customer);

  if (customer) {
    const custId = customer.id;
    console.log("\n--- ORDERS ---");
    console.log(db.prepare("SELECT * FROM orders WHERE customerId = ?").all(custId));

    console.log("\n--- DELETED ORDERS ---");
    console.log(db.prepare("SELECT * FROM deleted_orders WHERE customerId = ?").all(custId));

    console.log("\n--- PAYMENTS ---");
    console.log(db.prepare("SELECT * FROM payments WHERE customerId = ?").all(custId));

    console.log("\n--- ADVANCE ALLOCATIONS ---");
    console.log(db.prepare("SELECT * FROM advance_allocations WHERE paymentId IN (SELECT id FROM payments WHERE customerId = ?)").all(custId));
  }
} catch (e) {
  console.error(e);
}
