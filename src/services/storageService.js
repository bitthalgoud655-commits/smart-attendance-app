// LocalStorage based service for persistence
const STUDENTS_KEY = 'smart_attendance_students';
const ATTENDANCE_KEY = 'smart_attendance_records';
const SETTINGS_KEY = 'smart_attendance_settings';

// ─── Students ────────────────────────────────────────
export const getStudents = () => {
  const data = localStorage.getItem(STUDENTS_KEY);
  return data ? JSON.parse(data) : getDefaultStudents();
};

export const saveStudents = (students) => {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
};

const getDefaultStudents = () => {
  const defaults = [
    { id: 1, name: 'Aarav Sharma', rollNo: '101', class: '10-A' },
    { id: 2, name: 'Priya Singh', rollNo: '102', class: '10-A' },
    { id: 3, name: 'Rohan Patel', rollNo: '103', class: '10-A' },
    { id: 4, name: 'Sneha Gupta', rollNo: '104', class: '10-A' },
    { id: 5, name: 'Vikram Kumar', rollNo: '105', class: '10-A' },
    { id: 6, name: 'Ananya Verma', rollNo: '106', class: '10-B' },
    { id: 7, name: 'Arjun Reddy', rollNo: '107', class: '10-B' },
    { id: 8, name: 'Kavya Nair', rollNo: '108', class: '10-B' },
    { id: 9, name: 'Manish Tiwari', rollNo: '109', class: '10-B' },
    { id: 10, name: 'Neha Joshi', rollNo: '110', class: '10-B' },
  ];
  saveStudents(defaults);
  return defaults;
};

// ─── Attendance ──────────────────────────────────────
export const getAttendanceRecords = () => {
  const data = localStorage.getItem(ATTENDANCE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveAttendanceRecords = (records) => {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
};

export const addAttendanceRecord = (record) => {
  const records = getAttendanceRecords();
  records.push(record);
  saveAttendanceRecords(records);
  return records;
};

export const getAttendanceByDate = (date) => {
  const records = getAttendanceRecords();
  return records.filter((r) => r.date === date);
};

export const getAttendanceByStudent = (studentId) => {
  const records = getAttendanceRecords();
  return records.filter((r) => r.studentId === studentId);
};

// ─── Settings ────────────────────────────────────────
export const getSettings = () => {
  const data = localStorage.getItem(SETTINGS_KEY);
  return data
    ? JSON.parse(data)
    : {
        schoolName: 'Smart Vidyalaya',
        classOptions: ['10-A', '10-B', '11-A', '11-B', '12-A', '12-B'],
        theme: 'light',
      };
};

export const saveSettings = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};
