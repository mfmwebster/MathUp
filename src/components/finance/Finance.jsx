/*
 * File: src/components/finance/Finance.jsx
 * Description: Gelir/gider kayıtları ve finansal özetleri gösteren sayfa bileşeni.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Eye, EyeOff, TrendingUp, Users } from 'lucide-react';
import { formatCurrency, getInitials } from '../../utils/helpers';

ChartJS.register(ArcElement, Tooltip, Legend);

const Finance = () => {
  const [students, setStudents] = useState([]);
  const [showAmounts, setShowAmounts] = useState(true);
  const [loading, setLoading] = useState(true);
  const { getStudents, isReady } = useDatabase();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isReady) return;
    loadStudents();
  }, [isReady, location.pathname]);

  useEffect(() => {
    if (!isReady) return;

    const handleFocus = () => {
      loadStudents();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadStudents();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isReady]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await getStudents();
      setStudents(data || []);
    } finally {
      setLoading(false);
    }
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
    const expectedInKurus = lessons.reduce((sum, lesson) => sum + getLessonAmountInKurus(student, lesson), 0);
    const collectedLessons = lessons.filter((lesson) => lesson.paymentStatus === 'collected');
    const collectedInKurus = collectedLessons.reduce((sum, lesson) => sum + getLessonAmountInKurus(student, lesson), 0);
    const pendingCount = lessons.filter((lesson) => lesson.paymentStatus !== 'collected').length;

    return {
      expected: kurusToTry(expectedInKurus),
      collected: kurusToTry(collectedInKurus),
      expectedInKurus,
      collectedInKurus,
      pendingCount,
      collectedCount: collectedLessons.length,
      lessonCount: lessons.length
    };
  };

  const totalExpectedInKurus = students.reduce((sum, student) => sum + getStudentFinance(student).expectedInKurus, 0);
  const totalCollectedInKurus = students.reduce((sum, student) => sum + getStudentFinance(student).collectedInKurus, 0);
  const totalExpected = kurusToTry(totalExpectedInKurus);
  const totalCollected = kurusToTry(totalCollectedInKurus);
  const totalLessonCount = students.reduce((sum, student) => sum + getStudentFinance(student).lessonCount, 0);
  const totalCollectedLessonCount = students.reduce((sum, student) => sum + getStudentFinance(student).collectedCount, 0);
  const collectionRate = totalExpectedInKurus > 0 ? (totalCollectedInKurus / totalExpectedInKurus) * 100 : 0;
  const remainingInKurus = Math.max(0, totalExpectedInKurus - totalCollectedInKurus);
  const remaining = kurusToTry(remainingInKurus);

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
      grade: student.grade,
      expected: fin.expected,
      collected: fin.collected,
      pending: Math.max(fin.expected - fin.collected, 0),
      pendingCount: fin.pendingCount,
      lessonCount: fin.lessonCount,
      collectedCount: fin.collectedCount,
      color: getStudentColor(student.id)
    };
  }).sort((a, b) => b.collected - a.collected);

  const chartSegments = [
    ...studentPortfolio
      .filter((item) => item.collected > 0)
      .map((item) => ({
        label: item.name,
        value: item.collected,
        color: item.color
      })),
    ...(remaining > 0
      ? [{ label: 'Tahsil Edilmemiş', value: remaining, color: '#e5e7eb' }]
      : [])
  ];

  const safeChartSegments = chartSegments.length > 0
    ? chartSegments
    : [{ label: 'Veri yok', value: 1, color: '#e5e7eb' }];

  const portfolioLabels = safeChartSegments.map((item) => item.label);
  const portfolioValues = safeChartSegments.map((item) => item.value);

  const chartData = {
    labels: portfolioLabels,
    datasets: [
      {
        data: portfolioValues,
        backgroundColor: safeChartSegments.map((item) => item.color),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '76%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const segment = chartSegments[context.dataIndex];
            if (!showAmounts) {
              return `${segment?.label || context.label}: ***`;
            }
            if ((segment?.label || context.label) === 'Veri yok') {
              return 'Henüz finansal veri yok';
            }
            return `${segment?.label || context.label}: ${formatCurrency(context.raw)}`;
          }
        }
      }
    }
  };

  return (
    <div className="page-container pb-24">
      <h1 className="section-title flex items-center justify-between">
        <span>Finans</span>
        <button 
          onClick={() => setShowAmounts(!showAmounts)}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
        >
          {showAmounts ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card lg:col-span-7">
          <div className="h-[360px] relative">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                Finans verisi yükleniyor...
              </div>
            ) : studentPortfolio.length > 0 ? (
              <>
                <Doughnut data={chartData} options={chartOptions} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center px-4">
                    <p className="text-gray-500 text-base">Beklenen Toplam (TRY)</p>
                    <p className="text-4xl font-bold text-primary-700 mt-1">
                      {showAmounts ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalExpected) : '***'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">Planlanan toplam ders: {totalLessonCount}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Tahsil: {showAmounts ? formatCurrency(totalCollected) : '***'} • %{collectionRate.toFixed(1)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Öğrenci ekleyin
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <div className="card border-primary-200 bg-primary-50/40">
            <p className="text-primary-700 text-sm font-semibold">Beklenen (TRY)</p>
            <p className="text-3xl font-bold text-primary-900 mt-1">
              {showAmounts ? formatCurrency(totalExpected) : '***'}
            </p>
            <p className="text-xs text-primary-700/80 mt-1">Tüm planlı dersler ({totalLessonCount} ders) toplamı</p>
          </div>

          <div className="card border-green-200 bg-green-50/40">
            <p className="text-green-700 text-sm font-semibold">Tahsil Edilen (TRY)</p>
            <p className="text-3xl font-bold text-green-900 mt-1">
              {showAmounts ? formatCurrency(totalCollected) : '***'}
            </p>
            <p className="text-xs text-green-700/80 mt-1">Tahsil edildi işaretli {totalCollectedLessonCount} ders</p>
          </div>

          <div className="card border-amber-200 bg-amber-50/40">
            <p className="text-amber-700 text-sm font-semibold">Kalan (TRY)</p>
            <p className="text-3xl font-bold text-amber-900 mt-1">
              {showAmounts ? formatCurrency(remaining) : '***'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {studentPortfolio.length === 0 ? (
          <div className="card text-center text-gray-500">Henüz portföy verisi yok</div>
        ) : (
          studentPortfolio.map((item, index) => {
            const share = totalCollected > 0 ? (item.collected / totalCollected) * 100 : 0;
            const studentColor = item.color;

            return (
              <div
                key={item.id}
                className="card cursor-pointer hover:shadow-md transition-all"
                onClick={() => navigate(`/students/${item.id}?tab=finance`)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-lg" style={{ color: studentColor }}>{item.name}</p>
                    <p className="text-xs text-gray-500">{item.grade}. Sınıf • {item.lessonCount} ders planı • {item.collectedCount} tahsil</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">
                      {showAmounts ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.collected) : '***'}
                    </p>
                    <p className="text-xs text-gray-500">TRY karşılığı</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <p className="text-gray-600">Portföy Payı</p>
                  <p className="font-semibold text-gray-900">%{share.toFixed(1)}</p>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${Math.min(share, 100)}%`, backgroundColor: studentColor }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Bekleyen: {showAmounts ? formatCurrency(item.pending) : '***'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Finance;