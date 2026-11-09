---
name: Am Ball
description: Ruhige, freundliche und praktische Trainingsverwaltung am Spielfeldrand.
colors:
  green: "#176348"
  lime: "#d3ef86"
  ink: "#173c34"
  muted: "#597067"
  line: "#e0e7e0"
  paper: "#f5f6ef"
  white: "#ffffff"
  focus: "#aa6b16"
  input-border: "#b6c8bc"
  secondary-bg: "#f3f5ef"
  tabs-bg: "#e9ede4"
  present-bg: "#f0f7e9"
  present-border: "#9ebb85"
  danger: "#a52e32"
  error-text: "#8d292d"
  error-bg: "#fff1ef"
  error-border: "#e8bbb5"
  pill-bg: "#edf3e6"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "clamp(2.4rem, 6vw, 3.8rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1.8rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1.06rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  field: "10px"
  button: "12px"
  participant: "14px"
  tabs: "15px"
  card-mobile: "18px"
  pill: "20px"
  card: "22px"
spacing:
  gap-small: "8px"
  gap: "12px"
  inset-mobile: "16px"
  section: "24px"
  card: "30px"
  inset-desktop: "32px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  button-secondary:
    backgroundColor: "{colors.secondary-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    width: "100%"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "30px"
  tabs:
    backgroundColor: "{colors.tabs-bg}"
    rounded: "{rounded.tabs}"
    padding: "5px"
  pill:
    backgroundColor: "{colors.pill-bg}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  participant:
    backgroundColor: "transparent"
    rounded: "{rounded.participant}"
    padding: "15px"
  participant-present:
    backgroundColor: "{colors.present-bg}"
    rounded: "{rounded.participant}"
    padding: "15px"
---

# Design System: Am Ball

## Overview

**Creative North Star: "Am Spielfeldrand"**

Ruhig, freundlich und praktisch; klare Aufgaben statt dekorativer Inszenierung. Die bestehende Oberfläche verbindet dunkles Grün, helle papierartige Flächen und eine vertraute serifenlose Schrift mit griffigen, unkomplizierten Bedienelementen.

Große Schaltflächen, gerundete Karten und klar beschriftete Felder prägen das System. Es bleibt überwiegend flach: helle Flächen und Linien strukturieren die App; sehr dezente Schatten unterstützen Karten und aktive Tabs, nicht schwebende Effekte.

**Key Characteristics:**
- Dunkelgrüne Aktionen auf hellen Flächen.
- Gerundete, gut erkennbare Bedienelemente.
- Klare Rückmeldungen für Anwesenheit, Speicherung und Fehler.
- Einspaltige Teilnehmerliste auf dem Handy.

Dokumentierter Iststand aus [globals.css](./src/app/globals.css), den bestehenden Komponenten und einer Stichprobe berechneter Styles der deployten Loginseite. Keine Umgestaltung und kein Qualitätsaudit; nicht jede deklarierte Kleinschrift ist eine allgemeine Empfehlung für neue Inhalte.

## Colors

Die Palette verbindet Spielfeldgrün mit Limette und hellen, leicht grünlichen Neutralflächen.

### Primary
- **Spielfeldgrün** (`green`): primäre Aktionen, ausgewählte Kalendertage, Anwesenheit und Footer-Link.
- **Limette** (`lime`): Schrift im dunklen AB-Markenfeld; kein allgemeiner Aktionshintergrund.

### Neutral
- **Dunkle Tinte** (`ink`): Haupttext.
- **Gedämpftes Grün** (`muted`): Hilfstexte, ungewählte Tabs und Footer.
- **Papier** (`paper`): Seitenhintergrund.
- **Weiß** (`white`): Karten, Eingaben und aktive Tabs.
- **Trennlinie** (`line`): Rahmen und Abschnittsgrenzen.

