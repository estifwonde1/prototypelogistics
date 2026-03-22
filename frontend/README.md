# CATS Warehouse Management System - Frontend

Modern, responsive React application for managing warehouse operations, inventory, and logistics.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite 8** - Build tool and dev server
- **React Router 7** - Client-side routing
- **Mantine UI 8** - Component library
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Axios** - HTTP client
- **Day.js** - Date formatting
- **Recharts** - Data visualization

## Features

- 🔐 Token-based authentication with role-based access control
- 📦 Complete warehouse management (Hubs, Warehouses, Stores, Stacks)
- 📋 Document workflows (GRNs, GINs, Inspections, Waybills)
- 📊 Real-time stock balance tracking
- 🎨 Responsive design for mobile and desktop
- 🌙 Dark mode support (coming soon)
- ⚡ Optimized performance with code splitting and lazy loading
- 🔄 Offline-ready with React Query caching

## Prerequisites

- Node.js 18+ and npm
- Backend API running on `http://localhost:3000`

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` and set your API base URL:
```env
VITE_API_BASE_URL=/cats_warehouse/v1
```

3. **Start development server:**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint to check code quality |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `/cats_warehouse/v1` |
| `VITE_ENV` | Environment name | `development` |

## Project Structure

```
src/
├── api/                    # API client & endpoint functions
│   ├── client.ts          # Axios instance with interceptors
│   ├── auth.ts            # Authentication endpoints
│   ├── hubs.ts            # Hub management endpoints
│   ├── warehouses.ts      # Warehouse management endpoints
│   ├── stores.ts          # Store management endpoints
│   ├── stacks.ts          # Stack management endpoints
│   ├── stockBalances.ts   # Stock balance endpoints
│   ├── grns.ts            # GRN (Goods Received Notes) endpoints
│   ├── gins.ts            # GIN (Goods Issue Notes) endpoints
│   ├── inspections.ts     # Inspection endpoints
│   └── waybills.ts        # Waybill endpoints
├── components/            # Reusable components
│   ├── layout/           # Layout components
│   │   ├── AppShell.tsx  # Main app shell with sidebar
│   │   ├── Sidebar.tsx   # Navigation sidebar
│   │   └── Header.tsx    # Top header bar
│   ├── common/           # Generic components
│   │   ├── StatusBadge.tsx
│   │   ├── LoadingState.tsx
│   │   ├── ErrorState.tsx
│   │   └── EmptyState.tsx
│   └── forms/            # Form components
├── hooks/                # Custom React hooks
│   ├── usePermission.ts  # Role-based permission checking
│   └── useQueryParams.ts # URL query parameter management
├── pages/                # Page components (route-based)
│   ├── auth/            # Authentication pages
│   ├── dashboard/       # Dashboard
│   ├── hubs/            # Hub management
│   ├── warehouses/      # Warehouse management
│   ├── stores/          # Store management
│   ├── stacks/          # Stack management
│   ├── stock/           # Stock balance views
│   ├── grns/            # GRN workflows
│   ├── gins/            # GIN workflows
│   ├── inspections/     # Inspection workflows
│   └── waybills/        # Waybill workflows
├── store/               # Zustand stores
│   └── authStore.ts     # Authentication state
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
│   ├── constants.ts     # App constants and enums
│   └── formatters.ts    # Date/number formatters
├── router.tsx           # Route configuration
├── App.tsx              # Root component
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## Authentication

The app uses token-based authentication with the following roles:

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all features |
| **Hub Manager** | Manage hubs |
| **Warehouse Manager** | Manage warehouses, stores, stacks, and all operations |
| **Storekeeper** | Create and view stores, stacks, GRNs, GINs, stock balances |
| **Inspector** | Create and confirm inspections, view GRNs |
| **Dispatcher** | Create and confirm waybills, view GINs |

### Test Users

Use these credentials for development:

| Email | Password | Role |
|-------|----------|------|
| admin@cats.local | Password1! | Admin |
| warehouse.manager@cats.local | Password1! | Warehouse Manager |
| hub.manager@cats.local | Password1! | Hub Manager |
| receiver@cats.local | Password1! | Storekeeper |
| inspector@cats.local | Password1! | Inspector |
| dispatcher@cats.local | Password1! | Dispatcher |

## Key Features

### Hub Management
- Create, view, edit, and delete hubs
- Track capacity, access, infrastructure, and contacts
- View associated warehouses

### Warehouse Management
- Full CRUD operations for warehouses
- Detailed tabs for capacity, access, infrastructure
- View stores, stock balances, and recent operations

### Store & Stack Management
- Manage storage locations within warehouses
- Track dimensions, capacity, and availability
- Configure stacks with commodity assignments

### Stock Balance Tracking
- Real-time inventory visibility
- Filter by warehouse, store, or commodity
- Group by warehouse or commodity
- Summary statistics

### Document Workflows

#### GRN (Goods Received Notes)
- Create receipts with multiple line items
- Track source, quality status, and storage location
- Confirm to update stock balances

#### GIN (Goods Issue Notes)
- Issue goods from warehouse
- Track destination and quantities
- Confirm to decrease stock balances

#### Inspections
- Quality assessment with damage/loss tracking
- Packaging condition evaluation
- Inspector assignment and confirmation

#### Waybills
- Transport documentation
- Vehicle and driver tracking
- Route management (source to destination)

## Performance Optimizations

- **Code Splitting**: Automatic route-based code splitting
- **Lazy Loading**: All pages loaded on-demand
- **React Query Caching**: 5-minute stale time for API data
- **Vendor Chunking**: Separate bundles for React, Mantine, and Query libraries
- **Tree Shaking**: Unused code eliminated in production builds

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Deployment

### Production Build

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Docker Deployment (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:

```bash
docker build -t cats-warehouse-frontend .
docker run -p 80:80 cats-warehouse-frontend
```

## Development Guidelines

### Adding a New Page

1. Create page component in `src/pages/[domain]/`
2. Add route in `src/router.tsx` with lazy loading
3. Add API functions in `src/api/[domain].ts`
4. Define TypeScript types in `src/types/[domain].ts`
5. Add navigation link in `src/components/layout/Sidebar.tsx`

### State Management

- **Server State**: Use TanStack Query for API data
- **Client State**: Use Zustand for global app state
- **Form State**: Use Mantine Form for form management

### Error Handling

- Global error interceptor in `src/api/client.ts`
- 401 errors automatically redirect to login
- 403 errors show access denied notification
- Network errors show connection issue notification

## Troubleshooting

### CORS Errors

Ensure the backend has CORS enabled for `http://localhost:5173`:

```ruby
# backend/config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'http://localhost:5173'
    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ['Authorization']
  end
end
```

### Port Already in Use

Change the port in `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    port: 5174, // Change to any available port
  },
})
```

### Build Errors

Clear cache and reinstall:

```bash
rm -rf node_modules dist
npm install
npm run build
```

## Contributing

1. Follow the existing code structure and naming conventions
2. Use TypeScript for all new code
3. Add proper error handling and loading states
4. Test with different user roles
5. Ensure responsive design works on mobile

## License

Proprietary - Prototype Logistics

## Support

For issues or questions, contact the development team.
