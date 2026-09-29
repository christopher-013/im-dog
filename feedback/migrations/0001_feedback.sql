-- Private Cloudflare D1 data. Never export this table into the public repository.
CREATE TABLE IF NOT EXISTS feedback_private (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  name TEXT,
  email TEXT,
  ip TEXT NOT NULL,
  country TEXT,
  user_agent TEXT,
  language TEXT,
  time_zone TEXT,
  screen TEXT,
  input_mode TEXT,
  game_build TEXT,
  issue_number INTEGER
);
CREATE INDEX IF NOT EXISTS feedback_private_ip_time ON feedback_private (ip, created_at);
CREATE INDEX IF NOT EXISTS feedback_private_created ON feedback_private (created_at);
