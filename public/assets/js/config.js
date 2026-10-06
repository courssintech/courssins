/* Public configuration. These two values are SAFE to expose: the anon key is designed for browsers and
   every table is protected by Row Level Security. NEVER put a service_role key, Paystack secret or any other secret in this file.
   Find both values in Supabase > Project Settings > API. */
export const CONFIG = {
  SUPABASE_URL: 'https://ohkrwdmiqlkjcsnzbmma.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_kOMD5B_3EbxoCEeSEzXAug_rUnZfQ-2',
  SITE_URL: 'https://courssin.com.ng',
  // Supabase Edge Function that starts a Paystack payment (see README). Leave empty until deployed.
  PAYMENT_INIT_URL: 'https://ohkrwdmiqlkjcsnzbmma.supabase.co/functions/v1/paystack-initialize',
};
