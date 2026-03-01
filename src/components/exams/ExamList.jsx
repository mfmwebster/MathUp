import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, Calendar, Filter } from 'lucide-react';
import { formatShortDate } from '../../utils/helpers';

const ExamList = () => {
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('all'); // all, student, subject
  const [sortBy, setSortBy] = useState('date'); // date, name, net, success
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
    
    setExams(examsData);
    setStudents(studentsData);
  };

  const getSortedExams = () => {
    const filtered = exams.filter(e => filter === 'all' || e.studentId === filter);
    
    const sorted = [...filtered].sort((a, b) => {
      switch(sortBy) {
        case 'date':
          return new Date(b.date) - new Date(a.date); // Yeni üstte
        case 'name':
          return (a.name || '').localeCompare(b.name || '', 'tr');
        case 'net':
          return parseFloat(b.net) - parseFloat(a.net); // Yüksek net üstte
        case 'success':
          const successA = (parseFloat(a.net) / 20) * 100;
          const successB = (parseFloat(b.net) / 20) * 100;
          return successB - successA; // Yüksek başarı üstte
        default:
          return 0;
      }
    });
    
    return sorted;
  };

  const getStudentName = (id) => {
    const student = students.find(s => s.id === id);
    return student ? student.fullName : 'Bilinmiyor';
  };

  const getSubjectLabel = (subject) => {
    const labels = {
      matematik: 'Matematik'
    };
    return labels[subject] || subject;
  };

  const getSubjectColor = (subject) => {
    const colors = {
      matematik: 'bg-blue-100 text-blue-800'
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

      {/* Filtreler ve Siralama */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ' + (filter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}
          >
            Tümü
          </button>
          {students.map(s => (
            <button
              key={s.id}
              onClick={() => setFilter(s.id)}
              className={'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ' + (filter === s.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}
            >
              {s.fullName.split(' ')[0]}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field text-sm py-2"
          >
            <option value="date">Tarihe göre (Yeni)</option>
            <option value="name">Adına göre</option>
            <option value="net">Net Sayısına göre</option>
            <option value="success">Başarısına göre</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {exams.length === 0 ? (
          <div className="empty-state">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Henüz deneme eklenmemiş</p>
          </div>
        ) : (
          getSortedExams().map((exam) => (
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
                    {exam.name && (
                      <p className="text-xs text-primary-600 font-medium">{exam.name}</p>
                    )}
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
