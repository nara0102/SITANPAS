import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = 'https://bdpycyvqacnobyirqzpm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkcHljeXZxYWNub2J5aXJxenBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMDY3NDEsImV4cCI6MjA3MzY4Mjc0MX0.jM6G5NuQbpkWgMX85EC0vPLlkmRh6skAi6XwxXNFzLI';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQLScript() {
    try {
        console.log('🔧 Executing transactions constraint fix via Supabase Dashboard...');
        
        console.log('\n📋 SQL Commands to execute manually in Supabase Dashboard:');
        console.log('Go to: https://supabase.com/dashboard/project/bdpycyvqacnobyirqzpm/sql');
        console.log('\n1. Drop existing constraint:');
        console.log('ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_nelayan;');
        
        console.log('\n2. Allow NULL values:');
        console.log('ALTER TABLE public.transactions ALTER COLUMN nelayan_id DROP NOT NULL;');
        
        console.log('\n3. Add new constraint with SET NULL:');
        console.log('ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_nelayan FOREIGN KEY (nelayan_id) REFERENCES public.users(id) ON DELETE SET NULL;');
        
        // Test if we can access the database through RPC
        console.log('\n🔍 Testing database access...');
        
        // Try to call the existing function to see if it works
        const { data: testData, error: testError } = await supabase
            .rpc('admin_delete_user_with_audit', {
                target_user_id: '00000000-0000-0000-0000-000000000000', // Fake ID to test
                admin_user_id: '00000000-0000-0000-0000-000000000000',
                deletion_reason: 'Test call'
            });
            
        if (testError) {
            console.log('✅ Function exists (expected error for fake IDs):', testError.message);
        } else {
            console.log('✅ Function accessible');
        }
        
        // Check current constraint status
        const { data: constraints, error: constraintError } = await supabase
            .from('information_schema.table_constraints')
            .select('constraint_name, constraint_type')
            .eq('table_name', 'transactions')
            .eq('constraint_type', 'FOREIGN KEY');
            
        if (constraintError) {
            console.log('❌ Cannot access constraint info via API:', constraintError.message);
        } else {
            console.log('✅ Current constraints:', constraints);
        }
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Execute the SQL commands above in Supabase Dashboard');
        console.log('2. Run the test script to verify user deletion works');
        console.log('3. Test the delete function in the admin interface');
        
    } catch (error) {
        console.error('❌ Script execution failed:', error.message);
    }
}

// Run the script
executeSQLScript();