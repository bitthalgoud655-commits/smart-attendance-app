const API_URL = process.env.REACT_APP_API_URL || '/api';
const AUTH_TOKEN_KEY = 'smart_attendance_teacher_token';

const request = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.auth !== false) {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const requestOptions = { ...options };
  delete requestOptions.auth;
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...requestOptions, headers });
  } catch (error) {
    throw new Error('Could not reach the attendance server. Check the API URL and network connection.');
  }
  const contentType = response.headers.get('content-type') || '';
  const body = response.status === 204
    ? null
    : contentType.includes('application/json')
      ? await response.json()
      : { message: 'The server returned an unexpected response.' };
  if (!response.ok) {
    const error = new Error(body?.message || 'Backend request failed.');
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
};

export const loginTeacher = (credentials) => request('/auth/login', {
  method: 'POST',
  body: JSON.stringify(credentials),
  auth: false,
});
export const getTeacherRegistrationStatus = () => request('/auth/status', { auth: false });
export const registerTeacherAccount = (credentials) => request('/auth/register', {
  method: 'POST',
  body: JSON.stringify(credentials),
  auth: false,
});
export const getCurrentTeacher = () => request('/auth/me');
export const getBootstrap = () => request('/bootstrap');
export const getRemoteAttendance = () => request('/attendance');
export const createStudent = (student) => request('/students', { method: 'POST', body: JSON.stringify(student) });
export const removeStudent = (id) => request(`/students/${id}`, { method: 'DELETE' });
export const updateRemoteSettings = (settings) => request('/settings', { method: 'PUT', body: JSON.stringify(settings) });
export const getSessions = () => request('/sessions');
export const createSession = (session) => request('/sessions', { method: 'POST', body: JSON.stringify(session) });
export const endSession = (id) => request(`/sessions/${encodeURIComponent(id)}/end`, { method: 'POST' });
export const getStudentSession = (token) => request(`/student-sessions/${encodeURIComponent(token)}`, { auth: false });
export const submitStudentAttendance = (token, student) => request(
  `/student-sessions/${encodeURIComponent(token)}/attendance`,
  { method: 'POST', body: JSON.stringify(student), auth: false }
);