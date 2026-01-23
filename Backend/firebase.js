// Firebase Configuration and Initialization
// Replace these values with your Firebase project credentials

const firebaseConfig = {
    apiKey: "AIzaSyDmGbIhwAXDxUrZDUZn_swF6uQYj-RSb7Q",
    authDomain: "restaurant-testing-3725d.firebaseapp.com",
    projectId: "restaurant-testing-3725d",
    storageBucket: "restaurant-testing-3725d.firebasestorage.app",
    messagingSenderId: "926466053536",
    appId: "1:926466053536:web:c01384e7165c97d21b00c5"
};

// Initialize Firebase (if not already initialized)
// This will run when the script is loaded, after Firebase SDK is loaded
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
} else {
    // If Firebase SDK hasn't loaded yet, wait for it
    window.addEventListener('DOMContentLoaded', function() {
        if (typeof firebase !== 'undefined' && !firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
    });
}

// Export Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = typeof firebase.storage === 'function' ? firebase.storage() : null;

// Helper functions for authentication
const authHelpers = {
    // Register a new user
    async registerUser(email, password, name, phone, role) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name });
            
            // Save user data to Firestore
            await db.collection('users').doc(userCredential.user.uid).set({
                name,
                email,
                phone: phone || '',
                role: role || 'customer',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return userCredential.user;
        } catch (error) {
            throw new Error(this.getErrorMessage(error));
        }
    },

    // Login user
    async loginUser(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return userCredential.user;
        } catch (error) {
            throw new Error(this.getErrorMessage(error));
        }
    },

    // Logout user
    async logoutUser() {
        try {
            await auth.signOut();
        } catch (error) {
            throw new Error(this.getErrorMessage(error));
        }
    },

    // Get current user
    getCurrentUser() {
        return auth.currentUser;
    },

    // Get user data from Firestore
    async getUserData(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            throw new Error('Failed to fetch user data');
        }
    },

    // Check authentication state
    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    },

    // Get error message
    getErrorMessage(error) {
        switch (error.code) {
            case 'auth/email-already-in-use':
                return 'This email is already registered';
            case 'auth/invalid-email':
                return 'Invalid email address';
            case 'auth/operation-not-allowed':
                return 'Email/password accounts are not enabled';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters';
            case 'auth/user-disabled':
                return 'This account has been disabled';
            case 'auth/user-not-found':
                return 'No account found with this email';
            case 'auth/wrong-password':
                return 'Incorrect password';
            default:
                return error.message || 'An error occurred';
        }
    }
};

// Helper functions for Firestore operations
const dbHelpers = {
    // Menu items
    async getMenuItems() {
        try {
            const snapshot = await db.collection('menu').orderBy('category').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            throw new Error('Failed to fetch menu items');
        }
    },

    async addMenuItem(item) {
        try {
            const docRef = await db.collection('menu').add({
                ...item,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            throw new Error('Failed to add menu item');
        }
    },

    async updateMenuItem(id, updates) {
        try {
            await db.collection('menu').doc(id).update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            throw new Error('Failed to update menu item');
        }
    },

    async deleteMenuItem(id) {
        try {
            await db.collection('menu').doc(id).delete();
        } catch (error) {
            throw new Error('Failed to delete menu item');
        }
    },

    // Orders
    async createOrder(orderData) {
        try {
            const docRef = await db.collection('orders').add({
                ...orderData,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            throw new Error('Failed to create order');
        }
    },

    async getOrders(filters = {}) {
        try {
            let query = db.collection('orders');
            
            if (filters.status) {
                query = query.where('status', '==', filters.status);
            }
            if (filters.userId) {
                query = query.where('userId', '==', filters.userId);
            }
            
            const snapshot = await query.orderBy('createdAt', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            throw new Error('Failed to fetch orders');
        }
    },

    async updateOrderStatus(orderId, status) {
        try {
            await db.collection('orders').doc(orderId).update({
                status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            throw new Error('Failed to update order status');
        }
    },

    // Real-time order updates
    subscribeToOrders(callback, filters = {}) {
        let query = db.collection('orders');
        
        if (filters.status) {
            query = query.where('status', '==', filters.status);
        }
        if (filters.userId) {
            query = query.where('userId', '==', filters.userId);
        }
        
        return query.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(orders);
        });
    },

    // Inventory
    async getInventory() {
        try {
            const snapshot = await db.collection('inventory').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            throw new Error('Failed to fetch inventory');
        }
    },

    async updateInventoryItem(id, updates) {
        try {
            await db.collection('inventory').doc(id).update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            throw new Error('Failed to update inventory item');
        }
    },

    // Staff management
    async getStaff() {
        try {
            const snapshot = await db.collection('users')
                .where('role', 'in', ['staff', 'manager', 'admin'])
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            throw new Error('Failed to fetch staff');
        }
    }
};

// Export everything
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseConfig, authHelpers, dbHelpers };
}
