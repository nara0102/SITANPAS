import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('🔐 COMPREHENSIVE RLS SECURITY TEST')
console.log('============================================================')
console.log(`🔑 Using URL: ${supabaseUrl}`)
console.log(`🔑 Using ANON KEY: ${supabaseAnonKey.substring(0, 20)}...`)

async function testRLSSecurity() {
  try {
    console.log('\n📝 Test 1: Unauthenticated Product Access')
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
    
    if (productError) {
      console.log('✅ Unauthenticated product access properly blocked:', productError.message)
    } else {
      console.log(`❌ Unauthenticated access allowed! Found ${products?.length || 0} products`)
      if (products && products.length > 0) {
        console.log('   Sample product:', products[0])
      }
    }

    console.log('\n📝 Test 2: Unauthenticated Order Access')
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('*')
    
    if (orderError) {
      console.log('✅ Unauthenticated order access properly blocked:', orderError.message)
    } else {
      console.log(`❌ Unauthenticated order access allowed! Found ${orders?.length || 0} orders`)
    }

    console.log('\n📝 Test 3: Create Test User and Authenticate')
    const testEmail = `test_${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'
    
    // Try to sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          role: 'nelayan',
          nama: 'Test Nelayan',
          no_hp: '081234567890'
        }
      }
    })

    if (signUpError) {
      console.log('⚠️  Sign up failed:', signUpError.message)
      
      // Try to sign in with existing user
      console.log('\n📝 Test 4: Sign in with existing credentials')
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'dede@nelayan.com',
        password: 'password123'
      })

      if (signInError) {
        console.log('❌ Sign in failed:', signInError.message)
        return
      } else {
        console.log('✅ Signed in successfully:', signInData.user?.id)
      }
    } else {
      console.log('✅ User created successfully:', signUpData.user?.id)
    }

    console.log('\n📝 Test 5: Authenticated Product Access')
    const { data: authProducts, error: authProductError } = await supabase
      .from('products')
      .select('*')
    
    if (authProductError) {
      console.log('❌ Authenticated product access failed:', authProductError.message)
    } else {
      console.log(`✅ Authenticated access successful: ${authProducts?.length || 0} products`)
    }

    console.log('\n📝 Test 6: Try to Create Product')
    const { data: newProduct, error: createError } = await supabase
      .from('products')
      .insert({
        nama_produk: 'Test Product Security',
        deskripsi: 'Testing RLS security',
        harga: 50000,
        stok: 10,
        kategori: 'ikan_segar',
        unit_type: 'kg'
      })
      .select()

    if (createError) {
      console.log('⚠️  Product creation failed:', createError.message)
    } else {
      console.log('✅ Product created successfully:', newProduct?.[0]?.id)
    }

    console.log('\n📝 Test 7: Check Current User Session')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (user) {
      console.log('✅ Current user:', user.id, user.email)
      
      // Test user-specific data access
      console.log('\n📝 Test 8: User-specific Product Access')
      const { data: userProducts, error: userProductError } = await supabase
        .from('products')
        .select('*')
        .eq('nelayan_id', user.id)
      
      if (userProductError) {
        console.log('❌ User product access failed:', userProductError.message)
      } else {
        console.log(`✅ User has ${userProducts?.length || 0} products`)
      }
    } else {
      console.log('❌ No authenticated user found')
    }

    console.log('\n🏁 RLS Security Test Complete')
    console.log('============================================================')
    
  } catch (error) {
    console.error('❌ Test error:', error.message)
  }
}

testRLSSecurity()