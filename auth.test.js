// Mock localStorage and window before requiring the module
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', { 
    value: { 
        location: { href: '' } 
    } 
});

const { login, logout, getLoggedInUser, STORAGE_KEY } = require('../Frontend/auth.js');

describe('Authentication Module', () => {
    beforeEach(() => {
        localStorage.clear();
        window.location.href = '';
        jest.clearAllMocks();
    });

    describe('login', () => {
        test('should login successfully with valid admin credentials', () => {
            const user = login('admin@example.com', 'password123');
            expect(user).not.toBeNull();
            expect(user.role).toBe('admin');
            expect(user.email).toBe('admin@example.com');
            
            // Verify storage
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
            expect(stored.email).toBe('admin@example.com');
        });

        test('should login successfully with valid staff credentials', () => {
            const user = login('staff@example.com', 'password123');
            expect(user).not.toBeNull();
            expect(user.role).toBe('staff');
        });

        test('should fail with invalid password', () => {
            const user = login('admin@example.com', 'wrongpass');
            expect(user).toBeNull();
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        });

        test('should fail with non-existent user', () => {
            const user = login('ghost@example.com', 'password123');
            expect(user).toBeNull();
        });
    });

    describe('getLoggedInUser', () => {
        test('should return null when no user is logged in', () => {
            expect(getLoggedInUser()).toBeNull();
        });

        test('should return user object when user is logged in', () => {
            login('admin@example.com', 'password123');
            const user = getLoggedInUser();
            expect(user).not.toBeNull();
            expect(user.email).toBe('admin@example.com');
        });
    });

    describe('logout', () => {
        test('should clear local storage and redirect', () => {
            // Setup login
            login('admin@example.com', 'password123');
            expect(getLoggedInUser()).not.toBeNull();

            // Perform logout
            logout();

            // Verify
            expect(getLoggedInUser()).toBeNull();
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
            expect(window.location.href).toContain('index.html');
        });
    });
});