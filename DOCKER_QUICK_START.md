# Docker Quick Start Guide

## Running Backend with Docker

### Step 1: Start Docker Desktop
Make sure Docker Desktop is running on your machine.

### Step 2: Navigate to Backend Directory
```bash
cd backend/warehouse-backend
```

### Step 3: Start Services
```bash
docker-compose up
```

**First time:** This will take 5-10 minutes to:
- Download PostgreSQL image (~108 MB)
- Build Rails application image
- Install all Ruby gems
- Create database
- Run migrations
- Seed test data

### Step 4: Verify Services
Open new terminal:
```bash
docker-compose ps
```

Should show both containers running.

### Step 5: Test API
```bash
curl http://localhost:3000/cats_warehouse/v1/hubs
```

## Running Frontend

### In a separate terminal:
```bash
cd frontend
npm run dev
```

Frontend will be at: http://localhost:5173
Backend API at: http://localhost:3000

## Stop Services
```bash
# In the docker-compose terminal, press Ctrl+C
# Then run:
docker-compose down
```

## Restart Services
```bash
docker-compose up
```

## View Logs
```bash
docker-compose logs -f backend
```

## Access Rails Console
```bash
docker-compose exec backend rails console
```

For detailed documentation, see `backend/warehouse-backend/DOCKER_GUIDE.md`
