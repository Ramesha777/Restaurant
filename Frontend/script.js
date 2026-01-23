// Shared utilities and helper functions

// Check if user is authenticated and redirect if not
function checkAuth() {
    return new Promise((resolve, reject) => {
        if (typeof firebase === 'undefined') {
            reject(new Error('Firebase not loaded'));
            return;
        }
        
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                resolve(user);
            } else {
                window.location.href = 'index.html';
                reject(new Error('Not authenticated'));
            }
        });
    });
}

// Get user role and redirect to appropriate dashboard
async function redirectByRole() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        const role = userData?.role || 'customer';

        const currentPage = window.location.pathname.split('/').pop();

        // Check if recently redirected
        const lastRedirect = sessionStorage.getItem('lastRedirect');
        if (lastRedirect && Date.now() - lastRedirect < 5000) {
            // Recently redirected, don't redirect again
            return;
        }

        // Redirect based on role
        if (role === 'admin' && !currentPage.includes('admin')) {
            sessionStorage.setItem('lastRedirect', Date.now());
            window.location.href = 'admin.html';
        } else if ((role === 'staff' || role === 'manager') && !currentPage.includes('employee')) {
            sessionStorage.setItem('lastRedirect', Date.now());
            window.location.href = 'employee.html';
        } else if (role === 'customer' && !currentPage.includes('customer')) {
            sessionStorage.setItem('lastRedirect', Date.now());
            window.location.href = 'customer/customer.html';
        }
    } catch (error) {
        console.error('Error redirecting by role:', error);
        window.location.href = 'index.html';
    }
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(amount);
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS for notifications
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Logout function
async function logout() {
    try {
        await firebase.auth().signOut();
        window.location.href = 'index.html';
    } catch (error) {
        showNotification('Error logging out: ' + error.message, 'error');
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatDate, formatCurrency };
}
