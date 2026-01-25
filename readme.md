# Restaurant Management System

This is a comprehensive restaurant management system built with a modern web stack. It provides a complete solution for managing a restaurant's operations, from customer-facing menus to administrative dashboards.

## Project Structure

The project is divided into two main components:

- **Frontend**: The user-facing application, built with HTML, CSS, and vanilla JavaScript.
- **Backend**: The server-side logic and database, powered by Firebase.

### File Breakdown

```
/
├── readme.md               # This file
├── Backend/
│   └── firebase.js         # Firebase configuration and helper functions
└── Frontend/
    ├── admin.html          # Admin dashboard for managing the entire system
    ├── employee.html       # Dashboard for staff to manage orders
    ├── index.html          # Login and registration page
    ├── script.js           # Shared JavaScript utilities
    ├── style.css           # Global stylesheets
    └── customer/
        ├── customer.css    # Styles for the customer interface
        ├── customer.html   # Customer-facing menu and ordering system
        └── customer.js     # JavaScript for the customer interface
```

## Features

### Customer Interface (`customer.html`)

- **Browse Menu**: Customers can view the full menu, filtered by category.
- **Add to Cart**: A fully functional shopping cart allows customers to add and remove items.
- **Place Orders**: Customers can place orders directly from the interface.
- **View Order History**: Customers can view their past orders and their statuses.

### Employee Dashboard (`employee.html`)

- **View Orders**: Staff can see all incoming orders in real-time.
- **Update Order Status**: Staff can update the status of an order (e.g., from "Pending" to "Preparing").
- **Filter Orders**: Staff can filter orders by their status.

### Admin Dashboard (`admin.html`)

- **Full Control**: Admins have access to all features of the employee and customer dashboards.
- **Menu Management**: Admins can add, edit, and delete menu items.
- **User Management**: Admins can view and manage all users of the system.
- **Inventory Management**: Admins can track and manage inventory levels.

## Getting Started

To run this project, you will need to have a Firebase project set up.

### 1. Configure Firebase

The Firebase configuration is located in `Backend/firebase.js`. You will need to replace the placeholder values with your own Firebase project credentials.

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 2. Open the Application

Once you have configured Firebase, you can open the `Frontend/index.html` file in your web browser to start the application.

## How to Use

1. **Login**: Open `Frontend/index.html` and log in with a user's credentials. The system will automatically redirect you to the appropriate dashboard based on the user's role (customer, employee, or admin).
2. **Explore**: 
    - As a **customer**, you can browse the menu, add items to your cart, and place an order.
    - As an **employee**, you can view and manage incoming orders.
    - As an **admin**, you have full control over the system.

## Bill Printing on Thermal Printers

This system supports printing bills directly to a thermal printer for efficient order processing. Assuming the thermal printer is already connected to your PC/system and functioning correctly (e.g., you can print test pages from the OS), follow these steps to integrate bill printing.

### Hardware Setup
- Ensure the thermal printer (e.g., Epson TM series or Star Micronics) is connected via USB, serial, Ethernet, or Bluetooth.
- Verify it's recognized by your OS and set as the default printer if needed.

### Software Integration
- Use a compatible library for your backend:
  - **Node.js**: Install `node-thermal-receipt-printer` or `escpos` via npm (`npm install node-thermal-receipt-printer`).
  - **Python**: Use `python-escpos` or `PySerial`.
- Integrate into your backend (e.g., `Backend/firebase.js`) or a dedicated print service.

### Code Implementation
- Detect the printer by name, port, or IP.
- Format bill data (e.g., order items, totals) into printable text using ESC/POS commands.
- Example in Node.js:
  ```javascript
  const ThermalPrinter = require('node-thermal-receipt-printer').printer;
  const PrinterTypes = require('node-thermal-receipt-printer').types;

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: '/dev/usb/lp0' // or 'printer_name' if shared
  });

  printer.println('Restaurant Bill');
  printer.println('Item: Pizza - $10');
  printer.println('Total: $10');
  printer.cut();
  printer.execute();
  ```
- Trigger printing on order completion or via employee/admin action.

### Testing and Deployment
- Print sample bills to verify formatting and connectivity.
- Handle errors (e.g., printer offline, paper out) in your code.
- For web apps, print from the server-side to access local printers.

If using a specific OS or framework, adjust accordingly. Refer to printer documentation for model-specific commands.

## Troubleshooting

If you encounter any issues, please refer to the [Troubleshooting Guide](troubleshooting-guide.md).

---

*This `README.md` was generated by an AI assistant to provide a clear and comprehensive overview of the project.*
