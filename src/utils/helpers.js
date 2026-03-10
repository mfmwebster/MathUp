/*
 * File: src/utils/helpers.js
 * Description: Yardımcı fonksiyonlar: tarih biçimlendirme, net hesaplama, ID üretimi, renkler ve ders programı oluşturma.
 */

// Net hesaplama (LGS formatı: 3Y1D)
export const calculateNet = (correct, wrong, empty = null, totalQuestions = null) => {
  const safeCorrect = Number.parseFloat(correct) || 0;
  const safeWrong = Number.parseFloat(wrong) || 0;
  const safeEmpty = empty === null ? null : (Number.parseFloat(empty) || 0);
  const safeTotalQuestions = totalQuestions === null ? null : (Number.parseFloat(totalQuestions) || 0);

  if (safeEmpty !== null && safeTotalQuestions !== null) {
    const sum = safeCorrect + safeWrong + safeEmpty;
    if (sum !== safeTotalQuestions) {
      console.warn(`Soru sayısı uyuşmazlığı: ${sum} ≠ ${safeTotalQuestions}`);
    }
  }

  const net = safeCorrect - (safeWrong / 3);
  return Math.max(0, Number.parseFloat(net.toFixed(2))); // Negatif net olamaz
};

// Tarih formatlama (Türkçe)
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

// Kısa tarih formatı
export const formatShortDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit'
  });
};

// Haftanın günü (Türkçe)
export const getDayName = (date) => {
  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return days[new Date(date).getDay()];
};

// İsimden baş harfleri al
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Para formatı (TL)
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0
  }).format(amount);
};

// Takvim uygulamalarına benzer sabit öğrenci renk paleti
export const STUDENT_COLOR_OPTIONS = [
  { id: 'blue', label: 'Mavi', hex: '#1a73e8' },
  { id: 'green', label: 'Yeşil', hex: '#0b8043' },
  { id: 'purple', label: 'Mor', hex: '#8e24aa' },
  { id: 'magenta', label: 'Fuşya', hex: '#d81b60' },
  { id: 'orange', label: 'Turuncu', hex: '#f4511e' },
  { id: 'yellow', label: 'Sarı', hex: '#f6bf26' },
  { id: 'teal', label: 'Turkuaz', hex: '#00897b' },
  { id: 'indigo', label: 'İndigo', hex: '#3949ab' },
  { id: 'slate', label: 'Gri Mavi', hex: '#5f6368' },
  { id: 'red', label: 'Kırmızı', hex: '#c62828' }
];

const hashString = (value) => {
  const source = String(value || '');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const getStudentColorOption = (colorId) => {
  return STUDENT_COLOR_OPTIONS.find((option) => option.id === colorId) || null;
};

export const getStudentColorHex = (student, fallbackSeed = '') => {
  const selected = getStudentColorOption(student?.colorId);
  if (selected) return selected.hex;

  const hash = hashString(student?.id || student?.fullName || fallbackSeed || 'student');
  return STUDENT_COLOR_OPTIONS[hash % STUDENT_COLOR_OPTIONS.length].hex;
};

export const hexToRgba = (hex, alpha = 1) => {
  const value = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return `rgba(59, 130, 246, ${alpha})`;
  }

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Geriye dönük uyumluluk: eski sınıf tabanlı kullanım için renk sınıfı üretir
export const generatePastelColor = (id) => {
  const colors = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-slate-100 text-slate-800 border-slate-200',
    'bg-red-100 text-red-800 border-red-200'
  ];
  return colors[id % colors.length];
};

// ID üretici
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Hafta numarası hesapla (LGS 2026: 26 Haziran)
export const getWeeksUntilLGS = () => {
  const lgsDate = new Date('2026-06-26');
  const today = new Date();
  const diffTime = lgsDate - today;
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  return Math.max(0, diffWeeks);
};

// Ders planı oluştur (haftalık dersler)
export const generateLessonSchedule = (startDate, dayOfWeek, time, duration, weeks, unitFee = 0) => {
  const schedule = [];
  const start = new Date(startDate);
  
  for (let i = 0; i < weeks; i++) {
    const lessonDate = new Date(start);
    lessonDate.setDate(start.getDate() + (i * 7));
    // Günü ayarla (0=Pazar, 1=Pazartesi...)
    while (lessonDate.getDay() !== parseInt(dayOfWeek)) {
      lessonDate.setDate(lessonDate.getDate() + 1);
    }
    
    schedule.push({
      week: i + 1,
      date: lessonDate.toISOString().split('T')[0],
      time: time,
      duration: duration,
      completed: false,
      topic: null,
      paymentAmount: parseFloat(unitFee) || 0,
      paymentStatus: 'pending',
      paymentCollectedAt: null
    });
  }
  
  return schedule;
};

// Kaç hafta ders planlanacağını hesapla
//  - 8. sınıf için LGS tarihine kadar olan hafta sayısını döner
//  - diğer sınıflar için sabit müfredat süresi (37 hafta)
export const getScheduleWeeks = (grade = '') => {
  const defaultWeeks = 37;
  if (grade === '8') {
    // LGS'ye kalan hafta sayısını al ve 37 ile sınırla
    return Math.min(getWeeksUntilLGS(), defaultWeeks);
  }
  return defaultWeeks;
};
