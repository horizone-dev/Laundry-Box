# Financial rules

This document defines the single meaning of a customer balance before payment
screens are consolidated.

## Background verification

`runDataHealer` is retained only for compatibility with existing screens. It is
read-only: it creates a financial-integrity report and must never update an
order, payment, allocation, customer balance, refund, ledger, or sync flag.
Any historical repair is an explicit, audited operation after review.

When a customer's saved balance differs from the canonical calculation, new
settlements, deleted-order changes, and refunds are blocked for that customer
until the discrepancy is reviewed. This prevents a new action from hiding or
compounding an old data problem.

## Balance convention

- A positive customer balance is money the customer owes the shop.
- A negative customer balance is customer money held by the shop as advance.
- `customers.balance` is a cached display value. Orders and payment records are
  the source records used to calculate it.

## Source records

| Record | Financial meaning |
| --- | --- |
| Active order | Charge the order's final `totalAmount` to the customer. |
| Successful Cash/Card/UPI/Bank/Nomod/Discount payment | Credit the customer by the payment amount. |
| Advance allocation | Links an earlier advance receipt to an order; it is not a second receipt. |
| `Advance` / `System Auto` payment | Legacy or technical row; never treated as a new customer receipt. |
| Deleted + refunded order | Its charge and receipt are historical only and do not affect the current balance. |
| Deleted + converted-to-advance order | The moved/retained original receipt is the customer advance; it must be counted once only. |

## Non-negotiable controls

1. A payment mutation must update its order, account transaction, advance
   allocation, customer balance cache and audit event in one SQLite transaction.
2. A refund needs an idempotency check: the same order cannot produce two cash
   refunds.
3. Startup reconciliation may report a mismatch but must not create payments,
   alter paid amounts or change balances automatically.
4. Every screen must read the same computed financial state. Screens may not
   update `customers.balance` directly.
