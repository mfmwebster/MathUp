/*
 * File: src/utils/helpers.js
 * Description: Yardımcı fonksiyonlar: tarih biçimlendirme, net hesaplama, ID üretimi, renkler ve ders programı oluşturma.
 */

// Net hesaplama (LGS formatı: 3Y1D)
export const calculateNet = (correct, wrong) => {
  const net = correct - (wrong / 3);
  return Math.max(0, net); // Negatif net olamaz
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

// Renk üretici (öğrenci kartları için pastel renkler)
export const generatePastelColor = (id) => {
  const colors = [
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-cyan-100 text-cyan-800 border-cyan-200',
    'bg-orange-100 text-orange-800 border-orange-200'
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
