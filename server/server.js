require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
const PORT = process.env.PORT || 4000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultData = {
  students: [
    { id: 1, name: 'Aarav Sharma', rollNo: '101', class: '10-A' },
    { id: 2, name: 'Priya Singh', rollNo: '102', class: '10-A' },
  ],
  attendanceRecords: [],
  attendanceSessions: [],
  teacherAccount: null,
  settings: {
    schoolName: 'Oriental University',
    classOptions: ['10-A', '10-B', '11-A', '11-B', '12-A', '12-B'],
    theme: 'light',
    classLatitude: '',
    classLongitude: '',
    attendanceRadius: 5,
  },
};

const readData = () => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  data.attendanceSessions = data.attendanceSessions || [];
  data.teacherAccount = data.teacherAccount || null;
  return data;
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

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

const sessionAttendance = (data, sessionId) =>
  data.attendanceRecords.filter((record) => record.sessionId === sessionId);

const finalizeSession = (data, session, status) => {
  if (session.status !== 'active') return 0;
  const endedAt = new Date().toISOString();
  const recordedStudentIds = new Set(
    sessionAttendance(data, session.id).map((record) => String(record.studentId))
  );
  const absentRecords = data.students
    .filter((student) =>
      student.class === session.className && !recordedStudentIds.has(String(student.id))
    )
    .map((student) => ({
      id: crypto.randomUUID(),
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      sessionId: session.id,
      class: session.className,
      subject: session.subject,
      date: session.date,
      timestamp: endedAt,
      status: 'absent',
      reason: 'Did not check in before the session ended.',
      source: 'session_end',
    }));

  data.attendanceRecords.push(...absentRecords);
  session.status = status;
  session.endedAt = endedAt;
  return absentRecords.length;
};

const finalizeExpiredSessions = (data, username) => {
  let changed = false;
  data.attendanceSessions
    .filter((session) =>
      session.teacher === username &&
      session.status === 'active' &&
      new Date(session.expiresAt).getTime() <= Date.now()
    )
    .forEach((session) => {
      finalizeSession(data, session, 'expired');
      changed = true;
    });
  if (changed) writeData(data);
};

const sessionForTeacher = (data, session, username, req) => {
  const token = session.status === 'active' && new Date(session.expiresAt).getTime() > Date.now()
    ? createSessionQrToken(session.id, session.expiresAt)
    : null;
  return {
    ...session,
    status: session.status === 'active' && !token ? 'expired' : session.status,
    attendanceUrl: token ? `${getAppUrl(req)}/student-scan?token=${encodeURIComponent(token)}` : null,
    attendance: sessionAttendance(data, session.id),
    presentCount: sessionAttendance(data, session.id)
      .filter((record) => record.status === 'present').length,
    absentCount: sessionAttendance(data, session.id)
      .filter((record) => record.status === 'absent').length,
    teacher: username,
  };
};

const findSessionFromToken = (data, token) => {
  const sessionId = typeof token === 'string' ? token.split('.')[0] : '';
  const session = data.attendanceSessions.find((item) => item.id === sessionId);
  if (!session || !verifySessionQrToken(token, session)) return { error: 'invalid' };

  if (session.status !== 'active') return { error: 'inactive', session };
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    finalizeSession(data, session, 'expired');
    writeData(data);
    return { error: 'expired', session };
  }
  return { session };
};

const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, database: 'json' }));

app.get('/api/auth/status', (req, res) => {
  res.json({ teacherRegistered: Boolean(readData().teacherAccount) });
});

app.post('/api/auth/register', loginRateLimit, (req, res) => {
  const credentials = validateTeacherCredentials(req.body?.username, req.body?.password);
  if (credentials.error) return res.status(400).json({ message: credentials.error });

  const data = readData();
  if (data.teacherAccount) {
    return res.status(409).json({ message: 'The first teacher account is already registered. Please sign in.' });
  }

  try {
    const token = createTeacherToken(credentials.username);
    const { salt, hash } = hashPassword(credentials.password);
    data.teacherAccount = {
      username: credentials.username,
      passwordSalt: salt,
      passwordHash: hash,
    };
    writeData(data);
    return res.status(201).json({
      token,
      teacher: { username: credentials.username },
    });
  } catch (error) {
    console.error('Teacher registration failed:', error.message);
    return res.status(503).json({ message: 'Could not register the teacher account. Check server authentication configuration.' });
  }
});

