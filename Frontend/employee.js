let currentFilter = '';
let ordersUnsubscribe = null;
let currentEmployeeName = '';
let availableCategories = [];

let categoriesUnsubscribe = null;

function loadCategories() {
    return new Promise((resolve, reject) => {
        try {
            let resolved = false;
            categoriesUnsubscribe = firebase.firestore().collection('categories').orderBy('name').onSnapshot(snapshot => {
                availableCategories = snapshot.docs.map(doc => doc.data().name);
                updateEmployeeCategoryFilters();
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            }, error => {
                console.error('Error loading categories:', error);
                showNotification && showNotification('Error loading categories', 'error');
                if (!resolved) {
                    resolved = true;
                    reject(error);
                }
            });

            window.addEventListener('beforeunload', () => {
                if (categoriesUnsubscribe) categoriesUnsubscribe();
            });
        } catch (err) {
            console.error('Error initiating categories listener:', err);
            reject(err);
        }
    });
}

// Check authentication and role - Wait for Firebase to be ready
if (typeof firebase !== 'undefined' && firebase.auth) {
    let redirectInProgress = false;
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user && !redirectInProgress) {
            redirectInProgress = true;
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            } else {
                redirectInProgress = false;
            }
            return;
        }

        if (user && !redirectInProgress) {
            redirectInProgress = true;
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            const role = userData?.role || 'staff';

            if (!['staff', 'manager', 'admin'].includes(role)) {
                if (!window.location.pathname.includes('index.html')) {
                    window.location.href = 'index.html';
                } else {
                    redirectInProgress = false;
                }
                return;
            }

            currentEmployeeName = userData?.name || user.email;
            document.getElementById('employeeName').textContent = `Welcome, ${currentEmployeeName}!`;
            await loadCategories();
            initializeDashboard();
            redirectInProgress = false; 
        }
    });
} else {
    console.error('Firebase SDK not loaded');
}

function initializeDashboard() {
    loadOrders();
    
    // Set up real-time updates
    subscribeToOrders();
    
    // Show orders view by default
    document.getElementById('ordersView').style.display = 'block';
    document.getElementById('orderFilters').style.display = 'flex';
    document.getElementById('customerOrderView').style.display = 'none';
}

function subscribeToOrders() {
    let query = firebase.firestore().collection('orders');
    
    if (currentFilter) {
        query = query.where('status', '==', currentFilter);
    }
    
    ordersUnsubscribe = query.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const orders = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data };
        });
        
        displayOrders(orders);
    }, error => {
        console.error('Error loading orders:', error);
        showNotification('Error loading orders', 'error');
    });
}

async function loadOrders() {
    try {
        let query = firebase.firestore().collection('orders');
        
        if (currentFilter) {
            query = query.where('status', '==', currentFilter);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        const orders = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data };
        });
        
        displayOrders(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Error loading orders', 'error');
    }
}

