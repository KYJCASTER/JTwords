import pngToIco from 'png-to-ico';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import Jimp from 'jimp';

// Standard Windows icon sizes (include 256 for high DPI)
const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  const src = 'icon.png';
  try { const st = statSync(src); if (!st.isFile()) throw new Error(); } catch { console.error('[icon] 源文件 icon.png 不存在'); process.exit(1); }
  if (!existsSync('build')) mkdirSync('build');
  const img = await Jimp.read(src);
  const bufs = [];
  for (const size of SIZES) {
    const clone = img.clone().resize(size, size, Jimp.RESIZE_BILINEAR);
    const b = await clone.getBufferAsync(Jimp.MIME_PNG);
    bufs.push(b);
  }
  const ico = await pngToIco(bufs);
  writeFileSync('build/icon.ico', ico);
  console.log('[icon] 已生成多尺寸 ICO: 尺寸', SIZES.join(','), ' 总字节', ico.length);
}
main().catch(e => { console.error('[icon] 失败', e); process.exit(1); });
