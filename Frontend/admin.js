// Check authentication and role - Wait for Firebase to be ready
if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        if (userData?.role !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
        
        // Update welcome message with admin name
        const adminName = userData.name || 'Admin';
        const welcomeMsg = document.getElementById('adminWelcomeMsg');
        if (welcomeMsg) {
            welcomeMsg.textContent = `Welcome back, ${adminName}! 🙏`;
            // increase font size and bold the welcome message
            welcomeMsg.style.fontSize = '1.2rem';
            welcomeMsg.style.fontWeight = 'bold';
        }
        
        initializeDashboard();
    });
} else {
    console.error('Firebase SDK not loaded');
}

let currentEditingItemId = null;
let availableCategories = ['starter', 'main', 'dessert', 'beverage'];
let availableFoodTypes = ['momo', 'naan', 'curry', 'rice', 'noodle'];
let adminCurrentFilter = '';
let adminOrdersUnsubscribe = null;
let adminSearchedOrder = null;
let adminCart = [];
let adminMenuItems = [];
let adminCurrentCategory = '';
let adminCurrentFoodType = '';
let currentAdminName = '';

async function initializeDashboard() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));

            item.classList.add('active');
            const section = item.dataset.section;
            document.getElementById(section).classList.add('active');

            // Load data for the section
            if (section === 'menu') loadMenuItems();
            else if (section === 'orders') loadOrders();
            else if (section === 'users') loadUsers();
            else if (section === 'overview') loadOverview();
            else if (section === 'customer-order') {
                adminLoadOrders();
                adminShowOrdersView();
            }
        });
    });

    // Load initial data
    loadCategories();
    loadFoodTypes();
    loadOverview();
    loadUsers();
}

