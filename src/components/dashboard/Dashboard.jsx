/*
 * File: src/components/dashboard/Dashboard.jsx
 * Description: Uygulama ana gösterge paneli; hızlı istatistikler ve özet bileşenlerini içerir.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useNavigate } from 'react-router-dom';
import { 
  Users, BookOpen, Calendar, TrendingUp, 
  ChevronRight, Plus, Clock 
} from 'lucide-react';
import { 
  Chart as ChartJS, ArcElement, Tooltip, Legend 
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { 
  formatShortDate, getDayName, getInitials, 
  formatCurrency, getWeeksUntilLGS, generatePastelColor 
} from '../../utils/helpers';

ChartJS.register(ArcElement, Tooltip, Legend);

const Dashboard = ({ teacher }) => {
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [nextLesson, setNextLesson] = useState(null);
  const [topStudent, setTopStudent] = useState(null);
  const [financeData, setFinanceData] = useState({ expected: 0, collected: 0 });
  const { getStudents, getExams } = useDatabase();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

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
    const expected = students.reduce((sum, s) => sum + (parseFloat(s.fee) || 0), 0);
    const collected = expected * 0.7;
    setFinanceData({ expected, collected });
  };

  const doughnutData = {
    labels: students.map(s => getInitials(s.fullName)),
    datasets: [
      {
        data: students.map(s => parseFloat(s.fee) || 0),
        backgroundColor: [
          '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
          '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
        ],
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
            const student = students[context.dataIndex];
            return student.fullName + ': ' + formatCurrency(context.raw);
          }
        }
      }
    }
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
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Öğrenci ekleyin
              </div>
            )}
          </div>
          <p className="text-center text-sm text-gray-600 mt-2">
            Hedef: {formatCurrency(financeData.expected)}
          </p>
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

      <h2 className="section-title">Hizli Eylemler</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button 
          onClick={() => navigate('/students/new')}
          className="btn-secondary py-4 flex flex-col items-center gap-2"
        >
          <Plus className="w-6 h-6" />
          <span className="text-sm">Yeni Öğrenci</span>
        </button>
        <button 
          onClick={() => navigate('/exams/new')}
          className="btn-secondary py-4 flex flex-col items-center gap-2"
        >
          <BookOpen className="w-6 h-6" />
          <span className="text-sm">Deneme Ekle</span>
        </button>
        <button 
          onClick={() => navigate('/curriculum')}
          className="btn-secondary py-4 flex flex-col items-center gap-2"
        >
          <Calendar className="w-6 h-6" />
          <span className="text-sm">Müfredat</span>
        </button>
        <button 
          onClick={() => navigate('/books')}
          className="btn-secondary py-4 flex flex-col items-center gap-2"
        >
          <BookOpen className="w-6 h-6" />
          <span className="text-sm">Kitaplar</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;