@echo off
chcp 65001 > nul
echo.
echo  ╔════════════════════════════════════════╗
echo  ║   PDF to JPEG Migration Tool          ║
echo  ║   ติดตั้ง Dependencies                ║
echo  ╚════════════════════════════════════════╝
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  [ERROR] ไม่พบ Node.js!
  echo  กรุณาดาวน์โหลดและติดตั้ง Node.js จาก https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER% พร้อมใช้งาน

echo.
echo  กำลังติดตั้ง packages...
echo.
npm install

if errorlevel 1 (
  echo.
  echo  [ERROR] ติดตั้งไม่สำเร็จ กรุณาตรวจสอบข้อผิดพลาดด้านบน
  pause
  exit /b 1
)

echo.
echo  ✅ ติดตั้งสำเร็จ!
echo.
echo  วิธีเริ่มใช้งาน:
echo    1. ดับเบิลคลิก start.bat
echo    2. เปิดบราวเซอร์ไปที่ http://localhost:3004
echo.
pause
