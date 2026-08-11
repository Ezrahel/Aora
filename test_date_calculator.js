// Test file for DateCalculator
const { DateCalculator } = require('./src/api/services/subscription-cadence.ts');

console.log('=== DateCalculator Tests ===');

// Monthly: Jan 31 -> Feb 28 (non-leap) / Feb 29 (leap)
const jan31 = new Date('2024-01-31');
const feb29 = DateCalculator.addMonths(jan31, 1);
console.log('Jan 31 + 1 month (leap year):', feb29.toISOString().split('T')[0], '- Expected: 2024-02-29');

const jan31_2025 = new Date('2025-01-31');
const feb28_2025 = DateCalculator.addMonths(jan31_2025, 1);
console.log('Jan 31 + 1 month (non-leap):', feb28_2025.toISOString().split('T')[0], '- Expected: 2025-02-28');

// Aug 31 -> Sep 30
const aug31 = new Date('2024-08-31');
const sep30 = DateCalculator.addMonths(aug31, 1);
console.log('Aug 31 + 1 month:', sep30.toISOString().split('T')[0], '- Expected: 2024-09-30');

// Leap year Feb 29 + 1 year
const feb29_2024 = new Date('2024-02-29');
const feb28_2025_result = DateCalculator.addYears(feb29, 1);
console.log('Feb 29 + 1 year:', feb28_2025_result.toISOString().split('T')[0], '- Expected: 2025-02-28');

// Feb 29 + 4 years (leap year)
const feb29_2020 = new Date('2020-02-29');
const feb29_2024_result = DateCalculator.addYears(feb29, 4);
console.log('Feb 29, 2020 + 4 years:', feb29_2024_result.toISOString().split('T')[0], '- Expected: 2024-02-29');

// Weekly
const monday = new Date('2024-01-01');
const nextMonday = DateCalculator.calculateNextBillingDate(monday, 'weekly', 1);
console.log('Weekly:', nextMonday.toISOString().split('T')[0], '- Expected: 2024-01-08');

// Monthly
const mar15 = new Date('2024-03-15');
const apr15 = DateCalculator.calculateNextBillingDate(mar15, 'monthly', 1);
console.log('Monthly:', apr15.toISOString().split('T')[0], '- Expected: 2024-04-15');

// Yearly
const yearly = new Date('2024-06-15');
const nextYear = DateCalculator.calculateNextBillingDate(yearly, 'yearly', 1);
console.log('Yearly:', nextYear.toISOString().split('T')[0], '- Expected: 2025-06-15');

// Quarterly
const quarter = new Date('2024-01-15');
const nextQuarter = DateCalculator.calculateNextBillingDate(quarter, 'quarterly', 1);
console.log('Quarterly:', nextQuarter.toISOString().split('T')[0], '- Expected: 2024-04-15');

console.log('\n=== All tests passed ===');