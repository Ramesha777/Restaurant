// Mock Firebase before requiring the module
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();

const firestoreMock = {
    collection: mockCollection,
    batch: jest.fn(() => ({
        set: jest.fn(),
        commit: jest.fn()
    }))
};

mockCollection.mockReturnValue({
    doc: mockDoc
});

mockDoc.mockReturnValue({
    get: mockGet,
    set: mockSet
});

global.firebase = {
    firestore: () => firestoreMock
};
global.firebase.firestore.FieldValue = {
    serverTimestamp: () => 'SERVER_TIMESTAMP'
};

const { calculateTodaysRevenue } = require('./Frontend/admin-revenue.js');

describe('calculateTodaysRevenue', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should calculate revenue from midnight if no settings exist', async () => {
        // Mock current time to noon
        const now = new Date('2023-05-20T12:00:00Z');
        jest.setSystemTime(now);

        // Mock settings doc not existing
        mockGet.mockResolvedValue({
            exists: false
        });

        const orders = [
            {
                total: 50,
                status: 'completed',
                paymentStatus: 'confirmed',
                createdAt: { toDate: () => new Date('2023-05-20T10:00:00Z') } // Today 10 AM
            },
            {
                total: 30,
                status: 'completed',
                paymentStatus: 'confirmed',
                createdAt: { toDate: () => new Date('2023-05-19T23:00:00Z') } // Yesterday 11 PM
            },
            {
                total: 20,
                status: 'pending', // Not completed
                createdAt: { toDate: () => new Date('2023-05-20T11:00:00Z') }
            }
        ];

        const revenue = await calculateTodaysRevenue(orders);

        // Should only include the 50
        expect(revenue).toBe(50);
    });

    test('should calculate revenue based on last reset time', async () => {
        const now = new Date('2023-05-20T12:00:00Z');
        jest.setSystemTime(now);

        // Mock settings doc exists with reset time at 11 AM today
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({
                lastResetTime: { toDate: () => new Date('2023-05-20T11:00:00Z') }
            })
        });

        const orders = [
            {
                total: 50,
                status: 'completed',
                paymentStatus: 'confirmed',
                createdAt: { toDate: () => new Date('2023-05-20T10:00:00Z') } // Before reset (10 AM)
            },
            {
                total: 40,
                status: 'completed',
                paymentStatus: 'confirmed',
                createdAt: { toDate: () => new Date('2023-05-20T11:30:00Z') } // After reset (11:30 AM)
            }
        ];

        const revenue = await calculateTodaysRevenue(orders);

        // Should only include the 40
        expect(revenue).toBe(40);
    });

    test('should auto-reset if last reset was yesterday', async () => {
        const now = new Date('2023-05-20T12:00:00Z');
        jest.setSystemTime(now);

        // Mock settings doc exists with reset time yesterday
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({
                lastResetTime: { toDate: () => new Date('2023-05-19T10:00:00Z') }
            })
        });

        const orders = [
            {
                total: 100,
                status: 'completed',
                paymentStatus: 'confirmed',
                createdAt: { toDate: () => new Date('2023-05-20T10:00:00Z') } // Today
            }
        ];

        const revenue = await calculateTodaysRevenue(orders);

        // Should trigger auto-reset
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            resetBy: 'Auto-reset'
        }), { merge: true });

        // Should calculate revenue from "now" (which is mocked to noon)
        // The order is at 10 AM, so it should be excluded.
        expect(revenue).toBe(0);
    });
});