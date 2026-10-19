# Ferienwohnung Altstadt Weißenburg

Website der Ferienwohnung in der Pfarrgasse 3 in der Altstadt von Weißenburg in Bayern.
Die Seite stellt die Wohnung vor und nennt den Kontakt zum Gastgeber, gebucht wird nicht über die Website.

Beim Scrollen fliegt die Kamera aus der Vogelperspektive über die Altstadt bis zum Haus, öffnet die "Tür" und führt dann Raum für Raum durch die Wohnung.
Danach folgen Ausstattung, Lage und Kontakt.

## Aufbau

Die Website ist rein statisch (HTML, CSS, JavaScript) und braucht keinen Build-Schritt.
Alles, was ausgeliefert wird, liegt im Ordner `site/`.

```
site/
  index.html              Startseite mit Anflug, Rundgang, Ausstattung, Lage, Kontakt
  impressum.html
  datenschutz.html
  _headers                Cache- und Sicherheits-Header für Cloudflare
  assets/
    css/main.css          Gestaltung (mobile first)
    js/boot.js            schaltet die Scroll-Animation ein (nicht bei "Bewegung reduzieren")
    js/main.js            Scroll-Szenen, Rundgang-Fortschritt, "Rundgang starten"
    js/map.js             3D-Karte und Kamerafahrt
    data/altstadt.json    Kartendaten (aus OpenStreetMap erzeugt)
    img/tour/             Fotos in mehreren Größen (AVIF + WebP)
    img/altstadtplan.svg  Plan für den Abschnitt "Lage"
    fonts/                Schriften Fraunces und Figtree (selbst gehostet)
    vendor/maplibre-gl/   Kartenbibliothek MapLibre GL JS
tools/                    Skripte für Bilder, Kartendaten und den lokalen Server
```

Schriften, Karte und Bibliothek werden selbst gehostet.
Die Seite lädt also nichts von Google oder anderen Drittanbietern, setzt keine Cookies und braucht kein Cookie-Banner.

## Lokal ansehen

Voraussetzung ist Node.js 20 oder neuer.

```bash
npm install
```

```bash
npm run dev
```

Danach ist die Seite unter http://localhost:4321 erreichbar.
Der lokale Server liefert dieselben Header wie Cloudflare aus (aus `site/_headers`).

## Veröffentlichen auf Cloudflare

Variante A, Cloudflare Workers (empfohlen): Das GitHub-Repository in Cloudflare unter "Workers & Pages" verbinden.
Die Datei `wrangler.jsonc` sorgt dafür, dass der Ordner `site/` ausgeliefert wird, ein Build-Befehl ist nicht nötig.

Variante B, Cloudflare Pages: Repository verbinden, Build-Befehl leer lassen und als Ausgabeverzeichnis `site` eintragen.

Die eigene Domain wird anschließend in Cloudflare beim Projekt hinterlegt.

## Inhalte ändern

Texte stehen direkt in `site/index.html`.
Jeder Raum des Rundgangs ist dort ein eigener Abschnitt (`<section class="scene ...">`).

Fotos austauschen oder ergänzen:

1. Originalfotos in einen Ordner legen und im Skript `tools/build-images.mjs` in der Liste `PHOTOS` einem Namen zuordnen.
2. Bilder erzeugen (der Pfad zeigt auf den Ordner mit den Originalen):

```bash
node tools/build-images.mjs ../Auswahl_15
```

Das Skript dreht die Bilder richtig, entfernt GPS- und Kameradaten und schreibt AVIF- und WebP-Dateien in fünf Größen nach `site/assets/img/tour/`.

Kartendaten neu erzeugen (z. B. wenn sich in OpenStreetMap etwas geändert hat):

```bash
node tools/build-map-data.mjs --refresh
```

Ohne `--refresh` wird der zwischengespeicherte Stand aus `tools/.cache/` verwendet.
Das Skript schreibt `site/assets/data/altstadt.json` und `site/assets/img/altstadtplan.svg` und gibt die Positionen der Pins für den Plan aus.

## Noch offen

- E-Mail-Adresse des Gastgebers (Kontaktbereich, Impressum).
- Anschrift des Gastgebers für Impressum und Datenschutzerklärung (Pflichtangabe).
- Impressum und Datenschutzerklärung vor der Veröffentlichung prüfen lassen.
- Sobald die Domain feststeht: absolute Adresse für das Vorschaubild (`og:image`) eintragen, damit geteilte Links ein Bild zeigen.

Fehlende Angaben sind auf der Seite gelb gestrichelt markiert (`class="todo"`).

## Lizenzen und Quellen

- Kartendaten © OpenStreetMap-Mitwirkende, ODbL. Der Hinweis steht auf der Karte und im Plan.
- MapLibre GL JS, BSD-3-Clause (`site/assets/vendor/maplibre-gl/LICENSE.txt`).
- Schriften Fraunces und Figtree, SIL Open Font License (`site/assets/fonts/`).
- Angaben zum Haus (ehemaliges Pfarrwitwenhaus, 1744 bis 1746, Baudenkmal D-5-77-177-330) aus der Bayerischen Denkmalliste bzw. Wikidata.
