-- Run this in the D1 Console to add new features
ALTER TABLE submissions ADD COLUMN status TEXT DEFAULT 'new';
ALTER TABLE submissions ADD COLUMN notes TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
