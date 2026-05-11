# Developer Guide

This guide helps developers get started with EsportAtlas development.

## Quick Start

### Prerequisites
- Docker Desktop
- Node.js 18+
- Git
- VS Code (recommended)

### Local Development Setup

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd EsportAtlas
   cp .env.example .env
   ```

2. **Configure Environment**
   ```bash
   # Update .env with your secrets
   CORE_API_JWT_SECRET=your-secret-key
   POSTGRES_PASSWORD=your-db-password
   ```

3. **Start Development Stack**
   ```bash
   docker compose up --build -d
   ```

4. **Verify Services**
   - Frontend: http://localhost:3000
   - API: http://localhost:8080/health
   - Grafana: http://localhost:3001 (admin/admin123)

## Development Workflow

### Frontend Development

**Running Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Testing**
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
npm run test:e2e          # E2E tests
```

**Building**
```bash
npm run build             # Production build
npm run preview           # Preview build
```

### Backend Development

**Running API**
```bash
cd backend/core-api
npm install
npm run dev               # Development with hot reload
npm start                 # Production mode
```

**Testing**
```bash
npm test                  # Run tests
```

**Database Operations**
```bash
# Connect to database
docker exec -it esportatlas-postgres psql -U postgres -d esportatlas

# Reset database
docker compose down -v
docker compose up --build
```

## Code Standards

### Frontend

**Component Structure**
```typescript
// Component naming: PascalCase
// File naming: PascalCase.tsx
// Use TypeScript interfaces for props

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  onClick
}) => {
  return (
    <button className={cn(buttonVariants({ variant }))} onClick={onClick}>
      {children}
    </button>
  );
};
```

**State Management**
- Use React Context for global state
- Local state with useState/useReducer
- Server state with React Query/TanStack Query

**Styling**
- TailwindCSS for styling
- shadcn/ui components
- Consistent design tokens

### Backend

**File Structure**
```
src/
├── api/
│   ├── routes/          # Route definitions
│   ├── controllers/     # Business logic
│   └── middleware/      # Express middleware
├── config/              # Configuration
├── services/            # Business services
└── utils/               # Utility functions
```

**Code Style**
- Use ES modules (import/export)
- Async/await for asynchronous code
- Error handling with try/catch
- Input validation with Zod schemas

**Example Controller**
```javascript
export const createUser = async (req, res) => {
  try {
    const validatedData = createUserSchema.parse(req.body);
    const user = await userService.create(validatedData);
    
    logBusinessEvent('user_created', { userId: user.id }, user.id);
    
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    logError(error, { endpoint: 'createUser' });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
```

## Database

### Schema Management
- All schema changes in `backend/db/init/001_schema.sql`
- Use migrations for production changes
- Always add proper constraints and indexes

### Query Patterns
```javascript
// Use parameterized queries
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// Use transactions for multiple operations
await pool.query('BEGIN');
try {
  await pool.query('INSERT INTO bookings (...) VALUES (...)', [data]);
  await pool.query('UPDATE pcs SET status = $1 WHERE id = $2', ['BUSY', pcId]);
  await pool.query('COMMIT');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
}
```

## Testing

### Frontend Testing
```typescript
// Component test example
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Backend Testing
```javascript
// API endpoint test
import { describe, it, beforeAll, afterAll } from 'node:test';
import { app } from '../api/app.js';

describe('POST /api/v1/auth/login', () => {
  it('should authenticate valid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'demo@mongolpc.mn',
        password: 'user123'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.data.token).toBeDefined();
  });
});
```

## Debugging

### Frontend
- Use React DevTools
- Network tab for API calls
- Console for errors
- VS Code debugger

### Backend
- Use VS Code Node.js debugger
- Check logs in Docker containers
- Use Postman/Insomnia for API testing
- Database queries with psql

```bash
# View logs
docker logs esportatlas-core-api
docker logs esportatlas-postgres

# Debug database
docker exec -it esportatlas-postgres psql -U postgres -d esportatlas
```

## Performance

### Frontend Optimization
- Code splitting with lazy loading
- Image optimization
- Bundle analysis
- Cache headers

### Backend Optimization
- Database indexing
- Query optimization
- Caching strategies
- Connection pooling

### Monitoring
- Check Grafana dashboards
- Monitor response times
- Watch error rates
- Track business metrics

## Security

### Best Practices
- Never commit secrets
- Use environment variables
- Validate all inputs
- Implement rate limiting
- Use HTTPS in production

### Security Checklist
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Rate limiting implemented
- [ ] Security headers configured
- [ ] Audit logging enabled

## Deployment

### Local Deployment
```bash
docker compose up --build -d
```

### Production Deployment
```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Deploy to Kubernetes
kubectl apply -f k8s/
```

### Environment Variables
```bash
# Required for production
NODE_ENV=production
CORE_API_JWT_SECRET=<strong-secret>
DATABASE_URL=<production-db-url>
LOG_LEVEL=info
```

## Troubleshooting

### Common Issues

**Frontend build fails**
- Check TypeScript errors
- Verify imports
- Clear node_modules and reinstall

**API won't start**
- Check database connection
- Verify environment variables
- Check port conflicts

**Database connection errors**
- Verify PostgreSQL is running
- Check connection string
- Ensure database exists

**Tests failing**
- Check test environment setup
- Verify mock data
- Update snapshots if needed

### Getting Help
- Check this guide first
- Look at existing issues
- Ask in team channels
- Review documentation

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Ensure all tests pass
5. Submit pull request
6. Request code review

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] All tests pass
- [ ] New tests added
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
```
