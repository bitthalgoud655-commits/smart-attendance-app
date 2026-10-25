require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const {
  createSessionQrToken,
  createTeacherToken,
  hashPassword,
  loginRateLimit,
  requireTeacher,
  validateTeacherCredentials,
  verifySessionQrToken,
  verifyPassword,
} = require('./auth');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: true,
});

const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const asIso = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)) {
    return `${value.replace(' ', 'T')}Z`;
  }
  return value;
};
const asDate = (value) => typeof value === 'string' ? value.slice(0, 10) : value;
const getSessionExpiryMinutes = () => {
  const minutes = Number(process.env.SESSION_TTL_MINUTES || 10);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
    throw new Error('SESSION_TTL_MINUTES must be an integer from 1 to 120.');
  }
  return minutes;
};
const getAppUrl = (req) => {
  const configuredUrl = process.env.PUBLIC_APP_URL || req.get('origin');
  if (!configuredUrl) throw new Error('PUBLIC_APP_URL must be configured.');
  return configuredUrl.replace(/\/+$/, '');
};

const mapStudent = (row) => ({
  id: Number(row.id),
  name: row.name,
  rollNo: row.roll_no,
  class: row.class_name,
});

const mapAttendance = (row) => ({
  id: Number(row.id),
  sessionId: row.session_id,
  studentId: Number(row.student_id),
  studentName: row.student_name,
  rollNo: row.roll_no,
  class: row.class_name,
  subject: row.subject,
  date: asDate(row.attendance_date),
  timestamp: asIso(row.recorded_at || row.created_at),
  status: row.status,
  reason: row.reason || '',
  source: row.source,
});

const recordMissingStudentsAsAbsent = async (connection, session) => {
  const [result] = await connection.execute(
    `INSERT INTO attendance (
       session_id, student_id, student_name, roll_no, class_name, subject,
       attendance_date, status, reason, source
     )
     SELECT ?, student.id, student.name, student.roll_no, ?, ?, ?, 'absent',
            'Did not check in before the session ended.', 'session_end'
     FROM students AS student
     LEFT JOIN attendance AS existing
       ON existing.session_id = ? AND existing.student_id = student.id
     WHERE student.class_name = ? AND existing.id IS NULL`,
    [
      session.id,
      session.class_name,
      session.subject,
      asDate(session.session_date),
      session.id,
      session.class_name,
    ]
  );
  return result.affectedRows;
};

const mapSession = (row, records, req) => {
  const expiresAt = asIso(row.expires_at);
  const active = row.status === 'active' && new Date(expiresAt).getTime() > Date.now();
  const token = active ? createSessionQrToken(row.id, expiresAt) : null;
  return {
    id: row.id,
    teacher: row.teacher_username,
    className: row.class_name,
    subject: row.subject,
    date: asDate(row.session_date),
    startedAt: asIso(row.started_at),
    expiresAt,
    endedAt: asIso(row.ended_at),
    status: active ? 'active' : (row.status === 'active' ? 'expired' : row.status),
    attendanceUrl: token ? `${getAppUrl(req)}/student-scan?token=${encodeURIComponent(token)}` : null,
    attendance: records.filter((record) => record.sessionId === row.id),
    presentCount: records.filter((record) =>
      record.sessionId === row.id && record.status === 'present'
    ).length,
    absentCount: records.filter((record) =>
      record.sessionId === row.id && record.status === 'absent'
    ).length,
  };
};

