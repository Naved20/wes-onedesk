/**
 * Verify Sunday Holidays Migration
 * 
 * This script checks:
 * 1. How many holidays exist before migration
 * 2. How many Sundays will be added
 * 3. Verifies no duplicate Sundays exist
 * 4. Shows sample data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('🔍 Verifying Sunday Holidays Migration...\n');

  // 1. Check current holidays
  const { data: currentHolidays, error: currentError } = await supabase
    .from('holidays')
    .select('*')
    .order('date');

  if (currentError) {
    console.error('❌ Error fetching holidays:', currentError);
    return;
  }

  console.log(`📊 Current Status:`);
  console.log(`   Total holidays in database: ${currentHolidays?.length || 0}`);
  
  const sundayHolidays = currentHolidays?.filter(h => h.name === 'Sunday') || [];
  console.log(`   Sundays already in database: ${sundayHolidays.length}`);
  
  const nonSundayHolidays = currentHolidays?.filter(h => h.name !== 'Sunday') || [];
  console.log(`   Other holidays: ${nonSundayHolidays.length}\n`);

  // 2. Calculate expected Sundays for 2025, 2026, 2027
  const expectedSundays = {
    2025: 52,
    2026: 52,
    2027: 52,
    total: 156
  };

  console.log(`📅 Expected Sundays to be added:`);
  console.log(`   2025: ${expectedSundays[2025]} Sundays`);
  console.log(`   2026: ${expectedSundays[2026]} Sundays`);
  console.log(`   2027: ${expectedSundays[2027]} Sundays`);
  console.log(`   Total: ${expectedSundays.total} Sundays\n`);

  // 3. Show sample holidays for May 2026
  const may2026Holidays = currentHolidays?.filter(h => {
    const date = new Date(h.date);
    return date.getFullYear() === 2026 && date.getMonth() === 4; // May = month 4
  }) || [];

  console.log(`📋 Current May 2026 Holidays (${may2026Holidays.length}):`);
  may2026Holidays.forEach(h => {
    const date = new Date(h.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`   ${h.date} (${dayName}) - ${h.name}`);
  });
  console.log();

  // 4. Calculate Sundays in May 2026
  const sundaysInMay2026 = [];
  for (let day = 1; day <= 31; day++) {
    const date = new Date(2026, 4, day); // May = month 4
    if (date.getDay() === 0) { // Sunday
      sundaysInMay2026.push(date.toISOString().split('T')[0]);
    }
  }

  console.log(`🗓️  Sundays in May 2026 (${sundaysInMay2026.length}):`);
  sundaysInMay2026.forEach(date => {
    const exists = may2026Holidays.some(h => h.date === date && h.name === 'Sunday');
    console.log(`   ${date} ${exists ? '✅ Already exists' : '❌ Will be added'}`);
  });
  console.log();

  // 5. Check for potential duplicates
  const duplicateDates = currentHolidays?.reduce((acc, holiday) => {
    const count = currentHolidays.filter(h => h.date === holiday.date).length;
    if (count > 1 && !acc.includes(holiday.date)) {
      acc.push(holiday.date);
    }
    return acc;
  }, [] as string[]) || [];

  if (duplicateDates.length > 0) {
    console.log(`⚠️  Dates with multiple holidays (${duplicateDates.length}):`);
    duplicateDates.forEach(date => {
      const holidays = currentHolidays?.filter(h => h.date === date) || [];
      console.log(`   ${date}:`);
      holidays.forEach(h => console.log(`      - ${h.name}`));
    });
    console.log();
  }

  // 6. Summary
  console.log(`📈 After Migration Summary:`);
  console.log(`   Current holidays: ${currentHolidays?.length || 0}`);
  console.log(`   Sundays to add: ${expectedSundays.total - sundayHolidays.length}`);
  console.log(`   Total after migration: ${(currentHolidays?.length || 0) + (expectedSundays.total - sundayHolidays.length)}`);
  console.log();

  // 7. Migration recommendation
  if (sundayHolidays.length === 0) {
    console.log('✅ Ready to run migration!');
    console.log('   Run: supabase migration up');
    console.log('   Or manually execute: 20260531000001_add_sundays_as_holidays.sql');
  } else if (sundayHolidays.length < expectedSundays.total) {
    console.log('⚠️  Some Sundays already exist');
    console.log('   Migration will add missing Sundays only');
    console.log('   Safe to run migration');
  } else {
    console.log('ℹ️  All Sundays already added');
    console.log('   Migration will skip existing Sundays');
  }
}

verifyMigration().catch(console.error);
