const { formatCurrency, formatDate } = require('../Frontend/script.js');

describe('Frontend Utility Functions', () => {
    
    describe('formatCurrency', () => {
        test('should format number to GBP currency', () => {
            // Note: Exact output depends on system locale, but should contain £ and the value
            const result = formatCurrency(10.5);
            expect(result).toContain('£');
            expect(result).toContain('10.50');
        });

        test('should handle zero', () => {
            const result = formatCurrency(0);
            expect(result).toContain('0.00');
        });

        test('should handle large numbers', () => {
            const result = formatCurrency(1000);
            // Check for comma separator if locale supports it, or just the value
            expect(result).toMatch(/£1,000\.00|£1000\.00/);
        });
    });

    describe('formatDate', () => {
        test('should return N/A for null/undefined', () => {
            expect(formatDate(null)).toBe('N/A');
            expect(formatDate(undefined)).toBe('N/A');
        });

        test('should format a standard Date object', () => {
            const date = new Date('2023-01-01T12:00:00Z');
            const result = formatDate(date);
            expect(result).not.toBe('N/A');
            expect(result).toContain('2023');
        });

        test('should format a Firestore-like timestamp object', () => {
            const mockTimestamp = {
                toDate: () => new Date('2023-05-20T10:30:00Z')
            };
            const result = formatDate(mockTimestamp);
            expect(result).not.toBe('N/A');
            expect(result).toContain('2023');
        });
    });
});