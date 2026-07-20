-- Check and fix nelayan account data
-- First, let's see the current data for nelayan@nelayan.com
SELECT 'Current nelayan account data:' as info;
SELECT email, role, status, full_name, created_at 
FROM users 
WHERE email = 'nelayan@nelayan.com';

-- If the account doesn't exist or has wrong role/status, let's fix it
-- Insert or update the nelayan account
INSERT INTO users (id, email, role, status, full_name, nama_lengkap)
VALUES (
  gen_random_uuid(),
  'nelayan@nelayan.com',
  'nelayan',
  'active',
  'Nelayan Test User',
  'Nelayan Test User'
)
ON CONFLICT (email) 
DO UPDATE SET 
  role = 'nelayan',
  status = 'active',
  full_name = COALESCE(users.full_name, 'Nelayan Test User'),
  nama_lengkap = COALESCE(users.nama_lengkap, 'Nelayan Test User'),
  updated_at = now();

-- Verify the update
SELECT 'Updated nelayan account data:' as info;
SELECT email, role, status, full_name, created_at, updated_at 
FROM users 
WHERE email = 'nelayan@nelayan.com';

-- Also check if there are any other nelayan accounts
SELECT 'All nelayan accounts:' as info;
SELECT email, role, status, full_name 
FROM users 
WHERE role = 'nelayan';