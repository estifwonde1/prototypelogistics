# Warehouse Backend

**Requirements**
- Ruby >= 3.2 (see `.ruby-version`)
- PostgreSQL 13+

**Environment Variables**
- `POSTGRES_USER` (default: `postgres`)
- `POSTGRES_PASSWORD` (default: empty)
- `POSTGRES_HOST` (default: `localhost`)
- `POSTGRES_PORT` (default: `5432`)

**Setup**
1. `bundle install`
2. `bin/rails db:create db:migrate`

**Tests**
1. `bin/rails db:prepare RAILS_ENV=test`
2. `bundle exec rspec`
