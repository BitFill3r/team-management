---
name: Am Ball
description: Vereinsmitteilung — warmes Papier, grüne Abschnittsbänder und klar gegliederte Listen.
colors:
  green: "#24543e"
  lime: "#edf1da"
  ink: "#20382e"
  muted: "#526157"
  line: "#d5d9cd"
  paper: "#f6f3e9"
  surface: "#fffef9"
  surface-subtle: "#efeee4"
  surface-present: "#e9f1e5"
  control-border: "#7b897e"
  focus: "#86530e"
  danger: "#a12e32"
  error-bg: "#fff0ed"
  error-text: "#862c30"
  error-border: "#c78580"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.5
  navigation:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.5
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  control: "6px"
  panel: "10px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
    height: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "48px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "32px"
  tabs:
    backgroundColor: "{colors.green}"
    rounded: "{rounded.control}"
    padding: "8px"
  pill:
    backgroundColor: "{colors.surface-subtle}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  participant-present:
    backgroundColor: "{colors.surface-present}"
    textColor: "{colors.ink}"
    padding: "16px 12px"
  action-icon:
    width: "20px"
    height: "20px"
---

# Design System: Am Ball

## Overview

**Creative North Star: "Vereinsmitteilung"**

Die vom Nutzer gewählte Ersatzrichtung verbindet warmes Papier, grüne Abschnittsbänder und ruhig gegliederte Listen. Eine lokale Serifenschrift gibt Überschriften den Charakter einer Vereinsmitteilung; vertraute serifenlose Schrift hält Eingaben und Aufgaben gut lesbar.

Die Oberfläche unterstützt schnelle Anwesenheitserfassung am Handy. Kleine Radien, feine horizontale Linien und flache Flächen ersetzen die frühere weiche Kartenlandschaft. Produkttexte, Abläufe und der Agency-Footer bleiben erhalten.

**Key Characteristics:**
- Warmes Papier mit klar getrennten Inhaltsflächen.
- Grüne Navigationsbänder und gut erkennbare aktive Auswahl.
- Serifische Überschriften, sachliche Formularschrift.
- Gegliederte Teilnehmer- und Antwortlisten statt verschachtelter Karten.

## Colors

Die semantischen CSS-Variablen in [globals.css](./src/app/globals.css) sind die Implementierungsquelle. Frontmatter dokumentiert ihre Werte; neue Oberflächen verwenden dieselben Variablen.

### Primary
- `green`: Aktionen, Navigation, Links, Auswahl.
- `lime`: helle Schriftfläche der AB-Marke.

### Neutral
- `paper`: warmes Seitenpapier.
- `surface`: helle Inhalts- und Formularfläche.
- `surface-subtle`: ruhige Gruppierung, Tabellenköpfe und sekundäre Aktionen.
- `ink` und `muted`: Haupt- und Hilfstexte.
- `line`: Strukturgrenzen; `control-border`: sichtbare Eingaberahmen.

`surface-present` unterstützt Anwesenheit, aber ersetzt kein Häkchen. Fehler verwenden `error-text`, `error-bg` und `error-border`; destruktive Aktionen `danger`. Fokus bleibt bernsteinfarben und deutlich sichtbar.

## Typography

Source Serif 4 wird in [layout.tsx](./src/app/layout.tsx) lokal über `next/font/local`, `--font-heading` und `display: swap` eingebunden. [source-serif-4.ttf](./public/fonts/source-serif-4.ttf) und [SIL OFL 1.1](./public/fonts/OFL.txt) liegen im Projekt; keine Laufzeit-Anfrage an einen externen Fontdienst.

h1/h2 verwenden die Serifenschrift, Gewicht 650, moderate negative Laufweite und balancierten Umbruch. Login-h1 ist 3rem; öffentliche Umfragen verwenden `clamp(1.8rem, 6vw, 2.8rem)`.

Formulare und Fließtext bleiben Arial/Helvetica/sans-serif bei 16px und 1.5 Zeilenhöhe. Wiederkehrende Hilfstexte, Labels und Footer verwenden `--text-small` (0.875rem); mobile Navigation ebenfalls.

Absätze sind auf 72ch begrenzt. Monatsübersicht, Anwesenheitssumme und Umfragezählungen verwenden tabellarische Ziffern. Lange Namen und Umfrageantworten umbrechen.

## Layout

Teamcontainer: 1040px maximal, volle verfügbare Breite, 32px seitliches Padding. Karten: 32px Padding. Der Kopfbereich bleibt kompakter als die alte Hero-Fläche. Navigation bildet ein zusammenhängendes grünes Band.

Bis 680px: 16px Containerpadding, 24px 16px Kartenpadding, zweizeilige Navigation und einspaltige Teilnehmerliste. Verwaltungsformulare ordnen sich vertikal an. Speicherhinweise dürfen umbrechen.

Teilnehmerliste: zwei Spalten auf Desktop, einspaltig auf Mobile; horizontale Trennlinien statt Einzelkarten. Öffentliche Umfragen sind maximal 740px breit. Login nutzt eine maximal 460px breite Mitteilungsfläche.

Body ist ein vertikales Flexlayout mit mindestens 100dvh. Footer folgt dem Inhalt und bleibt auf kurzen Seiten unten, ohne Inhalte zu überdecken. Monatsübersichten scrollen intern horizontal mit stehender Namensspalte. Kalenderdialog bleibt viewportbegrenzt und intern scrollbar.

