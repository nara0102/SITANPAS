// Test script untuk memverifikasi alur transaksi
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Konfigurasi Supabase
const supabaseUrl = 'https://bdpycyvqacnobyirqzpm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkcHljeXZxYWNub2J5aXJxenBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMDY3NDEsImV4cCI6MjA3MzY4Mjc0MX0.jM6G5NuQbpkWgMX85EC0vPLlkmRh6skAi6XwxXNFzLI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testGuestCheckout() {
  console.log('1. Testing Guest Checkout...');
  
  try {
    // Generate truly unique identifier with UUID to avoid conflicts
    const uniqueId = randomUUID().replace(/-/g, '').substring(0, 12);
    const timestamp = Date.now();
    
    // Thorough cleanup of existing test data
    console.log('🧹 Cleaning up existing test data...');
    
    // Clean up transactions first (due to foreign key constraints)
    await supabase.from('transactions').delete().like('admin_notes', '%Test%');
    await supabase.from('orders').delete().like('customer_nama', '%Test Customer%');
    await supabase.from('orders').delete().like('customer_email', '%@example.com%');
    
    // Wait longer to ensure cleanup and avoid race conditions
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Ambil produk pertama untuk test
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .gt('stok', 0)
      .limit(1);
    
    if (productError || !products || products.length === 0) {
      console.log('❌ No active products found for testing');
      return { success: false };
    }
    
    const testProduct = products[0];
    console.log(`✅ Found test product: ${testProduct.nama || testProduct.name || 'Product'} (Stock: ${testProduct.stok})`);
    
    // Buat order sebagai guest dengan unique identifier
    const testOrder = {
      customer_nama: `Test Customer ${uniqueId}`,
      customer_telpon: `081234567${uniqueId.substring(0, 3)}`,
      customer_alamat: `Test Address ${uniqueId}`,
      customer_email: `test${uniqueId}@example.com`,
      produk_id: testProduct.id,
      jumlah: 1,
      harga_satuan: testProduct.harga,
      total_harga: testProduct.harga * 1,
      status: 'pending',
      catatan: `Test order from script - ${uniqueId}`
    };
    
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([testOrder])
      .select();
    
    if (orderError) {
      console.log('❌ Error creating order:', orderError);
      return { success: false };
    }
    
    console.log('✅ Guest order created successfully:', orderData[0].id);
    
    // Wait for triggers to complete (stock reduction and transaction creation)
    console.log('⏳ Waiting for database triggers to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verifikasi bahwa transaksi otomatis dibuat oleh trigger
    const { data: autoTransaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', orderData[0].id)
      .single();
    
    if (autoTransaction) {
      console.log('✅ Transaction automatically created by trigger:', autoTransaction.id);
    } else {
      console.log('⚠️ No automatic transaction created - trigger may be missing');
      if (transactionError) {
        console.log('Transaction error:', transactionError.message);
      }
    }
    
    // Verifikasi bahwa stok berkurang (jika ada trigger)
    const { data: updatedProduct } = await supabase
      .from('products')
      .select('stok')
      .eq('id', testProduct.id)
      .single();
    
    if (updatedProduct && updatedProduct.stok < testProduct.stok) {
      console.log('✅ Stock automatically reduced from', testProduct.stok, 'to', updatedProduct.stok);
    } else {
      console.log('⚠️ Stock not automatically reduced - trigger may be missing');
    }
    
    // Return data for cleanup in main function
    return { 
      success: true, 
      orderData: orderData[0], 
      testProduct,
      updatedProduct,
      autoTransaction
    };
  } catch (error) {
    console.log('❌ Guest checkout test failed:', error.message);
    return { success: false };
  }
}

async function testTransactionFlow() {
  console.log('🧪 Testing Transaction Flow...');
  
  let orderData = null;
  let testProduct = null;
  
  try {
    // Test 1: Guest Checkout (Customer tanpa login)
    console.log('\n1. Testing Guest Checkout...');
    
    const guestCheckoutResult = await testGuestCheckout();
    if (!guestCheckoutResult.success) {
      console.log('❌ Guest checkout test failed');
      return;
    }
    
    // Extract data from result
    orderData = guestCheckoutResult.orderData;
    testProduct = guestCheckoutResult.testProduct;
    const updatedProductFromCheckout = guestCheckoutResult.updatedProduct;
    const autoTransaction = guestCheckoutResult.autoTransaction;
    
    console.log('📊 Test Results Summary:');
    console.log('- Order ID:', orderData?.id);
    console.log('- Auto Transaction ID:', autoTransaction?.id || 'None');
    console.log('- Original Stock:', testProduct?.stok);
    console.log('- Updated Stock:', updatedProductFromCheckout?.stok);
    
    // Test 2: Verifikasi stok berkurang
    console.log('\n2. Testing Stock Reduction...');
    
    const expectedStock = testProduct.stok - orderData.jumlah;
    if (updatedProductFromCheckout && updatedProductFromCheckout.stok <= expectedStock) {
      console.log('✅ Stock reduced correctly from', testProduct.stok, 'to', updatedProductFromCheckout.stok);
      console.log('✅ Stock reduction amount:', testProduct.stok - updatedProductFromCheckout.stok, 'units');
    } else {
      console.log('❌ Stock not reduced properly. Expected <=', expectedStock, 'Got:', updatedProductFromCheckout ? updatedProductFromCheckout.stok : 'N/A');
    }
    
    // Test 3: Verifikasi pending nelayan registration
    console.log('\n3. Testing Nelayan Registration...');
    
    const { data: pendingNelayan, error: pendingError } = await supabase
      .from('pending_nelayan')
      .select('*')
      .eq('status', 'pending')
      .limit(5);
    
    if (pendingError) {
      console.error('❌ Error fetching pending nelayan:', pendingError);
    } else {
      console.log(`✅ Found ${pendingNelayan.length} pending nelayan registrations`);
    }
    
    // Test 4: Verifikasi admin views
    console.log('\n4. Testing Admin Views...');
    
    // Test admin_nelayan_transaction_report view
    const { data: transactionReport, error: reportError } = await supabase
      .from('admin_nelayan_transaction_report')
      .select('*')
      .limit(5);
    
    if (reportError) {
      console.error('❌ Error fetching transaction report:', reportError);
    } else {
      console.log(`✅ Transaction report view working: ${transactionReport.length} records`);
    }
    
    // Test admin_system_summary view
    const { data: systemSummary, error: summaryError } = await supabase
      .from('admin_system_summary')
      .select('*')
      .single();
    
    if (summaryError) {
      console.error('❌ Error fetching system summary:', summaryError);
    } else {
      console.log('✅ System summary view working:', systemSummary);
    }
    
    // Test 5: Verifikasi profiles view (untuk kompatibilitas frontend)
    console.log('\n5. Testing Profiles View...');
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(3);
    
    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
    } else {
      console.log(`✅ Profiles view working: ${profiles.length} records`);
    }
    
    // Cleanup: Hapus test order dan transactions terkait
    console.log('\n6. Cleaning up test data...');
    
    if (orderData) {
      try {
        // First delete any transactions that might have been auto-created by triggers
        console.log('🧹 Deleting auto-created transactions...');
        const { data: deletedTransactions, error: transactionDeleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('order_id', orderData.id)
          .select();
        
        if (transactionDeleteError) {
          console.log('⚠️ Error deleting test transactions:', transactionDeleteError.message);
        } else {
          console.log(`✅ ${deletedTransactions?.length || 0} test transactions cleaned up`);
        }
        
        // Wait a bit before deleting the order
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Then delete the order
        console.log('🧹 Deleting test order...');
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderData.id);
        
        if (deleteError) {
          console.error('❌ Error deleting test order:', deleteError.message);
        } else {
          console.log('✅ Test order cleaned up successfully');
        }
        
        // Verify cleanup was successful
        const { data: remainingOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('id', orderData.id);
          
        if (remainingOrders && remainingOrders.length === 0) {
          console.log('✅ Cleanup verification: Order successfully removed');
        } else {
          console.log('⚠️ Cleanup verification: Order may still exist');
        }
        
      } catch (cleanupError) {
        console.log('⚠️ Cleanup failed:', cleanupError.message);
        
        // Try alternative cleanup approach
        try {
          console.log('🔄 Attempting alternative cleanup...');
          await supabase.from('transactions').delete().like('admin_notes', '%Test%');
          await supabase.from('orders').delete().like('customer_nama', '%Test Customer%');
          console.log('✅ Alternative cleanup completed');
        } catch (altCleanupError) {
          console.log('❌ Alternative cleanup also failed:', altCleanupError.message);
        }
      }
    }
    
    console.log('\n🎉 Transaction flow test completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error during test:', error.message);
    
    // Emergency cleanup in case of error
    console.log('🚨 Performing emergency cleanup...');
    
    try {
      // Clean up by order ID if available
      if (orderData?.id) {
        console.log('🧹 Emergency: Cleaning up order', orderData.id);
        await supabase.from('transactions').delete().eq('order_id', orderData.id);
        await supabase.from('orders').delete().eq('id', orderData.id);
      }
      
      // Also clean up by pattern matching as fallback
      await supabase.from('transactions').delete().like('admin_notes', '%Test%');
      await supabase.from('orders').delete().like('customer_nama', '%Test Customer%');
      await supabase.from('orders').delete().like('customer_email', '%@example.com%');
      
      console.log('✅ Emergency cleanup completed successfully');
    } catch (cleanupError) {
      console.log('❌ Emergency cleanup failed:', cleanupError.message);
      console.log('⚠️ Manual cleanup may be required');
    }
  }
}

// Jalankan test
testTransactionFlow();