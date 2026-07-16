const Database = require('better-sqlite3');
const db = new Database('C:\\Users\\Orbix Soft. Solution\\AppData\\Roaming\\laundry-box\\laundry_pos.sqlite');

const query = `
        SELECT * FROM (
          SELECT 
            id, shopId, billNumber, customerId, totalAmount, paidAmount, dueAmount, 
            paymentStatus, status, paymentMethod, items, createdAt, updatedAt, 
            0 AS isDeleted, NULL AS refundStatus, NULL AS refundMethod, NULL AS returnedAt, NULL AS payments 
          FROM orders 

          UNION ALL

          SELECT 
            id, shopId, billNumber, customerId, totalAmount, paidAmount, 0 AS dueAmount, 
            originalPaymentStatus AS paymentStatus, 'Deleted' AS status, originalPaymentMethod AS paymentMethod, items, deletedAt AS createdAt, deletedAt AS updatedAt, 
            1 AS isDeleted, refundStatus, refundMethod, returnedAt, payments 
          FROM deleted_orders 
        ) AS u
        WHERE u.customerId = 'CUST-2'
`;

try {
  const rows = db.prepare(query).all();
  console.log(`Found ${rows.length} rows`);
  for (const row of rows) {
    if (row.isDeleted) {
      console.log('DELETED ORDER:', row.id, row.isDeleted);
    }
  }
} catch (e) {
  console.error(e);
}
