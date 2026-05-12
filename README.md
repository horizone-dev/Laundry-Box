# 🧺 Antigravity Laundry Management System

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Muhammedbn/laundry-billing-software)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)]()

A professional, high-performance Laundry Management and POS (Point of Sale) system designed for modern dry cleaning and laundry businesses. Built with a focus on speed, reliability, and ease of use.

---

## ✨ Key Features

### 🚀 Sales & POS
*   **Modern POS Interface**: Quick order creation with category-based service selection.
*   **Quick Delivery**: Global "Deliver" button to fulfill orders instantly via ID/Bill search.
*   **Thermal Printing**: Generate professional QR-coded receipts and garment tags.
*   **Advanced Discounts**: Support for flat and percentage-based discount schemes.

### 💰 Financial Management
*   **Credit Settlement**: Full-featured module for tracking customer debt and partial payments.
*   **Outstanding Bills**: Dedicated dashboard with financial KPIs (Total Outstanding, Overdue, Due Soon).
*   **Expense Tracking**: Categorized expense management to monitor daily overheads.
*   **Real-time Reports**: Instant financial summaries and daily collection reports.

### 👥 Customer & Staff
*   **CRM**: Comprehensive customer profiles with order history and balance tracking.
*   **Staff Roles**: Role-based access control (Admin, Manager, Cashier) with specific permissions.
*   **WhatsApp Integration**: Send order status and payment reminders directly to customers.

### 🛠 Technical Excellence
*   **Hybrid Sync**: Seamlessly works offline with local SQLite database and syncs to Cloud when online.
*   **Multi-language Support**: Fully localized in **English**, **Arabic** (RTL support), and **Hindi**.
*   **Activation System**: Built-in license management with a 30-day free trial system.

---

## 🚀 Tech Stack

*   **Frontend**: React.js, Vite, Lucide Icons, CSS Modules (Vanilla CSS)
*   **Desktop App**: Electron.js
*   **Local Database**: SQLite (via better-sqlite3)
*   **Cloud Backend**: Node.js, Express, MongoDB (Atlas)
*   **State Management**: React Context API
*   **Networking**: Axios with Interceptors

---

## 🛠 Installation & Setup

### Prerequisites
*   Node.js (v18.x or higher)
*   npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/Muhammedbn/laundry-billing-software.git
cd laundry-billing-software
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Run Development Server
```bash
npm run dev
```

---

## 📸 Screenshots

*(Add your screenshots here)*

| Dashboard | POS Interface | Outstanding Bills |
| :---: | :---: | :---: |
| ![Dashboard](https://via.placeholder.com/300x180?text=Dashboard) | ![POS](https://via.placeholder.com/300x180?text=POS+System) | ![Bills](https://via.placeholder.com/300x180?text=Financial+KPIs) |

---

## 📦 Build & Packaging

To generate a production-ready installer for Windows or macOS:

```bash
# Package the app
npm run package

# Build the distributable
npm run dist
```

---

## 📄 License
This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support & Contact
**Developer:** Muhammed BN  
**GitHub:** [@Muhammedbn](https://github.com/Muhammedbn)  
**Project:** [Laundry Billing Software](https://github.com/Muhammedbn/laundry-billing-software)

---
*Developed with ❤️ by Antigravity Team*
