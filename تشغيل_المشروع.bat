@echo off
chcp 65001 >nul
title تشغيل بوابة رفيقي للحياة المدرسية

echo ==============================================
echo   جاري تشغيل الخادم (Backend)...
echo ==============================================
start "Backend - لا تغلق هذه النافذة" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak >nul

echo ==============================================
echo   جاري تشغيل الواجهة (Frontend)...
echo ==============================================
start "Frontend - لا تغلق هذه النافذة" cmd /k "cd /d %~dp0frontend && npm run dev"

echo ==============================================
echo   جاري فتح المتصفح خلال 6 ثوانٍ...
echo ==============================================
timeout /t 6 /nobreak >nul

start http://localhost:5173

echo تم! يمكنك إغلاق هذه النافذة فقط (وليس نوافذ Backend و Frontend).
pause
