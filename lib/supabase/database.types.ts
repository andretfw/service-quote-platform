export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: Table<
        { id: string; name: string; created_at: string },
        { id?: string; name: string; created_at?: string },
        { id?: string; name?: string; created_at?: string }
      >;
      organization_members: Table<
        { organization_id: string; user_id: string; role: string; created_at: string },
        { organization_id: string; user_id: string; role?: string; created_at?: string },
        { organization_id?: string; user_id?: string; role?: string; created_at?: string }
      >;
      calculators: Table<
        {
          id: string;
          organization_id: string;
          public_id: string;
          name: string;
          template_slug: string;
          active_version: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          public_id: string;
          name: string;
          template_slug: string;
          active_version?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          organization_id?: string;
          public_id?: string;
          name?: string;
          template_slug?: string;
          active_version?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      calculator_versions: Table<
        {
          calculator_id: string;
          version: number;
          schema: Json;
          pricing_rules: Json;
          theme: Json;
          created_at: string;
        },
        {
          calculator_id: string;
          version: number;
          schema: Json;
          pricing_rules: Json;
          theme?: Json;
          created_at?: string;
        },
        {
          calculator_id?: string;
          version?: number;
          schema?: Json;
          pricing_rules?: Json;
          theme?: Json;
          created_at?: string;
        }
      >;
      submissions: Table<
        {
          id: string;
          calculator_id: string;
          template_slug: string;
          answers: Json;
          quote: Json;
          lead_name: string;
          lead_email: string | null;
          lead_phone: string | null;
          access_token_hash: string;
          status: string;
          follow_up_count: number;
          next_follow_up_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          calculator_id: string;
          template_slug: string;
          answers: Json;
          quote: Json;
          lead_name: string;
          lead_email?: string | null;
          lead_phone?: string | null;
          access_token_hash: string;
          status?: string;
          follow_up_count?: number;
          next_follow_up_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          calculator_id?: string;
          template_slug?: string;
          answers?: Json;
          quote?: Json;
          lead_name?: string;
          lead_email?: string | null;
          lead_phone?: string | null;
          access_token_hash?: string;
          status?: string;
          follow_up_count?: number;
          next_follow_up_at?: string | null;
          created_at?: string;
        }
      >;
      bookings: Table<
        {
          id: string;
          submission_id: string;
          starts_at: string;
          status: string;
          created_at: string;
        },
        {
          id?: string;
          submission_id: string;
          starts_at: string;
          status?: string;
          created_at?: string;
        },
        {
          id?: string;
          submission_id?: string;
          starts_at?: string;
          status?: string;
          created_at?: string;
        }
      >;
      payments: Table<
        {
          id: string;
          submission_id: string;
          stripe_checkout_session_id: string;
          amount_cents: number;
          currency: string;
          status: string;
          paid_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          submission_id: string;
          stripe_checkout_session_id: string;
          amount_cents: number;
          currency: string;
          status?: string;
          paid_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          submission_id?: string;
          stripe_checkout_session_id?: string;
          amount_cents?: number;
          currency?: string;
          status?: string;
          paid_at?: string | null;
          created_at?: string;
        }
      >;
      api_rate_limits: Table<
        { key: string; window_started_at: string; request_count: number; updated_at: string },
        { key: string; window_started_at: string; request_count: number; updated_at?: string },
        { key?: string; window_started_at?: string; request_count?: number; updated_at?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      create_calculator_with_version: {
        Args: {
          p_organization_id: string;
          p_public_id: string;
          p_name: string;
          p_template_slug: string;
          p_schema: Json;
          p_pricing_rules: Json;
        };
        Returns: string;
      };
      get_or_create_default_organization: {
        Args: { p_user_id: string; p_workspace_name: string };
        Returns: string;
      };
      request_booking: {
        Args: { p_submission_id: string; p_starts_at: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
