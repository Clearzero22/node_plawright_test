-- ============================================================
-- Workflow Execution Data Schema
-- ============================================================

-- ─── 工作流执行记录 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_executions (
  id              SERIAL PRIMARY KEY,
  execution_id    TEXT UNIQUE NOT NULL,
  template_id     TEXT,
  workflow_name   TEXT NOT NULL,
  status          TEXT DEFAULT 'running'
                  CHECK (status IN ('running','completed','failed','aborted')),
  total_steps     INT DEFAULT 0,
  success_steps   INT DEFAULT 0,
  error_steps     INT DEFAULT 0,
  duration_ms     INT,
  trigger         TEXT DEFAULT 'manual',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_template ON workflow_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_executions_started ON workflow_executions(started_at DESC);

-- ─── 节点执行数据 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_step_records (
  id              SERIAL PRIMARY KEY,
  execution_id    TEXT NOT NULL REFERENCES workflow_executions(execution_id) ON DELETE CASCADE,
  step_index      INT NOT NULL,
  node_id         TEXT NOT NULL,
  node_label      TEXT NOT NULL,
  node_type       TEXT NOT NULL DEFAULT 'step',
  status          TEXT DEFAULT 'running'
                  CHECK (status IN ('running','success','error')),
  input_data      JSONB,
  output_data     JSONB,
  config_data     JSONB,
  duration_ms     INT,
  error           TEXT,
  logs            JSONB,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_steps_execution ON workflow_step_records(execution_id);
CREATE INDEX IF NOT EXISTS idx_steps_node_id ON workflow_step_records(node_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON workflow_step_records(status);

-- ─── 全局日志 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id              SERIAL PRIMARY KEY,
  execution_id    TEXT NOT NULL REFERENCES workflow_executions(execution_id) ON DELETE CASCADE,
  node_id         TEXT,
  node_label      TEXT,
  level           TEXT NOT NULL CHECK (level IN ('info','success','error')),
  message         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_execution ON workflow_execution_logs(execution_id);