const finalizeMysqlSession = async (sessionId, username, onlyIfExpired = false) => {
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.execute(
      `SELECT * FROM attendance_sessions
       WHERE id = ?${username ? ' AND teacher_username = ?' : ''}
       LIMIT 1 FOR UPDATE`,
      username ? [sessionId, username] : [sessionId]
    );
    const session = rows[0];
    if (!session || session.status !== 'active') {
      await connection.commit();
      transactionStarted = false;
      return { session, absentCount: 0, finalized: false };
    }

    const expired = new Date(asIso(session.expires_at)).getTime() <= Date.now();
    if (onlyIfExpired && !expired) {
      await connection.commit();
      transactionStarted = false;
      return { session, absentCount: 0, finalized: false };
    }

    const status = expired ? 'expired' : 'ended';
    await connection.execute(
      'UPDATE attendance_sessions SET status = ?, ended_at = UTC_TIMESTAMP() WHERE id = ? AND status = ?',
      [status, session.id, 'active']
    );
    const absentCount = await recordMissingStudentsAsAbsent(connection, session);
    await connection.commit();
    transactionStarted = false;
    return { session: { ...session, status }, absentCount, finalized: true };
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const finalizeExpiredTeacherSessions = async (username) => {
  const [rows] = await pool.execute(
    "SELECT id FROM attendance_sessions WHERE teacher_username = ? AND status = 'active' AND expires_at <= UTC_TIMESTAMP()",
    [username]
  );
  for (const row of rows) {
    await finalizeMysqlSession(row.id, username, true);
  }
};

const listTeacherSessions = async (username, req) => {
  await finalizeExpiredTeacherSessions(username);
  const [sessionRows] = await pool.execute(
    'SELECT * FROM attendance_sessions WHERE teacher_username = ? ORDER BY started_at DESC',
    [username]
  );
  const [recordRows] = await pool.query(
    'SELECT id, session_id, student_id, student_name, roll_no, class_name, subject, attendance_date, recorded_at, status, reason, source FROM attendance WHERE session_id IS NOT NULL ORDER BY recorded_at DESC'
  );
  const records = recordRows.map(mapAttendance);
  return sessionRows.map((row) => mapSession(row, records, req));
};

const getSessionFromToken = async (token, database = pool) => {
  const sessionId = typeof token === 'string' ? token.split('.')[0] : '';
  if (!sessionId) return { error: 'invalid' };
  const [rows] = await database.execute(
    `SELECT * FROM attendance_sessions WHERE id = ? LIMIT 1${database === pool ? '' : ' FOR UPDATE'}`,
    [sessionId]
  );
  const session = rows[0];
  if (!session || !verifySessionQrToken(token, { id: session.id, expiresAt: asIso(session.expires_at) })) {
    return { error: 'invalid' };
  }
  if (session.status !== 'active') return { error: 'inactive' };
  if (new Date(asIso(session.expires_at)).getTime() <= Date.now()) {
    return { error: 'expired', session };
  }
  return { session };
};

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', async (req, res) => {
  const missingConfig = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
    .filter((name) => !process.env[name]);
  if (missingConfig.length) {
    return res.status(503).json({ ok: false, message: 'MySQL environment configuration is incomplete.' });
  }
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'mysql' });
  } catch (error) {
    console.error('MySQL health check failed:', error.message);
    res.status(503).json({ ok: false, message: 'MySQL is not available.' });
  }
});

app.get('/api/auth/status', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id FROM teacher_accounts WHERE id = 1 LIMIT 1');
    return res.json({ teacherRegistered: rows.length > 0 });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/register', loginRateLimit, async (req, res, next) => {
  const credentials = validateTeacherCredentials(req.body?.username, req.body?.password);
  if (credentials.error) return res.status(400).json({ message: credentials.error });

  try {
    const [existing] = await pool.execute('SELECT id FROM teacher_accounts WHERE id = 1 LIMIT 1');
    if (existing.length) {
      return res.status(409).json({ message: 'The first teacher account is already registered. Please sign in.' });
    }
    const token = createTeacherToken(credentials.username);
    const { salt, hash } = hashPassword(credentials.password);
    await pool.execute(
      'INSERT INTO teacher_accounts (id, username, password_hash, password_salt) VALUES (1, ?, ?, ?)',
      [credentials.username, hash, salt]
    );
    return res.status(201).json({
      token,
      teacher: { username: credentials.username },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'The first teacher account is already registered. Please sign in.' });
    }
    return next(error);
  }
});

app.post('/api/auth/login', loginRateLimit, async (req, res, next) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT username, password_hash, password_salt FROM teacher_accounts WHERE id = 1 LIMIT 1'
    );
    const account = rows[0];
    if (!account || normalize(username) !== normalize(account.username) ||
        !verifyPassword(password, account.password_salt, account.password_hash)) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    return res.json({
      token: createTeacherToken(account.username),
      teacher: { username: account.username },
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', requireTeacher, (req, res) => {
  res.json({ teacher: { username: req.teacher.username } });
});