async function displayOrders(orders) {
    const container = document.getElementById('ordersContainer');
    
    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">No orders found</p>';
        return;
    }
    
    // Get menu items for display
    const menuSnapshot = await firebase.firestore().collection('menu').get();
    const menuItems = {};
    menuSnapshot.docs.forEach(doc => {
        menuItems[doc.id] = doc.data();
    });
    
    container.innerHTML = orders.map(order => {
        return `
            <div class="order-card ${order.status}" onclick="openOrderDetails('${order.id}')" style="cursor: pointer;">
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
                        <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)" value="${order.status}" style="width: 100%;">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                            <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; color: #666; font-weight: 600;">Payment Status:</label>
                        <select class="status-select" onchange="updatePaymentStatus('${order.id}', this.value)" value="${order.paymentStatus || 'pending'}" style="width: 100%;">
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

async function updateOrderStatus(orderId, status) {
    try {
        await firebase.firestore().collection('orders').doc(orderId).update({
            status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification('Order status updated successfully', 'success');
    } catch (error) {
        showNotification('Error updating order status', 'error');
    }
}

async function updatePaymentStatus(orderId, paymentStatus) {
    try {
        const updateData = {
            paymentStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // If payment is confirmed, mark order as completed and record who confirmed it
        if (paymentStatus === 'confirmed') {
            updateData.status = 'completed';
            updateData.confirmedBy = currentEmployeeName;
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

async function updatePaymentMethod(orderId, paymentMethod) {
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

// Customer Order Functions for Employee
let employeeCart = [];
let employeeMenuItems = [];
let employeeCurrentCategory = '';
let employeeCurrentFoodType = '';
let pendingEmployeeSpicyItem = null;

function toggleEmployeeView() {
    const ordersView = document.getElementById('ordersView');
    const customerOrderView = document.getElementById('customerOrderView');
    const orderFilters = document.getElementById('orderFilters');
    const toggleBtn = document.getElementById('toggleViewBtn');

    if (ordersView.style.display === 'none') {
        // Show orders view
        ordersView.style.display = 'block';
        orderFilters.style.display = 'flex';
        customerOrderView.style.display = 'none';
        toggleBtn.textContent = '🛒 Customer Order';
        loadOrders();
    } else {
        // Show customer order view
        ordersView.style.display = 'none';
        orderFilters.style.display = 'none';
        customerOrderView.style.display = 'block';
        toggleBtn.textContent = '📋 View Orders';
        updateEmployeeCategoryFilters();
        loadEmployeeMenu();
        showEmployeeMenu();
    }
}

function updateEmployeeCategoryFilters() {
    const container = document.getElementById('employeeCategoryFilters');
    if (!container) return;

    // Clear existing filters
    container.innerHTML = '';

    // 'All' button
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.dataset.category = '';
    allBtn.textContent = 'All Categories';
    allBtn.addEventListener('click', () => filterEmployeeMenu(''));
    container.appendChild(allBtn);

    // Create a button for each category using DOM methods to avoid HTML injection
    availableCategories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.category = category;
        btn.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        btn.addEventListener('click', () => filterEmployeeMenu(category));
        container.appendChild(btn);
    });
} 

function showEmployeeOrders() {
    toggleEmployeeView();
}

async function loadEmployeeMenu() {
    try {
        const snapshot = await firebase.firestore().collection('menu').get();
        employeeMenuItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderEmployeeMenu();
    } catch (error) {
        console.error('Error loading menu:', error);
        showNotification('Error loading menu', 'error');
    }
}

function filterEmployeeMenu(category) {
    employeeCurrentCategory = category;
    employeeCurrentFoodType = '';
    document.querySelectorAll('#employeeMenuView .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#employeeMenuView [data-category="${category}"]`).classList.add('active');
    renderEmployeeMenu();
}

