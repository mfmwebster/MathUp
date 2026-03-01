"# 📚 MathUp - Matematik Özel Ders Takip Uygulaması

5-8. sınıf matematik özel ders veren öğretmenler için **offline-first**, hem telefon (Android APK) hem bilgisayarda (Web) çalışabilen modern takip ve yönetim platformu.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Capacitor](https://img.shields.io/badge/Capacitor-Ready-success)

---

## ✨ Özellikler

### 🎯 Temel Özellikler
- ✅ **Öğrenci Yönetimi** - CRUD, fotoğraf, ders programı
- ✅ **Otomatik Ders Planı** - LGS 2026'ya kadar haftalık planlama
- ✅ **Deneme Sistemi** - Akıllı form, otomatik net hesaplama, 3Y1D
- ✅ **Hata Analizi** - Spider chart, gerçek verilerle analiz
- ✅ **Kazanım Takip** - 37 haftalık müfredat, kazanım işaretleme
- ✅ **Kitap Takip** - Sayfa sayfa işaretleme, ilerleme takibi
- ✅ **Finans** - İç-dış halka grafik, tahsilat takibi
- ✅ **Veri Yedekleme** - JSON export/import

### 📱 Teknik Özellikler
- ✅ **Offline-First** - İnternet olmadan tam çalışır
- ✅ **PWA** - Ana ekrana eklenebilir
- ✅ **Service Worker** - Otomatik cache
- ✅ **Responsive** - Mobile-first tasarım
- ✅ **IndexedDB** - Kalıcı veri saklama

---

## 🚀 Kurulum ve Çalıştırma

### Geliştirme Ortamı

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Veya Windows'ta
baslat.bat
```

Tarayıcıda açılacak: `http://localhost:5173`

### Production Build

```bash
# Web için build
npm run build

# Build'i test et
npm run preview
```

---

## 📱 APK Oluşturma

Detaylı talimatlar için: **[APK-BUILD.md](./APK-BUILD.md)**

### Hızlı Başlangıç

```bash
# 1. Capacitor kurulumu
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/camera

# 2. Build ve sync
npm run cap:sync

# 3. Android Studio'yu aç
npm run cap:open:android
```

**Veya otomatik script:**

```bash
.\build-apk.bat
```

---

## 📂 Proje Yapısı

```
MathUp/
├── public/
│   ├── icons/              # PWA ikonları
│   ├── manifest.json       # PWA manifest
│   ├── sw.js              # Service Worker
│   └── register-sw.js     # SW kaydı
├── src/
│   ├── components/
│   │   ├── auth/          # Login/Register
│   │   ├── dashboard/     # Ana sayfa, Müfredat
│   │   ├── students/      # Öğrenci CRUD, Detay
│   │   ├── books/         # Kitap takip
│   │   ├── exams/         # Deneme, Hata analizi
│   │   ├── finance/       # Finans grafikleri
│   │   ├── settings/      # Ayarlar, Yedekleme
│   │   └── layout/        # Navigation
│   ├── data/
│   │   ├── curriculum.json    # 8. sınıf
│   │   ├── curriculum5.json
│   │   ├── curriculum6.json
│   │   └── curriculum7.json
│   ├── hooks/
│   │   └── useDatabase.js     # IndexedDB hook
│   ├── utils/
│   │   └── helpers.js         # Yardımcı fonksiyonlar
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── capacitor.config.json      # Capacitor ayarları
├── build-apk.bat             # APK build script
└── package.json
```

---

## 🛠️ Teknolojiler

| Kategori | Teknoloji | Amaç |
|----------|-----------|------|
| **Framework** | React 18 | UI framework |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Charts** | Chart.js + react-chartjs-2 | Grafikler (Doughnut, Radar) |
| **Routing** | React Router v6 | SPA routing |
| **Database** | IndexedDB (idb) | Offline veri saklama |
| **PWA** | Service Worker + Manifest | Offline çalışma |
| **Mobile** | Capacitor | Native Android APK |
| **Icons** | lucide-react | Modern SVG iconlar |
| **Date** | date-fns | Tarih formatlamaları |
| **Build** | Vite | Hızlı bundler |

---

## 📊 Ekran Görüntüleri

### Dashboard
- 4 kart: Öğrenci sayısı, Finans, Sıradaki ders, En başarılı
- LGS'ye kalan hafta göstergesi

### Öğrenci Detay
- Ders planı (37 hafta)
- Kazanım işaretleme
- İlerleme takibi

### Kitap Takip
- Sayfa sayfa işaretleme
- Öğrenci bazlı ilerleme
- Progress bar

### Hata Analizi
- Spider/Radar chart
- Gerçek deneme verileri
- Hata türü sıralama

### Finans
- İç-dış halka grafik
- Tahsilat durumu
- Kalan tutar

---

## 🗂️ Veritabanı Şeması

### IndexedDB Stores

**students** - Öğrenci bilgileri
```javascript
{
  id: string,
  fullName: string,
  school: string,
  grade: '5'|'6'|'7'|'8',
  phone: string,
  parentPhone: string,
  lessonDay: string,
  lessonTime: string,
  lessonDuration: number,
  fee: number,
  photo: base64,
  notes: string,
  schedule: [
    {
      week: number,
      date: string,
      time: string,
      duration: number,
      completed: boolean,
      objectives: [string]
    }
  ],
  createdAt: ISOString,
  updatedAt: ISOString
}
```

**exams** - Deneme sonuçları
```javascript
{
  id: string,
  studentId: string,
  date: string,
  type: 'lgs'|'bursluluk'|'lise',
  subject: string,
  correct: number,
  wrong: number,
  empty: number,
  net: number,
  errors: [
    { type: string, count: number }
  ],
  createdAt: ISOString
}
```

**books** - Kitap takip
```javascript
{
  id: string,
  title: string,
  totalPages: number,
  grade: string,
  coverColor: string,
  progress: {
    [studentId]: {
      currentPage: number,
      completed: boolean,
      lastUpdated: ISOString
    }
  },
  createdAt: ISOString
}
```

**teacher** - Öğretmen bilgisi
```javascript
{
  id: 'current',
  fullName: string,
  password: string,
  createdAt: ISOString
}
```

---

## 🔧 Kullanılan Yardımcı Fonksiyonlar

### `helpers.js`

```javascript
// Net hesaplama (3Y1D)
calculateNet(correct, wrong)

// Tarih formatları
formatDate(date)           // "1 Mart 2026"
formatShortDate(date)      // "01/03"
getDayName(date)           // "Cumartesi"

// Para formatı
formatCurrency(amount)     // "₺2.000"

// Hafta hesaplama
getWeeksUntilLGS()        // LGS'ye kalan hafta
getScheduleWeeks(grade)   // Planlama süresi

// Ders programı
generateLessonSchedule(start, day, time, duration, weeks)

// UI yardımcıları
getInitials(name)         // "AB"
generatePastelColor(id)   // Tailwind class
generateId()              // Benzersiz ID
```

---

## 🎓 Müfredat Yapısı

`curriculum5.json` -> `curriculum8.json` dosyaları:

```json
[
  {
    "week": 1,
    "theme": "Sayılar ve İşlemler",
    "topic": "Çarpanlar ve Katlar",
    "learningOutcomes": [
      "M.8.1.1.1. Verilen pozitif tam sayıların çarpanlarını bulur",
      "M.8.1.1.2. İki doğal sayının EBOB ve EKOK'unu hesaplar"
    ],
    "hours": 4
  }
]
```

---

## 📱 PWA ve Offline Çalışma

### Service Worker
- İlk yükleme cache
- Dinamik cache
- Offline fallback

### Manifest
- Standalone mod
- Primary color: `#2563eb`
- Multiple icon sizes

### IndexedDB
- Tüm veriler local
- Otomatik seed data
- Migration sistemi

---

## 🔐 Güvenlik Notları

⚠️ **Önemli:** Bu prototip uygulamadır.
- Şifreler plain text (hash eklenecek)
- Auth token yok (JWT eklenecek)
- API entegrasyonu yok (backend eklenecek)

Production için:
1. `bcrypt` ile şifre hash
2. JWT authentication
3. HTTPS zorunlu
4. Input validation
5. SQL injection önleme

---

## 🐛 Bilinen Sorunlar

- [ ] Kitap kapak rengi butonları görünmüyor
- [ ] PWA icon boyutları PNG olarak oluşturulmalı
- [ ] Fotoğraf crop özelliği eksik
- [ ] Ödeme takibi simülasyon (gerçek DB gerekli)

---

## 🚀 Gelecek Özellikler (Roadmap)

- [ ] Backend API entegrasyonu
- [ ] Multi-teacher support
- [ ] Öğrenci/Veli paneli
- [ ] WhatsApp bildirim entegrasyonu
- [ ] PDF rapor çıktısı
- [ ] Ödeme takip sistemi
- [ ] Analytics dashboard
- [ ] iOS uygulaması

---

## 📄 Lisans

Bu proje özel bir eğitim projesidir.

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit yapın (`git commit -m 'Add some AmazingFeature'`)
4. Push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın

---

## 📞 İletişim

**Proje:** MathUp  
**Geliştirici:** [GitHub](https://github.com/mfmwebster/MathUp)

---

## 🙏 Teşekkürler

- React Team
- Tailwind Labs
- Chart.js
- Capacitor Team
- Lucide Icons
- IndexedDB Community

---

**💡 Not:** İlk açılışta örnek öğrenciler otomatik yüklenir. Test için kullanabilirsiniz!
" 
