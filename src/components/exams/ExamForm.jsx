/*
 * File: src/components/exams/ExamForm.jsx
 * Description: Deneme ekleme/düzenleme formu; net, doğru/yanlış/boş gibi alanları yönetir.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calculator, Save, User, BookOpen 
} from 'lucide-react';
import { generateId, calculateNet } from '../../utils/helpers';

const ExamForm = () => {
  const navigate = useNavigate();
  const { getStudents, addExam, isReady } = useDatabase();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    studentId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'lgs', // lgs, bursluluk, lise
    subject: '', // turkce, matematik, fen, sosyal, ingilizce, din, inkilap
    correct: '',
    wrong: '',
    empty: '',
    net: ''
  });

  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    if (isReady) {
      loadStudents();
    }
  }, [isReady]);

  const loadStudents = async () => {
    const data = await getStudents();
    setStudents(data);
    if (data.length > 0) {
      setFormData(prev => ({ ...prev, studentId: data[0].id }));
    }
  };

  // Akilli form: Dogru girince otomatik Yanlisa gec
  useEffect(() => {
    if (focusedField === 'correct' && formData.correct.length === 2) {
      // 2 basamakli sayi girildiginde yanlis alanina gec
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
    // Sinav tipine gore soru sayisi
    const counts = {
      turkce: 20,
      matematik: 20,
      fen: 20,
      sosyal: 20,
      ingilizce: 20,
      din: 20,
      inkilap: 20
    };
    return counts[formData.subject] || 20;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const exam = {
        id: generateId(),
        ...formData,
        correct: parseInt(formData.correct),
        wrong: parseInt(formData.wrong),
        empty: parseInt(formData.empty),
        net: parseFloat(formData.net),
        createdAt: new Date().toISOString()
      };

      await addExam(exam);
      navigate('/exams');
    } catch (error) {
      console.error('Sınav kaydedilirken hata:', error);
      alert('Sınav kaydedilemedi. Lütfen tekrar deneyiniz.');
    } finally {
      setLoading(false);
    }
  };

  const subjects = [
    { value: 'turkce', label: 'Turkce', questions: 20 },
    { value: 'matematik', label: 'Matematik', questions: 20 },
    { value: 'fen', label: 'Fen Bilimleri', questions: 20 },
    { value: 'sosyal', label: 'Sosyal Bilgiler', questions: 20 },
    { value: 'ingilizce', label: 'Ingilizce', questions: 20 },
    { value: 'din', label: 'Din Kulturu', questions: 20 },
    { value: 'inkilap', label: 'Inkilap Tarihi', questions: 20 }
  ];

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
        <h1 className="text-2xl font-bold text-gray-900">Yeni Deneme</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Öğrenci Seçimi */}
        <div className="card">
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

        {/* Tarih ve Konu */}
        <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ders
              </label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                className="input-field"
                required
              >
                <option value="">Seciniz</option>
                {subjects.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({s.questions} soru)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Akilli Puan Girisi */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary-600" />
            Sonuclar (Otomatik Hesaplanir)
          </h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-center">
                Dogru
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
                Yanlis
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-center">
                Bos
              </label>
              <input
                type="number"
                readOnly
                value={formData.empty}
                className="input-field text-center text-2xl font-bold text-gray-400 bg-gray-50"
              />
            </div>
          </div>

          {/* Net Gostergesi */}
          <div className="mt-6 text-center p-4 bg-primary-50 rounded-xl">
            <span className="text-gray-600 text-sm">Net Sayisi</span>
            <div className="text-4xl font-bold text-primary-700">
              {formData.net || '0.00'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              3 Yanlis 1 Dogru goturur (3Y1D)
            </div>
          </div>
        </div>

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
