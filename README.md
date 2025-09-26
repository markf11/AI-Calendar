# Momentum Calendar - Backend

AI-powered calendar and task management system that eliminates the cognitive load of manual planning by consolidating your entire digital life into a single, optimized, and dynamically adjusting schedule.

## 🚀 Features

- **Unified Calendar Integration**: Bi-directional sync with Google Calendar and Microsoft 365
- **AI-Powered Scheduling**: Automatic task placement using intelligent algorithms
- **Dynamic Rescheduling**: Real-time schedule optimization when changes occur
- **Project Management**: Organize tasks into projects with dependency tracking
- **Meeting Booking**: Customizable booking links with intelligent availability
- **Cross-Platform Support**: Web, desktop, and mobile applications
- **Real-time Synchronization**: Live updates across all connected devices

## 🏗️ Architecture

The system follows a microservices architecture with:

- **Frontend Layer**: React web app, Electron desktop app, React Native mobile apps
- **API Gateway**: Express.js with authentication and rate limiting
- **Backend Services**: Modular services for different business domains
- **Data Layer**: PostgreSQL for relational data, Redis for caching and real-time features
- **External Integrations**: Google Calendar API, Microsoft Graph API

## 📋 Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 13+
- Redis 6+
- Google Calendar API credentials
- Microsoft Graph API credentials

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd momentum-calendar-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb momentum
   
   # Run migrations
   npm run migrate
   ```

5. **Start Redis**
   ```bash
   redis-server
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
src/
├── api/                    # API routes and controllers
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Express middleware
│   └── routes/            # Route definitions
├── config/                # Configuration files
│   ├── database.ts        # Database configuration
│   ├── redis.ts          # Redis configuration
│   ├── environment.ts     # Environment variables
│   └── migrations.ts      # Migration runner
├── models/                # Data models and interfaces
│   ├── User.ts           # User entity
│   ├── Task.ts           # Task entity
│   ├── Project.ts        # Project entity
│   ├── CalendarEvent.ts  # Calendar event entity
│   ├── BookingLink.ts    # Booking link entity
│   └── types.ts          # Supporting types
├── repositories/          # Data access layer
├── services/             # Business logic services
├── utils/                # Utility functions
│   ├── dateUtils.ts      # Date manipulation utilities
│   ├── validation.ts     # Input validation schemas
│   └── encryption.ts     # Encryption utilities
└── index.ts              # Application entry point
```

## 🗄️ Database Schema

The application uses PostgreSQL with the following main entities:

- **users**: User accounts and preferences
- **calendar_connections**: External calendar integrations
- **projects**: Project containers for tasks
- **tasks**: Individual tasks with scheduling metadata
- **task_dependencies**: Task dependency relationships
- **calendar_events**: Calendar events from all sources
- **scheduled_slots**: AI-generated task scheduling
- **booking_links**: Meeting booking configurations
- **booking_records**: Meeting booking history

## 🔧 Configuration

### Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=momentum
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Google Calendar API
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Microsoft Graph API
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
```

### API Credentials Setup

1. **Google Calendar API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs

2. **Microsoft Graph API**:
   - Go to [Azure Portal](https://portal.azure.com/)
   - Register a new application
   - Configure API permissions for Calendar
   - Generate client secret

## 🚀 Development

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start           # Start production server
npm test            # Run tests
npm run test:watch  # Run tests in watch mode
npm run migrate     # Run database migrations
npm run lint        # Run ESLint
npm run type-check  # Run TypeScript type checking
```

### API Endpoints

The API will be available at `http://localhost:3000/api` with the following main routes:

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/tasks` - Get user tasks
- `POST /api/tasks` - Create new task
- `GET /api/projects` - Get user projects
- `POST /api/calendar/sync` - Sync external calendars
- `POST /api/booking/links` - Create booking link

### Database Migrations

To create a new migration:

1. Create a new SQL file in `migrations/` directory
2. Name it with format: `XXX_description.sql`
3. Run `npm run migrate` to apply

## 🧪 Testing

The project uses Jest for testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🔒 Security

- JWT-based authentication with refresh tokens
- Password hashing using bcrypt
- Data encryption at rest for sensitive information
- Rate limiting on API endpoints
- CORS configuration for cross-origin requests
- Input validation using Joi schemas

## 📊 Performance

- Redis caching for frequently accessed data
- Database indexing for optimal query performance
- Connection pooling for database connections
- Compression middleware for API responses
- Efficient scheduling algorithms with O(n log n) complexity

## 🚀 Deployment

### Production Checklist

1. Set `NODE_ENV=production`
2. Configure production database
3. Set up Redis cluster
4. Configure SSL certificates
5. Set up monitoring and logging
6. Configure backup strategies
7. Set up CI/CD pipeline

### Docker Support

```dockerfile
# Dockerfile example (to be created in subsequent tasks)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 📝 API Documentation

Detailed API documentation will be available at `/api/docs` when the application is running (to be implemented in subsequent tasks).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation
- Review the API endpoints

## 🗺️ Roadmap

- [ ] Complete API implementation
- [ ] Add comprehensive test coverage
- [ ] Implement WebSocket real-time features
- [ ] Add monitoring and analytics
- [ ] Create Docker containers
- [ ] Set up CI/CD pipeline
- [ ] Add API documentation
- [ ] Implement advanced AI scheduling features