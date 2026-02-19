import React, { createContext, useContext, useReducer, useEffect } from 'react';
import {
  getStudents,
  saveStudents,
  getAttendanceRecords,
  saveAttendanceRecords,
  getSettings,
  saveSettings,
} from '../services/storageService';

const AppContext = createContext();

// ─── Action Types ────────────────────────────────────
const ACTIONS = {
  SET_STUDENTS: 'SET_STUDENTS',
  ADD_STUDENT: 'ADD_STUDENT',
  DELETE_STUDENT: 'DELETE_STUDENT',
  MARK_ATTENDANCE: 'MARK_ATTENDANCE',
  SET_ATTENDANCE: 'SET_ATTENDANCE',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SET_SELECTED_DATE: 'SET_SELECTED_DATE',
  SET_SELECTED_CLASS: 'SET_SELECTED_CLASS',
};

// ─── Reducer ─────────────────────────────────────────
const appReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_STUDENTS:
      return { ...state, students: action.payload };
    case ACTIONS.ADD_STUDENT:
      return { ...state, students: [...state.students, action.payload] };
    case ACTIONS.DELETE_STUDENT:
      return {
        ...state,
        students: state.students.filter((s) => s.id !== action.payload),
        attendanceRecords: state.attendanceRecords.filter(
          (r) => r.studentId !== action.payload
        ),
      };
    case ACTIONS.MARK_ATTENDANCE:
      // payload: { date, records: [{ studentId, status }] }
      const { date, records } = action.payload;
      // Remove existing records for this date, then add new ones
      const filtered = state.attendanceRecords.filter((r) => r.date !== date);
      const newRecords = records.map((r) => ({ ...r, date }));
      return { ...state, attendanceRecords: [...filtered, ...newRecords] };
    case ACTIONS.SET_ATTENDANCE:
      return { ...state, attendanceRecords: action.payload };
    case ACTIONS.UPDATE_SETTINGS:
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case ACTIONS.SET_SELECTED_DATE:
      return { ...state, selectedDate: action.payload };
    case ACTIONS.SET_SELECTED_CLASS:
      return { ...state, selectedClass: action.payload };
    default:
      return state;
  }
};

// ─── Provider ────────────────────────────────────────
export const AppProvider = ({ children }) => {
  const today = new Date().toISOString().split('T')[0];

  const initialState = {
    students: getStudents(),
    attendanceRecords: getAttendanceRecords(),
    settings: getSettings(),
    selectedDate: today,
    selectedClass: 'all',
  };

  const [state, dispatch] = useReducer(appReducer, initialState);

  // Persist to localStorage on changes
  useEffect(() => {
    saveStudents(state.students);
  }, [state.students]);

  useEffect(() => {
    saveAttendanceRecords(state.attendanceRecords);
  }, [state.attendanceRecords]);

  useEffect(() => {
    saveSettings(state.settings);
  }, [state.settings]);

  // ─── Helper functions ──────────────────────────────
  const addStudent = (student) => {
    const id = Date.now();
    dispatch({ type: ACTIONS.ADD_STUDENT, payload: { ...student, id } });
  };

  const deleteStudent = (id) => {
    dispatch({ type: ACTIONS.DELETE_STUDENT, payload: id });
  };

  const markAttendance = (date, records) => {
    dispatch({ type: ACTIONS.MARK_ATTENDANCE, payload: { date, records } });
  };

  const updateSettings = (newSettings) => {
    dispatch({ type: ACTIONS.UPDATE_SETTINGS, payload: newSettings });
  };

  const setSelectedDate = (date) => {
    dispatch({ type: ACTIONS.SET_SELECTED_DATE, payload: date });
  };

  const setSelectedClass = (cls) => {
    dispatch({ type: ACTIONS.SET_SELECTED_CLASS, payload: cls });
  };

  // ─── Computed values ───────────────────────────────
  const getFilteredStudents = () => {
    if (state.selectedClass === 'all') return state.students;
    return state.students.filter((s) => s.class === state.selectedClass);
  };

  const getTodayAttendance = () => {
    return state.attendanceRecords.filter((r) => r.date === state.selectedDate);
  };

  const getStudentAttendance = (studentId) => {
    return state.attendanceRecords.filter((r) => r.studentId === studentId);
  };

  const getStats = () => {
    const total = state.students.length;
    const todayRecords = getTodayAttendance();
    const present = todayRecords.filter((r) => r.status === 'present').length;
    const absent = todayRecords.filter((r) => r.status === 'absent').length;
    const late = todayRecords.filter((r) => r.status === 'late').length;
    const unmarked = total - todayRecords.length;

    return { total, present, absent, late, unmarked };
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        addStudent,
        deleteStudent,
        markAttendance,
        updateSettings,
        setSelectedDate,
        setSelectedClass,
        getFilteredStudents,
        getTodayAttendance,
        getStudentAttendance,
        getStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export default AppContext;
