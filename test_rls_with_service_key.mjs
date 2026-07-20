import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

console.log('🔍 Testing RLS with Different Client Configurations');
console.log('=' .repeat(60));

async function testWithAnonKey() {
    console.log('\n📝 Test 1: Using ANON KEY (should respect RLS)');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
        // Test 1: Try to access products without authentication
        console.log('   Testing unauthenticated access...');
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .limit(5);
            
        if (error) {
            console.log('   ✅ Unauthenticated access blocked:', error.message);
        } else {
            console.log(`   ⚠️  Unauthenticated access allowed, found ${products?.length || 0} products`);
        }
        
        // Test 2: Try to create product without authentication
        console.log('   Testing unauthenticated product creation...');
        const { data: newProduct, error: createError } = await supabase
            .from('products')
            .insert({
                nama_produk: 'Unauthorized Product',
                deskripsi: 'This should fail',
                harga: 10000,
                stok: 1,
                kategori: 'test',
                nelayan_id: '00000000-0000-0000-0000-000000000000'
            });
            
        if (createError) {
            console.log('   ✅ Unauthenticated creation blocked:', createError.message);
        } else {
            console.log('   ❌ Unauthenticated creation allowed!', newProduct);
        }
        
    } catch (error) {
        console.error('   Error in anon key test:', error.message);
    }
}

async function testWithServiceKey() {
    if (!supabaseServiceKey) {
        console.log('\n📝 Test 2: SKIPPED - No service key available');
        return;
    }
    
    console.log('\n📝 Test 2: Using SERVICE KEY (bypasses RLS)');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    try {
        // Test with service key - should bypass RLS
        console.log('   Testing service key access...');
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .limit(5);
            
        if (error) {
            console.log('   ❌ Service key access failed:', error.message);
        } else {
            console.log(`   ✅ Service key bypassed RLS, found ${products?.length || 0} products`);
        }
        
    } catch (error) {
        console.error('   Error in service key test:', error.message);
    }
}

async function testAuthenticatedAccess() {
    console.log('\n📝 Test 3: Testing Authenticated Access with ANON KEY');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
        // Create a test user
        const testEmail = `rls-test-${Date.now()}@example.com`;
        const testPassword = 'TestPassword123!';
        
        console.log('   Creating test user...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword,
            options: {
                data: {
                    role: 'nelayan',
                    nama: 'RLS Test User'
                }
            }
        });
        
        if (signUpError) {
            console.error('   ❌ Failed to create test user:', signUpError.message);
            return;
        }
        
        console.log('   ✅ Test user created, signing in...');
        
        // Sign in the user
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });
        
        if (signInError) {
            console.error('   ❌ Failed to sign in:', signInError.message);
            return;
        }
        
        console.log('   ✅ User signed in successfully');
        
        // Test authenticated access
        console.log('   Testing authenticated product access...');
        const { data: products, error: accessError } = await supabase
            .from('products')
            .select('*')
            .limit(5);
            
        if (accessError) {
            console.log('   ❌ Authenticated access failed:', accessError.message);
        } else {
            console.log(`   ✅ Authenticated access successful, found ${products?.length || 0} products`);
        }
        
        // Test creating product as authenticated user
        console.log('   Testing authenticated product creation...');
        const { data: newProduct, error: createError } = await supabase
            .from('products')
            .insert({
                nama_produk: 'Authenticated Product',
                deskripsi: 'Created by authenticated user',
                harga: 25000,
                stok: 5,
                kategori: 'ikan_segar',
                nelayan_id: signInData.user.id
            })
            .select()
            .single();
            
        if (createError) {
            console.log('   ❌ Authenticated creation failed:', createError.message);
        } else {
            console.log('   ✅ Authenticated creation successful:', newProduct.id);
            
            // Clean up - delete the test product
            await supabase.from('products').delete().eq('id', newProduct.id);
        }
        
    } catch (error) {
        console.error('   Error in authenticated test:', error.message);
    }
}

async function runAllTests() {
    await testWithAnonKey();
    await testWithServiceKey();
    await testAuthenticatedAccess();
    
    console.log('\n🏁 RLS Testing Complete');
    console.log('=' .repeat(60));
}

runAllTests();