// DOM elements
const form = document.getElementById('authForm');
const submitBtn = document.getElementById('submitBtn');
const messageContainer = document.getElementById('messageContainer');

// Show message
function showMessage(text, type) {
    messageContainer.innerHTML = `<div class="message ${type}">${text}</div>`;
}

// Clear message
function clearMessage() {
    messageContainer.innerHTML = '';
}

// Form submission - Login only
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessage();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Basic validation
    if (!email || !password) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing In...';

    try {
        // Login
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const userDoc = await firebase.firestore().collection('users').doc(userCredential.user.uid).get();
        const userData = userDoc.data();
        const role = userData?.role || 'staff';

        showMessage('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            // Redirect based on role
            if (role === 'admin') {
                window.location.href = 'admin.html';
            } else if (role === 'staff' || role === 'manager') {
                window.location.href = 'employee.html';
            } else {
                // Invalid role, redirect to login
                showMessage('Invalid user role. Please contact administrator.', 'error');
            }
        }, 1500);
    } catch (error) {
        let errorMessage = 'An error occurred';
        if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'This account has been disabled';
        } else {
            errorMessage = error.message;
        }
        showMessage(errorMessage, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
});

// Check if user is already logged in - Wait for Firebase to be ready
if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            const lastRedirect = sessionStorage.getItem('lastRedirect');
            if (lastRedirect && Date.now() - lastRedirect < 5000) {
                // Recently redirected, don't redirect again
                return;
            }
            // User is logged in, redirect to appropriate dashboard
            firebase.firestore().collection('users').doc(user.uid).get().then(doc => {
                const userData = doc.data();
                const role = userData?.role || 'staff';
                if (role === 'admin') {
                    if (!window.location.pathname.includes('admin.html')) {
                        sessionStorage.setItem('lastRedirect', Date.now());
                        window.location.href = 'admin.html';
                    }
                } else if (role === 'staff' || role === 'manager') {
                    if (!window.location.pathname.includes('employee.html')) {
                        sessionStorage.setItem('lastRedirect', Date.now());
                        window.location.href = 'employee.html';
                    }
                } else {
                    // Invalid role, stay on login page
                    showMessage('Invalid user role. Please contact administrator.', 'error');
                }
            }).catch(() => {
                // Handle error silently
            });
        }
    });
}
