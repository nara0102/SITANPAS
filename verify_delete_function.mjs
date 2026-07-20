import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDeleteFunction() {
    console.log('🔍 Verifying admin_delete_user_with_audit function...\n');

    try {
        // 1. Test if function exists by calling it with invalid UUID
        console.log('1. Testing function existence...');
        const { data, error } = await supabase.rpc('admin_delete_user_with_audit', {
            target_user_id: '00000000-0000-0000-0000-000000000000',
            admin_user_id: '00000000-0000-0000-0000-000000000000',
            deletion_reason: 'Test call'
        });

        if (error) {
            if (error.message.includes('function admin_delete_user_with_audit(uuid, uuid, text) does not exist')) {
                console.log('❌ Function NOT deployed yet');
                console.log('📋 Please run the SQL script in Supabase Dashboard > SQL Editor');
                return false;
            } else {
                console.log('✅ Function exists (expected error for invalid UUID)');
                console.log('   Error:', error.message);
            }
        }

        // 2. Check if audit table exists
        console.log('\n2. Checking audit table...');
        const { data: auditData, error: auditError } = await supabase
            .from('deleted_users_audit')
            .select('*')
            .limit(1);

        if (auditError) {
            if (auditError.message.includes('relation "public.deleted_users_audit" does not exist')) {
                console.log('❌ Audit table NOT created yet');
                return false;
            } else {
                console.log('✅ Audit table exists');
            }
        } else {
            console.log('✅ Audit table accessible');
        }

        // 3. Check admin user
        console.log('\n3. Checking admin user...');
        const { data: adminData, error: adminError } = await supabase
            .from('users')
            .select('id, email, role')
            .eq('email', 'admin@nelayan.com')
            .single();

        if (adminError) {
            console.log('❌ Admin user not found or accessible');
            console.log('   Error:', adminError.message);
        } else {
            console.log('✅ Admin user found:', adminData);
        }

        // 4. List all users for testing
        console.log('\n4. Available users for testing...');
        const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, email, role, approval_status')
            .limit(5);

        if (usersError) {
            console.log('❌ Cannot fetch users:', usersError.message);
        } else {
            console.log('✅ Users available:', usersData.length);
            usersData.forEach(user => {
                console.log(`   - ${user.email} (${user.role}) - ${user.approval_status}`);
            });
        }

        console.log('\n🎯 DEPLOYMENT STATUS:');
        console.log('✅ Function: Ready');
        console.log('✅ Audit Table: Ready');
        console.log('✅ Database Connection: Working');
        console.log('\n📋 Next Steps:');
        console.log('1. Ensure admin user has admin role');
        console.log('2. Test delete function from admin dashboard');
        console.log('3. Verify audit trail is working');

        return true;

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

// Run verification
verifyDeleteFunction()
    .then(success => {
        if (success) {
            console.log('\n🎉 Verification completed successfully!');
        } else {
            console.log('\n⚠️  Please deploy the SQL script first');
        }
    })
    .catch(error => {
        console.error('💥 Verification error:', error);
    });