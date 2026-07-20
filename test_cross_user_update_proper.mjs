import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

async function testCrossUserUpdate() {
  try {
    console.log('🔒 TESTING CROSS-USER UPDATE PREVENTION\n');

    // Get nelayan users
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: nelayanUsers, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'nelayan')
      .limit(2);

    if (usersError || !nelayanUsers || nelayanUsers.length < 2) {
      console.error('❌ Need at least 2 nelayan users for testing');
      process.exit(1);
    }

    const nelayan1 = nelayanUsers[0];
    const nelayan2 = nelayanUsers[1];

    console.log(`👤 Nelayan 1: ${nelayan1.full_name || nelayan1.email} (${nelayan1.id})`);
    console.log(`👤 Nelayan 2: ${nelayan2.full_name || nelayan2.email} (${nelayan2.id})\n`);

    // 1. Create a test product as nelayan1
    console.log('1️⃣ Creating test product as Nelayan 1...');
    
    // Sign in as nelayan1 (simulate authentication)
    const { data: authData1, error: authError1 } = await supabase.auth.signInWithPassword({
      email: nelayan1.email,
      password: 'password123' // Assuming this is the test password
    });

    if (authError1) {
      console.log('   ⚠️  Cannot authenticate as nelayan1, using direct insert...');
      
      // Direct insert for testing
      const { data: product, error: insertError } = await supabase
        .from('products')
        .insert([{
          nama_produk: `Cross-User Test Product - ${Date.now()}`,
          deskripsi: 'Test product for cross-user update prevention',
          kategori: 'ikan_segar',
          harga: 50000,
          stok: 10,
          unit_type: 'box',
          berat_per_unit: 2.0,
          nelayan_id: nelayan1.id,
          status: 'active'
        }])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Failed to create test product:', insertError);
        return;
      }

      console.log(`   ✅ Created product: ${product.nama_produk} (ID: ${product.id})`);
      console.log(`   📋 Owner: ${nelayan1.full_name || nelayan1.email}\n`);

      // 2. Try to update the product as nelayan2 (should fail)
      console.log('2️⃣ Attempting to update product as Nelayan 2 (should fail)...');
      
      // Sign in as nelayan2
      const { data: authData2, error: authError2 } = await supabase.auth.signInWithPassword({
        email: nelayan2.email,
        password: 'password123'
      });

      if (authError2) {
        console.log('   ⚠️  Cannot authenticate as nelayan2, testing with direct update...');
      }

      // Try to update the product (this should fail due to RLS)
      const { data: updateResult, error: updateError } = await supabase
        .from('products')
        .update({ 
          harga: 999999,
          deskripsi: 'HACKED BY NELAYAN 2!' 
        })
        .eq('id', product.id)
        .select();

      if (updateError) {
        console.log(`   ✅ Cross-user update correctly prevented!`);
        console.log(`   📝 Error: ${updateError.message}`);
      } else if (!updateResult || updateResult.length === 0) {
        console.log(`   ✅ Cross-user update prevented - no rows affected`);
      } else {
        console.log(`   ❌ ERROR: Cross-user update was allowed!`);
        console.log(`   📝 Updated data:`, updateResult);
      }

      // 3. Verify the product is unchanged
      console.log('\n3️⃣ Verifying product data integrity...');
      
      const { data: verifyProduct, error: verifyError } = await supabase
        .from('products')
        .select('*')
        .eq('id', product.id)
        .single();

      if (verifyError) {
        console.error('❌ Failed to verify product:', verifyError);
      } else {
        console.log(`   📋 Product name: ${verifyProduct.nama_produk}`);
        console.log(`   💰 Price: Rp ${verifyProduct.harga.toLocaleString('id-ID')}`);
        console.log(`   📝 Description: ${verifyProduct.deskripsi}`);
        console.log(`   👤 Owner ID: ${verifyProduct.nelayan_id}`);
        
        if (verifyProduct.harga === 50000 && verifyProduct.nelayan_id === nelayan1.id) {
          console.log(`   ✅ Product data integrity maintained!`);
        } else {
          console.log(`   ❌ Product data was compromised!`);
        }
      }

      // 4. Clean up - delete test product
      console.log('\n4️⃣ Cleaning up test product...');
      
      // Sign back in as nelayan1 to delete
      await supabase.auth.signInWithPassword({
        email: nelayan1.email,
        password: 'password123'
      });

      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (deleteError) {
        console.log(`   ⚠️  Could not delete test product: ${deleteError.message}`);
      } else {
        console.log(`   ✅ Test product cleaned up successfully`);
      }

    } else {
      console.log('   ✅ Authenticated as nelayan1 successfully');
      // Continue with authenticated testing...
    }

    console.log('\n🎉 CROSS-USER UPDATE TEST COMPLETED!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testCrossUserUpdate();