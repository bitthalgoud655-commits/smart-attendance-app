import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import './AttendanceForm.css';

const AttendanceForm = () => {
  const {
    selectedDate,
    setSelectedDate,
    selectedClass,
    setSelectedClass,
    getFilteredStudents,
    getTodayAttendance,
    markAttendance,
    settings,
  } = useApp();

  const filteredStudents = getFilteredStudents();
  const todayAttendance = getTodayAttendance();

  const [attendanceMap, setAttendanceMap] = useState({});
  const [saved, setSaved] = useState(false);

  // Initialize attendance map from existing records
  useEffect(() => {
    const map = {};
    todayAttendance.forEach((record) => {
      map[record.studentId] = record.status;
    });
    setAttendanceMap(map);
    setSaved(false);
  }, [selectedDate, selectedClass, todayAttendance.length]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
  };

  const markAllAs = (status) => {
    const map = {};
    filteredStudents.forEach((s) => {
      map[s.id] = status;
    });
    setAttendanceMap(map);
    setSaved(false);
  };

  const handleSave = () => {
    const records = filteredStudents
      .filter((s) => attendanceMap[s.id])
      .map((s) => ({
        studentId: s.id,
        studentName: s.name,
        rollNo: s.rollNo,
        class: s.class,
        status: attendanceMap[s.id],
      }));

    markAttendance(selectedDate, records);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const getStatusClass = (studentId) => {
    return attendanceMap[studentId] || '';
  };

  return (
    <div className="attendance-form-container">
      <div className="attendance-form-header">
        <h2>📝 Mark Attendance</h2>
        <div className="attendance-controls">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
          />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="class-filter"
          >
            <option value="all">All Classes</option>
            {settings.classOptions.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="quick-actions">
        <button className="btn btn-quick present" onClick={() => markAllAs('present')}>
          ✅ All Present
        </button>
        <button className="btn btn-quick absent" onClick={() => markAllAs('absent')}>
          ❌ All Absent
        </button>
      </div>

      <div className="attendance-list">
        {filteredStudents.map((student) => (
          <div
            key={student.id}
            className={`attendance-item ${getStatusClass(student.id)}`}
          >
            <div className="attendance-student-info">
              <span className="attendance-roll">{student.rollNo}</span>
              <span className="attendance-name">{student.name}</span>
              <span className="attendance-class">{student.class}</span>
            </div>
            <div className="status-buttons">
              <button
                className={`status-btn present ${
                  attendanceMap[student.id] === 'present' ? 'active' : ''
                }`}
                onClick={() => handleStatusChange(student.id, 'present')}
              >
                ✅ P
              </button>
              <button
                className={`status-btn late ${
                  attendanceMap[student.id] === 'late' ? 'active' : ''
                }`}
                onClick={() => handleStatusChange(student.id, 'late')}
              >
                ⏰ L
              </button>
              <button
                className={`status-btn absent ${
                  attendanceMap[student.id] === 'absent' ? 'active' : ''
                }`}
                onClick={() => handleStatusChange(student.id, 'absent')}
              >
                ❌ A
              </button>
            </div>
          </div>
        ))}

        {filteredStudents.length === 0 && (
          <div className="empty-state">
            No students found for selected class.
          </div>
        )}
      </div>

      {filteredStudents.length > 0 && (
        <div className="attendance-save">
          <button className="btn btn-save" onClick={handleSave}>
            {saved ? '✅ Saved Successfully!' : '💾 Save Attendance'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AttendanceForm;
