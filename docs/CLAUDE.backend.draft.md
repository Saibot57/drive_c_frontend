# CLAUDE.md – drive_c_backend

API för planeringsverktyget. Flask + Flask-SQLAlchemy + Alembic mot MySQL på PythonAnywhere. pytest kör mot
SQLite i minnet. Frontend är `drive_c_frontend` (Next.js), oftast klonad bredvid.

## Kommandon
- `python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt`
- `python -m pytest` (från repots rot; `pytest.ini` sätter `pythonpath = .`). Det finns ingen CI.
- Starta inte `app.py` för att prova en ändring. Den kräver MySQL och `SECRET_KEY`, och kör `create_all` vid import.
  Skriv ett test i stället.
- Deploy är manuell: `git pull`, `python -m alembic upgrade head` och sedan Reload. Se `DEPLOY.md`.

## Struktur
- `app.py`: `create_app()`, CORS, blueprints, felhanterare, CLI-kommandon och `db.create_all()` vid import.
- `api/<feature>_routes.py`: en blueprint per feature. Validering, åtkomstkontroll, databasanrop och serialisering
  ligger i samma fil.
  | Blueprint | Prefix | Modeller |
  |---|---|---|
  | `planner_routes` | `/api/planner` | `planner_models` (Activity, Archive, ArchiveShare, Course, PublicLink) |
  | `theme_routes` | `/api/theme` | `theme_models` |
  | `term_routes` | `/api/terms` | `term_models` |
  | `arbetslag_routes` | `/api/arbetslag` | `arbetslag_models` |
  | `month_calendar_routes` | `/api/calendar` | `month_calendar_models` |
  | `workspace_routes` (+ pdf- och bildproxy) | `/api/workspace` | `workspace_models` |
  | `routes` | `/api` (`/files`, `/update`) | `DriveFile` i `services/db_config.py` |
  | `auth_routes` | `/api/auth` | `models/user.py` |
- `api/responses.py`: alla svar går via `success_response(data)` och `error_response(msg, status)`, som ger
  `{success, data, error}`.
- `services/`: databasen (`db_config.py`), `retry_on_connection_error`, `rate_limit`, Drive och proxyerna.
- `notes_routes.py`, `/api/sections` och `/api/planner/courses*` har inga anropare i frontend.
- `models/calendar.py`, `schedule_models.py` och `command_center_models.py` hör till borttagna features. De finns
  kvar för att `create_all` och alembic ska känna till tabellerna.

## Konventioner för routes
- Ordningen på dekoratorerna är `@bp.route`, `@token_required`, `@retry_on_connection_error`. Handlern får
  `current_user` som första argument.
- Ägarkontroll görs alltid i frågan: `Model.query.filter_by(id=…, user_id=current_user.id)`. För delade resurser
  används `_has_access(obj, user_id)` (planner, arbetslag). 404 ges både när resursen saknas och när den inte är din.
- Indata valideras med featurens `_text`, `_integer`, … som kastar `PayloadError`. Routen svarar då 400 med
  texten. Mönstret finns i `term_routes.py`.
- JSON-nycklar: **camelCase** i planner, theme, term och arbetslag; **snake_case** i workspace och calendar.
  Nya endpoints använder camelCase. Befintliga byter inte stil.
- Felmeddelanden som når användaren skrivs på svenska. Frontend visar `error` som det är.
- Ändrar du ett svar, ändra frontendens typ och service samtidigt (`src/types/*.ts`,
  `src/app/workspace/_feature/types/workspace.types.ts`).
- Samtidighet: schemaarkiv använder lås (`/archives/<id>/lock`, 409 med `lockedBy`). Arbetslag använder `version`
  (409 vid konflikt).

## Modeller och migrationer
- Inga ForeignKey. `user_id` och andra id:n är mjuka referenser (String(36)), eftersom FK:er ger MySQL-fel 3780.
  Kaskader görs därför för hand i routes. Ta bort barnrader (t.ex. shares) i alla raderingsvägar.
- De nyare tabellerna (arbetslag, term, month_calendar) sätter `mysql_charset: utf8mb4` i `__table_args__`.
  Gör likadant i nya tabeller. Id:n är uuid4-strängar.
- En ny modell ska importeras på **tre** ställen: `app.py` (för `create_all`), `tests/conftest.py` och
  `migrations/env.py`.
- `create_all` skapar bara tabeller som saknas och lägger **aldrig** till kolumner. Varje schemaändring kräver en
  alembic-migration.
- Migrationerna skrivs för hand som `migrations/versions/NNN_beskrivning.py` med `revision = 'NNN_kort_namn'` och
  `down_revision` satt till den förra (just nu `020_planner_activity_lane_order`). De ska vara idempotenta
  (`_has_column` och `has_table`, se 020), och docstringen säger om de måste köras före frontend.
- Lägg till en rad i historiktabellen i `DEPLOY.md` för varje ny migration.
- Kontrollera att ingen annan gren redan har tagit nästa nummer.

## Tester
- `tests/conftest.py` bygger en minimal app. Testfilen anger `BLUEPRINTS = [(bp, '/api/…')]` och får fixturerna
  `client`, `alice` och `bob`. `tests/helpers.py` har `make_user`, `auth(user)` (headers) och `data(resp)`
  (kontrollerar `success`).
- Ett nytt endpoint får ett test för ägarisolering (bob når inte alices data) och ett för felaktig indata.
- Det finns inga tester för `app.py`, `auth_routes` eller `notes_routes`.

## Beroenden och hygien
- `requirements.txt` spärrar bara alembic och python-dotenv. På PythonAnywhere körs ingen virtualenv.
- `lib/jwt` (vendorad PyJWT 2.10.1) importeras inte lokalt eller i test; `import jwt` tar paketet från
  site-packages. Ändra inte i `lib/`.
- `add_column.py`, `migration.py`, `update_data.py`, `timestamp_migration.py` och `init_db.py` i roten är
  gamla engångsskript. Kör dem inte, och använd dem inte som förlaga.
- Underhållsskript hör hemma i `scripts/` (`backup_db.py`, `drive_dry_run.py`). CLI-kommandon för rensning finns i
  `app.py` (`flask purge-deleted-*`).

## Språk
- Kommentarer, docstrings, commitmeddelanden och felmeddelanden skrivs på svenska. Identifierare skrivs på engelska.
  Äldre kod har engelska kommentarer; de behöver inte översättas.
