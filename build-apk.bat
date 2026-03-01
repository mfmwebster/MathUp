@echo off
echo ========================================
echo  MathUp APK Build Script
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [1/5] Installing dependencies...
    call npm install
) else (
    echo [1/5] Dependencies already installed.
)

REM Check if Capacitor is installed
echo [2/5] Checking Capacitor...
if "%1"=="--reinstall" (
    echo Reinstalling Capacitor...
    call npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/camera
)

REM Build the web app
echo [3/5] Building web app...
call npm run build

if %errorlevel% neq 0 (
    echo Build failed! Check errors above.
    pause
    exit /b 1
)

REM Sync with Android
echo [4/5] Syncing with Android...

if not exist "android\" (
    echo Creating Android project...
    call npx cap add android
)

call npx cap sync android

if %errorlevel% neq 0 (
    echo Sync failed! Check Capacitor configuration.
    pause
    exit /b 1
)

REM Open Android Studio
echo [5/5] Opening Android Studio...
echo.
echo ========================================
echo Build completed successfully!
echo.
echo Next steps:
echo 1. Android Studio will open
echo 2. Wait for Gradle sync to complete
echo 3. Build ^> Generate Signed Bundle / APK
echo 4. Select APK ^> Release
echo 5. Sign with your keystore
echo ========================================
echo.

call npx cap open android

pause
