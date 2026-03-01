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
import { generateId, getScheduleWeeks } from '../../utils/helpers';

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Pzt' },
  { value: '2', label: 'Sal' },
  { value: '3', label: 'Çar' },
  { value: '4', label: 'Per' },
  { value: '5', label: 'Cum' },
  { value: '6', label: 'Cmt' },
  { value: '0', label: 'Paz' }
];

const getMondayWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getMondayIndexFromJsDay = (jsDay) => {
  return jsDay === 0 ? 6 : jsDay - 1;
};

const toLocalDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTimeToMinutes = (timeValue) => {
  const value = String(timeValue || '').trim();
  const [hourRaw, minuteRaw = '0'] = value.split(':');
  const hour = parseInt(hourRaw, 10);
  const minute = parseInt(minuteRaw, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour * 60) + minute;
};

const hasTimeRangeOverlap = (firstLesson, secondLesson) => {
  if (!firstLesson?.date || !secondLesson?.date || firstLesson.date !== secondLesson.date) return false;

  const firstStart = parseTimeToMinutes(firstLesson.time);
  const secondStart = parseTimeToMinutes(secondLesson.time);
  if (firstStart === null || secondStart === null) return false;

  const firstDuration = Math.max(15, parseInt(firstLesson.duration || 60, 10) || 60);
  const secondDuration = Math.max(15, parseInt(secondLesson.duration || 60, 10) || 60);
  const firstEnd = firstStart + firstDuration;
  const secondEnd = secondStart + secondDuration;

  return firstStart < secondEnd && secondStart < firstEnd;
};

const generateFlexibleLessonSchedule = ({
  startDate,
  weekdays,
  time,
  duration,
  endDate,
  repeatEveryWeeks,
  unitFee
}) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const intervalWeeks = Math.max(1, parseInt(repeatEveryWeeks || '1', 10));
  const selectedDays = [...new Set((weekdays || ['1']).map((day) => parseInt(day, 10)).filter((day) => !Number.isNaN(day)))];
  if (selectedDays.length === 0) selectedDays.push(1);

  selectedDays.sort((a, b) => getMondayIndexFromJsDay(a) - getMondayIndexFromJsDay(b));

  const weekStart = getMondayWeekStart(start);
  const schedule = [];
  let weekNumber = 1;

  for (let cycle = 0; cycle < 520; cycle += 1) {
    const cycleFirstDate = new Date(weekStart);
    cycleFirstDate.setDate(weekStart.getDate() + (cycle * intervalWeeks * 7) + getMondayIndexFromJsDay(selectedDays[0]));
    if (cycleFirstDate > end) break;

    selectedDays.forEach((dayValue) => {
      const candidate = new Date(weekStart);
      candidate.setDate(weekStart.getDate() + (cycle * intervalWeeks * 7) + getMondayIndexFromJsDay(dayValue));
      candidate.setHours(0, 0, 0, 0);

      if (candidate < start || candidate > end) return;

      schedule.push({
        week: weekNumber,
        date: toLocalDateKey(candidate),
        time,
        duration,
        completed: false,
        topic: null,
        paymentAmount: parseFloat(unitFee) || 0,
        paymentStatus: 'pending',
        paymentCollectedAt: null
      });

      weekNumber += 1;
    });
  }

  return schedule;
};

