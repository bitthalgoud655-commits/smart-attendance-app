USE smart_attendance;

CREATE TABLE IF NOT EXISTS teacher_accounts (
  id TINYINT PRIMARY KEY,
  username VARCHAR(40) NOT NULL UNIQUE,
  password_hash CHAR(128) NOT NULL,
  password_salt CHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_teacher_accounts_singleton CHECK (id = 1)
);
