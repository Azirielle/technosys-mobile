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
      activity_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string | null
          description: string
          id: string
          target_category: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          target_category: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          target_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_contacts: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone_number: string
          role: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          phone_number: string
          role?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone_number?: string
          role?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_edited: boolean | null
          last_edited_by: string | null
          priority: string | null
          scheduled_for: string | null
          send_push: boolean
          status: string
          target_branch_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          audience?: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_edited?: boolean | null
          last_edited_by?: string | null
          priority?: string | null
          scheduled_for?: string | null
          send_push?: boolean
          status?: string
          target_branch_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          audience?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_edited?: boolean | null
          last_edited_by?: string | null
          priority?: string | null
          scheduled_for?: string | null
          send_push?: boolean
          status?: string
          target_branch_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_target_branch_id_fkey"
            columns: ["target_branch_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_versions: {
        Row: {
          apk_file_url: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          release_notes: string | null
          version_name: string
        }
        Insert: {
          apk_file_url: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          release_notes?: string | null
          version_name: string
        }
        Update: {
          apk_file_url?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          release_notes?: string | null
          version_name?: string
        }
        Relationships: []
      }
      attendance_corrections: {
        Row: {
          actor_role: string
          corrected_by: string
          corrected_time_in: string
          corrected_time_out: string
          correction_type: string
          created_at: string
          id: string
          original_time_in: string | null
          original_time_out: string | null
          reason: string
          target_date: string
          technician_id: string
          time_log_id: string | null
        }
        Insert: {
          actor_role: string
          corrected_by: string
          corrected_time_in: string
          corrected_time_out: string
          correction_type: string
          created_at?: string
          id?: string
          original_time_in?: string | null
          original_time_out?: string | null
          reason: string
          target_date: string
          technician_id: string
          time_log_id?: string | null
        }
        Update: {
          actor_role?: string
          corrected_by?: string
          corrected_time_in?: string
          corrected_time_out?: string
          correction_type?: string
          created_at?: string
          id?: string
          original_time_in?: string | null
          original_time_out?: string | null
          reason?: string
          target_date?: string
          technician_id?: string
          time_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_time_log_id_fkey"
            columns: ["time_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          app_time_in: string | null
          app_time_out: string | null
          clocked_out_by: string | null
          created_at: string | null
          device_id: string | null
          geofence_status: string | null
          gps_accuracy: number | null
          id: string
          is_manual_entry: boolean
          is_mocked: boolean | null
          is_suspicious: boolean | null
          latitude: number | null
          longitude: number | null
          photo_status: string | null
          photo_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          technician_id: string | null
          total_hours: number | null
          verified_with_machine: boolean | null
        }
        Insert: {
          app_time_in?: string | null
          app_time_out?: string | null
          clocked_out_by?: string | null
          created_at?: string | null
          device_id?: string | null
          geofence_status?: string | null
          gps_accuracy?: number | null
          id?: string
          is_manual_entry?: boolean
          is_mocked?: boolean | null
          is_suspicious?: boolean | null
          latitude?: number | null
          longitude?: number | null
          photo_status?: string | null
          photo_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          technician_id?: string | null
          total_hours?: number | null
          verified_with_machine?: boolean | null
        }
        Update: {
          app_time_in?: string | null
          app_time_out?: string | null
          clocked_out_by?: string | null
          created_at?: string | null
          device_id?: string | null
          geofence_status?: string | null
          gps_accuracy?: number | null
          id?: string
          is_manual_entry?: boolean
          is_mocked?: boolean | null
          is_suspicious?: boolean | null
          latitude?: number | null
          longitude?: number | null
          photo_status?: string | null
          photo_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          technician_id?: string | null
          total_hours?: number | null
          verified_with_machine?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_clocked_out_by_fkey"
            columns: ["clocked_out_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      biometric_scans: {
        Row: {
          employee_id: string
          id: string
          scanned_at: string | null
        }
        Insert: {
          employee_id: string
          id?: string
          scanned_at?: string | null
        }
        Update: {
          employee_id?: string
          id?: string
          scanned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biometric_scans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      casual_helpers: {
        Row: {
          contact_number: string
          created_at: string
          emergency_contact: string | null
          full_name: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_number: string
          created_at?: string
          emergency_contact?: string | null
          full_name: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_number?: string
          created_at?: string
          emergency_contact?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_change_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          device_id: string
          device_name: string | null
          id: string
          profile_id: string
          requested_at: string
          status: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          device_id: string
          device_name?: string | null
          id?: string
          profile_id: string
          requested_at?: string
          status?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          device_id?: string
          device_name?: string | null
          id?: string
          profile_id?: string
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_change_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_change_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          content: string
          created_at: string
          document_id: string
          embedding: string
          id: string
          metadata: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          embedding: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          branch_id: string | null
          category: string
          created_at: string
          file_size: number
          file_url: string
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          branch_id?: string | null
          category: string
          created_at?: string
          file_size: number
          file_url: string
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          branch_id?: string | null
          category?: string
          created_at?: string
          file_size?: number
          file_url?: string
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_warnings: {
        Row: {
          attachments: string[] | null
          created_at: string
          details: string
          employee_id: string
          id: string
          incident_date: string | null
          issued_by: string
          last_edited_by: string | null
          policies_violated: string | null
          rejection_reason: string | null
          service_dept_reviewer_id: string | null
          status: string
          subject: string
          updated_at: string
          warning_level: string
        }
        Insert: {
          attachments?: string[] | null
          created_at?: string
          details: string
          employee_id: string
          id?: string
          incident_date?: string | null
          issued_by: string
          last_edited_by?: string | null
          policies_violated?: string | null
          rejection_reason?: string | null
          service_dept_reviewer_id?: string | null
          status?: string
          subject: string
          updated_at?: string
          warning_level: string
        }
        Update: {
          attachments?: string[] | null
          created_at?: string
          details?: string
          employee_id?: string
          id?: string
          incident_date?: string | null
          issued_by?: string
          last_edited_by?: string | null
          policies_violated?: string | null
          rejection_reason?: string | null
          service_dept_reviewer_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
          warning_level?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string | null
          holiday_date: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string | null
          holiday_date: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string | null
          holiday_date?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          attachment_url: string | null
          created_at: string | null
          end_date: string
          id: string
          leave_type: string
          reason: string
          rejection_reason: string | null
          start_date: string
          status: string
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          leave_type: string
          reason: string
          rejection_reason?: string | null
          start_date: string
          status?: string
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string
          rejection_reason?: string | null
          start_date?: string
          status?: string
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaves_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_locations: {
        Row: {
          latitude: number
          longitude: number
          status: string | null
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          latitude: number
          longitude: number
          status?: string | null
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          latitude?: number
          longitude?: number
          status?: string | null
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_locations_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          profile_id: string
          set_by: string | null
          updated_at: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          profile_id: string
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          profile_id?: string
          set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_pins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_pins_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      office_locations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name?: string
          radius_meters?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      overtime_requests: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          request_date: string
          requested_hours: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          technician_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          request_date: string
          requested_hours: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          technician_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          request_date?: string
          requested_hours?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          archived_at: string | null
          category: string
          content_hash: string | null
          content_markdown: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          is_active: boolean
          is_mandatory: boolean
          is_material_change: boolean
          parent_policy_id: string | null
          published_at: string | null
          review_notes: string | null
          reviewed_by: string | null
          status: string
          summary: string
          target_audience: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          archived_at?: string | null
          category: string
          content_hash?: string | null
          content_markdown: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id: string
          is_active?: boolean
          is_mandatory?: boolean
          is_material_change?: boolean
          parent_policy_id?: string | null
          published_at?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          status?: string
          summary: string
          target_audience?: string
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          content_hash?: string | null
          content_markdown?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          is_material_change?: boolean
          parent_policy_id?: string | null
          published_at?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          status?: string
          summary?: string
          target_audience?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_parent_policy_id_fkey"
            columns: ["parent_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          ip_address: string | null
          policy_id: string
          policy_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          ip_address?: string | null
          policy_id: string
          policy_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          ip_address?: string | null
          policy_id?: string
          policy_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_acknowledgments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          contact_number: string | null
          created_at: string | null
          employment_status: string | null
          full_name: string
          has_medical_clearance: boolean
          has_nbi_clearance: boolean
          has_pagibig_id: boolean
          has_philhealth_id: boolean
          has_resume: boolean
          has_sss_id: boolean
          hire_date: string | null
          id: string
          is_driver: boolean
          lifecycle_status: string
          manager_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          technician_level: string | null
          user_preferences: Json | null
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          contact_number?: string | null
          created_at?: string | null
          employment_status?: string | null
          full_name: string
          has_medical_clearance?: boolean
          has_nbi_clearance?: boolean
          has_pagibig_id?: boolean
          has_philhealth_id?: boolean
          has_resume?: boolean
          has_sss_id?: boolean
          hire_date?: string | null
          id: string
          is_driver?: boolean
          lifecycle_status?: string
          manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          technician_level?: string | null
          user_preferences?: Json | null
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          contact_number?: string | null
          created_at?: string | null
          employment_status?: string | null
          full_name?: string
          has_medical_clearance?: boolean
          has_nbi_clearance?: boolean
          has_pagibig_id?: boolean
          has_philhealth_id?: boolean
          has_resume?: boolean
          has_sss_id?: boolean
          hire_date?: string | null
          id?: string
          is_driver?: boolean
          lifecycle_status?: string
          manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          technician_level?: string | null
          user_preferences?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notifications_queue: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          processed_at: string | null
          status: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          processed_at?: string | null
          status?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          processed_at?: string | null
          status?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string | null
          id: string
          platform: string | null
          token: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token?: string
          user_id?: string | null
        }
        Relationships: []
      }
      registered_devices: {
        Row: {
          device_id: string
          device_name: string | null
          last_seen_at: string
          profile_id: string
          registered_at: string
        }
        Insert: {
          device_id: string
          device_name?: string | null
          last_seen_at?: string
          profile_id: string
          registered_at?: string
        }
        Update: {
          device_id?: string
          device_name?: string | null
          last_seen_at?: string
          profile_id?: string
          registered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registered_devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_access: {
        Row: {
          granted_modules: string[]
          id: string
          override_metadata: Json | null
          role_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          granted_modules?: string[]
          id?: string
          override_metadata?: Json | null
          role_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          granted_modules?: string[]
          id?: string
          override_metadata?: Json | null
          role_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_access_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_casual_helpers: {
        Row: {
          casual_helper_id: string
          created_at: string
          id: string
          notes: string | null
          schedule_id: string
        }
        Insert: {
          casual_helper_id: string
          created_at?: string
          id?: string
          notes?: string | null
          schedule_id: string
        }
        Update: {
          casual_helper_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_casual_helpers_casual_helper_id_fkey"
            columns: ["casual_helper_id"]
            isOneToOne: false
            referencedRelation: "casual_helpers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_casual_helpers_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_crew: {
        Row: {
          assignment_role: string
          created_at: string
          id: string
          joined_at: string
          notes: string | null
          released_at: string | null
          schedule_id: string
          status: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          assignment_role?: string
          created_at?: string
          id?: string
          joined_at?: string
          notes?: string | null
          released_at?: string | null
          schedule_id: string
          status?: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          assignment_role?: string
          created_at?: string
          id?: string
          joined_at?: string
          notes?: string | null
          released_at?: string | null
          schedule_id?: string
          status?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_crew_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_crew_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_history: {
        Row: {
          action_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_payload: Json | null
          previous_payload: Json | null
          reason: string | null
          schedule_id: string
        }
        Insert: {
          action_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_payload?: Json | null
          previous_payload?: Json | null
          reason?: string | null
          schedule_id: string
        }
        Update: {
          action_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_payload?: Json | null
          previous_payload?: Json | null
          reason?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_history_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          assignment_type: string | null
          attendance_mode: string
          attendance_tracking_mode: string
          cancellation_reason: string | null
          client_name: string
          created_at: string | null
          driver_id: string | null
          end_time: string | null
          geofence_lat: number | null
          geofence_lon: number | null
          geofence_radius: number | null
          id: string
          is_vip_hook: boolean | null
          location: string
          project_name: string | null
          reporting_instruction: string | null
          senior_partner_id: string | null
          start_time: string
          status: string | null
          target_review_date: string | null
          technician_id: string | null
          updated_at: string | null
        }
        Insert: {
          assignment_type?: string | null
          attendance_mode?: string
          attendance_tracking_mode?: string
          cancellation_reason?: string | null
          client_name: string
          created_at?: string | null
          driver_id?: string | null
          end_time?: string | null
          geofence_lat?: number | null
          geofence_lon?: number | null
          geofence_radius?: number | null
          id?: string
          is_vip_hook?: boolean | null
          location: string
          project_name?: string | null
          reporting_instruction?: string | null
          senior_partner_id?: string | null
          start_time: string
          status?: string | null
          target_review_date?: string | null
          technician_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assignment_type?: string | null
          attendance_mode?: string
          attendance_tracking_mode?: string
          cancellation_reason?: string | null
          client_name?: string
          created_at?: string | null
          driver_id?: string | null
          end_time?: string | null
          geofence_lat?: number | null
          geofence_lon?: number | null
          geofence_radius?: number | null
          id?: string
          is_vip_hook?: boolean | null
          location?: string
          project_name?: string | null
          reporting_instruction?: string | null
          senior_partner_id?: string | null
          start_time?: string
          status?: string | null
          target_review_date?: string | null
          technician_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_senior_partner_id_fkey"
            columns: ["senior_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_access: {
        Row: {
          created_at: string | null
          expires_at: string
          granted_by: string
          granted_role: string
          id: string
          is_active: boolean | null
          target_user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          granted_by: string
          granted_role: string
          id?: string
          is_active?: boolean | null
          target_user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          granted_by?: string
          granted_role?: string
          id?: string
          is_active?: boolean | null
          target_user_id?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          read_at: string | null
          sender_role: string | null
          ticket_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          read_at?: string | null
          sender_role?: string | null
          ticket_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          read_at?: string | null
          sender_role?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          admin_summary: string | null
          assigned_to: string | null
          attachment_type: string | null
          attachment_url: string | null
          category: string
          created_at: string | null
          description: string
          employee_id: string
          handling_mode: string | null
          id: string
          idempotency_key: string | null
          is_archived: boolean | null
          priority: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          admin_summary?: string | null
          assigned_to?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          category: string
          created_at?: string | null
          description: string
          employee_id: string
          handling_mode?: string | null
          id?: string
          idempotency_key?: string | null
          is_archived?: boolean | null
          priority?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          admin_summary?: string | null
          assigned_to?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          category?: string
          created_at?: string | null
          description?: string
          employee_id?: string
          handling_mode?: string | null
          id?: string
          idempotency_key?: string | null
          is_archived?: boolean | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_borrowings: {
        Row: {
          condition_notes: string | null
          condition_on_return: string | null
          damage_fee: number | null
          handed_over_at: string | null
          id: string
          notes: string | null
          quantity: number
          received_by: string | null
          returned_at: string | null
          status: string | null
          technician_id: string | null
          tool_id: string | null
        }
        Insert: {
          condition_notes?: string | null
          condition_on_return?: string | null
          damage_fee?: number | null
          handed_over_at?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          received_by?: string | null
          returned_at?: string | null
          status?: string | null
          technician_id?: string | null
          tool_id?: string | null
        }
        Update: {
          condition_notes?: string | null
          condition_on_return?: string | null
          damage_fee?: number | null
          handed_over_at?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          received_by?: string | null
          returned_at?: string | null
          status?: string | null
          technician_id?: string | null
          tool_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_borrowings_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_borrowings_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_borrowings_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          available_stock: number | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_serialized: boolean | null
          name: string
          serial_number: string | null
          status: string | null
          total_stock: number | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          available_stock?: number | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_serialized?: boolean | null
          name: string
          serial_number?: string | null
          status?: string | null
          total_stock?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          available_stock?: number | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_serialized?: boolean | null
          name?: string
          serial_number?: string | null
          status?: string | null
          total_stock?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      transactional_sms_logs: {
        Row: {
          cascade_reason: string
          category: string
          created_at: string
          error_details: string | null
          id: string
          message: string
          provider: string
          provider_message_id: string | null
          recipient_id: string | null
          recipient_phone: string
          status: string
        }
        Insert: {
          cascade_reason: string
          category: string
          created_at?: string
          error_details?: string | null
          id?: string
          message: string
          provider: string
          provider_message_id?: string | null
          recipient_id?: string | null
          recipient_phone: string
          status?: string
        }
        Update: {
          cascade_reason?: string
          category?: string
          created_at?: string
          error_details?: string | null
          id?: string
          message?: string
          provider?: string
          provider_message_id?: string | null
          recipient_id?: string | null
          recipient_phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactional_sms_logs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_my_phone: { Args: { p_device_id: string }; Returns: string }
      decide_phone_change: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: undefined
      }
      file_phone_change: {
        Args: {
          p_device_id: string
          p_device_name: string
          p_profile_id: string
        }
        Returns: undefined
      }
      get_email_from_contact: { Args: { p_contact: string }; Returns: string }
      get_server_time: { Args: never; Returns: string }
      is_ceo_or_hr: { Args: never; Returns: boolean }
      is_office_staff: { Args: never; Returns: boolean }
      is_on_schedule: { Args: { p_schedule_id: string }; Returns: boolean }
      login_pin_status: { Args: { p_profile_id: string }; Returns: Json }
      match_documents: {
        Args: {
          filter?: Json
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_phone: {
        Args: {
          p_device_id: string
          p_device_name: string
          p_profile_id: string
        }
        Returns: string
      }
      my_role: { Args: never; Returns: string }
      normalize_ph_mobile: { Args: { p: string }; Returns: string }
      phone_status: {
        Args: { p_device_id: string; p_profile_id: string }
        Returns: string
      }
      pin_sign_in: {
        Args: {
          p_contact: string
          p_device_id: string
          p_device_name: string
          p_pin: string
          p_request_change?: boolean
        }
        Returns: Json
      }
      register_my_phone: {
        Args: { p_device_id: string; p_device_name: string }
        Returns: string
      }
      request_my_phone_change: {
        Args: { p_device_id: string; p_device_name: string }
        Returns: undefined
      }
      reset_registered_phone: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      set_login_pin: {
        Args: { p_pin: string; p_profile_id: string }
        Returns: undefined
      }
    }
    Enums: {
      pay_cycle_target: "15th" | "end_of_month" | "both"
      user_role: "ceo" | "hr" | "coordinator" | "technician" | "helper"
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
      pay_cycle_target: ["15th", "end_of_month", "both"],
      user_role: ["ceo", "hr", "coordinator", "technician", "helper"],
    },
  },
} as const
