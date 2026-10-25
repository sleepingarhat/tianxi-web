export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      computed_cache: {
        Row: {
          computed_at: string
          key: string
          payload: Json
        }
        Insert: {
          computed_at?: string
          key: string
          payload: Json
        }
        Update: {
          computed_at?: string
          key?: string
          payload?: Json
        }
        Relationships: []
      }
      crypto_passes: {
        Row: {
          actually_paid: number | null
          admin_note: string | null
          created_at: string
          environment: string
          id: string
          invoice_id: string | null
          last_ipn: Json | null
          paid_at: string | null
          pay_currency: string | null
          payment_id: string | null
          price_usd: number
          status: string
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_until: string | null
          weeks: number
        }
        Insert: {
          actually_paid?: number | null
          admin_note?: string | null
          created_at?: string
          environment?: string
          id?: string
          invoice_id?: string | null
          last_ipn?: Json | null
          paid_at?: string | null
          pay_currency?: string | null
          payment_id?: string | null
          price_usd: number
          status?: string
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
          weeks?: number
        }
        Update: {
          actually_paid?: number | null
          admin_note?: string | null
          created_at?: string
          environment?: string
          id?: string
          invoice_id?: string | null
          last_ipn?: Json | null
          paid_at?: string | null
          pay_currency?: string | null
          payment_id?: string | null
          price_usd?: number
          status?: string
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
          weeks?: number
        }
        Relationships: []
      }
      football_dual_ledger: {
        Row: {
          away: string
          div: string
          home: string
          kickoff_utc: string
          lambda: number[]
          locked_at: string
          match_key: string
          odds: number[] | null
          odds_source: string
          p_a: number[]
          p_b_d: number
          p_final: number[]
          pick_odds: number | null
          prediction: string
          stake: number
          version: string
        }
        Insert: {
          away: string
          div: string
          home: string
          kickoff_utc: string
          lambda: number[]
          locked_at?: string
          match_key: string
          odds?: number[] | null
          odds_source?: string
          p_a: number[]
          p_b_d: number
          p_final: number[]
          pick_odds?: number | null
          prediction: string
          stake?: number
          version?: string
        }
        Update: {
          away?: string
          div?: string
          home?: string
          kickoff_utc?: string
          lambda?: number[]
          locked_at?: string
          match_key?: string
          odds?: number[] | null
          odds_source?: string
          p_a?: number[]
          p_b_d?: number
          p_final?: number[]
          pick_odds?: number | null
          prediction?: string
          stake?: number
          version?: string
        }
        Relationships: []
      }
      football_lineup_settle: {
        Row: {
          away_formation_ok: boolean | null
          away_hits: number | null
          home_formation_ok: boolean | null
          home_hits: number | null
          incidents: Json | null
          match_key: string
          official: Json | null
          post_stats: Json | null
          settled_at: string
        }
        Insert: {
          away_formation_ok?: boolean | null
          away_hits?: number | null
          home_formation_ok?: boolean | null
          home_hits?: number | null
          incidents?: Json | null
          match_key: string
          official?: Json | null
          post_stats?: Json | null
          settled_at?: string
        }
        Update: {
          away_formation_ok?: boolean | null
          away_hits?: number | null
          home_formation_ok?: boolean | null
          home_hits?: number | null
          incidents?: Json | null
          match_key?: string
          official?: Json | null
          post_stats?: Json | null
          settled_at?: string
        }
        Relationships: []
      }
      football_lineup_snapshots: {
        Row: {
          away: string
          bsd_event_id: number | null
          bsd_latency_ms: number | null
          bsd_prediction: Json | null
          captured_at: string
          context: Json | null
          div: string
          error: string | null
          home: string
          kickoff_utc: string
          lineup_status: string | null
          lineups: Json | null
          match_key: string
          unavailable: Json | null
        }
        Insert: {
          away: string
          bsd_event_id?: number | null
          bsd_latency_ms?: number | null
          bsd_prediction?: Json | null
          captured_at?: string
          context?: Json | null
          div: string
          error?: string | null
          home: string
          kickoff_utc: string
          lineup_status?: string | null
          lineups?: Json | null
          match_key: string
          unavailable?: Json | null
        }
        Update: {
          away?: string
          bsd_event_id?: number | null
          bsd_latency_ms?: number | null
          bsd_prediction?: Json | null
          captured_at?: string
          context?: Json | null
          div?: string
          error?: string | null
          home?: string
          kickoff_utc?: string
          lineup_status?: string | null
          lineups?: Json | null
          match_key?: string
          unavailable?: Json | null
        }
        Relationships: []
      }
      hkjc_cancellation_snapshots: {
        Row: {
          fetched_at: string
          id: string
          keyword: string
          race_date: string
          raw_html: string
          sentence: string
          sha256: string
          source_url: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          keyword: string
          race_date: string
          raw_html: string
          sentence: string
          sha256: string
          source_url: string
        }
        Update: {
          fetched_at?: string
          id?: string
          keyword?: string
          race_date?: string
          raw_html?: string
          sentence?: string
          sha256?: string
          source_url?: string
        }
        Relationships: []
      }
      hkjc_changes_snapshots: {
        Row: {
          changes: Json
          fetched_at: string
          id: string
          race_date: string
          raw_html: string
          sha256: string
          source_url: string
          venue: string
        }
        Insert: {
          changes?: Json
          fetched_at?: string
          id?: string
          race_date: string
          raw_html: string
          sha256: string
          source_url: string
          venue: string
        }
        Update: {
          changes?: Json
          fetched_at?: string
          id?: string
          race_date?: string
          raw_html?: string
          sha256?: string
          source_url?: string
          venue?: string
        }
        Relationships: []
      }
      horse_watchlist: {
        Row: {
          activated_at: string
          created_at: string
          horse_id: string
          horse_name: string | null
          notify_entry: boolean
          notify_injury: boolean
          notify_push: boolean
          notify_telegram: boolean
          notify_trackwork: boolean
          notify_trial: boolean
          paused: boolean
          user_id: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          horse_id: string
          horse_name?: string | null
          notify_entry?: boolean
          notify_injury?: boolean
          notify_push?: boolean
          notify_telegram?: boolean
          notify_trackwork?: boolean
          notify_trial?: boolean
          paused?: boolean
          user_id: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          horse_id?: string
          horse_name?: string | null
          notify_entry?: boolean
          notify_injury?: boolean
          notify_push?: boolean
          notify_telegram?: boolean
          notify_trackwork?: boolean
          notify_trial?: boolean
          paused?: boolean
          user_id?: string
        }
        Relationships: []
      }
      member_test_accounts: {
        Row: {
          marked_at: string
          marked_by: string | null
          user_id: string
        }
        Insert: {
          marked_at?: string
          marked_by?: string | null
          user_id: string
        }
        Update: {
          marked_at?: string
          marked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      model_versions: {
        Row: {
          engine: string
          fingerprint: string | null
          notes: string | null
          released_at: string
          status: string
          version: string
        }
        Insert: {
          engine: string
          fingerprint?: string | null
          notes?: string | null
          released_at: string
          status?: string
          version: string
        }
        Update: {
          engine?: string
          fingerprint?: string | null
          notes?: string | null
          released_at?: string
          status?: string
          version?: string
        }
        Relationships: []
      }
      notification_job_leases: {
        Row: {
          expires_at: string
          key: string
          owner: string
        }
        Insert: {
          expires_at: string
          key: string
          owner: string
        }
        Update: {
          expires_at?: string
          key?: string
          owner?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          last_limit_notice_at: string | null
          push_enabled: boolean
          raceday_alerts: boolean
          raceday_enabled: boolean
          raceday_opted_in_at: string | null
          telegram_enabled: boolean
          trackwork_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_limit_notice_at?: string | null
          push_enabled?: boolean
          raceday_alerts?: boolean
          raceday_enabled?: boolean
          raceday_opted_in_at?: string | null
          telegram_enabled?: boolean
          trackwork_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_limit_notice_at?: string | null
          push_enabled?: boolean
          raceday_alerts?: boolean
          raceday_enabled?: boolean
          raceday_opted_in_at?: string | null
          telegram_enabled?: boolean
          trackwork_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ops_event_history: {
        Row: {
          event_key: string
          gate_key: string | null
          gate_status: string | null
          id: number
          kind: string
          message: string
          metadata: Json
          model_version: string | null
          occurred_at: string
          route: string | null
          severity: string
          source: string
          status_code: number | null
        }
        Insert: {
          event_key: string
          gate_key?: string | null
          gate_status?: string | null
          id?: never
          kind: string
          message: string
          metadata?: Json
          model_version?: string | null
          occurred_at?: string
          route?: string | null
          severity: string
          source: string
          status_code?: number | null
        }
        Update: {
          event_key?: string
          gate_key?: string | null
          gate_status?: string | null
          id?: never
          kind?: string
          message?: string
          metadata?: Json
          model_version?: string | null
          occurred_at?: string
          route?: string | null
          severity?: string
          source?: string
          status_code?: number | null
        }
        Relationships: []
      }
      payment_acceptance_invoices: {
        Row: {
          actually_paid: number
          created_at: string
          environment: string
          id: string
          invoice_id: string | null
          invoice_url: string | null
          owner_id: string
          pay_currency: string
          payment_id: string | null
          price_usd: number
          status: string
          updated_at: string
          verified_receipt: Json | null
        }
        Insert: {
          actually_paid?: number
          created_at?: string
          environment?: string
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          owner_id: string
          pay_currency?: string
          payment_id?: string | null
          price_usd?: number
          status?: string
          updated_at?: string
          verified_receipt?: Json | null
        }
        Update: {
          actually_paid?: number
          created_at?: string
          environment?: string
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          owner_id?: string
          pay_currency?: string
          payment_id?: string | null
          price_usd?: number
          status?: string
          updated_at?: string
          verified_receipt?: Json | null
        }
        Relationships: []
      }
      push_delivery_receipts: {
        Row: {
          delivered_at: string
          event_key: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          delivered_at?: string
          event_key: string
          subscription_id: string
          user_id: string
        }
        Update: {
          delivered_at?: string
          event_key?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          fail_count: number
          id: string
          last_success_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          fail_count?: number
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          fail_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_test_requests: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      race_dividends: {
        Row: {
          combo: string
          created_at: string
          date: string
          dividend: number
          id: number
          pool: string
          race_no: number
          unit: number
          venue: string
        }
        Insert: {
          combo: string
          created_at?: string
          date: string
          dividend: number
          id?: never
          pool: string
          race_no: number
          unit?: number
          venue: string
        }
        Update: {
          combo?: string
          created_at?: string
          date?: string
          dividend?: number
          id?: never
          pool?: string
          race_no?: number
          unit?: number
          venue?: string
        }
        Relationships: []
      }
      racecourse_photo_runs: {
        Row: {
          accepted: number
          added: number
          id: number
          message: string | null
          ok: boolean
          ran_at: string
          scanned: number
        }
        Insert: {
          accepted?: number
          added?: number
          id?: never
          message?: string | null
          ok: boolean
          ran_at?: string
          scanned?: number
        }
        Update: {
          accepted?: number
          added?: number
          id?: never
          message?: string | null
          ok?: boolean
          ran_at?: string
          scanned?: number
        }
        Relationships: []
      }
      racecourse_photos: {
        Row: {
          active: boolean
          approved: boolean | null
          author: string
          checked_at: string
          file_title: string
          first_seen_at: string
          height: number
          image_url: string
          license: string
          license_url: string | null
          review_note: string | null
          source_page: string
          venue: string
          width: number
        }
        Insert: {
          active?: boolean
          approved?: boolean | null
          author: string
          checked_at?: string
          file_title: string
          first_seen_at?: string
          height: number
          image_url: string
          license: string
          license_url?: string | null
          review_note?: string | null
          source_page: string
          venue: string
          width: number
        }
        Update: {
          active?: boolean
          approved?: boolean | null
          author?: string
          checked_at?: string
          file_title?: string
          first_seen_at?: string
          height?: number
          image_url?: string
          license?: string
          license_url?: string | null
          review_note?: string | null
          source_page?: string
          venue?: string
          width?: number
        }
        Relationships: []
      }
      raceday_notifications: {
        Row: {
          created_at: string
          event_key: string
          id: number
          sent_push_at: string | null
          sent_telegram_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_key: string
          id?: never
          sent_push_at?: string | null
          sent_telegram_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: never
          sent_push_at?: string | null
          sent_telegram_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      racing_change_updates: {
        Row: {
          checked_at: string
          generated_at: string | null
          phase: string
          race_date: string
          recomputed_at: string | null
          requested_at: string | null
          revision: string
        }
        Insert: {
          checked_at?: string
          generated_at?: string | null
          phase: string
          race_date: string
          recomputed_at?: string | null
          requested_at?: string | null
          revision: string
        }
        Update: {
          checked_at?: string
          generated_at?: string | null
          phase?: string
          race_date?: string
          recomputed_at?: string | null
          requested_at?: string | null
          revision?: string
        }
        Relationships: []
      }
      racing_dividend_snapshots: {
        Row: {
          dividends: Json
          fetched_at: string
          id: string
          race_count: number
          race_date: string
          raw_html: string
          source_sha256: string
          source_url: string
          trio_combinations: Json
          venue: string
        }
        Insert: {
          dividends: Json
          fetched_at?: string
          id?: string
          race_count: number
          race_date: string
          raw_html: string
          source_sha256: string
          source_url: string
          trio_combinations: Json
          venue: string
        }
        Update: {
          dividends?: Json
          fetched_at?: string
          id?: string
          race_count?: number
          race_date?: string
          raw_html?: string
          source_sha256?: string
          source_url?: string
          trio_combinations?: Json
          venue?: string
        }
        Relationships: []
      }
      racing_official_collection_leases: {
        Row: {
          expires_at: string
          id: string
        }
        Insert: {
          expires_at: string
          id: string
        }
        Update: {
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      racing_official_result_snapshots: {
        Row: {
          fetched_at: string
          id: string
          identity_verified: boolean
          race_date: string
          race_number: number
          raw_html: string
          results: Json
          source_sha256: string
          source_url: string
          venue: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          identity_verified?: boolean
          race_date: string
          race_number: number
          raw_html: string
          results: Json
          source_sha256: string
          source_url: string
          venue: string
        }
        Update: {
          fetched_at?: string
          id?: string
          identity_verified?: boolean
          race_date?: string
          race_number?: number
          raw_html?: string
          results?: Json
          source_sha256?: string
          source_url?: string
          venue?: string
        }
        Relationships: []
      }
      racing_prelock_state: {
        Row: {
          lease_token: string | null
          lease_until: string | null
          race_date: string
          state: Json
          updated_at: string
        }
        Insert: {
          lease_token?: string | null
          lease_until?: string | null
          race_date: string
          state?: Json
          updated_at?: string
        }
        Update: {
          lease_token?: string | null
          lease_until?: string | null
          race_date?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      racing_result_collection_state: {
        Row: {
          dispatched_at: string | null
          expected_races: number
          first_confirmed_at: string
          last_attempt_at: string | null
          race_date: string
          source_sha256: string
          venue: string
        }
        Insert: {
          dispatched_at?: string | null
          expected_races: number
          first_confirmed_at: string
          last_attempt_at?: string | null
          race_date: string
          source_sha256: string
          venue: string
        }
        Update: {
          dispatched_at?: string | null
          expected_races?: number
          first_confirmed_at?: string
          last_attempt_at?: string | null
          race_date?: string
          source_sha256?: string
          venue?: string
        }
        Relationships: []
      }
      racing_results_index: {
        Row: {
          meeting_date: string
          path: string
          races: number
          result_rows: number
          synced_at: string
        }
        Insert: {
          meeting_date: string
          path: string
          races: number
          result_rows: number
          synced_at?: string
        }
        Update: {
          meeting_date?: string
          path?: string
          races?: number
          result_rows?: number
          synced_at?: string
        }
        Relationships: []
      }
      subscription_event_receipts: {
        Row: {
          environment: string
          event_id: string
          received_at: string
          subscription_id: string
        }
        Insert: {
          environment: string
          event_id: string
          received_at?: string
          subscription_id: string
        }
        Update: {
          environment?: string
          event_id?: string
          received_at?: string
          subscription_id?: string
        }
        Relationships: []
      }
      subscription_event_state: {
        Row: {
          environment: string
          last_event_id: string | null
          reconciled_at: string
          revision: number
          subscription_id: string
        }
        Insert: {
          environment: string
          last_event_id?: string | null
          reconciled_at?: string
          revision?: number
          subscription_id: string
        }
        Update: {
          environment?: string
          last_event_id?: string | null
          reconciled_at?: string
          revision?: number
          subscription_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_alert_state: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      telegram_link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          chat_id: number
          dm_blocked: boolean
          last_checked_at: string | null
          linked_at: string
          pro_joined_at: string | null
          pro_removed_at: string | null
          telegram_user_id: number
          telegram_username: string | null
          user_id: string
        }
        Insert: {
          chat_id: number
          dm_blocked?: boolean
          last_checked_at?: string | null
          linked_at?: string
          pro_joined_at?: string | null
          pro_removed_at?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          user_id: string
        }
        Update: {
          chat_id?: number
          dm_blocked?: boolean
          last_checked_at?: string | null
          linked_at?: string
          pro_joined_at?: string | null
          pro_removed_at?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_pro_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: number
          invite_link: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: never
          invite_link?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: never
          invite_link?: string
          user_id?: string
        }
        Relationships: []
      }
      track_record_summary_snapshot: {
        Row: {
          computed_at: string
          key: string
          payload: Json
        }
        Insert: {
          computed_at?: string
          key: string
          payload: Json
        }
        Update: {
          computed_at?: string
          key?: string
          payload?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watch_job_runs: {
        Row: {
          error: string | null
          events: number
          feed_freshness: Json | null
          finished_at: string | null
          horses: number
          id: number
          kind: string
          new_rows: number
          push_failed: number
          push_sent: number
          started_at: string
          tg_failed: number
          tg_sent: number
        }
        Insert: {
          error?: string | null
          events?: number
          feed_freshness?: Json | null
          finished_at?: string | null
          horses?: number
          id?: never
          kind?: string
          new_rows?: number
          push_failed?: number
          push_sent?: number
          started_at?: string
          tg_failed?: number
          tg_sent?: number
        }
        Update: {
          error?: string | null
          events?: number
          feed_freshness?: Json | null
          finished_at?: string | null
          horses?: number
          id?: never
          kind?: string
          new_rows?: number
          push_failed?: number
          push_sent?: number
          started_at?: string
          tg_failed?: number
          tg_sent?: number
        }
        Relationships: []
      }
      watch_limit_state: {
        Row: {
          applied_limit: number
          notice_pending_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_limit: number
          notice_pending_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_limit?: number
          notice_pending_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_notifications: {
        Row: {
          created_at: string
          event_date: string | null
          event_key: string
          event_type: string
          horse_id: string | null
          id: number
          payload: Json
          push_sent_at: string | null
          read_at: string | null
          telegram_sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          event_key: string
          event_type: string
          horse_id?: string | null
          id?: number
          payload?: Json
          push_sent_at?: string | null
          read_at?: string | null
          telegram_sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          event_key?: string
          event_type?: string
          horse_id?: string | null
          id?: number
          payload?: Json
          push_sent_at?: string | null
          read_at?: string | null
          telegram_sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      weather_snapshots: {
        Row: {
          captured_at: string
          gust_speed: number | null
          humidity: number | null
          id: string
          pressure: number | null
          rain_10min: number | null
          rain_today: number | null
          sectional: Json
          soil_loss_today: number | null
          soil_water: number | null
          station_time: string | null
          sunshine_hour: number | null
          temperature: number | null
          temperature_max: number | null
          temperature_min: number | null
          venue: string
          wind_direction: string | null
          wind_speed: number | null
        }
        Insert: {
          captured_at?: string
          gust_speed?: number | null
          humidity?: number | null
          id?: string
          pressure?: number | null
          rain_10min?: number | null
          rain_today?: number | null
          sectional?: Json
          soil_loss_today?: number | null
          soil_water?: number | null
          station_time?: string | null
          sunshine_hour?: number | null
          temperature?: number | null
          temperature_max?: number | null
          temperature_min?: number | null
          venue: string
          wind_direction?: string | null
          wind_speed?: number | null
        }
        Update: {
          captured_at?: string
          gust_speed?: number | null
          humidity?: number | null
          id?: string
          pressure?: number | null
          rain_10min?: number | null
          rain_today?: number | null
          sectional?: Json
          soil_loss_today?: number | null
          soil_water?: number | null
          station_time?: string | null
          sunshine_hour?: number | null
          temperature?: number | null
          temperature_max?: number | null
          temperature_min?: number | null
          venue?: string
          wind_direction?: string | null
          wind_speed?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _membership_entitlement: { Args: { uid: string }; Returns: Json }
      acquire_notification_job: {
        Args: { k: string; oid: string }
        Returns: boolean
      }
      admin_crypto_action: {
        Args: { action: string; note: string; pid: string }
        Returns: undefined
      }
      admin_member_list: { Args: never; Returns: Json }
      admin_open_gate_now: { Args: never; Returns: Json }
      admin_set_test_account: {
        Args: { _is_test: boolean; _user_id: string }
        Returns: undefined
      }
      apply_crypto_ipn: { Args: { env: string; payload: Json }; Returns: Json }
      apply_payment_acceptance_receipt: {
        Args: { payload: Json }
        Returns: boolean
      }
      apply_watch_limits: {
        Args: { lim: number; uid: string }
        Returns: undefined
      }
      apply_watch_limits_all: { Args: never; Returns: undefined }
      claim_official_collection_lease: {
        Args: { lease_id: string }
        Returns: boolean
      }
      claim_racing_prelock: {
        Args: { _date: string; _token: string }
        Returns: Json
      }
      cleanup_watch_notifications: { Args: never; Returns: number }
      consume_telegram_link_token: {
        Args: { cid: number; hash: string; tid: number; tname: string }
        Returns: boolean
      }
      create_telegram_link_token: {
        Args: { hash: string; uid: string }
        Returns: undefined
      }
      crypto_pass_until: { Args: { env: string; uid: string }; Returns: string }
      founding_cap: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pro: { Args: { uid: string }; Returns: boolean }
      member_account_stats: { Args: never; Returns: Json }
      membership_entitlement: { Args: { uid: string }; Returns: Json }
      membership_for_notification_job: { Args: { uid: string }; Returns: Json }
      membership_gate_at: { Args: never; Returns: string }
      membership_payment_environment: { Args: never; Returns: string }
      mutate_horse_watch: {
        Args: {
          action: string
          active?: boolean
          hid: string
          hname?: string
          lim: number
          swap_id?: string
          uid: string
        }
        Returns: undefined
      }
      my_entitlement: { Args: never; Returns: Json }
      my_membership: { Args: never; Returns: Json }
      open_membership_gate_if_ready: { Args: never; Returns: boolean }
      paywall_threshold: { Args: never; Returns: number }
      public_founding_info: { Args: never; Returns: Json }
      public_member_count: { Args: never; Returns: number }
      racing_data_scale: { Args: never; Returns: Json }
      reconcile_subscription_event: {
        Args: {
          _environment: string
          _event_id: string
          _expected_revision: number
          _snapshot: Json
          _subscription_id: string
        }
        Returns: Json
      }
      renew_notification_job: {
        Args: { k: string; oid: string }
        Returns: boolean
      }
      renew_racing_prelock: {
        Args: { _date: string; _token: string }
        Returns: boolean
      }
      reserve_crypto_checkout: {
        Args: { amount: number; duration: number; env: string; uid: string }
        Returns: string
      }
      reserve_payment_acceptance: { Args: { uid: string }; Returns: string }
      reserve_push_test: { Args: { uid: string }; Returns: undefined }
      reserve_telegram_invite: { Args: { uid: string }; Returns: number }
      save_push_subscription: {
        Args: {
          agent: string
          akey: string
          ep: string
          pkey: string
          uid: string
        }
        Returns: undefined
      }
      save_racing_prelock: {
        Args: {
          _date: string
          _release?: boolean
          _state: Json
          _token: string
        }
        Returns: boolean
      }
      select_active_watches: {
        Args: { horse_ids: string[]; lim: number; uid: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
