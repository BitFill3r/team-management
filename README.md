# Am Ball

Eine kleine, deutschsprachige Web-App für die Trainingsanwesenheit einer G-Jugend. Optimiert für Handy und Computer, mit gemeinsamer Online-Speicherung und einem Team-Passwort.

## Aktuelles Deployment

- App: https://am-ball-team-management.netlify.app
- Netlify-Projekt: https://app.netlify.com/projects/am-ball-team-management/
- GitHub: https://github.com/BitFill3r/team-management, Produktionsbranch `main` mit automatischen Netlify-Deployments.
- Datenbank: Neon-Projekt `team-management`, AWS Frankfurt. Die Netlify-Funktionen laufen derzeit in der voreingestellten Region US East (Ohio); die EU-Datenbankregion bedeutet daher keine ausschließlich europäische Verarbeitung.
- Die vier App-Variablen sind ausschließlich für den Produktionskontext gesetzt, nicht für Branch-Deployments oder Deploy Previews.
- Im aktuellen Netlify-Tarif werden reguläre Server-Umgebungsvariablen verwendet. Diese sind für berechtigte Netlify-Administratoren lesbar und gelten für die standardmäßig verfügbaren Scopes einschließlich Build und Funktionen. Sie sind keine öffentlichen `NEXT_PUBLIC_`-Variablen. Zugriff auf Team, Builds und Deploy-Konfiguration deshalb einschränken.
- Die produktive Anmeldung, Datenabrufe, sicheren Sitzungscookies und Abmeldung wurden über HTTPS geprüft, ohne Kinder oder Trainingsdaten anzulegen.

## Funktionen

- Ein gemeinsamer Zugang für Anwesenheit **und** Verwaltung, keine getrennten Rollen.
- Vornamen hinzufügen, umbenennen, archivieren und reaktivieren.
- Endgültiges Löschen nach Bestätigung entfernt das Kind einschließlich aller Anwesenheitsdaten.
- Trainingsdatum frei wählen (2000–2100), ein Training pro Datum ausdrücklich anlegen; heute ist nach Zeitzone Europe/Berlin vorausgewählt.
- Einzelne Kinder abhaken: Jede Änderung wird sofort gespeichert.
- Falsch gesetzte Häkchen erneut antippen oder die letzte erfolgreiche Änderung im geöffneten Training rückgängig machen.
- Trainingsverlauf ansehen und nachträglich bearbeiten.
- Sichtbare Speicher-/Verbindungsfehler und Versionsschutz gegen das Überschreiben paralleler Änderungen.

Beim Anlegen eines Trainings werden die zu diesem Zeitpunkt aktiven Kinder aufgenommen. Später hinzugefügte Kinder erscheinen erst in neuen Trainings. Archivierte Kinder bleiben in bestehenden Trainings sichtbar. Umbenennungen gelten auch für frühere Listen. Gleichlautende Vornamen sind getrennte Datensätze; zur Unterscheidung kann ein kurzer Zusatz verwendet werden.

## Technik

Next.js (App Router), React, TypeScript und PostgreSQL mit `pg`. Netlify übernimmt den Betrieb der Web-App und ihrer serverseitigen Funktionen. Neon stellt die PostgreSQL-Datenbank in einer EU-Region bereit. Es gibt keine externen Schriftarten, Analyse-Skripte oder Trackingdienste in der Anwendung.

## Lokal einrichten

Voraussetzungen: Node.js 22 oder neuer, npm und eine PostgreSQL-Datenbank (lokal oder Neon).

```sh
npm ci
cp .env.example .env.local
npm run password:hash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

In `.env.local` eintragen:

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_URL` | PostgreSQL-Verbindungszeichenfolge. Für Neon die gepoolte Adresse verwenden; TLS mit Zertifikatsprüfung (`sslmode=verify-full`). |
| `TEAM_PASSWORD_HASH` | Vollständiger `scrypt:…:…`-Wert aus `npm run password:hash`, **nicht** das Klartextpasswort. |
| `SESSION_SECRET` | Der zufällige Wert aus dem zweiten Befehl, mindestens 32 Zeichen. |
| `APP_ORIGIN` | Exakte App-Adresse ohne abschließenden Schrägstrich, lokal `http://localhost:3000`, online z. B. `https://euer-team.netlify.app`. Für den CSRF-Schutz wird nicht auf Proxy-/Host-Header vertraut. |

Die Passwort-Eingabe im interaktiven Terminal wird verborgen; mindestens 12 Zeichen verwenden. Geheimnisse niemals mit `NEXT_PUBLIC_` präfixieren, in Git speichern oder in Chats, Screenshots beziehungsweise Logs weitergeben. `.env.local` ist ausgeschlossen. Die Beispielkonfiguration enthält keine funktionierenden Zugangsdaten.