function filterEmployeeByFoodType(foodType) {
    employeeCurrentFoodType = foodType;
    employeeCurrentCategory = '';
    document.querySelectorAll('#employeeMenuView .filter-btn[data-food-type]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#employeeMenuView [data-food-type="${foodType}"]`).classList.add('active');
    renderEmployeeMenu();
}

function filterEmployeeBySubcategory(category, subcategory) {
    employeeCurrentCategory = category;
    employeeCurrentFoodType = '';
    document.querySelectorAll('#employeeMenuView .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#employeeMenuView [data-category="${category}"][data-subcategory="${subcategory}"]`).classList.add('active');
    renderEmployeeMenu();
}

function renderEmployeeMenu() {
    let filteredItems = employeeMenuItems;

    // Apply category filter
    if (employeeCurrentCategory) {
        filteredItems = filteredItems.filter(item => item.category === employeeCurrentCategory);
    }

    // Apply food type filter
    if (employeeCurrentFoodType) {
        filteredItems = filteredItems.filter(item => item.foodType === employeeCurrentFoodType);
    }

    const menuGrid = document.getElementById('employeeMenuGrid');

    if (filteredItems.length === 0) {
        const filterText = employeeCurrentCategory && employeeCurrentFoodType
            ? `in ${employeeCurrentCategory} category and ${employeeCurrentFoodType} type`
            : employeeCurrentCategory
                ? `in ${employeeCurrentCategory} category`
                : employeeCurrentFoodType
                    ? `of ${employeeCurrentFoodType} type`
                    : 'in this category';
        menuGrid.innerHTML = `<p style="text-align: center; color: #666; grid-column: 1/-1;">No items found ${filterText}</p>`;
        return;
    }

    // Group by food type when no specific food type filter is active
    if (!employeeCurrentFoodType) {
        renderEmployeeMenuGroupedByFoodType(filteredItems);
    } else {
        renderEmployeeMenuGrid(filteredItems);
    }
}

function renderEmployeeMenuGroupedByFoodType(items) {
    const menuGrid = document.getElementById('employeeMenuGrid');
    
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
            <div style="grid-column: 1/-1; margin-top: 2rem; margin-bottom: 1rem;">
                <h3 style="font-weight: bold; font-size: 1.5rem; text-transform: uppercase; color: #333; border-bottom: 3px solid #ff6f00; padding-bottom: 0.5rem;">
                    ${foodType === 'other' ? 'Other Items' : foodType}
                </h3>
            </div>
        `;
        
        // Add items for this food type
        foodTypeItems.forEach(item => {
            const cartItem = employeeCart.find(ci => ci.menuItemId === item.id);
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
                                <button class="quantity-btn" onclick="decreaseEmployeeQuantity('${item.id}')" ${quantity === 0 ? 'disabled' : ''}>-</button>
                                <span class="quantity-display">${quantity}</span>
                                <button class="quantity-btn" onclick="increaseEmployeeQuantity('${item.id}')">+</button>
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

function renderEmployeeMenuGrid(items) {
    const menuGrid = document.getElementById('employeeMenuGrid');
    
    menuGrid.innerHTML = items.map(item => {
        const cartItem = employeeCart.find(ci => ci.menuItemId === item.id);
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
                        <span style="font-size: 0.85rem; color: #666; text-transform: capitalize;">${item.category || 'main'} ${item.foodType ? `• ${item.foodType}` : ''}</span>
                        ${isUnavailable ?
                            '<span style="color: #f44336; font-weight: 600;">Unavailable</span>' :
                            `<div class="quantity-controls">
                                <button class="quantity-btn" onclick="decreaseEmployeeQuantity('${item.id}')" ${quantity === 0 ? 'disabled' : ''}>-</button>
                                <span class="quantity-display">${quantity}</span>
                                <button class="quantity-btn" onclick="increaseEmployeeQuantity('${item.id}')">+</button>
                            </div>`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function increaseEmployeeQuantity(menuItemId) {
    const item = employeeMenuItems.find(m => m.id === menuItemId);
    if (!item || item.available === false) return;

    // Check if item is spicy and ask for spicy level
    if (item.spicyLevel === 'ask') {
        pendingEmployeeSpicyItem = item;
        document.getElementById('employeeSpicyItemName').textContent = item.name;
        document.getElementById('employeeSpicyLevelModal').classList.add('active');
        return;
    }

    const cartItem = employeeCart.find(ci => ci.menuItemId === menuItemId && ci.spicyLevel === null);

    if (cartItem) {
        cartItem.quantity++;
    } else {
        employeeCart.push({
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            spicyLevel: null
        });
    }

    updateEmployeeCartCount();
    renderEmployeeMenu();
}

function decreaseEmployeeQuantity(menuItemId) {
    const cartItem = employeeCart.find(ci => ci.menuItemId === menuItemId);
    if (!cartItem) return;
    
    cartItem.quantity--;
    
    if (cartItem.quantity <= 0) {
        employeeCart = employeeCart.filter(ci => ci.menuItemId !== menuItemId);
    }
    
    updateEmployeeCartCount();
    renderEmployeeMenu();
}

function updateEmployeeCartCount() {
    const totalItems = employeeCart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('employeeCartCount').textContent = totalItems;
}

function showEmployeeMenu() {
    document.getElementById('employeeMenuView').style.display = 'block';
    document.getElementById('employeeCartView').style.display = 'none';
}

function showEmployeeCart() {
    document.getElementById('employeeMenuView').style.display = 'none';
    document.getElementById('employeeCartView').style.display = 'block';
    renderEmployeeCart();
}

function renderEmployeeCart() {
    const cartContainer = document.getElementById('employeeCartContainer');
    const cartSummary = document.getElementById('employeeCartSummary');
    
    if (employeeCart.length === 0) {
        cartContainer.innerHTML = '<p style="text-align: center; color: #666;">Your cart is empty</p>';
        cartSummary.style.display = 'none';
        return;
    }
    
    cartContainer.innerHTML = employeeCart.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>${formatCurrency(item.price)} each</p>
            </div>
            <div class="cart-item-actions">
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="decreaseEmployeeCartQuantity(${index})">-</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button class="quantity-btn" onclick="increaseEmployeeCartQuantity(${index})">+</button>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                    <div class="cart-item-price">${formatCurrency(item.price * item.quantity)}</div>
                    <button class="btn btn-danger btn-small" onclick="removeEmployeeCartItem(${index})">Remove</button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Calculate totals
    const subtotal = employeeCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal;
    
    document.getElementById('employeeSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('employeeTotal').textContent = formatCurrency(total);
    
    cartSummary.style.display = 'block';
}

function increaseEmployeeCartQuantity(index) {
    employeeCart[index].quantity++;
    updateEmployeeCartCount();
    renderEmployeeCart();
}

function decreaseEmployeeCartQuantity(index) {
    employeeCart[index].quantity--;
    if (employeeCart[index].quantity <= 0) {
        employeeCart.splice(index, 1);
    }
    updateEmployeeCartCount();
    renderEmployeeCart();
}

function removeEmployeeCartItem(index) {
    employeeCart.splice(index, 1);
    updateEmployeeCartCount();
    renderEmployeeCart();
    showNotification('Item removed from cart', 'success');
}

async function employeeCheckout() {
    if (employeeCart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }
    
    const tableNumber = document.getElementById('employeeTableNumber').value;
    if (!tableNumber || tableNumber < 1) {
        showNotification('Please enter a valid table number', 'error');
        return;
    }
    
    try {
        const subtotal = employeeCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal;
        const orderNumber = generateOrderNumber();
        const notes = document.getElementById('employeeOrderNotes').value || '';
        
        const orderData = {
            orderNumber: orderNumber,
            tableNumber: parseInt(tableNumber),
            customerName: 'Staff Order',
            items: employeeCart.map(item => ({
                menuItemId: item.menuItemId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                spicyLevel: item.spicyLevel || null
            })),
            notes: notes,
            subtotal,
            total,
            status: 'completed', // Auto-completed for employee orders
            paymentStatus: 'confirmed', // Auto-confirmed for employee orders
            confirmedBy: currentEmployeeName,
            paymentConfirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await firebase.firestore().collection('orders').add(orderData);
        
        // Clear cart and order details
        employeeCart = [];
        updateEmployeeCartCount();

        // Clear the cart form
        document.getElementById('employeeTableNumber').value = '';
        document.getElementById('employeeOrderNotes').value = '';

        showNotification(`Order #${orderNumber} placed and confirmed successfully!`, 'success');
        showEmployeeMenu();

        // Reload orders
        if (document.getElementById('ordersView').style.display !== 'none') {
            loadOrders();
        }
    } catch (error) {
        console.error('Error placing order:', error);
        showNotification('Error placing order. Please try again.', 'error');
    }
}

// Generate 4-digit order number
function generateOrderNumber() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Order Search Functions
let searchedOrder = null;

function handleOrderSearch(event) {
    if (event.key === 'Enter') {
        searchOrder();
    }
}

async function searchOrder() {
    const orderNumber = document.getElementById('orderSearchInput').value.trim();
    
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
            document.getElementById('orderSearchResults').style.display = 'none';
            return;
        }
        
        const orderDoc = ordersSnapshot.docs[0];
        searchedOrder = { id: orderDoc.id, ...orderDoc.data() };
        
        displayOrderDetails(searchedOrder);
        document.getElementById('orderSearchResults').style.display = 'block';
        document.getElementById('ordersContainer').style.display = 'none';
        
    } catch (error) {
        console.error('Error searching order:', error);
        showNotification('Error searching order', 'error');
    }
}

