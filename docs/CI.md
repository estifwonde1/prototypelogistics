# CI/CD Documentation

## Overview

This project uses GitHub Actions for continuous integration and deployment on the `main` and `phases` branches.

## Workflow Files

| File | Description |
|------|-------------|
| `.github/workflows/backend-ci.yml` | Backend tests and linting |
| `.github/workflows/frontend-ci.yml` | Frontend build and linting |

## Backend CI Pipeline

```yaml
triggers:
  - Push to main, phases
  - Pull requests to main, phases

services:
  - PostgreSQL 15
  - Redis

steps:
  1. Checkout code
  2. Install system dependencies
  3. Install Ruby 3.2.10 + gems
  4. Set up database (rails db:prepare)
  5. Run tests (bundle exec rspec)
  6. Run linter (bundle exec rubocop)
```

### Environment Variables
- `RAILS_ENV`: test
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `RUBYOPT`: "-W0" (suppresses Ruby warnings)

### Running Tests Locally

```bash
cd backend/warehouse-backend

# All tests
bundle exec rspec

# Specific file
bundle exec rspec spec/requests/users_spec.rb

# With documentation
bundle exec rspec --format documentation
```

## Frontend CI Pipeline

```yaml
triggers:
  - Push to main, phases
  - Pull requests to main, phases

steps:
  1. Checkout code
  2. Set up Node.js 20
  3. Install dependencies (npm ci)
  4. Run linter (npm run lint) - NON-BLOCKING
  5. Build for production (npm run build)
```

### Running Build Locally

```bash
cd frontend

# Type check + build
npm run build

# Lint only
npm run lint

# Dev server
npm run dev
```

## CI Status Checks

| Check | Status | Blocking |
|-------|--------|----------|
| Backend tests | Must pass | **Yes** |
| Backend rubocop | Warnings allowed | No |
| Frontend build | Must pass | **Yes** |
| Frontend lint | Warnings allowed | No |

## Troubleshooting

### Tests Failing in CI but Passing Locally

1. Check if database is properly migrated:
   ```bash
   bundle exec rails db:migrate
   bundle exec rails db:test:prepare
   ```

2. Clear test database:
   ```bash
   bundle exec rails db:drop db:create db:migrate RAILS_ENV=test
   ```

3. Check Ruby version matches CI (3.2.10):
   ```bash
   ruby -v
   ```

### Build Failing in CI

1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Check Node.js version matches CI (20):
   ```bash
   node -v
   ```

### Known Warnings

The following warnings may appear during CI but do not affect the build:

- **"Cannot read image.png"**: From external `cats_core` gem, not our code
- **Rubocop style warnings**: These are informational only

## Adding New Workflows

To add a new workflow, create a file in `.github/workflows/` with the appropriate triggers and steps. See GitHub Actions documentation for details.
