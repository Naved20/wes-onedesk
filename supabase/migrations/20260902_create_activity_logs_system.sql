-- Create Activity Logs Table for tracking all user, admin, bot, script, and system actions
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'admin', 'bot', 'script', 'system')),
  actor_name TEXT,
  actor_email TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'warning')),
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes for ultra-fast filtering and searching
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_type ON activity_logs(actor_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON activity_logs(actor_id);

-- Enable Row Level Security (RLS)
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: STRICTLY ONLY ADMINS CAN VIEW ACTIVITY LOGS
DROP POLICY IF EXISTS "Admins can view activity logs" ON activity_logs;
CREATE POLICY "Admins can view activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy 2: Authenticated users, anon (for bots/face login), and service roles can insert logs
DROP POLICY IF EXISTS "Anyone can insert activity logs" ON activity_logs;
CREATE POLICY "Anyone can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated, anon, service_role
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON activity_logs TO authenticated, anon, service_role;

-- Generic Database Audit Function for PostgreSQL Triggers
CREATE OR REPLACE FUNCTION fn_auto_audit_log_change()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_type TEXT := 'system';
  v_module TEXT;
  v_action TEXT;
  v_description TEXT;
  v_metadata JSONB;
BEGIN
  -- Try to get current authenticated user
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
    -- Determine if admin or user
    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_actor_id AND role = 'admin') THEN
      v_actor_type := 'admin';
    ELSE
      v_actor_type := 'user';
    END IF;
  ELSE
    -- If no auth.uid(), it is executed by a script, cron job, or bot using postgres/service_role
    v_actor_type := 'script';
  END IF;

  v_module := TG_TABLE_NAME;
  v_action := TG_OP;

  IF (TG_OP = 'INSERT') THEN
    v_description := 'New record inserted in ' || TG_TABLE_NAME;
    v_metadata := jsonb_build_object('new_data', to_jsonb(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    v_description := 'Record updated in ' || TG_TABLE_NAME;
    v_metadata := jsonb_build_object('old_data', to_jsonb(OLD), 'new_data', to_jsonb(NEW));
  ELSIF (TG_OP = 'DELETE') THEN
    v_description := 'Record deleted from ' || TG_TABLE_NAME;
    v_metadata := jsonb_build_object('old_data', to_jsonb(OLD));
  END IF;

  INSERT INTO activity_logs (
    actor_id,
    actor_type,
    actor_email,
    module,
    action,
    description,
    metadata,
    status
  ) VALUES (
    v_actor_id,
    v_actor_type,
    v_actor_email,
    v_module,
    v_action,
    v_description,
    v_metadata,
    'success'
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the main query if audit logging encounters an edge case error
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add automatic triggers for key tables if needed
DROP TRIGGER IF EXISTS trg_audit_tasks ON simple_tasks;
CREATE TRIGGER trg_audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON simple_tasks
  FOR EACH ROW EXECUTE FUNCTION fn_auto_audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_leaves ON leave_applications;
CREATE TRIGGER trg_audit_leaves
  AFTER INSERT OR UPDATE OR DELETE ON leave_applications
  FOR EACH ROW EXECUTE FUNCTION fn_auto_audit_log_change();

COMMENT ON TABLE activity_logs IS 'Audit log of all user, admin, bot, script, and system actions across WES OneDesk';
