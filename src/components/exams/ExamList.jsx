import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, Calendar, Filter } from 'lucide-react';
import { formatShortDate } from '../../utils/helpers';

const ExamList = () => {
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('all'); // all, student, subject
  const { getExams, getStudents } = useDatabase();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [examsData, studentsData] = await Promise.all([
      getExams(),
      getStudents()
    ]);
    
    // Tarihe gore sirala (yeni ustte)
    setExams(examsData.sort((a, b) => new Date(b.date) - new Date(a.date)));
    setStudents(studentsData);
  };

  const getStudentName = (id) => {
    const student = students.find(s => s.id === id);
    return student ? student.fullName : 'Bilinmiyor';
  };

  const getSubjectLabel = (subject) => {
    const labels = {
      turkce: 'Türkçe',
      matematik: 'Matematik',
      fen: 'Fen',
      sosyal: 'Sosyal',
      ingilizce: 'İngilizce',
      din: 'Din',
      inkilap: 'İnkılap'
    };
    return labels[subject] || subject;
  };

  const getSubjectColor = (subject) => {
    const colors = {
      matematik: 'bg-blue-100 text-blue-800',
      turkce: 'bg-red-100 text-red-800',
      fen: 'bg-green-100 text-green-800',
      sosyal: 'bg-amber-100 text-amber-800',
      ingilizce: 'bg-purple-100 text-purple-800',
      din: 'bg-teal-100 text-teal-800',
      inkilap: 'bg-orange-100 text-orange-800'
    };
    return colors[subject] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="page-container pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Deneme Sonuçları</h1>
        <button 
          onClick={() => navigate('/exams/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Yeni Deneme
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setFilter('all')}
          className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
        >
          Tümü
        </button>
        {students.map(s => (
          <button
            key={s.id}
            onClick={() => setFilter(s.id)}
            className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
          >
            {s.fullName.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {exams.length === 0 ? (
          <div className="empty-state">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Henüz deneme eklenmemiş</p>
          </div>
        ) : (
          exams
            .filter(e => filter === 'all' || e.studentId === filter)
            .map((exam) => (
              <div 
                key={exam.id} 
                onClick={() => navigate(`/students/${exam.studentId}`)}
                className="card cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`${getSubjectColor(exam.subject)} px-3 py-1 rounded-full text-xs font-medium`}>
                      {getSubjectLabel(exam.subject)}
                    </div>
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatShortDate(exam.date)}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-primary-700">
                    {exam.net}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {getStudentName(exam.studentId)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {exam.correct}D / {exam.wrong}Y / {exam.empty}B
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      Başarı: %{((exam.net / 20) * 100).toFixed(0)}
                    </div>
                    <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${(exam.net / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default ExamList;
