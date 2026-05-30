@echo off
chcp 65001 > nul
echo.
echo  ╔════════════════════════════════════════╗
echo  ║   PDF to JPEG Migration Tool          ║
echo  ║   กำลังเริ่มเซิร์ฟเวอร์...           ║
echo  ╚════════════════════════════════════════╝
echo.

if not exist "node_modules" (
  echo  [!] ยังไม่ได้ติดตั้ง packages
  echo  กรุณารัน install.bat ก่อน
  pause
  exit /b 1
)

echo  เปิดบราวเซอร์ที่ http://localhost:3004
echo  กด Ctrl+C เพื่อหยุดเซิร์ฟเวอร์
echo.

start "" "http://localhost:3004"
node server.js

pause
