# Customer Column UI Walkthrough

We have modified the Customer List table columns per user requirements.

## Key Changes

1. **Credit Limit Column**
   - Replaced the unused **Mobile** column with a dedicated **Credit Limit** column.
   - The cell displays the numerical credit limit value (`customer.creditLimit`) formatted to 2 decimal places.

2. **Actions Button addition**
   - Added a **Credit Limit Edit** button (using the CreditCard icon) to the Actions column on each customer row.
   - Clicking this button immediately opens the Manager PIN-protected Credit Limit modification dialog for the selected customer.

## Modified Files
- [Customers.jsx](file:///c:/Users/Orbix%20Soft.%20Solution/Desktop/Laundry%20Box/frontend/src/pages/Customers.jsx) - Updated table header, row render mapping, and Actions block.
