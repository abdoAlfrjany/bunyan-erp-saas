import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data, error } = await supabase.rpc('adjust_product_stock_atomic', {
    p_product_id: '00000000-0000-0000-0000-000000000000',
    p_qty_delta: 0
  });
  console.log('RPC Call 1:', JSON.stringify({ data, error }, null, 2));
}

test();
