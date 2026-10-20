# Ferienwohnung Altstadt Weißenburg

Website der Ferienwohnung in der Pfarrgasse 3 in der Altstadt von Weißenburg in Bayern.
Die Seite stellt die Wohnung vor und nennt den Kontakt zum Gastgeber, gebucht wird nicht über die Website.

Beim Scrollen fliegt die Kamera aus der Vogelperspektive über die Altstadt bis zum Haus und öffnet die "Tür".
Danach folgen eine Fotogalerie, Ausstattung, Lage sowie Preis und Kontakt.

## Aufbau

Die Website ist rein statisch (HTML, CSS, JavaScript) und braucht keinen Build-Schritt.
Alles, was ausgeliefert wird, liegt im Ordner `site/`.

```
site/
  index.html              Startseite mit Anflug, Galerie, Ausstattung, Lage, Preis & Kontakt
  impressum.html
  datenschutz.html
  _headers                Cache- und Sicherheits-Header für Cloudflare
  assets/
    css/main.css          Gestaltung (mobile first)
    js/boot.js            schaltet die Scroll-Animation ein (nicht bei "Bewegung reduzieren")
    js/main.js            Scroll-Szenen, "Zur Wohnung" (automatischer Flug)
    js/map.js             3D-Karte und Kamerafahrt
    js/gallery.js         Vollbild-Ansicht der Galerie (Wischen, Pfeiltasten)
    data/altstadt.json    Kartendaten (aus OpenStreetMap erzeugt)
    img/wohnung/          Fotos in mehreren Größen (AVIF + WebP)
    img/altstadtplan.svg  Plan für den Abschnitt "Lage"
    fonts/                Schriften Fraunces und Figtree (selbst gehostet)
    vendor/maplibre-gl/   Kartenbibliothek MapLibre GL JS
tools/                    Hilfsskripte für Bilder, Kartendaten und den lokalen Server
                          (mit eigener package.json, nicht Teil der ausgelieferten Seite)
```

Schriften, Karte und Bibliothek werden selbst gehostet.
Die Seite lädt also nichts von Google oder anderen Drittanbietern, setzt keine Cookies und braucht kein Cookie-Banner.

## Lokal ansehen

Voraussetzung ist Node.js 20 oder neuer.
Der lokale Server braucht keine Pakete:

```bash
node tools/serve.mjs
```

Danach ist die Seite unter http://localhost:4321 erreichbar.
Der lokale Server liefert dieselben Header wie Cloudflare aus (aus `site/_headers`).

## Veröffentlichen auf Cloudflare

Im Hauptordner des Repositorys liegt bewusst keine `package.json`.
So installiert Cloudflare beim Deployment keine Pakete, es gibt nichts zu bauen.

Variante A, Cloudflare Pages: Repository verbinden, Framework "None", Build-Befehl leer lassen, Ausgabeverzeichnis `site`, Stammverzeichnis leer lassen.

Variante B, Cloudflare Workers: Repository verbinden, Build-Befehl leer lassen, Deploy-Befehl `npx wrangler deploy`.
Die Datei `wrangler.jsonc` sorgt dafür, dass der Ordner `site/` ausgeliefert wird.

Die eigene Domain wird anschließend in Cloudflare beim Projekt hinterlegt.

## Inhalte ändern

Texte stehen direkt in `site/index.html`.
Jedes Foto der Galerie ist dort ein Eintrag in der Liste `<ul class="gallery">`.

Die Hilfsskripte brauchen einmalig ihre Pakete:

```bash
npm --prefix tools install
```

Fotos austauschen oder ergänzen:

1. Im Skript `tools/build-images.mjs` das Originalfoto in der Liste `PHOTOS` eintragen und ihm einen Namen geben.
2. Bilder erzeugen (der Pfad zeigt auf den Ordner, in dem `Auswahl_15` und `Alle Bilder` liegen):

```bash
node tools/build-images.mjs ..
```

3. In `site/index.html` einen Galerie-Eintrag kopieren und Namen, Maße, Farbe und Beschreibung anpassen (die Werte stehen in `tools/image-manifest.json`).

Das Skript dreht die Bilder richtig, entfernt GPS- und Kameradaten und schreibt AVIF- und WebP-Dateien in fünf Größen nach `site/assets/img/wohnung/`.
Bereits umgewandelte Fotos überspringt es, mit `--force` werden alle neu erzeugt.

Kartendaten neu erzeugen (z. B. wenn sich in OpenStreetMap etwas geändert hat):

```bash
node tools/build-map-data.mjs --refresh
```

Ohne `--refresh` wird der zwischengespeicherte Stand aus `tools/.cache/` verwendet.
Das Skript schreibt `site/assets/data/altstadt.json` und `site/assets/img/altstadtplan.svg` und gibt die Positionen der Pins für den Plan aus.

## Noch offen

- Anschrift des Gastgebers für Impressum und Datenschutzerklärung (Pflichtangabe).
- Impressum und Datenschutzerklärung vor der Veröffentlichung prüfen lassen.
- Sobald die Domain feststeht: absolute Adresse für das Vorschaubild (`og:image`) eintragen, damit geteilte Links ein Bild zeigen.

Fehlende Angaben sind auf der Seite gelb gestrichelt markiert (`class="todo"`).

## Lizenzen und Quellen

- Kartendaten © OpenStreetMap-Mitwirkende, ODbL. Der Hinweis steht auf der Karte und im Plan.
- MapLibre GL JS, BSD-3-Clause (`site/assets/vendor/maplibre-gl/LICENSE.txt`).
  Die Dateien stammen aus `tools/node_modules/maplibre-gl/dist/` und werden bei einem Update von dort kopiert.
- Schriften Fraunces und Figtree, SIL Open Font License (`site/assets/fonts/`).
- Angaben zum Haus (ehemaliges Pfarrwitwenhaus, 1744 bis 1746, Baudenkmal D-5-77-177-330) aus der Bayerischen Denkmalliste bzw. Wikidata.
