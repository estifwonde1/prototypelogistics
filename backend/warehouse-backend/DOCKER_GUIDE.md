# CATS Warehouse Backend - Docker Setup Guide

This guide explains how to run the CATS Warehouse backend using Docker and Docker Compose.

## Prerequisites

- **Docker Desktop** installed and running
  - Windows: [Download Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
  - Mac: [Download Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
  - Linux: Install Docker Engine and Docker Compose

- Verify Docker is installed:
```bash
docker --version
docker-compose --version
```

## Quick Start

### 1. Navigate to Backend Directory

```bash
cd backend/warehouse-backend
```

### 2. Build and Start Services

```bash
docker-compose up --build
```

This command will:
- Build the Rails application Docker image
- Pull PostgreSQL 15 Alpine image
- Create and start both containers
- Create the database
- Run migrations
- Seed the database with test data
- Start the Rails server on port 3000

**First-time build may take 5-10 minutes** as it installs all dependencies.

### 3. Verify Services are Running

Open a new terminal and check:

```bash
docker-compose ps
```

You should see:
```
NAME                      STATUS    PORTS
cats_warehouse_backend    Up        0.0.0.0:3000->3000/tcp
cats_warehouse_db         Up        0.0.0.0:5432->5432/tcp
```

### 4. Test the API

```bash
# Test health check
curl http://localhost:3000/health

# Test API endpoint
curl http://localhost:3000/cats_warehouse/v1/hubs
```

## Docker Compose Services

### Database Service (db)

- **Image:** postgres:15-alpine
- **Container Name:** cats_warehouse_db
- **Port:** 5432 (mapped to host 5432)
- **Credentials:**
  - Username: `postgres`
  - Password: `1234`
  - Database: `cats_warehouse_development`
- **Data Persistence:** Uses Docker volume `postgres_data`

### Backend Service (backend)

- **Build:** From local Dockerfile
- **Container Name:** cats_warehouse_backend
- **Port:** 3000 (mapped to host 3000)
- **Environment:**
  - `POSTGRES_HOST=db`
  - `POSTGRES_USER=postgres`
  - `POSTGRES_PASSWORD=1234`
  - `POSTGRES_DB=cats_warehouse_development`
  - `RAILS_ENV=development`
  - `SEED_DB=true` (seeds database on first run)
- **Volumes:**
  - Application code mounted for live reloading
  - Bundle cache for faster rebuilds

## Common Commands

### Start Services (Detached Mode)

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### Stop and Remove Volumes (Clean Slate)

```bash
docker-compose down -v
```

**Warning:** This deletes all database data!

### View Logs

```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Database only
docker-compose logs -f db
```

### Restart Services

```bash
docker-compose restart
```

### Rebuild After Code Changes

```bash
docker-compose up --build
```

### Access Rails Console

```bash
docker-compose exec backend rails console
```

### Run Database Commands

```bash
# Create database
docker-compose exec backend rails db:create

# Run migrations
docker-compose exec backend rails db:migrate

# Seed database
docker-compose exec backend rails db:seed

# Reset database (drop, create, migrate, seed)
docker-compose exec backend rails db:reset
```

### Access PostgreSQL Database

```bash
docker-compose exec db psql -U postgres -d cats_warehouse_development
```

Inside psql:
```sql
-- List all tables
\dt

-- List users
SELECT * FROM cats_core_users;

-- Exit
\q
```

### Execute Bash in Container

```bash
# Backend container
docker-compose exec backend bash

# Database container
docker-compose exec db sh
```

## Configuration

### Environment Variables

Edit `docker-compose.yml` to change environment variables:

```yaml
backend:
  environment:
    POSTGRES_HOST: db
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: your_password_here
    POSTGRES_DB: your_database_name
    RAILS_ENV: development
    SEED_DB: "true"  # Set to "false" to skip seeding
```

### Port Mapping

To change the exposed ports, edit `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "3001:3000"  # Map host port 3001 to container port 3000
  
  db:
    ports:
      - "5433:5432"  # Map host port 5433 to container port 5432
```

### Disable Auto-Seeding

If you don't want to seed the database automatically:

```yaml
backend:
  environment:
    SEED_DB: "false"
```

Then manually seed when needed:
```bash
docker-compose exec backend rails db:seed
```

## Development Workflow

### Making Code Changes

1. Edit files in your local `backend/warehouse-backend` directory
2. Changes are automatically reflected in the container (volume mount)
3. Rails will auto-reload most changes
4. For Gemfile changes, rebuild:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

### Adding New Gems

1. Edit `Gemfile`
2. Rebuild the container:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

### Database Migrations

1. Create migration:
   ```bash
   docker-compose exec backend rails generate migration MigrationName
   ```

2. Run migration:
   ```bash
   docker-compose exec backend rails db:migrate
   ```

## Troubleshooting

### Issue: Port Already in Use

**Error:** `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution:**
```bash
# Stop any local Rails server
# Or change port in docker-compose.yml
ports:
  - "3001:3000"
```

### Issue: Database Connection Failed

**Error:** `could not connect to server: Connection refused`

**Solution:**
```bash
# Check if database container is running
docker-compose ps

# Check database logs
docker-compose logs db

# Restart services
docker-compose restart
```

### Issue: Permission Denied on docker-entrypoint.sh

**Error:** `permission denied: docker-entrypoint.sh`

**Solution:**
```bash
# On Windows (Git Bash or WSL)
chmod +x docker-entrypoint.sh

# Or rebuild
docker-compose build --no-cache
```

### Issue: Bundle Install Fails

**Error:** `An error occurred while installing gem`

**Solution:**
```bash
# Clear bundle cache and rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Issue: Database Already Exists

**Error:** `database "cats_warehouse_development" already exists`

**Solution:**
This is normal on subsequent runs. The entrypoint script handles this gracefully.

### Issue: Migrations Pending

**Error:** `Migrations are pending`

**Solution:**
```bash
docker-compose exec backend rails db:migrate
```

### Issue: Seed Data Already Exists

**Error:** `Validation failed: Code has already been taken`

**Solution:**
This is normal if database was already seeded. To reseed:
```bash
docker-compose exec backend rails db:reset
```

## Connecting Frontend to Dockerized Backend

### Update Frontend .env

```env
VITE_API_BASE_URL=http://localhost:3000/cats_warehouse/v1
```

### CORS Configuration

The backend CORS is already configured for `http://localhost:5173` in `config/initializers/cors.rb`.

If you need to add more origins:

```ruby
# config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'http://localhost:5173', 'http://localhost:3001'
    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ['Authorization']
  end
end
```

Then restart:
```bash
docker-compose restart backend
```

## Production Considerations

### Security

For production, update:

1. **Database Password:**
   ```yaml
   POSTGRES_PASSWORD: use_strong_password_here
   ```

2. **Rails Secret Key:**
   ```bash
   docker-compose exec backend rails secret
   # Add to environment variables
   ```

3. **Environment:**
   ```yaml
   RAILS_ENV: production
   ```

### Performance

1. **Use Production Image:**
   - Multi-stage build
   - Precompile assets
   - Remove development dependencies

2. **Database Connection Pool:**
   ```yaml
   RAILS_MAX_THREADS: 10
   ```

3. **Use External Database:**
   - Remove `db` service
   - Point to managed PostgreSQL (AWS RDS, etc.)

## Backup and Restore

### Backup Database

```bash
docker-compose exec db pg_dump -U postgres cats_warehouse_development > backup.sql
```

### Restore Database

```bash
cat backup.sql | docker-compose exec -T db psql -U postgres cats_warehouse_development
```

## Monitoring

### Check Container Health

```bash
docker-compose ps
docker stats
```

### View Resource Usage

```bash
docker stats cats_warehouse_backend cats_warehouse_db
```

### Check Logs for Errors

```bash
docker-compose logs --tail=100 backend | grep ERROR
```

## Cleanup

### Remove Containers and Networks

```bash
docker-compose down
```

### Remove Containers, Networks, and Volumes

```bash
docker-compose down -v
```

### Remove Images

```bash
docker-compose down --rmi all
```

### Complete Cleanup

```bash
docker-compose down -v --rmi all
docker system prune -a
```

## Testing with Docker

### Run Tests

```bash
# Run all tests
docker-compose exec backend rails test

# Run specific test
docker-compose exec backend rails test test/models/hub_test.rb

# Run with coverage
docker-compose exec backend rails test COVERAGE=true
```

### Test Database

The test database is automatically created. To reset:

```bash
docker-compose exec backend rails db:test:prepare
```

## Integration with Frontend

### Full Stack Docker Setup

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 1234
      POSTGRES_DB: cats_warehouse_development
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend/warehouse-backend
    ports:
      - "3000:3000"
    environment:
      POSTGRES_HOST: db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 1234
      POSTGRES_DB: cats_warehouse_development
      RAILS_ENV: development
      SEED_DB: "true"
    depends_on:
      - db
    volumes:
      - ./backend/warehouse-backend:/app

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    environment:
      VITE_API_BASE_URL: http://localhost:3000/cats_warehouse/v1
    depends_on:
      - backend

volumes:
  postgres_data:
```

Run full stack:
```bash
docker-compose up --build
```

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Verify services: `docker-compose ps`
3. Check database connection: `docker-compose exec backend rails db:migrate:status`
4. Review this guide's troubleshooting section

## Quick Reference

| Command | Description |
|---------|-------------|
| `docker-compose up` | Start services |
| `docker-compose up -d` | Start in background |
| `docker-compose down` | Stop services |
| `docker-compose logs -f` | View logs |
| `docker-compose exec backend bash` | Access backend shell |
| `docker-compose exec backend rails console` | Rails console |
| `docker-compose exec backend rails db:migrate` | Run migrations |
| `docker-compose exec backend rails db:seed` | Seed database |
| `docker-compose restart` | Restart services |
| `docker-compose build --no-cache` | Rebuild from scratch |

---

**Happy Dockerizing! 🐳**