app.get('/api/bootstrap', requireTeacher, async (req, res, next) => {
  try {
    const [students] = await pool.query('SELECT id, name, roll_no, class_name FROM students ORDER BY roll_no');
    const [recordRows] = await pool.query(
      'SELECT id, session_id, student_id, student_name, roll_no, class_name, subject, attendance_date, recorded_at, status, reason, source FROM attendance ORDER BY recorded_at DESC'
    );
    const settingsRows = await pool.query('SELECT * FROM class_settings WHERE id = 1');
    const attendanceSessions = await listTeacherSessions(req.teacher.username, req);
    const settings = settingsRows[0][0] || {};
    res.json({
      students: students.map(mapStudent),
      attendanceRecords: recordRows.map(mapAttendance),
      attendanceSessions,
      settings: {
        schoolName: settings.school_name || 'Oriental University',
        classOptions: ['10-A', '10-B', '11-A', '11-B', '12-A', '12-B'],
        theme: 'light',
        classLatitude: settings.class_latitude ?? '',
        classLongitude: settings.class_longitude ?? '',
        attendanceRadius: settings.attendance_radius || 5,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/attendance', requireTeacher, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, session_id, student_id, student_name, roll_no, class_name, subject, attendance_date, recorded_at, status, reason, source FROM attendance ORDER BY recorded_at DESC'
    );
    res.json(rows.map(mapAttendance));
  } catch (error) {
    next(error);
  }
});

app.get('/api/sessions', requireTeacher, async (req, res, next) => {
  try {
    res.json(await listTeacherSessions(req.teacher.username, req));
  } catch (error) {
    next(error);
  }
});

app.post('/api/sessions', requireTeacher, async (req, res, next) => {
  const className = typeof req.body?.className === 'string' ? req.body.className.trim() : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  if (!className || !subject) return res.status(400).json({ message: 'Select a class and enter a subject.' });
  if (className.length > 80 || subject.length > 120) return res.status(400).json({ message: 'Class or subject is too long.' });

  try {
    const ttlMinutes = getSessionExpiryMinutes();
    const [studentRows] = await pool.execute('SELECT id FROM students WHERE class_name = ? LIMIT 1', [className]);
    if (!studentRows.length) return res.status(400).json({ message: 'No registered students were found for this class.' });
    const [activeRows] = await pool.execute(
      "SELECT id FROM attendance_sessions WHERE teacher_username = ? AND class_name = ? AND LOWER(subject) = LOWER(?) AND status = 'active' AND expires_at > UTC_TIMESTAMP() LIMIT 1",
      [req.teacher.username, className, subject]
    );
    if (activeRows.length) return res.status(409).json({ message: 'An active session already exists for this class and subject.' });

    const id = crypto.randomUUID();
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + ttlMinutes * 60 * 1000);
    await pool.execute(
      'INSERT INTO attendance_sessions (id, teacher_username, class_name, subject, session_date, started_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.teacher.username, className, subject, startedAt.toISOString().slice(0, 10), startedAt, expiresAt, 'active']
    );
    const sessions = await listTeacherSessions(req.teacher.username, req);
    return res.status(201).json(sessions.find((session) => session.id === id));
  } catch (error) {
    if (error.message.includes('SESSION_TTL_MINUTES')) {
      return res.status(503).json({ message: 'Attendance session expiry is not configured correctly.' });
    }
    return next(error);
  }
});

app.post('/api/sessions/:id/end', requireTeacher, async (req, res, next) => {
  try {
    const result = await finalizeMysqlSession(req.params.id, req.teacher.username);
    if (!result.session) return res.status(404).json({ message: 'Attendance session not found.' });
    if (result.session.status === 'active') {
      return res.status(409).json({ message: 'This attendance session is no longer active.' });
    }
    if (!result.finalized) {
      return res.status(409).json({ message: 'This attendance session is no longer active.' });
    }
    const sessions = await listTeacherSessions(req.teacher.username, req);
    return res.json({
      ...sessions.find((item) => item.id === req.params.id),
      newlyAbsentCount: result.absentCount,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/student-sessions/:token', async (req, res, next) => {
  try {
    const result = await getSessionFromToken(req.params.token);
    if (result.error === 'invalid') return res.status(404).json({ message: 'Invalid attendance QR code.' });
    if (result.error === 'expired') {
      await finalizeMysqlSession(result.session.id, null, true);
      return res.status(410).json({ message: 'This attendance QR code has expired.' });
    }
    if (result.error) return res.status(410).json({ message: 'This attendance session has ended.' });
    const session = result.session;
    return res.json({
      className: session.class_name,
      subject: session.subject,
      date: asDate(session.session_date),
      expiresAt: asIso(session.expires_at),
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/student-sessions/:token/attendance', async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const result = await getSessionFromToken(req.params.token, connection);
    if (result.error === 'invalid') {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'Invalid attendance QR code.' });
    }
    if (result.error === 'expired') {
      await connection.execute(
        "UPDATE attendance_sessions SET status = 'expired', ended_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'active'",
        [result.session.id]
      );
      await recordMissingStudentsAsAbsent(connection, result.session);
      await connection.commit();
      transactionStarted = false;
      return res.status(410).json({ message: 'This attendance QR code has expired.' });
    }
    if (result.error) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(410).json({ message: 'This attendance session has ended.' });
    }

    const { fullName, studentId } = req.body || {};
    if (typeof fullName !== 'string' || typeof studentId !== 'string' || !fullName.trim() || !studentId.trim()) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ message: 'Enter your registered full name and college roll number or student ID.' });
    }
    const session = result.session;
    const [students] = await connection.execute(
      'SELECT id, name, roll_no, class_name FROM students WHERE class_name = ?',
      [session.class_name]
    );
    const student = students.find((item) =>
      normalize(item.name) === normalize(fullName) &&
      normalize(item.roll_no) === normalize(studentId)
    );
    if (!student) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'Name and student ID do not match a registered student in this class.' });
    }

    const [insertResult] = await connection.execute(
      'INSERT INTO attendance (session_id, student_id, student_name, roll_no, class_name, subject, attendance_date, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [session.id, student.id, student.name, student.roll_no, session.class_name, session.subject, asDate(session.session_date), 'present', 'student_qr']
    );
    const [records] = await connection.execute(
      'SELECT id, session_id, student_id, student_name, roll_no, class_name, subject, attendance_date, recorded_at, status, reason, source FROM attendance WHERE id = ?',
      [insertResult.insertId]
    );
    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({
      message: 'Attendance recorded successfully.',
      attendance: mapAttendance(records[0]),
    });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Attendance has already been recorded for this student in this session.' });
    }
    return next(error);
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/attendance/scan', (req, res) => {
  res.status(410).json({ message: 'This endpoint is retired. Use an active session QR code.' });
});