async function loadOverview() {
    try {
        const orders = await firebase.firestore().collection('orders').get();
        const menuItems = await firebase.firestore().collection('menu').get();

        const ordersData = orders.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const todaysRevenue = await calculateTodaysRevenue(ordersData);

        document.getElementById('totalOrders').textContent = ordersData.length;
        document.getElementById('pendingOrders').textContent = ordersData.filter(o => o.status === 'pending').length;
        document.getElementById('totalRevenue').textContent = formatCurrency(todaysRevenue);
        document.getElementById('menuItems').textContent = menuItems.size;

        // Recent orders
        const recentOrders = ordersData.slice(0, 5);
        const recentOrdersHtml = recentOrders.map(order => `
            <div style="padding: 1rem; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between;">
                <div>
                    <strong>Order ${order.orderNumber ? `#${order.orderNumber}` : `#${order.id.substring(0, 8)}`}</strong>
                    <p style="color: #666; font-size: 0.9rem;">${order.customerName || 'Guest'} ${order.tableNumber ? `| Table ${order.tableNumber}` : ''}</p>
                </div>
                <div style="text-align: right;">
                    <span class="badge badge-${order.status}">${order.status}</span>
                    <p style="margin-top: 0.5rem; font-weight: 600;">${formatCurrency(order.total || 0)}</p>
                </div>
            </div>
        `).join('');
        document.getElementById('recentOrders').innerHTML = recentOrdersHtml || '<p>No recent orders</p>';
    } catch (error) {
        console.error('Error loading overview:', error);
    }
}

async function loadCategories() {
    try {
        const snapshot = await firebase.firestore().collection('categories').orderBy('name').get();
        availableCategories = snapshot.docs.map(doc => doc.data().name);

        // Add default categories if none exist
        if (availableCategories.length === 0) {
            availableCategories = ['starter', 'main', 'dessert', 'beverage'];
            // Save default categories
            const batch = firebase.firestore().batch();
            availableCategories.forEach(cat => {
                const ref = firebase.firestore().collection('categories').doc();
                batch.set(ref, { name: cat });
            });
            await batch.commit();
        }

        updateCategorySelect();
    } catch (error) {
        console.error('Error loading categories:', error);
        availableCategories = ['starter', 'main', 'dessert', 'beverage'];
        updateCategorySelect();
    }
}

async function loadFoodTypes() {
    try {
        const snapshot = await firebase.firestore().collection('foodTypes').orderBy('name').get();
        availableFoodTypes = snapshot.docs.map(doc => doc.data().name);

        // Add default food types if none exist
        if (availableFoodTypes.length === 0) {
            availableFoodTypes = ['momo', 'naan', 'curry', 'rice', 'noodle'];
            // Save default food types
            const batch = firebase.firestore().batch();
            availableFoodTypes.forEach(type => {
                const ref = firebase.firestore().collection('foodTypes').doc();
                batch.set(ref, { name: type });
            });
            await batch.commit();
        }

        updateFoodTypeSelect();
        updateAdminFoodTypeFilters();
    } catch (error) {
        console.error('Error loading food types:', error);
        availableFoodTypes = ['momo', 'naan', 'curry', 'rice', 'noodle'];
        updateFoodTypeSelect();
        updateAdminFoodTypeFilters();
    }
}

function updateCategorySelect() {
    const select = document.getElementById('itemCategory');
    select.innerHTML = '<option value="">Select Category</option>' +
        availableCategories.map(cat => `<option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`).join('');
}

function updateFoodTypeSelect() {
    const select = document.getElementById('itemFoodType');
    if (!select) return;
    select.innerHTML = '<option value="">Select Food Type</option>' +
        availableFoodTypes.map(type => `<option value="${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</option>`).join('');
}

function updateAdminFoodTypeFilters() {
    const container = document.getElementById('adminFoodTypeFilters');
    if (container) {
        container.innerHTML = '';
    }
}

function addNewCategory() {
    const categoryName = prompt('Enter new category name:');
    if (!categoryName || !categoryName.trim()) return;

    const normalizedName = categoryName.toLowerCase().trim();
    if (availableCategories.includes(normalizedName)) {
        showNotification('Category already exists', 'error');
        return;
    }

    availableCategories.push(normalizedName);
    updateCategorySelect();

    // Save to Firestore
    firebase.firestore().collection('categories').add({
        name: normalizedName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => {
        console.error('Error saving category:', error);
        showNotification('Error saving category', 'error');
    });

    showNotification('Category added successfully', 'success');
}

function addNewFoodType() {
    const foodTypeName = prompt('Enter new food type name (e.g., Naan, Curry, Rice):');
    if (!foodTypeName || !foodTypeName.trim()) return;

    const normalizedName = foodTypeName.toLowerCase().trim();
    if (availableFoodTypes.includes(normalizedName)) {
        showNotification('Food type already exists', 'error');
        return;
    }

    availableFoodTypes.push(normalizedName);
    updateFoodTypeSelect();
    updateAdminFoodTypeFilters();

    // Save to Firestore
    firebase.firestore().collection('foodTypes').add({
        name: normalizedName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => {
        console.error('Error saving food type:', error);
        showNotification('Error saving food type', 'error');
    });

    showNotification('Food type added successfully', 'success');
}

async function loadMenuItems() {
    try {
        const snapshot = await firebase.firestore().collection('menu').get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort by category in memory to avoid Firestore index requirements
        items.sort((a, b) => (a.category || '').localeCompare(b.category || ''));

        const menuGrid = document.getElementById('menuGrid');
        menuGrid.innerHTML = items.map(item => `
            <div class="menu-item-card">
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
                <h3>${item.name}</h3>
                <p style="color: #666; font-size: 0.9rem; margin: 0.5rem 0;">${item.description || ''}</p>
                <div class="price">£${(item.price || 0).toFixed(2)}</div>
                <div style="font-size: 0.85rem; color: #666;">
                    Category: ${item.category} | Type: ${item.foodType || 'N/A'}
                    ${item.spicyLevel === 'ask' ? '| 🌶️ Ask for Spicy Level' : ''}
                    ${item.available !== false ? '✅ Available' : '❌ Unavailable'}
                </div>
                <div class="menu-item-actions">
                    <button class="btn btn-edit btn-small" onclick="editMenuItem('${item.id}')">Edit</button>
                    <button class="btn btn-danger btn-small" onclick="deleteMenuItem('${item.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading menu items:', error);
        showNotification('Error loading menu items', 'error');
    }
}

async function loadOrders() {
    try {
        let query = firebase.firestore().collection('orders');
        const statusFilter = document.getElementById('orderStatusFilter').value;
        if (statusFilter) {
            query = query.where('status', '==', statusFilter);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').get();
        const orders = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data };
        });

        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.orderNumber ? `#${order.orderNumber}` : `#${order.id.substring(0, 8)}`}</td>
                <td>${order.customerName || 'Guest'} ${order.tableNumber ? `(Table ${order.tableNumber})` : ''}</td>
                <td>${order.items ? order.items.length : 0} items</td>
                <td>${formatCurrency(order.total || 0)}</td>
                <td>
                    <span class="badge badge-${order.status}">${order.status}</span>
                    ${order.paymentStatus ? `<br><span class="badge ${order.paymentStatus === 'confirmed' ? 'badge-completed' : 'badge-pending'}" style="margin-top: 0.25rem; display: inline-block;">Payment: ${order.paymentStatus}</span>` : ''}
                </td>
                <td>${formatDate(order.createdAt)}</td>
                <td>
                    <select onchange="updateOrderStatus('${order.id}', this.value)" value="${order.status}" style="margin-bottom: 0.5rem; width: 100%;">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                        <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                    ${order.paymentStatus === 'confirmed' && order.confirmedBy ?
                        `<small style="display: block; color: #4caf50; font-size: 0.75rem; margin-top: 0.25rem;">Confirmed by: ${order.confirmedBy}</small>` :
                        ''}
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" style="text-align: center;">No orders found</td></tr>';
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Error loading orders', 'error');
    }
}

async function loadStaff() {
    try {
        const snapshot = await firebase.firestore().collection('users')
            .where('role', 'in', ['staff', 'manager', 'admin'])
            .get();
        const staff = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data };
        });
        
        const tbody = document.getElementById('staffTableBody');
        tbody.innerHTML = staff.map(member => `
            <tr>
                <td>${member.name || 'N/A'}</td>
                <td>${member.email || 'N/A'}</td>
                <td>${member.phone || 'N/A'}</td>
                <td><span class="badge">${member.role || 'N/A'}</span></td>
                <td>${formatDate(member.createdAt)}</td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align: center;">No staff members found</td></tr>';
    } catch (error) {
        console.error('Error loading staff:', error);
        showNotification('Error loading staff', 'error');
    }
}

async function loadUsers() {
    try {
        const snapshot = await firebase.firestore().collection('users')
            .where('role', 'in', ['staff', 'manager', 'admin'])
            .get();
        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data };
        });
        
        // Sort in memory to avoid index requirement
        users.sort((a, b) => {
            const dateA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });

        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name || 'N/A'}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.phone || 'N/A'}</td>
                <td><span class="badge">${user.role || 'staff'}</span></td>
                <td>${formatDate(user.createdAt)}</td>
                <td>
                    <button class="btn btn-edit btn-small" onclick="openEditUserModal('${user.id}')">Edit</button>
                    <button class="btn btn-secondary btn-small" onclick="openChangePasswordModal('${user.id}', '${user.name || user.email}')">Password</button>
                    <button class="btn btn-danger btn-small" onclick="deleteUser('${user.id}')" ${user.role === 'admin' ? 'disabled title="Cannot delete admin users"' : ''}>Delete</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="text-align: center;">No staff members found</td></tr>';
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Error loading users', 'error');
    }
}

function openAddUserModal() {
    document.getElementById('addUserForm').reset();
    document.getElementById('addUserModal').classList.add('active');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('active');
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
        // Delete user from Firestore
        
        await firebase.firestore().collection('users').doc(userId).delete();
        showNotification('User deleted successfully', 'success');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Error deleting user', 'error');
    }
}
// Menu Item Functions
function openAddMenuItemModal() {
    currentEditingItemId = null;
    document.getElementById('modalTitle').textContent = 'Add Menu Item';
    document.getElementById('menuItemForm').reset();
    document.getElementById('menuItemModal').classList.add('active');
}

// Close menu item modal
function closeMenuItemModal() {
    document.getElementById('menuItemModal').classList.remove('active');
    currentEditingItemId = null;
}
// Edit menu item
async function editMenuItem(id) {
    try {
        const doc = await firebase.firestore().collection('menu').doc(id).get();
        const item = doc.data();

        currentEditingItemId = id;
        document.getElementById('modalTitle').textContent = 'Edit Menu Item';
        document.getElementById('itemName').value = item.name || '';
        document.getElementById('itemDescription').value = item.description || '';
        document.getElementById('itemCategory').value = item.category || 'main';
        document.getElementById('itemFoodType').value = item.foodType || '';
        document.getElementById('itemPrice').value = item.price || '';
        document.getElementById('itemImage').value = item.image || '';
        document.getElementById('itemAvailable').value = item.available !== false ? 'true' : 'false';
        document.getElementById('itemSpicyLevel').value = item.spicyLevel || 'not needed';

        document.getElementById('menuItemModal').classList.add('active');
    } catch (error) {
        showNotification('Error loading menu item', 'error');
    }
}
// Delete menu item
async function deleteMenuItem(id) {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    
    try {
        await firebase.firestore().collection('menu').doc(id).delete();
        showNotification('Menu item deleted successfully', 'success');
        loadMenuItems();
    } catch (error) {
        showNotification('Error deleting menu item', 'error');
    }
}
// Handle menu item form submission
document.getElementById('menuItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const itemData = {
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDescription').value,
        category: document.getElementById('itemCategory').value,
        foodType: document.getElementById('itemFoodType').value,
        price: parseFloat(document.getElementById('itemPrice').value),
        spicyLevel: document.getElementById('itemSpicyLevel').value,
        image: document.getElementById('itemImage').value,
        available: document.getElementById('itemAvailable').value === 'true',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
// Save or update menu item
    try {
        if (currentEditingItemId) {
            await firebase.firestore().collection('menu').doc(currentEditingItemId).update(itemData);
            showNotification('Menu item updated successfully', 'success');
        } else {
            itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await firebase.firestore().collection('menu').add(itemData);
            showNotification('Menu item added successfully', 'success');
        }
// Close modal and reload menu items
        closeMenuItemModal();
        loadMenuItems();
    } catch (error) {
        showNotification('Error saving menu item', 'error');
    }
});
// Update order status
async function updateOrderStatus(orderId, status) {
    try {
        await firebase.firestore().collection('orders').doc(orderId).update({
            status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification('Order status updated', 'success');
        loadOrders();
    } catch (error) {
        showNotification('Error updating order status', 'error');
    }
}

// User Management Functions
async function openEditUserModal(userId) {
    try {
        const doc = await firebase.firestore().collection('users').doc(userId).get();
        const user = doc.data();

        document.getElementById('editUserId').value = userId;
        document.getElementById('editUserName').value = user.name || '';
        document.getElementById('editUserEmail').value = user.email || '';
        document.getElementById('editUserPhone').value = user.phone || '';
        document.getElementById('editUserRole').value = user.role || 'staff';

        document.getElementById('editUserModal').classList.add('active');
    } catch (error) {
        console.error('Error loading user:', error);
        showNotification('Error loading user details', 'error');
    }
}
// Close edit user modal
function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('active');
}
// Open change password modal
function openChangePasswordModal(userId, userName) {
    document.getElementById('changePasswordUserId').value = userId;
    document.getElementById('changePasswordUserName').textContent = userName;
    document.getElementById('changePasswordForm').reset();
    document.getElementById('changePasswordModal').classList.add('active');
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.remove('active');
}

// Edit User Form Submission
document.getElementById('editUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const updates = {
        name: document.getElementById('editUserName').value,
        phone: document.getElementById('editUserPhone').value,
        role: document.getElementById('editUserRole').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await firebase.firestore().collection('users').doc(userId).update(updates);
        showNotification('User updated successfully', 'success');
        closeEditUserModal();
        loadUsers();
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Error updating user', 'error');
    }
});

// Close modals on outside click
document.getElementById('editUserModal').addEventListener('click', (e) => { if (e.target.id === 'editUserModal') closeEditUserModal(); });
document.getElementById('changePasswordModal').addEventListener('click', (e) => { if (e.target.id === 'changePasswordModal') closeChangePasswordModal(); });

// Close modal when clicking outside
document.getElementById('menuItemModal').addEventListener('click', (e) => {
    if (e.target.id === 'menuItemModal') {
        closeMenuItemModal();
    }
});

document.getElementById('addUserModal').addEventListener('click', (e) => {
    if (e.target.id === 'addUserModal') {
        closeAddUserModal();
    }
});

// Handle add user form submission
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const phone = document.getElementById('userPhone').value;
    const role = document.getElementById('userRole').value;
    const password = document.getElementById('userPassword').value;

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        // Create a secondary app instance to create user without logging out the admin
        const tempAppName = 'secondaryApp-' + Date.now();
        const secondaryApp = firebase.initializeApp(firebaseConfig, tempAppName);

        // Create user in Firebase Authentication using secondary app
        const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });

        // Save user data to Firestore using the main app (Admin session)
        await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
            name,
            email,
            phone: phone || '',
            role: role || 'staff',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Cleanup secondary app
        await secondaryApp.auth().signOut();
        await secondaryApp.delete();

        showNotification('User created successfully!', 'success');
        closeAddUserModal();
        loadUsers();
    } catch (error) {
        let errorMessage = 'Error creating user';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters';
        } else {
            errorMessage = error.message;
        }
        showNotification(errorMessage, 'error');
    }
});

// Handle change password form submission
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('changePasswordUserId').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    try {
        // Note: Firebase Admin SDK would be needed to change another user's password
        // For now, we'll update the password in Firestore (manual process)
        await firebase.firestore().collection('users').doc(userId).update({
            passwordResetRequired: true,
            tempPassword: newPassword,
            passwordChangedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('Password change request saved. User will need to login with new password.', 'success');
        closeChangePasswordModal();
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification('Error changing password', 'error');
    }
});

// Customer Order Functions for Admin
// Get current admin name
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        currentAdminName = userData?.name || user.email;
    }
});

function adminToggleView() {
    const ordersView = document.getElementById('adminOrdersView');
    const menuView = document.getElementById('adminMenuView');
    const cartView = document.getElementById('adminCartView');
    const toggleBtn = document.getElementById('adminToggleViewBtn');
    const cartBtn = document.getElementById('adminCartBtn');

    if (ordersView.style.display === 'none') {
        // Show orders view
        ordersView.style.display = 'block';
        menuView.style.display = 'none';
        cartView.style.display = 'none';
        cartBtn.style.display = 'none';
        toggleBtn.textContent = '🛒 Customer Order';
        adminLoadOrders();
    } else {
        // Show customer order view
        ordersView.style.display = 'none';
        menuView.style.display = 'block';
        cartView.style.display = 'none';
        cartBtn.style.display = 'inline-block';
        toggleBtn.textContent = '📋 View Orders';
        loadAdminMenu();
        showAdminMenu();
    }
}

function adminShowOrdersView() {
    document.getElementById('adminOrdersView').style.display = 'block';
    document.getElementById('adminMenuView').style.display = 'none';
    document.getElementById('adminCartView').style.display = 'none';
    document.getElementById('adminCartBtn').style.display = 'none';
    document.getElementById('adminToggleViewBtn').textContent = '🛒 Customer Order';
}

function adminShowMenuView() {
    document.getElementById('adminOrdersView').style.display = 'none';
    document.getElementById('adminMenuView').style.display = 'block';
    document.getElementById('adminCartView').style.display = 'none';
    document.getElementById('adminCartBtn').style.display = 'inline-block';
    document.getElementById('adminToggleViewBtn').textContent = '📋 View Orders';
}

function adminFilterOrders(status) {
    adminCurrentFilter = status;

    // Update active filter button
    document.querySelectorAll('#adminOrderFilters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#adminOrderFilters [data-status="${status}"]`).classList.add('active');

    // Reload orders with filter
    adminLoadOrders();
}

function adminSubscribeToOrders() {
    let query = firebase.firestore().collection('orders');

    if (adminCurrentFilter) {
        query = query.where('status', '==', adminCurrentFilter);
    }

    adminOrdersUnsubscribe = query.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const orders = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data };
        });

        adminDisplayOrders(orders);
    }, error => {
        console.error('Error loading orders:', error);
        showNotification('Error loading orders', 'error');
    });
}

