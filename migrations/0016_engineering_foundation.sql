-- Additive product engineering foundation. Existing Preview 21 rows remain untouched.
CREATE TABLE IF NOT EXISTS style_identity (
  style_id TEXT PRIMARY KEY, brand TEXT, customer TEXT, season TEXT, collection TEXT,
  gender TEXT, category TEXT, subcategory TEXT, owner_user_id TEXT, approved_by TEXT,
  revision INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fabric_specifications (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL, name_ar TEXT,
  name_en TEXT NOT NULL, composition TEXT, construction TEXT, structure TEXT,
  gsm REAL, width_cm REAL, usable_width_cm REAL, stretch_x_pct REAL, stretch_y_pct REAL,
  shrinkage_warp_pct REAL, shrinkage_weft_pct REAL, finish TEXT, color TEXT,
  supplier TEXT, lot TEXT, roll TEXT, nap TEXT, direction_rule TEXT,
  repeat_x_cm REAL, repeat_y_cm REAL, matching_required INTEGER NOT NULL DEFAULT 0,
  defect_allowance_pct REAL, purchase_unit TEXT, cutting_unit TEXT,
  source TEXT NOT NULL DEFAULT 'MANUAL', state TEXT NOT NULL DEFAULT 'DRAFT',
  revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(style_id,code)
);
CREATE TABLE IF NOT EXISTS trim_specifications (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL, trim_type TEXT NOT NULL,
  name_ar TEXT, name_en TEXT NOT NULL, supplier TEXT, size TEXT, color TEXT,
  material TEXT, placement TEXT, quantity REAL, wastage_pct REAL, unit TEXT,
  asset_id TEXT, note TEXT, source TEXT NOT NULL DEFAULT 'MANUAL',
  state TEXT NOT NULL DEFAULT 'DRAFT', revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(style_id,code)
);
CREATE TABLE IF NOT EXISTS pattern_piece_specs (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL, name_ar TEXT,
  name_en TEXT NOT NULL, size_code TEXT, cut_qty INTEGER, material_code TEXT,
  grain_direction TEXT, nap_direction TEXT, seam_allowance_cm REAL,
  notches_json TEXT NOT NULL DEFAULT '[]', annotations_json TEXT NOT NULL DEFAULT '[]',
  points_json TEXT NOT NULL DEFAULT '[]', edges_json TEXT NOT NULL DEFAULT '[]',
  mirror_rule TEXT, pair_rule TEXT, fold_line TEXT,
  source TEXT NOT NULL DEFAULT 'MANUAL', state TEXT NOT NULL DEFAULT 'DRAFT',
  revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(style_id,code,size_code)
);
CREATE TABLE IF NOT EXISTS marker_plans (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL, fabric_code TEXT NOT NULL,
  size_ratio_json TEXT NOT NULL DEFAULT '{}', marker_length_m REAL,
  marker_width_cm REAL, usable_width_cm REAL, efficiency_pct REAL,
  plies INTEGER, wastage_pct REAL, layout_json TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'MANUAL', state TEXT NOT NULL DEFAULT 'DRAFT',
  revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(style_id,code)
);
CREATE TABLE IF NOT EXISTS routing_steps (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL,
  sequence_no INTEGER NOT NULL, department TEXT NOT NULL, name_ar TEXT,
  name_en TEXT NOT NULL, machine TEXT, attachment TEXT, stitch_type TEXT,
  spi REAL, seam_type TEXT, folder TEXT, gauge TEXT, presser_foot TEXT,
  operator_skill TEXT, smv REAL, sam REAL, qc_checkpoint TEXT,
  predecessor_code TEXT, parallel_code TEXT, reference_asset_id TEXT,
  source TEXT NOT NULL DEFAULT 'MANUAL', state TEXT NOT NULL DEFAULT 'DRAFT',
  revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(style_id,code), UNIQUE(style_id,sequence_no)
);
CREATE TABLE IF NOT EXISTS factory_stages (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL,
  sequence_no INTEGER NOT NULL, owner_user_id TEXT, status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  started_at TEXT, completed_at TEXT, comment TEXT, approval TEXT, rejection_reason TEXT,
  source TEXT NOT NULL DEFAULT 'MANUAL', revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(style_id,code), UNIQUE(style_id,sequence_no)
);
CREATE TABLE IF NOT EXISTS engineering_revisions (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, domain TEXT NOT NULL, record_key TEXT NOT NULL,
  revision INTEGER NOT NULL, old_json TEXT, new_json TEXT NOT NULL,
  reason TEXT, user_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_engineering_revisions_style ON engineering_revisions(style_id,domain,record_key,revision);
CREATE INDEX IF NOT EXISTS idx_fabric_style ON fabric_specifications(style_id,code);
CREATE INDEX IF NOT EXISTS idx_trim_style ON trim_specifications(style_id,code);
CREATE INDEX IF NOT EXISTS idx_pattern_spec_style ON pattern_piece_specs(style_id,code,size_code);
CREATE INDEX IF NOT EXISTS idx_marker_style ON marker_plans(style_id,code);
CREATE INDEX IF NOT EXISTS idx_routing_style ON routing_steps(style_id,sequence_no);
CREATE INDEX IF NOT EXISTS idx_factory_stage_style ON factory_stages(style_id,sequence_no);
INSERT INTO app_meta(key,value) VALUES('schema_version','18') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
