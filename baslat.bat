@echo off
chcp 65001 >nul

echo.
echo  MathUp başlatılıyor...
echo.

REM proje dizinine git
cd /d "%~dp0"

if not exist "node_modules" (
    echo 📦 Paketler kuruluyor ^(ilk sefer^)...
    npm install || (
        echo ❌ Paket kurulumu başarısız oldu.
        pause
        exit /b 1
    )
)

echo 🚀 Sunucu başlatılıyor...
echo 🌐 Tarayıcı otomatik açılacak...
echo ⛔ Kapatmak için: Ctrl+C
echo.
npm run dev
pause
