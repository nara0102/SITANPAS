import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('🔔 REAL-TIME SUBSCRIPTIONS TEST')
console.log('============================================================')

async function testRealtimeSubscriptions() {
  try {
    // Create two separate clients for different users
    const client1 = createClient(supabaseUrl, supabaseAnonKey)
    const client2 = createClient(supabaseUrl, supabaseAnonKey)

    console.log('\n📝 Step 1: Authenticate User 1 (dede@nelayan.com)')
    const { data: user1Data, error: user1Error } = await client1.auth.signInWithPassword({
      email: 'dede@nelayan.com',
      password: 'password123'
    })

    if (user1Error) {
      console.log('❌ User 1 authentication failed:', user1Error.message)
      return
    }
    console.log('✅ User 1 authenticated:', user1Data.user?.id)

    console.log('\n📝 Step 2: Authenticate User 2 (Create new user)')
    const testEmail = `test_realtime_${Date.now()}@example.com`
    const { data: user2Data, error: user2Error } = await client2.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          role: 'nelayan',
          nama: 'Test Nelayan 2',
          no_hp: '081234567891'
        }
      }
    })

    if (user2Error) {
      console.log('❌ User 2 creation failed:', user2Error.message)
      return
    }
    console.log('✅ User 2 created:', user2Data.user?.id)

    // Set up real-time subscriptions
    console.log('\n📝 Step 3: Setting up Real-time Subscriptions')
    
    let user1Notifications = []
    let user2Notifications = []

    // User 1 subscription for orders
    const subscription1 = client1
      .channel('orders_user1')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `produk_id=in.(${await getUserProducts(client1)})`
        }, 
        (payload) => {
          user1Notifications.push({
            user: 'user1',
            event: payload.eventType,
            data: payload.new || payload.old,
            timestamp: new Date().toISOString()
          })
          console.log('🔔 User 1 received notification:', payload.eventType)
        }
      )
      .subscribe()

    // User 2 subscription for orders
    const subscription2 = client2
      .channel('orders_user2')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `produk_id=in.(${await getUserProducts(client2)})`
        }, 
        (payload) => {
          user2Notifications.push({
            user: 'user2',
            event: payload.eventType,
            data: payload.new || payload.old,
            timestamp: new Date().toISOString()
          })
          console.log('🔔 User 2 received notification:', payload.eventType)
        }
      )
      .subscribe()

    // Wait for subscriptions to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('\n📝 Step 4: Create Product for User 1')
    const { data: product1, error: product1Error } = await client1
      .from('products')
      .insert({
        nama_produk: 'Test Product User 1',
        deskripsi: 'Real-time test product',
        harga: 75000,
        stok: 20,
        kategori: 'ikan_segar',
        unit_type: 'kg'
      })
      .select()

    if (product1Error) {
      console.log('❌ Product creation failed:', product1Error.message)
    } else {
      console.log('✅ Product created for User 1:', product1[0]?.id)
    }

    console.log('\n📝 Step 5: Create Product for User 2')
    const { data: product2, error: product2Error } = await client2
      .from('products')
      .insert({
        nama_produk: 'Test Product User 2',
        deskripsi: 'Real-time test product',
        harga: 85000,
        stok: 15,
        kategori: 'ikan_segar',
        unit_type: 'kg'
      })
      .select()

    if (product2Error) {
      console.log('❌ Product creation failed:', product2Error.message)
    } else {
      console.log('✅ Product created for User 2:', product2[0]?.id)
    }

    // Wait a bit for real-time to process
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('\n📝 Step 6: Create Order for User 1\'s Product')
    if (product1 && product1[0]) {
      const { data: order1, error: order1Error } = await client1
        .from('orders')
        .insert({
          produk_id: product1[0].id,
          nama_pembeli: 'Test Buyer 1',
          no_hp_pembeli: '081234567892',
          alamat_pembeli: 'Test Address 1',
          jumlah: 5,
          total_harga: 375000,
          catatan: 'Real-time test order'
        })
        .select()

      if (order1Error) {
        console.log('❌ Order creation failed:', order1Error.message)
      } else {
        console.log('✅ Order created for User 1\'s product:', order1[0]?.id)
      }
    }

    console.log('\n📝 Step 7: Create Order for User 2\'s Product')
    if (product2 && product2[0]) {
      const { data: order2, error: order2Error } = await client2
        .from('orders')
        .insert({
          produk_id: product2[0].id,
          nama_pembeli: 'Test Buyer 2',
          no_hp_pembeli: '081234567893',
          alamat_pembeli: 'Test Address 2',
          jumlah: 3,
          total_harga: 255000,
          catatan: 'Real-time test order'
        })
        .select()

      if (order2Error) {
        console.log('❌ Order creation failed:', order2Error.message)
      } else {
        console.log('✅ Order created for User 2\'s product:', order2[0]?.id)
      }
    }

    // Wait for real-time notifications
    await new Promise(resolve => setTimeout(resolve, 3000))

    console.log('\n📊 REAL-TIME NOTIFICATION RESULTS')
    console.log('============================================================')
    console.log(`🔔 User 1 received ${user1Notifications.length} notifications:`)
    user1Notifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.event} at ${notif.timestamp}`)
    })

    console.log(`🔔 User 2 received ${user2Notifications.length} notifications:`)
    user2Notifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.event} at ${notif.timestamp}`)
    })

    // Analyze isolation
    const crossNotifications = user1Notifications.filter(n => 
      user2Notifications.some(n2 => n2.data?.id === n.data?.id)
    )

    if (crossNotifications.length > 0) {
      console.log('❌ ISOLATION BREACH: Users received notifications for each other\'s data!')
    } else {
      console.log('✅ ISOLATION WORKING: Users only received their own notifications')
    }

    // Cleanup subscriptions
    subscription1.unsubscribe()
    subscription2.unsubscribe()

    console.log('\n🏁 Real-time Subscriptions Test Complete')
    console.log('============================================================')

  } catch (error) {
    console.error('❌ Real-time test error:', error.message)
  }
}

async function getUserProducts(client) {
  try {
    const { data: products } = await client
      .from('products')
      .select('id')
    
    return products?.map(p => p.id).join(',') || ''
  } catch (error) {
    return ''
  }
}

testRealtimeSubscriptions()