app.post('/api/auth/login', loginRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  const account = readData().teacherAccount;
  if (!account || normalize(username) !== normalize(account.username) ||
      !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }
  return res.json({
    token: createTeacherToken(account.username),
    teacher: { username: account.username },
  });
});

app.get('/api/auth/me', requireTeacher, (req, res) => {
  res.json({ teacher: { username: req.teacher.username } });
});

app.get('/api/bootstrap', requireTeacher, (req, res) => {
  const data = readData();
  finalizeExpiredSessions(data, req.teacher.username);
  const publicData = { ...data };
  delete publicData.teacherAccount;
  const sessions = data.attendanceSessions
    .filter((session) => session.teacher === req.teacher.username)
    .map((session) => sessionForTeacher(data, session, req.teacher.username, req));
  res.json({ ...publicData, attendanceSessions: sessions });
});

app.get('/api/attendance', requireTeacher, (req, res) => {
  res.json(readData().attendanceRecords);
});

app.post('/api/sessions', requireTeacher, (req, res) => {
  const className = typeof req.body?.className === 'string' ? req.body.className.trim() : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  if (!className || !subject) {
    return res.status(400).json({ message: 'Select a class and enter a subject.' });
  }
  if (className.length > 80 || subject.length > 120) {
    return res.status(400).json({ message: 'Class or subject is too long.' });
  }

  const data = readData();
  if (!data.students.some((student) => student.class === className)) {
    return res.status(400).json({ message: 'No registered students were found for this class.' });
  }
  const duplicateActive = data.attendanceSessions.find((session) =>
    session.teacher === req.teacher.username &&
    session.className === className &&
    normalize(session.subject) === normalize(subject) &&
    session.status === 'active' &&
    new Date(session.expiresAt).getTime() > Date.now()
  );
  if (duplicateActive) {
    return res.status(409).json({ message: 'An active session already exists for this class and subject.' });
  }

  let ttlMinutes;
  try {
    ttlMinutes = getSessionExpiryMinutes();
  } catch (error) {
    return res.status(503).json({ message: 'Attendance session expiry is not configured correctly.' });
  }
  try {
    const startedAt = new Date();
    const session = {
      id: crypto.randomUUID(),
      teacher: req.teacher.username,
      className,
      subject,
      date: startedAt.toISOString().slice(0, 10),
      startedAt: startedAt.toISOString(),
      expiresAt: new Date(startedAt.getTime() + ttlMinutes * 60 * 1000).toISOString(),
      endedAt: null,
      status: 'active',
    };
    data.attendanceSessions.push(session);
    writeData(data);
    return res.status(201).json(sessionForTeacher(data, session, req.teacher.username, req));
  } catch (error) {
    console.error('Could not create attendance session:', error.message);
    return res.status(503).json({ message: 'Could not create attendance session. Check the app URL configuration.' });
  }
});

app.get('/api/sessions', requireTeacher, (req, res) => {
  const data = readData();
  finalizeExpiredSessions(data, req.teacher.username);
  const sessions = data.attendanceSessions
    .filter((session) => session.teacher === req.teacher.username)
    .map((session) => sessionForTeacher(data, session, req.teacher.username, req))
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  res.json(sessions);
});

app.post('/api/sessions/:id/end', requireTeacher, (req, res) => {
  const data = readData();
  const session = data.attendanceSessions.find((item) =>
    item.id === req.params.id && item.teacher === req.teacher.username
  );
  if (!session) return res.status(404).json({ message: 'Attendance session not found.' });
  if (session.status !== 'active') return res.status(409).json({ message: 'This attendance session is no longer active.' });
  const status = new Date(session.expiresAt).getTime() <= Date.now() ? 'expired' : 'ended';
  const absentCount = finalizeSession(data, session, status);
  writeData(data);
  return res.json({
    ...sessionForTeacher(data, session, req.teacher.username, req),
    newlyAbsentCount: absentCount,
  });
});

