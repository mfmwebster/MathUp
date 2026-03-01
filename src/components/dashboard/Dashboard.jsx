/*
 * File: src/components/dashboard/Dashboard.jsx
 * Description: Uygulama ana gösterge paneli; hızlı istatistikler ve özet bileşenlerini içerir.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, TrendingUp, 
  ChevronRight, Plus, Clock 
} from 'lucide-react';
import { 
  Chart as ChartJS, ArcElement, Tooltip, Legend 
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { 
  formatShortDate, getDayName, getInitials, 
  formatCurrency, getWeeksUntilLGS
} from '../../utils/helpers';

ChartJS.register(ArcElement, Tooltip, Legend);

const Dashboard = ({ teacher }) => {
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [nextLesson, setNextLesson] = useState(null);
  const [topStudent, setTopStudent] = useState(null);
  const [financeData, setFinanceData] = useState({ expected: 0, collected: 0 });
  const { getStudents, getExams, isReady } = useDatabase();
  const navigate = useNavigate();

  useEffect(() => {
    if (isReady) {
      loadData();
    }
  }, [isReady]);

  const loadData = async () => {
    const [studentsData, examsData] = await Promise.all([
      getStudents(),
      getExams()
    ]);
    
    setStudents(studentsData);
    setExams(examsData);
    findNextLesson(studentsData);
    findTopStudent(studentsData, examsData);
    calculateFinance(studentsData);
  };

  const findNextLesson = (students) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let closestLesson = null;
    let closestDiff = Infinity;
    
    students.forEach(student => {
      if (student.schedule) {
        student.schedule.forEach(lesson => {
          const lessonDate = new Date(lesson.date);
          lessonDate.setHours(0, 0, 0, 0);
          const diff = lessonDate - today;
          
          if (diff >= 0 && diff < closestDiff && !lesson.completed) {
            closestDiff = diff;
            closestLesson = {
              ...lesson,
              studentName: student.fullName,
              studentId: student.id
            };
          }
        });
      }
    });
    
    setNextLesson(closestLesson);
  };

  const findTopStudent = (students, exams) => {
    if (exams.length === 0 || students.length === 0) return;
    
    const studentNets = {};
    exams.forEach(exam => {
      if (!studentNets[exam.studentId]) {
        studentNets[exam.studentId] = { total: 0, count: 0 };
      }
      studentNets[exam.studentId].total += exam.net || 0;
      studentNets[exam.studentId].count += 1;
    });
    
    let bestStudent = null;
    let bestAvg = -1;
    
    Object.entries(studentNets).forEach(([studentId, data]) => {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        const student = students.find(s => s.id === studentId);
        if (student) {
          bestStudent = { ...student, averageNet: avg };
        }
      }
    });
    
    setTopStudent(bestStudent);
  };

  const calculateFinance = (students) => {
    const getLessonAmount = (student, lesson) => {
      const lessonAmount = parseFloat(lesson?.paymentAmount);
      if (!Number.isNaN(lessonAmount) && lessonAmount > 0) {
        return lessonAmount;
      }
      const unitFee = parseFloat(student?.initialFee);
      if (!Number.isNaN(unitFee) && unitFee > 0) {
        return unitFee;
      }
      const currentFee = parseFloat(student?.fee);
      if (!Number.isNaN(currentFee) && currentFee > 0) {
        return currentFee;
      }
      return 0;
    };

    const expected = students.reduce(
      (sum, student) =>
        sum + (student.schedule || []).reduce((lessonSum, lesson) => lessonSum + getLessonAmount(student, lesson), 0),
      0
    );
    const collected = students.reduce(
      (sum, student) =>
        sum + (student.schedule || [])
          .filter((lesson) => lesson.paymentStatus === 'collected')
          .reduce((lessonSum, lesson) => lessonSum + getLessonAmount(student, lesson), 0),
      0
    );
    setFinanceData({ expected, collected });
  };

  const getStudentFinance = (student) => {
    const lessons = student.schedule || [];
    const getLessonAmount = (lesson) => {
      const lessonAmount = parseFloat(lesson?.paymentAmount);
      if (!Number.isNaN(lessonAmount) && lessonAmount > 0) {
        return lessonAmount;
      }
      const unitFee = parseFloat(student?.initialFee);
      if (!Number.isNaN(unitFee) && unitFee > 0) {
        return unitFee;
      }
      const currentFee = parseFloat(student?.fee);
      if (!Number.isNaN(currentFee) && currentFee > 0) {
        return currentFee;
      }
      return 0;
    };

    const expected = lessons.reduce((sum, lesson) => sum + getLessonAmount(lesson), 0);
    const collected = lessons
      .filter((lesson) => lesson.paymentStatus === 'collected')
      .reduce((sum, lesson) => sum + getLessonAmount(lesson), 0);
    return { expected, collected };
  };

  const portfolioColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ef4444', '#06b6d4', '#f97316', '#14b8a6',
    '#6366f1', '#ec4899'
  ];

  const getStudentColor = (studentId) => {
    const source = String(studentId || '0');
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
    }
    return portfolioColors[hash % portfolioColors.length];
  };

  const studentPortfolio = students.map((student) => {
    const fin = getStudentFinance(student);
    return {
      id: student.id,
      name: student.fullName,
      initials: getInitials(student.fullName),
      collected: fin.collected,
      color: getStudentColor(student.id)
    };
  });

  const remaining = Math.max(financeData.expected - financeData.collected, 0);

  const chartSegments = [
    ...studentPortfolio
      .filter((item) => item.collected > 0)
      .map((item) => ({ label: item.name, value: item.collected, color: item.color, studentId: item.id })),
    ...(remaining > 0 ? [{ label: 'Tahsil Edilmemiş', value: remaining, color: '#e5e7eb' }] : [])
  ];

  const safeChartSegments = chartSegments.length > 0
    ? chartSegments
    : [{ label: 'Veri yok', value: 1, color: '#e5e7eb' }];

  const doughnutData = {
    labels: safeChartSegments.map((item) => item.label),
    datasets: [
      {
        data: safeChartSegments.map((item) => item.value),
        backgroundColor: safeChartSegments.map((item) => item.color),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const segment = safeChartSegments[context.dataIndex];
            if ((segment?.label || context.label) === 'Veri yok') {
              return 'Henüz finansal veri yok';
            }
            return `${segment?.label || context.label}: ${formatCurrency(context.raw)}`;
          }
        }
      }
    }
  };

  const collectionRate = financeData.expected > 0
    ? (financeData.collected / financeData.expected) * 100
    : 0;

  const handleDoughnutClick = (event, elements) => {
    if (!elements || elements.length === 0) return;
    const segment = safeChartSegments[elements[0].index];
    if (!segment?.studentId) return;

    event?.native?.stopPropagation?.();
    navigate(`/students/${segment.studentId}?tab=finance`);
  };

  const weeksUntilLGS = getWeeksUntilLGS();

  return (
    <div className="page-container pb-32">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Hoş Geldiniz, {teacher.fullName.split(' ')[0]}
        </h1>
        <p className="text-gray-600">
          LGS'ye {weeksUntilLGS} hafta kaldı
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div 
          onClick={() => navigate('/students')}
          className="card cursor-pointer hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-gray-600 text-sm mb-1">Kayıtlı Öğrenciler</h3>
          <p className="text-3xl font-bold text-gray-900">{students.length}</p>
          <p className="text-xs text-gray-500 mt-2">
            {students.filter(s => s.grade === '8').length} tane 8. sınıf
          </p>
        </div>

        <div 
          onClick={() => navigate('/finance')}
          className="card cursor-pointer hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs text-gray-500">Tahsilat</span>
          </div>
          <div className="h-32 relative">
            {students.length > 0 ? (
              <>
                <Doughnut data={doughnutData} options={doughnutOptions} onClick={handleDoughnutClick} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-[11px] text-gray-500">Tahsilat</p>
                    <p className="text-lg font-bold text-gray-900">{collectionRate.toFixed(0)}%</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Öğrenci ekleyin
              </div>
            )}
          </div>
          <div className="text-center text-xs text-gray-600 mt-2 space-y-0.5">
            <p>Hedef: {formatCurrency(financeData.expected)}</p>
            <p>Tahsil: {formatCurrency(financeData.collected)}</p>
          </div>
        </div>

        <div 
          onClick={() => nextLesson && navigate('/students/' + nextLesson.studentId)}
          className={'card ' + (nextLesson ? 'cursor-pointer hover:shadow-md' : '')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-gray-600 text-sm mb-1">Sıradaki Ders</h3>
          {nextLesson ? (
            <>
              <p className="text-lg font-bold text-gray-900 truncate">
                {nextLesson.studentName}
              </p>
              <p className="text-sm text-gray-600">
                {formatShortDate(nextLesson.date)} {getDayName(nextLesson.date)}
              </p>
              <p className="text-xs text-primary-600 mt-1 font-medium">
                {nextLesson.time} ({nextLesson.duration} dk)
              </p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Yaklaşan ders yok</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
              En Iyi
            </span>
          </div>
          <h3 className="text-gray-600 text-sm mb-1">En Başarılı Öğrenci</h3>
          {topStudent ? (
            <>
              <p className="text-lg font-bold text-gray-900 truncate">
                {topStudent.fullName}
              </p>
              <p className="text-sm text-gray-600">
                {topStudent.grade}. Sınıf - {topStudent.school}
              </p>
              <p className="text-xs text-green-600 mt-1 font-medium">
                Ortalama Net: {topStudent.averageNet.toFixed(2)}
              </p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Henüz deneme yok</p>
          )}
        </div>
      </div>

      <h2 className="section-title">Hızlı Eylemler</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button 
          onClick={() => navigate('/students/new')}
          className="btn-secondary py-4 flex flex-col items-center gap-2"
        >
          <Plus className="w-6 h-6" />
          <span className="text-sm">Yeni Öğrenci</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;