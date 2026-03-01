import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, CheckCircle, Circle, 
  BookOpen, TrendingUp, Edit, Trash2 
} from 'lucide-react';
import { formatShortDate, getDayName } from '../../utils/helpers';

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getStudentById, updateStudent, deleteStudent, isReady } = useDatabase();
  const [student, setStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');

  useEffect(() => {
    if (isReady) {
      loadStudent();
    }
  }, [id, isReady]);

  const loadStudent = async () => {
    const data = await getStudentById(id);
    if (data) {
      setStudent(data);
    } else {
      navigate('/students');
    }
  };

  const toggleLessonComplete = async (weekIndex) => {
    try {
      const updatedSchedule = [...student.schedule];
      updatedSchedule[weekIndex].completed = !updatedSchedule[weekIndex].completed;
      
      const updatedStudent = {
        ...student,
        schedule: updatedSchedule,
        updatedAt: new Date().toISOString()
      };
      
      await updateStudent(updatedStudent);
      setStudent(updatedStudent);
    } catch (error) {
      console.error('Ders güncellenirken hata:', error);
      alert('Ders durumu güncellenemedi.');
    }
  };

  const handleDelete = async () => {
    if (confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) {
      try {
        await deleteStudent(id);
        navigate('/students');
      } catch (error) {
        console.error('Öğrenci silinirken hata:', error);
        alert('Öğrenci silinirken hata oluştu.');
      }
    }
  };

  if (!student) return <div className="p-8">Yukleniyor...</div>;

  const completedLessons = student.schedule?.filter(l => l.completed).length || 0;
  const totalLessons = student.schedule?.length || 0;
  const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/students')}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{student.fullName}</h1>
            <p className="text-gray-600">{student.grade}. Sınıf • {student.school}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate(`/students/${id}/edit`)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-full"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Profil Karti */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-700 overflow-hidden">
            {student.photo ? (
              <img src={student.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              student.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500">Ilerleme:</span>
              <span className="text-sm font-semibold text-primary-600">
                {completedLessons}/{totalLessons} Ders
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        
        {student.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            {student.notes}
          </div>
        )}
      </div>

      {/* Tablar */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('schedule')}
          className="px-4 py-2 font-medium text-sm border-b-2 transition-colors"
        >
          Ders Planı
        </button>
        <button
          onClick={() => setActiveTab('exams')}
          className="px-4 py-2 font-medium text-sm border-b-2 transition-colors"
        >
          Denemeler
        </button>
      </div>

      {/* Ders Planı Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-2">
          {student.schedule?.map((lesson, index) => (
            <div 
              key={index}
              className="card flex items-center gap-3"
            >
              <button
                onClick={() => toggleLessonComplete(index)}
                className="flex-shrink-0"
              >
                {lesson.completed ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <Circle className="w-6 h-6" />
                )}
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    Hafta {lesson.week}
                  </span>
                  {lesson.completed && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Tamamlandi
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  {formatShortDate(lesson.date)} {getDayName(lesson.date)}
                  <span className="text-gray-400">•</span>
                  {lesson.time}
                </div>
              </div>

              {lesson.topic && (
                <div className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded">
                  {lesson.topic}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Denemeler Tab */}
      {activeTab === 'exams' && (
        <div className="text-center py-12 text-gray-400">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Deneme sonuclari burada gorunecek</p>
          <button 
            onClick={() => navigate('/exams/new')}
            className="mt-4 text-primary-600 font-medium"
          >
            Deneme ekle
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentDetail;