Anwesenheit verwendet `present-bg` und `present-border`. Fehler verwenden `error-text`, `error-bg` und `error-border`; destruktive Aktionen `danger`. Die bernsteinfarbene Fokusmarkierung (`focus`) bleibt unabhängig vom Aktionsgrün sichtbar. Weitere lokale Farbabstufungen stehen im Stylesheet; sie sind keine zusätzliche globale Palette.

Die Farbrampen im Sidecar sind synthetische Vorschauen für Spielfeldgrün, Limette und Papier, keine im App-Code implementierten Farbskalen. Maßgeblich bleiben die oben extrahierten Farbwerte.

## Typography

**Display Font / Body Font:** Arial, Helvetica, sans-serif. Keine extern geladenen Schriftdateien.

Die Hierarchie entsteht durch Größe, Gewicht und kompakte Überschriftenlaufweite, nicht durch einen Schriftwechsel.

### Hierarchy
- **Display:** globale h1 nach Frontmatter; Login überschreibt die Größe mit `3.4rem`, öffentliche Umfragen mit `clamp(1.8rem, 6vw, 2.8rem)`.
- **Headline:** h2 nach Frontmatter.
- **Title:** h3 nach Frontmatter.
- **Body:** 16px, Zeilenhöhe 1.5.
- **Label:** 0.88rem und fett. Lokale Formularlabels und Hilfstexte sind teilweise kleiner.
- **Eyebrow:** 0.68rem, Gewicht 700, Laufweite 0.14em.
- **Brand:** 1.4rem, Gewicht 800, Laufweite -0.06em.

Footer und Hinweise verwenden meist 0.75-0.8rem. Diese Werte beschreiben den Bestand; sie ersetzen keine Kontrast- oder Lesbarkeitsprüfung.

## Layout

Die Teamansicht nutzt einen maximal 1000px breiten, zentrierten Container mit 32px seitlichem Padding. Kopfzeile und Abschnittsköpfe verteilen Inhalte per Flexbox. Teilnehmer stehen in zwei gleich breiten Spalten mit 12px Abstand.

Bis 680px: Containerpadding 16px; Kartenpadding 20px 16px; Kartenradius 18px. Teilnehmer stehen einspaltig mit 10px Abstand und mindestens 74px Zeilenhöhe statt 80px. Die Tabs umbrechen auf zwei Schaltflächen pro Zeile; Verwaltungsformulare und Kartenabschluss ordnen sich vertikal an.

Der Loginbereich ist mindestens 100dvh hoch und zentriert seine maximal 430px breite Karte. Der globale Agency-Footer folgt im normalen Dokumentfluss und ist nicht fixiert. Öffentliche Umfragen nutzen einen maximal 700px breiten Container mit 32px 16px Padding.

Der Kalenderdialog ist höchstens 420px breit, lässt 16px Außenabstand und begrenzt seine Höhe auf `calc(100dvh - 16px)` mit internem Scrollen. Bis 380px reduziert sich das Innenpadding auf 10px 4px. Die Monatsübersicht scrollt bei Bedarf horizontal, während die Namensspalte links stehen bleibt.

## Elevation & Depth

Überwiegend flach: helle Flächen und Linien strukturieren die App; sehr dezente Schatten unterstützen Karten und aktive Tabs, nicht schwebende Effekte.

### Shadow Vocabulary
- **Karte:** `0 8px 25px #173c3404`.
- **Aktiver Tab:** `0 2px 6px #173c3410`.

Der Kalender trennt sich durch einen Backdrop `#173c3466` ab. Der Loginhintergrund verwendet einen radialen Verlauf von `#e1ebd6` nach transparent. Beides sind bestehende lokale Behandlungen, keine universellen Hintergrundrezepte.

## Shapes

Buttons: 12px Radius; Eingaben: 10px; Teilnehmerzeilen: 14px; Karten: 22px beziehungsweise 18px auf Mobile. Die meisten Rahmen sind 1px stark.

