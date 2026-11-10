# Drive C – backend

REST-API för planeringsverktyget Drive C. Flask + Flask-SQLAlchemy + Alembic mot MySQL, med Google Drive-synk. Frontend ligger i `Saibot57/drive_c_frontend` (Next.js på Vercel). Backend körs på PythonAnywhere och deployas för hand, se `DEPLOY.md`.

## Kommandon

```bash
pip install -r requirements-dev.txt
python -m pytest -q            # SQLite i minnet, ingen MySQL behövs
python -m alembic heads        # ska visa exakt en head
```

CI (`.github/workflows/ci.yml`) kör testerna och kontrollerar att alembic har en enda head, på Python 3.10 som PythonAnywhere.

## Struktur

- `app.py` – `create_app()`, CORS, registrering av blueprints och `db.create_all()`. En ny routes-fil registreras här. **`app.py` körs inte av testerna** (`tests/conftest.py` bygger en egen app), så en blueprint som saknas här ger gröna tester och 404 i produktion.
- `api/*_routes.py` – en blueprint per feature: `/api/planner` (+ `/api/planner/folders`), `/api/workspace`, `/api/theme`, `/api/arbetslag`, `/api/narvaro`, `/api/calendar`, `/api/terms`, `/api/trafik`, `/api/auth`. Validering, ägarkontroll och databaslogik ligger i dag direkt i routes.
- `api/responses.py` – `success_response` och `error_response`. Alla svar har formen `{ success, data, error }`, som frontend förväntar sig.
- `models/` – SQLAlchemy-modeller per feature. `services/db_config.py` har `db` och de äldsta modellerna.
- `services/` – infrastruktur: databas-retry, Drive, bild- och PDF-proxy, rate limit, access-logg.
- `migrations/versions/` – alembic, numrerade `NNN_beskrivning.py`.
- `tests/` – pytest. Se `tests/conftest.py` och `tests/helpers.py`.
- `docs/granskning-status.md` – aktuell status för granskningarna (säkerhet, dataintegritet, arkitektur).
- Utan anropare i frontend, rör dem inte utan att fråga: `api/notes_routes.py`, `/api/sections`, `/api/planner/courses*` och modellerna för borttagna features (`calendar.py`, `schedule_models.py`, `command_center_models.py`, som finns kvar för att tabellerna finns).

## Konventioner

- **Svenska** i kommentarer, docstrings, felmeddelanden till användaren och commit-meddelanden.
- **Skyddade routes** har `@token_required` (`api/auth_routes.py`) och får `current_user` som första argument. Varje fråga som läser eller skriver användardata ska filtrera på ägaren eller en delning, även för nästlade resurser.
- **`@retry_on_connection_error`** (`services/db_retry.py`) kör om en route när MySQL tappat anslutningen, men bara före `commit()`. En handler med `except Exception` måste först släppa igenom `OperationalError` med `raise`, annars når felet aldrig dekoratören.
- **Validering:** `PayloadError` och hjälpare som `_text` och `_integer` finns i dag i en kopia per routes-fil (theme, term, arbetslag, narvaro), med små skillnader. Kopiera inte en femte: lägg det gemensamma i `api/validation.py` och importera därifrån.
- **Delad logik mellan routes-filer** läggs i `services/`, inte som import av `_privata` namn ur en annan routes-fil (`planner_folder_routes.py` gör så i dag).
- **Kaskader ligger i routes**, eftersom modellerna saknar relationer. Att radera ett schema görs på två ställen i `planner_routes.py` (`delete_planner_activities` och `delete_shared_archive`); en ny tabell som hänger på ett schema ska in i båda.
- **Dokument som kan öppnas på två ställen** har en `version` som klienten skickar tillbaka; en gammal version ger 409 med det aktuella dokumentet (Schema, Arbetslag, Närvaro).
- **Nya kolumner kräver en migration.** `db.create_all()` vid uppstart skapar bara tabeller som saknas. Migrationer numreras i följd, kontrollerar om kolumnen redan finns (se `_has_column` i `020_…`) och förklarar i docstringen varför de behövs.
- **Nyckelstil i svaren** följer featuren: Workspace och Kalender använder snake_case, Schema, Temakalender, Arbetslag och Närvaro camelCase. Serialiseringen ligger i modellens `to_dict`, utom i planner där den ligger i routes (`_serialize_*`). Frontendens typer speglar den för hand och ändras i samma veva.
- **Felmeddelanden vid 400** kan visas för användaren (schemat visar dem som notis). Skriv dem på svenska och utan interna detaljer; ett oväntat fel loggas och får ett allmänt meddelande.
- **Närvaro** lagrar bara chiffertext som frontend krypterat. Servern ska aldrig tolka eller logga innehållet. Veckor äldre än 365 dagar gallras när användaren läser sina dokument.
- **Trafik** (`/api/trafik`) svarar bara för användarnamn i `TRAFFIC_VIEWERS` i `.env`, annars 404.
- **Tester:** en testfil anger `BLUEPRINTS = [(blueprint, '/api/prefix')]` och får fixturerna `app`, `client`, `alice` och `bob`. `tests/helpers.py` har `make_user`, `auth(user)` och `data(response)`. Pröva åtkomst för en annan användare (`bob`) i varje ny route.
- **Granskningsfynd:** åtgärdar du ett fynd, uppdatera dess rad i `docs/granskning-status.md` i samma PR. Rapporterna själva är ögonblicksbilder och ändras inte.