function clearOrderSearch() {
    document.getElementById('orderSearchInput').value = '';
    document.getElementById('orderSearchResults').style.display = 'none';
    document.getElementById('ordersContainer').style.display = 'grid';
    searchedOrder = null;
    loadOrders();
}

async function openOrderDetails(orderId) {
    try {
        const orderDoc = await firebase.firestore().collection('orders').doc(orderId).get();

        if (!orderDoc.exists) {
            showNotification('Order not found', 'error');
            return;
        }

        searchedOrder = { id: orderDoc.id, ...orderDoc.data() };

        displayOrderDetails(searchedOrder);
        document.getElementById('orderSearchResults').style.display = 'block';
        document.getElementById('ordersContainer').style.display = 'none';

    } catch (error) {
        console.error('Error opening order details:', error);
        showNotification('Error opening order details', 'error');
    }
}

function displayOrderDetails(order) {
    const content = document.getElementById('orderDetailsContent');

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
                        <button class="quantity-btn" onclick="decreaseOrderItemQuantity('${order.id}', '${item.name}', ${item.quantity})" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-btn" onclick="increaseOrderItemQuantity('${order.id}', '${item.name}', ${item.quantity})">+</button>
                    </div>
                </td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.price * item.quantity)}</td>
                <td>
                    <button class="btn btn-small btn-danger" onclick="removeOrderItem('${order.id}', '${item.name}')">
                        Remove
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Calculate totals with discount
    const subtotal = order.subtotal || 0;
    const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
    const total = Math.max(0, subtotal - discountValue);

    content.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <strong>Order Number:</strong>
                    <p style="font-size: 1.5rem; color: #ff6f00; margin-top: 0.5rem;">#${order.orderNumber}</p>
                </div>
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <strong>Table Number:</strong>
                        <button class="btn btn-small btn-secondary" onclick="startEditTableNumber('${order.id}', '${tableNumber}')" id="editTableBtn_${order.id}">
                            ✏️ Edit
                        </button>
                    </div>
                    <div id="tableDisplay_${order.id}" style="font-size: 1.2rem;">${tableNumber}</div>
                    <div id="tableEdit_${order.id}" style="display: none;">
                        <input type="number" id="tableInput_${order.id}" value="${tableNumber === 'N/A' ? '' : tableNumber}" min="1" placeholder="Enter table number" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; width: 150px; margin-bottom: 0.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-small btn-primary" onclick="saveTableNumber('${order.id}')">Save</button>
                            <button class="btn btn-small btn-secondary" onclick="cancelEditTableNumber('${order.id}', '${tableNumber}')">Cancel</button>
                        </div>
                    </div>
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
                        <select id="paymentMethodSelect_${order.id}" onchange="updatePaymentMethod('${order.id}', this.value)" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <strong>Special Instructions:</strong>
                    <button class="btn btn-small btn-secondary" onclick="startEditNotes('${order.id}', '${notes.replace(/'/g, "\\'")}')" id="editNotesBtn_${order.id}">
                        ✏️ Edit
                    </button>
                </div>
                <div id="notesDisplay_${order.id}" style="padding: 1rem; background: #f5f5f5; border-radius: 8px;">${notes}</div>
                <div id="notesEdit_${order.id}" style="display: none;">
                    <textarea id="notesInput_${order.id}" style="width: 100%; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; min-height: 80px; margin-bottom: 0.5rem;">${notes}</textarea>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-small btn-primary" onclick="saveNotes('${order.id}')">Save</button>
                        <button class="btn btn-small btn-secondary" onclick="cancelEditNotes('${order.id}', '${notes.replace(/'/g, "\\'")}')">Cancel</button>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <strong>Discount:</strong>
                <div style="display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <select id="discountType_${order.id}" onchange="updateDiscountType('${order.id}', this.value)" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="fixed" ${discountType === 'fixed' ? 'selected' : ''}>Fixed Amount</option>
                            <option value="percentage" ${discountType === 'percentage' ? 'selected' : ''}>Percentage</option>
                        </select>
                        <input type="number" id="discountAmount_${order.id}" value="${discountAmount}" min="0" step="0.01"
                               onchange="updateDiscount('${order.id}', this.value)" placeholder="0"
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
                    <button class="btn btn-primary" onclick="addItemToOrder('${order.id}')">
                        ➕ Add New Item
                    </button>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; padding: 1rem; background: #f5f5f5; border-radius: 8px; margin-bottom: 1.5rem;">
                <div>
                    <p><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
                    ${discountValue > 0 ? `<p><strong>Discount:</strong> -${formatCurrency(discountValue)}</p>` : ''}
                    <p style="font-size: 1.25rem; margin-top: 0.5rem;"><strong>Total:</strong> ${formatCurrency(total)}</p>
                </div>
            </div>

            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="verifyPayment('${order.id}')"
                        ${paymentStatus === 'confirmed' ? 'disabled' : ''}>
                    ${paymentStatus === 'confirmed' ? '✓ Payment Verified' : 'Verify Payment & Print Bill'}
                </button>
                <button class="btn btn-secondary" onclick="openEditOrderModal('${order.id}')">
                    Edit Order Details
                </button>
                <button class="btn btn-secondary" onclick="addItemToOrder('${order.id}')">
                    Add Item
                </button>
                <select id="orderStatusSelect_${order.id}" onchange="updateOrderStatus('${order.id}', this.value)"
                        style="padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px;">
                    <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="preparing" ${status === 'preparing' ? 'selected' : ''}>Preparing</option>
                    <option value="ready" ${status === 'ready' ? 'selected' : ''}>Ready</option>
                    <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>
            </div>

            ${paymentStatus === 'confirmed' ? `
                <div style="margin-top: 1rem; padding: 1rem; background: #e8f5e9; border-radius: 8px;">
                    <p><strong>Confirmed by:</strong> ${confirmedBy}</p>
                    <p><strong>Confirmed at:</strong> ${order.paymentConfirmedAt ? formatDate(order.paymentConfirmedAt) : 'N/A'}</p>
                    <button class="btn btn-success" onclick="printBill('${order.id}')" style="margin-top: 1rem;">
                        🖨️ Print Bill
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

async function verifyPayment(orderId) {
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
            confirmedBy: currentEmployeeName,
            paymentConfirmedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Generate and print bill
        await printBill(orderData);
        
        showNotification('Payment verified and bill printed!', 'success');
        
        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.paymentStatus = 'confirmed';
            searchedOrder.status = 'completed';
            searchedOrder.confirmedBy = currentEmployeeName;
            displayOrderDetails(searchedOrder);
        }
        
        // Reload orders
        loadOrders();
        
    } catch (error) {
        console.error('Error verifying payment:', error);
        showNotification('Error verifying payment', 'error');
    }
}

async function printBill(orderOrId) {
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

    // Create a printable bill
    const billWindow = window.open('', '_blank');
    const orderDate = order.createdAt ? formatDate(order.createdAt) : new Date().toLocaleString();
    const tableNumber = order.tableNumber || 'N/A';
    const customerName = order.customerName || 'Guest';
    const discountAmount = order.discountAmount || 0;
    const discountType = order.discountType || 'fixed';
    const subtotal = order.subtotal || 0;
    const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
    const total = Math.max(0, subtotal - discountValue);

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
                <p style="text-align: right; margin: 5px 0;"><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
                ${discountValue > 0 ? `<p style="text-align: right; margin: 5px 0;"><strong>Discount:</strong> -${formatCurrency(discountValue)}</p>` : ''}
                <p style="text-align: right; margin: 5px 0; font-size: 16px;"><strong>TOTAL:</strong> ${formatCurrency(total)}</p>
            </div>

            <div class="footer">
                <p>Thank you for dining with us!</p>
                <p>Payment Status: CONFIRMED</p>
                <p>Confirmed by: ${currentEmployeeName || 'Staff'}</p>
            </div>
        </body>
        </html>
    `);

    billWindow.document.close();

    // Wait for content to load, then print
    setTimeout(() => {
        billWindow.print();
    }, 250);
}