app.get('/api/student-sessions/:token', (req, res) => {
  const data = readData();
  const result = findSessionFromToken(data, req.params.token);
  if (result.error === 'invalid') return res.status(404).json({ message: 'Invalid attendance QR code.' });
  if (result.error === 'expired') return res.status(410).json({ message: 'This attendance QR code has expired.' });
  if (result.error) return res.status(410).json({ message: 'This attendance session has ended.' });
  const { session } = result;
  return res.json({
    className: session.className,
    subject: session.subject,
    date: session.date,
    expiresAt: session.expiresAt,
  });
});

app.post('/api/student-sessions/:token/attendance', (req, res) => {
  const data = readData();
  const result = findSessionFromToken(data, req.params.token);
  if (result.error === 'invalid') return res.status(404).json({ message: 'Invalid attendance QR code.' });
  if (result.error === 'expired') return res.status(410).json({ message: 'This attendance QR code has expired.' });
  if (result.error) return res.status(410).json({ message: 'This attendance session has ended.' });

  const { fullName, studentId } = req.body || {};
  if (typeof fullName !== 'string' || typeof studentId !== 'string' || !fullName.trim() || !studentId.trim()) {
    return res.status(400).json({ message: 'Enter your registered full name and college roll number or student ID.' });
  }
  const { session } = result;
  const student = data.students.find((item) =>
    item.class === session.className &&
    normalize(item.name) === normalize(fullName) &&
    normalize(item.rollNo) === normalize(studentId)
  );
  if (!student) return res.status(404).json({ message: 'Name and student ID do not match a registered student in this class.' });
  if (sessionAttendance(data, session.id).some((record) => Number(record.studentId) === Number(student.id))) {
    return res.status(409).json({ message: 'Attendance has already been recorded for this student in this session.' });
  }

  const record = {
    id: crypto.randomUUID(),
    studentId: student.id,
    studentName: student.name,
    rollNo: student.rollNo,
    sessionId: session.id,
    class: session.className,
    subject: session.subject,
    date: session.date,
    timestamp: new Date().toISOString(),
    status: 'present',
    source: 'student_qr',
  };
  data.attendanceRecords.push(record);
  writeData(data);
  return res.status(201).json({ message: 'Attendance recorded successfully.', attendance: record });
});

app.post('/api/attendance/scan', (req, res) => {
  res.status(410).json({ message: 'This endpoint is retired. Use an active session QR code.' });
});

app.post('/api/students', requireTeacher, (req, res) => {
  const { name, rollNo, class: studentClass } = req.body || {};
  if (typeof name !== 'string' || typeof rollNo !== 'string' || typeof studentClass !== 'string' ||
      !name.trim() || !rollNo.trim() || !studentClass.trim()) {
    return res.status(400).json({ message: 'Name, roll number and class are required.' });
  }

  const data = readData();
  if (data.students.some((student) => normalize(student.rollNo) === normalize(rollNo))) {
    return res.status(409).json({ message: 'This roll number is already registered.' });
  }

  const student = {
    id: Date.now(),
    name: name.trim(),
    rollNo: rollNo.trim(),
    class: studentClass.trim(),
  };
  data.students.push(student);
  writeData(data);
  return res.status(201).json(student);
});

app.delete('/api/students/:id', requireTeacher, (req, res) => {
  const data = readData();
  const studentId = Number(req.params.id);
  data.students = data.students.filter((student) => student.id !== studentId);
  data.attendanceRecords = data.attendanceRecords.filter((record) => record.studentId !== studentId);
  writeData(data);
  res.status(204).end();
});

app.put('/api/settings', requireTeacher, (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  writeData(data);
  res.json(data.settings);
});

app.use((error, req, res, next) => {
  console.error('API request failed:', error);
  res.status(500).json({ message: 'The request could not be completed.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Attendance API running on http://localhost:${PORT}`);
});
