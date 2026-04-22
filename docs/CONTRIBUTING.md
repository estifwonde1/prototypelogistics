# Contributing to Projectslog

## Development Setup

### Prerequisites
- Ruby 3.2+
- Node.js 20+
- PostgreSQL 15+
- Redis

### Backend Setup

```bash
cd backend/warehouse-backend

# Install dependencies
bundle install

# Set up database
bundle exec rails db:create db:migrate db:seed

# Run tests
bundle exec rspec

# Run linter
bundle exec rubocop
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Run linter
npm run lint

# Build for production
npm run build
```

## Git Workflow

1. Create a feature branch from `phases`:
   ```bash
   git checkout phases
   git pull origin phases
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "Add feature description"
   ```

3. Push and create a pull request to `phases`

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration. The pipeline runs automatically on push and pull requests to `main` and `phases` branches.

### Backend CI (`backend-ci.yml`)
- **Ruby setup**: Uses Ruby 3.2.10
- **Services**: PostgreSQL 15, Redis
- **Steps**:
  1. Install system dependencies
  2. Install Ruby gems
  3. Set up database (`rails db:prepare`)
  4. Run tests (`bundle exec rspec`)
  5. Run linter (`bundle exec rubocop`)

### Frontend CI (`frontend-ci.yml`)
- **Node.js**: Version 20
- **Steps**:
  1. Install dependencies (`npm ci`)
  2. Run linter (`npm run lint`) - **Non-blocking**
  3. Build for production (`npm run build`)

## Notes

- **Lint warnings**: The frontend linter is set to `continue-on-error: true`, so lint issues won't block your PR merge. However, please fix lint errors when possible to maintain code quality.

- **Test failures**: All tests must pass before merging. Check GitHub Actions logs if tests fail.

- **Known warnings**: You may see a `Cannot read "image.png"` warning during CI. This comes from an external gem (`cats_core`) and does not affect the build.

## Getting Help

If you encounter issues:
1. Check the [GitHub Actions logs](https://github.com/ndrmc/projectslog/actions)
2. Verify your Ruby/Node versions match the CI configuration
3. Ensure your local database is set up correctly
