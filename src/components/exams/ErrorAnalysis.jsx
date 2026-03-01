/*
 * File: src/components/exams/ErrorAnalysis.jsx
 * Description: Hata analizleri ve performans raporlarını gösteren bileşen.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useParams } from 'react-router-dom';
import { 
  Chart as ChartJS, 
  RadialLinearScale, 
  PointElement, 
  LineElement, 
  Filler, 
  Tooltip, 
  Legend,
  CategoryScale,
  LinearScale
} from 'chart.js';
import { Radar, Bar } from 'react-chartjs-2';
import { TrendingDown, BarChart3 } from 'lucide-react';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale
);

const ErrorAnalysis = ({ forcedStudentId = null, embedded = false }) => {
  const { studentId } = useParams();
  const effectiveStudentId = forcedStudentId || studentId;
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(effectiveStudentId || 'all');
  const [viewMode, setViewMode] = useState('overview');
  const { getStudents, getExams, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadData();
    }
  }, [isReady]);

  useEffect(() => {
    if (effectiveStudentId && students.length > 0) {
      setSelectedStudent(effectiveStudentId);
    }
  }, [effectiveStudentId, students]);

  const loadData = async () => {
    const [s, e] = await Promise.all([getStudents(), getExams()]);
    setStudents(s || []);
    setExams(e || []);
  };

  const getChartData = () => {
    // Seçili öğrenciye göre hata türlerini topla
    const filteredExams = selectedStudent === 'all' 
      ? exams 
      : exams.filter(e => e.studentId === selectedStudent);

    // Tüm hata türlerini topla - TOPLAM DEĞERLER
    const errorMap = {};
    filteredExams.forEach(exam => {
      if (exam.errors && Array.isArray(exam.errors)) {
        exam.errors.forEach(error => {
          if (errorMap[error.type]) {
            errorMap[error.type] += error.count;
          } else {
            errorMap[error.type] = error.count;
          }
        });
      }
    });

    const labels = Object.keys(errorMap);
    const data = Object.values(errorMap);

    // Renkler paleti
    const colors = [
      { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 1)', point: 'rgba(239, 68, 68, 1)' }, // Kırmızı
      { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 1)', point: 'rgba(59, 130, 246, 1)' }, // Mavi
      { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 1)', point: 'rgba(34, 197, 94, 1)' }, // Yeşil
      { bg: 'rgba(249, 115, 22, 0.2)', border: 'rgba(249, 115, 22, 1)', point: 'rgba(249, 115, 22, 1)' }, // Turuncu
      { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgba(168, 85, 247, 1)', point: 'rgba(168, 85, 247, 1)' }, // Mor
      { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgba(236, 72, 153, 1)', point: 'rgba(236, 72, 153, 1)' }, // Pembe
      { bg: 'rgba(14, 165, 233, 0.2)', border: 'rgba(14, 165, 233, 1)', point: 'rgba(14, 165, 233, 1)' }, // Açık Mavi
      { bg: 'rgba(251, 146, 60, 0.2)', border: 'rgba(251, 146, 60, 1)', point: 'rgba(251, 146, 60, 1)' }, // Açık Turuncu
    ];

    // Eğer veri yoksa boş döndür
    if (labels.length === 0) {
      return {
        labels: ['Henüz veri yok'],
        datasets: [{
          label: 'Hata Sıklığı',
          data: [0],
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        }]
      };
    }
    
    // Her hata türü için ayrı renk
    const color = colors[0]; // Tüm dataları kırmızı tonda göster
    
    return {
      labels,
      datasets: [{
        label: 'Toplam Hata Sayısı',
        data,
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 2,
        pointBackgroundColor: color.point,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: color.border,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    };
  };

  const getErrorStats = () => {
    const filteredExams = selectedStudent === 'all' 
      ? exams 
      : exams.filter(e => e.studentId === selectedStudent);

    const errorMap = {};
    filteredExams.forEach(exam => {
      if (exam.errors && Array.isArray(exam.errors)) {
        exam.errors.forEach(error => {
          if (errorMap[error.type]) {
            errorMap[error.type] += error.count;
          } else {
            errorMap[error.type] = error.count;
          }
        });
      }
    });

    return Object.entries(errorMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return context.label + ': ' + context.raw + ' hata';
          }
        }
      }
    }
  };

  const getKeyMetrics = () => {
    const filteredExams = selectedStudent === 'all' 
      ? exams 
      : exams.filter(e => e.studentId === selectedStudent);

    // Hata türlerini hesapla
    const errorMap = {};
    filteredExams.forEach(exam => {
      if (exam.errors && Array.isArray(exam.errors)) {
        exam.errors.forEach(error => {
          errorMap[error.type] = (errorMap[error.type] || 0) + error.count;
        });
      }
    });
    
    const totalErrors = Object.values(errorMap).reduce((sum, e) => sum + e, 0);
    const totalExams = filteredExams.length;
    const avgNet = totalExams > 0 
      ? (filteredExams.reduce((sum, e) => sum + (e.net || 0), 0) / totalExams).toFixed(1)
      : 0;
    const avgErrorsPerExam = totalExams > 0 
      ? (totalErrors / totalExams).toFixed(1)
      : 0;

    return { totalExams, avgNet, avgErrors: avgErrorsPerExam };
  };

  const getSubjectErrors = () => {
    const filteredExams = selectedStudent === 'all' 
      ? exams 
      : exams.filter(e => e.studentId === selectedStudent);

    const subjectMap = {};
    filteredExams.forEach(exam => {
      if (!subjectMap[exam.subject]) {
        subjectMap[exam.subject] = { total: 0, count: 0 };
      }
      subjectMap[exam.subject].count++;
      if (exam.errors && Array.isArray(exam.errors)) {
        exam.errors.forEach(error => {
          subjectMap[exam.subject].total += error.count;
        });
      }
    });

    return Object.entries(subjectMap).map(([subject, data]) => ({
      subject: subject.charAt(0).toUpperCase() + subject.slice(1),
      totalErrors: data.total,
      examCount: data.count,
      avgErrors: (data.total / data.count).toFixed(1)
    }));
  };

  const getTrendData = () => {
    const filteredExams = selectedStudent === 'all' 
      ? exams 
      : exams.filter(e => e.studentId === selectedStudent);

    const sortedExams = [...filteredExams].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = sortedExams.map((e, i) => `Deneme ${i + 1}`);
    const errorCounts = sortedExams.map(e => {
      if (e.errors && Array.isArray(e.errors)) {
        return e.errors.reduce((sum, err) => sum + err.count, 0);
      }
      return 0;
    });
    const netScores = sortedExams.map(e => e.net || 0);

    return { labels, errorCounts, netScores };
  };

  const getFocusRecommendation = () => {
    if (errorStats.length === 0) {
      return 'Öneri oluşturmak için daha fazla hata verisi gerekli.';
    }

    const topError = errorStats[0];
    const ratio = totalErrors > 0 ? (topError.count / totalErrors) * 100 : 0;
    return `Bu hafta odak: ${topError.type} (%${ratio.toFixed(0)}). Çalışmalarda bu hata türüne yönelik kısa tekrar önerilir.`;
  };

  const getRecentExamComment = () => {
    const filteredExams = selectedStudent === 'all'
      ? exams
      : exams.filter((exam) => exam.studentId === selectedStudent);

    const recent = [...filteredExams]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);

    if (recent.length === 0) {
      return 'Son 3 deneme verisi bulunmuyor.';
    }

    const avgRecentNet = recent.reduce((sum, exam) => sum + (exam.net || 0), 0) / recent.length;
    const recentErrors = recent.reduce((sum, exam) => {
      if (!exam.errors || !Array.isArray(exam.errors)) return sum;
      return sum + exam.errors.reduce((inner, err) => inner + err.count, 0);
    }, 0);

    return `Son ${recent.length} denemede ortalama net ${avgRecentNet.toFixed(1)}, toplam hata ${recentErrors}.`;
  };

  const errorStats = getErrorStats();
  const totalErrors = errorStats.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="page-container pb-24">
      {!embedded && <h1 className="section-title">Hata Analizi</h1>}
      
      {/* Öğrenci Seçim */}
      {!forcedStudentId && (
        <div className="card mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Öğrenci Seçin
          </label>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="input-field"
          >
            <option value="all">Tüm Öğrenciler</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        </div>
      )}

      {totalErrors > 0 ? (
        <>
          {/* Ana İstatistikler */}
          {(() => {
            const metrics = getKeyMetrics();
            return (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="card">
                  <p className="text-xs text-gray-600 mb-1">Toplam Denemeler</p>
                  <p className="text-2xl font-bold text-primary-600">{metrics.totalExams}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-600 mb-1">Ort. Net Skor</p>
                  <p className="text-2xl font-bold text-green-600">{metrics.avgNet}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-600 mb-1">Denemede Ort. Hata</p>
                  <p className="text-2xl font-bold text-red-600">{metrics.avgErrors}</p>
                </div>
              </div>
            );
          })()}

          {/* Sekme Kontrolleri */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                viewMode === 'overview' 
                  ? 'border-primary-600 text-primary-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Genel Bakış
            </button>
            <button
              onClick={() => setViewMode('bySubject')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                viewMode === 'bySubject' 
                  ? 'border-primary-600 text-primary-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dersler
            </button>
            <button
              onClick={() => setViewMode('trend')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                viewMode === 'trend' 
                  ? 'border-primary-600 text-primary-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Trend
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="card bg-primary-50 border-primary-200">
              <p className="text-xs text-primary-700 font-medium mb-1">Odak Önerisi</p>
              <p className="text-sm text-primary-900">{getFocusRecommendation()}</p>
            </div>
            <div className="card bg-green-50 border-green-200">
              <p className="text-xs text-green-700 font-medium mb-1">Son 3 Deneme Özeti</p>
              <p className="text-sm text-green-900">{getRecentExamComment()}</p>
            </div>
          </div>

          {/* Genel Bakış */}
          {viewMode === 'overview' && (
            <>
              <div className="card mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Hata Dağılımı (Spider Chart)</h2>
                  <span className="text-sm text-gray-600">
                    Toplam {totalErrors} hata
                  </span>
                </div>
                <div className="h-80">
                  <Radar data={getChartData()} options={options} />
                </div>
              </div>

              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">Hata Tipleri (Sıralanmış)</h2>
                <div className="space-y-3">
                  {errorStats.map((error, index) => {
                    const percentage = (error.count / totalErrors) * 100;
                    return (
                      <div key={error.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <span className="font-medium text-gray-700">{error.type}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-red-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-gray-900 w-8 inline-block">
                              {error.count}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">
                              ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Dersler Bazında */}
          {viewMode === 'bySubject' && (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary-600" />
                Derslere Göre Hata Analizi
              </h2>
              <div className="space-y-4">
                {getSubjectErrors().map((subject) => (
                  <div key={subject.subject} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900">{subject.subject}</h3>
                      <span className="text-sm text-gray-600">
                        {subject.examCount} deneme
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Toplam Hata</p>
                        <p className="text-lg font-bold text-red-600">{subject.totalErrors}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Denemede Ort.</p>
                        <p className="text-lg font-bold text-orange-600">{subject.avgErrors}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Oran</p>
                        <p className="text-lg font-bold text-primary-600">
                          {((subject.totalErrors / totalErrors) * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend */}
          {viewMode === 'trend' && (
            (() => {
              const trend = getTrendData();
              const trendOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true
                  }
                },
                plugins: {
                  legend: {
                    position: 'top'
                  }
                }
              };

              const trendChartData = {
                labels: trend.labels,
                datasets: [
                  {
                    label: 'Hata Sayısı',
                    data: trend.errorCounts,
                    borderColor: 'rgba(239, 68, 68, 1)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y'
                  },
                  {
                    label: 'Net Skor',
                    data: trend.netScores,
                    borderColor: 'rgba(34, 197, 94, 1)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y1'
                  }
                ]
              };

              return (
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-primary-600" />
                    Hata ve Net Skorunun Gelişimi
                  </h2>
                  <div className="h-80">
                    <Bar data={trendChartData} options={trendOptions} />
                  </div>
                </div>
              );
            })()
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-3xl">📊</span>
          </div>
          <p className="text-gray-600 mb-2">Henüz hata analizi verisi yok</p>
          <p className="text-sm text-gray-500">
            Deneme eklerken hata türlerini belirtmeye başlayın
          </p>
        </div>
      )}
    </div>
  );
};

export default ErrorAnalysis;