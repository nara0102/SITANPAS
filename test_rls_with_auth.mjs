import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

// Create Supabase clients
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRLSWithAuth() {
    console.log('🔐 Testing RLS Policies with Proper Authentication');
    console.log('=' .repeat(60));

    try {
        // Test 1: Create two test users and sign them in
        console.log('\n📝 Step 1: Creating test users...');
        
        const testEmail1 = `test-nelayan-1-${Date.now()}@example.com`;
        const testEmail2 = `test-nelayan-2-${Date.now()}@example.com`;
        const testPassword = 'TestPassword123!';

        // Create first user
        const { data: user1, error: error1 } = await supabase.auth.signUp({
            email: testEmail1,
            password: testPassword,
            options: {
                data: {
                    role: 'nelayan',
                    nama: 'Test Nelayan 1'
                }
            }
        });

        if (error1) {
            console.error('❌ Error creating user 1:', error1.message);
            return;
        }

        // Create second user  
        const { data: user2, error: error2 } = await supabase.auth.signUp({
            email: testEmail2,
            password: testPassword,
            options: {
                data: {
                    role: 'nelayan',
                    nama: 'Test Nelayan 2'
                }
            }
        });

        if (error2) {
            console.error('❌ Error creating user 2:', error2.message);
            return;
        }

        console.log('✅ Test users created successfully');
        console.log(`   User 1 ID: ${user1.user?.id}`);
        console.log(`   User 2 ID: ${user2.user?.id}`);

        // Test 2: Sign in as first user and create product
        console.log('\n📝 Step 2: Testing as User 1...');
        
        const { error: signInError1 } = await supabase.auth.signInWithPassword({
            email: testEmail1,
            password: testPassword
        });

        if (signInError1) {
            console.error('❌ Error signing in user 1:', signInError1.message);
            return;
        }

        // Check current session
        const { data: session1 } = await supabase.auth.getSession();
        console.log(`✅ Signed in as User 1: ${session1.session?.user.id}`);

        // Create product as User 1
        const { data: product, error: createError } = await supabase
            .from('products')
            .insert({
                nama_produk: 'Test Fish User 1',
                deskripsi: 'Fresh fish from User 1',
                harga: 50000,
                stok: 10,
                kategori: 'ikan_segar',
                nelayan_id: session1.session?.user.id
            })
            .select()
            .single();

        if (createError) {
            console.error('❌ Error creating product:', createError.message);
            return;
        }

        console.log('✅ Product created by User 1:', product.id);

        // Test 3: Sign in as second user and try to update first user's product
        console.log('\n📝 Step 3: Testing cross-user update as User 2...');
        
        const { error: signInError2 } = await supabase.auth.signInWithPassword({
            email: testEmail2,
            password: testPassword
        });

        if (signInError2) {
            console.error('❌ Error signing in user 2:', signInError2.message);
            return;
        }

        // Check current session
        const { data: session2 } = await supabase.auth.getSession();
        console.log(`✅ Signed in as User 2: ${session2.session?.user.id}`);

        // Try to update User 1's product as User 2
        const { data: updateResult, error: updateError } = await supabase
            .from('products')
            .update({
                nama_produk: 'HACKED BY USER 2!',
                harga: 999999,
                deskripsi: 'This should not work!'
            })
            .eq('id', product.id)
            .select();

        if (updateError) {
            console.log('✅ Cross-user update PREVENTED by RLS:', updateError.message);
        } else if (updateResult && updateResult.length > 0) {
            console.log('❌ Cross-user update ALLOWED - RLS NOT WORKING!');
            console.log('   Updated product:', updateResult[0]);
        } else {
            console.log('✅ Cross-user update PREVENTED - No rows affected');
        }

        // Test 4: Verify User 2 can create their own product
        console.log('\n📝 Step 4: Testing User 2 can create own product...');
        
        const { data: product2, error: createError2 } = await supabase
            .from('products')
            .insert({
                nama_produk: 'Test Fish User 2',
                deskripsi: 'Fresh fish from User 2',
                harga: 75000,
                stok: 5,
                kategori: 'ikan_segar',
                nelayan_id: session2.session?.user.id
            })
            .select()
            .single();

        if (createError2) {
            console.error('❌ Error creating product for User 2:', createError2.message);
        } else {
            console.log('✅ User 2 can create own product:', product2.id);
        }

        // Test 5: Verify User 2 can update their own product
        console.log('\n📝 Step 5: Testing User 2 can update own product...');
        
        const { data: updateOwn, error: updateOwnError } = await supabase
            .from('products')
            .update({
                harga: 80000,
                deskripsi: 'Updated by owner'
            })
            .eq('id', product2.id)
            .select();

        if (updateOwnError) {
            console.error('❌ Error updating own product:', updateOwnError.message);
        } else {
            console.log('✅ User 2 can update own product:', updateOwn[0]);
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        
        // Sign back as User 1 to delete their product
        await supabase.auth.signInWithPassword({
            email: testEmail1,
            password: testPassword
        });
        
        await supabase.from('products').delete().eq('id', product.id);
        
        // Sign as User 2 to delete their product
        await supabase.auth.signInWithPassword({
            email: testEmail2,
            password: testPassword
        });
        
        await supabase.from('products').delete().eq('id', product2.id);
        
        console.log('✅ Test data cleaned up');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testRLSWithAuth();