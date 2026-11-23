@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =============================================
echo            SwipeSort - V1.4
echo =============================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js introuvable.
  pause
  exit /b 1
)
node scripts\preparer-version-v1.4.cjs
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Creation du nouvel APK Android via ton compte Expo...
call eas.cmd build -p android --profile preview
if errorlevel 1 (
  echo Compilation interrompue. Copie le message affiche.
  pause
  exit /b 1
)
echo.
echo Ouvre Expo ^> Builds et installe l'APK PAR-DESSUS SwipeSort.
echo NE DESINSTALLE PAS l ancienne version : tes classements sont locaux.
pause
