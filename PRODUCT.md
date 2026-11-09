# Am Ball

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Trainer einer Jugendfußballmannschaft nutzen die App vor allem am Handy beim Training. Eltern nutzen ausschließlich separat geschützte Umfragen; sie erhalten keinen Zugang zur Teamverwaltung.

## Product Purpose

Trainingsanwesenheit einfach erfassen, die Vornamenliste pflegen und nachvollziehen, wer an welchem Tag dabei war. Eigenständige Umfragen sammeln Angaben für Mannschaftsaktionen, etwa Trikotgrößen für eine Bestellung.

Erfolg bedeutet: schnelles Abhaken vor Ort, verlässlich bestätigte Speicherung und verständliche vergangene Trainingslisten.

## Operating Context

Aktuell ist die App für eine Jugendmannschaft, ursprünglich eine G-Jugend, umgesetzt. Mehrere Mannschaften oder Vereine sind langfristig vorgesehen, aber noch nicht implementiert. Mandantentrennung, Zugangsmodell und Vereinsverwaltung sind offene Entscheidungen.

Die Nutzung erfolgt auf Handy und Computer mit gemeinsamer Online-Speicherung. Produktions- und Testdaten sind getrennt. Neue Kinder erscheinen auch in bestehenden Trainingslisten, zunächst als nicht anwesend.

## Capabilities and Constraints

- Gemeinsames Team-Passwort für Anwesenheit und Verwaltung; aktuell keine getrennten Trainer-/Administratorrollen.
- Kinder über Vornamen hinzufügen, umbenennen, archivieren und reaktivieren. Bestätigtes endgültiges Löschen entfernt auch die zugehörigen Anwesenheitsdaten.
- Ein Training pro Datum ausdrücklich anlegen; bestehende Termine im Kalender erkennen und nachträglich bearbeiten.
- Anwesenheit sofort speichern, direkte Rückmeldung geben und die letzte erfolgreiche Änderung im geöffneten Training rückgängig machen.
- Monatsverlauf als Tabelle oder Tagesliste anzeigen. Nicht anwesend bedeutet nicht automatisch entschuldigt oder abgesagt.
- Umfragen mit eigenem zufälligem Pfad und eigenem Passwort; keine öffentliche Namensliste oder Ergebnisansicht, keine automatische Verknüpfung mit der Kinderliste.
- Genau zwei konfigurierbare Umfragefelder: erstes Feld Freitext, zweites Feld Freitext oder Einzelauswahl. Felddefinitionen bleiben nach Erstveröffentlichung gesperrt.
- Umfragen entwerfen, öffnen, schließen und wieder öffnen; Antworten intern korrigieren, bestätigt löschen und als CSV exportieren.
- Datenschutz und Passwortschutz erhalten. Geheimnisse und reale Kinderdaten gehören nicht in öffentliche Artefakte, Quellcode oder Logs.
- Sichtbare Speicher-/Verbindungsfehler und Versionsschutz gegen das Überschreiben paralleler Änderungen erhalten. Keine unbestätigte Speicherung als erfolgreich darstellen.

## Brand Commitments

Produktname: Am Ball. Oberfläche und Hilfetexte sind deutschsprachig und direkt verständlich.

Auf allen App-Seiten bleibt der Footer:

Powered by heydot.de - HEYDOT Agency - Eltville am Rhein

`heydot.de` verlinkt auf `https://www.heydot.de` und öffnet in einem neuen Tab.

## Evidence on Hand

- [README.md](./README.md): dokumentiertes Verhalten, Workflows, Datenschutz- und Hostinggrenzen.
- [src/app/](./src/app/) und [src/components/](./src/components/): bestehende Web-Oberfläche für Login, Teamverwaltung, Anwesenheit, Verlauf und Umfragen.
- [tests/](./tests/): Funktions- und Browsertests mit fiktiven Daten, einschließlich Mobile-Ansichten.

Keine belegten Kundenstimmen, Nutzungszahlen oder Marketing-Erfolgskennzahlen sind als Produktbelege hinterlegt; solche Aussagen nicht erfinden.

## Product Principles

1. Das schnelle Erfassen am Trainingsplatz hat Vorrang vor zusätzlicher Komplexität.
2. Speicherung und Fehler bleiben nachvollziehbar; parallele Änderungen dürfen nicht still verloren gehen.
3. Teamdaten und Umfrageteilnahme bleiben geschützt und voneinander getrennt.
4. Historische Anwesenheit wird verständlich dargestellt; Lösch- und Archivierungsfolgen bleiben ausdrücklich erkennbar.
5. Künftige Mehrmannschafts-/Vereinsfunktionen müssen ihre Zugangs- und Datentrennung bewusst klären.

## Accessibility & Inclusion

Mobile-Unterstützung bleibt verbindlich. Bestehende Tastaturbedienbarkeit, sichtbare Fokuszustände, beschriftete Formulare und zugängliche Rückmeldungen erhalten. Weitere zielgruppenspezifische Anforderungen oder ein formaler Konformitätsstandard sind derzeit nicht festgelegt.
