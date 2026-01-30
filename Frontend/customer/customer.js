// Customer interface JavaScript - No authentication required (QR Code access)

let cart = [];
let menuItems = [];
let currentCategory = '';
let currentFoodType = '';
let availableCategories = [];
let availableFoodTypes = [];
let sidebarCollapsed = false;

// Initialize on page load - Firebase is initialized in Backend/firebase.js
window.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be ready
    if (typeof firebase !== 'undefined') {
        loadCartFromStorage();
        loadCategories();
        loadMenu();
    } else {
        console.error('Firebase SDK not loaded');
    }
});

function showMenu() {
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    document.getElementById('menuSection').classList.add('active');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebarCollapsed = !sidebarCollapsed;
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
    } else {
        sidebar.classList.remove('collapsed');
    }
}

function showCart() {
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    document.getElementById('cartSection').classList.add('active');
    renderCart();
}

// Generate 4-digit order number
function generateOrderNumber() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function loadMenu() {
    try {
        const snapshot = await firebase.firestore().collection('menu').orderBy('category').get();
        menuItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Extract unique food types
        availableFoodTypes = [...new Set(menuItems.map(item => item.foodType).filter(Boolean))];

        renderMenu();
        renderFilters();
    } catch (error) {
        console.error('Error loading menu:', error);
        showNotification('Error loading menu', 'error');
    }
}

async function loadCategories() {
    try {
        firebase.firestore().collection('categories').orderBy('name').onSnapshot(snapshot => {
            availableCategories = snapshot.docs.map(doc => doc.data().name);

            renderFilters();
        });
    } 
    catch (error) {
        console.error('Error loading categories:', error);
        renderFilters();
    }
}

function renderFilters() {
    const filterContainer = document.getElementById('filterContainer');

    if (!filterContainer) return;

    let filterHtml = '';

    // Category filters with subcategories
    filterHtml += '<div class="filter-group">';
    filterHtml += '<h4>Categories</h4>';
    filterHtml += `<button class="filter-btn active" data-category="" onclick="filterMenu('')">All Categories</button>`;

    availableCategories.forEach(category => {
        filterHtml += `<button class="filter-btn" data-category="${category}" onclick="filterMenu('${category}')">${category.charAt(0).toUpperCase() + category.slice(1)}</button>`;

        // Add subcategories for this category
        const categoryItems = menuItems.filter(item => item.category === category);
        const subcategories = [...new Set(categoryItems.map(item => item.subcategory).filter(Boolean))];

        if (subcategories.length > 0) {
            filterHtml += '<div class="subcategory-filters" style="margin-left: 1rem; margin-top: 0.5rem;">';
            subcategories.forEach(subcategory => {
                filterHtml += `<button class="filter-btn subcategory-btn" data-category="${category}" data-subcategory="${subcategory}" onclick="filterBySubcategory('${category}', '${subcategory}')">${subcategory.charAt(0).toUpperCase() + subcategory.slice(1)}</button>`;
            });
            filterHtml += '</div>';
        }
    });
    filterHtml += '</div>';

    filterContainer.innerHTML = filterHtml;
}

function filterMenu(category) {
    currentCategory = category;
    currentFoodType = ''; // Reset food type filter when category changes

    // Update active filter
    document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');

    // Reset food type filter buttons
    document.querySelectorAll('.filter-btn[data-food-type]').forEach(btn => {
        btn.classList.remove('active');
    });

    renderMenu();
}

function filterByFoodType(foodType) {
    currentFoodType = foodType;
    currentCategory = ''; // Reset category filter when food type changes

    // Update active filter
    document.querySelectorAll('.filter-btn[data-food-type]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-food-type="${foodType}"]`).classList.add('active');

    // Reset category filter buttons
    document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
        btn.classList.remove('active');
    });

    // Reset subcategory filter buttons
    document.querySelectorAll('.filter-btn[data-subcategory]').forEach(btn => {
        btn.classList.remove('active');
    });

    renderMenu();
}

