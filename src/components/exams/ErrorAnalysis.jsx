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
  Legend 
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const ErrorAnalysis = () => {
  const { studentId } = useParams();
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(studentId || 'all');
  const [errorTypes, setErrorTypes] = useState([
    'Dikkat Hatasi',
    'Kavram Yanilgisi',
    'Islem Hatasi',
    'Formul Hatasi',
    'Soru Okuma',
    'Zaman Yetersizligi'
  ]);
  const { getStudents, getExams } = useDatabase();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [s, e] = await Promise.all([getStudents(), getExams()]);
    setStudents(s);
    setExams(e);
  };

  const getChartData = () => {
    const data = errorTypes.map(() => Math.floor(Math.random() * 10) + 1);
    
    return {
      labels: errorTypes,
      datasets: [{
        label: 'Hata Sikligi',
        data: data,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
      }]
    };
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 10,
        ticks: {
          stepSize: 2
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };

  return (
    <div className="page-container pb-24">
      <h1 className="section-title">Hata Analizi</h1>
      
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

      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Hata Dagilimi</h2>
        <div className="h-80">
          <Radar data={getChartData()} options={options} />
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Hata Tipleri</h2>
        <div className="space-y-3">
          {errorTypes.map((type, index) => (
            <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">{type}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: (Math.random() * 100) + '%' }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-8 text-right">
                  {Math.floor(Math.random() * 10)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="w-full mt-4 btn-secondary py-3">
        + Yeni Hata Tipi Ekle
      </button>
    </div>
  );
};

export default ErrorAnalysis;