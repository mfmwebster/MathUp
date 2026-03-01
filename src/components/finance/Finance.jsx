/*
 * File: src/components/finance/Finance.jsx
 * Description: Gelir/gider kayıtları ve finansal özetleri gösteren sayfa bileşeni.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
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
  const { getStudents } = useDatabase();

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    const data = await getStudents();
    setStudents(data);
  };

  const totalExpected = students.reduce((sum, s) => sum + (parseFloat(s.fee) || 0), 0);
  const totalCollected = totalExpected * 0.7;
  const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  const chartData = {
    labels: students.map(s => getInitials(s.fullName)),
    datasets: [
      {
        data: students.map(s => parseFloat(s.fee) || 0),
        backgroundColor: [
          '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
          '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
          '#84cc16', '#f43f5e'
        ],
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 8
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const student = students[context.dataIndex];
            const amount = context.raw;
            if (showAmounts) {
              return student.fullName + ': ' + formatCurrency(amount);
            } else {
              return student.fullName + ': ***';
            }
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

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card bg-primary-50 border-primary-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <span className="text-sm text-primary-700">Beklenen</span>
          </div>
          <p className="text-2xl font-bold text-primary-900">
            {showAmounts ? formatCurrency(totalExpected) : '***'}
          </p>
        </div>
        
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-700">Tahsil Edilen</span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {showAmounts ? formatCurrency(totalCollected) : '***'}
          </p>
          <p className="text-xs text-green-600 mt-1">
            {collectionRate.toFixed(0)}% tamamlandi
          </p>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 text-center">
          Öğrenci Bazlı Gelir Dağılımı
        </h2>
        <div className="h-64 relative">
          {students.length > 0 ? (
            <>
              <Doughnut data={chartData} options={chartOptions} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">
                    {students.length}
                  </p>
                  <p className="text-xs text-gray-500">Öğrenci</p>
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

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Öğrenci Ödemeleri</h2>
        <div className="space-y-3">
          {students.map((student, index) => (
            <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                  {getInitials(student.fullName)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{student.fullName}</p>
                  <p className="text-xs text-gray-500">{student.grade}. Sınıf</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">
                  {showAmounts ? formatCurrency(student.fee) : '***'}
                </p>
                <p className="text-xs text-green-600">Duzenli</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Finance;