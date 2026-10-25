const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const authSecret = crypto.randomBytes(48).toString('base64url');
process.env.AUTH_SECRET = authSecret;
const { createSessionQrToken } = require('./auth');

let api;
let child;
let dataFile;
let tempDir;
let port;
let accessToken;
let session;
let qrToken;

const request = async (route, options = {}) => {
  const headers = {
    Origin: 'http://localhost:3000',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${api}${route}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
};

const reservePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close((error) => error ? reject(error) : resolve(address.port));
  });
});

before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-attendance-test-'));
  dataFile = path.join(tempDir, 'attendance.json');
  fs.writeFileSync(dataFile, JSON.stringify({
    students: [
      { id: 41, name: 'Aarav Sharma', rollNo: 'CS-41', class: '10-A' },
      { id: 42, name: 'Priya Singh', rollNo: 'CS-42', class: '10-A' },
    ],
    attendanceRecords: [],
    attendanceSessions: [],
    settings: { schoolName: 'Test University', classOptions: ['10-A'] },
  }));
  port = await reservePort();
  api = `http://127.0.0.1:${port}/api`;
  child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: dataFile,
      AUTH_SECRET: authSecret,
      SESSION_TTL_MINUTES: '10',
      PUBLIC_APP_URL: 'https://attendance.example.test',
      CORS_ORIGIN: 'http://localhost:3000',
    },
    stdio: 'ignore',
  });

  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${api}/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.equal(ready, true, 'JSON API should start for integration tests');
});

after(() => {
  if (child && child.exitCode === null) child.kill();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

test('teacher authentication protects dashboard and session APIs', async () => {
  assert.equal((await request('/bootstrap')).status, 401);
  assert.equal((await request('/sessions', { method: 'POST', body: { className: '10-A', subject: 'Math' } })).status, 401);
  assert.deepEqual(await (await request('/auth/status')).json(), { teacherRegistered: false });
  assert.equal((await request('/auth/register', {
    method: 'POST',
    body: { username: 'ab', password: 'short' },
  })).status, 400);

  const registration = await request('/auth/register', {
    method: 'POST',
    body: { username: 'test-teacher', password: 'correct-horse-battery-staple' },
  });
  assert.equal(registration.status, 201);
  const result = await registration.json();
  assert.ok(result.token);
  assert.equal(result.teacher.username, 'test-teacher');
  accessToken = result.token;
  assert.deepEqual(await (await request('/auth/status')).json(), { teacherRegistered: true });

  const storedData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  assert.notEqual(storedData.teacherAccount.passwordHash, 'correct-horse-battery-staple');
  assert.notEqual(storedData.teacherAccount.passwordHash, storedData.teacherAccount.passwordSalt);
  assert.equal((await request('/auth/register', {
    method: 'POST',
    body: { username: 'another-teacher', password: 'another-secure-password' },
  })).status, 409);
  assert.equal((await request('/auth/login', {
    method: 'POST',
    body: { username: 'test-teacher', password: 'wrong-password' },
  })).status, 401);

  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: { username: 'test-teacher', password: 'correct-horse-battery-staple' },
  });
  assert.equal(loginResponse.status, 200);
  assert.ok((await loginResponse.json()).token);
  assert.equal((await request('/auth/me', { token: accessToken })).status, 200);
  const bootstrap = await request('/bootstrap', { token: accessToken });
  assert.equal(bootstrap.status, 200);
  assert.equal(Object.hasOwn(await bootstrap.json(), 'teacherAccount'), false);
});

