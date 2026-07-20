import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bdpycyvqacnobyirqzpm.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase configuration')
    console.error('URL:', supabaseUrl ? 'Present' : 'Missing')
    console.error('Key:', supabaseAnonKey ? 'Present' : 'Missing')
    process.exit(1)
}

console.log('🔒 FINAL RLS SECURITY TEST - COMPREHENSIVE VALIDATION')
console.log('=' .repeat(60))

// Test 1: Anonymous Access (Should be restricted)
console.log('\n📋 TEST 1: Anonymous Access Validation')
const anonClient = createClient(supabaseUrl, supabaseAnonKey)

try {
    // Test anonymous product access
    const { data: anonProducts, error: anonError } = await anonClient
        .from('products')
        .select('*')
    
    console.log('❌ SECURITY ISSUE: Anonymous can access products:', anonProducts?.length || 0)
    if (anonError) {
        console.log('✅ SECURE: Anonymous access blocked:', anonError.message)
    }
    
    // Test anonymous order creation
    const { data: anonOrder, error: anonOrderError } = await anonClient
        .from('orders')
        .insert({
            customer_nama: 'Test Customer',
            customer_telpon: '081234567890',
            customer_alamat: 'Test Address',
            customer_email: 'test@example.com',
            produk_id: '00000000-0000-0000-0000-000000000001',
            jumlah: 1,
            harga_satuan: 50000,
            total_harga: 50000,
            status: 'pending'
        })
        .select()
    
    if (anonOrderError) {
        console.log('✅ SECURE: Anonymous order creation blocked:', anonOrderError.message)
    } else {
        console.log('❌ SECURITY ISSUE: Anonymous can create orders')
    }
    
} catch (error) {
    console.log('✅ SECURE: Anonymous access properly restricted')
}

// Test 2: Create authenticated users for testing
console.log('\n📋 TEST 2: User Authentication & Role-based Access')

// Create first nelayan user
const user1Email = `nelayan1_${Date.now()}@test.com`
const user1Password = 'TestPassword123!'

const { data: user1Auth, error: user1AuthError } = await anonClient.auth.signUp({
    email: user1Email,
    password: user1Password,
    options: {
        data: {
            role: 'nelayan',
            nama: 'Nelayan Test 1'
        }
    }
})

if (user1AuthError) {
    console.log('❌ User 1 signup failed:', user1AuthError.message)
    process.exit(1)
}

// Create second nelayan user
const user2Email = `nelayan2_${Date.now()}@test.com`
const user2Password = 'TestPassword123!'

const { data: user2Auth, error: user2AuthError } = await anonClient.auth.signUp({
    email: user2Email,
    password: user2Password,
    options: {
        data: {
            role: 'nelayan',
            nama: 'Nelayan Test 2'
        }
    }
})

if (user2AuthError) {
    console.log('❌ User 2 signup failed:', user2AuthError.message)
    process.exit(1)
}

console.log('✅ Users created successfully')

// Wait for users to be confirmed
await new Promise(resolve => setTimeout(resolve, 2000))

// Create authenticated clients
const user1Client = createClient(supabaseUrl, supabaseAnonKey)
const user2Client = createClient(supabaseUrl, supabaseAnonKey)

// Sign in users
const { error: signIn1Error } = await user1Client.auth.signInWithPassword({
    email: user1Email,
    password: user1Password
})

const { error: signIn2Error } = await user2Client.auth.signInWithPassword({
    email: user2Email,
    password: user2Password
})

if (signIn1Error || signIn2Error) {
    console.log('❌ User authentication failed')
    process.exit(1)
}

console.log('✅ Users authenticated successfully')

// Test 3: Product Creation and Isolation
console.log('\n📋 TEST 3: Product Creation & Ownership Validation')

// User 1 creates a product
const { data: user1Product, error: product1Error } = await user1Client
    .from('products')
    .insert({
        nama_produk: 'Ikan Tuna User 1',
        deskripsi: 'Ikan tuna segar dari User 1',
        harga: 75000,
        stok: 10,
        kategori: 'ikan',
        status: 'active'
    })
    .select()

if (product1Error) {
    console.log('❌ User 1 product creation failed:', product1Error.message)
} else {
    console.log('✅ User 1 product created successfully')
}

