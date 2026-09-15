import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Consent, ConsentInsert, ConsentPartner, ConsentPartnerInsert } from "./types";

interface Database {
  public: {
    Tables: {
      consents: {
        Row: Consent;
        Insert: ConsentInsert;
        Update: Partial<ConsentInsert>;
      };
      consent_partners: {
        Row: ConsentPartner;
        Insert: ConsentPartnerInsert;
        Update: Partial<ConsentPartnerInsert>;
      };
    };
  };
}

type TypedSupabase = SupabaseClient<Database>;

let _client: TypedSupabase | null = null;

export function getSupabase(): TypedSupabase {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Mangler SUPABASE_URL og/eller SUPABASE_SERVICE_ROLE_KEY i .env filen"
      );
    }
    _client = createClient<Database>(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _client;
}
