import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bdpycyvqacnobyirqzpm.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase configuration')
    process.exit(1)
}

console.log('🔧 DATABASE TRIGGERS & FUNCTIONS TEST')
console.log('=' .repeat(50))

// Create authenticated client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test 1: User Profile Creation Trigger
console.log('\n📋 TEST 1: User Profile Creation Trigger')

const testEmail = `trigger_test_${Date.now()}@test.com`
const testPassword = 'TestPassword123!'

try {
    // Create new user (should trigger profile creation)
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
            data: {
                role: 'nelayan',
                nama: 'Trigger Test User'
            }
        }
    })

    if (authError) {
        console.log('❌ User creation failed:', authError.message)
    } else {
        console.log('✅ User created successfully')
        
        // Wait for trigger to execute
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Sign in to check profile
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        })
        
        if (!signInError) {
            // Check if profile was created by trigger
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .single()
            
            if (profile) {
                console.log('✅ User profile created by trigger')
            } else {
                console.log('❌ User profile NOT created by trigger:', profileError?.message)
            }
        }
    }
} catch (error) {
    console.log('❌ User profile trigger test failed:', error.message)
}

// Test 2: Product Stock Reduction Trigger
console.log('\n📋 TEST 2: Product Stock Reduction Trigger')

try {
    // Create a product first
    const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
            nama_produk: 'Test Product for Trigger',
            deskripsi: 'Product to test stock reduction trigger',
            harga: 50000,
            stok: 10,
            kategori: 'test',
            status: 'active'
        })
        .select()
        .single()

    if (productError) {
        console.log('❌ Product creation failed:', productError.message)
    } else {
        console.log('✅ Test product created with stock:', product.stok)
        
        // Create an order (should trigger stock reduction)
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                customer_nama: 'Test Customer',
                customer_telpon: '081234567890',
                customer_alamat: 'Test Address',
                customer_email: 'test@example.com',
                produk_id: product.id,
                jumlah: 3,
                harga_satuan: product.harga,
                total_harga: product.harga * 3,
                status: 'pending'
            })
            .select()
            .single()

        if (orderError) {
            console.log('❌ Order creation failed:', orderError.message)
        } else {
            console.log('✅ Order created for quantity:', order.jumlah)
            
            // Wait for trigger to execute
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Check if stock was reduced
            const { data: updatedProduct, error: stockError } = await supabase
                .from('products')
                .select('stok')
                .eq('id', product.id)
                .single()
            
            if (updatedProduct) {
                const expectedStock = product.stok - order.jumlah
                if (updatedProduct.stok === expectedStock) {
                    console.log('✅ Stock reduction trigger working:', updatedProduct.stok)
                } else {
                    console.log('❌ Stock reduction trigger NOT working')
                    console.log('   Expected:', expectedStock, 'Actual:', updatedProduct.stok)
                }
            } else {
                console.log('❌ Could not check stock after order:', stockError?.message)
            }
        }
    }
} catch (error) {
    console.log('❌ Stock reduction trigger test failed:', error.message)
}

// Test 3: Transaction Creation Trigger
console.log('\n📋 TEST 3: Transaction Creation Trigger')

try {
    // Check if transaction was automatically created for the order
    const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

    if (transactions && transactions.length > 0) {
        console.log('✅ Transaction creation trigger working')
        console.log('   Latest transaction status:', transactions[0].status)
    } else {
        console.log('❌ Transaction creation trigger NOT working:', transError?.message)
    }
} catch (error) {
    console.log('❌ Transaction creation trigger test failed:', error.message)
}

// Test 4: Updated_at Trigger
console.log('\n📋 TEST 4: Updated_at Timestamp Trigger')

try {
    // Get current product
    const { data: currentProduct, error: getCurrentError } = await supabase
        .from('products')
        .select('updated_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (currentProduct) {
        const originalUpdatedAt = currentProduct.updated_at
        
        // Wait a moment then update the product
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const { error: updateError } = await supabase
            .from('products')
            .update({ deskripsi: 'Updated description for trigger test' })
            .order('created_at', { ascending: false })
            .limit(1)

        if (!updateError) {
            // Check if updated_at was changed by trigger
            const { data: updatedProduct, error: getUpdatedError } = await supabase
                .from('products')
                .select('updated_at')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (updatedProduct && updatedProduct.updated_at !== originalUpdatedAt) {
                console.log('✅ Updated_at trigger working')
            } else {
                console.log('❌ Updated_at trigger NOT working')
            }
        } else {
            console.log('❌ Product update failed:', updateError.message)
        }
    }
} catch (error) {
    console.log('❌ Updated_at trigger test failed:', error.message)
}

// Test 5: Order Status Change Trigger (Stock Restoration)
console.log('\n📋 TEST 5: Stock Restoration Trigger')

try {
    // Get the latest order and product
    const { data: latestOrder, error: orderError } = await supabase
        .from('orders')
        .select('*, products!inner(*)')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (latestOrder) {
        const currentStock = latestOrder.products.stok
        console.log('Current stock before cancellation:', currentStock)
        
        // Cancel the order (should trigger stock restoration)
        const { error: cancelError } = await supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', latestOrder.id)

        if (!cancelError) {
            // Wait for trigger to execute
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Check if stock was restored
            const { data: restoredProduct, error: stockError } = await supabase
                .from('products')
                .select('stok')
                .eq('id', latestOrder.produk_id)
                .single()

            if (restoredProduct) {
                const expectedStock = currentStock + latestOrder.jumlah
                if (restoredProduct.stok === expectedStock) {
                    console.log('✅ Stock restoration trigger working:', restoredProduct.stok)
                } else {
                    console.log('❌ Stock restoration trigger NOT working')
                    console.log('   Expected:', expectedStock, 'Actual:', restoredProduct.stok)
                }
            }
        } else {
            console.log('❌ Order cancellation failed:', cancelError.message)
        }
    }
} catch (error) {
    console.log('❌ Stock restoration trigger test failed:', error.message)
}

// Summary
console.log('\n' + '='.repeat(50))
console.log('🔧 DATABASE TRIGGERS TEST SUMMARY')
console.log('='.repeat(50))
console.log('✅ Tests completed - Review results above')
console.log('❌ Any failed triggers need investigation')
console.log('🔧 All triggers are critical for system functionality')

process.exit(0)