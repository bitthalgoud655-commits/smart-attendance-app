const crypto = require('crypto');
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 10;

const constantTimeEqual = (left, right) => {
  const leftHash = crypto.createHash('sha256').update(String(left)).digest();
  const rightHash = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
};

const getAuthSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 characters.');
  }
  return secret;
};

const validateTeacherCredentials = (username, password) => {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(normalizedUsername)) {
    return { error: 'Username must be 3-40 characters and use only letters, numbers, dots, underscores or hyphens.' };
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return { error: 'Password must be between 12 and 128 characters.' };
  }
  return { username: normalizedUsername, password };
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
};

const verifyPassword = (password, salt, expectedHash) => {
  if (typeof password !== 'string' || typeof salt !== 'string' || typeof expectedHash !== 'string') {
    return false;
  }
  const actualHash = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return expected.length === actualHash.length && crypto.timingSafeEqual(actualHash, expected);
};

const sign = (value) =>
  crypto.createHmac('sha256', getAuthSecret()).update(value).digest('base64url');

const createTeacherToken = (username) => {
  const payload = Buffer.from(JSON.stringify({
    typ: 'teacher',
    sub: username,
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

const verifyTeacherToken = (token) => {
  if (typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;

  let expected;
  let claims;
  try {
    expected = sign(payload);
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (error) {
    return null;
  }
  if (!constantTimeEqual(signature, expected)) return null;
  if (
    claims.typ !== 'teacher' ||
    typeof claims.sub !== 'string' ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= Math.floor(Date.now() / 1000)
  ) return null;
  return { username: claims.sub, expiresAt: claims.exp * 1000 };
};

const loginRateLimit = (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const previous = loginAttempts.get(key);
  if (!previous || now - previous.startedAt >= LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, attempts: 1 });
    return next();
  }
  if (previous.attempts >= LOGIN_ATTEMPT_LIMIT) {
    res.set('Retry-After', String(Math.ceil((LOGIN_WINDOW_MS - (now - previous.startedAt)) / 1000)));
    return res.status(429).json({ message: 'Too many sign-in attempts. Try again later.' });
  }
  previous.attempts += 1;
  return next();
};

const parseBearerToken = (authorization) => {
  if (typeof authorization !== 'string') return null;
  const trimmed = authorization.trim();
  if (!trimmed) return null;

  const bearerMatch = trimmed.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1];

  const tokenMatch = trimmed.match(/^([A-Za-z0-9\-_]+(?:\.[A-Za-z0-9\-_]+)?)$/);
  return tokenMatch ? tokenMatch[1] : null;
};

const requireTeacher = (req, res, next) => {
  try {
    getAuthSecret();
    const authorization = req.get('authorization') || '';
    const token = parseBearerToken(authorization);
    const teacher = token ? verifyTeacherToken(token) : null;
    if (!teacher) return res.status(401).json({ message: 'Teacher login is required.' });
    req.teacher = teacher;
    return next();
  } catch (error) {
    return res.status(503).json({ message: 'Teacher authentication is not configured.' });
  }
};

const createSessionQrToken = (sessionId, expiresAt) => {
  const expiry = new Date(expiresAt).toISOString();
  const signature = sign(`attendance:${sessionId}:${expiry}`);
  return `${sessionId}.${signature}`;
};

const verifySessionQrToken = (token, session) => {
  if (typeof token !== 'string' || !session) return false;
  const [sessionId, signature, extra] = token.split('.');
  if (!sessionId || !signature || extra || sessionId !== session.id) return false;
  try {
    return constantTimeEqual(
      signature,
      sign(`attendance:${session.id}:${new Date(session.expiresAt).toISOString()}`)
    );
  } catch (error) {
    return false;
  }
};

module.exports = {
  createSessionQrToken,
  createTeacherToken,
  hashPassword,
  loginRateLimit,
  requireTeacher,
  validateTeacherCredentials,
  verifySessionQrToken,
  verifyPassword,
  verifyTeacherToken,
};