app.post('/api/students', requireTeacher, async (req, res, next) => {
  try {
    const { name, rollNo, class: studentClass } = req.body || {};
    if (typeof name !== 'string' || typeof rollNo !== 'string' || typeof studentClass !== 'string' ||
        !name.trim() || !rollNo.trim() || !studentClass.trim()) {
      return res.status(400).json({ message: 'Name, roll number and class are required.' });
    }
    const id = Date.now();
    await pool.execute(
      'INSERT INTO students (id, name, roll_no, class_name) VALUES (?, ?, ?, ?)',
      [id, name.trim(), rollNo.trim(), studentClass.trim()]
    );
    return res.status(201).json({ id, name: name.trim(), rollNo: rollNo.trim(), class: studentClass.trim() });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This roll number is already registered.' });
    return next(error);
  }
});

app.delete('/api/students/:id', requireTeacher, async (req, res, next) => {
  try {
    await pool.execute('DELETE FROM students WHERE id = ?', [Number(req.params.id)]);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.put('/api/settings', requireTeacher, async (req, res, next) => {
  try {
    const { schoolName, classLatitude, classLongitude, attendanceRadius } = req.body;
    await pool.execute(
      'UPDATE class_settings SET school_name = ?, class_latitude = NULLIF(?, ""), class_longitude = NULLIF(?, ""), attendance_radius = ? WHERE id = 1',
      [schoolName || 'Oriental University', classLatitude ?? '', classLongitude ?? '', attendanceRadius || 5]
    );
    return res.json({ schoolName: schoolName || 'Oriental University' });
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, next) => {
  console.error('API request failed:', error);
  res.status(500).json({ message: 'The database request could not be completed.' });
});

const port = process.env.PORT || 4000;
app.listen(port, '0.0.0.0', () => console.log(`MySQL attendance API running on http://localhost:${port}`));
