CREATE DATABASE IF NOT EXISTS smart_attendance;
USE smart_attendance;

CREATE TABLE IF NOT EXISTS students (
  id BIGINT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  roll_no VARCHAR(40) NOT NULL UNIQUE,
  class_name VARCHAR(40) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS class_settings (
  id TINYINT PRIMARY KEY,
  school_name VARCHAR(160) NOT NULL DEFAULT 'Oriental University',
  class_latitude DECIMAL(10, 7) NULL,
  class_longitude DECIMAL(10, 7) NULL,
  attendance_radius SMALLINT NOT NULL DEFAULT 5
);

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

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id CHAR(36) NULL,
  attendance_date DATE NOT NULL,
  student_id BIGINT NOT NULL,
  student_name VARCHAR(120) NOT NULL,
  roll_no VARCHAR(40) NOT NULL,
  class_name VARCHAR(40) NOT NULL,
  subject VARCHAR(120) NOT NULL DEFAULT '',
  status ENUM('present', 'absent', 'late') NOT NULL DEFAULT 'present',
  reason VARCHAR(255) NOT NULL DEFAULT '',
  device_id VARCHAR(180) NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  distance_meters SMALLINT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  CONSTRAINT uq_attendance_session_student UNIQUE (session_id, student_id),
  INDEX idx_attendance_date (attendance_date),
  INDEX idx_attendance_session (session_id, recorded_at),
  INDEX idx_attendance_device (attendance_date, device_id)
);

INSERT INTO class_settings (id)
VALUES (1)
ON DUPLICATE KEY UPDATE id = id;