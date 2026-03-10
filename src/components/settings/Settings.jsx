/*
 * File: src/components/settings/Settings.jsx
 * Description: Uygulama ayarları ve veri yedekleme sayfası.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase, DB_NAME, DB_VERSION } from '../../hooks/useDatabase';
import { 
  ArrowLeft, Download, Upload, Trash2, 
  Database, Shield, Info, AlertCircle 
} from 'lucide-react';
import { openDB } from 'idb';
import { useFeedback } from '../../context/FeedbackContext';

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const { getStudents, getBooks, getExams, getTeacher } = useDatabase();
  const { confirmAction } = useFeedback();

  const exportData = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      // Tüm verileri topla
      const [students, books, exams, teacher] = await Promise.all([
        getStudents(),
        getBooks(),
        getExams(),
        getTeacher()
      ]);

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        teacher,
        students,
        books,
        exams
      };

      // JSON dosyası oluştur ve indir
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `mathup-yedek-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({ 
        type: 'success', 
        text: `Yedekleme başarılı! ${students.length} öğrenci, ${exams.length} deneme kaydedildi.` 
      });
    } catch (error) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: 'Yedekleme sırasında hata oluştu: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const importData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);

      // Veri yapısı kontrolü
      if (!importedData.version || !importedData.students) {
        throw new Error('Geçersiz yedekleme dosyası formatı');
      }

      const confirmation = await confirmAction({
        title: 'Yedeği İçe Aktar',
        message:
          `Bu işlem mevcut ${importedData.students.length} öğrenci, ` +
          `${importedData.exams?.length || 0} deneme ve ` +
          `${importedData.books?.length || 0} kitap verisini içe aktaracak.\n\n` +
          'Mevcut veriler silinecek. Devam edilsin mi?',
        confirmText: 'İçe Aktar',
        cancelText: 'Vazgeç',
        danger: true
      });

      if (!confirmation) {
        setLoading(false);
        return;
      }

      // IndexedDB'yi temizle ve yeni verileri ekle
      const db = await openDB(DB_NAME, DB_VERSION);
      
      // Önce mevcut verileri temizle
      const tx = db.transaction(['students', 'books', 'exams', 'teacher'], 'readwrite');
      await Promise.all([
        tx.objectStore('students').clear(),
        tx.objectStore('books').clear(),
        tx.objectStore('exams').clear()
      ]);
      await tx.done;

      // Yeni verileri ekle
      const addTx = db.transaction(['students', 'books', 'exams', 'teacher'], 'readwrite');
      
      // Teacher
      if (importedData.teacher) {
        await addTx.objectStore('teacher').put(importedData.teacher);
      }

      // Students
      for (const student of importedData.students) {
        await addTx.objectStore('students').put(student);
      }

      // Books
      if (importedData.books) {
        for (const book of importedData.books) {
          await addTx.objectStore('books').put(book);
        }
      }

      // Exams
      if (importedData.exams) {
        for (const exam of importedData.exams) {
          await addTx.objectStore('exams').put(exam);
        }
      }

      await addTx.done;

      setMessage({ 
        type: 'success', 
        text: `İçe aktarma başarılı! Sayfa yenilenecek...` 
      });

      // 2 saniye sonra sayfayı yenile
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Import error:', error);
      setMessage({ type: 'error', text: 'İçe aktarma sırasında hata: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    const confirmation = await confirmAction({
      title: 'Tüm Verileri Sil',
      message:
        'TÜM VERİLER SİLİNECEK!\n\n' +
        'Bu işlem geri alınamaz. Öğrenci, deneme, kitap ve tüm verileriniz silinecek.\n\n' +
        'Devam etmek istediğinizden emin misiniz?',
      confirmText: 'Devam Et',
      cancelText: 'İptal',
      danger: true
    });

    if (!confirmation) return;

    const doubleCheck = await confirmAction({
      title: 'Son Onay',
      message: 'Son kez soruyoruz: Tüm verileri silmek istediğinizden EMİN MİSİNİZ?',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      danger: true
    });
    if (!doubleCheck) return;

    setLoading(true);
    try {
      const db = await openDB(DB_NAME, DB_VERSION);
      const tx = db.transaction(['students', 'books', 'exams', 'errorAnalysis'], 'readwrite');
      
      await Promise.all([
        tx.objectStore('students').clear(),
        tx.objectStore('books').clear(),
        tx.objectStore('exams').clear(),
        tx.objectStore('errorAnalysis').clear()
      ]);
      
      await tx.done;

      setMessage({ type: 'success', text: 'Tüm veriler silindi. Sayfa yenilenecek...' });
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Clear error:', error);
      setMessage({ type: 'error', text: 'Veri silme hatası: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Ayarlar</h1>
      </div>

      {/* Message */}
      {message.text && (
        <div className={'card mb-4 ' + (message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <Info className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <p className={'text-sm ' + (message.type === 'success' ? 'text-green-700' : 'text-red-700')}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* Veri Yedekleme */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900">Veri Yedekleme</h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Tüm verilerinizi JSON dosyası olarak kaydedin veya daha önce aldığınız yedeği geri yükleyin.
        </p>

        <div className="space-y-3">
          <button
            onClick={exportData}
            disabled={loading}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Yedek Al (Export)
          </button>

          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={importData}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="import-file"
            />
            <button
              disabled={loading}
              className="w-full btn-secondary py-3 flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Yedek Yükle (Import)
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            💡 <strong>İpucu:</strong> Düzenli yedek almayı unutmayın. Telefon değiştirmeden önce mutlaka yedek alın!
          </p>
        </div>
      </div>

      {/* Tehlikeli İşlemler */}
      <div className="card bg-red-50 border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-red-600" />
          <h2 className="font-semibold text-red-900">Tehlikeli Bölge</h2>
        </div>
        
        <p className="text-sm text-red-700 mb-4">
          Bu işlemler geri alınamaz. Dikkatli olun!
        </p>

        <button
          onClick={clearAllData}
          disabled={loading}
          className="w-full bg-red-600 text-white py-3 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Trash2 className="w-5 h-5" />
          Tüm Verileri Sil
        </button>
      </div>

      {/* Bilgi */}
      <div className="mt-6 text-center text-xs text-gray-500">
        <p>MathUp v1.0.0</p>
        <p className="mt-1">Offline-first matematik takip uygulaması</p>
      </div>
    </div>
  );
};

export default Settings;
