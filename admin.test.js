// Mock global objects that admin.js might expect
global.firebase = {
    auth: () => ({
        onAuthStateChanged: jest.fn()
    })
};

const { generateOrderNumber } = require('./Frontend/admin.js');

describe('Admin Functions', () => {
    describe('generateOrderNumber', () => {
        test('should return a 4 digit string', () => {
            const orderNum = generateOrderNumber();
            expect(typeof orderNum).toBe('string');
            expect(orderNum).toMatch(/^\d{4}$/);
        });

        test('should be within range 1000-9999', () => {
            for (let i = 0; i < 100; i++) {
                const orderNum = parseInt(generateOrderNumber());
                expect(orderNum).toBeGreaterThanOrEqual(1000);
                expect(orderNum).toBeLessThan(10000);
            }
        });
    });
});