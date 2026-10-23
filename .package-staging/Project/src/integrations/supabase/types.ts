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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      bill_lines: {
        Row: {
          bill_id: string
          created_at: string
          description: string
          id: string
          line_total: number
          organization_id: string
          position: number
          product_id: string | null
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          bill_id: string
          created_at?: string
          description: string
          id?: string
          line_total?: number
          organization_id: string
          position?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          bill_id?: string
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          organization_id?: string
          position?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_payment_links: {
        Row: {
          applied_amount: number
          bill_id: string
          bill_payment_id: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          applied_amount: number
          bill_id: string
          bill_payment_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          applied_amount?: number
          bill_id?: string
          bill_payment_id?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: []
      }
      bill_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          exchange_rate: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          organization_id: string
          payment_date: string
          reference: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          currency?: string
          exchange_rate?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          organization_id: string
          payment_date?: string
          reference?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          exchange_rate?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          organization_id?: string
          payment_date?: string
          reference?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      bills: {
        Row: {
          amount_paid: number
          bill_number: string
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          exchange_rate: number
          id: string
          issue_date: string
          notes: string | null
          organization_id: string
          status: Database["public"]["Enums"]["bill_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          vendor_id: string | null
          vendor_reference: string | null
        }
        Insert: {
          amount_paid?: number
          bill_number: string
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          vendor_id?: string | null
          vendor_reference?: string | null
        }
        Update: {
          amount_paid?: number
          bill_number?: string
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          vendor_id?: string | null
          vendor_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_lines: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string
          id: string
          line_total: number
          organization_id: string
          position: number
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description: string
          id?: string
          line_total?: number
          organization_id: string
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string
          id?: string
          line_total?: number
          organization_id?: string
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: []
      }
      credit_notes: {
        Row: {
          created_at: string
          created_by: string
          credit_number: string
          currency: string
          customer_id: string | null
          id: string
          invoice_id: string | null
          issue_date: string
          organization_id: string
          reason: string | null
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          credit_number: string
          currency?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          issue_date?: string
          organization_id: string
          reason?: string | null
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          credit_number?: string
          currency?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          issue_date?: string
          organization_id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          billing_address: string | null
          billing_name: string
          created_at: string
          created_by: string
          currency: string
          email: string | null
          id: string
          notes: string | null
          organization_id: string
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_name: string
          created_at?: string
          created_by: string
          currency?: string
          email?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_name?: string
          created_at?: string
          created_by?: string
          currency?: string
          email?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          currency: string
          description: string
          exchange_rate: number
          expense_date: string
          id: string
          notes: string | null
          organization_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference: string | null
          tax_amount: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          description: string
          exchange_rate?: number
          expense_date?: string
          id?: string
          notes?: string | null
          organization_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          tax_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          exchange_rate?: number
          expense_date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          tax_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          created_at: string
          from_currency: string
          id: string
          organization_id: string
          rate: number
          rate_date: string
          to_currency: string
        }
        Insert: {
          created_at?: string
          from_currency: string
          id?: string
          organization_id: string
          rate: number
          rate_date?: string
          to_currency: string
        }
        Update: {
          created_at?: string
          from_currency?: string
          id?: string
          organization_id?: string
          rate?: number
          rate_date?: string
          to_currency?: string
        }
        Relationships: []
      }
      inventory_locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          organization_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          location_id: string
          movement_date: string
          movement_type: Database["public"]["Enums"]["inv_movement_type"]
          notes: string | null
          organization_id: string
          product_id: string
          quantity: number
          reference: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          location_id: string
          movement_date?: string
          movement_type: Database["public"]["Enums"]["inv_movement_type"]
          notes?: string | null
          organization_id: string
          product_id: string
          quantity: number
          reference?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          location_id?: string
          movement_date?: string
          movement_type?: Database["public"]["Enums"]["inv_movement_type"]
          notes?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          reference?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          id: string
          location_id: string
          organization_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: string
          organization_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          organization_id: string
          position: number
          product_id: string | null
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          organization_id: string
          position?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          organization_id?: string
          position?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string
          currency: string
          customer_id: string | null
          due_date: string | null
          exchange_rate: number
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          organization_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by: string
          currency?: string
          customer_id?: string | null
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string | null
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string
          entry_date: string
          id: string
          is_posted: boolean
          memo: string | null
          organization_id: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          entry_date?: string
          id?: string
          is_posted?: boolean
          memo?: string | null
          organization_id: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entry_date?: string
          id?: string
          is_posted?: boolean
          memo?: string | null
          organization_id?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          entry_id: string
          id: string
          organization_id: string
          position: number
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id: string
          id?: string
          organization_id: string
          position?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id?: string
          id?: string
          organization_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string
          created_at: string
          created_by: string
          currency: string
          id: string
          name: string
          tax_regime: string | null
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          name: string
          tax_regime?: string | null
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          name?: string
          tax_regime?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_invoice_links: {
        Row: {
          applied_amount: number
          created_at: string
          id: string
          invoice_id: string
          organization_id: string
          payment_id: string
        }
        Insert: {
          applied_amount: number
          created_at?: string
          id?: string
          invoice_id: string
          organization_id: string
          payment_id: string
        }
        Update: {
          applied_amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          organization_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_invoice_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_invoice_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_invoice_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          customer_id: string | null
          exchange_rate: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          organization_id: string
          payment_date: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          currency?: string
          customer_id?: string | null
          exchange_rate?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          organization_id: string
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string | null
          exchange_rate?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          organization_id?: string
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      po_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          organization_id: string
          po_id: string
          position: number
          product_id: string | null
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total?: number
          organization_id: string
          po_id: string
          position?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          organization_id?: string
          po_id?: string
          position?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sale_price: number
          sku: string | null
          tax_rate: number
          track_inventory: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sale_price?: number
          sku?: string | null
          tax_rate?: number
          track_inventory?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sale_price?: number
          sku?: string | null
          tax_rate?: number
          track_inventory?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          converted_bill_id: string | null
          created_at: string
          created_by: string
          currency: string
          expected_date: string | null
          id: string
          issue_date: string
          notes: string | null
          organization_id: string
          po_number: string
          status: Database["public"]["Enums"]["po_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          converted_bill_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          expected_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          po_number: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          converted_bill_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          expected_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          po_number?: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      quote_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          organization_id: string
          position: number
          quantity: number
          quote_id: string
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total?: number
          organization_id: string
          position?: number
          quantity?: number
          quote_id: string
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          organization_id?: string
          position?: number
          quantity?: number
          quote_id?: string
          tax_rate?: number
          unit_price?: number
        }
        Relationships: []
      }
      quotes: {
        Row: {
          converted_invoice_id: string | null
          created_at: string
          created_by: string
          currency: string
          customer_id: string | null
          expiry_date: string | null
          id: string
          issue_date: string
          notes: string | null
          organization_id: string
          quote_number: string
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          converted_invoice_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          customer_id?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          quote_number: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      recurring_invoices: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          customer_id: string | null
          frequency: string
          id: string
          is_active: boolean
          name: string
          next_run_date: string
          organization_id: string
          template: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          customer_id?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          name: string
          next_run_date: string
          organization_id: string
          template: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          next_run_date?: string
          organization_id?: string
          template?: Json
          updated_at?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          currency: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          currency?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_account_id: { Args: { _code: string; _org: string }; Returns: string }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      tg_post_invoice_je_manual: { Args: { _id: string }; Returns: undefined }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      bill_status: "draft" | "open" | "partial" | "paid" | "void"
      credit_note_status: "draft" | "issued" | "applied" | "void"
      inv_movement_type:
        | "receipt"
        | "issue"
        | "adjustment"
        | "transfer_in"
        | "transfer_out"
      invoice_status: "draft" | "sent" | "partial" | "paid" | "void"
      org_role:
        | "owner"
        | "admin"
        | "accountant"
        | "sales"
        | "viewer"
        | "inventory"
      payment_method:
        | "cash"
        | "bank_transfer"
        | "card"
        | "upi"
        | "cheque"
        | "other"
      po_status: "draft" | "sent" | "received" | "closed" | "cancelled"
      quote_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      bill_status: ["draft", "open", "partial", "paid", "void"],
      credit_note_status: ["draft", "issued", "applied", "void"],
      inv_movement_type: [
        "receipt",
        "issue",
        "adjustment",
        "transfer_in",
        "transfer_out",
      ],
      invoice_status: ["draft", "sent", "partial", "paid", "void"],
      org_role: [
        "owner",
        "admin",
        "accountant",
        "sales",
        "viewer",
        "inventory",
      ],
      payment_method: [
        "cash",
        "bank_transfer",
        "card",
        "upi",
        "cheque",
        "other",
      ],
      po_status: ["draft", "sent", "received", "closed", "cancelled"],
      quote_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "converted",
      ],
    },
  },
} as const
