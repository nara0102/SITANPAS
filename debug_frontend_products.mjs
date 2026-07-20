import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugFrontendQuery() {
  console.log('🔍 Debugging frontend products query...');
  
  try {
    // Test the exact query from useFishProducts hook
    console.log('\n1. Testing basic products query...');
    const { data: basicData, error: basicError } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .gt('stok', 0);
    
    if (basicError) {
      console.error('❌ Basic query failed:', basicError.message);
    } else {
      console.log('✅ Basic query successful:', basicData?.length, 'products');
    }
    
    // Test with user join
    console.log('\n2. Testing query with user join...');
    const { data: joinData, error: joinError } = await supabase
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

    if (joinError) {
      console.error('❌ Join query failed:', joinError.message);
      console.error('Error details:', joinError);
      
      // Try without the join to isolate the issue
      console.log('\n3. Testing without user join...');
      const { data: noJoinData, error: noJoinError } = await supabase
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
          updated_at
        `)
        .eq('status', 'active')
        .gt('stok', 0)
        .order('created_at', { ascending: false });
      
      if (noJoinError) {
        console.error('❌ No-join query also failed:', noJoinError.message);
      } else {
        console.log('✅ No-join query successful:', noJoinData?.length, 'products');
        console.log('Sample product:', noJoinData?.[0]);
      }
    } else {
      console.log('✅ Join query successful:', joinData?.length, 'products');
      if (joinData && joinData.length > 0) {
        console.log('Sample product with user data:', JSON.stringify(joinData[0], null, 2));
      }
    }
    
    // Check RLS policies
    console.log('\n4. Testing RLS policies...');
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('check_rls_policies');
    
    if (rlsError) {
      console.log('⚠️ RLS check function not available:', rlsError.message);
    } else {
      console.log('RLS policies:', rlsData);
    }
    
    // Test auth context
    console.log('\n5. Testing auth context...');
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user ? 'Authenticated' : 'Anonymous');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

debugFrontendQuery();