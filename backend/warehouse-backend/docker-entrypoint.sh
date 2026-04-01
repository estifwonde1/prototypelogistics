#!/bin/bash
set -e

# Remove a potentially pre-existing server.pid for Rails
rm -f /app/tmp/pids/server.pid

MIGRATE_DB="${MIGRATE_DB:-true}"
SEED_DB="${SEED_DB:-false}"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -c '\q'; do
  >&2 echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up - executing command"

# Create database if it doesn't exist
echo "Creating database if it doesn't exist..."
bundle exec rails db:create || true

# Run migrations using the verified migration-context path.
if [ "$MIGRATE_DB" = "true" ]; then
  echo "Running migrations..."
  bundle exec rails runner "ActiveRecord::Base.connection.migration_context.migrate"
fi

# Seed database if SEED_DB is set
if [ "$SEED_DB" = "true" ]; then
  echo "Seeding database..."
  bundle exec rails db:seed
fi

# Execute the main command
exec "$@"
