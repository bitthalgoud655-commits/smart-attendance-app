import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import './StudentList.css';

const StudentList = () => {
  const {
    students,
    addStudent,
    deleteStudent,
    settings,
    selectedClass,
    setSelectedClass,
    getFilteredStudents,
  } = useApp();

  const [showForm, setShowForm] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [newStudent, setNewStudent] = useState({
    name: '',
    rollNo: '',
    class: settings.classOptions[0] || '10-A',
  });

  const filteredStudents = getFilteredStudents();

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newStudent.name.trim();
    const rollNo = newStudent.rollNo.trim();

    if (!name || !rollNo) {
      setFormMessage('Student name और roll number दोनों भरें।');
      return;
    }

    if (students.some((student) => String(student.rollNo).toLowerCase() === rollNo.toLowerCase())) {
      setFormMessage('यह roll number पहले से registered है।');
      return;
    }

    try {
      await addStudent({ ...newStudent, name, rollNo });
      setFormMessage('Student successfully registered.');
      setNewStudent({
        name: '',
        rollNo: '',
        class: settings.classOptions[0] || '10-A',
      });
    } catch (error) {
      setFormMessage(error.message || 'Registration failed. Start the backend and try again.');
    }
  };

  return (
    <div className="student-list-container">
      <div className="student-list-header">
        <h2>👨‍🎓 Students ({filteredStudents.length})</h2>
        <div className="student-list-actions">
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
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(!showForm);
              setFormMessage('');
            }}
          >
            {showForm ? '✕ Cancel' : '+ Add Student'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="add-student-form" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Student Name"
            value={newStudent.name}
            onChange={(e) =>
              setNewStudent({ ...newStudent, name: e.target.value })
            }
            required
          />
          <input
            type="text"
            placeholder="Roll No"
            value={newStudent.rollNo}
            onChange={(e) =>
              setNewStudent({ ...newStudent, rollNo: e.target.value })
            }
            required
          />
          <select
            value={newStudent.class}
            onChange={(e) =>
              setNewStudent({ ...newStudent, class: e.target.value })
            }
          >
            {settings.classOptions.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-success">
            ✓ Save
          </button>
          {formMessage && <p className="registration-message">{formMessage}</p>}
        </form>
      )}

      <div className="students-table-wrapper">
        <table className="students-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Roll No</th>
              <th>Class</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, index) => (
              <tr key={student.id}>
                <td>{index + 1}</td>
                <td className="student-name">{student.name}</td>
                <td>
                  <span className="badge">{student.rollNo}</span>
                </td>
                <td>
                  <span className="class-badge">{student.class}</span>
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteStudent(student.id)}
                    title="Delete Student"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-state">
                  No students found. Add some students!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default StudentList;
