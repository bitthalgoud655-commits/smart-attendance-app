USE smart_attendance;

CREATE TABLE IF NOT EXISTS teacher_accounts (
  id TINYINT PRIMARY KEY,
  username VARCHAR(40) NOT NULL UNIQUE,
  password_hash CHAR(128) NOT NULL,
  password_salt CHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_teacher_accounts_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id CHAR(36) PRIMARY KEY,
  teacher_username VARCHAR(120) NOT NULL,
  class_name VARCHAR(80) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  session_date DATE NOT NULL,
  started_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  status ENUM('active', 'ended', 'expired') NOT NULL DEFAULT 'active',
  INDEX idx_sessions_teacher_date (teacher_username, session_date),
  INDEX idx_sessions_active (teacher_username, class_name, status, expires_at)
);

ALTER TABLE attendance
  ADD COLUMN session_id CHAR(36) NULL AFTER id,
  ADD COLUMN subject VARCHAR(120) NOT NULL DEFAULT '' AFTER class_name,
  ADD COLUMN recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER source,
  ADD CONSTRAINT fk_attendance_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  ADD CONSTRAINT uq_attendance_session_student UNIQUE (session_id, student_id),
  ADD INDEX idx_attendance_session (session_id, recorded_at);
