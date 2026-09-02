@echo off
chcp 65001 >nul
title منصة رفيقي — وضع الإنتاج
echo ============================================
echo   منصة رفيقي — التشغيل بوضع الإنتاج
echo   الرابط المحلي : http://localhost:3001
echo   من هاتف/جهاز آخر في نفس الشبكة:
echo   http://(عنوان هذا الجهاز):3001
echo ============================================

cd /d "%~dp0backend"

:: عنوان الجهاز على شبكة البيت (لعرضه فقط)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo   عنوان الشبكة:%%a

set NODE_ENV=production
node src/index.js
pause