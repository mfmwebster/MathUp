/*
 * File: src/components/books/BookTracker.jsx
 * Description: Kitap takibi bileşeni; kitap ekleme, ödünç alma ve durum yönetimi sağlar.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { 
  Plus, Book, Check, ChevronRight, Trash2,
  MoreHorizontal, Users, BookMarked 
} from 'lucide-react';
import { generateId, formatShortDate, getInitials } from '../../utils/helpers';
import { openDB } from 'idb';

const BookTracker = () => {
  const [books, setBooks] = useState([]);
  const [students, setStudents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [newBook, setNewBook] = useState({
    title: '',
    totalPages: '',
    grade: '8',
    coverColor: 'blue'
  });
  const { getBooks, addBook, updateBook, getStudents } = useDatabase();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [booksData, studentsData] = await Promise.all([
      getBooks(),
      getStudents()
    ]);
    setBooks(booksData);
    setStudents(studentsData);
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    
    const book = {
      id: generateId(),
      ...newBook,
      totalPages: parseInt(newBook.totalPages),
      createdAt: new Date().toISOString(),
      progress: {} // öğrenciId: { currentPage: 0, completed: false }
    };
    
    await addBook(book);
    setShowAddModal(false);
    setNewBook({ title: '', totalPages: '', grade: '8', coverColor: 'blue' });
    loadData();
  };

  const updateProgress = async (bookId, studentId, page) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    
    const completed = page >= book.totalPages;
    
    const updatedBook = {
      ...book,
      progress: {
        ...book.progress,
        [studentId]: {
          currentPage: Math.min(page, book.totalPages),
          completed,
          lastUpdated: new Date().toISOString()
        }
      }
    };
    
    // updateBook kullan
    await updateBook(updatedBook);
    loadData();
  };

  const openProgressModal = (book) => {
    setSelectedBook(book);
    setShowProgressModal(true);
  };

  const getStudentProgress = (book, studentId) => {
    return book.progress?.[studentId] || { currentPage: 0, completed: false };
  };

  const colors = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200'
  };

  return (
    <div className="page-container pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kitap Takibi</h1>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Kitap Ekle
        </button>
      </div>

      {books.length === 0 ? (
        <div className="empty-state">
          <Book className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Henüz kitap eklenmemiş</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => {
            const studentsTracking = Object.keys(book.progress || {}).length;
            const completedCount = Object.values(book.progress || {}).filter(p => p.completed).length;
            
            return (
              <button
                key={book.id}
                type="button"
                className="text-left rounded-2xl overflow-hidden border border-gray-200 hover:shadow-lg transition-all bg-white"
                onClick={() => openProgressModal(book)}
              >
                <div className={`aspect-[3/4] p-4 flex flex-col justify-between ${colors[book.coverColor] || colors.blue}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base leading-tight break-words line-clamp-4">{book.title}</h3>
                      <p className="text-xs opacity-80 mt-1">{book.grade}. Sınıf</p>
                    </div>
                    <Book className="w-8 h-8 opacity-50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{book.totalPages} sayfa</p>
                    <p className="text-xs opacity-80 mt-1">{studentsTracking} öğrenci • {completedCount} tamamladı</p>
                  </div>
                </div>

                {studentsTracking > 0 && (
                  <div className="p-3 border-t border-gray-100">
                    <div className="flex -space-x-2">
                      {Object.keys(book.progress || {}).slice(0, 4).map((studentId) => {
                        const student = students.find(s => s.id === studentId);
                        if (!student) return null;
                        return (
                          <div key={studentId}
                               className="w-7 h-7 rounded-full bg-primary-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-primary-700"
                               title={student.fullName}>
                            {getInitials(student.fullName)}
                          </div>
                        );
                      })}
                      {studentsTracking > 4 && (
                        <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-medium text-gray-600">
                          +{studentsTracking - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Yeni Kitap</h2>
            <form onSubmit={handleAddBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kitap Adi
                </label>
                <input
                  type="text"
                  required
                  value={newBook.title}
                  onChange={(e) => setNewBook({...newBook, title: e.target.value})}
                  className="input-field"
                  placeholder="Orn: Karekok Yayinlari"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sayfa Sayisi
                  </label>
                  <input
                    type="number"
                    required
                    value={newBook.totalPages}
                    onChange={(e) => setNewBook({...newBook, totalPages: e.target.value})}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sınıf
                  </label>
                  <select
                    value={newBook.grade}
                    onChange={(e) => setNewBook({...newBook, grade: e.target.value})}
                    className="input-field"
                  >
                    <option value="5">5. Sınıf</option>
                    <option value="6">6. Sınıf</option>
                    <option value="7">7. Sınıf</option>
                    <option value="8">8. Sınıf</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kapak Rengi
                </label>
                <div className="flex gap-2">
                  {Object.keys(colors).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewBook({...newBook, coverColor: color})}
                      className="w-10 h-10 rounded-full"
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Iptal
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && selectedBook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedBook.title}</h2>
                <p className="text-sm text-gray-600">{selectedBook.totalPages} sayfa</p>
              </div>
              <button 
                onClick={() => setShowProgressModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {students
                .filter(s => s.grade === selectedBook.grade)
                .map((student) => {
                  const progress = getStudentProgress(selectedBook, student.id);
                  const percentage = (progress.currentPage / selectedBook.totalPages) * 100;
                  
                  return (
                    <div key={student.id} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700">
                            {getInitials(student.fullName)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{student.fullName}</p>
                            <p className="text-xs text-gray-500">
                              {progress.currentPage} / {selectedBook.totalPages} sayfa
                            </p>
                          </div>
                        </div>
                        {progress.completed && (
                          <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Tamamlandı
                          </div>
                        )}
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div 
                          className="bg-primary-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      
                      {/* Page Input */}
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          max={selectedBook.totalPages}
                          value={progress.currentPage}
                          onChange={(e) => updateProgress(
                            selectedBook.id, 
                            student.id, 
                            parseInt(e.target.value) || 0
                          )}
                          className="input-field py-2 text-sm flex-1"
                          placeholder="Sayfa no"
                        />
                        <button
                          onClick={() => updateProgress(selectedBook.id, student.id, selectedBook.totalPages)}
                          className="btn-primary py-2 px-4 text-sm"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              
              {students.filter(s => s.grade === selectedBook.grade).length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Bu sınıfta öğrenci yok</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowProgressModal(false)}
              className="w-full mt-4 btn-secondary py-3"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookTracker;
