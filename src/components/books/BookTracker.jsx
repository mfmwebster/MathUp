/*
 * File: src/components/books/BookTracker.jsx
 * Description: Kitap takibi bileşeni; kitap ekleme, ödünç alma ve durum yönetimi sağlar.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { 
  Plus, Book, Check, ChevronRight, Trash2,
  MoreHorizontal 
} from 'lucide-react';
import { generateId, formatShortDate } from '../../utils/helpers';
import { openDB } from 'idb';

const BookTracker = () => {
  const [books, setBooks] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBook, setNewBook] = useState({
    title: '',
    totalPages: '',
    grade: '8',
    coverColor: 'blue'
  });
  const { getBooks, addBook, updateStudent, getStudents } = useDatabase();

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    const data = await getBooks();
    setBooks(data);
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    
    const book = {
      id: generateId(),
      ...newBook,
      totalPages: parseInt(newBook.totalPages),
      createdAt: new Date().toISOString(),
      progress: {} // öğrenciId: sayfaNo şeklinde
    };
    
    await addBook(book);
    setShowAddModal(false);
    setNewBook({ title: '', totalPages: '', grade: '8', coverColor: 'blue' });
    loadBooks();
  };

  const updateProgress = async (bookId, studentId, page) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    
    const updatedBook = {
      ...book,
      progress: {
        ...book.progress,
        [studentId]: Math.min(page, book.totalPages)
      }
    };
    
    // Simdi updateBook fonksiyonu olmadigi icin dogrudan db'ye yaziyoruz
    // Gercek uygulamada ayri bir updateBook fonksiyonu olmali
    const db = await openDB('MathUpDB', 1);
    await db.put('books', updatedBook);
    loadBooks();
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {books.map((book) => (
            <div key={book.id} className="card">
              <div className="p-4 rounded-xl mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{book.title}</h3>
                    <p className="text-sm opacity-80">{book.grade}. Sınıf</p>
                  </div>
                  <Book className="w-8 h-8 opacity-50" />
                </div>
                <p className="mt-2 text-sm">{book.totalPages} sayfa</p>
              </div>

              {/* Ilerleme Ozeti */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Öğrenci İlerlemesi</h4>
                {/* Burada öğrenci listesi ve ilerleme çubukları olacak */}
                <p className="text-xs text-gray-500">
                  {Object.keys(book.progress || {}).length} öğrenci takip ediyor
                </p>
              </div>
            </div>
          ))}
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
    </div>
  );
};

export default BookTracker;
