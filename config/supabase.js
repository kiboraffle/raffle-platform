const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
}

// Client untuk operasi admin (menggunakan service role key)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Client untuk operasi user (menggunakan anon key)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Test connection function
const testConnection = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase Connection Error:', error.message);
      return false;
    }
    
    console.log('✅ Supabase Connected Successfully');
    return true;
  } catch (error) {
    console.error('❌ Supabase Connection Error:', error.message);
    return false;
  }
};

module.exports = {
  supabaseAdmin,
  supabaseClient,
  testConnection
};