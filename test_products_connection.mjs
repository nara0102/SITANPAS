import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  console.log('URL:', process.env.VITE_SUPABASE_URL);
  console.log('Key:', process.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing');
  
  try {
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('products')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Connection failed:', testError.message);
      return;
    }
    
    console.log('✅ Connection successful');
    
    // Check products count
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Count query failed:', countError.message);
      return;
    }
    
    console.log('📊 Total products in database:', count);
    
    // Check active products
    const { data: activeProducts, error: activeError } = await supabase
      .from('products')
      .select('id, nama_produk, status, stok')
      .eq('status', 'active')
      .gt('stok', 0);
    
    if (activeError) {
      console.error('❌ Active products query failed:', activeError.message);
      return;
    }
    
    console.log('🐟 Active products with stock:', activeProducts?.length || 0);
    if (activeProducts && activeProducts.length > 0) {
      console.log('Sample products:');
      activeProducts.slice(0, 3).forEach(p => {
        console.log(`  - ${p.nama_produk} (Stock: ${p.stok})`);
      });
    }
    
    // Test the exact query used by the app
    console.log('\n🔍 Testing app query...');
    const { data: appData, error: appError } = await supabase
      .from('products')
      .select(`
        id,
        nama_produk,
        deskripsi,
        harga,
        stok,
        image_url,
        nelayan_id,
        status,
        kategori,
        berat_per_unit,
        unit_type,
        created_at,
        updated_at,
        users!products_nelayan_id_fkey (
          id,
          full_name,
          phone,
          email
        )
      `)
      .eq('status', 'active')
      .gt('stok', 0)
      .order('created_at', { ascending: false });

    if (appError) {
      console.error('❌ App query failed:', appError.message);
      console.error('Error details:', appError);
    } else {
      console.log('✅ App query successful');
      console.log('📦 Products returned by app query:', appData?.length || 0);
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

testConnection();