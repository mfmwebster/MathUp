/*
 * File: src/components/dashboard/Dashboard.jsx
 * Description: Uygulama ana gösterge paneli; hızlı istatistikler ve özet bileşenlerini içerir.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, TrendingUp, 
  ChevronRight, Plus, Clock, TrendingDown, Wallet
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

const TurkishLiraIcon = ({ className = '' }) => (
  <span className={'font-bold leading-none ' + className}>₺</span>
);

const Dashboard = ({ teacher }) => {
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [nextLesson, setNextLesson] = useState(null);
  const [insightIndex, setInsightIndex] = useState(0);
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
    calculateFinance(studentsData);
    setInsightIndex(0);
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

  const calculateFinance = (students) => {
    const expectedInKurus = students.reduce(
      (sum, student) =>
        sum + (student.schedule || []).reduce((lessonSum, lesson) => lessonSum + getLessonAmountInKurus(student, lesson), 0),
      0
    );
    const collectedInKurus = students.reduce(
      (sum, student) =>
        sum + (student.schedule || [])
          .filter((lesson) => lesson.paymentStatus === 'collected')
          .reduce((lessonSum, lesson) => lessonSum + getLessonAmountInKurus(student, lesson), 0),
      0
    );
    setFinanceData({ expected: kurusToTry(expectedInKurus), collected: kurusToTry(collectedInKurus) });
  };

  const parseMoneyToKurus = (value) => {
    if (value === null || value === undefined) return 0;

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 0;
      return Math.round(value * 100);
    }

    const raw = String(value).trim();
    if (!raw) return 0;

    const normalized = raw
      .replace(/\s/g, '')
      .replace(/₺/g, '')
      .replace(/\./g, '')
      .replace(',', '.');

    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100);
  };

  const kurusToTry = (amountInKurus) => amountInKurus / 100;

  const getLessonAmountInKurus = (student, lesson) => {
    const lessonAmountInKurus = parseMoneyToKurus(lesson?.paymentAmount);
    if (lessonAmountInKurus > 0) {
      return lessonAmountInKurus;
    }

    const unitFeeInKurus = parseMoneyToKurus(student?.initialFee);
    if (unitFeeInKurus > 0) {
      return unitFeeInKurus;
    }

    const currentFeeInKurus = parseMoneyToKurus(student?.fee);
    if (currentFeeInKurus > 0) {
      return currentFeeInKurus;
    }

    return 0;
  };

  const getStudentFinance = (student) => {
    const lessons = student.schedule || [];

    const expected = lessons.reduce((sum, lesson) => sum + getLessonAmountInKurus(student, lesson), 0);
    const collected = lessons
      .filter((lesson) => lesson.paymentStatus === 'collected')
      .reduce((sum, lesson) => sum + getLessonAmountInKurus(student, lesson), 0);
    return { expected: kurusToTry(expected), collected: kurusToTry(collected) };
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

  const studentNetRows = Object.values(
    exams.reduce((acc, exam) => {
      if (!exam?.studentId) return acc;
      if (!acc[exam.studentId]) {
        acc[exam.studentId] = { studentId: exam.studentId, totalNet: 0, examCount: 0 };
      }
      acc[exam.studentId].totalNet += exam.net || 0;
      acc[exam.studentId].examCount += 1;
      return acc;
    }, {})
  ).map((row) => {
    const student = students.find((item) => item.id === row.studentId);
    return {
      ...row,
      student,
      averageNet: row.examCount > 0 ? row.totalNet / row.examCount : 0
    };
  }).filter((row) => !!row.student);

  const highestNetStudent = studentNetRows.length > 0
    ? [...studentNetRows].sort((a, b) => b.averageNet - a.averageNet)[0]
    : null;

  const lowestNetStudent = studentNetRows.length > 0
    ? [...studentNetRows].sort((a, b) => a.averageNet - b.averageNet)[0]
    : null;

  const studentFinanceRows = students.map((student) => {
    const fin = getStudentFinance(student);
    return {
      student,
      expected: fin.expected,
      collected: fin.collected
    };
  });

  const highestCollectedStudent = studentFinanceRows.length > 0
    ? [...studentFinanceRows].sort((a, b) => b.collected - a.collected)[0]
    : null;

  const highestExpectedStudent = studentFinanceRows.length > 0
    ? [...studentFinanceRows].sort((a, b) => b.expected - a.expected)[0]
    : null;

  const rotatingInsights = [
    highestNetStudent && {
      key: 'highest-net',
      title: 'En Yüksek Net Ortalaması',
      student: highestNetStudent.student,
      value: `Ortalama Net: ${highestNetStudent.averageNet.toFixed(2)}`,
      tone: 'text-green-600',
      icon: TrendingUp,
      iconWrapClass: 'bg-green-100',
      iconClass: 'text-green-600'
    },
    lowestNetStudent && {
      key: 'lowest-net',
      title: 'En Düşük Net Ortalaması',
      student: lowestNetStudent.student,
      value: `Ortalama Net: ${lowestNetStudent.averageNet.toFixed(2)}`,
      tone: 'text-amber-600',
      icon: TrendingDown,
      iconWrapClass: 'bg-amber-100',
      iconClass: 'text-amber-600'
    },
    highestCollectedStudent && {
      key: 'highest-collected',
      title: 'En Fazla Gelir Getiren',
      student: highestCollectedStudent.student,
      value: `Tahsilat: ${formatCurrency(highestCollectedStudent.collected)}`,
      tone: 'text-emerald-600',
      icon: TurkishLiraIcon,
      iconWrapClass: 'bg-emerald-100',
      iconClass: 'text-emerald-600'
    },
    highestExpectedStudent && {
      key: 'highest-expected',
      title: 'En Yüksek Beklenen Getiri',
      student: highestExpectedStudent.student,
      value: `Beklenen: ${formatCurrency(highestExpectedStudent.expected)}`,
      tone: 'text-blue-600',
      icon: Wallet,
      iconWrapClass: 'bg-blue-100',
      iconClass: 'text-blue-600'
    }
  ].filter(Boolean);

  const activeInsight = rotatingInsights.length > 0
    ? rotatingInsights[insightIndex % rotatingInsights.length]
    : null;

  const rotateInsight = () => {
    if (rotatingInsights.length <= 1) return;
    setInsightIndex((prev) => (prev + 1) % rotatingInsights.length);
  };

  const ActiveInsightIcon = activeInsight?.icon || TrendingUp;

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

        <div
          onClick={rotateInsight}
          className={'card ' + (rotatingInsights.length > 1 ? 'cursor-pointer hover:shadow-md transition-all' : '')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={'p-3 rounded-xl ' + (activeInsight?.iconWrapClass || 'bg-purple-100')}>
              <ActiveInsightIcon className={'w-6 h-6 ' + (activeInsight?.iconClass || 'text-purple-600')} />
            </div>
            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
              {rotatingInsights.length > 0 ? `${(insightIndex % rotatingInsights.length) + 1}/${rotatingInsights.length}` : 'Bilgi'}
            </span>
          </div>
          <h3 className="text-gray-600 text-sm mb-1">Öne Çıkan Öğrenci Bilgisi</h3>
          {activeInsight ? (
            <>
              <p className="text-lg font-bold text-gray-900 truncate">
                {activeInsight.student.fullName}
              </p>
              <p className="text-sm text-gray-600">
                {activeInsight.title}
              </p>
              <p className={'text-xs mt-1 font-medium ' + activeInsight.tone}>
                {activeInsight.value}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">Kartı tıklayarak sonraki metriğe geç</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Henüz karşılaştırma için yeterli veri yok</p>
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