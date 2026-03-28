# Warehouse Backend

**Requirements**
- Ruby >= 3.2 (see `.ruby-version`)
- PostgreSQL 13+

**Environment Variables**
- `POSTGRES_USER` (default: `postgres`)
- `POSTGRES_PASSWORD` (default: empty)
- `POSTGRES_HOST` (default: `localhost`)
- `POSTGRES_PORT` (default: `5432`)
- `POSTGRES_DB` (default: `cats_warehouse_development`)
- `ALLOWED_ORIGINS` (comma-separated CORS allowlist; required outside local dev)
- `APP_HOST` (canonical host for staging/production links)
- `RAILS_LOG_LEVEL` (optional log level override)
- `NOTIFICATION_WEBHOOK_URL` (optional outbound warehouse notification target)

**Setup**
1. `bundle install`
2. `bin/rails db:create db:migrate`

**Docker (Production-like)**
1. Set `RAILS_MASTER_KEY` (from `config/master.key`) in your environment.
2. Set `ALLOWED_ORIGINS` and `APP_HOST` for the target environment.
3. `docker compose up --build`
4. App will be available at `http://localhost:3000`

**Tests**
1. `bin/rails db:prepare RAILS_ENV=test`
2. `bundle exec rspec`
