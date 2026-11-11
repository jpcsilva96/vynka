export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_type: string;
          actor_user_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          metadata: Json | null;
          store_id: string | null;
        };
        Insert: {
          action: string;
          actor_type?: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json | null;
          store_id?: string | null;
        };
        Update: {
          action?: string;
          actor_type?: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json | null;
          store_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          active: boolean;
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          parent_id: string | null;
          position: number;
          slug: string;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_order?: number;
          id?: string;
          name: string;
          parent_id?: string | null;
          position?: number;
          slug: string;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_order?: number;
          id?: string;
          name?: string;
          parent_id?: string | null;
          position?: number;
          slug?: string;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_addresses: {
        Row: {
          address_number: string;
          city: string;
          complement: string | null;
          created_at: string;
          customer_id: string;
          id: string;
          is_default: boolean;
          label: string | null;
          neighborhood: string;
          state: string;
          store_id: string;
          street: string;
          updated_at: string;
          zip_code: string;
        };
        Insert: {
          address_number: string;
          city: string;
          complement?: string | null;
          created_at?: string;
          customer_id: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          neighborhood: string;
          state: string;
          store_id: string;
          street: string;
          updated_at?: string;
          zip_code: string;
        };
        Update: {
          address_number?: string;
          city?: string;
          complement?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          neighborhood?: string;
          state?: string;
          store_id?: string;
          street?: string;
          updated_at?: string;
          zip_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_addresses_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_addresses_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_favorites: {
        Row: {
          created_at: string;
          customer_id: string;
          id: string;
          product_id: string;
          store_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: string;
          product_id: string;
          store_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: string;
          product_id?: string;
          store_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_favorites_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_favorites_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_favorites_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_favorites_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address_number: string | null;
          birth_date: string | null;
          city: string | null;
          complement: string | null;
          created_at: string;
          document: string | null;
          email: string | null;
          id: string;
          mobile: string | null;
          name: string;
          neighborhood: string | null;
          notes: string | null;
          phone: string | null;
          state: string | null;
          store_id: string;
          store_login: boolean;
          street: string | null;
          telephone: string | null;
          updated_at: string;
          user_id: string | null;
          zip_code: string | null;
        };
        Insert: {
          address_number?: string | null;
          birth_date?: string | null;
          city?: string | null;
          complement?: string | null;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          id?: string;
          mobile?: string | null;
          name: string;
          neighborhood?: string | null;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          store_id: string;
          store_login?: boolean;
          street?: string | null;
          telephone?: string | null;
          updated_at?: string;
          user_id?: string | null;
          zip_code?: string | null;
        };
        Update: {
          address_number?: string | null;
          birth_date?: string | null;
          city?: string | null;
          complement?: string | null;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          id?: string;
          mobile?: string | null;
          name?: string;
          neighborhood?: string | null;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          store_id?: string;
          store_login?: boolean;
          street?: string | null;
          telephone?: string | null;
          updated_at?: string;
          user_id?: string | null;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_categories: {
        Row: {
          active: boolean;
          affects_result: boolean;
          color: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["finance_kind"];
          name: string;
          position: number;
          store_id: string | null;
          system_key: string | null;
        };
        Insert: {
          active?: boolean;
          affects_result?: boolean;
          color?: string;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["finance_kind"];
          name: string;
          position?: number;
          store_id?: string | null;
          system_key?: string | null;
        };
        Update: {
          active?: boolean;
          affects_result?: boolean;
          color?: string;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["finance_kind"];
          name?: string;
          position?: number;
          store_id?: string | null;
          system_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "finance_categories_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_categories_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_entries: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          entry_date: string;
          id: string;
          kind: Database["public"]["Enums"]["finance_kind"];
          notes: string | null;
          status: string;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          entry_date?: string;
          id?: string;
          kind: Database["public"]["Enums"]["finance_kind"];
          notes?: string | null;
          status?: string;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          entry_date?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["finance_kind"];
          notes?: string | null;
          status?: string;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_entries_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "finance_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entries_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entries_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          store_id: string;
          total_cost: number;
          total_price: number;
          unit_cost: number;
          unit_price: number;
          variant_id: string | null;
          variant_name: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          store_id: string;
          total_cost?: number;
          total_price?: number;
          unit_cost?: number;
          unit_price?: number;
          variant_id?: string | null;
          variant_name?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          store_id?: string;
          total_cost?: number;
          total_price?: number;
          unit_cost?: number;
          unit_price?: number;
          variant_id?: string | null;
          variant_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_events: {
        Row: {
          actor: string;
          created_at: string;
          id: string;
          order_id: string;
          status: Database["public"]["Enums"]["order_status"];
          store_id: string;
        };
        Insert: {
          actor: string;
          created_at?: string;
          id?: string;
          order_id: string;
          status: Database["public"]["Enums"]["order_status"];
          store_id: string;
        };
        Update: {
          actor?: string;
          created_at?: string;
          id?: string;
          order_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_events_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_events_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          cancel_reason: string | null;
          change_due: number | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          delivery_address: Json | null;
          delivery_method: string | null;
          discount: number;
          id: string;
          mp_payment_id: string | null;
          mp_payment_status: string | null;
          mp_payment_status_detail: string | null;
          mp_payment_updated_at: string | null;
          mp_preference_id: string | null;
          notes: string | null;
          number: number | null;
          paid_amount: number | null;
          paid_at: string | null;
          payment_details: Json;
          payment_due_at: string | null;
          payment_method: string | null;
          shipping_amount: number;
          shipping_max_days: number | null;
          shipping_min_days: number | null;
          shipping_service_id: number | null;
          shipping_service_name: string | null;
          source: Database["public"]["Enums"]["order_source"];
          status: Database["public"]["Enums"]["order_status"];
          stock_deducted_at: string | null;
          stock_shortage: boolean;
          store_id: string;
          subtotal: number;
          surcharge: number;
          total: number;
          updated_at: string;
        };
        Insert: {
          cancel_reason?: string | null;
          change_due?: number | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          delivery_address?: Json | null;
          delivery_method?: string | null;
          discount?: number;
          id?: string;
          mp_payment_id?: string | null;
          mp_payment_status?: string | null;
          mp_payment_status_detail?: string | null;
          mp_payment_updated_at?: string | null;
          mp_preference_id?: string | null;
          notes?: string | null;
          number?: number | null;
          paid_amount?: number | null;
          paid_at?: string | null;
          payment_details?: Json;
          payment_due_at?: string | null;
          payment_method?: string | null;
          shipping_amount?: number;
          shipping_max_days?: number | null;
          shipping_min_days?: number | null;
          shipping_service_id?: number | null;
          shipping_service_name?: string | null;
          source?: Database["public"]["Enums"]["order_source"];
          status?: Database["public"]["Enums"]["order_status"];
          stock_deducted_at?: string | null;
          stock_shortage?: boolean;
          store_id: string;
          subtotal?: number;
          surcharge?: number;
          total?: number;
          updated_at?: string;
        };
        Update: {
          cancel_reason?: string | null;
          change_due?: number | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          delivery_address?: Json | null;
          delivery_method?: string | null;
          discount?: number;
          id?: string;
          mp_payment_id?: string | null;
          mp_payment_status?: string | null;
          mp_payment_status_detail?: string | null;
          mp_payment_updated_at?: string | null;
          mp_preference_id?: string | null;
          notes?: string | null;
          number?: number | null;
          paid_amount?: number | null;
          paid_at?: string | null;
          payment_details?: Json;
          payment_due_at?: string | null;
          payment_method?: string | null;
          shipping_amount?: number;
          shipping_max_days?: number | null;
          shipping_min_days?: number | null;
          shipping_service_id?: number | null;
          shipping_service_name?: string | null;
          source?: Database["public"]["Enums"]["order_source"];
          status?: Database["public"]["Enums"]["order_status"];
          stock_deducted_at?: string | null;
          stock_shortage?: boolean;
          store_id?: string;
          subtotal?: number;
          surcharge?: number;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_oauth_states: {
        Row: {
          code_verifier: string;
          created_at: string;
          state: string;
          store_id: string;
          user_id: string;
        };
        Insert: {
          code_verifier: string;
          created_at?: string;
          state: string;
          store_id: string;
          user_id: string;
        };
        Update: {
          code_verifier?: string;
          created_at?: string;
          state?: string;
          store_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_oauth_states_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_oauth_states_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_webhook_events: {
        Row: {
          id: number;
          mp_user_id: number | null;
          order_id: string | null;
          processed_at: string | null;
          received_at: string;
          request_id: string | null;
          resource_id: string | null;
          result: string | null;
          store_id: string | null;
          topic: string | null;
        };
        Insert: {
          id?: never;
          mp_user_id?: number | null;
          order_id?: string | null;
          processed_at?: string | null;
          received_at?: string;
          request_id?: string | null;
          resource_id?: string | null;
          result?: string | null;
          store_id?: string | null;
          topic?: string | null;
        };
        Update: {
          id?: never;
          mp_user_id?: number | null;
          order_id?: string | null;
          processed_at?: string | null;
          received_at?: string;
          request_id?: string | null;
          resource_id?: string | null;
          result?: string | null;
          store_id?: string | null;
          topic?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_webhook_events_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_webhook_events_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          allow_custom_domain: boolean;
          allow_site_orders: boolean;
          allow_whatsapp_orders: boolean;
          created_at: string;
          description: string | null;
          id: string;
          max_products: number;
          max_users: number;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          allow_custom_domain?: boolean;
          allow_site_orders?: boolean;
          allow_whatsapp_orders?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          max_products?: number;
          max_users?: number;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          allow_custom_domain?: boolean;
          allow_site_orders?: boolean;
          allow_whatsapp_orders?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          max_products?: number;
          max_users?: number;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_users: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["platform_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      product_daily_views: {
        Row: {
          day: string;
          product_id: string;
          store_id: string;
          views: number;
        };
        Insert: {
          day: string;
          product_id: string;
          store_id: string;
          views?: number;
        };
        Update: {
          day?: string;
          product_id?: string;
          store_id?: string;
          views?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_daily_views_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_daily_views_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_daily_views_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          created_at: string;
          id: string;
          position: number;
          product_id: string;
          storage_path: string | null;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          position?: number;
          product_id: string;
          storage_path?: string | null;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          position?: number;
          product_id?: string;
          storage_path?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_option_values: {
        Row: {
          id: string;
          option_id: string;
          position: number;
          value: string;
        };
        Insert: {
          id?: string;
          option_id: string;
          position?: number;
          value: string;
        };
        Update: {
          id?: string;
          option_id?: string;
          position?: number;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "product_options";
            referencedColumns: ["id"];
          },
        ];
      };
      product_options: {
        Row: {
          id: string;
          name: string;
          position: number;
          product_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          position?: number;
          product_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          position?: number;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          available: boolean;
          created_at: string;
          id: string;
          image_url: string | null;
          options: Json;
          position: number;
          price: number | null;
          product_id: string;
          sku_key: string;
          stock_quantity: number;
          store_id: string;
        };
        Insert: {
          available?: boolean;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          options?: Json;
          position?: number;
          price?: number | null;
          product_id: string;
          sku_key: string;
          stock_quantity?: number;
          store_id: string;
        };
        Update: {
          available?: boolean;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          options?: Json;
          position?: number;
          price?: number | null;
          product_id?: string;
          sku_key?: string;
          stock_quantity?: number;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: string | null;
          cost_price: number;
          created_at: string;
          description: string | null;
          display_order: number;
          featured: boolean;
          height_cm: number | null;
          id: string;
          length_cm: number | null;
          manage_stock: boolean;
          name: string;
          position: number;
          price: number;
          promo_price: number | null;
          slug: string | null;
          status: Database["public"]["Enums"]["product_status"];
          stock_quantity: number;
          store_id: string;
          updated_at: string;
          weight_kg: number | null;
          width_cm: number | null;
        };
        Insert: {
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          featured?: boolean;
          height_cm?: number | null;
          id?: string;
          length_cm?: number | null;
          manage_stock?: boolean;
          name?: string;
          position?: number;
          price?: number;
          promo_price?: number | null;
          slug?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          stock_quantity?: number;
          store_id: string;
          updated_at?: string;
          weight_kg?: number | null;
          width_cm?: number | null;
        };
        Update: {
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          featured?: boolean;
          height_cm?: number | null;
          id?: string;
          length_cm?: number | null;
          manage_stock?: boolean;
          name?: string;
          position?: number;
          price?: number;
          promo_price?: number | null;
          slug?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          stock_quantity?: number;
          store_id?: string;
          updated_at?: string;
          weight_kg?: number | null;
          width_cm?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          cpf: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          cpf?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          cpf?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      shipping_oauth_states: {
        Row: {
          created_at: string;
          environment: string;
          state: string;
          store_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          environment: string;
          state: string;
          store_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          environment?: string;
          state?: string;
          store_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shipping_oauth_states_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shipping_oauth_states_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_banners: {
        Row: {
          active: boolean;
          button_label: string | null;
          created_at: string;
          id: string;
          image_mobile_url: string | null;
          image_url: string;
          link_target: string | null;
          link_type: string;
          sort_order: number;
          store_id: string;
          subtitle: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          button_label?: string | null;
          created_at?: string;
          id?: string;
          image_mobile_url?: string | null;
          image_url: string;
          link_target?: string | null;
          link_type?: string;
          sort_order?: number;
          store_id: string;
          subtitle?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          button_label?: string | null;
          created_at?: string;
          id?: string;
          image_mobile_url?: string | null;
          image_url?: string;
          link_target?: string | null;
          link_type?: string;
          sort_order?: number;
          store_id?: string;
          subtitle?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_banners_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_banners_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_checkout_settings: {
        Row: {
          boleto_expiration_days: number;
          created_at: string;
          free_shipping_local: boolean;
          free_shipping_min_amount: number | null;
          free_shipping_services: number[];
          local_delivery_enabled: boolean;
          local_delivery_max_days: number;
          local_delivery_min_days: number;
          local_delivery_price: number;
          package_height_cm: number;
          package_length_cm: number;
          package_weight_kg: number;
          package_width_cm: number;
          pickup_address: string | null;
          pickup_enabled: boolean;
          pickup_instructions: string | null;
          pix_expiration_hours: number;
          shipping_enabled: boolean;
          shipping_services: number[];
          stock_deduction: string;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          boleto_expiration_days?: number;
          created_at?: string;
          free_shipping_local?: boolean;
          free_shipping_min_amount?: number | null;
          free_shipping_services?: number[];
          local_delivery_enabled?: boolean;
          local_delivery_max_days?: number;
          local_delivery_min_days?: number;
          local_delivery_price?: number;
          package_height_cm?: number;
          package_length_cm?: number;
          package_weight_kg?: number;
          package_width_cm?: number;
          pickup_address?: string | null;
          pickup_enabled?: boolean;
          pickup_instructions?: string | null;
          pix_expiration_hours?: number;
          shipping_enabled?: boolean;
          shipping_services?: number[];
          stock_deduction?: string;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          boleto_expiration_days?: number;
          created_at?: string;
          free_shipping_local?: boolean;
          free_shipping_min_amount?: number | null;
          free_shipping_services?: number[];
          local_delivery_enabled?: boolean;
          local_delivery_max_days?: number;
          local_delivery_min_days?: number;
          local_delivery_price?: number;
          package_height_cm?: number;
          package_length_cm?: number;
          package_weight_kg?: number;
          package_width_cm?: number;
          pickup_address?: string | null;
          pickup_enabled?: boolean;
          pickup_instructions?: string | null;
          pix_expiration_hours?: number;
          shipping_enabled?: boolean;
          shipping_services?: number[];
          stock_deduction?: string;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_checkout_settings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_checkout_settings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_daily_views: {
        Row: {
          day: string;
          store_id: string;
          views: number;
        };
        Insert: {
          day: string;
          store_id: string;
          views?: number;
        };
        Update: {
          day?: string;
          store_id?: string;
          views?: number;
        };
        Relationships: [
          {
            foreignKeyName: "store_daily_views_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_daily_views_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_delivery_cities: {
        Row: {
          city_name: string;
          created_at: string;
          ibge_code: string;
          price: number | null;
          state: string;
          store_id: string;
        };
        Insert: {
          city_name: string;
          created_at?: string;
          ibge_code: string;
          price?: number | null;
          state: string;
          store_id: string;
        };
        Update: {
          city_name?: string;
          created_at?: string;
          ibge_code?: string;
          price?: number | null;
          state?: string;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_delivery_cities_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_delivery_cities_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_members: {
        Row: {
          active: boolean;
          created_at: string;
          email: string | null;
          id: string;
          name: string | null;
          permissions: Json;
          role: Database["public"]["Enums"]["member_role"];
          store_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          permissions?: Json;
          role?: Database["public"]["Enums"]["member_role"];
          store_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          permissions?: Json;
          role?: Database["public"]["Enums"]["member_role"];
          store_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_members_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_payment_connections: {
        Row: {
          access_token: string;
          account_email: string | null;
          account_name: string | null;
          connected_at: string;
          connected_by: string | null;
          expires_at: string;
          last_error: string | null;
          last_error_at: string | null;
          live_mode: boolean;
          mp_user_id: number;
          provider: string;
          public_key: string | null;
          refresh_token: string;
          scope: string | null;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          access_token: string;
          account_email?: string | null;
          account_name?: string | null;
          connected_at?: string;
          connected_by?: string | null;
          expires_at: string;
          last_error?: string | null;
          last_error_at?: string | null;
          live_mode: boolean;
          mp_user_id: number;
          provider?: string;
          public_key?: string | null;
          refresh_token: string;
          scope?: string | null;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          account_email?: string | null;
          account_name?: string | null;
          connected_at?: string;
          connected_by?: string | null;
          expires_at?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          live_mode?: boolean;
          mp_user_id?: number;
          provider?: string;
          public_key?: string | null;
          refresh_token?: string;
          scope?: string | null;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_payment_connections_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_payment_connections_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_settings: {
        Row: {
          created_at: string;
          id: string;
          setting_key: string;
          setting_value: Json | null;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          setting_key: string;
          setting_value?: Json | null;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          setting_key?: string;
          setting_value?: Json | null;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_settings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_shipping_connections: {
        Row: {
          access_token: string;
          account_email: string | null;
          account_name: string | null;
          connected_at: string;
          connected_by: string | null;
          environment: string;
          expires_at: string;
          last_error: string | null;
          last_error_at: string | null;
          provider: string;
          refresh_token: string;
          scope: string | null;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          access_token: string;
          account_email?: string | null;
          account_name?: string | null;
          connected_at?: string;
          connected_by?: string | null;
          environment: string;
          expires_at: string;
          last_error?: string | null;
          last_error_at?: string | null;
          provider?: string;
          refresh_token: string;
          scope?: string | null;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          account_email?: string | null;
          account_name?: string | null;
          connected_at?: string;
          connected_by?: string | null;
          environment?: string;
          expires_at?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          provider?: string;
          refresh_token?: string;
          scope?: string | null;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_shipping_connections_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_shipping_connections_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          accepts_site_orders: boolean;
          accepts_whatsapp_orders: boolean;
          address: string | null;
          address_number: string | null;
          banner_cta: string | null;
          banner_subtitle: string | null;
          banner_title: string | null;
          banner_url: string | null;
          business_hours: string | null;
          city: string | null;
          combine_delivery_whatsapp: boolean;
          complement: string | null;
          created_at: string;
          delivery_available: boolean;
          delivery_notes: string | null;
          description: string | null;
          email: string | null;
          facebook: string | null;
          id: string;
          instagram: string | null;
          logo_url: string | null;
          name: string;
          og_image_url: string | null;
          onboarding_completed_at: string | null;
          onboarding_current_step: number;
          onboarding_status: Database["public"]["Enums"]["onboarding_status"];
          phone: string | null;
          pickup_available: boolean;
          plan_id: string | null;
          publication_status: Database["public"]["Enums"]["publication_status"];
          published_at: string | null;
          responsible_name: string | null;
          segment: string | null;
          slug: string;
          state: string | null;
          status: Database["public"]["Enums"]["store_status"];
          subscription_ends_at: string | null;
          tax_document: string | null;
          tiktok: string | null;
          trial_ends_at: string | null;
          updated_at: string;
          whatsapp: string | null;
          zip_code: string | null;
        };
        Insert: {
          accepts_site_orders?: boolean;
          accepts_whatsapp_orders?: boolean;
          address?: string | null;
          address_number?: string | null;
          banner_cta?: string | null;
          banner_subtitle?: string | null;
          banner_title?: string | null;
          banner_url?: string | null;
          business_hours?: string | null;
          city?: string | null;
          combine_delivery_whatsapp?: boolean;
          complement?: string | null;
          created_at?: string;
          delivery_available?: boolean;
          delivery_notes?: string | null;
          description?: string | null;
          email?: string | null;
          facebook?: string | null;
          id?: string;
          instagram?: string | null;
          logo_url?: string | null;
          name: string;
          og_image_url?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_current_step?: number;
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"];
          phone?: string | null;
          pickup_available?: boolean;
          plan_id?: string | null;
          publication_status?: Database["public"]["Enums"]["publication_status"];
          published_at?: string | null;
          responsible_name?: string | null;
          segment?: string | null;
          slug: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["store_status"];
          subscription_ends_at?: string | null;
          tax_document?: string | null;
          tiktok?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Update: {
          accepts_site_orders?: boolean;
          accepts_whatsapp_orders?: boolean;
          address?: string | null;
          address_number?: string | null;
          banner_cta?: string | null;
          banner_subtitle?: string | null;
          banner_title?: string | null;
          banner_url?: string | null;
          business_hours?: string | null;
          city?: string | null;
          combine_delivery_whatsapp?: boolean;
          complement?: string | null;
          created_at?: string;
          delivery_available?: boolean;
          delivery_notes?: string | null;
          description?: string | null;
          email?: string | null;
          facebook?: string | null;
          id?: string;
          instagram?: string | null;
          logo_url?: string | null;
          name?: string;
          og_image_url?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_current_step?: number;
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"];
          phone?: string | null;
          pickup_available?: boolean;
          plan_id?: string | null;
          publication_status?: Database["public"]["Enums"]["publication_status"];
          published_at?: string | null;
          responsible_name?: string | null;
          segment?: string | null;
          slug?: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["store_status"];
          subscription_ends_at?: string | null;
          tax_document?: string | null;
          tiktok?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stores_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          ends_at: string | null;
          id: string;
          plan_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          store_id: string;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          plan_id: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          store_id: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          plan_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          store_id?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "storefront_stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      storefront_stores: {
        Row: {
          address: string | null;
          address_number: string | null;
          banner_cta: string | null;
          banner_subtitle: string | null;
          banner_title: string | null;
          banner_url: string | null;
          business_hours: string | null;
          city: string | null;
          complement: string | null;
          description: string | null;
          email: string | null;
          id: string | null;
          instagram: string | null;
          logo_url: string | null;
          name: string | null;
          og_image_url: string | null;
          phone: string | null;
          publication_status: Database["public"]["Enums"]["publication_status"] | null;
          responsible_name: string | null;
          slug: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["store_status"] | null;
          tax_document: string | null;
          whatsapp: string | null;
          zip_code: string | null;
        };
        Insert: {
          address?: string | null;
          address_number?: string | null;
          banner_cta?: string | null;
          banner_subtitle?: string | null;
          banner_title?: string | null;
          banner_url?: string | null;
          business_hours?: string | null;
          city?: string | null;
          complement?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string | null;
          instagram?: string | null;
          logo_url?: string | null;
          name?: string | null;
          og_image_url?: string | null;
          phone?: string | null;
          publication_status?: Database["public"]["Enums"]["publication_status"] | null;
          responsible_name?: never;
          slug?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["store_status"] | null;
          tax_document?: never;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Update: {
          address?: string | null;
          address_number?: string | null;
          banner_cta?: string | null;
          banner_subtitle?: string | null;
          banner_title?: string | null;
          banner_url?: string | null;
          business_hours?: string | null;
          city?: string | null;
          complement?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string | null;
          instagram?: string | null;
          logo_url?: string | null;
          name?: string | null;
          og_image_url?: string | null;
          phone?: string | null;
          publication_status?: Database["public"]["Enums"]["publication_status"] | null;
          responsible_name?: never;
          slug?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["store_status"] | null;
          tax_document?: never;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_auth_user_id_by_email: { Args: { _email: string }; Returns: string };
      admin_auth_users_by_ids: {
        Args: { _ids: string[] };
        Returns: {
          email: string;
          id: string;
          last_sign_in_at: string;
          signup_completed: boolean;
        }[];
      };
      apply_item_stock: {
        Args: {
          _product_id: string;
          _quantity: number;
          _sign: number;
          _strict: boolean;
          _variant_id: string;
        };
        Returns: undefined;
      };
      apply_order_stock: {
        Args: { _order_id: string; _sign: number; _strict: boolean };
        Returns: undefined;
      };
      checkout_cart_lines: {
        Args: { _items: Json; _store_id: string };
        Returns: {
          height_cm: number;
          length_cm: number;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_cost: number;
          unit_price: number;
          variant_id: string;
          variant_label: string;
          weight_kg: number;
          width_cm: number;
        }[];
      };
      checkout_delivery_options: {
        Args: {
          _ibge_code: string;
          _quotes?: Json;
          _store_id: string;
          _subtotal: number;
        };
        Returns: {
          free: boolean;
          max_days: number;
          method: string;
          min_days: number;
          name: string;
          original_price: number;
          price: number;
          service_id: number;
        }[];
      };
      confirm_order_payment: {
        Args: { _order_id: string; _paid_at?: string };
        Returns: string;
      };
      create_checkout_order: {
        Args: {
          _address?: Json;
          _delivery: Json;
          _items: Json;
          _notes?: string;
          _quotes?: Json;
          _store_id: string;
          _user_id: string;
        };
        Returns: string;
      };
      customer_store_ok: { Args: { _store_id: string }; Returns: boolean };
      expire_overdue_orders: { Args: never; Returns: number };
      finance_summary: {
        Args: { _from: string; _store_id: string; _to: string };
        Returns: Json;
      };
      is_customer_account: { Args: never; Returns: boolean };
      is_platform_admin: { Args: { _user_id?: string }; Returns: boolean };
      is_store_admin: {
        Args: { _store_id: string; _user_id?: string };
        Returns: boolean;
      };
      is_store_member: {
        Args: { _store_id: string; _user_id?: string };
        Returns: boolean;
      };
      product_store_is_open: { Args: { _product_id: string }; Returns: boolean };
      public_product_sales_rank: {
        Args: { p_store_id: string };
        Returns: {
          product_id: string;
          sales_rank: number;
        }[];
      };
      record_order_payment: {
        Args: {
          _approved_at?: string;
          _method: string;
          _order_id: string;
          _payment_id: string;
          _status: string;
          _status_detail: string;
          _store_id: string;
          _updated_at: string;
        };
        Returns: string;
      };
      set_order_payment_deadline: {
        Args: { _method: string; _order_id: string };
        Returns: string;
      };
      store_file_writable: {
        Args: { _bucket: string; _name: string };
        Returns: boolean;
      };
      store_is_open: { Args: { _store_id: string }; Returns: boolean };
      store_is_public: { Args: { _store_id: string }; Returns: boolean };
      store_payment_connection_status: {
        Args: { _store_id: string };
        Returns: {
          account_email: string;
          account_name: string;
          connected: boolean;
          connected_at: string;
          expires_at: string;
          last_error: string;
          live_mode: boolean;
        }[];
      };
      store_shipping_connection_status: {
        Args: { _store_id: string };
        Returns: {
          account_email: string;
          account_name: string;
          connected: boolean;
          connected_at: string;
          environment: string;
          expires_at: string;
          last_error: string;
        }[];
      };
      track_store_view: {
        Args: { _product_id?: string; _store_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      finance_kind: "income" | "expense" | "adjustment";
      member_role: "owner" | "admin" | "seller";
      onboarding_status: "not_started" | "in_progress" | "completed";
      order_source: "website" | "whatsapp" | "manual";
      order_status:
        | "pending"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "paid"
        | "in_production"
        | "in_dispatch";
      platform_role: "platform_owner" | "super_admin" | "support";
      product_status: "active" | "draft" | "archived";
      publication_status: "draft" | "published" | "unpublished" | "suspended";
      store_status: "trial" | "active" | "suspended" | "cancelled";
      subscription_status: "trial" | "active" | "past_due" | "suspended" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      finance_kind: ["income", "expense", "adjustment"],
      member_role: ["owner", "admin", "seller"],
      onboarding_status: ["not_started", "in_progress", "completed"],
      order_source: ["website", "whatsapp", "manual"],
      order_status: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
        "paid",
        "in_production",
        "in_dispatch",
      ],
      platform_role: ["platform_owner", "super_admin", "support"],
      product_status: ["active", "draft", "archived"],
      publication_status: ["draft", "published", "unpublished", "suspended"],
      store_status: ["trial", "active", "suspended", "cancelled"],
      subscription_status: ["trial", "active", "past_due", "suspended", "cancelled"],
    },
  },
} as const;
