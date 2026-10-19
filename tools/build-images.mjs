#!/usr/bin/env node
// Converts the original apartment photos into responsive AVIF + WebP files.
//
// Usage: node tools/build-images.mjs <folder with the original photos>
//
// - Applies the EXIF orientation and strips all metadata (incl. GPS position).
// - Writes site/assets/img/tour/<slug>-<width>.{avif,webp}.
// - Writes site/assets/img/og.jpg (social media preview, 1200x630).
// - Writes tools/image-manifest.json with the size and a placeholder color per photo (used in index.html).

import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'site/assets/img/tour');
const WIDTHS = [480, 800, 1200, 1600, 2400];

// Original file name (without number prefix) -> slug used on the website.
const PHOTOS = {
  Flur_Garderobe: 'flur',
  Wohnkueche_Ueberblick: 'wohnkueche',
  Kueche: 'kueche',
  Kuecheninsel_Bar: 'kuecheninsel-bar',
  Kuecheninsel_TV: 'kuecheninsel-tv',
  Kueche_Spuele: 'kueche-spuele',
  Kaffee_Ecke: 'kaffee-ecke',
  Wohnbereich_Sofa: 'sofa',
  Schlafzimmer: 'schlafzimmer',
  Schlafzimmer_Fenster: 'schlafzimmer-fenster',
  Bad_Waschtisch_Dusche: 'bad',
  Bad_Fensterseite: 'bad-fenster',
  Dusche: 'dusche',
  Ausblick_Kirche: 'ausblick',
};
const OG_SOURCE = 'wohnkueche';

async function main() {
  const srcDir = process.argv[2] && resolve(process.argv[2]);
  if (!srcDir) throw new Error('Usage: node tools/build-images.mjs <folder with the original photos>');
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(srcDir)).filter((f) => /\.jpe?g$/i.test(f));
  const manifest = {};

  for (const file of files) {
    const key = file.replace(/^\d+_/, '').replace(/\.jpe?g$/i, '');
    const slug = PHOTOS[key];
    if (!slug) {
      console.warn('Skipping (not mapped):', file);
      continue;
    }
    const input = sharp(join(srcDir, file)).rotate();
    const { width, height } = await input.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
    const { dominant } = await input.clone().resize(64).stats();
    const color = `#${[dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

    const widths = WIDTHS.filter((w) => w < width).concat(width <= WIDTHS.at(-1) ? [width] : []);
    for (const w of widths) {
      const resized = input.clone().resize({ width: w, withoutEnlargement: true });
      await resized.clone().avif({ quality: 52, effort: 6 }).toFile(join(outDir, `${slug}-${w}.avif`));
      await resized.clone().webp({ quality: 74, effort: 6 }).toFile(join(outDir, `${slug}-${w}.webp`));
    }
    manifest[slug] = { width, height, color, widths };
    console.log(`${slug}: ${width}x${height} -> ${widths.join(', ')}`);

    if (slug === OG_SOURCE) {
      await input
        .clone()
        .resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(join(root, 'site/assets/img/og.jpg'));
    }
  }

  await writeFile(join(root, 'tools/image-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
