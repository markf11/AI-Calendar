# Project Structure & Architecture

## Folder Organization

```
src/
├── api/                    # API layer (routes, controllers, middleware)
│   ├── controllers/        # Request handlers and business logic coordination
│   ├── middleware/         # Express middleware (auth, validation, etc.)
│   └── routes/            # Route definitions and endpoint mapping
├── config/                # Configuration and setup
│   ├── database.ts        # PostgreSQL connection and pool management
│   ├── redis.ts          # Redis connection and caching setup
│   ├── environment.ts     # Environment variable validation and config
│   └── migrations.ts      # Database migration runner
├── models/                # Data models and type definitions
│   ├── User.ts           # User entity and related types
│   ├── Task.ts           # Task entity and scheduling types
│   ├── Project.ts        # Project entity and organization types
│   ├── CalendarEvent.ts  # Calendar event entity
│   ├── BookingLink.ts    # Meeting booking entity
│   └── types.ts          # Shared types and enums
├── repositories/          # Data access layer (database queries)
├── services/             # Business logic services
├── utils/                # Utility functions and helpers
│   ├── dateUtils.ts      # Date manipulation and timezone handling
│   ├── validation.ts     # Joi validation schemas
│   └── encryption.ts     # Data encryption utilities
└── scripts/              # Standalone scripts (migrations, etc.)
```

## Architecture Patterns

### Layered Architecture
- **API Layer**: Express routes, controllers, and middleware
- **Service Layer**: Business logic and external integrations
- **Repository Layer**: Data access and database operations
- **Model Layer**: Type definitions and data structures

### Design Principles
- **Separation of Concerns**: Each layer has distinct responsibilities
- **Dependency Injection**: Services and repositories are injected into controllers
- **Single Responsibility**: Each module focuses on one specific domain
- **Interface Segregation**: Use TypeScript interfaces for contracts

## Database Schema Conventions

### Table Naming
- Use snake_case for table and column names
- Plural table names (users, tasks, projects)
- Foreign key format: `{table}_id` (user_id, project_id)

### Primary Keys
- All tables use UUID primary keys with `uuid_generate_v4()`
- Consistent `id` column naming across all tables

### Timestamps
- All tables include `created_at` and `updated_at` columns
- Automatic timestamp updates via database triggers
- Use `TIMESTAMP WITH TIME ZONE` for all datetime fields

### JSON Storage
- Use JSONB for flexible schema fields (preferences, working_hours)
- Validate JSON structure at application level

## Code Organization Rules

### Import Structure
```typescript
// External libraries first
import express from 'express';
import { Pool } from 'pg';

// Internal imports with path aliases
import { User } from '@/models/User';
import { DatabaseService } from '@/services/DatabaseService';
import { validateUser } from '@/utils/validation';
```

### Error Handling
- Use consistent error response format across all endpoints
- Implement proper HTTP status codes
- Environment-specific error details (hide stack traces in production)

### Type Safety
- Strict TypeScript configuration with no implicit any
- Define interfaces for all API requests and responses
- Use discriminated unions for status enums

### Configuration Management
- All environment variables validated at startup
- Centralized configuration in `src/config/environment.ts`
- Required vs optional environment variables clearly defined