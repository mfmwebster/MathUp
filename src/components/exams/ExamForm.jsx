/*
 * File: src/components/exams/ExamForm.jsx
 * Description: Deneme ekleme/düzenleme formu; net, doğru/yanlış/boş gibi alanları yönetir.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Calculator, Save, User, BookOpen 
} from 'lucide-react';
import { generateId, calculateNet } from '../../utils/helpers';
import { useFeedback } from '../../context/FeedbackContext';

const ExamForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getStudents, addExam, isReady } = useDatabase();
  const { notify } = useFeedback();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    date: new Date().toISOString().split('T')[0],
    type: 'lgs', // lgs, bursluluk, lise
    subject: 'matematik', // sadece matematik
    correct: '',
    wrong: '',
    empty: '',
    net: '',
    errors: [] // { type: 'Dikkat Hatası', count: 2 }
  });

  const [showErrorInput, setShowErrorInput] = useState(false);
  const [errorTypes] = useState([
    'Dikkat Hatası',
    'Kavram Yanılgısı',
    'İşlem Hatası',
    'Formül Hatası',
    'Soru Okuma',
    'Zaman Yetersizliği'
  ]);

  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    if (isReady) {
      loadStudents();
    }
  }, [isReady]);

  const loadStudents = async () => {
    const data = await getStudents();
    setStudents(data);

    const queryStudentId = new URLSearchParams(location.search).get('studentId');
    const validQueryStudent = data.find((student) => student.id === queryStudentId);

    if (validQueryStudent) {
      setFormData(prev => ({ ...prev, studentId: validQueryStudent.id }));
      return;
    }

    if (data.length > 0) {
      setFormData(prev => ({ ...prev, studentId: data[0].id }));
    }
  };

  const selectedStudent = students.find((student) => student.id === formData.studentId);

  // Akıllı form: Doğru girince otomatik Yanlışa geç
  useEffect(() => {
    if (focusedField === 'correct' && formData.correct.length === 2) {
      // 2 basamaklı sayı girildiğinde yanlış alanına geç
      document.getElementById('wrong-input')?.focus();
    }
  }, [formData.correct, focusedField]);

  // Otomatik net hesaplama
  useEffect(() => {
    const correct = parseInt(formData.correct) || 0;
    const wrong = parseInt(formData.wrong) || 0;
    
    if (correct > 0 || wrong > 0) {
      const net = calculateNet(correct, wrong);
      const totalQuestions = getTotalQuestions();
      const empty = Math.max(0, totalQuestions - correct - wrong);
      
      setFormData(prev => ({
        ...prev,
        net: net.toFixed(2),
        empty: empty.toString()
      }));
    }
  }, [formData.correct, formData.wrong, formData.type, formData.subject]);

  const getTotalQuestions = () => {
    // Sınav tipine göre matematik soru sayısı
    const questionCounts = {
      bursluluk: 20,
      lgs: 20,
      lise: 40
    };
    
    return questionCounts[formData.type] || 20;
  };

  const getChoiceCount = () => {
    // Sınav tipine göre seçenek sayısı
    const choiceCounts = {
      bursluluk: 3, // A, B, C
      lgs: 4,       // A, B, C, D
      lise: 5       // A, B, C, D, E
    };
    return choiceCounts[formData.type] || 4;
  };

  const getPenaltyRule = () => {
    // Sınav tipine göre yanlış ceza kuralı
    const penalties = {
      bursluluk: '3Y1D', // 3 yanlış 1 doğruyu götürür
      lgs: '3Y1D',
      lise: '3Y1D'
    };
    return penalties[formData.type] || '3Y1D';
  };

  const getMaxErrorCount = () => {
    const wrong = parseInt(formData.wrong) || 0;
    return wrong * 2;
  };

  const getCurrentErrorCount = () => {
    return formData.errors.reduce((sum, error) => sum + (error.count || 0), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const totalErrorCount = getCurrentErrorCount();
      const maxErrorCount = getMaxErrorCount();

      if (totalErrorCount > maxErrorCount) {
        notify(`Toplam hata türü girişi en fazla yanlışın 2 katı olabilir. (Maks: ${maxErrorCount})`, 'warning');
        setLoading(false);
        return;
      }

      const exam = {
        id: generateId(),
        ...formData,
        correct: parseInt(formData.correct),
        wrong: parseInt(formData.wrong),
        empty: parseInt(formData.empty),
        net: parseFloat(formData.net),
        errors: formData.errors,
        createdAt: new Date().toISOString()
      };

      await addExam(exam);
      navigate(`/exams/analysis/${formData.studentId}`);
    } catch (error) {
      console.error('Sınav kaydedilirken hata:', error);
      notify('Sınav kaydedilemedi. Lütfen tekrar deneyiniz.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addError = (type) => {
    const maxErrorCount = getMaxErrorCount();
    const currentErrorCount = getCurrentErrorCount();

    if (currentErrorCount >= maxErrorCount) {
      notify(`Hata türü girişi sınırına ulaşıldı (Maks: ${maxErrorCount}).`, 'warning');
      return;
    }

    const existing = formData.errors.find(e => e.type === type);
    if (existing) {
      setFormData({
        ...formData,
        errors: formData.errors.map(e => 
          e.type === type ? { ...e, count: e.count + 1 } : e
        )
      });
      return;
    }

    setFormData({
      ...formData,
      errors: [...formData.errors, { type, count: 1 }]
    });
  };

  const removeError = (type) => {
    setFormData({
      ...formData,
      errors: formData.errors.filter(e => e.type !== type)
    });
  };

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Yeni Deneme{selectedStudent ? ` • ${selectedStudent.fullName}` : ''}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Öğrenci Seçimi ve Deneme Adı */}
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Öğrenci
            </label>
            <select
              value={formData.studentId}
              onChange={(e) => setFormData({...formData, studentId: e.target.value})}
              className="input-field"
              required
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.fullName} ({s.grade}. Sınıf)</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deneme Adı (Opsiyonel)</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="input-field"
              placeholder="Örn: Hazırlık Denemesi 1"
            />
          </div>
        </div>

        {/* Tarih ve Konu */}
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sınav Tipi
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value, subject: ''})}
              className="input-field"
              required
            >
              <option value="lgs">LGS (Ortaokul - 4 Seçenek)</option>
              <option value="bursluluk">Bursluluk (3 Seçenek)</option>
              <option value="lise">Lise (5 Seçenek)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {getChoiceCount()} seçenekli, {getPenaltyRule()} kuralı
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarih
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="input-field"
                required
              />
            </div>
          </div>
        </div>

        {/* Akıllı Puan Girişi */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary-600" />
            Sonuçlar (Otomatik Hesaplanır)
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-center">
                Doğru
              </label>
              <input
                id="correct-input"
                type="number"
                min="0"
                max={getTotalQuestions()}
                value={formData.correct}
                onChange={(e) => setFormData({...formData, correct: e.target.value})}
                onFocus={() => setFocusedField('correct')}
                onBlur={() => setFocusedField(null)}
                className="input-field text-center text-2xl font-bold text-green-600"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-center">
                Yanlış
              </label>
              <input
                id="wrong-input"
                type="number"
                min="0"
                max={getTotalQuestions()}
                value={formData.wrong}
                onChange={(e) => setFormData({...formData, wrong: e.target.value})}
                className="input-field text-center text-2xl font-bold text-red-600"
                placeholder="0"
              />
            </div>
          </div>

          {/* Net Göstergesi */}
          <div className="mt-6 text-center p-4 bg-primary-50 rounded-xl">
            <span className="text-gray-600 text-sm">Net Sayısı</span>
            <div className="text-4xl font-bold text-primary-700">
              {formData.net || '0.00'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {getPenaltyRule()} kuralı • {getChoiceCount()} seçenekli
            </div>
          </div>
        </div>

        {/* Hata Analizi (Opsiyonel) */}
        {formData.wrong && parseInt(formData.wrong) > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-red-600" />
                Hata Türleri (Opsiyonel)
              </h2>
              <button
                type="button"
                onClick={() => setShowErrorInput(!showErrorInput)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {showErrorInput ? 'Gizle' : 'Ekle'}
              </button>
            </div>

            {showErrorInput && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Yanlış soruları hata türüne göre sınıflandırın
                </p>
                <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                  Toplam hata girişi: {getCurrentErrorCount()} / {getMaxErrorCount()} (yanlışın 2 katı)
                </p>
                
                <div className="grid grid-cols-2 gap-2">
                  {errorTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addError(type)}
                      className="btn-secondary py-2 text-sm"
                    >
                      + {type}
                    </button>
                  ))}
                </div>

                {formData.errors.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {formData.errors.map(error => (
                      <div key={error.type} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                        <span className="text-sm text-gray-700">{error.type}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-red-600">{error.count}</span>
                          <button
                            type="button"
                            onClick={() => removeError(error.type)}
                            className="text-red-600 hover:bg-red-100 rounded p-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Kaydet */}
        <button
          type="submit"
          disabled={!isReady || loading || !formData.subject}
          className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Kaydet
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default ExamForm;