function filterBySubcategory(category, subcategory) {
    currentCategory = category;
    currentFoodType = ''; // Reset food type filter

    // Update active filter
    document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');

    // Update active subcategory filter
    document.querySelectorAll('.filter-btn[data-subcategory]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"][data-subcategory="${subcategory}"]`).classList.add('active');

    // Reset food type filter buttons
    document.querySelectorAll('.filter-btn[data-food-type]').forEach(btn => {
        btn.classList.remove('active');
    });

    renderMenu();
}

function renderMenu() {
    let filteredItems = menuItems;

    // Apply category filter
    if (currentCategory) {
        filteredItems = filteredItems.filter(item => item.category === currentCategory);
    }

    // Apply food type filter
    if (currentFoodType) {
        filteredItems = filteredItems.filter(item => item.foodType === currentFoodType);
    }

    const menuGrid = document.getElementById('menuGrid');

    if (filteredItems.length === 0) {
        const filterText = currentCategory && currentFoodType
            ? `in ${currentCategory} category and ${currentFoodType} type`
            : currentCategory
                ? `in ${currentCategory} category`
                : currentFoodType
                    ? `of ${currentFoodType} type`
                    : 'in this category';
        menuGrid.innerHTML = `<p style="text-align: center; color: #666; grid-column: 1/-1;">No items found ${filterText}</p>`;
        return;
    }

    // Group by food type when no specific food type filter is active
    if (!currentFoodType) {
        renderMenuGroupedByFoodType(filteredItems);
    } else {
        renderMenuGrid(filteredItems);
    }
}

function renderMenuGroupedByFoodType(items) {
    const menuGrid = document.getElementById('menuGrid');
    
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
            const cartItem = cart.find(ci => ci.menuItemId === item.id);
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
                                    <button class="quantity-btn" onclick="decreaseQuantity('${item.id}')" ${quantity === 0 ? 'disabled' : ''}>-</button>
                                    <span class="quantity-display">${quantity}</span>
                                    <button class="quantity-btn" onclick="increaseQuantity('${item.id}')">+</button>
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

function renderMenuGrid(items) {
    const menuGrid = document.getElementById('menuGrid');
    
    menuGrid.innerHTML = items.map(item => {
        const cartItem = cart.find(ci => ci.menuItemId === item.id);
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
                                <button class="quantity-btn" onclick="decreaseQuantity('${item.id}')" ${quantity === 0 ? 'disabled' : ''}>-</button>
                                <span class="quantity-display">${quantity}</span>
                                <button class="quantity-btn" onclick="increaseQuantity('${item.id}')">+</button>
                            </div>`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function increaseQuantity(menuItemId) {
    const item = menuItems.find(m => m.id === menuItemId);
    if (!item || item.available === false) return;

    // Check if item is spicy and ask for spicy level
    if (item.spicyLevel === 'ask') {
        pendingSpicyItem = item;
        document.getElementById('spicyItemName').textContent = item.name;
        document.getElementById('spicyLevelModal').classList.add('active');
        return;
    }

    const cartItem = cart.find(ci => ci.menuItemId === menuItemId && ci.spicyLevel === null);

    if (cartItem) {
        cartItem.quantity++;
    } else {
        cart.push({
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            spicyLevel: null
        });
    }

    saveCartToStorage();
    updateCartCount();
    renderMenu();
    showNotification('Item added to cart', 'success');
}

function decreaseQuantity(menuItemId) {
    const cartItem = cart.find(ci => ci.menuItemId === menuItemId);
    if (!cartItem) return;
    
    cartItem.quantity--;
    
    if (cartItem.quantity <= 0) {
        cart = cart.filter(ci => ci.menuItemId !== menuItemId);
    }
    
    saveCartToStorage();
    updateCartCount();
    renderMenu();
}

function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = totalItems;
}

function renderCart() {
    const cartContainer = document.getElementById('cartContainer');
    const cartSummary = document.getElementById('cartSummary');

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p style="text-align: center; color: #666;">Your cart is empty</p>';
        cartSummary.style.display = 'none';
        return;
    }

    cartContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>${formatCurrency(item.price)} each</p>
            </div>
            <div class="cart-item-actions">
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="decreaseCartQuantity(${index})">-</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button class="quantity-btn" onclick="increaseCartQuantity(${index})">+</button>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                    <div class="cart-item-price">${formatCurrency(item.price * item.quantity)}</div>
                    <button class="btn btn-danger btn-small" onclick="removeCartItem(${index})" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;">Remove</button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal;
    
    document.getElementById('subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('total').textContent = formatCurrency(total);
    
    cartSummary.style.display = 'block';
}

function increaseCartQuantity(index) {
    cart[index].quantity++;
    saveCartToStorage();
    updateCartCount();
    renderCart();
}

function decreaseCartQuantity(index) {
    cart[index].quantity--;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    saveCartToStorage();
    updateCartCount();
    renderCart();
}

function removeCartItem(index) {
    cart.splice(index, 1);
    saveCartToStorage();
    updateCartCount();
    renderCart();
    showNotification('Item removed from cart', 'success');
}

async function checkout() {
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }

    const tableNumber = document.getElementById('tableNumber').value;
    if (!tableNumber || tableNumber < 1) {
        showNotification('Please enter a valid table number', 'error');
        return;
    }

    try {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal;
        const orderNumber = generateOrderNumber();
        let notes = document.getElementById('orderNotes').value || '';



        const orderData = {
            orderNumber: orderNumber,
            tableNumber: parseInt(tableNumber),
            customerName: 'Guest',
            items: cart.map(item => ({
                menuItemId: item.menuItemId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                spicyLevel: item.spicyLevel || null
            })),
            notes: notes,
            subtotal,
            total,
            status: 'pending',
            paymentStatus: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await firebase.firestore().collection('orders').add(orderData);

        // Clear cart
        cart = [];
        saveCartToStorage();
        updateCartCount();

        // Show confirmation
        document.getElementById('orderNumberDisplay').textContent = `#${orderNumber}`;
        document.getElementById('tableNumberDisplay').textContent = tableNumber;

        // Show confirmation section
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
        document.getElementById('orderConfirmationSection').classList.add('active');

    } catch (error) {
        console.error('Error placing order:', error);
        showNotification('Error placing order. Please try again.', 'error');
    }
}


// Cart storage functions
function saveCartToStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartCount();
    }
}

// Spicy level functions
function selectSpicyLevel(level) {
    if (!pendingSpicyItem) return;

    const displayLevel = level === 'normal' ? 'Normal' : level === 'medium' ? 'Medium' : 'Extra Spicy';
    const itemName = level === 'no spicy' ? pendingSpicyItem.name : pendingSpicyItem.name + ' - ' + displayLevel;
    const spicyLvl = level === 'no spicy' ? null : level;

    const cartItem = cart.find(ci => ci.menuItemId === pendingSpicyItem.id && ci.spicyLevel === spicyLvl);

    if (cartItem) {
        cartItem.quantity++;
    } else {
        cart.push({
            menuItemId: pendingSpicyItem.id,
            name: itemName,
            price: pendingSpicyItem.price,
            quantity: 1,
            spicyLevel: spicyLvl
        });
    }

    saveCartToStorage();
    updateCartCount();
    renderMenu();
    showNotification('Item added to cart', 'success');

    closeSpicyLevelModal();
}

function closeSpicyLevelModal() {
    document.getElementById('spicyLevelModal').classList.remove('active');
    pendingSpicyItem = null;
}

// Initialize cart count on load
updateCartCount();
