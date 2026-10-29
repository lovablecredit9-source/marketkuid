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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ad_campaigns: {
        Row: {
          clicks: number
          created_at: string
          daily_budget: number
          duration_days: number | null
          ends_at: string | null
          id: string
          impressions: number
          keywords: string[]
          live_from: string | null
          live_until: string | null
          match_mode: string
          name: string
          owner_id: string
          paid_part: number
          placement: string
          price_per_day: number
          product_id: string
          promo_part: number
          spend: number
          starts_at: string | null
          status: string
          total_cost: number
        }
        Insert: {
          clicks?: number
          created_at?: string
          daily_budget: number
          duration_days?: number | null
          ends_at?: string | null
          id?: string
          impressions?: number
          keywords?: string[]
          live_from?: string | null
          live_until?: string | null
          match_mode?: string
          name: string
          owner_id: string
          paid_part?: number
          placement?: string
          price_per_day?: number
          product_id: string
          promo_part?: number
          spend?: number
          starts_at?: string | null
          status?: string
          total_cost?: number
        }
        Update: {
          clicks?: number
          created_at?: string
          daily_budget?: number
          duration_days?: number | null
          ends_at?: string | null
          id?: string
          impressions?: number
          keywords?: string[]
          live_from?: string | null
          live_until?: string | null
          match_mode?: string
          name?: string
          owner_id?: string
          paid_part?: number
          placement?: string
          price_per_day?: number
          product_id?: string
          promo_part?: number
          spend?: number
          starts_at?: string | null
          status?: string
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_voucher_claims: {
        Row: {
          code: string
          created_at: string
          owner_id: string
        }
        Insert: {
          code: string
          created_at?: string
          owner_id: string
        }
        Update: {
          code?: string
          created_at?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_voucher_claims_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "ad_vouchers"
            referencedColumns: ["code"]
          },
        ]
      }
      ad_vouchers: {
        Row: {
          amount: number
          claimed: number
          code: string
          created_at: string
          expires_at: string | null
          is_active: boolean
          max_claims: number | null
        }
        Insert: {
          amount: number
          claimed?: number
          code: string
          created_at?: string
          expires_at?: string | null
          is_active?: boolean
          max_claims?: number | null
        }
        Update: {
          amount?: number
          claimed?: number
          code?: string
          created_at?: string
          expires_at?: string | null
          is_active?: boolean
          max_claims?: number | null
        }
        Relationships: []
      }
      ad_wallet_ledger: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string | null
          owner_id: string
          paid_delta: number
          promo_delta: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          owner_id: string
          paid_delta?: number
          promo_delta?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          owner_id?: string
          paid_delta?: number
          promo_delta?: number
        }
        Relationships: []
      }
      ad_wallets: {
        Row: {
          owner_id: string
          paid: number
          promo: number
          updated_at: string
        }
        Insert: {
          owner_id: string
          paid?: number
          promo?: number
          updated_at?: string
        }
        Update: {
          owner_id?: string
          paid?: number
          promo?: number
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          product_id: string
          qty: number
          user_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          qty?: number
          user_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          qty?: number
          user_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_hidden: boolean
          buyer_id: string
          buyer_name: string | null
          buyer_typing_at: string | null
          buyer_unread: number
          created_at: string
          id: string
          last_at: string
          last_message: string | null
          last_sender_id: string | null
          seller_hidden: boolean
          seller_id: string
          seller_typing_at: string | null
          seller_unread: number
          store_name: string | null
        }
        Insert: {
          buyer_hidden?: boolean
          buyer_id: string
          buyer_name?: string | null
          buyer_typing_at?: string | null
          buyer_unread?: number
          created_at?: string
          id?: string
          last_at?: string
          last_message?: string | null
          last_sender_id?: string | null
          seller_hidden?: boolean
          seller_id: string
          seller_typing_at?: string | null
          seller_unread?: number
          store_name?: string | null
        }
        Update: {
          buyer_hidden?: boolean
          buyer_id?: string
          buyer_name?: string | null
          buyer_typing_at?: string | null
          buyer_unread?: number
          created_at?: string
          id?: string
          last_at?: string
          last_message?: string | null
          last_sender_id?: string | null
          seller_hidden?: boolean
          seller_id?: string
          seller_typing_at?: string | null
          seller_unread?: number
          store_name?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_path: string | null
          body: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          id: string
          product_id: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_path?: string | null
          body: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          product_id?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          product_id?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          buyer_id: string
          created_at: string
          delivered: string[]
          id: string
          image_path: string | null
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          product_type: string | null
          qty: number
          seller_id: string
          unit_price: number
          variant_id: string | null
          variant_name: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          delivered?: string[]
          id?: string
          image_path?: string | null
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          product_type?: string | null
          qty: number
          seller_id: string
          unit_price: number
          variant_id?: string | null
          variant_name: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          delivered?: string[]
          id?: string
          image_path?: string | null
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_type?: string | null
          qty?: number
          seller_id?: string
          unit_price?: number
          variant_id?: string | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_fee: number
          buyer_id: string
          buyer_name: string | null
          buyer_note: string | null
          buyer_whatsapp: string | null
          checkout_id: string
          completed_at: string | null
          created_at: string
          discount: number
          expires_at: string | null
          id: string
          order_no: number
          paid_at: string | null
          seller_id: string
          status: string
          store_name: string | null
          subtotal: number
          total: number
          unique_code: number
          updated_at: string
          voucher_code: string | null
        }
        Insert: {
          admin_fee?: number
          buyer_id: string
          buyer_name?: string | null
          buyer_note?: string | null
          buyer_whatsapp?: string | null
          checkout_id: string
          completed_at?: string | null
          created_at?: string
          discount?: number
          expires_at?: string | null
          id?: string
          order_no?: never
          paid_at?: string | null
          seller_id: string
          status?: string
          store_name?: string | null
          subtotal?: number
          total?: number
          unique_code?: number
          updated_at?: string
          voucher_code?: string | null
        }
        Update: {
          admin_fee?: number
          buyer_id?: string
          buyer_name?: string | null
          buyer_note?: string | null
          buyer_whatsapp?: string | null
          checkout_id?: string
          completed_at?: string | null
          created_at?: string
          discount?: number
          expires_at?: string | null
          id?: string
          order_no?: never
          paid_at?: string | null
          seller_id?: string
          status?: string
          store_name?: string | null
          subtotal?: number
          total?: number
          unique_code?: number
          updated_at?: string
          voucher_code?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          buyer_id: string
          buyer_label: string
          comment: string | null
          created_at: string
          helpful_count: number
          id: string
          order_item_id: string
          product_id: string
          rating: number
          seller_id: string
          topic: string | null
        }
        Insert: {
          buyer_id: string
          buyer_label?: string
          comment?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          order_item_id: string
          product_id: string
          rating: number
          seller_id: string
          topic?: string | null
        }
        Update: {
          buyer_id?: string
          buyer_label?: string
          comment?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          order_item_id?: string
          product_id?: string
          rating?: number
          seller_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          content: string
          created_at: string
          id: string
          owner_id: string
          product_id: string
          status: string
          variant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          owner_id: string
          product_id: string
          status?: string
          variant_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          product_id?: string
          status?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          bonus: Json | null
          created_at: string
          discount: Json | null
          duration_unit: string | null
          duration_value: number | null
          id: string
          image_url: string | null
          lifetime: boolean
          name: string
          owner_id: string
          preorder_quota: number | null
          price: number
          product_id: string
          sort: number
          warranty: Json | null
        }
        Insert: {
          bonus?: Json | null
          created_at?: string
          discount?: Json | null
          duration_unit?: string | null
          duration_value?: number | null
          id?: string
          image_url?: string | null
          lifetime?: boolean
          name: string
          owner_id: string
          preorder_quota?: number | null
          price: number
          product_id: string
          sort?: number
          warranty?: Json | null
        }
        Update: {
          bonus?: Json | null
          created_at?: string
          discount?: Json | null
          duration_unit?: string | null
          duration_value?: number | null
          id?: string
          image_url?: string | null
          lifetime?: boolean
          name?: string
          owner_id?: string
          preorder_quota?: number | null
          price?: number
          product_id?: string
          sort?: number
          warranty?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string
          id: string
          images: string[]
          name: string
          owner_id: string
          product_type: string
          require_buyer_note: boolean
          seller_contact: string | null
          sold_count: number
          status: string
          updated_at: string
          usage_guide: string
          work_estimate: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name: string
          owner_id: string
          product_type: string
          require_buyer_note?: boolean
          seller_contact?: string | null
          sold_count?: number
          status?: string
          updated_at?: string
          usage_guide?: string
          work_estimate?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name?: string
          owner_id?: string
          product_type?: string
          require_buyer_note?: boolean
          seller_contact?: string | null
          sold_count?: number
          status?: string
          updated_at?: string
          usage_guide?: string
          work_estimate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_stores"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          last_seen_at: string | null
          seller_seen_at: string | null
          updated_at: string
          username: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          last_seen_at?: string | null
          seller_seen_at?: string | null
          updated_at?: string
          username?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
          seller_seen_at?: string | null
          updated_at?: string
          username?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      seller_stores: {
        Row: {
          avatar_path: string | null
          bank_holder: string | null
          bank_number: string | null
          bank_provider: string | null
          bank_type: string | null
          banner_path: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          is_open: boolean
          notify_orders: boolean
          owner_id: string
          slug: string | null
          store_name: string
          telegram_username: string | null
        }
        Insert: {
          avatar_path?: string | null
          bank_holder?: string | null
          bank_number?: string | null
          bank_provider?: string | null
          bank_type?: string | null
          banner_path?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          is_open?: boolean
          notify_orders?: boolean
          owner_id: string
          slug?: string | null
          store_name: string
          telegram_username?: string | null
        }
        Update: {
          avatar_path?: string | null
          bank_holder?: string | null
          bank_number?: string | null
          bank_provider?: string | null
          bank_type?: string | null
          banner_path?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          is_open?: boolean
          notify_orders?: boolean
          owner_id?: string
          slug?: string | null
          store_name?: string
          telegram_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_vouchers: {
        Row: {
          code: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          kind: string
          max_discount: number | null
          min_qty: number
          min_spend: number
          name: string
          owner_id: string
          per_user_limit: number
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
          used_count: number
          value: number
          value_type: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind: string
          max_discount?: number | null
          min_qty?: number
          min_spend?: number
          name: string
          owner_id: string
          per_user_limit?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value: number
          value_type: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_discount?: number | null
          min_qty?: number
          min_spend?: number
          name?: string
          owner_id?: string
          per_user_limit?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_vouchers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_stores"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      store_follows: {
        Row: {
          created_at: string
          seller_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          seller_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          seller_id?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_bot_updates: {
        Row: {
          bot_id: string
          created_at: string
          update_id: number
        }
        Insert: {
          bot_id: string
          created_at?: string
          update_id: number
        }
        Update: {
          bot_id?: string
          created_at?: string
          update_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bot_updates_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_users: {
        Row: {
          bot_id: string
          created_at: string
          first_name: string | null
          referred_by: number | null
          tg_user_id: number
          username: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          first_name?: string | null
          referred_by?: number | null
          tg_user_id: number
          username?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          first_name?: string | null
          referred_by?: number | null
          tg_user_id?: number
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bot_users_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bots: {
        Row: {
          admin_username: string | null
          admin_wa: string | null
          buyer_mode: number
          created_at: string
          crypto_enabled: boolean
          force_join: Json
          id: string
          is_active: boolean
          keyboard: Json
          name: string
          owner_id: string
          tg_bot_id: number
          token: string
          username: string
          webhook_at: string | null
          webhook_ok: boolean
          webhook_secret: string
        }
        Insert: {
          admin_username?: string | null
          admin_wa?: string | null
          buyer_mode?: number
          created_at?: string
          crypto_enabled?: boolean
          force_join?: Json
          id?: string
          is_active?: boolean
          keyboard?: Json
          name: string
          owner_id: string
          tg_bot_id: number
          token: string
          username: string
          webhook_at?: string | null
          webhook_ok?: boolean
          webhook_secret: string
        }
        Update: {
          admin_username?: string | null
          admin_wa?: string | null
          buyer_mode?: number
          created_at?: string
          crypto_enabled?: boolean
          force_join?: Json
          id?: string
          is_active?: boolean
          keyboard?: Json
          name?: string
          owner_id?: string
          tg_bot_id?: number
          token?: string
          username?: string
          webhook_at?: string | null
          webhook_ok?: boolean
          webhook_secret?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ad_refresh_queue: { Args: never; Returns: undefined }
      cancel_ad_campaign: { Args: { p_id: string }; Returns: number }
      cancel_order: { Args: { p_order: string }; Returns: undefined }
      category_product_counts: {
        Args: never
        Returns: {
          category_id: string
          products: number
        }[]
      }
      chat_partner_state: {
        Args: { p_id: string }
        Returns: {
          seen_at: string
          typing: boolean
        }[]
      }
      claim_ad_voucher: { Args: { p_code: string }; Returns: number }
      conversation_partner_seen: { Args: { p_id: string }; Returns: string }
      create_ad_campaign: {
        Args: {
          p_days: number
          p_keywords: string[]
          p_mode: string
          p_product: string
        }
        Returns: string
      }
      hide_conversations: { Args: { p_ids: string[] }; Returns: undefined }
      is_conversation_participant: { Args: { p_id: string }; Returns: boolean }
      mark_conversation_read: { Args: { p_id: string }; Returns: undefined }
      place_order: {
        Args: {
          p_items: Json
          p_note: string
          p_voucher: string
          p_whatsapp: string
        }
        Returns: string
      }
      product_like_counts: {
        Args: { p_ids: string[] }
        Returns: {
          likes: number
          product_id: string
        }[]
      }
      public_stores: {
        Args: { p_ids: string[] }
        Returns: {
          created_at: string
          description: string
          is_open: boolean
          owner_id: string
          slug: string
          store_name: string
        }[]
      }
      seller_advance_order: {
        Args: { p_delivery: string; p_order: string; p_status: string }
        Returns: undefined
      }
      seller_customers: {
        Args: never
        Returns: {
          buyer_id: string
          buyer_name: string
          completed: number
          last_order: string
          orders: number
          spent: number
        }[]
      }
      set_typing: { Args: { p_id: string }; Returns: undefined }
      sponsored_products: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          campaign_id: string
          product_id: string
        }[]
      }
      start_conversation: { Args: { p_seller: string }; Returns: string }
      store_by_slug: {
        Args: { p_slug: string }
        Returns: {
          created_at: string
          description: string
          is_open: boolean
          owner_id: string
          slug: string
          store_name: string
        }[]
      }
      store_media: {
        Args: { p_ids: string[] }
        Returns: {
          avatar_path: string
          banner_path: string
          owner_id: string
        }[]
      }
      touch_last_seen: { Args: never; Returns: undefined }
      touch_presence: { Args: { p_seller: boolean }; Returns: undefined }
      track_ad_click: { Args: { p_campaign: string }; Returns: undefined }
      variant_stock: {
        Args: { p_product_ids: string[] }
        Returns: {
          available: number
          variant_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
