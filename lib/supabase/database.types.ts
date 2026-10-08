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
      workspace_integrations: Table<
        {
          organization_id: string;
          revision: string;
          provider: string;
          endpoint_url: string;
          enabled: boolean;
          updated_at: string;
        },
        {
          organization_id: string;
          revision?: string;
          provider: string;
          endpoint_url: string;
          enabled?: boolean;
          updated_at?: string;
        },
        {
          revision?: string;
          provider?: string;
          endpoint_url?: string;
          enabled?: boolean;
          updated_at?: string;
        }
      >;
      integration_deliveries: Table<
        {
          id: string;
          organization_id: string;
          submission_id: string;
          revision: string;
          status: string;
          attempts: number;
          next_attempt_at: string;
          claim_token: string | null;
          last_status: number | null;
          delivered_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          submission_id: string;
          revision: string;
          status?: string;
          attempts?: number;
          next_attempt_at?: string;
          claim_token?: string | null;
          last_status?: number | null;
          delivered_at?: string | null;
          created_at?: string;
        },
        {
          status?: string;
          attempts?: number;
          next_attempt_at?: string;
          claim_token?: string | null;
          last_status?: number | null;
          delivered_at?: string | null;
        }
      >;
      billing_checkout_reservations: Table<
        {
          organization_id: string;
          token: string;
          plan: string;
          expires_at: string;
          stripe_session_id: string | null;
        },
        {
          organization_id: string;
          token?: string;
          plan: string;
          expires_at: string;
          stripe_session_id?: string | null;
        },
        { stripe_session_id?: string | null }
      >;
      notification_outbox: Table<
        {
          id: string;
          submission_id: string;
          recipient: string;
          sent_at: string | null;
          retry_at: string;
        },
        {
          id?: string;
          submission_id: string;
          recipient: string;
          sent_at?: string | null;
          retry_at?: string;
        },
        { sent_at?: string | null; retry_at?: string }
      >;
      billing_subscriptions: Table<
        {
          organization_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          plan: string;
          status: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          observed_at: string;
        },
        {
          organization_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          plan: string;
          status: string;
          current_period_end: string;
          cancel_at_period_end?: boolean;
          observed_at?: string;
        },
        {
          plan?: string;
          status?: string;
          current_period_end?: string;
          cancel_at_period_end?: boolean;
          observed_at?: string;
        }
      >;
      workspace_usage: Table<
        { organization_id: string; month: string; leads: number },
        { organization_id: string; month: string; leads?: number },
        { leads?: number }
      >;
      organizations: Table<
        {
          id: string;
          name: string;
          created_at: string;
          trial_ends_at: string;
          stripe_customer_id: string | null;
          stripe_account_id: string | null;
        },
        {
          id?: string;
          name: string;
          created_at?: string;
          trial_ends_at?: string;
          stripe_customer_id?: string | null;
          stripe_account_id?: string | null;
        },
        {
          id?: string;
          name?: string;
          created_at?: string;
          trial_ends_at?: string;
          stripe_customer_id?: string | null;
          stripe_account_id?: string | null;
        }
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
          archived_at: string | null;
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
          archived_at?: string | null;
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
          archived_at?: string | null;
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
          follow_up_consent: boolean;
          next_follow_up_at: string | null;
          follow_up_claim_token: string | null;
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
          follow_up_consent?: boolean;
          next_follow_up_at?: string | null;
          follow_up_claim_token?: string | null;
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
          follow_up_consent?: boolean;
          next_follow_up_at?: string | null;
          follow_up_claim_token?: string | null;
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
          stripe_account_id: string | null;
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
          stripe_account_id?: string | null;
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
          stripe_account_id?: string | null;
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
      claim_customer_reminders: { Args: { p_limit: number }; Returns: Json };
      finish_customer_reminder: {
        Args: { p_submission_id: string; p_claim_token: string; p_sent: boolean };
        Returns: boolean;
      };
      configure_workspace_integration: {
        Args: { p_organization_id: string; p_provider: string; p_url: string; p_enabled: boolean };
        Returns: undefined;
      };
      claim_integration_deliveries: { Args: { p_limit: number }; Returns: Json };

      reserve_deposit_checkout: {
        Args: {
          p_submission_id: string;
          p_account_id: string;
          p_amount_cents: number;
          p_currency: string;
        };
        Returns: Json;
      };
      register_deposit_checkout: {
        Args: { p_submission_id: string; p_token: string; p_session_id: string };
        Returns: undefined;
      };
      release_expired_deposit_checkout: {
        Args: { p_submission_id: string; p_token: string };
        Returns: undefined;
      };
      calculator_accepts_leads: { Args: { p_calculator_id: string }; Returns: boolean };
      set_calculator_archived: {
        Args: { p_organization_id: string; p_calculator_id: string; p_archived: boolean };
        Returns: undefined;
      };
      reserve_subscription_checkout: {
        Args: { p_organization_id: string; p_plan: string };
        Returns: Json;
      };
      workspace_plan: { Args: { p_organization_id: string }; Returns: string | null };
      sync_billing_subscription: {
        Args: {
          p_organization_id: string;
          p_customer_id: string;
          p_subscription_id: string;
          p_plan: string;
          p_status: string;
          p_period_end: string;
          p_cancel_at_period_end: boolean;
          p_observed_at: string;
        };
        Returns: undefined;
      };
      revise_calculator: {
        Args: {
          p_organization_id: string;
          p_calculator_id: string;
          p_expected_version: number;
          p_name: string;
          p_schema: Json;
          p_pricing_rules: Json;
        };
        Returns: number;
      };
      capture_submission: {
        Args: {
          p_calculator_id: string;
          p_template_slug: string;
          p_answers: Json;
          p_quote: Json;
          p_name: string;
          p_email: string | null;
          p_phone: string | null;
          p_token_hash: string;
          p_follow_up_consent: boolean;
        };
        Returns: string;
      };
      set_lead_status: {
        Args: { p_organization_id: string; p_submission_id: string; p_status: string };
        Returns: undefined;
      };
      resolve_booking: {
        Args: { p_organization_id: string; p_booking_id: string; p_status: string };
        Returns: undefined;
      };
      cleanup_rate_limits: { Args: Record<string, never>; Returns: undefined };
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
