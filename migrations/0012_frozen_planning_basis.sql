-- Preview 15: freeze production planning cost/consumption basis per lot
ALTER TABLE production_lots ADD COLUMN planning_basis_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE production_lots ADD COLUMN planning_basis_sha256 TEXT;
INSERT INTO app_meta(key,value) VALUES('schema_version','14') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
