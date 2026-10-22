// Optimisation d'images (nécessite `npm install`, utilise sharp).
//   node scripts/optimize-images.mjs photo <entrée> <nom> <largeur>   -> public/images/<nom>.webp et .avif
//   node scripts/optimize-images.mjs logo  <entrée> <slug>             -> public/banks/<slug>.webp (marges rognées, ≤ 240 px)
// Exemples :
//   npm run images -- photo ~/Downloads/interface.jpg panel 800
//   npm run images -- logo ~/Downloads/nouvelle-banque.png nouvelle-banque
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const [mode, input, name, width] = process.argv.slice(2);
if (!mode || !input || !name) {
  console.error('Usage : voir l’en-tête du fichier.');
  process.exit(1);
}

if (mode === 'photo') {
  mkdirSync('public/images', { recursive: true });
  const w = Number(width) || 1536;
  const base = sharp(input).rotate().resize({ width: w, withoutEnlargement: true });
  await base.clone().webp({ quality: 80 }).toFile(`public/images/${name}.webp`);
  await base.clone().avif({ quality: 55 }).toFile(`public/images/${name}.avif`);
  console.log(`OK public/images/${name}.webp + .avif (${w}px max)`);
} else if (mode === 'logo') {
  mkdirSync('public/banks', { recursive: true });
  await sharp(input).trim({ threshold: 20 }).resize({ width: 240, height: 96, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(`public/banks/${name}.webp`);
  console.log(`OK public/banks/${name}.webp`);
} else {
  console.error('Mode inconnu : photo | logo');
  process.exit(1);
}
