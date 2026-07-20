import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('🔒 COMPREHENSIVE CROSS-USER ISOLATION TEST')
console.log('============================================================')

async function testCrossUserIsolation() {
  try {
    // Create separate clients for different users
    const client1 = createClient(supabaseUrl, supabaseAnonKey)
    const client2 = createClient(supabaseUrl, supabaseAnonKey)

    console.log('\n📝 Step 1: Create and Authenticate User 1')
    const user1Email = `isolation_user1_${Date.now()}@example.com`
    const { data: user1Data, error: user1Error } = await client1.auth.signUp({
      email: user1Email,
      password: 'TestPassword123!',
      options: {
        data: {
          role: 'nelayan',
          nama: 'Nelayan User 1',
          no_hp: '081234567890'
        }
      }
    })

    if (user1Error) {
      console.log('❌ User 1 creation failed:', user1Error.message)
      return
    }
    console.log('✅ User 1 created:', user1Data.user?.id)

    console.log('\n📝 Step 2: Create and Authenticate User 2')
    const user2Email = `isolation_user2_${Date.now()}@example.com`
    const { data: user2Data, error: user2Error } = await client2.auth.signUp({
      email: user2Email,
      password: 'TestPassword123!',
      options: {
        data: {
          role: 'nelayan',
          nama: 'Nelayan User 2',
          no_hp: '081234567891'
        }
      }
    })

    if (user2Error) {
      console.log('❌ User 2 creation failed:', user2Error.message)
      return
    }
    console.log('✅ User 2 created:', user2Data.user?.id)

    console.log('\n📝 Step 3: User 1 Creates Products')
    const { data: user1Products, error: user1ProductError } = await client1
      .from('products')
      .insert([
        {
          nama_produk: 'User 1 Product A',
          deskripsi: 'Product by User 1',
          harga: 100000,
          stok: 10,
          kategori: 'ikan_segar',
          unit_type: 'kg'
        },
        {
          nama_produk: 'User 1 Product B',
          deskripsi: 'Another product by User 1',
          harga: 150000,
          stok: 5,
          kategori: 'ikan_segar',
          unit_type: 'kg'
        }
      ])
      .select()

    if (user1ProductError) {
      console.log('❌ User 1 product creation failed:', user1ProductError.message)
    } else {
      console.log(`✅ User 1 created ${user1Products.length} products`)
    }

    console.log('\n📝 Step 4: User 2 Creates Products')
    const { data: user2Products, error: user2ProductError } = await client2
      .from('products')
      .insert([
        {
          nama_produk: 'User 2 Product X',
          deskripsi: 'Product by User 2',
          harga: 200000,
          stok: 8,
          kategori: 'ikan_segar',
          unit_type: 'kg'
        },
        {
          nama_produk: 'User 2 Product Y',
          deskripsi: 'Another product by User 2',
          harga: 250000,
          stok: 3,
          kategori: 'ikan_segar',
          unit_type: 'kg'
        }
      ])
      .select()

    if (user2ProductError) {
      console.log('❌ User 2 product creation failed:', user2ProductError.message)
    } else {
      console.log(`✅ User 2 created ${user2Products.length} products`)
    }

    console.log('\n📝 Step 5: Test Product Visibility Isolation')
    
    // User 1 should only see their own products
    const { data: user1ViewProducts, error: user1ViewError } = await client1
      .from('products')
      .select('*')
      .eq('nelayan_id', user1Data.user.id)

    if (user1ViewError) {
      console.log('❌ User 1 product view failed:', user1ViewError.message)
    } else {
      console.log(`✅ User 1 can see ${user1ViewProducts.length} of their own products`)
    }

    // User 2 should only see their own products
    const { data: user2ViewProducts, error: user2ViewError } = await client2
      .from('products')
      .select('*')
      .eq('nelayan_id', user2Data.user.id)

    if (user2ViewError) {
      console.log('❌ User 2 product view failed:', user2ViewError.message)
    } else {
      console.log(`✅ User 2 can see ${user2ViewProducts.length} of their own products`)
    }

    console.log('\n📝 Step 6: Test Cross-User Product Access (Should FAIL)')
    
    // User 1 tries to access User 2's products
    const { data: user1CrossAccess, error: user1CrossError } = await client1
      .from('products')
      .select('*')
      .eq('nelayan_id', user2Data.user.id)

    if (user1CrossError) {
      console.log('✅ User 1 correctly blocked from accessing User 2 products:', user1CrossError.message)
    } else {
      console.log(`❌ SECURITY BREACH: User 1 can access ${user1CrossAccess.length} of User 2's products!`)
    }

    console.log('\n📝 Step 7: Test Cross-User Product Modification (Should FAIL)')
    
    if (user2Products && user2Products[0]) {
      const { data: hackAttempt, error: hackError } = await client1
        .from('products')
        .update({ nama_produk: 'HACKED BY USER 1!' })
        .eq('id', user2Products[0].id)
        .select()

      if (hackError) {
        console.log('✅ User 1 correctly blocked from modifying User 2 products:', hackError.message)
      } else {
        console.log('❌ CRITICAL SECURITY BREACH: User 1 can modify User 2 products!')
        console.log('   Modified product:', hackAttempt[0])
      }
    }

    console.log('\n📝 Step 8: Create Orders and Test Order Isolation')
    
    // Create orders for each user's products
    if (user1Products && user1Products[0]) {
      const { data: order1, error: order1Error } = await client1
        .from('orders')
        .insert({
          produk_id: user1Products[0].id,
          customer_nama: 'Customer for User 1',
          customer_telpon: '081234567892',
          customer_alamat: 'Address for User 1 order',
          jumlah: 2,
          harga_satuan: user1Products[0].harga,
          total_harga: user1Products[0].harga * 2,
          catatan: 'Order for User 1 product'
        })
        .select()

      if (order1Error) {
        console.log('❌ Order creation for User 1 failed:', order1Error.message)
      } else {
        console.log('✅ Order created for User 1 product:', order1[0]?.id)
      }
    }

    if (user2Products && user2Products[0]) {
      const { data: order2, error: order2Error } = await client2
        .from('orders')
        .insert({
          produk_id: user2Products[0].id,
          customer_nama: 'Customer for User 2',
          customer_telpon: '081234567893',
          customer_alamat: 'Address for User 2 order',
          jumlah: 1,
          harga_satuan: user2Products[0].harga,
          total_harga: user2Products[0].harga * 1,
          catatan: 'Order for User 2 product'
        })
        .select()

      if (order2Error) {
        console.log('❌ Order creation for User 2 failed:', order2Error.message)
      } else {
        console.log('✅ Order created for User 2 product:', order2[0]?.id)
      }
    }

    console.log('\n📝 Step 9: Test Order Visibility Isolation')
    
    // User 1 should only see orders for their products
    const { data: user1Orders, error: user1OrderError } = await client1
      .from('orders')
      .select(`
        *,
        products!inner(nelayan_id)
      `)
      .eq('products.nelayan_id', user1Data.user.id)

    if (user1OrderError) {
      console.log('❌ User 1 order view failed:', user1OrderError.message)
    } else {
      console.log(`✅ User 1 can see ${user1Orders.length} orders for their products`)
    }

    // User 2 should only see orders for their products
    const { data: user2Orders, error: user2OrderError } = await client2
      .from('orders')
      .select(`
        *,
        products!inner(nelayan_id)
      `)
      .eq('products.nelayan_id', user2Data.user.id)

    if (user2OrderError) {
      console.log('❌ User 2 order view failed:', user2OrderError.message)
    } else {
      console.log(`✅ User 2 can see ${user2Orders.length} orders for their products`)
    }

    console.log('\n📊 ISOLATION TEST SUMMARY')
    console.log('============================================================')
    
    let isolationScore = 0
    let totalTests = 4

    // Check product creation isolation
    if (user1Products && user2Products) {
      isolationScore++
      console.log('✅ Product creation isolation: PASSED')
    } else {
      console.log('❌ Product creation isolation: FAILED')
    }

    // Check product visibility isolation
    if (user1ViewProducts && user2ViewProducts) {
      isolationScore++
      console.log('✅ Product visibility isolation: PASSED')
    } else {
      console.log('❌ Product visibility isolation: FAILED')
    }

    // Check cross-user access prevention
    if (user1CrossError) {
      isolationScore++
      console.log('✅ Cross-user access prevention: PASSED')
    } else {
      console.log('❌ Cross-user access prevention: FAILED')
    }

    // Check order isolation
    if (user1Orders && user2Orders) {
      isolationScore++
      console.log('✅ Order isolation: PASSED')
    } else {
      console.log('❌ Order isolation: FAILED')
    }

    console.log(`\n🎯 FINAL ISOLATION SCORE: ${isolationScore}/${totalTests} (${Math.round(isolationScore/totalTests*100)}%)`)
    
    if (isolationScore === totalTests) {
      console.log('🎉 EXCELLENT: All isolation tests passed!')
    } else if (isolationScore >= totalTests * 0.75) {
      console.log('⚠️  GOOD: Most isolation tests passed, minor issues detected')
    } else {
      console.log('🚨 CRITICAL: Major isolation failures detected - SECURITY RISK!')
    }

    console.log('\n🏁 Cross-User Isolation Test Complete')
    console.log('============================================================')

  } catch (error) {
    console.error('❌ Cross-user isolation test error:', error.message)
  }
}

testCrossUserIsolation()