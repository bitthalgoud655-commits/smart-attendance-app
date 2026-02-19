import { useApp } from '../context/AppContext';

/**
 * Custom hook for attendance-related computed data
 */
const useAttendance = () => {
  const { students, attendanceRecords } = useApp();

  const getOverallStats = () => {
    const totalDays = [...new Set(attendanceRecords.map((r) => r.date))].length;
    const totalRecords = attendanceRecords.length;
    const totalPresent = attendanceRecords.filter(
      (r) => r.status === 'present'
    ).length;
    const totalAbsent = attendanceRecords.filter(
      (r) => r.status === 'absent'
    ).length;
    const totalLate = attendanceRecords.filter(
      (r) => r.status === 'late'
    ).length;

    const overallPercentage =
      totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    return {
      totalDays,
      totalRecords,
      totalPresent,
      totalAbsent,
      totalLate,
      overallPercentage,
    };
  };

  const getStudentReport = (studentId) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return null;

    const records = attendanceRecords.filter((r) => r.studentId === studentId);
    const total = records.length;
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      ...student,
      records,
      total,
      present,
      absent,
      late,
      percentage,
    };
  };

  return {
    getOverallStats,
    getStudentReport,
  };
};

export default useAttendance;
