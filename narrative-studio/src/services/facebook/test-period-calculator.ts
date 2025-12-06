/**
 * Test script for PeriodCalculator
 */

import { PeriodCalculator } from './PeriodCalculator.js';

// Test with Tem's birthday: April 21
const calc = new PeriodCalculator({
  periodType: 'quarters',
  periodLength: 90,
  yearStartType: 'birthday',
  birthday: '04-21',
  useQuarterNames: true,
  includeDateRanges: true
});

console.log('Testing PeriodCalculator with Tem\'s birthday (April 21):\n');

// Test cases from the handoff document
const testCases = [
  { timestamp: 1208775267, description: 'Apr 21, 2008 (first post)' },  // Expected: Q1
  { timestamp: 1223275382, description: 'Oct 6, 2008 (from design doc)' },  // Expected: Q3
  { timestamp: 1333640381, description: 'Apr 5, 2012 (comment example)' },  // Expected: Q4 of previous year
  { timestamp: 1577836800, description: 'Jan 1, 2020' },  // Expected: Q4 of 2019
  { timestamp: 1618963200, description: 'Apr 21, 2021' },  // Expected: Q1 of 2021
  { timestamp: 1619049600, description: 'Apr 22, 2021' },  // Expected: Q1 of 2021
  { timestamp: 1618876800, description: 'Apr 20, 2021' },  // Expected: Q4 of 2020
];

testCases.forEach(({ timestamp, description }) => {
  const period = calc.getPeriodForDate(timestamp);
  const date = new Date(timestamp * 1000);

  console.log(`${description}`);
  console.log(`  Date: ${date.toDateString()}`);
  console.log(`  Period: ${period.label} (year ${period.year})`);
  console.log(`  Folder: ${period.folderName}`);
  console.log(`  Range: ${period.startDate.toDateString()} → ${period.endDate.toDateString()}`);
  console.log('');
});

// Test getting periods in range
console.log('Testing getPeriodsInRange:');
const startTimestamp = 1208775267;  // Apr 21, 2008
const endTimestamp = 1577836800;   // Jan 1, 2020
const periods = calc.getPeriodsInRange(startTimestamp, endTimestamp);

console.log(`Found ${periods.length} periods from 2008 to 2020`);
console.log('First 5 periods:');
periods.slice(0, 5).forEach(p => {
  console.log(`  ${p.folderName}`);
});
console.log('...');
console.log('Last 5 periods:');
periods.slice(-5).forEach(p => {
  console.log(`  ${p.folderName}`);
});
