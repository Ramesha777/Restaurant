
# Troubleshooting Guide

This guide provides solutions to common issues you might encounter while working on the Restaurant Management System.

## 1. Firebase Errors

### `auth/api-key-not-valid`

This is the most common error and is usually caused by incorrect Firebase configuration.

**Solution:**

1.  **Check `Backend/firebase.js`**: Ensure that this file contains the correct Firebase project credentials.
2.  **Check HTML Files**: Make sure that all HTML files that use Firebase are correctly including the `Backend/firebase.js` script. The script tag should look like this:

    ```html
    <script src="../Backend/firebase.js"></script>
    ```

    or, for files in subdirectories:

    ```html
    <script src="../../Backend/firebase.js"></script>
    ```

3.  **Check for Hardcoded Credentials**: Search the project for any hardcoded Firebase credentials. All credentials should be centralized in `Backend/firebase.js`.

### `auth/user-not-found` or `auth/wrong-password`

These errors occur during login and indicate that the user's credentials are not valid.

**Solution:**

1.  **Check User in Firebase Console**: Verify that the user exists in the Firebase Authentication console and that their email and password are correct.
2.  **Check User Roles**: The application uses user roles to determine which dashboard to display. Make sure that the user has the correct role assigned to them in the Firestore database.

## 2. Display Issues

### Menu Items Not Displaying

If menu items are not displaying on the customer or admin pages, check the following:

1.  **Check the `menu` Collection in Firestore**: Ensure that the `menu` collection in your Firestore database contains data.
2.  **Check Console for Errors**: Open the browser's developer console and check for any errors related to Firestore queries.
3.  **Check `available` Field**: The application filters out menu items where the `available` field is set to `false`. Make sure that the items you want to display are marked as available.

### Orders Not Displaying

If orders are not displaying on the employee or admin dashboards, check the following:

1.  **Check the `orders` Collection in Firestore**: Ensure that the `orders` collection in your Firestore database contains data.
2.  **Check Console for Errors**: Open the browser's developer console and check for any errors related to Firestore queries.
3.  **Check Order Status Filters**: The employee and admin dashboards have filters for order statuses. Make sure that you have the correct filter selected.

## 3. Developer Notes

### `NOTES.md`

This file contains a summary of the most recent changes to the project. If you are a developer working on this project, it is recommended to read this file to stay up-to-date with the latest modifications.

---

*This guide was created by an AI assistant to help you troubleshoot common issues with the project.*
