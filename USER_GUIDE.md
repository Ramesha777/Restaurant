# Restaurant Management System - User Guide

This guide provides detailed step-by-step instructions for using all features of the Restaurant Management System across Customer, Employee, and Admin roles.

## 1. Getting Started

### Accessing the System
1.  Open the application in your web browser.
2.  **Customers**: Navigate to the Customer Menu page (`customer/customer.html`).
3.  **Staff/Admins**: Navigate to the Login page (`index.html`).

### Logging In (Staff/Admin)
1.  Enter your registered **Email** and **Password**.
2.  Click **Sign In**.
3.  The system will automatically redirect you to the appropriate dashboard based on your role:
    *   **Admin** -> Admin Dashboard
    *   **Staff/Manager** -> Employee Dashboard

---

## 2. Customer Interface
*Designed for customers to browse the menu and place orders from their table.*

### Browsing the Menu
1.  **Categories**: Use the top filter bar to select categories (e.g., Starter, Main, Beverage).
2.  **Food Types**: Within categories, items are grouped by food type (e.g., Momo, Curry) with bold headings.
3.  **Search/Filter**: Click specific food type buttons to isolate those items.

### Placing an Order
1.  **Add to Cart**: Click the **+** button on any item.
    *   If an item has spicy levels, a popup will ask you to select **Normal**, **Medium**, or **Extra Spicy**.
2.  **Adjust Quantity**: Use the **+** and **-** buttons on the item card to change quantity.
3.  **View Cart**: Click the **Cart** icon or section to review your selection.
4.  **Checkout**:
    *   Enter your **Table Number** (Required).
    *   Add any **Special Instructions** or notes (Optional).
    *   Click **Place Order**.
5.  **Confirmation**: A confirmation screen will appear with your **Order Number**. Keep this number for reference.

---

## 3. Employee Dashboard
*Designed for kitchen staff, waiters, and managers to process orders.*

### Managing Orders (Kitchen Display)
1.  **View Orders**: The main screen displays active orders as cards.
2.  **Filter**: Use the top buttons to filter by status (Pending, Preparing, Ready, Completed).
3.  **Update Status**:
    *   Locate the order card.
    *   Use the **Order Status** dropdown to change progress (e.g., move from *Pending* to *Preparing*).
4.  **Payment Status**:
    *   Use the **Payment Status** dropdown to mark as *Confirmed* when cash/card is received.
    *   *Note: Confirming payment automatically marks the order as Completed.*

### Order Details & Modifications
Click on any order card to open the **Detailed View**:
1.  **Edit Details**: Click the pencil icon next to Table Number or Notes to edit them.
2.  **Modify Items**:
    *   **Add Item**: Click "Add Item" to add new products to an active order.
    *   **Adjust Qty**: Use + / - buttons next to items.
    *   **Remove**: Click "Remove" to delete an item.
3.  **Discounts**:
    *   Select Discount Type (Fixed Amount or Percentage).
    *   Enter value and the total updates automatically.
4.  **Print Bill**:
    *   Click **Verify Payment & Print Bill**.
    *   This confirms payment and opens a print window for the thermal receipt.

### Taking Orders (POS Mode)
If a staff member needs to place an order for a customer:
1.  Click the **🛒 Customer Order** button in the top right.
2.  The interface switches to a menu view similar to the customer's.
3.  Select items and proceed to checkout.
4.  Enter the table number and place the order. It will immediately appear in the order queue.

---

## 4. Admin Dashboard
*Full control over the restaurant operations.*

### Dashboard Overview
*   View real-time stats: Total Orders, Pending Orders, Today's Revenue.
*   See a list of the most recent orders.

### Menu Management
Navigate to the **Menu** section:
1.  **Add Item**: Click **Add Menu Item**. Fill in Name, Price, Category, Food Type, and Image URL.
2.  **Edit Item**: Click **Edit** on any item card to update price, availability, or description.
3.  **Delete Item**: Click **Delete** to remove an item permanently.
4.  **Manage Categories/Types**:
    *   Click **Add Category** to create new menu sections.
    *   Click **Add Food Type** to create new grouping tags (e.g., Naan, Rice).

### Order Management
Navigate to the **Orders** section:
1.  **View All**: See a tabular list of all orders history.
2.  **Search**: Enter an Order Number in the search bar to find a specific transaction.
3.  **Export CSV**:
    *   Select a **From Date** and **To Date**.
    *   Click **Export CSV** to download sales data for Excel/Sheets.
4.  **Edit/Delete**: Click any row to view details. Admins have the unique ability to **Delete** entire orders if necessary.

### User Management
Navigate to the **Users** section:
1.  **Add Staff**: Click **Add User**. Enter Name, Email, Password, and Role (Staff/Manager/Admin).
2.  **Edit User**: Update roles or contact info.
3.  **Change Password**: Admin can manually reset a user's password if forgotten.
4.  **Delete User**: Remove access for former employees.

### Revenue Management
Navigate to the **Overview** section:
1.  **Today's Revenue**: Shows total calculated from completed, paid orders since the last reset.
2.  **Reset Revenue**: Click **Reset Revenue** to zero out the counter (e.g., at the start of a new shift or day).