## Fällor

- **Deployordning:** `git pull`, `python -m alembic upgrade head`, sedan Reload. Mappen på PythonAnywhere heter `~/drive_catalog`, inte som lokalt. Om backend eller frontend ska ut först beror på migrationen (`021` krävde frontend först). Skriv in ordningen, och vad som händer med ny frontend mot gammal backend, i historiken i `DEPLOY.md`.
- **En ny modell** importeras på tre ställen: `app.py` (för `db.create_all()`), `tests/conftest.py` och `migrations/env.py`. Saknas den i något av dem skapas tabellen inte där.
- **Ingen ForeignKey i nya modeller.** Teckenuppsättningarna skiljer sig åt i produktionsdatabasen, och en riktig FK ger MySQL-fel 3780. Referenserna är vanliga strängkolumner (se `models/planner_models.py`).
- **En ny workspace-elementtyp** måste in i `VALID_TYPES` (`models/workspace_models.py`), annars avvisas den.
- **Två grenar med var sin ny migration** ger två heads. CI stoppar det; lös det med en merge-migration (`alembic merge`), inte genom att ändra `down_revision` i en migration som redan körts i produktion.
- **Två Python på PythonAnywhere:** webbappen kör i virtualenv `myenv310`, medan `python` i konsolen är systemets (där körs alembic enligt `DEPLOY.md`). Ett paket som appen behöver installeras i virtualenv. PyJWT är spärrad till 2.10.1, samma som där; systemets Python har 2.4.0.
- `requirements.txt` saknar versionsspärrar för Flask, SQLAlchemy och de flesta andra. Testerna ger tusentals `SADeprecationWarning` från `ping_connection` i `services/db_config.py`; de är kända och inget nytt fel. Lägg till en spärr om en uppgradering bryter något.
- **Lösa skript i roten** (`add_column.py`, `migration.py`, `timestamp_migration.py`, `update_data.py`, `update_password.py`, `init_db.py`) är äldre engångsverktyg. Kör dem inte mot produktion och skriv inte nya i samma stil; schemaändringar går via alembic. Tre av dem vägrar starta utan flaggan `--jag-vet-vad-jag-gor`.
- `planner_routes.py` (~1 450 rader) är stor och ändras ofta. Lägg ett nytt delområde i en egen routes-fil, som `planner_folder_routes.py`.
- Bild- och PDF-proxyn är registrerade under `/api/workspace`, inte under egna prefix.