Die AB-Marke ist ein gerundetes 60px-Quadrat, um -5 Grad gedreht; die kleine Kopfzeilenvariante misst 36px. Das Mannschaftsabzeichen ist eine gerundete Schildform mit 7 Grad Drehung. Avatare sind kreisförmig und 42px groß.

## Components

### Buttons

Griffig und unkompliziert. Primär grün mit weißer, fetter Schrift, mindestens 46px hoch, Padding 11px 18px. Sekundär mit hellem Hintergrund und sichtbarem Rahmen; Textbuttons transparent. Hover nutzt `brightness(.93)`, sofern nicht deaktiviert. Disabled nutzt Opazität .48 und einen nicht erlaubten Cursor.

### Inputs / Fields

Weiße Fläche, Rahmen `input-border`, mindestens 48px hoch. Labels stehen darüber. Deaktivierte Texteingaben verwenden `#f0f3ee`. Checkboxen der Anwesenheit sind 26px groß; Formularcheckboxen in Umfragen 24px. Textarea und Select übernehmen Schrift und grüne Textfarbe.

### Cards / Containers

Weiße Fläche mit feinem Rahmen, stark gerundeten Ecken und sehr schwachem Schatten. Standardpadding 30px; die Loginkarte überschreibt auf 36px, auf Mobile auf 28px. Fehlermeldungen und Löschbestätigungen sind explizit rote/rosafarbene Flächen.

### Navigation

Tabs sitzen in einer hellgrünen gerundeten Leiste. Der aktive Tab ist weiß mit dunkler Schrift und leichtem Schatten. Mobile-Tabs umbrechen; die Marken-Kopfzeile bleibt mit einer feinen Linie vom Inhalt getrennt.

### Chips

Pills sind hellgrün, nicht automatisch interaktiv und mit `white-space: nowrap` gesetzt. Namens-Chips und Umfragezählungen umbrechen als Flexliste und nutzen gerundete Rechtecke.

### Attendance

Die gesamte beschriftete Teilnehmerzeile dient als Checkbox-Ziel. Anwesende Zeilen bekommen zusätzlich zum Häkchen einen hellgrünen Hintergrund und stärkeren grünen Rahmen. Speicherzustand und Fehler bleiben textlich erkennbar.

### Calendar / Overview

Kalendertage sind mindestens 48px hoch; Auswahl ist dunkelgrün, heute umrahmt und vorhandenes Training durch einen Punkt markiert. Tastaturbedienung und Fokuswiederherstellung gehören zum vorhandenen Verhalten. Die Verlaufstabelle unterscheidet anwesend, nicht anwesend und nicht zugeordnet durch unterschiedliche Zeichen.

### Focus / Footer

Globaler `:focus-visible`: 3px bernsteinfarbener Outline mit 3px Abstand. Der Agency-Footer bleibt auf allen Seiten mit dem in [PRODUCT.md](./PRODUCT.md) bestätigten Wortlaut; der Link ist unterstrichen, grün und öffnet abgesichert in einem neuen Tab.

## Do's and Don'ts

### Do:
- **Do** Aktionsgrün, Anwesenheit und Fehlerzustände entsprechend ihren bestehenden Rollen verwenden.
- **Do** Fokus, Beschriftungen und textliche Speicherzustände erhalten.
- **Do** Mobile-Umbruch und internes Tabellen-/Dialogscrollen berücksichtigen.
- **Do** den bestätigten Agency-Footer erhalten.

### Don't:
- **Don't** Anwesenheit oder Fehler ausschließlich durch Farbe kommunizieren.
- **Don't** lokale Login-/Markeneffekte ungeprüft auf jede Fläche übertragen.
- **Don't** dekorative Inszenierung an die Stelle klarer Aufgaben setzen.
- **Don't** eine formale Barrierefreiheitskonformität aus dieser Bestandsdokumentation ableiten.
