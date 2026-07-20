import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('🔔 SIMPLIFIED REAL-TIME TEST')
console.log('============================================================')

async function testRealtimeSimple() {
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey)

    console.log('\n📝 Step 1: Create and Authenticate Test User')
    const testEmail = `realtime_test_${Date.now()}@example.com`
    const { data: userData, error: userError } = await client.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          role: 'nelayan',
          nama: 'Realtime Test User',
          no_hp: '081234567890'
        }
      }
    })

    if (userError) {
      console.log('❌ User creation failed:', userError.message)
      return
    }
    console.log('✅ User created and authenticated:', userData.user?.id)

    console.log('\n📝 Step 2: Create Test Product')
    const { data: product, error: productError } = await client
      .from('products')
      .insert({
        nama_produk: 'Realtime Test Product',
        deskripsi: 'Testing real-time notifications',
        harga: 100000,
        stok: 25,
        kategori: 'ikan_segar',
        unit_type: 'kg'
      })
      .select()

    if (productError) {
      console.log('❌ Product creation failed:', productError.message)
      return
    }
    console.log('✅ Product created:', product[0]?.id)

    console.log('\n📝 Step 3: Set up Real-time Subscription')
    let notifications = []
    
    const subscription = client
      .channel('orders_realtime_test')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders'
        }, 
        (payload) => {
          notifications.push({
            event: payload.eventType,
            data: payload.new || payload.old,
            timestamp: new Date().toISOString()
          })
          console.log(`🔔 Received ${payload.eventType} notification for order:`, payload.new?.id || payload.old?.id)
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status)
      })

    // Wait for subscription to be ready
    await new Promise(resolve => setTimeout(resolve, 3000))

    console.log('\n📝 Step 4: Create Order (Should trigger notification)')
    const { data: order, error: orderError } = await client
      .from('orders')
      .insert({
        produk_id: product[0].id,
        customer_nama: 'Test Buyer',
        customer_telpon: '081234567891',
        customer_alamat: 'Test Address',
        jumlah: 2,
        harga_satuan: 100000,
        total_harga: 200000,
        catatan: 'Real-time test order'
      })
      .select()

    if (orderError) {
      console.log('❌ Order creation failed:', orderError.message)
    } else {
      console.log('✅ Order created:', order[0]?.id)
    }

    console.log('\n📝 Step 5: Update Order Status (Should trigger notification)')
    if (order && order[0]) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const { data: updatedOrder, error: updateError } = await client
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', order[0].id)
        .select()

      if (updateError) {
        console.log('❌ Order update failed:', updateError.message)
      } else {
        console.log('✅ Order updated:', updatedOrder[0]?.id)
      }
    }

    // Wait for notifications
    await new Promise(resolve => setTimeout(resolve, 3000))

    console.log('\n📊 REAL-TIME RESULTS')
    console.log('============================================================')
    console.log(`🔔 Total notifications received: ${notifications.length}`)
    
    notifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.event} at ${notif.timestamp}`)
      console.log(`      Order ID: ${notif.data?.id}`)
      console.log(`      Status: ${notif.data?.status}`)
    })

    if (notifications.length > 0) {
      console.log('✅ Real-time notifications are working!')
    } else {
      console.log('❌ No real-time notifications received - check configuration')
    }

    // Test subscription filtering
    console.log('\n📝 Step 6: Test Subscription Filtering')
    console.log('Creating order for different product to test filtering...')
    
    // Create another product by different user (simulate)
    const { data: otherProduct, error: otherProductError } = await client
      .from('products')
      .insert({
        nama_produk: 'Other Product',
        deskripsi: 'Should not trigger our subscription',
        harga: 50000,
        stok: 10,
        kategori: 'ikan_segar',
        unit_type: 'kg'
      })
      .select()

    if (!otherProductError && otherProduct[0]) {
      // Create order for other product
      const { data: otherOrder } = await client
        .from('orders')
        .insert({
          produk_id: otherProduct[0].id,
          customer_nama: 'Other Buyer',
          customer_telpon: '081234567892',
          customer_alamat: 'Other Address',
          jumlah: 1,
          harga_satuan: 50000,
          total_harga: 50000,
          catatan: 'Should trigger notification (no filtering yet)'
        })
        .select()

      console.log('✅ Created order for other product:', otherOrder?.[0]?.id)
    }

    // Wait for potential notifications
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log(`🔔 Final notification count: ${notifications.length}`)

    // Cleanup
    subscription.unsubscribe()

    console.log('\n🏁 Simplified Real-time Test Complete')
    console.log('============================================================')

  } catch (error) {
    console.error('❌ Real-time test error:', error.message)
  }
}

testRealtimeSimple()