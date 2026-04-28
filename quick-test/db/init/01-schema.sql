-- ============================================================
-- Crawler Data Schema — 三层数据存储
-- ============================================================
-- raw      → 原始 HTML / API 响应
-- staging  → 解析后但未清洗的数据 (JSONB)
-- clean    → 规范化后入库就绪的数据
-- ============================================================

-- ─── 运行记录 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crawler_runs (
  id            SERIAL PRIMARY KEY,
  run_id        TEXT UNIQUE NOT NULL,
  source        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','completed','failed','partial')),
  started_at    TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ,
  items_scraped INT NOT NULL DEFAULT 0,
  errors        INT NOT NULL DEFAULT 0,
  error         TEXT,
  params        JSONB
);

-- ─── Raw 层：原始数据 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_data (
  id         SERIAL PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES crawler_runs(run_id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  content    TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_run_id ON raw_data(run_id);

-- ─── Staging 层：解析后数据 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS staging_data (
  id        SERIAL PRIMARY KEY,
  run_id    TEXT NOT NULL REFERENCES crawler_runs(run_id) ON DELETE CASCADE,
  source    TEXT NOT NULL,
  data      JSONB NOT NULL,
  parsed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staging_run_id ON staging_data(run_id);

-- ─── Clean 层：规范化入库数据 ────────────────────────────────
CREATE TABLE IF NOT EXISTS clean_products (
  id             SERIAL PRIMARY KEY,
  run_id         TEXT NOT NULL REFERENCES crawler_runs(run_id) ON DELETE CASCADE,
  source         TEXT NOT NULL,
  url            TEXT,
  external_id    TEXT,
  title          TEXT,
  price          NUMERIC(10,2),
  currency       TEXT,
  description    TEXT,
  images         TEXT[],
  specifications JSONB,
  scraped_at     TIMESTAMPTZ,
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE INDEX idx_clean_source ON clean_products(source);
CREATE INDEX idx_clean_external_id ON clean_products(external_id);

-- ─── AI 识别结果 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_recognition_results (
  id             SERIAL PRIMARY KEY,
  run_id         TEXT,
  node_id        TEXT NOT NULL,
  image_url      TEXT,
  template_id    TEXT,
  prompt         TEXT,
  result         TEXT NOT NULL,
  model          TEXT,
  status         TEXT NOT NULL DEFAULT 'success'
                 CHECK (status IN ('success','failed')),
  error          TEXT,
  recognized_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_results_run ON ai_recognition_results(run_id);
