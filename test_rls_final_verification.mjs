import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

console.log('🔐 FINAL RLS VERIFICATION TEST');
console.log('=' .repeat(60));
console.log('🔑 Using ANON KEY (should respect RLS)');
console.log('🔑 Key preview:', supabaseAnonKey.substring(0, 20) + '...');

async function testRLSFinalVerification() {
    // Create client with ANON key only
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
        console.log('\n📝 Test 1: Unauthenticated Access (Should be BLOCKED)');
        
        // Test unauthenticated SELECT
        const { data: products, error: selectError } = await supabase
            .from('products')
            .select('*')
            .limit(3);
            
        if (selectError) {
            console.log('✅ Unauthenticated SELECT blocked:', selectError.message);
        } else {
            console.log('❌ Unauthenticated SELECT allowed! Found', products?.length || 0, 'products');
            console.log('   This indicates RLS SELECT policy is NOT working');
        }
        
        // Test unauthenticated INSERT
        const { data: insertData, error: insertError } = await supabase
            .from('products')
            .insert({
                nama_produk: 'Unauthorized Product',
                deskripsi: 'This should fail',
                harga: 10000,
                stok: 1,
                kategori: 'test',
                nelayan_id: '00000000-0000-0000-0000-000000000000'
            });
            
        if (insertError) {
            console.log('✅ Unauthenticated INSERT blocked:', insertError.message);
        } else {
            console.log('❌ Unauthenticated INSERT allowed!', insertData);
        }
        
        console.log('\n📝 Test 2: Authenticated User Tests');
        
        // Create and authenticate user
        const testEmail = `rls-final-test-${Date.now()}@example.com`;
        const testPassword = 'TestPassword123!';
        
        console.log('   Creating test user...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword,
            options: {
                data: {
                    role: 'nelayan',
                    nama: 'RLS Final Test User'
                }
            }
        });
        
        if (signUpError) {
            console.error('❌ Failed to create user:', signUpError.message);
            return;
        }
        
        console.log('   Signing in user...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });
        
        if (signInError) {
            console.error('❌ Failed to sign in:', signInError.message);
            return;
        }
        
        const userId = signInData.user.id;
        console.log('✅ User authenticated:', userId);
        
        // Test authenticated SELECT
        console.log('   Testing authenticated SELECT...');
        const { data: authProducts, error: authSelectError } = await supabase
            .from('products')
            .select('*')
            .limit(3);
            
        if (authSelectError) {
            console.log('❌ Authenticated SELECT failed:', authSelectError.message);
        } else {
            console.log('✅ Authenticated SELECT successful, found', authProducts?.length || 0, 'products');
        }
        
        // Test authenticated INSERT
        console.log('   Testing authenticated INSERT...');
        const { data: authInsertData, error: authInsertError } = await supabase
            .from('products')
            .insert({
                nama_produk: 'Authenticated Product',
                deskripsi: 'Created by authenticated user',
                harga: 25000,
                stok: 5,
                kategori: 'ikan_segar',
                nelayan_id: userId
            })
            .select()
            .single();
            
        if (authInsertError) {
            console.log('❌ Authenticated INSERT failed:', authInsertError.message);
        } else {
            console.log('✅ Authenticated INSERT successful:', authInsertData.id);
            
            console.log('\n📝 Test 3: Cross-User Access Prevention');
            
            // Create second user
            const testEmail2 = `rls-final-test-2-${Date.now()}@example.com`;
            
            console.log('   Creating second user...');
            const { data: signUpData2, error: signUpError2 } = await supabase.auth.signUp({
                email: testEmail2,
                password: testPassword,
                options: {
                    data: {
                        role: 'nelayan',
                        nama: 'RLS Final Test User 2'
                    }
                }
            });
            
            if (signUpError2) {
                console.error('❌ Failed to create second user:', signUpError2.message);
                return;
            }
            
            console.log('   Signing in second user...');
            const { data: signInData2, error: signInError2 } = await supabase.auth.signInWithPassword({
                email: testEmail2,
                password: testPassword
            });
            
            if (signInError2) {
                console.error('❌ Failed to sign in second user:', signInError2.message);
                return;
            }
            
            const userId2 = signInData2.user.id;
            console.log('✅ Second user authenticated:', userId2);
            
            // Test cross-user UPDATE
            console.log('   Testing cross-user UPDATE (should be BLOCKED)...');
            const { data: crossUpdateData, error: crossUpdateError } = await supabase
                .from('products')
                .update({
                    nama_produk: 'HACKED BY USER 2!',
                    harga: 999999
                })
                .eq('id', authInsertData.id)
                .select();
                
            if (crossUpdateError) {
                console.log('✅ Cross-user UPDATE blocked:', crossUpdateError.message);
            } else {
                console.log('❌ Cross-user UPDATE allowed!', crossUpdateData);
                console.log('   🚨 CRITICAL SECURITY ISSUE: RLS UPDATE policy not working!');
            }
            
            // Clean up
            console.log('\n🧹 Cleaning up test data...');
            await supabase.from('products').delete().eq('id', authInsertData.id);
            console.log('✅ Test data cleaned up');
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

console.log('\n🚀 Starting RLS Final Verification...');
testRLSFinalVerification()
    .then(() => {
        console.log('\n🏁 RLS Final Verification Complete');
        console.log('=' .repeat(60));
    })
    .catch(error => {
        console.error('❌ Final verification failed:', error);
    });