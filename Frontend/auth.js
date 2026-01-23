
// --- auth.js ---
// A simple, frontend-only authentication module.
// In a real-world application, this would make API calls to a secure backend.

/**
 * Key for storing user data in localStorage.
 * Using a structured object helps keep localStorage clean.
 */
const STORAGE_KEY = 'restaurantUser';

/**
 * Mock user database. In a real application, this would not exist on the client.
 * Passwords would be hashed and stored securely on a server.
 */
const MOCK_USERS = {
    "admin@example.com": { pass: "password123", role: "admin" },
    "staff@example.com": { pass: "password123", role: "staff" }
};

/**
 * Logs a user in by checking credentials against the mock database.
 * On success, it stores user info in localStorage.
 *
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {object|null} The user object with their role if login is successful, otherwise null.
 */
function login(email, password) {
    const user = MOCK_USERS[email];
    if (user && user.pass === password) {
        const userData = {
            email: email,
            role: user.role,
            loggedInAt: new Date().toISOString()
        };
        // Store user data in localStorage.
        // JSON.stringify is used because localStorage can only store strings.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        console.log(`Login successful for ${email}, role: ${user.role}`);
        return userData;
    }
    console.error("Login failed: Invalid email or password.");
    return null;
}

/**
 * Logs the current user out by clearing their data from localStorage.
 */
function logout() {
    localStorage.removeItem(STORAGE_KEY);
    console.log("User logged out.");
    // Redirect to the login page after logout.
    window.location.href = '/Frontend/index.html';
}

/**
 * Retrieves the logged-in user's data from localStorage.
 *
 * @returns {object|null} The user data object if it exists, otherwise null.
 */
function getLoggedInUser() {
    const userData = localStorage.getItem(STORAGE_KEY);
    if (userData) {
        // JSON.parse converts the string back into an object.
        return JSON.parse(userData);
    }
    return null;
}

/**
 * Protects a page by checking if a user is logged in.
 * If no user is found, it redirects to the login page.
 * This function should be called at the top of any page that requires authentication.
 */
function protectPage() {
    const user = getLoggedInUser();
    if (!user) {
        console.warn("Access denied. No user logged in. Redirecting to login page.");
        window.location.href = '/Frontend/index.html';
    } else {
        console.log(`Access granted for user: ${user.email}`);
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { login, logout, getLoggedInUser, STORAGE_KEY, MOCK_USERS };
}
