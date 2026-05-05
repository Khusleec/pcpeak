# Quick Start Guide

## 🚀 Start the Platform

### Option 1: Basic Stack (Core Services Only)
```bash
docker compose up --build -d
```

### Option 2: Full Stack (With Observability)
```bash
docker compose -f infra/docker-compose.full.yml up --build -d
```

### Option 3: Production Stack (All Services)
```bash
docker compose up --build -d
docker compose -f infra/docker-compose.observability.yml up --build -d
```

## 📊 Access Services

After starting the stack, access these services:

### Core Services
- **Frontend**: http://localhost:3000
- **Core API**: http://localhost:8080
- **API Health**: http://localhost:8080/health
- **API Metrics**: http://localhost:8080/metrics

### Observability Stack (if using full stack)
- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Jaeger Tracing**: http://localhost:16686

### Database
- **PostgreSQL**: localhost:5432
- **Connection String**: postgresql://postgres:password@localhost:5432/esportatlas

## 🧪 Run Tests

### Frontend Tests
```bash
cd frontend
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Generate coverage report
npm run test:e2e          # Run E2E tests with Playwright
```

### Backend Tests
```bash
cd backend/core-api
npm test                  # Run unit and integration tests
```

### Performance Tests
```bash
# Requires k6 installed
k6 run infra/tests/performance/load-test.js
```

## 🔒 Test Security Features

### Test Rate Limiting
```bash
# Try making many requests to an endpoint
for i in {1..20}; do curl http://localhost:8080/api/v1/pcs; done
# Should hit rate limit after 100 requests per 15 minutes
```

### Test Authentication
```bash
# Register new user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","fullName":"Test User"}'

# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## 📈 View Observability Data

### Grafana Dashboards
1. Go to http://localhost:3001
2. Login with admin/admin123
3. Add Prometheus as data source (http://prometheus:9090)
4. Import dashboards from `infra/monitoring/grafana/dashboards/`

### Prometheus Metrics
- Go to http://localhost:9090
- Query metrics like:
  - `http_request_duration_seconds`
  - `http_requests_total`
  - `active_connections`
  - `booking_operations_total`

### View Logs
```bash
# View API logs
docker logs esportatlas-core-api -f

# View database logs
docker logs esportatlas-postgres -f

# View all services
docker compose logs -f
```

## 🛠️ Development Workflow

### Frontend Development
```bash
cd frontend
npm run dev              # Start dev server with hot reload
```

### Backend Development
```bash
cd backend/core-api
npm run dev              # Start API with file watching
```

### Database Operations
```bash
# Connect to database
docker exec -it esportatlas-postgres psql -U postgres -d esportatlas

# View tables
\dt

# View users
SELECT * FROM users;

# Reset database
docker compose down -v
docker compose up --build
```

## 🚀 Deploy to Production

### Build Images
```bash
docker compose build
```

### Deploy to Kubernetes
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
```

### Check Deployment Status
```bash
kubectl get pods -n esportatlas
kubectl get services -n esportatlas
```

## 🔍 Troubleshooting

### Services Won't Start
```bash
# Check logs
docker compose logs

# Check port conflicts
netstat -ano | findstr :3000
netstat -ano | findstr :8080
```

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec -it esportatlas-postgres pg_isready -U postgres
```

### Test Failures
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install

# Run tests in verbose mode
npm run test -- --reporter=verbose
```

## 📚 Documentation

- **Architecture**: [docs/ARCHITECTURE_DECISION_RECORDS.md](docs/ARCHITECTURE_DECISION_RECORDS.md)
- **Developer Guide**: [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)
- **API Documentation**: [docs/API.md](docs/API.md)
- **Deployment**: [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md)

## 🎯 Key Features to Try

1. **Authentication**: Register and login with JWT tokens
2. **Booking System**: Create and manage PC bookings
3. **Admin Dashboard**: Manage users and view analytics
4. **Rate Limiting**: Test API rate limiting
5. **Caching**: Observe cache hit/miss ratios
6. **Monitoring**: View real-time metrics in Grafana
7. **Security**: Test input validation and security headers

## 🆘 Getting Help

- Check logs: `docker compose logs -f`
- Review documentation in `docs/` folder
- Check GitHub issues
- Review test files for usage examples
