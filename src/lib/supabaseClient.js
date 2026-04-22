import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kaznuaesfetgthbisidx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xRynRvN8cf7gF13Fduc5dA_1DVi7H6S";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
