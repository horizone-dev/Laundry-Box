export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const DEFAULT_SHOP_ID = 'SHOP_01';
export const DEFAULT_BRANCH_ID = 'BRANCH_01';

export const CATEGORIES = {
  LAUNDRY: 'Laundry',
  DRY_CLEANING: 'Dry Cleaning',
};

export const ORDER_STATUS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  WASHING: 'Washing',
  DRYING: 'Drying',
  IRONING: 'Ironing',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  PAYMENT_PENDING: 'Payment Pending',
  CREDIT: 'Credit',
};

export const PAYMENT_STATUS = {
  PAID: 'Paid',
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
  CREDIT: 'Credit',
};

export const ACCOUNT_TYPES = {
  CASH: 'CASH',
  BANK: 'BANK',
};

export const TRANSACTION_TYPES = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
};

export const PAYMENT_METHODS = {
  NOT_PAID: 'Not Paid',
  CASH: 'Cash',
  BANK: 'Bank',
};
