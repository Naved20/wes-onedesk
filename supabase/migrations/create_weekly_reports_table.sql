-- Create weekly_reports table
CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  department VARCHAR(255),
  
  -- Report sections
  accomplishments TEXT,
  challenges TEXT,
  next_week_goals TEXT,
  additional_notes TEXT,
  
  -- Metrics
  tasks_completed INTEGER DEFAULT 0,
  tasks_pending INTEGER DEFAULT 0,
  efficiency_score DECIMAL(3,2),
  
  -- Status and review
  status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, approved, rejected
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by UUID REFERENCES auth.users(id),
  
  -- Manager review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  manager_comments TEXT,
  manager_rating INTEGER, -- 1-5 scale
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  CONSTRAINT valid_rating CHECK (manager_rating >= 1 AND manager_rating <= 5 OR manager_rating IS NULL),
  CONSTRAINT valid_efficiency CHECK (efficiency_score >= 0 AND efficiency_score <= 100 OR efficiency_score IS NULL)
);

-- Create indexes
CREATE INDEX idx_weekly_reports_employee_id ON weekly_reports(employee_id);
CREATE INDEX idx_weekly_reports_status ON weekly_reports(status);
CREATE INDEX idx_weekly_reports_week_start ON weekly_reports(week_start_date);
CREATE INDEX idx_weekly_reports_reviewed_by ON weekly_reports(reviewed_by);
CREATE INDEX idx_weekly_reports_submitted_at ON weekly_reports(submitted_at);

-- Create weekly_report_comments table
CREATE TABLE weekly_report_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  commented_by UUID NOT NULL REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  comment_type VARCHAR(50) DEFAULT 'comment', -- comment, suggestion, concern
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for comments
CREATE INDEX idx_weekly_report_comments_report_id ON weekly_report_comments(report_id);
CREATE INDEX idx_weekly_report_comments_commented_by ON weekly_report_comments(commented_by);

-- Create weekly_report_attachments table (for file uploads)
CREATE TABLE weekly_report_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_weekly_report_attachments_report_id ON weekly_report_attachments(report_id);

-- Create view for manager dashboard
CREATE VIEW manager_weekly_reports_view AS
SELECT 
  wr.id,
  wr.employee_id,
  ep.full_name AS employee_name,
  ep.email AS employee_email,
  wr.week_start_date,
  wr.week_end_date,
  wr.status,
  wr.submitted_at,
  wr.manager_rating,
  wr.reviewed_at,
  wr.tasks_completed,
  wr.tasks_pending,
  wr.efficiency_score,
  COALESCE(COUNT(wrc.id), 0) AS comment_count
FROM weekly_reports wr
LEFT JOIN employee_profiles ep ON wr.employee_id = ep.user_id
LEFT JOIN weekly_report_comments wrc ON wr.id = wrc.report_id
GROUP BY wr.id, ep.full_name, ep.email;

-- Enable RLS
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_report_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weekly_reports
-- Employees can see their own reports
CREATE POLICY "Employees can view own reports" 
  ON weekly_reports 
  FOR SELECT 
  USING (auth.uid() = employee_id OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

-- Employees can insert their own reports
CREATE POLICY "Employees can create own reports" 
  ON weekly_reports 
  FOR INSERT 
  WITH CHECK (auth.uid() = employee_id);

-- Employees can update their own draft reports
CREATE POLICY "Employees can update own draft reports" 
  ON weekly_reports 
  FOR UPDATE 
  USING (auth.uid() = employee_id AND status = 'draft')
  WITH CHECK (auth.uid() = employee_id AND status = 'draft');

-- Managers can view reports of their team members
CREATE POLICY "Managers can view team reports" 
  ON weekly_reports 
  FOR SELECT 
  USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'manager' OR role = 'admin') 
    OR 
    auth.uid() = employee_id
  );

-- Managers can update (review) reports
CREATE POLICY "Managers can review reports" 
  ON weekly_reports 
  FOR UPDATE 
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'manager' OR role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'manager' OR role = 'admin'));

-- RLS Policies for comments
CREATE POLICY "Users can view comments on reports they can access" 
  ON weekly_report_comments 
  FOR SELECT 
  USING (
    report_id IN (
      SELECT id FROM weekly_reports WHERE 
      employee_id = auth.uid() OR 
      auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('manager', 'admin'))
    )
  );

CREATE POLICY "Users can add comments to accessible reports" 
  ON weekly_report_comments 
  FOR INSERT 
  WITH CHECK (
    report_id IN (
      SELECT id FROM weekly_reports WHERE 
      employee_id = auth.uid() OR 
      auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('manager', 'admin'))
    )
  );

-- RLS Policies for attachments
CREATE POLICY "Users can view attachments on accessible reports" 
  ON weekly_report_attachments 
  FOR SELECT 
  USING (
    report_id IN (
      SELECT id FROM weekly_reports WHERE 
      employee_id = auth.uid() OR 
      auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('manager', 'admin'))
    )
  );

CREATE POLICY "Users can upload attachments to own reports" 
  ON weekly_report_attachments 
  FOR INSERT 
  WITH CHECK (
    report_id IN (
      SELECT id FROM weekly_reports WHERE employee_id = auth.uid()
    )
  );
