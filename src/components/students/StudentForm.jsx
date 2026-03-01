/*
 * File: src/components/students/StudentForm.jsx
 * Description: Yeni öğrenci ekleme veya mevcut öğrenciyi düzenleme için form bileşeni.
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Camera, User, School, Clock, 
  Calendar, DollarSign, Check 
} from 'lucide-react';
import { generateId, generateLessonSchedule } from '../../utils/helpers';

const StudentForm = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { addStudent, getStudentById, updateStudent, isReady } = useDatabase();
  
  const [formData, setFormData] = useState({
    fullName: '',
    school: '',
    grade: '8',
    phone: '',
    parentPhone: '',
    lessonDay: '1', // 1=Pazartesi
    lessonTime: '16:00',
    lessonDuration: '60',
    fee: '',
    photo: null,
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEditing && isReady) {
      loadStudent();
    }
  }, [id, isReady]);

  const loadStudent = async () => {
    const student = await getStudentById(id);
    if (student) {
      setFormData({
        fullName: student.fullName || '',
        school: student.school || '',
        grade: student.grade || '8',
        phone: student.phone || '',
        parentPhone: student.parentPhone || '',
        lessonDay: student.lessonDay || '1',
        lessonTime: student.lessonTime || '16:00',
        lessonDuration: student.lessonDuration || '60',
        fee: student.fee || '',
        photo: student.photo || null,
        notes: student.notes || ''
      });
      setPreviewPhoto(student.photo);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Dosyayi base64'e cevir (gercek uygulamada boyut kisitlamasi yapilmali)
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewPhoto(reader.result);
        setFormData({...formData, photo: reader.result});
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.fullName.trim() || formData.fullName.trim().length < 3) {
      newErrors.fullName = 'Ad Soyad en az 3 karakter olmalı';
    }
    
    if (formData.phone && !/^05[0-9]{9}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Telefon formatı yanlış (05XX XXXXXXX)';
    }
    
    if (formData.parentPhone && !/^05[0-9]{9}$/.test(formData.parentPhone.replace(/\D/g, ''))) {
      newErrors.parentPhone = 'Telefon formatı yanlış (05XX XXXXXXX)';
    }
    
    const duration = parseInt(formData.lessonDuration);
    if (duration < 15 || duration > 180) {
      newErrors.lessonDuration = 'Ders süresi 15-180 dakika arası olmalı';
    }
    
    if (formData.fee && (isNaN(formData.fee) || parseInt(formData.fee) < 0)) {
      newErrors.fee = 'Ücret pozitif bir sayı olmalı';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    if (!isReady) {
      alert('Veritabanı hazır değil, lütfen bekleyin.');
      return;
    }
    setLoading(true);

    try {
      // Otomatik ders plani olustur (LGS 2026'ya kadar)
      const weeksUntilLGS = 37; // Sabit 37 hafta
      const schedule = generateLessonSchedule(
        new Date(),
        formData.lessonDay,
        formData.lessonTime,
        parseInt(formData.lessonDuration),
        weeksUntilLGS
      );

      const studentData = {
        id: isEditing ? id : generateId(),
        ...formData,
        schedule,
        createdAt: isEditing ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (isEditing) {
        await updateStudent(studentData);
      } else {
        await addStudent(studentData);
      }

      navigate('/students');
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const days = [
    { value: '1', label: 'Pazartesi' },
    { value: '2', label: 'Sali' },
    { value: '3', label: 'Carsamba' },
    { value: '4', label: 'Persembe' },
    { value: '5', label: 'Cuma' },
    { value: '6', label: 'Cumartesi' },
    { value: '0', label: 'Pazar' }
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
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Öğrenci Düzenle' : 'Yeni Öğrenci'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Fotoğraf */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
              {previewPhoto ? (
                <img src={previewPhoto} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-gray-300" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-primary-600 text-white p-2 rounded-full cursor-pointer shadow-lg hover:bg-primary-700">
              <Camera className="w-5 h-5" />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handlePhotoChange}
              />
            </label>
          </div>
        </div>

        {/* Temel Bilgiler */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-600" />
            Temel Bilgiler
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad *</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              className={"input-field " + (errors.fullName ? 'border-red-500 focus:ring-red-500' : '')}
              placeholder="Örn: Ayşe Yılmaz"
            />
            {errors.fullName && <p className="text-red-600 text-xs mt-1">{errors.fullName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sınıf *</label>
              <select
                value={formData.grade}
                onChange={(e) => setFormData({...formData, grade: e.target.value})}
                className="input-field"
              >
                <option value="5">5. Sınıf</option>
                <option value="6">6. Sınıf</option>
                <option value="7">7. Sınıf</option>
                <option value="8">8. Sınıf</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Okul</label>
              <input
                type="text"
                value={formData.school}
                onChange={(e) => setFormData({...formData, school: e.target.value})}
                className="input-field"
                placeholder="Okul adi"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Öğrenci Tel</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className={"input-field " + (errors.phone ? 'border-red-500 focus:ring-red-500' : '')}
                placeholder="05XX XXXXXXX"
              />
              {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Veli Tel</label>
              <input
                type="tel"
                value={formData.parentPhone}
                onChange={(e) => setFormData({...formData, parentPhone: e.target.value})}
                className={"input-field " + (errors.parentPhone ? 'border-red-500 focus:ring-red-500' : '')}
                placeholder="05XX XXXXXXX"
              />
              {errors.parentPhone && <p className="text-red-600 text-xs mt-1">{errors.parentPhone}</p>}
            </div>
          </div>
        </div>

        {/* Ders Bilgileri */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" />
            Ders Bilgileri
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gun</label>
              <select
                value={formData.lessonDay}
                onChange={(e) => setFormData({...formData, lessonDay: e.target.value})}
                className="input-field"
              >
                {days.map(day => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saat</label>
              <input
                type="time"
                value={formData.lessonTime}
                onChange={(e) => setFormData({...formData, lessonTime: e.target.value})}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Süre (dk)</label>
              <select
                value={formData.lessonDuration}
                onChange={(e) => setFormData({...formData, lessonDuration: e.target.value})}
                className={"input-field " + (errors.lessonDuration ? 'border-red-500 focus:ring-red-500' : '')}
              >
                <option value="45">45 dk</option>
                <option value="60">60 dk</option>
                <option value="90">90 dk</option>
                <option value="120">120 dk</option>
              </select>
              {errors.lessonDuration && <p className="text-red-600 text-xs mt-1">{errors.lessonDuration}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aylık Ücret (TL)</label>
              <input
                type="number"
                value={formData.fee}
                onChange={(e) => setFormData({...formData, fee: e.target.value})}
                className={"input-field " + (errors.fee ? 'border-red-500 focus:ring-red-500' : '')}
                placeholder="2000"
              />
              {errors.fee && <p className="text-red-600 text-xs mt-1">{errors.fee}</p>}
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
            <Calendar className="w-4 h-4 inline mr-1" />
            Otomatik olarak LGS 2026'ya kadar haftalik ders plani olusturulacak.
          </div>
        </div>

        {/* Notlar */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            className="input-field h-24 resize-none"
            placeholder="Öğrenci hakkında notlar..."
          />
        </div>

        {/* Kaydet Butonu */}
        <button
          type="submit"
          disabled={!isReady || loading}
          className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <Check className="w-5 h-5" />
              {isEditing ? 'Guncelle' : 'Kaydet'}
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default StudentForm;