function editOrderItem(orderId, itemName, currentQuantity, itemPrice) {
    const newQuantity = prompt(`Edit quantity for "${itemName}" (current: ${currentQuantity}):`, currentQuantity);
    
    if (newQuantity === null) return;
    
    const quantity = parseInt(newQuantity);
    if (isNaN(quantity) || quantity < 0) {
        showNotification('Invalid quantity', 'error');
        return;
    }
    
    updateOrderItem(orderId, itemName, quantity, itemPrice);
}

async function updateOrderItem(orderId, itemName, newQuantity, itemPrice) {
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
        const total = subtotal;
        
        await orderRef.update({
            items: filteredItems,
            subtotal,
            total
        });
        
        showNotification('Order item updated', 'success');
        
        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.items = filteredItems;
            searchedOrder.subtotal = subtotal;
            searchedOrder.tax = tax;
            searchedOrder.total = total;
            displayOrderDetails(searchedOrder);
        }
        
        loadOrders();
        
    } catch (error) {
        console.error('Error updating order item:', error);
        showNotification('Error updating order item', 'error');
    }
}

async function addItemToOrder(orderId) {
    // Load menu items for selection
    try {
        const menuSnapshot = await firebase.firestore().collection('menu').where('available', '==', true).get();
        const menuItems = menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (menuItems.length === 0) {
            showNotification('No available menu items', 'error');
            return;
        }
        
        let menuOptions = menuItems.map((item, index) => `${index + 1}. ${item.name} - ${formatCurrency(item.price)}`).join('\n');
        const selection = prompt(`Select an item to add:\n\n${menuOptions}\n\nEnter item number:`, '1');
        
        if (selection === null) return;
        
        const itemIndex = parseInt(selection) - 1;
        if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= menuItems.length) {
            showNotification('Invalid selection', 'error');
            return;
        }
        
        const selectedItem = menuItems[itemIndex];
        const quantity = parseInt(prompt(`Enter quantity for "${selectedItem.name}":`, '1'));
        
        if (isNaN(quantity) || quantity < 1) {
            showNotification('Invalid quantity', 'error');
            return;
        }
        
        // Add item to order
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();
        
        const existingItems = orderData.items || [];
        const existingItemIndex = existingItems.findIndex(item => item.menuItemId === selectedItem.id);
        
        let updatedItems;
        if (existingItemIndex >= 0) {
            // Update existing item quantity
            updatedItems = existingItems.map((item, index) => {
                if (index === existingItemIndex) {
                    return { ...item, quantity: item.quantity + quantity };
                }
                return item;
            });
        } else {
            // Add new item
            updatedItems = [...existingItems, {
                menuItemId: selectedItem.id,
                name: selectedItem.name,
                price: selectedItem.price,
                quantity: quantity
            }];
        }
        
        // Recalculate totals
        const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal;
        
        await orderRef.update({
            items: updatedItems,
            subtotal,
            total
        });
        
        showNotification('Item added to order', 'success');
        
        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.items = updatedItems;
            searchedOrder.subtotal = subtotal;
            searchedOrder.tax = tax;
            searchedOrder.total = total;
            displayOrderDetails(searchedOrder);
        }
        
        loadOrders();
        
    } catch (error) {
        console.error('Error adding item to order:', error);
        showNotification('Error adding item to order', 'error');
    }
}

