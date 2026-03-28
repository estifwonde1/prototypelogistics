# CATS Warehouse Management System – How to Run Everything

One guide to get the **backend** and **frontend** running so your team can run the app locally.

---

## What You Need

- **Docker Desktop** (for backend) – [Download](https://www.docker.com/products/docker-desktop/)  
  **or** Ruby, Rails, PostgreSQL (see [Local backend](#option-b-backend-without-docker) below)
- **Node.js 18+** and **npm** (for frontend)
- **Git**

Check:

```bash
docker --version
node -v
npm -v
```

---

## Quick Run (Backend with Docker + Frontend locally)

### 1. Clone and go to the repo

```bash
git clone <your-repo-url>
cd prototypelogistics
```

### 2. Start the backend with Docker

```bash
cd backend/warehouse-backend
docker-compose up --build
```

**First run can take 5–10 minutes** (build + DB create + migrate + seed).

When you see something like:

- `Listening on http://0.0.0.0:3000`  
leave this terminal running. Backend is at **http://localhost:3000**.

**More details (troubleshooting, commands):** [backend/warehouse-backend/DOCKER_GUIDE.md](backend/warehouse-backend/DOCKER_GUIDE.md)

### 3. Start the frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

If the frontend expects an API URL, create a `.env` in `frontend/` (or copy from `.env.example`):

```env
VITE_API_BASE_URL=http://localhost:3000/cats_warehouse/v1
```

Then open: **http://localhost:5173**

### 4. Log in

| Email | Password |
|-------|----------|
| `admin@cats.local` | `Password1!` |

Other users (same password): `warehouse.manager@cats.local`, `hub.manager@cats.local`, `receiver@cats.local`, `issuer@cats.local`, `inspector@cats.local`, `approver@cats.local`, `dispatcher@cats.local`.

---

## Option B: Backend without Docker

If you prefer **no Docker** (Ruby + PostgreSQL on your machine):

1. Install **Ruby 3.x**, **Rails 7.x**, **PostgreSQL 15+**.
2. Follow **[LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)** – it covers backend setup, DB create/migrate/seed, CORS, then frontend.

---

## Summary

| Step | Where | Command / Action |
|------|--------|-------------------|
| 1 | `backend/warehouse-backend` | `docker-compose up --build` |
| 2 | `frontend` | `npm install` then `npm run dev` |
| 3 | Browser | Open http://localhost:5173, log in with `admin@cats.local` / `Password1!` |

**Backend Docker details:** [backend/warehouse-backend/DOCKER_GUIDE.md](backend/warehouse-backend/DOCKER_GUIDE.md)  
**Full local (no Docker) and testing:** [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)
