# Technology Stack

## Backend Framework
- **Node.js 18+** with **TypeScript 5.1+**
- **Express.js** for REST API with middleware for security, compression, and rate limiting
- **WebSocket** support for real-time features

## Database & Caching
- **PostgreSQL 13+** for primary data storage with JSONB for flexible schema
- **Redis 6+** for caching, session management, and real-time features
- Connection pooling with pg Pool for database efficiency

## Authentication & Security
- **JWT** tokens with refresh token rotation
- **bcryptjs** for password hashing
- **Helmet.js** for security headers
- **CORS** configuration for cross-origin requests
- **Rate limiting** with express-rate-limit
- **Data encryption** at rest using AES-256-GCM

## External Integrations
- **Google Calendar API** via googleapis package
- **Microsoft Graph API** via @azure/msal-node
- **OAuth 2.0** flows for calendar connections

## Development Tools
- **ESLint** with TypeScript rules for code quality
- **Prettier** for code formatting
- **Jest** for testing with ts-jest
- **ts-node-dev** for development hot reload

## Build System & Commands

### Development
```bash
npm run dev          # Start development server with hot reload
npm run type-check   # Run TypeScript type checking
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
```

### Testing
```bash
npm test            # Run all tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Database
```bash
npm run migrate     # Run database migrations
npm run migrate:rollback # Rollback last migration
```

### Production
```bash
npm run build       # Compile TypeScript to JavaScript
npm start          # Start production server
```

## Code Quality Standards
- Strict TypeScript configuration with all strict flags enabled
- Path aliases configured for clean imports (@/models, @/services, etc.)
- Comprehensive error handling with proper HTTP status codes
- Environment-based configuration management
- Graceful shutdown handling for database and Redis connections