async function openEditOrderModal(orderId) {
    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();

        // Populate the modal with current values
        document.getElementById('employeeEditOrderId').value = orderId;
        document.getElementById('employeeEditTableNumber').value = orderData.tableNumber || '';
        document.getElementById('employeeEditOrderNotes').value = orderData.notes || '';

        // Show the modal
        document.getElementById('employeeEditOrderModal').classList.add('active');
    } catch (error) {
        console.error('Error loading order for edit:', error);
        showNotification('Error loading order details', 'error');
    }
}

function closeEmployeeEditOrderModal() {
    document.getElementById('employeeEditOrderModal').classList.remove('active');
    document.getElementById('employeeEditOrderForm').reset();
}

// Handle employee edit order form submission
document.getElementById('employeeEditOrderForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const orderId = document.getElementById('employeeEditOrderId').value;
    const newTableNumber = document.getElementById('employeeEditTableNumber').value;
    const newNotes = document.getElementById('employeeEditOrderNotes').value;

    try {
        await firebase.firestore().collection('orders').doc(orderId).update({
            tableNumber: parseInt(newTableNumber) || null,
            notes: newNotes || ''
        });

        showNotification('Order updated successfully', 'success');

        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.tableNumber = parseInt(newTableNumber) || null;
            searchedOrder.notes = newNotes || '';
            displayOrderDetails(searchedOrder);
        }

        // Reload orders to show updated status
        loadOrders();

        // Close modal
        closeEmployeeEditOrderModal();

    } catch (error) {
        console.error('Error updating order:', error);
        showNotification('Error updating order', 'error');
    }
});

