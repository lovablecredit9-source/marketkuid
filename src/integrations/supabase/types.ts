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
      account_bans: {
        Row: {
          banned_by: string | null
          banned_until: string | null
          created_at: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          banned_until?: string | null
          created_at?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string | null
          banned_until?: string | null
          created_at?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          note: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_type?: string
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
      category_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          icon_path: string | null
          id: string
          name: string
          owner_id: string
          reviewed_at: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          icon_path?: string | null
          id?: string
          name: string
          owner_id?: string
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          icon_path?: string | null
          id?: string
          name?: string
          owner_id?: string
          reviewed_at?: string | null
          status?: string
        }
        Relationships: []
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
      deposit_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          method_id: string | null
          method_label: string | null
          proof_path: string
          purpose: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          method_id?: string | null
          method_label?: string | null
          proof_path: string
          purpose?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          method_id?: string | null
          method_label?: string | null
          proof_path?: string
          purpose?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      dispute_messages: {
        Row: {
          attachment_path: string | null
          body: string
          created_at: string
          dispute_id: string
          id: string
          sender_id: string | null
          sender_role: string
        }
        Insert: {
          attachment_path?: string | null
          body?: string
          created_at?: string
          dispute_id: string
          id?: string
          sender_id?: string | null
          sender_role: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          created_at?: string
          dispute_id?: string
          id?: string
          sender_id?: string | null
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "order_disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_path: string | null
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          hidden_for: string[]
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
          deleted_at?: string | null
          delivered_at?: string | null
          hidden_for?: string[]
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
          deleted_at?: string | null
          delivered_at?: string | null
          hidden_for?: string[]
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
      order_disputes: {
        Row: {
          buyer_id: string
          code: string
          created_at: string
          id: string
          note: string | null
          order_id: string
          reasons: string[]
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          code?: string
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          reasons?: string[]
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          code?: string
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          reasons?: string[]
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      order_payments: {
        Row: {
          admin_note: string | null
          amount: number
          buyer_id: string
          checkout_id: string
          created_at: string
          id: string
          method_id: string | null
          method_label: string
          proof_path: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          buyer_id: string
          checkout_id: string
          created_at?: string
          id?: string
          method_id?: string | null
          method_label?: string
          proof_path: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          buyer_id?: string
          checkout_id?: string
          created_at?: string
          id?: string
          method_id?: string | null
          method_label?: string
          proof_path?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_fee: number
          buyer_confirmed_at: string | null
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
          payment_method: string | null
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
          buyer_confirmed_at?: string | null
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
          payment_method?: string | null
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
          buyer_confirmed_at?: string | null
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
          payment_method?: string | null
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
      payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          provider: string
          qr_path: string | null
          sort: number
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          provider: string
          qr_path?: string | null
          sort?: number
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          provider?: string
          qr_path?: string | null
          sort?: number
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          account_name: string | null
          id: number
          instructions: string | null
          min_deposit: number
          qris_path: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          id?: number
          instructions?: string | null
          min_deposit?: number
          qris_path?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          id?: number
          instructions?: string | null
          min_deposit?: number
          qris_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          sort: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          buyer_id: string
          buyer_label: string
          comment: string | null
          created_at: string
          edited_at: string | null
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
          edited_at?: string | null
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
          edited_at?: string | null
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
          reuse_at: string | null
          status: string
          variant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          owner_id: string
          product_id: string
          reuse_at?: string | null
          status?: string
          variant_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          product_id?: string
          reuse_at?: string | null
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
          admin_hidden: boolean
          admin_note: string | null
          category_id: string | null
          code_subtype: string | null
          created_at: string
          custom_fields: string[]
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
          stock_mode: string
          updated_at: string
          usage_guide: string
          view_count: number
          work_estimate: string | null
        }
        Insert: {
          admin_hidden?: boolean
          admin_note?: string | null
          category_id?: string | null
          code_subtype?: string | null
          created_at?: string
          custom_fields?: string[]
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
          stock_mode?: string
          updated_at?: string
          usage_guide?: string
          view_count?: number
          work_estimate?: string | null
        }
        Update: {
          admin_hidden?: boolean
          admin_note?: string | null
          category_id?: string | null
          code_subtype?: string | null
          created_at?: string
          custom_fields?: string[]
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
          stock_mode?: string
          updated_at?: string
          usage_guide?: string
          view_count?: number
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
      rekber_deals: {
        Row: {
          admin_note: string | null
          amount: number
          buyer_id: string | null
          buyer_pays: number
          code: string
          completed_at: string | null
          created_at: string
          deposit_deadline: string
          details: string | null
          dispute_by: string | null
          dispute_reason: string | null
          fee: number
          fee_bearer: string
          funded_at: string | null
          id: string
          seller_id: string
          seller_receives: number
          share_token: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          buyer_id?: string | null
          buyer_pays: number
          code?: string
          completed_at?: string | null
          created_at?: string
          deposit_deadline?: string
          details?: string | null
          dispute_by?: string | null
          dispute_reason?: string | null
          fee: number
          fee_bearer: string
          funded_at?: string | null
          id?: string
          seller_id: string
          seller_receives: number
          share_token?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          buyer_id?: string | null
          buyer_pays?: number
          code?: string
          completed_at?: string | null
          created_at?: string
          deposit_deadline?: string
          details?: string | null
          dispute_by?: string | null
          dispute_reason?: string | null
          fee?: number
          fee_bearer?: string
          funded_at?: string | null
          id?: string
          seller_id?: string
          seller_receives?: number
          share_token?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_credit_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          owner_id: string
          ref_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          owner_id: string
          ref_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          owner_id?: string
          ref_id?: string | null
        }
        Relationships: []
      }
      seller_credits: {
        Row: {
          balance: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          owner_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_stores: {
        Row: {
          auto_withdraw: boolean
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
          auto_withdraw?: boolean
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
          auto_withdraw?: boolean
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
      store_bans: {
        Row: {
          banned_by: string | null
          banned_until: string | null
          created_at: string
          owner_id: string
          reason: string | null
        }
        Insert: {
          banned_by?: string | null
          banned_until?: string | null
          created_at?: string
          owner_id: string
          reason?: string | null
        }
        Update: {
          banned_by?: string | null
          banned_until?: string | null
          created_at?: string
          owner_id?: string
          reason?: string | null
        }
        Relationships: []
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
          owner_link_code: string | null
          owner_link_expires: string | null
          owner_linked_at: string | null
          owner_tg_id: number | null
          owner_tg_name: string | null
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
          owner_link_code?: string | null
          owner_link_expires?: string | null
          owner_linked_at?: string | null
          owner_tg_id?: number | null
          owner_tg_name?: string | null
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
          owner_link_code?: string | null
          owner_link_expires?: string | null
          owner_linked_at?: string | null
          owner_tg_id?: number | null
          owner_tg_name?: string | null
          tg_bot_id?: number
          token?: string
          username?: string
          webhook_at?: string | null
          webhook_ok?: boolean
          webhook_secret?: string
        }
        Relationships: []
      }
      telegram_broadcasts: {
        Row: {
          bot_id: string
          created_at: string
          failed: number
          finished_at: string | null
          id: string
          image_path: string | null
          message: string
          owner_id: string
          recipients: number
          sent: number
          status: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          failed?: number
          finished_at?: string | null
          id?: string
          image_path?: string | null
          message: string
          owner_id: string
          recipients?: number
          sent?: number
          status?: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          failed?: number
          finished_at?: string | null
          id?: string
          image_path?: string | null
          message?: string
          owner_id?: string
          recipients?: number
          sent?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_broadcasts_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_notifications: {
        Row: {
          attempts: number
          bot_id: string
          chat_id: number
          created_at: string
          dispute_id: string | null
          error: string | null
          id: string
          kind: string
          order_id: string | null
          sent_at: string | null
        }
        Insert: {
          attempts?: number
          bot_id: string
          chat_id: number
          created_at?: string
          dispute_id?: string | null
          error?: string | null
          id?: string
          kind: string
          order_id?: string | null
          sent_at?: string | null
        }
        Update: {
          attempts?: number
          bot_id?: string
          chat_id?: number
          created_at?: string
          dispute_id?: string | null
          error?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notifications_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          ref_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          ref_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      warranty_claims: {
        Row: {
          buyer_id: string
          code: string
          created_at: string
          id: string
          order_id: string
          order_item_id: string
          product_name: string
          proof_path: string | null
          reason: string
          replacement: string[]
          reviewed_at: string | null
          seller_id: string
          seller_note: string | null
          status: string
        }
        Insert: {
          buyer_id: string
          code?: string
          created_at?: string
          id?: string
          order_id: string
          order_item_id: string
          product_name: string
          proof_path?: string | null
          reason: string
          replacement?: string[]
          reviewed_at?: string | null
          seller_id: string
          seller_note?: string | null
          status?: string
        }
        Update: {
          buyer_id?: string
          code?: string
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string
          product_name?: string
          proof_path?: string | null
          reason?: string
          replacement?: string[]
          reviewed_at?: string | null
          seller_id?: string
          seller_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
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
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          auto: boolean
          bank_holder: string | null
          bank_number: string
          bank_provider: string
          bank_type: string | null
          created_at: string
          fee: number
          id: string
          net: number
          reviewed_at: string | null
          reviewed_by: string | null
          same_day: boolean
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          auto?: boolean
          bank_holder?: string | null
          bank_number: string
          bank_provider: string
          bank_type?: string | null
          created_at?: string
          fee?: number
          id?: string
          net: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          same_day?: boolean
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          auto?: boolean
          bank_holder?: string | null
          bank_number?: string
          bank_provider?: string
          bank_type?: string | null
          created_at?: string
          fee?: number
          id?: string
          net?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          same_day?: boolean
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _dispute_refund: {
        Args: { p_by: string; p_id: string; p_note: string }
        Returns: undefined
      }
      ad_refresh_queue: { Args: never; Returns: undefined }
      admin_adjust_wallet: {
        Args: { p_amount: number; p_note: string; p_user: string }
        Returns: number
      }
      admin_ban_store: {
        Args: { p_days: number; p_owner: string; p_reason: string }
        Returns: undefined
      }
      admin_ban_user: {
        Args: { p_days: number; p_reason: string; p_user: string }
        Returns: undefined
      }
      admin_log: {
        Args: {
          p_action: string
          p_note: string
          p_target: string
          p_type: string
        }
        Returns: undefined
      }
      admin_resolve_dispute: {
        Args: { p_id: string; p_note: string; p_refund: boolean }
        Returns: undefined
      }
      admin_resolve_rekber: {
        Args: { p_id: string; p_note: string; p_release: boolean }
        Returns: undefined
      }
      admin_review_category_request: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: undefined
      }
      admin_review_deposit: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: undefined
      }
      admin_review_order_payment: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: undefined
      }
      admin_review_withdrawal: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: undefined
      }
      admin_set_product_hidden: {
        Args: { p_hidden: boolean; p_id: string; p_note: string }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      admin_stores: {
        Args: never
        Returns: {
          ban_reason: string
          banned_until: string
          contact_phone: string
          created_at: string
          is_banned: boolean
          is_open: boolean
          orders: number
          owner_email: string
          owner_id: string
          products: number
          revenue: number
          slug: string
          store_name: string
          telegram_username: string
        }[]
      }
      admin_unban_store: { Args: { p_owner: string }; Returns: undefined }
      admin_unban_user: { Args: { p_user: string }; Returns: undefined }
      admin_users: {
        Args: never
        Returns: {
          balance: number
          ban_reason: string
          banned_until: string
          created_at: string
          email: string
          full_name: string
          has_store: boolean
          id: string
          is_admin: boolean
          is_banned: boolean
          last_seen_at: string
          username: string
          whatsapp: string
        }[]
      }
      auto_withdraw_tick: { Args: never; Returns: string }
      buyer_close_dispute: { Args: { p_id: string }; Returns: undefined }
      buyer_confirm_order: { Args: { p_order: string }; Returns: undefined }
      cancel_ad_campaign: { Args: { p_id: string }; Returns: number }
      cancel_order: { Args: { p_order: string }; Returns: undefined }
      cancel_rekber: { Args: { p_id: string }; Returns: undefined }
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
      confirm_rekber: { Args: { p_id: string }; Returns: undefined }
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
      create_credit_topup: {
        Args: { p_amount: number; p_method?: string; p_proof: string }
        Returns: string
      }
      create_deposit: {
        Args: { p_amount: number; p_method?: string; p_proof: string }
        Returns: string
      }
      create_rekber: {
        Args: {
          p_amount: number
          p_details: string
          p_fee_bearer: string
          p_title: string
        }
        Returns: {
          admin_note: string | null
          amount: number
          buyer_id: string | null
          buyer_pays: number
          code: string
          completed_at: string | null
          created_at: string
          deposit_deadline: string
          details: string | null
          dispute_by: string | null
          dispute_reason: string | null
          fee: number
          fee_bearer: string
          funded_at: string | null
          id: string
          seller_id: string
          seller_receives: number
          share_token: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rekber_deals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_seller_for_order: { Args: { p_order: string }; Returns: undefined }
      credit_seller_for_order_now: {
        Args: { p_order: string }
        Returns: undefined
      }
      delete_message: {
        Args: { p_for_all: boolean; p_id: string }
        Returns: undefined
      }
      dispute_rekber: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      edit_review: {
        Args: { p_comment: string; p_id: string; p_rating: number }
        Returns: undefined
      }
      enqueue_seller_tg: {
        Args: {
          p_dispute: string
          p_kind: string
          p_order: string
          p_seller: string
        }
        Returns: undefined
      }
      fulfill_paid_order: {
        Args: { p_method: string; p_order: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hide_conversations: { Args: { p_ids: string[] }; Returns: undefined }
      is_account_banned: { Args: { p_user: string }; Returns: boolean }
      is_claim_item_buyer: { Args: { p_item: string }; Returns: boolean }
      is_claim_item_participant: { Args: { p_item: string }; Returns: boolean }
      is_conversation_participant: { Args: { p_id: string }; Returns: boolean }
      is_dispute_participant: { Args: { p_id: string }; Returns: boolean }
      is_store_banned: { Args: { p_owner: string }; Returns: boolean }
      item_warranty_info: {
        Args: { p_item: string }
        Returns: {
          active: boolean
          ends_at: string
          max_claims: number
          used: number
        }[]
      }
      mark_conversation_read: { Args: { p_id: string }; Returns: undefined }
      my_bans: {
        Args: never
        Returns: {
          banned_until: string
          kind: string
          reason: string
        }[]
      }
      open_dispute: {
        Args: { p_note: string; p_order: string; p_reasons: string[] }
        Returns: string
      }
      open_warranty_claim: {
        Args: { p_item: string; p_proof?: string; p_reason: string }
        Returns: string
      }
      order_release_at: { Args: { p_order: string }; Returns: string }
      order_warranty_days: { Args: { p_order: string }; Returns: number }
      pay_order_with_wallet: { Args: { p_checkout: string }; Returns: number }
      pay_rekber: { Args: { p_token: string }; Returns: number }
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
      public_store_vouchers: {
        Args: { p_owner: string }
        Returns: {
          code: string
          kind: string
          max_discount: number
          min_spend: number
          name: string
          value: number
          value_type: string
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
      record_product_view: { Args: { p_product: string }; Returns: undefined }
      registration_availability: {
        Args: { p_email: string; p_username: string }
        Returns: {
          email_taken: boolean
          username_taken: boolean
        }[]
      }
      rekber_by_token: {
        Args: { p_token: string }
        Returns: {
          amount: number
          buyer_pays: number
          code: string
          created_at: string
          deposit_deadline: string
          details: string
          fee: number
          fee_bearer: string
          id: string
          is_buyer: boolean
          is_seller: boolean
          status: string
          store_name: string
          store_slug: string
          taken: boolean
          title: string
        }[]
      }
      release_seller_holds: { Args: never; Returns: undefined }
      request_withdrawal: {
        Args: { p_auto?: boolean; p_same_day?: boolean }
        Returns: string
      }
      review_public_label: { Args: { p_username: string }; Returns: string }
      search_stores: {
        Args: { p_limit?: number; p_q: string }
        Returns: {
          is_open: boolean
          owner_id: string
          product_count: number
          rating_avg: number
          review_count: number
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
      seller_holds: {
        Args: never
        Returns: {
          amount: number
          buyer_id: string
          buyer_name: string
          buyer_whatsapp: string
          completed_at: string
          kind: string
          order_id: string
          order_no: number
          product_name: string
          release_at: string
          warranty_days: number
        }[]
      }
      seller_respond_dispute: {
        Args: { p_action: string; p_id: string }
        Returns: undefined
      }
      seller_review_warranty_claim: {
        Args: { p_approve: boolean; p_claim: string; p_note?: string }
        Returns: undefined
      }
      seller_start_conversation: { Args: { p_buyer: string }; Returns: string }
      send_dispute_message: {
        Args: { p_attachment: string; p_body: string; p_id: string }
        Returns: undefined
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
      stock_available: { Args: { p_variant: string }; Returns: number }
      store_ban_status: { Args: { p_owner: string }; Returns: boolean }
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
      submit_order_payment: {
        Args: { p_checkout: string; p_method?: string; p_proof: string }
        Returns: string
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
