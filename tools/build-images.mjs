#!/usr/bin/env node
// Converts the original apartment photos into responsive AVIF + WebP files.
//
// Usage: node tools/build-images.mjs <photo folder> [--force]
//
// <photo folder> contains the folders "Auswahl_15" and "Alle Bilder" with the original photos.
// Photos that were already converted are skipped unless --force is given.
//
// - Applies the EXIF orientation and strips all metadata (incl. GPS position).
// - Writes site/assets/img/wohnung/<slug>-<width>.{avif,webp}.
// - Writes site/assets/img/og.jpg (social media preview, 1200x630).
// - Writes tools/image-manifest.json with the size and a placeholder color per photo (used in index.html).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'site/assets/img/wohnung');
const WIDTHS = [480, 800, 1200, 1600, 2400];

// Source photo (relative to the photo folder given on the command line) -> name on the website.
// The order is the order of the gallery.
const PHOTOS = [
  ['Auswahl_15/01_Wohnkueche_Ueberblick.jpg', 'wohnkueche'],
  ['Auswahl_15/02_Kueche.jpg', 'kueche'],
  ['Auswahl_15/03_Kuecheninsel_Bar.jpg', 'kuecheninsel-bar'],
  ['Auswahl_15/04_Kuecheninsel_TV.jpg', 'kuecheninsel-tv'],
  ['Alle Bilder/IMG_0197.JPG', 'kuechenzeile'],
  ['Alle Bilder/IMG_0198.JPG', 'tresen-fenster'],
  ['Auswahl_15/07_Wohnbereich_Sofa.jpg', 'sofa'],
  ['Alle Bilder/IMG20261008164314.jpg', 'sofa-ecke'],
  ['Alle Bilder/IMG20261008170048.jpg', 'wohnbereich'],
  ['Alle Bilder/IMG_0202.JPG', 'fensterbank'],
  ['Auswahl_15/08_Schlafzimmer.jpg', 'schlafzimmer'],
  ['Auswahl_15/09_Schlafzimmer_Fenster.jpg', 'schlafzimmer-fenster'],
  ['Alle Bilder/IMG20261008170618.jpg', 'schlafzimmer-schrank'],
  ['Alle Bilder/IMG20261008170826.jpg', 'schlafzimmer-tuer'],
  ['Auswahl_15/10_Bad_Waschtisch_Dusche.jpg', 'bad'],
  ['Auswahl_15/11_Bad_Fensterseite.jpg', 'bad-fenster'],
  ['Auswahl_15/12_Dusche.jpg', 'dusche'],
  ['Alle Bilder/IMG20261008163925.jpg', 'bad-waschtisch'],
  ['Alle Bilder/IMG_0196.JPG', 'waschbecken'],
  ['Auswahl_15/15_Flur_Garderobe.jpg', 'flur'],
  ['Alle Bilder/IMG_0188.JPG', 'garderobe'],
  ['Auswahl_15/14_Ausblick_Kirche.jpg', 'ausblick'],
  ['Alle Bilder/IMG_0207.JPG', 'ausblick-gasse'],
  ['Alle Bilder/IMG_0216.JPG', 'ausblick-fenster'],
];
const OG_SOURCE = 'wohnkueche';

async function main() {
  const srcDir = process.argv[2] && !process.argv[2].startsWith('--') && resolve(process.argv[2]);
  if (!srcDir) throw new Error('Usage: node tools/build-images.mjs <photo folder> [--force]');
  const force = process.argv.includes('--force');
  await mkdir(outDir, { recursive: true });

  const manifestFile = join(root, 'tools/image-manifest.json');
  const previous = existsSync(manifestFile) ? JSON.parse(await readFile(manifestFile, 'utf8')) : {};
  const manifest = {};

  for (const [file, slug] of PHOTOS) {
    if (!force && previous[slug] && existsSync(join(outDir, `${slug}-${previous[slug].widths.at(-1)}.avif`))) {
      manifest[slug] = previous[slug];
      continue;
    }
    const input = sharp(join(srcDir, file)).rotate();
    const { info } = await input.clone().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
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

  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
