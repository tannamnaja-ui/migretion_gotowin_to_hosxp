const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

async function main() {
  const size = 256;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // พื้นหลังสีน้ำเงินม่วง
  ctx.fillStyle = '#1e40af';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // วงกลมชั้นใน
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 20, 0, Math.PI * 2);
  ctx.fill();

  // ตัวอักษร M
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.55}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', size / 2, size / 2 + 8);

  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const buf = await canvas.encode('png');
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), buf);
  console.log('✅ สร้าง icon.png สำเร็จ');
}

main().catch(console.error);