async function updateOrderStatus(orderId, newStatus) {
    try {
        await firebase.firestore().collection('orders').doc(orderId).update({
            status: newStatus
        });

        showNotification('Order status updated', 'success');

        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.status = newStatus;
            displayOrderDetails(searchedOrder);
        }

        loadOrders();

    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Error updating order status', 'error');
    }
}

async function updateDiscount(orderId, discountAmount) {
    try {
        const discountType = document.getElementById(`discountType_${orderId}`).value;
        const amount = parseFloat(discountAmount) || 0;

        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();

        // Recalculate totals with new discount
        const subtotal = orderData.subtotal || 0;
        const discountValue = discountType === 'percentage' ? (subtotal * amount / 100) : amount;
        const total = Math.max(0, subtotal - discountValue);

        await orderRef.update({
            discountAmount: amount,
            discountType: discountType,
            total: total
        });

        showNotification('Discount updated', 'success');

        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.discountAmount = amount;
            searchedOrder.discountType = discountType;
            searchedOrder.total = total;
            displayOrderDetails(searchedOrder);
        }

        loadOrders();

    } catch (error) {
        console.error('Error updating discount:', error);
        showNotification('Error updating discount', 'error');
    }
}

async function updateDiscountType(orderId, discountType) {
    try {
        const discountAmount = parseFloat(document.getElementById(`discountAmount_${orderId}`).value) || 0;

        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();

        // Recalculate totals with new discount type
        const subtotal = orderData.subtotal || 0;
        const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
        const total = Math.max(0, subtotal - discountValue);

        await orderRef.update({
            discountType: discountType,
            total: total
        });

        showNotification('Discount type updated', 'success');

        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.discountType = discountType;
            searchedOrder.total = total;
            displayOrderDetails(searchedOrder);
        }

        loadOrders();

    } catch (error) {
        console.error('Error updating discount type:', error);
        showNotification('Error updating discount type', 'error');
    }
}

async function removeOrderItem(orderId, itemName) {
    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();

        // Remove the item
        const items = orderData.items.filter(item => item.name !== itemName);

        // Recalculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = orderData.discountAmount || 0;
        const discountType = orderData.discountType || 'fixed';
        const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
        const total = Math.max(0, subtotal - discountValue);

        await orderRef.update({
            items: items,
            subtotal,
            total
        });

        showNotification('Item removed from order', 'success');

        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.items = items;
            searchedOrder.subtotal = subtotal;
            searchedOrder.tax = tax;
            searchedOrder.total = total;
            displayOrderDetails(searchedOrder);
        }

        loadOrders();

    } catch (error) {
        console.error('Error removing order item:', error);
        showNotification('Error removing order item', 'error');
    }
}

async function increaseOrderItemQuantity(orderId, itemName, currentQuantity) {
    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();

        // Update item quantity
        const items = orderData.items.map(item => {
            if (item.name === itemName) {
                return { ...item, quantity: item.quantity + 1 };
            }
            return item;
        });

        // Recalculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = orderData.discountAmount || 0;
        const discountType = orderData.discountType || 'fixed';
        const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
        const total = Math.max(0, subtotal - discountValue);

        await orderRef.update({
            items: items,
            subtotal,
            total
        });

        showNotification('Item quantity increased', 'success');

        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.items = items;
            searchedOrder.subtotal = subtotal;
            searchedOrder.total = total;
            displayOrderDetails(searchedOrder);
        }

        loadOrders();

    } catch (error) {
        console.error('Error increasing item quantity:', error);
        showNotification('Error increasing item quantity', 'error');
    }
}

