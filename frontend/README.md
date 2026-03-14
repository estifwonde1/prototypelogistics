# CATS Warehouse Management System - Frontend

React 19 + TypeScript + Vite 8 frontend for the CATS Warehouse Management System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update the API base URL in `.env` if needed:
```
VITE_API_BASE_URL=http://localhost:3000/cats_warehouse/v1
```

## Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── api/                    # API client & endpoint functions
├── components/             # Reusable components
│   ├── layout/            # Layout components (AppShell, Sidebar, Header)
│   ├── common/            # Generic components (DataTable, StatusBadge, etc.)
│   └── forms/             # Shared form components
├── hooks/                 # Custom React hooks
├── pages/                 # Page components (one folder per domain)
├── store/                 # Zustand stores (auth, etc.)
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
├── router.tsx             # React Router configuration
├── App.tsx                # Root app component
└── main.tsx               # Entry point
```

## Tech Stack

- React 19
- TypeScript
- Vite 8
- React Router 7
- Mantine UI
- TanStack Query (React Query)
- Zustand (state management)
- Axios (HTTP client)
- Day.js (date formatting)
- Recharts (charts)

## Phase 0 Completion Status ✅

- [x] Backend CORS enabled
- [x] Boilerplate files removed
- [x] Core dependencies installed
- [x] Project structure created
- [x] Core infrastructure code implemented
  - [x] API client with auth interceptor
  - [x] Auth store (Zustand)
  - [x] Type definitions
  - [x] Constants and utilities
  - [x] Router configuration
  - [x] All API endpoint functions
  - [x] Placeholder page components
- [x] Project compiles successfully

## Phase 1 Completion Status ✅

- [x] Login page with email/password form
- [x] Form validation and error handling
- [x] Auth token storage in Zustand + localStorage
- [x] Protected route component
- [x] App shell with sidebar and header
- [x] Sidebar navigation with grouped links
- [x] Header with user info and logout
- [x] Dashboard page with stats cards
- [x] Quick action buttons
- [x] Full route configuration with nested routes
- [x] Loading states and suspense fallbacks

## Phase 2 Completion Status ✅

- [x] Common components (StatusBadge, LoadingState, ErrorState, EmptyState)
- [x] Hub list page with data table
- [x] Search and filter functionality
- [x] Hub detail page with tabs (Overview, Capacity, Access, Infrastructure, Contacts, Warehouses)
- [x] Hub form for create/edit operations
- [x] Full CRUD operations with React Query
- [x] Delete confirmation modal
- [x] Toast notifications for success/error
- [x] Navigation between pages
- [x] Loading and error states

## Next Steps

Phase 3: Warehouse Management
- Implement warehouse list page with data table
- Create warehouse detail page with tabs
- Build warehouse form for create/edit
- Add CRUD operations with hub relationship
