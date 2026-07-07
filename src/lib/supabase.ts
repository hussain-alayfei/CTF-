import { createClient } from '@supabase/supabase-js';

// These are PUBLIC values. The anon/publishable key is designed to live in the
// browser; every table is protected by Row Level Security and all game
// mutations go through SECURITY DEFINER functions on the server. We read them
// from env when provided, and fall back to the project defaults so the app
// works out-of-the-box when deployed.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://xehzdlfrzlokwvtcfvjx.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_tvECgVRLC9NtXPwbgNOvDQ_PzKHmMuP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
});
