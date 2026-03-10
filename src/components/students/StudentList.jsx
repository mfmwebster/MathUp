/*
 * File: src/components/students/StudentList.jsx
 * Description: Öğrenci listesini gösterir; arama, filtreleme, silme ve gezinme işlemlerini yönetir.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, ChevronRight, User, GraduationCap,
  MoreVertical, Trash2, Edit 
} from 'lucide-react';
import { formatShortDate, generatePastelColor, getInitials } from '../../utils/helpers';
import { useFeedback } from '../../context/FeedbackContext';

const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const { getStudents, deleteStudent, isReady } = useDatabase();
  const { notify, confirmAction } = useFeedback();
  const navigate = useNavigate();

  useEffect(() => {
    if (isReady) {
      loadStudents();
    }
  }, [isReady]);

  const loadStudents = async () => {
    try {
      const data = await getStudents();
      // Kayit tarihine gore sirala (yeni ustte)
      setStudents(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error('Öğrenciler yüklenemedi:', error);
      notify('Veri yüklenirken hata oluştu. Lütfen sayfayı yenileyin.', 'error');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const shouldDelete = await confirmAction({
      title: 'Öğrenciyi Sil',
      message: 'Bu öğrenciyi silmek istediğinize emin misiniz?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      danger: true
    });

    if (shouldDelete) {
      try {
        await deleteStudent(id);
        loadStudents();
      } catch (error) {
        console.error('Öğrenci silinirken hata:', error);
        notify('Öğrenci silinirken hata oluştu.', 'error');
      }
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.school.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = filterGrade === 'all' || student.grade === filterGrade;
    return matchesSearch && matchesGrade;
  });

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Öğrencilerim</h1>
        <button 
          onClick={() => navigate('/students/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Yeni Öğrenci</span>
        </button>
      </div>

      {/* Arama ve Filtre */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Öğrenci ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {['all', '5', '6', '7', '8'].map((grade) => (
            <button
              key={grade}
              onClick={() => setFilterGrade(grade)}
              className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
            >
              {grade === 'all' ? 'Tümü' : `${grade}. Sınıf`}
            </button>
          ))}
        </div>
      </div>

      {/* Öğrenci Listesi */}
      <div className="space-y-3">
        {filteredStudents.length === 0 ? (
          <div className="empty-state">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Henüz öğrenci eklenmemiş</p>
            <button 
              onClick={() => navigate('/students/new')}
              className="mt-4 text-primary-600 font-medium"
            >
              İlk öğrenciyi ekle
            </button>
          </div>
        ) : (
          filteredStudents.map((student, index) => (
            <div
              key={student.id}
              onClick={() => navigate(`/students/${student.id}`)}
              className="card cursor-pointer hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                {/* Avatar veya Bas Harfler */}
                <div className={`${generatePastelColor(index)} w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold`}>
                  {student.photo ? (
                    <img 
                      src={student.photo} 
                      alt={student.fullName}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    getInitials(student.fullName)
                  )}
                </div>

                {/* Bilgiler */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {student.fullName}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <GraduationCap className="w-4 h-4" />
                    <span>{student.grade}. Sınıf</span>
                    <span>•</span>
                    <span className="truncate">{student.school}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>Kayıt: {formatShortDate(student.createdAt)}</span>
                    {student.schedule && (
                      <span className="text-primary-600">
                        {student.schedule.filter(l => l.completed).length}/{student.schedule.length} Ders
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/students/${student.id}/edit`);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(student.id, e)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudentList;
