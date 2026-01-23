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