async function decreaseOrderItemQuantity(orderId, itemName, currentQuantity) {
    if (currentQuantity <= 1) {
        showNotification('Cannot decrease quantity below 1. Use Remove button instead.', 'warning');
        return;
    }

    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();

        // Update item quantity
        const items = orderData.items.map(item => {
            if (item.name === itemName) {
                return { ...item, quantity: item.quantity - 1 };
            }
            return item;
        });

        // Recalculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = orderData.discountAmount || 0;
        const discountType = orderData.discountType || 'fixed';
        const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
        const total = Math.max(0, subtotal - discountValue);

        await orderRef.update({
            items: items,
            subtotal,
            total
        });

        showNotification('Item quantity decreased', 'success');

        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.items = items;
            searchedOrder.subtotal = subtotal;
            searchedOrder.total = total;
            displayOrderDetails(searchedOrder);
        }

        loadOrders();

    } catch (error) {
        console.error('Error decreasing item quantity:', error);
        showNotification('Error decreasing item quantity', 'error');
    }
}

// Employee Spicy Level Functions
function selectEmployeeSpicyLevel(level) {
    if (!pendingEmployeeSpicyItem) return;

    const displayLevel = level === 'normal' ? 'Normal' : level === 'medium' ? 'Medium' : 'Extra Spicy';
    const itemName = level === 'no spicy' ? pendingEmployeeSpicyItem.name : pendingEmployeeSpicyItem.name + ' - ' + displayLevel;
    const spicyLvl = level === 'no spicy' ? null : level;

    const cartItem = employeeCart.find(ci => ci.menuItemId === pendingEmployeeSpicyItem.id && ci.spicyLevel === spicyLvl);

    if (cartItem) {
        cartItem.quantity++;
    } else {
        employeeCart.push({
            menuItemId: pendingEmployeeSpicyItem.id,
            name: itemName,
            price: pendingEmployeeSpicyItem.price,
            quantity: 1,
            spicyLevel: spicyLvl
        });
    }

    updateEmployeeCartCount();
    renderEmployeeMenu();
    showNotification('Item added to cart', 'success');

    closeEmployeeSpicyLevelModal();
}

function closeEmployeeSpicyLevelModal() {
    document.getElementById('employeeSpicyLevelModal').classList.remove('active');
    pendingEmployeeSpicyItem = null;
}



// Inline editing functions for order details
function startEditTableNumber(orderId, currentValue) {
    document.getElementById(`tableDisplay_${orderId}`).style.display = 'none';
    document.getElementById(`tableEdit_${orderId}`).style.display = 'block';
    document.getElementById(`editTableBtn_${orderId}`).style.display = 'none';
}

async function saveTableNumber(orderId) {
    const newValue = document.getElementById(`tableInput_${orderId}`).value;
    const tableNumber = parseInt(newValue) || null;

    try {
        await firebase.firestore().collection('orders').doc(orderId).update({
            tableNumber: tableNumber
        });

        showNotification('Table number updated successfully', 'success');

        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.tableNumber = tableNumber;
            displayOrderDetails(searchedOrder);
        }

        // Reload orders to show updated status
        loadOrders();

    } catch (error) {
        console.error('Error updating table number:', error);
        showNotification('Error updating table number', 'error');
    }
}

function cancelEditTableNumber(orderId, originalValue) {
    document.getElementById(`tableInput_${orderId}`).value = originalValue === 'N/A' ? '' : originalValue;
    document.getElementById(`tableDisplay_${orderId}`).style.display = 'block';
    document.getElementById(`tableEdit_${orderId}`).style.display = 'none';
    document.getElementById(`editTableBtn_${orderId}`).style.display = 'inline-block';
}

function startEditNotes(orderId, currentValue) {
    document.getElementById(`notesDisplay_${orderId}`).style.display = 'none';
    document.getElementById(`notesEdit_${orderId}`).style.display = 'block';
    document.getElementById(`editNotesBtn_${orderId}`).style.display = 'none';
}

async function saveNotes(orderId) {
    const newValue = document.getElementById(`notesInput_${orderId}`).value;

    try {
        await firebase.firestore().collection('orders').doc(orderId).update({
            notes: newValue || ''
        });

        showNotification('Notes updated successfully', 'success');

        // Refresh order details
        if (searchedOrder && searchedOrder.id === orderId) {
            searchedOrder.notes = newValue || '';
            displayOrderDetails(searchedOrder);
        }

        // Reload orders to show updated status
        loadOrders();

    } catch (error) {
        console.error('Error updating notes:', error);
        showNotification('Error updating notes', 'error');
    }
}

function cancelEditNotes(orderId, originalValue) {
    document.getElementById(`notesInput_${orderId}`).value = originalValue;
    document.getElementById(`notesDisplay_${orderId}`).style.display = 'block';
    document.getElementById(`notesEdit_${orderId}`).style.display = 'none';
    document.getElementById(`editNotesBtn_${orderId}`).style.display = 'inline-block';
}