Alternativ erzeugt `npm run password:generate` ein zufälliges Passwort und trägt dessen Hash direkt in die vorhandene `.env.local` ein. Vorhandene Datenbankvariablen bleiben erhalten; ein bereits eingerichtetes Passwort wird nicht überschrieben. Das lesbare Passwort steht nur in der ignorierten `.team-password.local`, nicht in der Ausgabe. Beide Dateien erhalten Dateirechte `0600`. Passwort im Passwortmanager sichern und die lesbare Datei danach löschen. Auch bei dieser Variante sind `SESSION_SECRET` und `APP_ORIGIN` noch einzurichten.

```sh
npm run db:migrate
npm run dev
```

Die Anwendung ist unter `http://localhost:3000` erreichbar. Bei einem lokalen PostgreSQL ohne TLS kann die lokale Verbindungszeichenfolge `sslmode=disable` verwenden; nicht für Neon oder öffentliche Datenbanken verwenden.

## Auf Netlify veröffentlichen

1. In Neon ein Projekt mit einer **EU-Region** anlegen. Eine eigene Datenbank für diese App verwenden. Die gepoolte Verbindungsadresse kopieren und TLS-Zertifikatsprüfung aktiv lassen. Zugang nur für die verantwortlichen Personen freigeben.
2. Lokal `.env.local` mit dieser Datenbank und den erzeugten Geheimnissen füllen. `npm run db:migrate` ausführen. Das legt das Schema an, keine Kinderdaten. Vor späteren Migrationen eine Sicherung erstellen.
3. Das Repository zu GitHub übertragen und in Netlify als neues Projekt importieren. Next.js wird durch Netlifys integrierte Next.js-Unterstützung erkannt; kein statischer Export. Build-Befehl und Ausgabe sind in [netlify.toml](./netlify.toml) gesetzt.
4. `DATABASE_URL`, `TEAM_PASSWORD_HASH` und `SESSION_SECRET` in Netlify als Server-Umgebungsvariablen für das Produktionsdeployment setzen. Falls der Tarif granulare Scopes und gegen Auslesen geschützte Secrets unterstützt, diese auf den Functions-/Server-Kontext begrenzen und als Secrets markieren; ansonsten bleiben reguläre Variablen für berechtigte Administratoren lesbar. `APP_ORIGIN` auf die exakte öffentliche HTTPS-Adresse ohne abschließenden Schrägstrich setzen. Bei einer eigenen Domain diese als kanonische Adresse verwenden und andere Adressen dorthin umleiten. Keine produktiven Geheimnisse/Datenbanken für öffentliche Vorschau-Deployments freigeben. Falls Variablen auch beim Build gesetzt werden, dürfen sie nicht als öffentliche Next.js-Variablen markiert sein.
5. Deployment starten. Die dynamischen Seiten und API benötigen Netlifys Next.js-Runtime; ein reines Uploaden statischer Dateien funktioniert nicht.
6. Über die HTTPS-Adresse prüfen: Anmeldung, Vornamen anlegen, Datum wählen, Training anlegen, abhaken, Seite neu laden, Rückgängig, Verlauf und Abmelden. Von einem zweiten Gerät denselben Stand prüfen. Erst danach echte Daten eintragen.

Migrationen sind bewusst kein Teil jedes Builds oder Requests. `npm run db:migrate` vor einem Deployment ausführen, das ein neues Schema benötigt. Ausgeführte Migrationen werden in `schema_migrations` geführt; wiederholtes Ausführen ist möglich und gleichzeitige Migrationen werden über eine Datenbanksperre serialisiert.

Ein echtes Netlify-/Neon-Deployment benötigt eigene Konten und Zugangsdaten. Die lokalen Tests ersetzen den abschließenden Funktionstest mit der tatsächlich veröffentlichten Adresse nicht.

## Zugang und Betrieb

