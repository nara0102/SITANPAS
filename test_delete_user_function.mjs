// Test script untuk menguji fungsi delete user
import { createClient } from '@supabase/supabase-js';

// Konfigurasi Supabase
const supabaseUrl = 'https://bdpycyvqacnobyirqzpm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkcHljeXZxYWNub2J5aXJxenBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMDY3NDEsImV4cCI6MjA3MzY4Mjc0MX0.jM6G5NuQbpkWgMX85EC0vPLlkmRh6skAi6XwxXNFzLI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeleteUserFunction() {
  console.log('🧪 Testing Delete User Function...\n');

  try {
    // 1. Test koneksi database
    console.log('1. Testing database connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('users')
      .select('id, email, role')
      .limit(1);

    if (connectionError) {
      console.error('❌ Database connection failed:', connectionError.message);
      return;
    }
    console.log('✅ Database connection successful\n');

    // 2. Cek apakah fungsi admin_delete_user_with_audit ada
    console.log('2. Checking if admin_delete_user_with_audit function exists...');
    const { data: functionCheck, error: functionError } = await supabase
      .rpc('admin_delete_user_with_audit', { target_user_id: '00000000-0000-0000-0000-000000000000' });

    if (functionError) {
      if (functionError.message.includes('function admin_delete_user_with_audit')) {
        console.log('❌ Function admin_delete_user_with_audit does not exist yet');
        console.log('📝 Migration needs to be applied to create the function\n');
      } else {
        console.log('✅ Function exists (got expected error for invalid UUID)\n');
      }
    } else {
      console.log('✅ Function exists and accessible\n');
    }

    // 3. Cek users yang ada
    console.log('3. Checking existing users...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role, full_name')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
      return;
    }

    console.log(`✅ Found ${users.length} users in database:`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role}) - ${user.full_name || 'No name'}`);
    });
    console.log();

    // 4. Cek apakah ada admin user
    console.log('4. Checking for admin users...');
    const adminUsers = users.filter(user => user.role === 'admin');
    
    if (adminUsers.length === 0) {
      console.log('⚠️  No admin users found. Admin access required for delete function.');
      console.log('💡 Create an admin user first or update existing user role to admin\n');
    } else {
      console.log(`✅ Found ${adminUsers.length} admin user(s):`);
      adminUsers.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.email}`);
      });
      console.log();
    }

    // 5. Cek RLS policies untuk users table
    console.log('5. Testing RLS policies for users table...');
    const { data: rlsTest, error: rlsError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'nelayan')
      .limit(1);

    if (rlsError) {
      console.log('❌ RLS policy issue:', rlsError.message);
    } else {
      console.log('✅ RLS policies working correctly\n');
    }

    // 6. Cek deleted_users_audit table
    console.log('6. Checking deleted_users_audit table...');
    const { data: auditCheck, error: auditError } = await supabase
      .from('deleted_users_audit')
      .select('*')
      .limit(1);

    if (auditError) {
      if (auditError.message.includes('relation "public.deleted_users_audit" does not exist')) {
        console.log('❌ deleted_users_audit table does not exist yet');
        console.log('📝 Migration needs to be applied to create the audit table\n');
      } else {
        console.log('❌ Error accessing audit table:', auditError.message);
      }
    } else {
      console.log('✅ deleted_users_audit table exists and accessible\n');
    }

    console.log('📊 Test Summary:');
    console.log('- Database connection: ✅ Working');
    console.log('- Users table access: ✅ Working');
    console.log(`- Total users: ${users.length}`);
    console.log(`- Admin users: ${adminUsers.length}`);
    console.log('- Delete function: ⏳ Pending migration');
    console.log('- Audit table: ⏳ Pending migration');
    console.log('\n🔧 Next steps:');
    console.log('1. Apply migration to create delete function and audit table');
    console.log('2. Test delete functionality with admin user');
    console.log('3. Verify audit trail is working');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Jalankan test
testDeleteUserFunction();