# Backend Architecture and Execution Plan

## Summary
This document provides a complete technical plan to build a new Ruby on Rails backend, integrate the CATS Core gem, and implement a Warehouse Engine. It is based on the existing project plan in docs/plan.md and is structured as an end-to-end execution guide.

## Project Setup
### Rails Version and Initialization
- Target Rails: 7.0.x (align with existing stack using Rails 7 in the legacy system)
- Ruby: >= 3.2 (align with existing system)

Example initialization:
```bash
rails new cats_backend --api -d postgresql
cd cats_backend
```

### Required Gems and Dependencies
Core:
- `rails`, `pg`, `puma`
- `active_model_serializers` or `blueprinter` (choose one and standardize)
- `pundit` (authorization)
- `sidekiq` + `redis` (background jobs)
- `rack-cors` (CORS)
- `dotenv-rails` or `figaro` (env management)

Domain:
- `cats_core` (CATS Core gem)

### Environment Configuration
- `.env` for local
- `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY_BASE`
- Logging to STDOUT for containerized deployments

## CATS Core Integration
### Import
- Add to Gemfile:
```ruby
gem 'cats_core', '~> 1.5.28'
```

### Configuration and Initialization
- Mount CATS Core engine routes under `/cats_core`
- Ensure CATS Core migrations are included and run

### Interaction Model
- Treat CATS Core as authoritative for:
  - `cats_core_locations`
  - `cats_core_commodities`
  - `cats_core_users`
  - `cats_core_transporters`

## Warehouse Engine Architecture
### Engine Structure
Create a Rails Engine: `cats_warehouse`
- Namespace: `Cats::Warehouse`
- Isolation: isolate_namespace

Example:
```bash
rails plugin new cats_warehouse --mountable
```

### Module Boundaries
- Warehouse infrastructure, inventory, receiving, dispatch documents
- Depends on CATS Core for geography and core entities

### Mounting in Main App
```ruby
mount Cats::Warehouse::Engine => '/cats_warehouse'
```

## Data Layer
The data model below mirrors docs/plan.md. This section is the blueprint for migrations and models.

### Models Migrated from Cats Core
- `cats_warehouse_stores`
- `cats_warehouse_stacks`
- `cats_warehouse_stack_transactions` (extended into movement ledger)
- `cats_warehouse_stacking_rules`
- `cats_warehouse_inventory_adjustments`

### New Models
- `cats_warehouse_hubs`
- `cats_warehouse_warehouses`
- `cats_warehouse_grns`, `cats_warehouse_grn_items`
- `cats_warehouse_gins`, `cats_warehouse_gin_items`
- `cats_warehouse_inspections`, `cats_warehouse_inspection_items`
- `cats_warehouse_waybills`, `cats_warehouse_waybill_items`
- `cats_warehouse_stock_balances`

### Normalized Models (Breakdown)
Use normalized hub, warehouse, inspection, and waybill structures as defined in docs/plan.md.

## Application Structure
### Controllers
- RESTful controllers for hubs, warehouses, stores, stacks, GRN, GIN, inspections, waybills.
- Controllers should live inside the engine namespace.

### Services
- Receiving service: GRN creation + confirmation
- Inspection service: record + confirm; generate damage/loss movements
- Issue service: GIN creation + confirmation
- Inventory service: stock balance updates and ledger entries

### Background Jobs
- Notification events (stock low, expiry) if required
- Document confirmation hooks

### Policies / Authorization
- Pundit policies per resource
- Role-based access mapped to CATS Core users

### Serializers / Responses
- Use a consistent serializer system
- Standard response envelope:
```json
{ "success": true, "data": { ... } }
```

## API Design
### Versioning
- `/api/v1/...` prefix for main app
- `/cats_warehouse/v1/...` for engine routes

### REST Endpoints (Examples)
- `GET /cats_warehouse/v1/warehouses`
- `POST /cats_warehouse/v1/grns`
- `POST /cats_warehouse/v1/grns/:id/confirm`
- `POST /cats_warehouse/v1/inspections`
- `POST /cats_warehouse/v1/inspections/:id/confirm`
- `POST /cats_warehouse/v1/gins`
- `POST /cats_warehouse/v1/waybills`

### Request/Response Structure
- JSON only
- Use explicit request payloads with `payload` root (consistent with Cats Core style)

## Infrastructure & Configuration
### Environment Variables
- `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY_BASE`
- `CATS_CORE_API_URL` if external core service is used

### Logging
- Structured JSON logs in production

### Error Handling
- Centralized exception handling in `ApplicationController`

### Testing Setup
- RSpec
- FactoryBot
- Coverage with SimpleCov

## Development Workflow
### Folder Structure
- `apps/` main
- `engines/cats_warehouse` for the warehouse engine
- `docs/` for design and execution

### Naming Conventions
- `Cats::Warehouse::` namespace for engine classes
- snake_case for table names

### Coding Guidelines
- Service objects for workflows
- Thin controllers
- Strict validations in models

## Implementation Phases and Milestones
### Phase 1 - Project Initialization
- Create Rails API project
- Add required gems
- Initialize repository and CI

### Phase 2 - Integrate CATS Core
- Add gem
- Mount engine
- Run migrations

### Phase 3 - Warehouse Engine Skeleton
- Create `cats_warehouse` engine
- Mount engine routes
- Add base controllers and serializers

### Phase 4 - Data Model Implementation
- Implement migrations per docs/plan.md
- Implement model classes and associations

### Phase 5 - Workflow Services
- GRN creation/confirmation
- Inspection creation/confirmation
- GIN creation/confirmation
- Waybill creation

### Phase 6 - API Endpoints
- CRUD for hubs, warehouses, stores, stacks
- Document endpoints

### Phase 7 - Production Readiness
- Logging, error handling, testing, CI

## Architecture Decisions
- Warehouse domain isolated in Rails Engine
- CATS Core remains the source of truth for geography and commodities
- No stock_lots table (commodities serve as lots)
- Stack transactions extended as the movement ledger

## Example Commands
```bash
rails new cats_backend --api -d postgresql
rails plugin new cats_warehouse --mountable
bundle install
rails db:create db:migrate
```

## Appendix - Source Plan
Reference: docs/plan.md (complete model spec and normalization details).

