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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          institution: string | null
          is_active: boolean | null
          is_org_wide: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          institution?: string | null
          is_active?: boolean | null
          is_org_wide?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          institution?: string | null
          is_active?: boolean | null
          is_org_wide?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      appraisals: {
        Row: {
          appraisal_period_end: string
          appraisal_period_start: string
          appraisal_type: string
          created_at: string | null
          employee_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          notes: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          appraisal_period_end: string
          appraisal_period_start: string
          appraisal_type: string
          created_at?: string | null
          employee_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          appraisal_period_end?: string
          appraisal_period_start?: string
          appraisal_type?: string
          created_at?: string | null
          employee_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appraisals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_group_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "assignment_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_groups: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          admin_override: boolean | null
          approved_at: string | null
          approved_by: string | null
          calculated_status: string | null
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          date: string
          half_day_type: string | null
          holiday_description: string | null
          holiday_name: string | null
          id: string
          institution_name: string | null
          is_half_day: boolean | null
          is_late: boolean | null
          is_manual_override: boolean | null
          is_national: boolean | null
          modified_at: string | null
          modified_by: string | null
          notes: string | null
          original_status: string | null
          presence_value: number | null
          rejection_reason: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["attendance_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_override?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          calculated_status?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date: string
          half_day_type?: string | null
          holiday_description?: string | null
          holiday_name?: string | null
          id?: string
          institution_name?: string | null
          is_half_day?: boolean | null
          is_late?: boolean | null
          is_manual_override?: boolean | null
          is_national?: boolean | null
          modified_at?: string | null
          modified_by?: string | null
          notes?: string | null
          original_status?: string | null
          presence_value?: number | null
          rejection_reason?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_override?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          calculated_status?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          half_day_type?: string | null
          holiday_description?: string | null
          holiday_name?: string | null
          id?: string
          institution_name?: string | null
          is_half_day?: boolean | null
          is_late?: boolean | null
          is_manual_override?: boolean | null
          is_national?: boolean | null
          modified_at?: string | null
          modified_by?: string | null
          notes?: string | null
          original_status?: string | null
          presence_value?: number | null
          rejection_reason?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_audit: {
        Row: {
          action: string
          attendance_id: string
          change_reason: string | null
          changed_by: string
          created_at: string | null
          id: string
          new_data: Json | null
          new_status: string | null
          old_data: Json | null
          old_status: string | null
        }
        Insert: {
          action: string
          attendance_id: string
          change_reason?: string | null
          changed_by: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          new_status?: string | null
          old_data?: Json | null
          old_status?: string | null
        }
        Update: {
          action?: string
          attendance_id?: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          new_status?: string | null
          old_data?: Json | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_audit_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_rules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          rule_name: string
          rule_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          rule_name: string
          rule_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          rule_name?: string
          rule_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      attendance_summary: {
        Row: {
          absent_days: number | null
          attendance_percentage: number | null
          created_at: string | null
          half_days: number | null
          holiday_count: number | null
          id: string
          late_days: number | null
          late_sets: number | null
          leave_days: number | null
          month: number
          paid_leave_days: number | null
          payroll_days: number | null
          present_days: number | null
          total_paid_days: number | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          absent_days?: number | null
          attendance_percentage?: number | null
          created_at?: string | null
          half_days?: number | null
          holiday_count?: number | null
          id?: string
          late_days?: number | null
          late_sets?: number | null
          leave_days?: number | null
          month: number
          paid_leave_days?: number | null
          payroll_days?: number | null
          present_days?: number | null
          total_paid_days?: number | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          absent_days?: number | null
          attendance_percentage?: number | null
          created_at?: string | null
          half_days?: number | null
          holiday_count?: number | null
          id?: string
          late_days?: number | null
          late_sets?: number | null
          leave_days?: number | null
          month?: number
          paid_leave_days?: number | null
          payroll_days?: number | null
          present_days?: number | null
          total_paid_days?: number | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          created_at: string | null
          description: string | null
          document_link: string | null
          document_type: string | null
          id: string
          title: string
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          document_link?: string | null
          document_type?: string | null
          id?: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          document_link?: string | null
          document_type?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deduction_types: {
        Row: {
          created_at: string | null
          created_by: string | null
          deduction_code: string
          deduction_name: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_statutory: boolean | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deduction_code: string
          deduction_name: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_statutory?: boolean | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deduction_code?: string
          deduction_name?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_statutory?: boolean | null
        }
        Relationships: []
      }
      document_types: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          type_name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          type_name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          type_name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          document_name: string
          document_type: string
          file_url: string
          id: string
          title: string
          uploaded_at: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          document_name: string
          document_type: string
          file_url: string
          id?: string
          title: string
          uploaded_at?: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          document_name?: string
          document_type?: string
          file_url?: string
          id?: string
          title?: string
          uploaded_at?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      earning_structure: {
        Row: {
          created_at: string | null
          display_order: number
          frequency: string
          how_to_earn: string | null
          id: string
          is_active: boolean | null
          monthly_earning: number | null
          rate: number
          task_type: string
          tasks_per_month: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          frequency: string
          how_to_earn?: string | null
          id?: string
          is_active?: boolean | null
          monthly_earning?: number | null
          rate?: number
          task_type: string
          tasks_per_month?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          frequency?: string
          how_to_earn?: string | null
          id?: string
          is_active?: boolean | null
          monthly_earning?: number | null
          rate?: number
          task_type?: string
          tasks_per_month?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      earning_types: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          earning_code: string
          earning_name: string
          id: string
          is_active: boolean | null
          is_taxable: boolean | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          earning_code: string
          earning_name: string
          id?: string
          is_active?: boolean | null
          is_taxable?: boolean | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          earning_code?: string
          earning_name?: string
          id?: string
          is_active?: boolean | null
          is_taxable?: boolean | null
        }
        Relationships: []
      }
      employee_profiles: {
        Row: {
          aadhar_number: string | null
          alternate_phone: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_city: string | null
          bank_ifsc_code: string | null
          bank_name: string | null
          base_salary: number | null
          biometric_id: string | null
          blood_group: string | null
          caste: string | null
          confirmation_date: string | null
          country: string | null
          created_at: string
          current_address: string | null
          current_city: string | null
          current_pincode: string | null
          current_state: string | null
          date_of_birth: string | null
          date_of_joining: string | null
          degree: string | null
          department: string | null
          designation: string | null
          driving_license: string | null
          education_worker_permit: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          employee_id: string | null
          employment_status: string | null
          employment_type: string | null
          engagement_type: string | null
          first_name: string
          gender: string | null
          has_driving_license: boolean | null
          highest_qualification: string | null
          house_number: string | null
          id: string
          institution_assignment: string | null
          is_active: boolean | null
          last_name: string
          marital_status: string | null
          medical_health_condition: string | null
          nationality: string | null
          next_increment_date: string | null
          pan_number: string | null
          passport_expiry: string | null
          passport_number: string | null
          permanent_address: string | null
          permanent_city: string | null
          permanent_pincode: string | null
          permanent_state: string | null
          phone: string | null
          position: string | null
          probation_end_date: string | null
          professional_qualification_teaching: string | null
          profile_photo_url: string | null
          program: string | null
          project_program: string | null
          race: string | null
          religion: string | null
          role_code: string | null
          samagra_id: string | null
          seniority: string | null
          skills: string[] | null
          social_category: string | null
          training_record: string | null
          university: string | null
          updated_at: string
          user_id: string
          vehicle_information: string | null
          wes_mail: string | null
          wes_mail_pass: string | null
          year_of_passing: number | null
        }
        Insert: {
          aadhar_number?: string | null
          alternate_phone?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_city?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          base_salary?: number | null
          biometric_id?: string | null
          blood_group?: string | null
          caste?: string | null
          confirmation_date?: string | null
          country?: string | null
          created_at?: string
          current_address?: string | null
          current_city?: string | null
          current_pincode?: string | null
          current_state?: string | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          degree?: string | null
          department?: string | null
          designation?: string | null
          driving_license?: string | null
          education_worker_permit?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id?: string | null
          employment_status?: string | null
          employment_type?: string | null
          engagement_type?: string | null
          first_name: string
          gender?: string | null
          has_driving_license?: boolean | null
          highest_qualification?: string | null
          house_number?: string | null
          id?: string
          institution_assignment?: string | null
          is_active?: boolean | null
          last_name: string
          marital_status?: string | null
          medical_health_condition?: string | null
          nationality?: string | null
          next_increment_date?: string | null
          pan_number?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          permanent_address?: string | null
          permanent_city?: string | null
          permanent_pincode?: string | null
          permanent_state?: string | null
          phone?: string | null
          position?: string | null
          probation_end_date?: string | null
          professional_qualification_teaching?: string | null
          profile_photo_url?: string | null
          program?: string | null
          project_program?: string | null
          race?: string | null
          religion?: string | null
          role_code?: string | null
          samagra_id?: string | null
          seniority?: string | null
          skills?: string[] | null
          social_category?: string | null
          training_record?: string | null
          university?: string | null
          updated_at?: string
          user_id: string
          vehicle_information?: string | null
          wes_mail?: string | null
          wes_mail_pass?: string | null
          year_of_passing?: number | null
        }
        Update: {
          aadhar_number?: string | null
          alternate_phone?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_city?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          base_salary?: number | null
          biometric_id?: string | null
          blood_group?: string | null
          caste?: string | null
          confirmation_date?: string | null
          country?: string | null
          created_at?: string
          current_address?: string | null
          current_city?: string | null
          current_pincode?: string | null
          current_state?: string | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          degree?: string | null
          department?: string | null
          designation?: string | null
          driving_license?: string | null
          education_worker_permit?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id?: string | null
          employment_status?: string | null
          employment_type?: string | null
          engagement_type?: string | null
          first_name?: string
          gender?: string | null
          has_driving_license?: boolean | null
          highest_qualification?: string | null
          house_number?: string | null
          id?: string
          institution_assignment?: string | null
          is_active?: boolean | null
          last_name?: string
          marital_status?: string | null
          medical_health_condition?: string | null
          nationality?: string | null
          next_increment_date?: string | null
          pan_number?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          permanent_address?: string | null
          permanent_city?: string | null
          permanent_pincode?: string | null
          permanent_state?: string | null
          phone?: string | null
          position?: string | null
          probation_end_date?: string | null
          professional_qualification_teaching?: string | null
          profile_photo_url?: string | null
          program?: string | null
          project_program?: string | null
          race?: string | null
          religion?: string | null
          role_code?: string | null
          samagra_id?: string | null
          seniority?: string | null
          skills?: string[] | null
          social_category?: string | null
          training_record?: string | null
          university?: string | null
          updated_at?: string
          user_id?: string
          vehicle_information?: string | null
          wes_mail?: string | null
          wes_mail_pass?: string | null
          year_of_passing?: number | null
        }
        Relationships: []
      }
      employee_shifts: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          shift_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          shift_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          shift_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee_shifts_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      face_attendance_sessions: {
        Row: {
          browser_name: string | null
          created_at: string | null
          device_info: Json | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_activity: string
          latitude: number | null
          location_accuracy: number | null
          location_address: string | null
          login_time: string
          logout_reason: string | null
          logout_time: string | null
          longitude: number | null
          os_name: string | null
          session_token: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          browser_name?: string | null
          created_at?: string | null
          device_info?: Json | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string
          latitude?: number | null
          location_accuracy?: number | null
          location_address?: string | null
          login_time?: string
          logout_reason?: string | null
          logout_time?: string | null
          longitude?: number | null
          os_name?: string | null
          session_token: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          browser_name?: string | null
          created_at?: string | null
          device_info?: Json | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string
          latitude?: number | null
          location_accuracy?: number | null
          location_address?: string | null
          login_time?: string
          logout_reason?: string | null
          logout_time?: string | null
          longitude?: number | null
          os_name?: string | null
          session_token?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      face_checkin_history: {
        Row: {
          attendance_id: string | null
          created_at: string
          id: string
          match_distance: number | null
          matched: boolean
          notes: string | null
          user_id: string | null
        }
        Insert: {
          attendance_id?: string | null
          created_at?: string
          id?: string
          match_distance?: number | null
          matched?: boolean
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          attendance_id?: string | null
          created_at?: string
          id?: string
          match_distance?: number | null
          matched?: boolean
          notes?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      face_descriptors: {
        Row: {
          descriptor: Json
          enrolled_at: string
          enrolled_by: string | null
          id: string
          is_active: boolean
          photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          descriptor: Json
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          descriptor?: Json
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          institution_name: string | null
          is_national: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          institution_name?: string | null
          is_national?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          institution_name?: string | null
          is_national?: boolean | null
          name?: string
        }
        Relationships: []
      }
      individual_peer_reviewers: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          reviewer_id: string
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          reviewer_id: string
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          reviewer_id?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "individual_peer_reviewers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          casual_leaves_entitled: number | null
          casual_leaves_used: number | null
          medical_leaves_used: number | null
          emergency_leaves_used: number | null
          lop_leaves_used: number | null
          half_day_leaves_used: number | null
          created_at: string | null
          id: string
          month: number
          sick_leaves_used: number | null
          unplanned_leaves_used: number | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          casual_leaves_entitled?: number | null
          casual_leaves_used?: number | null
          medical_leaves_used?: number | null
          emergency_leaves_used?: number | null
          lop_leaves_used?: number | null
          half_day_leaves_used?: number | null
          created_at?: string | null
          id?: string
          month: number
          sick_leaves_used?: number | null
          unplanned_leaves_used?: number | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          casual_leaves_entitled?: number | null
          casual_leaves_used?: number | null
          medical_leaves_used?: number | null
          emergency_leaves_used?: number | null
          lop_leaves_used?: number | null
          half_day_leaves_used?: number | null
          created_at?: string | null
          id?: string
          month?: number
          sick_leaves_used?: number | null
          unplanned_leaves_used?: number | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      leaves: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_rejected: boolean | null
          auto_rejection_reason: string | null
          created_at: string
          end_date: string
          half_day_type: string | null
          id: string
          is_emergency: boolean | null
          is_half_day: boolean | null
          leave_type: Database["public"]["Enums"]["leave_type"] | null
          medical_document_url: string | null
          reason: string
          rejection_reason: string | null
          salary_deduction_percent: number | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"] | null
          updated_at: string
          user_id: string
          working_days_count: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_rejected?: boolean | null
          auto_rejection_reason?: string | null
          created_at?: string
          end_date: string
          half_day_type?: string | null
          id?: string
          is_emergency?: boolean | null
          is_half_day?: boolean | null
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          medical_document_url?: string | null
          reason: string
          rejection_reason?: string | null
          salary_deduction_percent?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"] | null
          updated_at?: string
          user_id: string
          working_days_count?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_rejected?: boolean | null
          auto_rejection_reason?: string | null
          created_at?: string
          end_date?: string
          half_day_type?: string | null
          id?: string
          is_emergency?: boolean | null
          is_half_day?: boolean | null
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          medical_document_url?: string | null
          reason?: string
          rejection_reason?: string | null
          salary_deduction_percent?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"] | null
          updated_at?: string
          user_id?: string
          working_days_count?: number | null
        }
        Relationships: []
      }
      login_history: {
        Row: {
          id: string
          ip_address: string | null
          login_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      manager_institutions: {
        Row: {
          created_at: string
          id: string
          institution_name: string
          manager_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_name: string
          manager_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_name?: string
          manager_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_deductions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          deduction_type_id: string
          id: string
          payroll_month: string
          reference_id: string | null
          remarks: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          deduction_type_id: string
          id?: string
          payroll_month: string
          reference_id?: string | null
          remarks?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          deduction_type_id?: string
          id?: string
          payroll_month?: string
          reference_id?: string | null
          remarks?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_deductions_deduction_type_id_fkey"
            columns: ["deduction_type_id"]
            isOneToOne: false
            referencedRelation: "deduction_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          announcements: boolean
          attendance: boolean
          created_at: string
          documents: boolean
          enabled: boolean
          leaves: boolean
          salary: boolean
          support: boolean
          tasks: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          announcements?: boolean
          attendance?: boolean
          created_at?: string
          documents?: boolean
          enabled?: boolean
          leaves?: boolean
          salary?: boolean
          support?: boolean
          tasks?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          announcements?: boolean
          attendance?: boolean
          created_at?: string
          documents?: boolean
          enabled?: boolean
          leaves?: boolean
          salary?: boolean
          support?: boolean
          tasks?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll_register: {
        Row: {
          absents: number | null
          approved_at: string | null
          approved_by: string | null
          basic_earned: number
          created_at: string | null
          created_by: string | null
          daily_rate: number | null
          employment_status: string | null
          engagement_type: string | null
          epf_employee: number | null
          epf_employer: number | null
          esic_employee: number | null
          esic_employer: number | null
          fixed_gross_earned: number
          half_days: number | null
          holidays: number | null
          hra_earned: number
          id: string
          lates: number | null
          manual_deductions_details: Json | null
          manual_deductions_total: number | null
          net_payable: number
          other_allowance_earned: number
          paid_date: string | null
          paid_days: number
          paid_leaves: number | null
          payment_mode: string | null
          payment_reference: string | null
          payroll_days: number
          payroll_month: string
          payslip_number: string
          payslip_remarks: string | null
          present_days: number | null
          program: string | null
          remarks: string | null
          status: string | null
          total_ctc: number
          total_deductions: number
          total_employer_contribution: number | null
          total_gross_earnings: number
          unpaid_leaves: number | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
          variable_earnings_details: Json | null
          variable_earnings_total: number | null
        }
        Insert: {
          absents?: number | null
          approved_at?: string | null
          approved_by?: string | null
          basic_earned: number
          created_at?: string | null
          created_by?: string | null
          daily_rate?: number | null
          employment_status?: string | null
          engagement_type?: string | null
          epf_employee?: number | null
          epf_employer?: number | null
          esic_employee?: number | null
          esic_employer?: number | null
          fixed_gross_earned: number
          half_days?: number | null
          holidays?: number | null
          hra_earned: number
          id?: string
          lates?: number | null
          manual_deductions_details?: Json | null
          manual_deductions_total?: number | null
          net_payable: number
          other_allowance_earned: number
          paid_date?: string | null
          paid_days: number
          paid_leaves?: number | null
          payment_mode?: string | null
          payment_reference?: string | null
          payroll_days: number
          payroll_month: string
          payslip_number: string
          payslip_remarks?: string | null
          present_days?: number | null
          program?: string | null
          remarks?: string | null
          status?: string | null
          total_ctc: number
          total_deductions: number
          total_employer_contribution?: number | null
          total_gross_earnings: number
          unpaid_leaves?: number | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          variable_earnings_details?: Json | null
          variable_earnings_total?: number | null
        }
        Update: {
          absents?: number | null
          approved_at?: string | null
          approved_by?: string | null
          basic_earned?: number
          created_at?: string | null
          created_by?: string | null
          daily_rate?: number | null
          employment_status?: string | null
          engagement_type?: string | null
          epf_employee?: number | null
          epf_employer?: number | null
          esic_employee?: number | null
          esic_employer?: number | null
          fixed_gross_earned?: number
          half_days?: number | null
          holidays?: number | null
          hra_earned?: number
          id?: string
          lates?: number | null
          manual_deductions_details?: Json | null
          manual_deductions_total?: number | null
          net_payable?: number
          other_allowance_earned?: number
          paid_date?: string | null
          paid_days?: number
          paid_leaves?: number | null
          payment_mode?: string | null
          payment_reference?: string | null
          payroll_days?: number
          payroll_month?: string
          payslip_number?: string
          payslip_remarks?: string | null
          present_days?: number | null
          program?: string | null
          remarks?: string | null
          status?: string | null
          total_ctc?: number
          total_deductions?: number
          total_employer_contribution?: number | null
          total_gross_earnings?: number
          unpaid_leaves?: number | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          variable_earnings_details?: Json | null
          variable_earnings_total?: number | null
        }
        Relationships: []
      }
      peer_reviewer_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_reviewer_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "peer_reviewer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_reviewer_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          areas_of_improvement: string | null
          comments: string | null
          created_at: string
          employee_user_id: string
          goals: string | null
          id: string
          rating: number | null
          review_period: string
          reviewer_user_id: string | null
          strengths: string | null
          updated_at: string
        }
        Insert: {
          areas_of_improvement?: string | null
          comments?: string | null
          created_at?: string
          employee_user_id: string
          goals?: string | null
          id?: string
          rating?: number | null
          review_period: string
          reviewer_user_id?: string | null
          strengths?: string | null
          updated_at?: string
        }
        Update: {
          areas_of_improvement?: string | null
          comments?: string | null
          created_at?: string
          employee_user_id?: string
          goals?: string | null
          id?: string
          rating?: number | null
          review_period?: string
          reviewer_user_id?: string | null
          strengths?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quick_links: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      salaries: {
        Row: {
          absent_days: number | null
          approval_notes: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          base_salary: number
          basic_earned: number | null
          created_at: string
          epf_employee: number | null
          epf_employer: number | null
          esic_employee: number | null
          esic_employer: number | null
          final_salary: number | null
          gross_salary: number | null
          half_days: number | null
          holiday_count: number | null
          hra_amount: number | null
          hra_earned: number | null
          id: string
          is_locked: boolean | null
          late_days: number | null
          locked_at: string | null
          locked_by: string | null
          manager_justification: string | null
          manager_proposed_at: string | null
          manager_proposed_by: string | null
          manager_proposed_salary: number | null
          manual_deduction: number | null
          month: number
          net_salary_calculated: number | null
          net_salary_manual: number | null
          other_allowance_earned: number | null
          other_deductions: number | null
          paid_leave_days: number | null
          per_day_salary: number | null
          pf_deduction: number | null
          present_days: number | null
          processed_at: string | null
          professional_tax: number | null
          sick_leaves: number | null
          special_bonus: number | null
          tds_deduction: number | null
          total_ctc: number | null
          total_deductions: number | null
          total_employer_contribution: number | null
          travel_allowance: number | null
          updated_at: string
          user_id: string
          variable_earnings_details: Json | null
          variable_earnings_total: number | null
          working_days: number
          year: number
        }
        Insert: {
          absent_days?: number | null
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_salary: number
          basic_earned?: number | null
          created_at?: string
          epf_employee?: number | null
          epf_employer?: number | null
          esic_employee?: number | null
          esic_employer?: number | null
          final_salary?: number | null
          gross_salary?: number | null
          half_days?: number | null
          holiday_count?: number | null
          hra_amount?: number | null
          hra_earned?: number | null
          id?: string
          is_locked?: boolean | null
          late_days?: number | null
          locked_at?: string | null
          locked_by?: string | null
          manager_justification?: string | null
          manager_proposed_at?: string | null
          manager_proposed_by?: string | null
          manager_proposed_salary?: number | null
          manual_deduction?: number | null
          month: number
          net_salary_calculated?: number | null
          net_salary_manual?: number | null
          other_allowance_earned?: number | null
          other_deductions?: number | null
          paid_leave_days?: number | null
          per_day_salary?: number | null
          pf_deduction?: number | null
          present_days?: number | null
          processed_at?: string | null
          professional_tax?: number | null
          sick_leaves?: number | null
          special_bonus?: number | null
          tds_deduction?: number | null
          total_ctc?: number | null
          total_deductions?: number | null
          total_employer_contribution?: number | null
          travel_allowance?: number | null
          updated_at?: string
          user_id: string
          variable_earnings_details?: Json | null
          variable_earnings_total?: number | null
          working_days: number
          year: number
        }
        Update: {
          absent_days?: number | null
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_salary?: number
          basic_earned?: number | null
          created_at?: string
          epf_employee?: number | null
          epf_employer?: number | null
          esic_employee?: number | null
          esic_employer?: number | null
          final_salary?: number | null
          gross_salary?: number | null
          half_days?: number | null
          holiday_count?: number | null
          hra_amount?: number | null
          hra_earned?: number | null
          id?: string
          is_locked?: boolean | null
          late_days?: number | null
          locked_at?: string | null
          locked_by?: string | null
          manager_justification?: string | null
          manager_proposed_at?: string | null
          manager_proposed_by?: string | null
          manager_proposed_salary?: number | null
          manual_deduction?: number | null
          month?: number
          net_salary_calculated?: number | null
          net_salary_manual?: number | null
          other_allowance_earned?: number | null
          other_deductions?: number | null
          paid_leave_days?: number | null
          per_day_salary?: number | null
          pf_deduction?: number | null
          present_days?: number | null
          processed_at?: string | null
          professional_tax?: number | null
          sick_leaves?: number | null
          special_bonus?: number | null
          tds_deduction?: number | null
          total_ctc?: number | null
          total_deductions?: number | null
          total_employer_contribution?: number | null
          travel_allowance?: number | null
          updated_at?: string
          user_id?: string
          variable_earnings_details?: Json | null
          variable_earnings_total?: number | null
          working_days?: number
          year?: number
        }
        Relationships: []
      }
      salary_audit: {
        Row: {
          action: string
          change_reason: string | null
          changed_by: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          salary_id: string
        }
        Insert: {
          action: string
          change_reason?: string | null
          changed_by: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          salary_id: string
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          salary_id?: string
        }
        Relationships: []
      }
      salary_structures: {
        Row: {
          bank_account_number: string | null
          bank_branch: string | null
          bank_ifsc: string | null
          bank_name: string | null
          basic_percentage: number | null
          basic_salary: number | null
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_to: string | null
          epf_applicable: boolean | null
          epf_employee_rate: number | null
          epf_employer_rate: number | null
          esic_applicable: boolean | null
          esic_employee_rate: number | null
          esic_employer_rate: number | null
          esic_ip_number: string | null
          fixed_gross_salary: number
          hra_amount: number | null
          hra_percentage: number | null
          id: string
          is_active: boolean | null
          other_allowance: number | null
          other_allowance_percentage: number | null
          pf_uan_number: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          basic_percentage?: number | null
          basic_salary?: number | null
          created_at?: string | null
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          epf_applicable?: boolean | null
          epf_employee_rate?: number | null
          epf_employer_rate?: number | null
          esic_applicable?: boolean | null
          esic_employee_rate?: number | null
          esic_employer_rate?: number | null
          esic_ip_number?: string | null
          fixed_gross_salary: number
          hra_amount?: number | null
          hra_percentage?: number | null
          id?: string
          is_active?: boolean | null
          other_allowance?: number | null
          other_allowance_percentage?: number | null
          pf_uan_number?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          basic_percentage?: number | null
          basic_salary?: number | null
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          epf_applicable?: boolean | null
          epf_employee_rate?: number | null
          epf_employer_rate?: number | null
          esic_applicable?: boolean | null
          esic_employee_rate?: number | null
          esic_employer_rate?: number | null
          esic_ip_number?: string | null
          fixed_gross_salary?: number
          hra_amount?: number | null
          hra_percentage?: number | null
          id?: string
          is_active?: boolean | null
          other_allowance?: number | null
          other_allowance_percentage?: number | null
          pf_uan_number?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string
          half_day_threshold_hours: number | null
          id: string
          is_active: boolean | null
          last_checkin_hours_before_end: number | null
          late_threshold_minutes: number | null
          name: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time: string
          half_day_threshold_hours?: number | null
          id?: string
          is_active?: boolean | null
          last_checkin_hours_before_end?: number | null
          late_threshold_minutes?: number | null
          name: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string
          half_day_threshold_hours?: number | null
          id?: string
          is_active?: boolean | null
          last_checkin_hours_before_end?: number | null
          late_threshold_minutes?: number | null
          name?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      support_request_replies: {
        Row: {
          created_at: string | null
          id: string
          is_internal: boolean | null
          message: string
          request_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message: string
          request_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message?: string
          request_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_request_replies_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          category: string | null
          created_at: string | null
          description: string
          id: string
          priority: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_assignment_groups: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignment_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "assignment_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          created_at: string | null
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      task_earnings: {
        Row: {
          amount: number
          created_at: string | null
          earned_at: string | null
          id: string
          remark_id: string | null
          remarked_by: string | null
          response_id: string
          status: string | null
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          earned_at?: string | null
          id?: string
          remark_id?: string | null
          remarked_by?: string | null
          response_id: string
          status?: string | null
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          earned_at?: string | null
          id?: string
          remark_id?: string | null
          remarked_by?: string | null
          response_id?: string
          status?: string | null
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_earnings_remark_id_fkey"
            columns: ["remark_id"]
            isOneToOne: false
            referencedRelation: "task_remarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_earnings_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "task_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_earnings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_peer_reviewer_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_peer_reviewer_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "peer_reviewer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      task_peer_reviewers: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_remarks: {
        Row: {
          confidence: number | null
          created_at: string | null
          hand_gesture: number | null
          id: string
          rating: number | null
          remark_text: string
          remarked_by: string
          response_id: string
          speed: number | null
          tone: number | null
          updated_at: string | null
          vocabulary: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          hand_gesture?: number | null
          id?: string
          rating?: number | null
          remark_text: string
          remarked_by: string
          response_id: string
          speed?: number | null
          tone?: number | null
          updated_at?: string | null
          vocabulary?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          hand_gesture?: number | null
          id?: string
          rating?: number | null
          remark_text?: string
          remarked_by?: string
          response_id?: string
          speed?: number | null
          tone?: number | null
          updated_at?: string | null
          vocabulary?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_remarks_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "task_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      task_responses: {
        Row: {
          additional_file_name: string | null
          additional_file_url: string | null
          article_file_name: string | null
          article_file_url: string | null
          article_link: string | null
          created_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          link: string | null
          response_text: string
          task_id: string
          updated_at: string | null
          user_id: string
          video_link: string | null
        }
        Insert: {
          additional_file_name?: string | null
          additional_file_url?: string | null
          article_file_name?: string | null
          article_file_url?: string | null
          article_link?: string | null
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          link?: string | null
          response_text: string
          task_id: string
          updated_at?: string | null
          user_id: string
          video_link?: string | null
        }
        Update: {
          additional_file_name?: string | null
          additional_file_url?: string | null
          article_file_name?: string | null
          article_file_url?: string | null
          article_link?: string | null
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          link?: string | null
          response_text?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string
          video_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_responses_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string
          description: string
          display_order: number | null
          due_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_active: boolean | null
          review_assignment_type: string | null
          reward_amount: number | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by: string
          description: string
          display_order?: number | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          review_assignment_type?: string | null
          reward_amount?: number | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string
          description?: string
          display_order?: number | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          review_assignment_type?: string | null
          reward_amount?: number | null
          title?: string
          type?: string | null
          updated_at?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      weekly_reports: {
        Row: {
          approval_status: string
          comments: string | null
          created_at: string
          employee_id: string
          employee_name: string
          hours_spent: number | null
          id: string
          manager_id: string | null
          manager_notes: string | null
          objectives: string | null
          reviewed_at: string | null
          status: string
          submitted_at: string
          tasks_completed: string | null
          updated_at: string
          week_ending: string
          week_starting: string
        }
        Insert: {
          approval_status?: string
          comments?: string | null
          created_at?: string
          employee_id: string
          employee_name: string
          hours_spent?: number | null
          id?: string
          manager_id?: string | null
          manager_notes?: string | null
          objectives?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string
          tasks_completed?: string | null
          updated_at?: string
          week_ending: string
          week_starting: string
        }
        Update: {
          approval_status?: string
          comments?: string | null
          created_at?: string
          employee_id?: string
          employee_name?: string
          hours_spent?: number | null
          id?: string
          manager_id?: string | null
          manager_notes?: string | null
          objectives?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string
          tasks_completed?: string | null
          updated_at?: string
          week_ending?: string
          week_starting?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_earnings: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          earning_type_id: string
          id: string
          payroll_month: string
          quantity: number | null
          rate: number | null
          reference_id: string | null
          remarks: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          earning_type_id: string
          id?: string
          payroll_month: string
          quantity?: number | null
          rate?: number | null
          reference_id?: string | null
          remarks?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          earning_type_id?: string
          id?: string
          payroll_month?: string
          quantity?: number | null
          rate?: number | null
          reference_id?: string | null
          remarks?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variable_earnings_earning_type_id_fkey"
            columns: ["earning_type_id"]
            isOneToOne: false
            referencedRelation: "earning_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      holidays_view: {
        Row: {
          date: string | null
          description: string | null
          id: string | null
          institution_name: string | null
          is_national: boolean | null
          name: string | null
        }
        Relationships: []
      }
      payroll_register_view: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          basic_earned: number | null
          daily_rate: number | null
          department: string | null
          designation: string | null
          employee_id: string | null
          employee_name: string | null
          employer_total_cost: number | null
          engagement_type: string | null
          epf_eligible: boolean | null
          epf_employee: number | null
          epf_employer: number | null
          epf_wage_base: number | null
          esic_eligible: boolean | null
          esic_employee: number | null
          esic_employer: number | null
          gross_deductions: number | null
          gross_earned: number | null
          gross_monthly_salary: number | null
          hra_earned: number | null
          id: string | null
          manual_deductions_details: Json | null
          manual_deductions_total: number | null
          net_payable: number | null
          other_allowance_earned: number | null
          paid_date: string | null
          paid_day_units: number | null
          payroll_days: number | null
          payroll_month: string | null
          payroll_month_display: string | null
          payroll_status: string | null
          program: string | null
          record_key: string | null
          remarks: string | null
          status: string | null
          variable_earnings_details: Json | null
          variable_earnings_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_holiday: {
        Args: {
          p_date: string
          p_description?: string
          p_institution?: string
          p_is_national?: boolean
          p_name: string
        }
        Returns: undefined
      }
      calculate_attendance_stats: {
        Args: { p_month: number; p_user_id: string; p_year: number }
        Returns: Json
      }
      calculate_attendance_status: {
        Args: {
          p_check_in_time: string
          p_half_day_threshold_hours: number
          p_last_checkin_hours_before_end: number
          p_late_threshold_minutes: number
          p_shift_end: string
          p_shift_start: string
        }
        Returns: string
      }
      calculate_monthly_working_days: {
        Args: { p_month: number; p_year: number }
        Returns: number
      }
      calculate_salary_breakdown: {
        Args: {
          p_base_salary: number
          p_paid_leave_days?: number
          p_present_days: number
          p_working_days: number
        }
        Returns: Json
      }
      calculate_salary_components: {
        Args: {
          p_basic_percentage?: number
          p_gross_monthly_salary: number
          p_hra_percentage?: number
          p_paid_days: number
          p_payroll_days: number
        }
        Returns: {
          basic_earned: number
          daily_rate: number
          gross_earned: number
          hra_earned: number
          other_allowance_earned: number
        }[]
      }
      calculate_statutory_deductions: {
        Args: {
          p_basic_earned: number
          p_epf_applicable?: boolean
          p_epf_rate?: number
          p_esic_applicable?: boolean
          p_esic_employee_rate?: number
          p_esic_employer_rate?: number
          p_gross_earned: number
        }
        Returns: {
          epf_employee: number
          epf_employer: number
          esic_employee: number
          esic_employer: number
        }[]
      }
      calculate_working_days: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: number
      }
      calculate_working_days_for_institution: {
        Args: {
          p_end_date: string
          p_institution_name?: string
          p_start_date: string
        }
        Returns: number
      }
      check_leave_eligibility: {
        Args: {
          p_end_date: string
          p_is_emergency?: boolean
          p_leave_type: Database["public"]["Enums"]["leave_type"]
          p_start_date: string
          p_user_id: string
        }
        Returns: Json
      }
      cleanup_old_face_sessions: { Args: never; Returns: undefined }
      create_absent_records_for_date: {
        Args: { p_date: string }
        Returns: number
      }
      create_absent_records_for_range: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          date: string
          records_created: number
        }[]
      }
      delete_holiday: {
        Args: { p_date: string; p_institution?: string }
        Returns: undefined
      }
      generate_monthly_salaries: {
        Args: { p_month: number; p_year: number }
        Returns: Json
      }
      generate_sundays_for_year: {
        Args: { p_year: number }
        Returns: {
          sunday_date: string
        }[]
      }
      get_assignment_group_members: {
        Args: { p_group_id: string }
        Returns: {
          added_at: string
          designation: string
          email: string
          first_name: string
          institution_assignment: string
          last_name: string
          user_id: string
        }[]
      }
      get_casual_leave_count: {
        Args: { p_month: number; p_user_id: string; p_year: number }
        Returns: number
      }
      get_employee_shift: {
        Args: { p_date: string; p_user_id: string }
        Returns: {
          end_time: string
          half_day_threshold_hours: number
          last_checkin_hours_before_end: number
          late_threshold_minutes: number
          shift_id: string
          shift_name: string
          start_time: string
        }[]
      }
      get_or_create_leave_balance: {
        Args: { p_month: number; p_user_id: string; p_year: number }
        Returns: {
          casual_leaves_entitled: number | null
          casual_leaves_used: number | null
          created_at: string | null
          id: string
          month: number
          sick_leaves_used: number | null
          unplanned_leaves_used: number | null
          updated_at: string | null
          user_id: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "leave_balances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_assignment_groups: {
        Args: { p_user_id: string }
        Returns: {
          group_description: string
          group_id: string
          group_name: string
          member_count: number
        }[]
      }
      get_user_institution: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_holiday_date: { Args: { p_date: string }; Returns: boolean }
      is_late_checkin: { Args: { p_check_in_time: string }; Returns: boolean }
      is_manager_of_institution: {
        Args: { _institution: string; _user_id: string }
        Returns: boolean
      }
      is_manager_of_user: {
        Args: { _employee_id: string; _manager_id: string }
        Returns: boolean
      }
      is_peer_reviewer: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      is_within_checkin_window: { Args: never; Returns: boolean }
      notify_user: {
        Args: {
          p_message: string
          p_related_id?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      sync_holiday_to_attendance: {
        Args: {
          p_date: string
          p_description: string
          p_institution: string
          p_is_national: boolean
          p_name: string
        }
        Returns: undefined
      }
      trigger_absent_records_now: {
        Args: never
        Returns: {
          date: string
          message: string
          records_created: number
        }[]
      }
      update_holiday: {
        Args: {
          p_new_date: string
          p_new_description: string
          p_new_institution: string
          p_new_is_national: boolean
          p_new_name: string
          p_old_date: string
          p_old_institution: string
        }
        Returns: undefined
      }
      update_user_email_and_profile: {
        Args: { p_new_email: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      attendance_status:
        | "present"
        | "approved"
        | "absent"
        | "paid_leave"
        | "leave"
        | "pending"
        | "rejected"
        | "holiday"
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "casual" | "medical" | "emergency" | "lop" | "half_day"
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
      app_role: ["admin", "manager", "employee"],
      attendance_status: [
        "present",
        "approved",
        "absent",
        "paid_leave",
        "leave",
        "pending",
        "rejected",
        "holiday",
      ],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["casual", "medical", "emergency", "lop", "half_day"],
    },
  },
} as const