const StudentForm = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { addStudent, getStudentById, getStudents, updateStudent, isReady } = useDatabase();
  
  const [formData, setFormData] = useState({
    fullName: '',
    school: '',
    grade: '8',
    phone: '',
    parentPhone: '',
    lessonDay: '1', // 1=Pazartesi
    lessonDays: ['1'],
    recurrenceIntervalWeeks: '1',
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
        lessonDays: student.lessonDays || [student.lessonDay || '1'],
        recurrenceIntervalWeeks: student.recurrenceIntervalWeeks || '1',
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

    const recurrenceInterval = parseInt(formData.recurrenceIntervalWeeks || '1', 10);
    if (Number.isNaN(recurrenceInterval) || recurrenceInterval < 1) {
      newErrors.recurrenceIntervalWeeks = 'Tekrar aralığı en az 1 hafta olmalı';
    }

    if (!Array.isArray(formData.lessonDays) || formData.lessonDays.length === 0) {
      newErrors.lessonDays = 'En az 1 ders günü seçmelisiniz';
    }
    
    if (!formData.fee || isNaN(formData.fee) || parseFloat(formData.fee) <= 0) {
      newErrors.fee = 'Ders başı ücret zorunlu ve 0’dan büyük olmalı';
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
      // Ders planı ve ders başı ücret
      const unitFee = parseFloat(formData.fee) || 0;
      const existingStudent = isEditing ? await getStudentById(id) : null;
      const existingInitialFee = parseFloat(existingStudent?.initialFee);
      const initialFee = isEditing
        ? ((!Number.isNaN(existingInitialFee) && existingInitialFee > 0) ? existingInitialFee : unitFee)
        : unitFee;
      const weeksToSchedule = getScheduleWeeks(formData.grade);

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (weeksToSchedule * 7));

      let schedule = generateFlexibleLessonSchedule({
        startDate,
        weekdays: formData.lessonDays,
        time: formData.lessonTime,
        duration: parseInt(formData.lessonDuration),
        endDate,
        repeatEveryWeeks: formData.recurrenceIntervalWeeks,
        unitFee: initialFee
      });

      if (isEditing) {
        if (existingStudent?.schedule?.length > 0) {
          schedule = existingStudent.schedule.map((lesson) => ({
            ...lesson,
            paymentAmount: (() => {
              const lessonAmount = parseFloat(lesson.paymentAmount);
              if (!Number.isNaN(lessonAmount) && lessonAmount > 0) {
                return lessonAmount;
              }
              return initialFee;
            })(),
            paymentStatus: lesson.paymentStatus || 'pending',
            paymentCollectedAt: lesson.paymentCollectedAt || null,
            paymentDueDate: lesson.paymentDueDate || lesson.date || null
          }));
        }
      }

      const allStudents = await getStudents();
      const otherStudentsLessons = (allStudents || [])
        .filter((entry) => entry.id !== (isEditing ? id : null))
        .flatMap((entry) => (entry.schedule || []).map((lesson) => ({
          date: lesson.date,
          time: lesson.time,
          duration: lesson.duration || entry.lessonDuration || 60
        })));

      const hasConflict = schedule.some((lesson, index) => {
        const ownConflict = schedule.some((compareLesson, compareIndex) => {
          if (compareIndex === index) return false;
          return hasTimeRangeOverlap(lesson, compareLesson);
        });

        const globalConflict = otherStudentsLessons.some((otherLesson) => hasTimeRangeOverlap(lesson, otherLesson));
        return ownConflict || globalConflict;
      });

      if (hasConflict) {
        alert('Ders planında saat çakışması var. Lütfen gün/saat veya tekrar aralığını düzenleyin.');
        setLoading(false);
        return;
      }

      const studentData = {
        id: isEditing ? id : generateId(),
        ...formData,
        lessonDay: Array.isArray(formData.lessonDays) && formData.lessonDays.length > 0 ? formData.lessonDays[0] : '1',
        initialFee,
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

  const toggleLessonDay = (dayValue) => {
    const activeDays = Array.isArray(formData.lessonDays) ? formData.lessonDays : [];
    const exists = activeDays.includes(dayValue);

    if (exists && activeDays.length === 1) {
      return;
    }

    const nextDays = exists
      ? activeDays.filter((value) => value !== dayValue)
      : [...activeDays, dayValue];

    const ordered = [...nextDays].sort((a, b) => {
      const aOrder = getMondayIndexFromJsDay(parseInt(a, 10));
      const bOrder = getMondayIndexFromJsDay(parseInt(b, 10));
      return aOrder - bOrder;
    });

    setFormData({
      ...formData,
      lessonDays: ordered,
      lessonDay: ordered[0] || formData.lessonDay
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
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ders Günleri</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const selected = (formData.lessonDays || []).includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleLessonDay(day.value)}
                      className={'px-3 py-1.5 rounded-full text-sm font-medium border ' + (selected ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300')}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {errors.lessonDays && <p className="text-red-600 text-xs mt-1">{errors.lessonDays}</p>}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tekrar Aralığı (Hafta)</label>
              <input
                type="number"
                min="1"
                value={formData.recurrenceIntervalWeeks}
                onChange={(e) => setFormData({...formData, recurrenceIntervalWeeks: e.target.value})}
                className={"input-field " + (errors.recurrenceIntervalWeeks ? 'border-red-500 focus:ring-red-500' : '')}
              />
              {errors.recurrenceIntervalWeeks && <p className="text-red-600 text-xs mt-1">{errors.recurrenceIntervalWeeks}</p>}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Ders Başı Ücret (TL)</label>
              <input
                type="number"
                required
                min="1"
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
            Otomatik ders planı seçilen günler ve tekrar aralığına göre oluşturulur (örn: haftada 2 gün veya 2 haftada 1).
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