- Sitzungen laufen nach zwölf Stunden ab. Cookies sind HttpOnly, SameSite=Strict und im Produktionsbetrieb ausschließlich über HTTPS übertragbar.
- Abmelden entfernt den Sitzungscookie dieses Browsers. Für einen Widerruf **aller** Sitzungen `SESSION_SECRET` austauschen und neu deployen. Ein Wechsel von `TEAM_PASSWORD_HASH` widerruft ebenfalls alle bisherigen Sitzungen.
- Passwortwechsel: `npm run password:hash`, neuen Hash in Netlify hinterlegen, neu deployen und das neue Passwort ausschließlich über einen geeigneten privaten Kanal teilen.
- Die Anmeldung erlaubt zusammen maximal 20 Versuche in einem festen Fenster von 15 Minuten, gespeichert in PostgreSQL. Auch erfolgreiche Anmeldungen zählen; aktive Sitzungen sind nicht betroffen. Die gemeinsame Grenze vermeidet das Vertrauen auf manipulierbare IP-Header, bedeutet aber auch, dass Fremde vorübergehend weitere Logins blockieren können. Bei breiterer Nutzung zusätzlich Netlifys vorgeschaltete Rate-Limits/WAF konfigurieren.
- Schreibende Anfragen verlangen dieselbe Origin und JSON. Sämtliche Daten-Endpunkte prüfen die Sitzung serverseitig. Antworten der API werden nicht gecacht.
- Bei einem Schreibfehler bleibt die letzte bestätigte Anzeige erhalten und weitere Änderungen werden bis zum Neuladen gesperrt. Eine unterbrochene Antwort kann trotz erfolgreicher Speicherung auftreten: zuerst den gespeicherten Stand neu laden und prüfen.
- Rückgängig gilt nur für die letzte erfolgreiche Anwesenheitsänderung im aktuell geöffneten Training und Browserzustand. Ein Datumwechsel oder Neuladen verwirft diese lokale Rückgängig-Information. Änderungen anderer Geräte werden durch Versionsprüfung geschützt; ein Konflikt erfordert Neuladen.
- Kein Offline-Modus und keine Live-Synchronisierung: auf anderen Geräten geänderte Daten werden beim Neuladen beziehungsweise Wechsel des Datums geladen. Zum aktuellen Training kann die Browserseite neu geladen werden.

## Datenschutz und Sicherungen

Auch Vornamen zusammen mit Trainingsanwesenheit sind personenbezogene Daten. Vor Nutzung für Kinder müssen die Verantwortlichen Rechtsgrundlage, Informationspflichten, Zugangsweitergabe und Aufbewahrungsfristen klären. Der gemeinsame Zugang berechtigt jede angemeldete Person auch zum endgültigen Löschen.

- Daten minimieren: keine Geburtsdaten, Kontaktdaten oder Nachnamen ergänzen.
- Neon in einer EU-Region betreiben; Auftragsverarbeitung, Unterauftragnehmer und gegebenenfalls Übermittlungen auch für Netlify prüfen. Die Datenbankregion allein garantiert keine vollständige EU-Verarbeitung.
- Keine Kinderdaten in Support-Logs, Screenshots oder öffentlichen Vorschau-Deployments verwenden.
- Backup-/Restore-Funktionen und Aufbewahrung im gewählten Neon-Tarif bewusst konfigurieren. Vor Änderungen einen wiederherstellbaren Snapshot oder einen verschlüsselt verwahrten PostgreSQL-Dump anlegen und Wiederherstellung in einer getrennten Datenbank testen.
- Archivieren ist **kein** Löschen. Bei Löschbedarf in der Verwaltung endgültig löschen; die Kind-Zuordnungen werden per Fremdschlüssel mit entfernt. Trainingsdatum und verbleibende Kinder bleiben erhalten.
- Gelöschte Daten können in Backups bis zum Ende deren Aufbewahrung verbleiben. Backups schützen, Fristen festlegen und nach einer Wiederherstellung bereits erfolgte Löschungen erneut anwenden.
- Ein automatischer Löschplan und Löschen kompletter Trainingstage sind in dieser ersten Version nicht enthalten. Datenbestand regelmäßig nach dem festgelegten Aufbewahrungskonzept prüfen; bei Stilllegung die separate Datenbank und deren Backups nach Vorgabe entfernen.

## Prüfen

```sh
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Die Integrations-/Funktionstests verwenden echtes PostgreSQL-Verhalten über eine isolierte PGlite-Datenbank: Validierung, Sitzung, Login-Begrenzung, Datenzugriffsschutz, Historie, Archivierung, Löschung und Versionskonflikte. Ein zusätzlicher Test prüft die Passworterzeugung, Dateirechte und den Schutz vor Überschreiben mit isolierten temporären Dateien.

Die Browserprüfungen starten den **Produktionsbuild** auf `127.0.0.1:3100` und eine nur lokal gebundene, flüchtige PostgreSQL-Testdatenbank mit zufälligen Test-Geheimnissen. Sie benötigen keine Neon-Zugangsdaten und verwenden keine produktive Datenbank. Migrationen werden dabei zweimal ausgeführt, um ihre Wiederholbarkeit zu prüfen. Port 3100 muss frei sein. Die Tests prüfen den gesamten Ablauf in Desktop- und Handybreite, einschließlich Verbindungsfehler und paralleler Änderungen. Server und Testdatenbank werden danach beendet.

Browser-Screenshots und gegebenenfalls Fehler-Traces liegen im ignorierten Verzeichnis `test-results/`. Testdaten sind fiktiv.