async function adminLoadOrders() {
    try {
        let query = firebase.firestore().collection('orders');

        if (adminCurrentFilter) {
            query = query.where('status', '==', adminCurrentFilter);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').get();
        const orders = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data };
        });

        adminDisplayOrders(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Error loading orders', 'error');
    }
}

async function adminDisplayOrders(orders) {
    const container = document.getElementById('adminOrdersContainer');

    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">No orders found</p>';
        return;
    }

    container.innerHTML = orders.map(order => {
        return `
            <div class="order-card ${order.status}" onclick="adminOpenOrderDetails('${order.id}')" style="cursor: pointer;">
                <div class="order-header">
                    <div>
                        <h3>Order ${order.orderNumber ? `#${order.orderNumber}` : `#${order.id.substring(0, 8)}`}</h3>
                        <p style="color: #666; font-size: 0.9rem;">
                            Table: ${order.tableNumber || 'N/A'}
                        </p>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <span class="badge badge-${order.status}">${order.status}</span>
                        <span class="badge ${(order.paymentStatus || 'pending') === 'confirmed' ? 'badge-completed' : 'badge-pending'}">
                            Payment: ${order.paymentStatus || 'pending'}
                        </span>
                        <div style="font-size: 1.1rem; font-weight: 600; color: #ff6f00;">
                            ${formatCurrency(order.total || 0)}
                        </div>
                    </div>
                </div>

                <div class="order-actions" onclick="event.stopPropagation()">
                    <div style="margin-bottom: 0.75rem;">
                        <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; color: #666; font-weight: 600;">Order Status:</label>
                        <select class="status-select" onchange="adminUpdateOrderStatus('${order.id}', this.value)" value="${order.status}" style="width: 100%;">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                            <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; color: #666; font-weight: 600;">Payment Status:</label>
                        <select class="status-select" onchange="adminUpdatePaymentStatus('${order.id}', this.value)" value="${order.paymentStatus || 'pending'}" style="width: 100%;">
                            <option value="pending" ${(order.paymentStatus || 'pending') === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="confirmed" ${order.paymentStatus === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        </select>
                        ${order.paymentStatus === 'confirmed' && order.confirmedBy ?
                            `<p style="font-size: 0.75rem; color: #4caf50; margin-top: 0.25rem;">Confirmed by: ${order.confirmedBy}</p>` :
                            ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadAdminMenu() {
    try {
        const snapshot = await firebase.firestore().collection('menu').get();
        adminMenuItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log('Menu items loaded:', adminMenuItems.length);

        // Sort by category in memory to avoid Firestore index requirements
        adminMenuItems.sort((a, b) => (a.category || '').localeCompare(b.category || ''));

        renderAdminMenu();
    } catch (error) {
        console.error('Error loading menu:', error);
        showNotification('Error loading menu', 'error');
    }
}

function filterAdminMenu(category) {
    adminCurrentCategory = category;
    document.querySelectorAll('#adminMenuView .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#adminMenuView [data-category="${category}"]`).classList.add('active');
    renderAdminMenu();
}


function filterAdminBySubcategory(category, subcategory) {
    adminCurrentCategory = category;
    adminCurrentFoodType = '';
    document.querySelectorAll('#adminMenuView .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#adminMenuView [data-category="${category}"][data-subcategory="${subcategory}"]`).classList.add('active');
    renderAdminMenu();
}

function renderAdminMenu() {
    let filteredItems = adminMenuItems;

    // Apply category filter
    if (adminCurrentCategory) {
        filteredItems = filteredItems.filter(item => item.category === adminCurrentCategory);
    }

// Get menu grid container
    const menuGrid = document.getElementById('adminMenuGrid');

    if (filteredItems.length === 0) {
        const filterText = adminCurrentCategory && adminCurrentFoodType
            ? `in ${adminCurrentCategory} category and ${adminCurrentFoodType} type`
            : adminCurrentCategory
                ? `in ${adminCurrentCategory} category`
                : adminCurrentFoodType
                    ? `of ${adminCurrentFoodType} type`
                    : 'in this category';
        menuGrid.innerHTML = `<p style="text-align: center; color: #666; grid-column: 1/-1;">No items found ${filterText}</p>`;
        return;
    }

    // Group by food type when no specific food type filter is active
    if (!adminCurrentFoodType) {
        renderAdminMenuGroupedByFoodType(filteredItems);
    } else {
        renderAdminMenuGrid(filteredItems);
    }
}

function renderAdminMenuGroupedByFoodType(items) {
    const menuGrid = document.getElementById('adminMenuGrid');
    
    // Group items by food type
    const groupedItems = {};
    items.forEach(item => {
        const foodType = item.foodType || 'other';
        if (!groupedItems[foodType]) {
            groupedItems[foodType] = [];
        }
        groupedItems[foodType].push(item);
    });

    // Sort food types alphabetically
    const sortedFoodTypes = Object.keys(groupedItems).sort();

    let html = '';
    
    sortedFoodTypes.forEach(foodType => {
        const foodTypeItems = groupedItems[foodType];
        
        // Add food type heading
        html += `
            <div style="grid-column: 1/-1; margin-top: 1.5rem; margin-bottom: 0.75rem;">
                <h3 style="font-weight: bold; font-size: 1rem; text-transform: uppercase; color: #333; border-bottom: 3px solid #ff6f00; padding-bottom: 0.5rem;">
                    ${foodType === 'other' ? 'Other Items' : foodType}
                </h3>
            </div>
        `;
        
        // Add items for this food type
        foodTypeItems.forEach(item => {
            const cartItem = adminCart.find(ci => ci.menuItemId === item.id);
            const quantity = cartItem ? cartItem.quantity : 0;
            const isUnavailable = item.available === false;

            html += `
                <div class="menu-item ${isUnavailable ? 'unavailable' : ''}">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}" class="menu-item-image">` : 
                      `<div class="menu-item-image" style="display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">🍽️</div>`}
                    <div class="menu-item-content">
                        <div class="menu-item-header">
                            <h3>${item.name}</h3>
                            <span class="menu-item-price">${formatCurrency(item.price || 0)}</span>
                        </div>
                        <p class="menu-item-description">${item.description || 'Delicious item from our kitchen'}</p>
                        <div class="menu-item-footer">
                            <span style="font-size: 0.85rem; color: #666; text-transform: capitalize;">${item.category || 'main'}</span>
                        ${isUnavailable ?
                            '<span style="color: #f44336; font-weight: 600;">Unavailable</span>' :
                            `<div class="quantity-controls">
                                <button class="quantity-btn" onclick="decreaseAdminQuantity('${item.id}')" ${quantity === 0 ? 'disabled' : ''}>-</button>
                                <span class="quantity-display">${quantity}</span>
                                <button class="quantity-btn" onclick="increaseAdminQuantity('${item.id}')">+</button>
                            </div>`
                        }
                    </div>
                    </div>
                </div>
            `;
        });
    });

    menuGrid.innerHTML = html;
}

function renderAdminMenuGrid(items) {
    const menuGrid = document.getElementById('adminMenuGrid');
    
    menuGrid.innerHTML = items.map(item => {
        const cartItem = adminCart.find(ci => ci.menuItemId === item.id);
        const quantity = cartItem ? cartItem.quantity : 0;
        const isUnavailable = item.available === false;

        return `
            <div class="menu-item ${isUnavailable ? 'unavailable' : ''}">
                ${item.image ? `<img src="${item.image}" alt="${item.name}" class="menu-item-image">` : 
                  `<div class="menu-item-image" style="display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">🍽️</div>`}
                <div class="menu-item-content">
                    <div class="menu-item-header">
                        <h3>${item.name}</h3>
                        <span class="menu-item-price">${formatCurrency(item.price || 0)}</span>
                    </div>
                    <p class="menu-item-description">${item.description || 'Delicious item from our kitchen'}</p>
                    <div class="menu-item-footer">
                        <span style="font-size: 0.4rem; color: #666; text-transform: capitalize;">${item.category || 'main'} ${item.foodType ? `• ${item.foodType}` : ''}</span>
                    ${isUnavailable ?
                        '<span style="color: #f44336; font-weight: 600;">Unavailable</span>' :
                        `<div class="quantity-controls">
                            <button class="quantity-btn" onclick="decreaseAdminQuantity('${item.id}')" ${quantity === 0 ? 'disabled' : ''}>-</button>
                            <span class="quantity-display">${quantity}</span>
                            <button class="quantity-btn" onclick="increaseAdminQuantity('${item.id}')">+</button>
                        </div>`
                    }
                </div>
                </div>
            </div>
        `;
    }).join('');
}

function increaseAdminQuantity(menuItemId) {
    const item = adminMenuItems.find(m => m.id === menuItemId);
    if (!item || item.available === false) return;

    // Check if item is spicy and ask for spicy level
    if (item.spicyLevel === 'ask') {
        pendingAdminSpicyItem = item;
        document.getElementById('adminSpicyItemName').textContent = item.name;
        document.getElementById('adminSpicyLevelModal').classList.add('active');
        return;
    }

    const cartItem = adminCart.find(ci => ci.menuItemId === menuItemId && ci.spicyLevel === null);

    if (cartItem) {
        cartItem.quantity++;
    } else {
        adminCart.push({
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            spicyLevel: null
        });
    }

    updateAdminCartCount();
    renderAdminMenu();
}

function decreaseAdminQuantity(menuItemId) {
    const cartItem = adminCart.find(ci => ci.menuItemId === menuItemId);
    if (!cartItem) return;
    
    cartItem.quantity--;
    
    if (cartItem.quantity <= 0) {
        adminCart = adminCart.filter(ci => ci.menuItemId !== menuItemId);
    }
    
    updateAdminCartCount();
    renderAdminMenu();
}

function updateAdminCartCount() {
    const totalItems = adminCart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('adminCartCount').textContent = totalItems;
}

function showAdminMenu() {
    document.getElementById('adminMenuView').style.display = 'block';
    document.getElementById('adminCartView').style.display = 'none';
}

function showAdminCart() {
    document.getElementById('adminMenuView').style.display = 'none';
    document.getElementById('adminCartView').style.display = 'block';
    renderAdminCart();
}

function renderAdminCart() {
    const cartContainer = document.getElementById('adminCartContainer');
    const cartSummary = document.getElementById('adminCartSummary');
    
    if (adminCart.length === 0) {
        cartContainer.innerHTML = '<p style="text-align: center; color: #666;">Your cart is empty</p>';
        cartSummary.style.display = 'none';
        return;
    }
    
    cartContainer.innerHTML = adminCart.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>${formatCurrency(item.price)} each</p>
            </div>
            <div class="cart-item-actions">
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="decreaseAdminCartQuantity(${index})">-</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button class="quantity-btn" onclick="increaseAdminCartQuantity(${index})">+</button>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                    <div class="cart-item-price">${formatCurrency(item.price * item.quantity)}</div>
                    <button class="btn btn-danger btn-small" onclick="removeAdminCartItem(${index})">Remove</button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Calculate totals
    const subtotal = adminCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal;
    
    document.getElementById('adminSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('adminTotal').textContent = formatCurrency(total);
    
    cartSummary.style.display = 'block';
}

function increaseAdminCartQuantity(index) {
    adminCart[index].quantity++;
    updateAdminCartCount();
    renderAdminCart();
}

function decreaseAdminCartQuantity(index) {
    adminCart[index].quantity--;
    if (adminCart[index].quantity <= 0) {
        adminCart.splice(index, 1);
    }
    updateAdminCartCount();
    renderAdminCart();
}

function removeAdminCartItem(index) {
    adminCart.splice(index, 1);
    updateAdminCartCount();
    renderAdminCart();
    showNotification('Item removed from cart', 'success');
}

// Generate 4-digit order number
function generateOrderNumber() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function adminCheckout() {
    if (adminCart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }

    try {
        // Check if we're adding to an existing order
        if (adminEditingOrderId) {
            // Add items to existing order
            const orderRef = firebase.firestore().collection('orders').doc(adminEditingOrderId);
            const orderDoc = await orderRef.get();
            const orderData = orderDoc.data();

            const existingItems = orderData.items || [];
            let updatedItems = [...existingItems];

            // Add new items to existing items
            adminCart.forEach(newItem => {
                const existingItemIndex = updatedItems.findIndex(item => item.menuItemId === newItem.menuItemId);

                if (existingItemIndex >= 0) {
                    // Update existing item quantity
                    updatedItems[existingItemIndex].quantity += newItem.quantity;
                } else {
                    // Add new item
                    updatedItems.push({
                        menuItemId: newItem.menuItemId,
                        name: newItem.name,
                        price: newItem.price,
                        quantity: newItem.quantity
                    });
                }
            });

            // Recalculate totals
            const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.1;
            const total = subtotal + tax;

            // Update order with new items and totals
            await orderRef.update({
                items: updatedItems,
            subtotal,
            total,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Clear cart and reset editing state
            adminCart = [];
            updateAdminCartCount();
            adminEditingOrderId = null;

            showNotification('Items added to order successfully!', 'success');

            // Switch back to orders section and refresh
            document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));

            const ordersSection = document.querySelector('[data-section="orders"]');
            ordersSection.classList.add('active');
            document.getElementById('orders').classList.add('active');

            loadOrders();

        } else {
            // Create new order (existing logic)
            const tableNumber = document.getElementById('adminTableNumber').value;
            if (!tableNumber || tableNumber < 1) {
                showNotification('Please enter a valid table number', 'error');
                return;
            }

        const subtotal = adminCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal;
        const orderNumber = generateOrderNumber();
            const notes = document.getElementById('adminOrderNotes').value || '';

            const orderData = {
                orderNumber: orderNumber,
                tableNumber: parseInt(tableNumber),
                customerName: 'Staff Order',
                items: adminCart.map(item => ({
                    menuItemId: item.menuItemId,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    spicyLevel: item.spicyLevel || null
                })),
                notes: notes,
                subtotal,
                total,
                status: 'completed', // Auto-completed for admin orders
                paymentStatus: 'confirmed', // Auto-confirmed for admin orders
                confirmedBy: currentAdminName,
                paymentConfirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await firebase.firestore().collection('orders').add(orderData);

            // Clear cart
            adminCart = [];
            updateAdminCartCount();
            document.getElementById('adminTableNumber').value = '';
            document.getElementById('adminOrderNotes').value = '';

            showNotification(`Order #${orderNumber} placed and confirmed successfully!`, 'success');
            showAdminMenu();

            // Reload orders if on orders section
            if (document.getElementById('orders').classList.contains('active')) {
                loadOrders();
            }
        }
    } catch (error) {
        console.error('Error processing order:', error);
        showNotification('Error processing order. Please try again.', 'error');
    }
}

// Order Search Functions for Admin
function adminHandleOrderSearch2(event) {
    if (event.key === 'Enter') {
        adminSearchOrder2();
    }
}

async function adminSearchOrder2() {
    const orderNumber = document.getElementById('adminOrderSearchInput2').value.trim();

    if (!orderNumber) {
        showNotification('Please enter an order number', 'error');
        return;
    }

    try {
        const ordersSnapshot = await firebase.firestore()
            .collection('orders')
            .where('orderNumber', '==', orderNumber)
            .get();

        if (ordersSnapshot.empty) {
            showNotification('Order not found', 'error');
            document.getElementById('adminOrderSearchResults2').style.display = 'none';
            return;
        }

        const orderDoc = ordersSnapshot.docs[0];
        adminSearchedOrder = { id: orderDoc.id, ...orderDoc.data() };

        adminDisplayOrderDetails2(adminSearchedOrder);
        document.getElementById('adminOrderSearchResults2').style.display = 'block';
        document.getElementById('adminOrdersContainer').style.display = 'none';

    } catch (error) {
        console.error('Error searching order:', error);
        showNotification('Error searching order', 'error');
    }
}

function adminClearOrderSearch2() {
    document.getElementById('adminOrderSearchInput2').value = '';
    document.getElementById('adminOrderSearchResults2').style.display = 'none';
    document.getElementById('adminOrdersContainer').style.display = 'grid';
    adminSearchedOrder = null;
    adminLoadOrders();
}

async function adminOpenOrderDetails(orderId) {
    try {
        const orderDoc = await firebase.firestore().collection('orders').doc(orderId).get();

        if (!orderDoc.exists) {
            showNotification('Order not found', 'error');
            return;
        }

        adminSearchedOrder = { id: orderDoc.id, ...orderDoc.data() };

        adminDisplayOrderDetails2(adminSearchedOrder);
        document.getElementById('adminOrderSearchResults2').style.display = 'block';
        document.getElementById('adminOrdersContainer').style.display = 'none';

    } catch (error) {
        console.error('Error opening order details:', error);
        showNotification('Error opening order details', 'error');
    }
}

function adminDisplayOrderDetails2(order) {
    const content = document.getElementById('adminOrderDetailsContent2');

    const orderDate = order.createdAt ? formatDate(order.createdAt) : 'N/A';
    const paymentStatus = order.paymentStatus || 'pending';
    const status = order.status || 'pending';
    const tableNumber = order.tableNumber || 'N/A';
    const customerName = order.customerName || 'Guest';
    const notes = order.notes || 'None';
    const confirmedBy = order.confirmedBy || 'Not confirmed';
    const discountAmount = order.discountAmount || 0;
    const discountType = order.discountType || 'fixed';

    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
        itemsHtml = order.items.map((item, index) => `
            <tr>
                <td>${item.name}</td>
                <td>
                    <div class="quantity-controls" style="display: flex; align-items: center; gap: 0.5rem;">
                        <button class="quantity-btn" onclick="adminDecreaseOrderItemQuantity('${order.id}', '${item.name}', ${item.quantity})" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-btn" onclick="adminIncreaseOrderItemQuantity('${order.id}', '${item.name}', ${item.quantity})">+</button>
                    </div>
                </td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.price * item.quantity)}</td>
                <td>
                    <button class="btn btn-small btn-danger" onclick="adminRemoveOrderItem('${order.id}', '${item.name}')">
                        Remove
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Calculate totals with discount
    const subtotal = order.subtotal || 0;
    const tax = order.tax || 0;
    const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
    const total = Math.max(0, subtotal + tax - discountValue);

    content.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <strong>Order Number:</strong>
                    <p style="font-size: 1.5rem; color: #ff6f00; margin-top: 0.5rem;">#${order.orderNumber}</p>
                </div>
                <div>
                    <strong>Table Number:</strong>
                    <p style="font-size: 1.2rem; margin-top: 0.5rem;">${tableNumber}</p>
                </div>
                <div>
                    <strong>Customer:</strong>
                    <p style="margin-top: 0.5rem;">${customerName}</p>
                </div>
                <div>
                    <strong>Status:</strong>
                    <p style="margin-top: 0.5rem;">
                        <span class="status-badge status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </p>
                </div>
                <div>
                    <strong>Payment Status:</strong>
                    <p style="margin-top: 0.5rem;">
                        <span class="status-badge ${paymentStatus === 'confirmed' ? 'status-completed' : 'status-pending'}">
                            ${paymentStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </span>
                    </p>
                </div>
                <div>
                    <strong>Payment Method:</strong>
                    <p style="margin-top: 0.5rem;">
                        <select id="adminPaymentMethodSelect_${order.id}" onchange="adminUpdatePaymentMethod('${order.id}', this.value)" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="" ${!order.paymentMethod ? 'selected' : ''}>Not Selected</option>
                            <option value="cash" ${order.paymentMethod === 'cash' ? 'selected' : ''}>Cash</option>
                            <option value="card" ${order.paymentMethod === 'card' ? 'selected' : ''}>Card</option>
                            <option value="online" ${order.paymentMethod === 'online' ? 'selected' : ''}>Online</option>
                        </select>
                    </p>
                </div>
                <div>
                    <strong>Date:</strong>
                    <p style="margin-top: 0.5rem;">${orderDate}</p>
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <strong>Special Instructions:</strong>
                <p style="margin-top: 0.5rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">${notes}</p>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <strong>Discount:</strong>
                <div style="display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <select id="adminDiscountType_${order.id}" onchange="adminUpdateDiscountType('${order.id}', this.value)" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="fixed" ${discountType === 'fixed' ? 'selected' : ''}>Fixed Amount</option>
                            <option value="percentage" ${discountType === 'percentage' ? 'selected' : ''}>Percentage</option>
                        </select>
                        <input type="number" id="adminDiscountAmount_${order.id}" value="${discountAmount}" min="0" step="0.01"
                               onchange="adminUpdateDiscount('${order.id}', this.value)" placeholder="0"
                               style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; width: 100px;">
                        <span>${discountType === 'percentage' ? '%' : '$'}</span>
                    </div>
                    ${discountValue > 0 ? `<span style="color: #4caf50; font-weight: 600;">Discount: -${formatCurrency(discountValue)}</span>` : ''}
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <strong>Order Items:</strong>
                <table class="table" style="margin-top: 1rem;">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="adminAddItemToOrder('${order.id}')">
                        ➕ Add New Item
                    </button>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; padding: 1rem; background: #f5f5f5; border-radius: 8px; margin-bottom: 1.5rem;">
                <div>
                    <p><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
                    <p><strong>Tax (10%):</strong> ${formatCurrency(tax)}</p>
                    ${discountValue > 0 ? `<p><strong>Discount:</strong> -${formatCurrency(discountValue)}</p>` : ''}
                    <p style="font-size: 1.25rem; margin-top: 0.5rem;"><strong>Total:</strong> ${formatCurrency(total)}</p>
                </div>
            </div>

            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="adminVerifyPayment('${order.id}')"
                        ${paymentStatus === 'confirmed' ? 'disabled' : ''}>
                    ${paymentStatus === 'confirmed' ? '✓ Payment Verified' : 'Verify Payment & Print Bill'}
                </button>
                <button class="btn btn-secondary" onclick="adminOpenEditOrderModal('${order.id}')">
                    Edit Order Details
                </button>
                
                <button class="btn btn-danger" onclick="adminDeleteOrder('${order.id}')">
                    🗑️ Delete Order
                </button>
            </div>

            ${paymentStatus === 'confirmed' ? `
                <div style="margin-top: 1rem; padding: 1rem; background: #e8f5e9; border-radius: 8px;">
                    <p><strong>Confirmed by:</strong> ${confirmedBy}</p>
                    <p><strong>Confirmed at:</strong> ${order.paymentConfirmedAt ? formatDate(order.paymentConfirmedAt) : 'N/A'}</p>
                    <button class="btn btn-success" onclick="adminPrintBill('${order.id}')" style="margin-top: 1rem;">
                        🖨️ Print Bill
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

async function adminVerifyPayment(orderId) {
    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();
        
        if (orderData.paymentStatus === 'confirmed') {
            showNotification('Payment already verified', 'info');
            return;
        }
        
        // Update payment status
        await orderRef.update({
            paymentStatus: 'confirmed',
            status: 'completed',
            confirmedBy: currentAdminName,
            paymentConfirmedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Generate and print bill
        await adminPrintBill(orderData);
        
        showNotification('Payment verified and bill printed!', 'success');
        
        // Refresh order details
        if (adminSearchedOrder && adminSearchedOrder.id === orderId) {
            adminSearchedOrder.paymentStatus = 'confirmed';
            adminSearchedOrder.status = 'completed';
            adminSearchedOrder.confirmedBy = currentAdminName;
            adminDisplayOrderDetails(adminSearchedOrder);
        }
        
        // Reload orders
        loadOrders();
        
    } catch (error) {
        console.error('Error verifying payment:', error);
        showNotification('Error verifying payment', 'error');
    }
}

async function adminPrintBill(orderOrId) {
    let order;

    // If orderOrId is a string, it's an order ID - fetch the order data
    if (typeof orderOrId === 'string') {
        try {
            const orderDoc = await firebase.firestore().collection('orders').doc(orderOrId).get();
            if (!orderDoc.exists) {
                showNotification('Order not found', 'error');
                return;
            }
            order = { id: orderDoc.id, ...orderDoc.data() };
        } catch (error) {
            console.error('Error fetching order:', error);
            showNotification('Error loading order data', 'error');
            return;
        }
    } else {
        order = orderOrId;
    }

    // Create a printable bill (same as employee version)
    const billWindow = window.open('', '_blank');
    const orderDate = order.createdAt ? formatDate(order.createdAt) : new Date().toLocaleString();
    const tableNumber = order.tableNumber || 'N/A';
    const customerName = order.customerName || 'Guest';

    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
        itemsHtml = order.items.map(item => `
            <tr>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">${formatCurrency(item.price)}</td>
                <td style="text-align: right;">${formatCurrency(item.price * item.quantity)}</td>
            </tr>
        `).join('');
    }

    billWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bill - Order #${order.orderNumber}</title>
            <style>
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body { margin: 0; padding: 10mm; }
                }
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    width: 60mm;
                    margin: 0 auto;
                    padding: 10mm;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px dashed #000;
                    padding-bottom: 10px;
                    margin-bottom: 10px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 18px;
                }
                .info {
                    margin: 10px 0;
                    line-height: 1.6;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                }
                th, td {
                    padding: 5px;
                    text-align: left;
                    border-bottom: 1px dashed #ccc;
                }
                th {
                    font-weight: bold;
                    border-bottom: 2px dashed #000;
                }
                .total {
                    border-top: 2px dashed #000;
                    margin-top: 10px;
                    padding-top: 10px;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    padding-top: 10px;
                    border-top: 2px dashed #000;
                    font-size: 10px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Ramesh DaDa Restaurant</h1>
                <p>Restaurant Bill</p>
            </div>

            <div class="info">
                <p><strong style="font-size: 16px;">Order #${order.orderNumber}</strong></p>
                <p><strong>Table:</strong> <strong>${tableNumber}</strong></p>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Date:</strong> ${orderDate}</p>
                ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Price</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="total">
                <p style="text-align: right; margin: 5px 0;"><strong>Subtotal:</strong> ${formatCurrency(order.subtotal || 0)}</p>
                <p style="text-align: right; margin: 5px 0;"><strong>Tax (10%):</strong> ${formatCurrency(order.tax || 0)}</p>
                <p style="text-align: right; margin: 5px 0; font-size: 16px;"><strong>TOTAL:</strong> ${formatCurrency(order.total || 0)}</p>
            </div>

            <div class="footer">
                <p>Thank you for dining with us!</p>
                <p>Payment Status: CONFIRMED</p>
                <p>Confirmed by: ${currentAdminName || 'Admin'}</p>
            </div>
        </body>
        </html>
    `);

    billWindow.document.close();

    // Wait for content to load, then print
    setTimeout(() => {
        billWindow.print();
        billWindow.close();
    }, 250);
}

function adminEditOrderItem(orderId, itemName, currentQuantity, itemPrice) {
    const newQuantity = prompt(`Edit quantity for "${itemName}" (current: ${currentQuantity}):`, currentQuantity);
    
    if (newQuantity === null) return;
    
    const quantity = parseInt(newQuantity);
    if (isNaN(quantity) || quantity < 0) {
        showNotification('Invalid quantity', 'error');
        return;
    }
    
    adminUpdateOrderItem(orderId, itemName, quantity, itemPrice);
}

async function adminUpdateOrderItem(orderId, itemName, newQuantity, itemPrice) {
    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();
        
        // Update item quantity
        const items = orderData.items.map(item => {
            if (item.name === itemName) {
                return { ...item, quantity: newQuantity };
            }
            return item;
        });
        
        // Remove item if quantity is 0
        const filteredItems = items.filter(item => item.quantity > 0);
        
        // Recalculate totals
        const subtotal = filteredItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.1;
        const total = subtotal + tax;
        
        await orderRef.update({
            items: filteredItems,
            subtotal,
            tax,
            total
        });
        
        showNotification('Order item updated', 'success');
        
        // Refresh order details
        if (adminSearchedOrder && adminSearchedOrder.id === orderId) {
            adminSearchedOrder.items = filteredItems;
            adminSearchedOrder.subtotal = subtotal;
            adminSearchedOrder.total = total;
            adminDisplayOrderDetails(adminSearchedOrder);
        }
        
        loadOrders();
        
    } catch (error) {
        console.error('Error updating order item:', error);
        showNotification('Error updating order item', 'error');
    }
}

let adminEditingOrderId = null; // Store the order ID being edited
let pendingAdminSpicyItem = null;

async function adminAddItemToOrder(orderId) {
    try {
        // Store the order ID for later use
        adminEditingOrderId = orderId;

        // Get order data to pre-fill information
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();

        // Switch to customer order section
        document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));

        const customerOrderSection = document.querySelector('[data-section="customer-order"]');
        customerOrderSection.classList.add('active');
        document.getElementById('customer-order').classList.add('active');

        // Load customer menu and show it
        loadAdminMenu();
        adminShowOrdersView(); // This will show the menu view

        // Pre-fill table number if available
        if (orderData.tableNumber) {
            document.getElementById('adminTableNumber').value = orderData.tableNumber;
        }

        // Pre-fill notes if available
        if (orderData.notes) {
            document.getElementById('adminOrderNotes').value = orderData.notes;
        }

        showNotification('Select items to add to the existing order', 'info');

    } catch (error) {
        console.error('Error opening add item interface:', error);
        showNotification('Error opening add item interface', 'error');
    }
}

async function adminOpenEditOrderModal(orderId) {
    const orderRef = firebase.firestore().collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    const orderData = orderDoc.data();
    
    const newTableNumber = prompt(`Edit table number (current: ${orderData.tableNumber || 'N/A'}):`, orderData.tableNumber || '');
    if (newTableNumber === null) return;
    
    const newNotes = prompt(`Edit special instructions (current: ${orderData.notes || 'None'}):`, orderData.notes || '');
    if (newNotes === null) return;
    
    try {
        await orderRef.update({
            tableNumber: parseInt(newTableNumber) || orderData.tableNumber,
            notes: newNotes
        });
        
        showNotification('Order updated', 'success');
        
        // Refresh order details
        if (adminSearchedOrder && adminSearchedOrder.id === orderId) {
            adminSearchedOrder.tableNumber = parseInt(newTableNumber) || orderData.tableNumber;
            adminSearchedOrder.notes = newNotes;
            adminDisplayOrderDetails2(adminSearchedOrder);
        }
        
        loadOrders();
        
    } catch (error) {
        console.error('Error updating order:', error);
        showNotification('Error updating order', 'error');
    }
}

async function adminUpdateOrderStatus(orderId, newStatus) {
    try {
        await firebase.firestore().collection('orders').doc(orderId).update({
            status: newStatus
        });

        showNotification('Order status updated', 'success');

        // Refresh order details
        if (adminSearchedOrder && adminSearchedOrder.id === orderId) {
            adminSearchedOrder.status = newStatus;
            adminDisplayOrderDetails(adminSearchedOrder);
        }

        loadOrders();

    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Error updating order status', 'error');
    }
}

async function adminUpdatePaymentStatus(orderId, paymentStatus) {
    try {
        const updateData = {
            paymentStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // If payment is confirmed, mark order as completed and record who confirmed it
        if (paymentStatus === 'confirmed') {
            updateData.status = 'completed';
            updateData.confirmedBy = currentAdminName;
            updateData.paymentConfirmedAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        await firebase.firestore().collection('orders').doc(orderId).update(updateData);
        showNotification('Payment status updated successfully', 'success');

        // Reload orders to show updated status
        setTimeout(() => {
            loadOrders();
        }, 500);
    } catch (error) {
        console.error('Error updating payment status:', error);
        showNotification('Error updating payment status', 'error');
    }
}

async function adminUpdatePaymentMethod(orderId, paymentMethod) {
    try {
        await firebase.firestore().collection('orders').doc(orderId).update({
            paymentMethod: paymentMethod || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification('Payment method updated successfully', 'success');
    } catch (error) {
        console.error('Error updating payment method:', error);
        showNotification('Error updating payment method', 'error');
    }
}

async function adminRecordPayment(orderId, paymentMethod) {
    try {
        const updateData = {
            paymentMethod,
            paymentStatus: 'confirmed',
            status: 'completed',
            confirmedBy: currentAdminName,
            paymentConfirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await firebase.firestore().collection('orders').doc(orderId).update(updateData);
        showNotification(`Payment recorded as ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}`, 'success');

        // Reload orders to show updated status
        setTimeout(() => {
            loadOrders();
        }, 500);
    } catch (error) {
        console.error('Error recording payment:', error);
        showNotification('Error recording payment', 'error');
    }
}

// Admin Spicy Level Functions
function selectAdminSpicyLevel(level) {
    if (!pendingAdminSpicyItem) return;

    const displayLevel = level === 'normal' ? 'Normal' : level === 'medium' ? 'Medium' : 'Extra Spicy';
    const itemName = level === 'no spicy' ? pendingAdminSpicyItem.name : pendingAdminSpicyItem.name + ' - ' + displayLevel;
    const spicyLvl = level === 'no spicy' ? null : level;

    const cartItem = adminCart.find(ci => ci.menuItemId === pendingAdminSpicyItem.id && ci.spicyLevel === spicyLvl);

    if (cartItem) {
        cartItem.quantity++;
    } else {
        adminCart.push({
            menuItemId: pendingAdminSpicyItem.id,
            name: itemName,
            price: pendingAdminSpicyItem.price,
            quantity: 1,
            spicyLevel: spicyLvl
        });
    }

    updateAdminCartCount();
    renderAdminMenu();
    showNotification('Item added to cart', 'success');

    closeAdminSpicyLevelModal();
}

function closeAdminSpicyLevelModal() {
    document.getElementById('adminSpicyLevelModal').classList.remove('active');
    pendingAdminSpicyItem = null;
}

// CSV Export Function
async function exportOrdersToCSV() {
    const fromDate = document.getElementById('exportFromDate').value;
    const toDate = document.getElementById('exportToDate').value;

    if (!fromDate || !toDate) {
        showNotification('Please select both from and to dates', 'error');
        return;
    }

    const fromTimestamp = new Date(fromDate + 'T00:00:00');
    const toTimestamp = new Date(toDate + 'T23:59:59');

    if (fromTimestamp > toTimestamp) {
        showNotification('From date cannot be after to date', 'error');
        return;
    }

    try {
        showNotification('Exporting orders... Please wait.', 'info');

        // Query orders within date range
        const ordersSnapshot = await firebase.firestore()
            .collection('orders')
            .where('createdAt', '>=', fromTimestamp)
            .where('createdAt', '<=', toTimestamp)
            .orderBy('createdAt', 'desc')
            .get();

        if (ordersSnapshot.empty) {
            showNotification('No orders found in the selected date range', 'warning');
            return;
        }

        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Prepare CSV data
        const csvHeaders = [
            'Order Number',
            'Date',
            'Time',
            'Customer Name',
            'Table Number',
            'Items',
            'Subtotal',
            'Tax',
            'Discount',
            'Total',
            'Status',
            'Payment Status',
            'Payment Method',
            'Confirmed By',
        ];

        const csvRows = orders.map(order => {
            const orderDate = order.createdAt ? order.createdAt.toDate() : new Date();
            const dateStr = orderDate.toLocaleDateString();
            const timeStr = orderDate.toLocaleTimeString();

            // Format items
            const itemsList = order.items ? order.items.map(item => item.name).join('; ') : '';
            const itemDetails = order.items ? order.items.map(item =>
                `${item.name} (${item.quantity}x ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)})`
            ).join('; ') : '';

            return [
                order.orderNumber || order.id.substring(0, 8),
                dateStr,
                timeStr,
                order.customerName || 'Guest',
                order.tableNumber || 'N/A',
                itemsList,
                formatCurrency(order.subtotal || 0),
                formatCurrency(order.tax || 0),
                formatCurrency((order.discountType === 'percentage' ?
                    (order.subtotal || 0) * (order.discountAmount || 0) / 100 :
                    (order.discountAmount || 0))),
                formatCurrency(order.total || 0),
                order.status || 'pending',
                order.paymentStatus || 'pending',
                order.paymentMethod || 'N/A',
                order.confirmedBy || 'N/A',
            ];
        });

        // Create CSV content
        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `orders_${fromDate}_to_${toDate}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        showNotification(`Successfully exported ${orders.length} orders to CSV`, 'success');

    } catch (error) {
        console.error('Error exporting orders:', error);
        showNotification('Error exporting orders. Please try again.', 'error');
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateOrderNumber };
}
