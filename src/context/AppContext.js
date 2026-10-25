import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import {
  createStudent,
  createSession as createRemoteSession,
  endSession as endRemoteSession,
  getBootstrap,
  getCurrentTeacher,
  loginTeacher,
  registerTeacherAccount,
  removeStudent,
  updateRemoteSettings,
} from '../services/apiService';

const AppContext = createContext();
const AUTH_TOKEN_KEY = 'smart_attendance_teacher_token';

const initialState = {
  students: [],
  attendanceRecords: [],
  attendanceSessions: [],
  settings: {
    schoolName: 'Oriental University',
    classOptions: ['10-A', '10-B', '11-A', '11-B', '12-A', '12-B'],
    theme: 'light',
  },
  selectedDate: new Date().toISOString().slice(0, 10),
  selectedClass: 'all',
  teacher: null,
  authLoading: true,
  isLoaded: false,
  dataError: '',
};

const ACTIONS = {
  AUTH_READY: 'AUTH_READY',
  AUTHENTICATED: 'AUTHENTICATED',
  LOGOUT: 'LOGOUT',
  SET_BOOTSTRAP: 'SET_BOOTSTRAP',
  SET_DATA_ERROR: 'SET_DATA_ERROR',
  ADD_STUDENT: 'ADD_STUDENT',
  DELETE_STUDENT: 'DELETE_STUDENT',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SET_SELECTED_DATE: 'SET_SELECTED_DATE',
  SET_SELECTED_CLASS: 'SET_SELECTED_CLASS',
};

const appReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.AUTH_READY:
      return { ...state, authLoading: false };
    case ACTIONS.AUTHENTICATED:
      return {
        ...state,
        ...action.bootstrap,
        teacher: action.teacher,
        authLoading: false,
        isLoaded: true,
        dataError: '',
      };
    case ACTIONS.LOGOUT:
      return {
        ...initialState,
        selectedDate: new Date().toISOString().slice(0, 10),
        authLoading: false,
      };
    case ACTIONS.SET_BOOTSTRAP:
      return { ...state, ...action.bootstrap, isLoaded: true, dataError: '' };
    case ACTIONS.SET_DATA_ERROR:
      return { ...state, dataError: action.message };
    case ACTIONS.ADD_STUDENT:
      return { ...state, students: [...state.students, action.student] };
    case ACTIONS.DELETE_STUDENT:
      return {
        ...state,
        students: state.students.filter((student) => student.id !== action.id),
        attendanceRecords: state.attendanceRecords.filter((record) => record.studentId !== action.id),
      };
    case ACTIONS.UPDATE_SETTINGS:
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case ACTIONS.SET_SELECTED_DATE:
      return { ...state, selectedDate: action.date };
    case ACTIONS.SET_SELECTED_CLASS:
      return { ...state, selectedClass: action.className };
    default:
      return state;
  }
};

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const refreshBootstrap = useCallback(async () => {
    const bootstrap = await getBootstrap();
    dispatch({ type: ACTIONS.SET_BOOTSTRAP, bootstrap });
    return bootstrap;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    dispatch({ type: ACTIONS.LOGOUT });
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      dispatch({ type: ACTIONS.AUTH_READY });
      return;
    }

    Promise.all([getCurrentTeacher(), getBootstrap()])
      .then(([result, bootstrap]) => {
        dispatch({ type: ACTIONS.AUTHENTICATED, teacher: result.teacher, bootstrap });
      })
      .catch((error) => {
        if (error.status === 401) {
          sessionStorage.removeItem(AUTH_TOKEN_KEY);
          dispatch({ type: ACTIONS.AUTH_READY });
          return;
        }
        dispatch({ type: ACTIONS.SET_DATA_ERROR, message: error.message });
        dispatch({ type: ACTIONS.AUTH_READY });
      });
  }, []);

  useEffect(() => {
    if (!state.teacher) return undefined;
    const refresh = () => {
      refreshBootstrap().catch((error) => {
        if (error.status === 401) {
          logout();
          return;
        }
        dispatch({ type: ACTIONS.SET_DATA_ERROR, message: error.message });
      });
    };
    const intervalId = window.setInterval(refresh, 4000);
    return () => window.clearInterval(intervalId);
  }, [state.teacher, logout, refreshBootstrap]);

  const completeLogin = async (result) => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, result.token);
    try {
      const bootstrap = await getBootstrap();
      dispatch({ type: ACTIONS.AUTHENTICATED, teacher: result.teacher, bootstrap });
    } catch (error) {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      throw error;
    }
  };

  const login = async (credentials) => {
    await completeLogin(await loginTeacher(credentials));
  };

  const registerTeacher = async (credentials) => {
    await completeLogin(await registerTeacherAccount(credentials));
  };

  const addStudent = async (student) => {
    const savedStudent = await createStudent(student);
    dispatch({ type: ACTIONS.ADD_STUDENT, student: savedStudent });
    return savedStudent;
  };

  const deleteStudent = async (id) => {
    await removeStudent(id);
    dispatch({ type: ACTIONS.DELETE_STUDENT, id });
  };

  const startSession = async (session) => {
    const createdSession = await createRemoteSession(session);
    await refreshBootstrap();
    return createdSession;
  };

  const endSession = async (id) => {
    const endedSession = await endRemoteSession(id);
    await refreshBootstrap();
    return endedSession;
  };

  const updateSettings = async (settings) => {
    const savedSettings = await updateRemoteSettings(settings);
    dispatch({ type: ACTIONS.UPDATE_SETTINGS, settings: savedSettings });
  };

  const setSelectedDate = (date) => {
    const today = new Date().toISOString().slice(0, 10);
    dispatch({ type: ACTIONS.SET_SELECTED_DATE, date: date > today ? today : date });
  };

  const setSelectedClass = (className) => {
    dispatch({ type: ACTIONS.SET_SELECTED_CLASS, className });
  };

  const getFilteredStudents = () => state.selectedClass === 'all'
    ? state.students
    : state.students.filter((student) => student.class === state.selectedClass);

  const getTodayAttendance = () => state.attendanceRecords.filter(
    (record) => record.date === state.selectedDate
  );

  const getStudentAttendance = (studentId) => state.attendanceRecords.filter(
    (record) => record.studentId === studentId
  );

  const getStats = () => {
    const students = getFilteredStudents();
    const records = getTodayAttendance().filter((record) =>
      state.selectedClass === 'all' || record.class === state.selectedClass
    );
    const studentIdsWithStatus = (status) => new Set(
      records.filter((record) => record.status === status).map((record) => String(record.studentId))
    );
    const presentIds = studentIdsWithStatus('present');
    const absentIds = studentIdsWithStatus('absent');
    const lateIds = studentIdsWithStatus('late');
    const markedIds = new Set(records.map((record) => String(record.studentId)));
    return {
      total: students.length,
      present: presentIds.size,
      absent: absentIds.size,
      late: lateIds.size,
      unmarked: Math.max(0, students.length - markedIds.size),
    };
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        login,
        registerTeacher,
        logout,
        refreshBootstrap,
        addStudent,
        deleteStudent,
        startSession,
        endSession,
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
