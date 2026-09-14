# Study Planner

React-Anwendung mit lokalem Speicher und Supabase-Synchronisierung. Änderungen werden zuerst pro Konto im Browser gespeichert. Der Server akzeptiert sie nur, wenn die erwartete Revision noch aktuell ist. Bei einem Konflikt entscheidet der Nutzer, welche Version bestehen bleibt; die verdrängte Version wird als lokale Wiederherstellungskopie aufbewahrt.

Bestehende Browser-Sitzungen ben?tigen nach diesem Update einmalig eine neue Anmeldung, damit das Konto f?r den lokalen Zugriff ausdr?cklich gespeichert wird.

## Lokal ohne Docker testen

Voraussetzung: Node.js 24 und npm.

```sh
npm ci
npm run dev:demo
```

Öffne http://127.0.0.1:5173. Testkonten sind `alice@planner.test` und `bob@planner.test`, beide mit dem Testpasswort `PlannerDev-2026!`.

Die Demo führt die SQL-Migration in PGlite aus, einem lokalen PostgreSQL in WebAssembly. Daten bleiben in `.local-dev/pgdata` erhalten. Mit `npm run dev:demo -- --memory` startet eine leere Datenbank im Arbeitsspeicher. Beenden mit Strg+C.

Die Anmeldung ist ausschließlich eine lokale Testnachbildung mit festen Konten. Nach einem Neustart des Demo-Servers melde dich erneut an. Google-Anmeldung und Registrierung sind hier nicht verfügbar. Verwende fiktive Daten. API und Webseite lauschen nur auf der lokalen Loopback-Adresse. Die Demo setzt keine Supabase-Verbindung voraus und überschreibt keine Umgebungsdatei.

## Vollständiges lokales Supabase

Installiere und starte Docker Desktop. Danach:

```sh
npm ci
npm run dev:local
npm run dev
```

Das Setup startet Supabase, wendet ausstehende Migrationen ausschließlich lokal an, legt die beiden Testkonten an und schreibt URL und öffentlichen lokalen Schlüssel in die ignorierte `.env.local`. Ein bereits vorhandenes fremdes `.env.local` wird nicht überschrieben. Es werden keine Cloud-Projekte verknüpft und keine produktiven Migrationen ausgeführt.

Supabase Studio läuft unter http://127.0.0.1:54323. `npm run dev:stop` stoppt die Container und erhält die Daten. Details zu Voraussetzungen und Ports stehen in der [Supabase-Dokumentation](https://supabase.com/docs/guides/local-development/cli/getting-started).

`npm run test:local` prüft den laufenden Docker-Stack mit echten Anmeldungen und zwei gleichzeitigen Schreibversuchen. Es erstellt dafür eigene temporäre Konten und entfernt diese danach wieder. Deine Testpläne werden dabei nicht verändert.

## Prüfen

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Die SQL-Tests führen die echte Migration aus und prüfen Kontotrennung, veraltete Revisionen und wiederholte Schreibanfragen. Die Browser-Tests starten eine eigene Demo mit flüchtiger Datenbank. PGlite ersetzt keinen abschließenden Test gegen den Docker-Stack mit Supabase Auth und PostgREST.

Für einen Konflikttest öffne die Demo in zwei unterschiedlichen Browserprofilen, melde beide mit Alice an und ändere denselben geladenen Plan nacheinander. Zwei Tabs im selben Profil verwenden dagegen eine Schreibsperre. Für einen Offline-Test blockiere die API auf Port 54329 in den Browser-Entwicklerwerkzeugen, ändere einen Plan und gib die Verbindung anschließend wieder frei.
