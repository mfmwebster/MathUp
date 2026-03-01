# 📱 MathUp - APK Build Kılavuzu

## 🚀 Capacitor Kurulumu ve APK Oluşturma

### 1. Gerekli Bağımlılıkları Yükle

```powershell
# Capacitor core ve CLI
npm install @capacitor/core @capacitor/cli

# Android platformu
npm install @capacitor/android

# Kamera eklentisi (fotoğraf çekme için)
npm install @capacitor/camera

# (Opsiyonel) Diğer eklentiler
npm install @capacitor/splash-screen @capacitor/status-bar
```

### 2. Build ve Sync

```powershell
# Önce web uygulamasını build et
npm run build

# Capacitor yapılandırmasını başlat (ilk kez)
npx cap init

# Android projesini oluştur (ilk kez)
npx cap add android

# Build'i Android'e sync et
npx cap sync android
```

### 3. Android Studio ile APK Oluştur

```powershell
# Android Studio'yu aç
npx cap open android
```

Android Studio'da:
1. **Build → Generate Signed Bundle / APK**
2. **APK** seçeneğini seç
3. Keystore oluştur veya mevcut olanı kullan
4. **release** build type'ı seç
5. Build tamamlandığında APK: `android/app/build/outputs/apk/release/`

### 4. Keystore Oluşturma (İlk Kez)

```powershell
# Java keytool ile keystore oluştur
keytool -genkey -v -keystore mathup-release.keystore -alias mathup -keyalg RSA -keysize 2048 -validity 10000
```

Bilgileri gir:
- **Alias:** mathup
- **Password:** (güvenli bir şifre)
- **Name, Organization, etc.** bilgilerini doldur

### 5. Hızlı Update (Değişiklik Sonrası)

```powershell
# Her kod değişikliğinden sonra:
npm run build
npx cap sync android
# Ardından Android Studio'da Run
```

---

## 📦 Otomatik Build Script (Windows)

`build-apk.bat` dosyası kullanımı:

```powershell
# Normal build
.\build-apk.bat

# Capacitor yeniden kurulumu ile
.\build-apk.bat --reinstall
```

---

## 🔧 Sorun Giderme

### Gradle Build Hatası
```powershell
cd android
.\gradlew clean
cd ..
npx cap sync android
```

### Clear Cache
```powershell
npm run build
npx cap sync android --inline
```

### Android SDK Yolu Hatası
`android/local.properties` dosyasına ekle:
```
sdk.dir=C\:\\Users\\[KULLANICI]\\AppData\\Local\\Android\\Sdk
```

---

## 📱 Kamera Özelliği için İzinler

`android/app/src/main/AndroidManifest.xml` dosyasına ekle:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
```

---

## 🎨 App Icon ve Splash Screen

### Icon:
1. 512x512 PNG oluştur
2. [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/) kullan
3. Çıktıyı `android/app/src/main/res/` klasörüne kopyala

### Splash Screen:
1. 2732x2732 PNG oluştur (merkezi logo)
2. `android/app/src/main/res/drawable/splash.png` olarak kaydet

---

## 📝 Release Checklist

- [ ] `package.json` version güncelle
- [ ] Build yap: `npm run build`
- [ ] Sync: `npx cap sync android`
- [ ] Android Studio'da test et
- [ ] Release APK oluştur (signed)
- [ ] APK'yı test cihazda dene
- [ ] Google Play Store'a yükle (opsiyonel)

---

## 🆘 Yardım

Sorun yaşarsan:
1. `npm run build` çalıştırıldı mı?
2. `npx cap sync` yapıldı mı?
3. Android Studio güncel mi? (Giraffe veya üzeri)
4. Java JDK 11+ yüklü mü?
