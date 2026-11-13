CREATE TABLE leads (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  goal TEXT NOT NULL,
  plan TEXT,
  height REAL,
  current_weight REAL,
  goal_weight REAL
);