test('session QR validates student identity, stores attendance, rejects duplicates, and expires on end', async () => {
  const createResponse = await request('/sessions', {
    method: 'POST',
    token: accessToken,
    body: { className: '10-A', subject: 'Mathematics' },
  });
  assert.equal(createResponse.status, 201);
  session = await createResponse.json();
  assert.equal(session.status, 'active');
  assert.equal(session.className, '10-A');
  assert.equal(session.subject, 'Mathematics');
  assert.ok(new Date(session.expiresAt).getTime() > Date.now());
  assert.equal(new URL(session.attendanceUrl).origin, 'https://attendance.example.test');
  qrToken = new URL(session.attendanceUrl).searchParams.get('token');
  assert.ok(qrToken);

  const publicSession = await request(`/student-sessions/${encodeURIComponent(qrToken)}`);
  assert.equal(publicSession.status, 200);
  assert.equal((await publicSession.json()).subject, 'Mathematics');

  const invalidStudent = await request(`/student-sessions/${encodeURIComponent(qrToken)}/attendance`, {
    method: 'POST',
    body: { fullName: 'Aarav Sharma', studentId: 'CS-42' },
  });
  assert.equal(invalidStudent.status, 404);

  const accepted = await request(`/student-sessions/${encodeURIComponent(qrToken)}/attendance`, {
    method: 'POST',
    body: { fullName: '  aarav   sharma ', studentId: 'cs-41' },
  });
  assert.equal(accepted.status, 201);
  const attendanceResponse = await accepted.json();
  assert.equal(attendanceResponse.attendance.studentId, 41);
  assert.equal(attendanceResponse.attendance.sessionId, session.id);
  assert.equal(attendanceResponse.attendance.class, '10-A');
  assert.equal(attendanceResponse.attendance.subject, 'Mathematics');
  assert.ok(attendanceResponse.attendance.timestamp);

  const duplicate = await request(`/student-sessions/${encodeURIComponent(qrToken)}/attendance`, {
    method: 'POST',
    body: { fullName: 'Aarav Sharma', studentId: 'CS-41' },
  });
  assert.equal(duplicate.status, 409);

  const savedData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  assert.equal(savedData.attendanceRecords.length, 1);
  assert.equal(savedData.attendanceRecords[0].sessionId, session.id);

  const reportResponse = await request('/sessions', { token: accessToken });
  assert.equal(reportResponse.status, 200);
  const reports = await reportResponse.json();
  assert.equal(reports[0].presentCount, 1);
  assert.equal(reports[0].attendance[0].rollNo, 'CS-41');

  const endResponse = await request(`/sessions/${session.id}/end`, {
    method: 'POST',
    token: accessToken,
  });
  assert.equal(endResponse.status, 200);
  const endedSession = await endResponse.json();
  assert.equal(endedSession.status, 'ended');
  assert.equal(endedSession.presentCount, 1);
  assert.equal(endedSession.absentCount, 1);
  assert.equal(endedSession.newlyAbsentCount, 1);
  assert.deepEqual(
    endedSession.attendance.map((record) => [record.rollNo, record.status]),
    [['CS-41', 'present'], ['CS-42', 'absent']]
  );
  assert.equal((await request(`/student-sessions/${encodeURIComponent(qrToken)}`)).status, 410);
});

test('expired session QR is rejected and legacy direct scan endpoint is retired', async () => {
  const createResponse = await request('/sessions', {
    method: 'POST',
    token: accessToken,
    body: { className: '10-A', subject: 'Physics' },
  });
  assert.equal(createResponse.status, 201);
  const expiredSession = await createResponse.json();
  const stored = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const row = stored.attendanceSessions.find((item) => item.id === expiredSession.id);
  row.expiresAt = new Date(Date.now() - 60_000).toISOString();
  fs.writeFileSync(dataFile, JSON.stringify(stored, null, 2));
  const expiredToken = createSessionQrToken(row.id, row.expiresAt);

  const bootstrap = await request('/bootstrap', { token: accessToken });
  assert.equal(bootstrap.status, 200);
  const expiredInBootstrap = (await bootstrap.json()).attendanceSessions.find((item) => item.id === row.id);
  assert.equal(expiredInBootstrap.status, 'expired');
  assert.equal(expiredInBootstrap.absentCount, 2);
  assert.equal((await request(`/student-sessions/${encodeURIComponent(expiredToken)}`)).status, 410);
  const expiredData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const expiredAttendance = expiredData.attendanceRecords.filter((record) => record.sessionId === row.id);
  assert.equal(expiredAttendance.length, 2);
  assert.ok(expiredAttendance.every((record) => record.status === 'absent'));
  const expiredSubmit = await request(`/student-sessions/${encodeURIComponent(expiredToken)}/attendance`, {
    method: 'POST',
    body: { fullName: 'Priya Singh', studentId: 'CS-42' },
  });
  assert.equal(expiredSubmit.status, 410);
  const afterExpiredSubmit = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  assert.equal(afterExpiredSubmit.attendanceRecords.filter((record) => record.sessionId === row.id).length, 2);
  assert.equal((await request('/attendance/scan', { method: 'POST', body: {} })).status, 410);
});