Monatsnavigation: natives `input[type="month"]` zwischen separaten Pfeilbuttons; Feldgruppe sonst maximal 240px breit. Bis einschließlich 380px steht das beschriftete Feld ohne Maximalbreite über den Pfeilen und nutzt die volle Zeile; beide Pfeilbuttons teilen die nächste Zeile gleichmäßig. Der Kalenderdialog hat am selben Breakpoint eigenes kompaktes Padding (10px 4px); seine Monats-/Jahresselects bleiben getrennt.

## Elevation & Depth

Flächen und Linien vermitteln Tiefe; Hauptkarten und Tabs verwenden keine Schatten. Kalenderbackdrop `#20382e66` trennt den fokussierten Dialog ab. Kein dekorativer Loginverlauf oder schwebender Badge.

## Shapes

`--radius-control`: 6px für Schaltflächen, Eingaben, Markenfeld und Gruppen. `--radius-panel`: 10px für Hauptflächen und Kalender. Teilnehmerzeilen, Antwortlisten und Umfragefeldgruppen sind linear gegliedert, nicht gerundete Innenkarten.

## Components

### Buttons / Fields

Gemeinsame Kontrolle über `--control-height` (48px Mindesthöhe), `--radius-control` und `--control-border` aus `globals.css`. Die Frontmatter-Höhe beschreibt dieses Minimum, keine feste Höhe. Primär dunkelgrün, sekundär zurückhaltend mit sichtbarem Rahmen. Eingaben, die implementierten Selects und Textareas teilen Schrift, Farben und Fokus; Textareas beginnen bei 100px und sind vertikal skalierbar. Checkboxen bleiben bewusst kleiner (26px Anwesenheit, 24px Umfragen) innerhalb ihrer beschrifteten Ziele. Placeholder sind explizit `muted`, nicht browserabhängig aufgehellt.

Hover: bestehendes `brightness(.93)`; Disabled: Opazität .48 und korrekter Cursor. Disabled ist kein Erfolgszustand.

### ActionIcon

[ActionIcon](./src/components/action-icon.tsx) ist die gemeinsame SVG-Komponente für links, rechts und schließen: 20×20px, `viewBox="0 0 24 24"`, kein Fill, `currentColor`, Strichstärke 2, runde Enden und Verbindungen. Monatsübersicht, Kalenderdialog und Entfernen von Umfrageoptionen verwenden sie. SVGs sind `aria-hidden` und nicht fokussierbar; der umgebende Button trägt den zugänglichen Aktionsnamen. Keine Schriftglyphen als Ersatz für diese Aktionen. Tabellenzeichen und Kalendermarker bleiben textliche Statuszeichen mit Legende und zugänglichem Status.

### Navigation / Panels

Grünes Band mit heller aktiver Schaltfläche. Mobile-Umbruch bleibt lesbar und ohne horizontales Seitenscrollen. Hauptflächen haben feine Rahmen; Abschnittsköpfe trennen Aufgaben durch eine horizontale Linie.

### Attendance / Surveys

Teilnehmerzeile als großes Checkbox-Ziel. Anwesend: zusätzliches Häkchen, helle grüne Fläche und dunkles Initialenfeld. Antworten und Feldgruppen verwenden horizontale Grenzen. Bestätigte Speicherung, Fehler und Netzunsicherheit bleiben textlich sichtbar.

### Focus / Motion / Footer

Fokus: 3px `--focus` Outline mit 3px Abstand. Textselektion, Caret und Scrollbar beziehen Farben aus derselben Palette. Einziger bestehender Übergang: Teilnehmerhintergrund 0.15s; unter `prefers-reduced-motion` deaktiviert.

Agency-Footer mit bestätigtem Wortlaut, unterstrichenem Link und abgesichertem neuen Tab bleibt global.

Nicht kanonisiert oder repariert: die dekorativen versalen Kontextzeilen bleiben eine Altlast, keine Typografieregel. Einzelne unsemantische Literale (Warnhinweise, Progress-Track, weiße Kalenderauswahl) bleiben dokumentierte Token-Drift statt neuer Paletteneinträge. Diese reine Dokumentationsrunde ändert keinen App-Code; die 18 synthetischen Review-Captures zeigen die letzten Pfeil-/380px-Fixes noch nicht, maßgeblich ist der aktuelle Quellcode.

## Do's and Don'ts

### Do:
- **Do** gemeinsame semantische CSS-Tokens für neue Flächen verwenden.
- **Do** schnelle Anwesenheitserfassung und sichtbare Zustände erhalten.
- **Do** Hilfstexte, Fokus, Formulare und Mobile-Umbruch gemeinsam prüfen.
- **Do** neue Gruppen durch Aufgaben und horizontale Linien gliedern.
- **Do** gemeinsame SVG-Aktionen und die zweizeilige Monatsnavigation bis 380px erhalten.

### Don't:
- **Don't** neue Seiten mit dekorativen Innenkarten oder riesigen Hero-Blöcken aufbauen.
- **Don't** Farbe als einzigen Statusindikator verwenden.
- **Don't** Produkttexte oder Passwort-/Datentrennung als Designnebenwirkung ändern.
- **Don't** externe Fonts zur Laufzeit nachladen.
