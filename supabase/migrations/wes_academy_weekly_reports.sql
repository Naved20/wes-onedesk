-- WES Academy Weekly Reports - Complete Schema
-- This replaces the simple weekly_reports with detailed teacher reporting

-- Main weekly report header
CREATE TABLE IF NOT EXISTS wes_weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_name VARCHAR(255) NOT NULL,
  class_batch VARCHAR(255) NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, approved, rejected
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  -- Summary fields
  total_attendance_percentage DECIMAL(5,2),
  total_lesson_plans_submitted INTEGER DEFAULT 0,
  total_lesson_plans_reviewed INTEGER DEFAULT 0,
  average_academic_rating DECIMAL(3,2),
  average_operations_rating DECIMAL(3,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily report entries (6 days: Sat-Fri)
CREATE TABLE IF NOT EXISTS wes_daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_report_id UUID NOT NULL REFERENCES wes_weekly_reports(id) ON DELETE CASCADE,
  day_name VARCHAR(20) NOT NULL, -- Saturday, Monday, Tuesday, Wednesday, Thursday, Friday
  day_date DATE NOT NULL,
  
  -- Task Updates (15:00 slot)
  my_attendance INTEGER DEFAULT 0,
  total_strength INTEGER DEFAULT 0,
  progress_tracker_updated TEXT,
  
  -- Parent Calls (16:30 slot)
  parents_called INTEGER DEFAULT 0,
  parents_received INTEGER DEFAULT 0,
  parent_call_comments TEXT,
  
  -- Closing Checklist
  class_video_done BOOLEAN DEFAULT FALSE,
  attendance_marked BOOLEAN DEFAULT FALSE,
  tracker_updated BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lesson Plans (3 per day, 16:00 slot)
CREATE TABLE IF NOT EXISTS wes_lesson_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_report_id UUID NOT NULL REFERENCES wes_daily_reports(id) ON DELETE CASCADE,
  lp_number INTEGER NOT NULL, -- 1, 2, or 3
  
  submitted BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE,
  approval_rating INTEGER, -- 1-10
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Class Updates (3 classes per day: 16:55, 17:35, 18:15)
CREATE TABLE IF NOT EXISTS wes_class_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_report_id UUID NOT NULL REFERENCES wes_daily_reports(id) ON DELETE CASCADE,
  time_slot VARCHAR(10) NOT NULL, -- 16:55, 17:35, 18:15
  class_number INTEGER NOT NULL, -- 1, 2, 3
  
  unit_name VARCHAR(255),
  chapter_name VARCHAR(255),
  learning_outcomes TEXT,
  what_went_well TEXT,
  chapters_topics_complete INTEGER DEFAULT 0,
  summary TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Incharge Feedback (Academic)
CREATE TABLE IF NOT EXISTS wes_academic_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_report_id UUID NOT NULL REFERENCES wes_daily_reports(id) ON DELETE CASCADE,
  
  what_is_good TEXT,
  where_improvement_needed TEXT,
  rating INTEGER, -- 1-10
  signature VARCHAR(255),
  feedback_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Incharge Feedback (Operations)
CREATE TABLE IF NOT EXISTS wes_operations_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_report_id UUID NOT NULL REFERENCES wes_daily_reports(id) ON DELETE CASCADE,
  
  what_is_good TEXT,
  where_improvement_needed TEXT,
  rating INTEGER, -- 1-10
  signature VARCHAR(255),
  feedback_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Challenges and Solutions
CREATE TABLE IF NOT EXISTS wes_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_report_id UUID NOT NULL REFERENCES wes_weekly_reports(id) ON DELETE CASCADE,
  
  challenge_description TEXT NOT NULL,
  solution_applied TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wes_weekly_reports_teacher ON wes_weekly_reports(teacher_id);
CREATE INDEX IF NOT EXISTS idx_wes_weekly_reports_dates ON wes_weekly_reports(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_wes_daily_reports_weekly ON wes_daily_reports(weekly_report_id);
CREATE INDEX IF NOT EXISTS idx_wes_lesson_plans_daily ON wes_lesson_plans(daily_report_id);
CREATE INDEX IF NOT EXISTS idx_wes_class_updates_daily ON wes_class_updates(daily_report_id);

-- Enable RLS
ALTER TABLE wes_weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE wes_daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE wes_lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE wes_class_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wes_academic_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE wes_operations_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE wes_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wes_weekly_reports
CREATE POLICY "Teachers can view own reports" 
  ON wes_weekly_reports FOR SELECT 
  USING (auth.uid() = teacher_id OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager')));

CREATE POLICY "Teachers can create own reports" 
  ON wes_weekly_reports FOR INSERT 
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own draft reports" 
  ON wes_weekly_reports FOR UPDATE 
  USING (auth.uid() = teacher_id AND status = 'draft');

CREATE POLICY "Managers can update reports" 
  ON wes_weekly_reports FOR UPDATE 
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager')));

-- RLS Policies for related tables (simplified - inherit from parent)
CREATE POLICY "Access via weekly report" ON wes_daily_reports FOR ALL 
  USING (weekly_report_id IN (SELECT id FROM wes_weekly_reports));

CREATE POLICY "Access via daily report" ON wes_lesson_plans FOR ALL 
  USING (daily_report_id IN (SELECT id FROM wes_daily_reports));

CREATE POLICY "Access via daily report" ON wes_class_updates FOR ALL 
  USING (daily_report_id IN (SELECT id FROM wes_daily_reports));

CREATE POLICY "Access via daily report" ON wes_academic_feedback FOR ALL 
  USING (daily_report_id IN (SELECT id FROM wes_daily_reports));

CREATE POLICY "Access via daily report" ON wes_operations_feedback FOR ALL 
  USING (daily_report_id IN (SELECT id FROM wes_daily_reports));

CREATE POLICY "Access via weekly report" ON wes_challenges FOR ALL 
  USING (weekly_report_id IN (SELECT id FROM wes_weekly_reports));

-- Helper view for manager dashboard
CREATE OR REPLACE VIEW wes_weekly_reports_summary AS
SELECT 
  wr.id,
  wr.teacher_id,
  wr.teacher_name,
  wr.class_batch,
  wr.week_start_date,
  wr.week_end_date,
  wr.status,
  wr.submitted_at,
  wr.total_attendance_percentage,
  wr.total_lesson_plans_submitted,
  wr.total_lesson_plans_reviewed,
  wr.average_academic_rating,
  wr.average_operations_rating,
  COUNT(DISTINCT dr.id) as days_filled,
  COALESCE(SUM(dr.parents_called), 0) as total_parents_called
FROM wes_weekly_reports wr
LEFT JOIN wes_daily_reports dr ON wr.id = dr.weekly_report_id
GROUP BY wr.id;