// User 2 creates a product
const { data: user2Product, error: product2Error } = await user2Client
    .from('products')
    .insert({
        nama_produk: 'Udang Windu User 2',
        deskripsi: 'Udang windu segar dari User 2',
        harga: 120000,
        stok: 5,
        kategori: 'udang',
        status: 'active'
    })
    .select()

if (product2Error) {
    console.log('❌ User 2 product creation failed:', product2Error.message)
} else {
    console.log('✅ User 2 product created successfully')
}

// Test 4: Cross-User Product Access Prevention
console.log('\n📋 TEST 4: Cross-User Access Prevention')

if (user1Product && user2Product) {
    // User 1 tries to access User 2's product
    const { data: crossAccess1, error: crossError1 } = await user1Client
        .from('products')
        .select('*')
        .eq('id', user2Product[0].id)
    
    if (crossAccess1 && crossAccess1.length > 0) {
        console.log('❌ SECURITY ISSUE: User 1 can access User 2 product')
    } else {
        console.log('✅ SECURE: User 1 cannot access User 2 product')
    }
    
    // User 2 tries to modify User 1's product
    const { error: modifyError } = await user2Client
        .from('products')
        .update({ harga: 999999 })
        .eq('id', user1Product[0].id)
    
    if (modifyError) {
        console.log('✅ SECURE: User 2 cannot modify User 1 product:', modifyError.message)
    } else {
        console.log('❌ SECURITY ISSUE: User 2 can modify User 1 product')
    }
}

// Test 5: Own Product Visibility
console.log('\n📋 TEST 5: Own Product Visibility')

// User 1 checks own products
const { data: user1OwnProducts, error: ownError1 } = await user1Client
    .from('products')
    .select('*')

console.log('User 1 can see own products:', user1OwnProducts?.length || 0)

// User 2 checks own products
const { data: user2OwnProducts, error: ownError2 } = await user2Client
    .from('products')
    .select('*')

console.log('User 2 can see own products:', user2OwnProducts?.length || 0)

// Test 6: Order Creation and Access
console.log('\n📋 TEST 6: Order Security Validation')

if (user1Product && user1Product.length > 0) {
    // Create order for User 1's product
    const { data: orderData, error: orderError } = await user2Client
        .from('orders')
        .insert({
            customer_nama: 'Customer Test',
            customer_telpon: '081234567890',
            customer_alamat: 'Test Address',
            customer_email: 'customer@test.com',
            produk_id: user1Product[0].id,
            jumlah: 2,
            harga_satuan: user1Product[0].harga,
            total_harga: user1Product[0].harga * 2,
            status: 'pending'
        })
        .select()
    
    if (orderError) {
        console.log('❌ Order creation failed:', orderError.message)
    } else {
        console.log('✅ Order created successfully')
        
        // Test order visibility
        // User 1 (product owner) should see the order
        const { data: user1Orders, error: user1OrderError } = await user1Client
            .from('orders')
            .select('*')
        
        console.log('User 1 (product owner) can see orders:', user1Orders?.length || 0)
        
        // User 2 should NOT see orders for User 1's products
        const { data: user2Orders, error: user2OrderError } = await user2Client
            .from('orders')
            .select('*')
        
        console.log('User 2 can see orders:', user2Orders?.length || 0)
        
        if (user2Orders && user2Orders.length > 0) {
            console.log('❌ SECURITY ISSUE: User 2 can see orders for other users products')
        } else {
            console.log('✅ SECURE: User 2 cannot see orders for other users products')
        }
    }
}

// Test 7: Public Marketplace View (Active Products Only)
console.log('\n📋 TEST 7: Public Marketplace Validation')

// Test with authenticated user viewing marketplace
const { data: marketplaceProducts, error: marketplaceError } = await user1Client
    .from('products')
    .select('*')
    .eq('status', 'active')

console.log('Authenticated user can see active products:', marketplaceProducts?.length || 0)

// Summary
console.log('\n' + '='.repeat(60))
console.log('🔒 FINAL SECURITY TEST SUMMARY')
console.log('='.repeat(60))
console.log('✅ Test completed - Review results above for security issues')
console.log('❌ Any "SECURITY ISSUE" messages indicate vulnerabilities that need fixing')
console.log('✅ "SECURE" messages indicate proper access control')

process.exit(0)