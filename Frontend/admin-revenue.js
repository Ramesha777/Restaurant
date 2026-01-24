// Admin Revenue Management Functions
// Handles daily revenue calculation and reset functionality

// Calculate today's revenue based on last reset time or midnight
async function calculateTodaysRevenue(ordersData) {
    try {
        // Get the last revenue reset time from settings
        const settingsDoc = await firebase.firestore().collection('settings').doc('revenue').get();
        let lastResetTime = new Date();
        lastResetTime.setHours(0, 0, 0, 0); // Default to midnight today

        if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            if (settings.lastResetTime) {
                lastResetTime = settings.lastResetTime.toDate();
            }
        }

        // Check if we need to auto-reset at midnight
        const now = new Date();
        const midnightToday = new Date(now);
        midnightToday.setHours(0, 0, 0, 0);

        // If last reset was before midnight today, auto-reset
        if (lastResetTime < midnightToday) {
            await firebase.firestore().collection('settings').doc('revenue').set({
                lastResetTime: firebase.firestore.FieldValue.serverTimestamp(),
                resetBy: 'Auto-reset',
                resetAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            lastResetTime = new Date(); // Now
        }

        // Filter orders that are completed, payment confirmed, and created after last reset
        const todaysRevenue = ordersData
            .filter(o =>
                o.status === 'completed' &&
                o.paymentStatus === 'confirmed' &&
                o.createdAt &&
                o.createdAt.toDate() >= lastResetTime
            )
            .reduce((sum, o) => sum + (o.total || 0), 0);

        return todaysRevenue;
    } catch (error) {
        console.error('Error calculating today\'s revenue:', error);
        // Fallback to simple calculation if settings can't be loaded
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return ordersData
            .filter(o =>
                o.status === 'completed' &&
                o.paymentStatus === 'confirmed' &&
                o.createdAt &&
                o.createdAt.toDate() >= today
            )
            .reduce((sum, o) => sum + (o.total || 0), 0);
    }
}

// Reset today's revenue manually
async function resetTodaysRevenue() {
    if (!confirm('Are you sure you want to reset today\'s revenue? This will set the revenue counter to zero and start fresh.')) {
        return;
    }

    try {
        // Get current admin name
        const user = firebase.auth().currentUser;
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        const adminName = userDoc.data()?.name || user.email;

        // Update the reset time in settings
        await firebase.firestore().collection('settings').doc('revenue').set({
            lastResetTime: firebase.firestore.FieldValue.serverTimestamp(),
            resetBy: adminName,
            resetAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showNotification('Today\'s revenue has been reset successfully!', 'success');

        // Reload the overview to show updated revenue
        loadOverview();

    } catch (error) {
        console.error('Error resetting revenue:', error);
        showNotification('Error resetting revenue. Please try again.', 'error');
    }
}

// Order Management Functions

// Delete entire order
async function adminDeleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this entire order? This action cannot be undone.')) {
        return;
    }

    try {
        await firebase.firestore().collection('orders').doc(orderId).delete();
        showNotification('Order deleted successfully', 'success');

        // Close the order details view and return to orders list
        document.getElementById('adminOrderSearchResults2').style.display = 'none';
        document.getElementById('adminOrdersContainer').style.display = 'grid';
        
        // Clear search input
        const searchInput = document.getElementById('adminOrderSearchInput2');
        if (searchInput) {
            searchInput.value = '';
        }

        // Reload orders
        if (typeof adminLoadOrders === 'function') {
            adminLoadOrders();
        }
        if (typeof loadOrders === 'function') {
            loadOrders();
        }
        if (typeof loadOverview === 'function') {
            loadOverview();
        }

    } catch (error) {
        console.error('Error deleting order:', error);
        showNotification('Error deleting order. Please try again.', 'error');
    }
}

// Remove single item from order
async function adminRemoveOrderItem(orderId, itemName) {
    if (!confirm(`Are you sure you want to remove "${itemName}" from this order?`)) {
        return;
    }

    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            showNotification('Order not found', 'error');
            return;
        }

        const orderData = orderDoc.data();
        
        // Filter out the item to remove
        const updatedItems = orderData.items.filter(item => item.name !== itemName);

        // If no items left, ask if they want to delete the entire order
        if (updatedItems.length === 0) {
            if (confirm('This was the last item. Do you want to delete the entire order?')) {
                await adminDeleteOrder(orderId);
                return;
            } else {
                showNotification('Cannot remove the last item without deleting the order', 'error');
                return;
            }
        }

        // Recalculate totals
        const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = orderData.discountAmount || 0;
        const discountType = orderData.discountType || 'fixed';
        const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
        const total = Math.max(0, subtotal - discountValue);

        // Update order
        await orderRef.update({
            items: updatedItems,
            subtotal,
            total,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('Item removed from order', 'success');

        // Refresh order details if viewing
        if (typeof adminSearchedOrder !== 'undefined' && adminSearchedOrder && adminSearchedOrder.id === orderId) {
            adminSearchedOrder.items = updatedItems;
            adminSearchedOrder.subtotal = subtotal;
            adminSearchedOrder.total = total;
            if (typeof adminDisplayOrderDetails2 === 'function') {
                adminDisplayOrderDetails2(adminSearchedOrder);
            }
        }

        // Reload orders
        if (typeof loadOrders === 'function') {
            loadOrders();
        }

    } catch (error) {
        console.error('Error removing item from order:', error);
        showNotification('Error removing item. Please try again.', 'error');
    }
}

// Increase item quantity in order
async function adminIncreaseOrderItemQuantity(orderId, itemName, currentQuantity) {
    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            showNotification('Order not found', 'error');
            return;
        }

        const orderData = orderDoc.data();
        
        // Update item quantity
        const updatedItems = orderData.items.map(item => {
            if (item.name === itemName) {
                return { ...item, quantity: item.quantity + 1 };
            }
            return item;
        });

        // Recalculate totals
        const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = orderData.discountAmount || 0;
        const discountType = orderData.discountType || 'fixed';
        const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
        const total = Math.max(0, subtotal - discountValue);

        // Update order
        await orderRef.update({
            items: updatedItems,
            subtotal,
            total,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('Item quantity increased', 'success');

        // Refresh order details if viewing
        if (typeof adminSearchedOrder !== 'undefined' && adminSearchedOrder && adminSearchedOrder.id === orderId) {
            adminSearchedOrder.items = updatedItems;
            adminSearchedOrder.subtotal = subtotal;
            adminSearchedOrder.total = total;
            if (typeof adminDisplayOrderDetails2 === 'function') {
                adminDisplayOrderDetails2(adminSearchedOrder);
            }
        }

        // Reload orders
        if (typeof loadOrders === 'function') {
            loadOrders();
        }

    } catch (error) {
        console.error('Error increasing item quantity:', error);
        showNotification('Error updating quantity. Please try again.', 'error');
    }
}

// Decrease item quantity in order
async function adminDecreaseOrderItemQuantity(orderId, itemName, currentQuantity) {
    // If quantity is 1, ask to remove the item instead
    if (currentQuantity <= 1) {
        await adminRemoveOrderItem(orderId, itemName);
        return;
    }

    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            showNotification('Order not found', 'error');
            return;
        }

        const orderData = orderDoc.data();
        
        // Update item quantity
        const updatedItems = orderData.items.map(item => {
            if (item.name === itemName) {
                return { ...item, quantity: Math.max(1, item.quantity - 1) };
            }
            return item;
        });

        // Recalculate totals
        const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = orderData.discountAmount || 0;
        const discountType = orderData.discountType || 'fixed';
        const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
        const total = Math.max(0, subtotal - discountValue);

        // Update order
        await orderRef.update({
            items: updatedItems,
            subtotal,
            total,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('Item quantity decreased', 'success');

        // Refresh order details if viewing
        if (typeof adminSearchedOrder !== 'undefined' && adminSearchedOrder && adminSearchedOrder.id === orderId) {
            adminSearchedOrder.items = updatedItems;
            adminSearchedOrder.subtotal = subtotal;
            adminSearchedOrder.total = total;
            if (typeof adminDisplayOrderDetails2 === 'function') {
                adminDisplayOrderDetails2(adminSearchedOrder);
            }
        }

        // Reload orders
        if (typeof loadOrders === 'function') {
            loadOrders();
        }

    } catch (error) {
        console.error('Error decreasing item quantity:', error);
        showNotification('Error updating quantity. Please try again.', 'error');
    }
}

// Update discount amount
async function adminUpdateDiscount(orderId, discountAmount) {
    try {
        const amount = parseFloat(discountAmount) || 0;
        
        if (amount < 0) {
            showNotification('Discount amount cannot be negative', 'error');
            return;
        }

        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            showNotification('Order not found', 'error');
            return;
        }

        const orderData = orderDoc.data();
        const subtotal = orderData.subtotal || 0;
        const discountType = orderData.discountType || 'fixed';

        // Calculate discount value
        const discountValue = discountType === 'percentage' ? (subtotal * amount / 100) : amount;
        
        // Validate percentage discount
        if (discountType === 'percentage' && amount > 100) {
            showNotification('Percentage discount cannot exceed 100%', 'error');
            return;
        }

        // Calculate new total
        const total = Math.max(0, subtotal - discountValue);

        // Update order
        await orderRef.update({
            discountAmount: amount,
            total,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('Discount updated', 'success');

        // Refresh order details if viewing
        if (typeof adminSearchedOrder !== 'undefined' && adminSearchedOrder && adminSearchedOrder.id === orderId) {
            adminSearchedOrder.discountAmount = amount;
            adminSearchedOrder.total = total;
            if (typeof adminDisplayOrderDetails2 === 'function') {
                adminDisplayOrderDetails2(adminSearchedOrder);
            }
        }

        // Reload orders
        if (typeof loadOrders === 'function') {
            loadOrders();
        }

    } catch (error) {
        console.error('Error updating discount:', error);
        showNotification('Error updating discount. Please try again.', 'error');
    }
}

// Update discount type
async function adminUpdateDiscountType(orderId, discountType) {
    try {
        const orderRef = firebase.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            showNotification('Order not found', 'error');
            return;
        }

        const orderData = orderDoc.data();
        const subtotal = orderData.subtotal || 0;
        const discountAmount = orderData.discountAmount || 0;

        // Calculate discount value based on new type
        const discountValue = discountType === 'percentage' ? (subtotal * discountAmount / 100) : discountAmount;
        
        // Validate percentage discount
        if (discountType === 'percentage' && discountAmount > 100) {
            showNotification('Percentage discount cannot exceed 100%. Please adjust the amount.', 'error');
            // Reset to 0
            await orderRef.update({
                discountType,
                discountAmount: 0,
                total: subtotal,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            if (typeof adminSearchedOrder !== 'undefined' && adminSearchedOrder && adminSearchedOrder.id === orderId) {
                adminSearchedOrder.discountType = discountType;
                adminSearchedOrder.discountAmount = 0;
                adminSearchedOrder.total = subtotal;
                if (typeof adminDisplayOrderDetails2 === 'function') {
                    adminDisplayOrderDetails2(adminSearchedOrder);
                }
            }
            return;
        }

        // Calculate new total
        const total = Math.max(0, subtotal - discountValue);

        // Update order
        await orderRef.update({
            discountType,
            total,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('Discount type updated', 'success');

        // Refresh order details if viewing
        if (typeof adminSearchedOrder !== 'undefined' && adminSearchedOrder && adminSearchedOrder.id === orderId) {
            adminSearchedOrder.discountType = discountType;
            adminSearchedOrder.total = total;
            if (typeof adminDisplayOrderDetails2 === 'function') {
                adminDisplayOrderDetails2(adminSearchedOrder);
            }
        }

        // Reload orders
        if (typeof loadOrders === 'function') {
            loadOrders();
        }

    } catch (error) {
        console.error('Error updating discount type:', error);
        showNotification('Error updating discount type. Please try again.', 'error');
    }
}


