# Architecture Decision Records (ADRs)

This document contains architectural decisions made during the development of EsportAtlas.

## ADR-001: Technology Stack Selection

**Status**: Accepted  
**Date**: 2024-01-15  
**Decision**: Adopt React + TypeScript + Node.js + PostgreSQL stack

### Context
We needed to select a technology stack that supports:
- Real-time features for booking system
- Complex user permissions (RBAC)
- High performance for esports data
- Strong type safety
- Good developer experience

### Decision
- **Frontend**: React 19 with TypeScript, Vite, TailwindCSS
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with parameterized queries
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Zod schemas

### Consequences
- Strong type safety across the stack
- Excellent developer experience with hot reload
- Good performance with proper caching
- Secure by default with built-in protections

---

## ADR-002: Microservices vs Monolith

**Status**: Accepted  
**Date**: 2024-01-20  
**Decision**: Start with monolithic SOA, prepare for microservices migration

### Context
Needed to decide between:
1. Full microservices from day one
2. Monolithic application with service boundaries
3. Pure monolith

### Decision
Adopt Service-Oriented Architecture (SOA) within a monolith:
- `core-api/`: Main API service
- `agent-worker/`: Background processing
- Shared database with clear service boundaries
- Docker containers for each service

### Consequences
- Easier initial development and deployment
- Clear migration path to microservices
- Shared database simplifies transactions
- Can scale individual services independently

---

## ADR-003: Authentication Strategy

**Status**: Accepted  
**Date**: 2024-01-25  
**Decision**: JWT-based stateless authentication with RBAC

### Context
Requirements:
- Secure authentication across web and mobile
- Role-based access control (Admin, Moderator, User)
- Stateless for scalability
- Easy integration with external services

### Decision
- JWT tokens with configurable expiration
- bcrypt for password hashing
- Role-based permissions stored in database
- Middleware for route protection

### Consequences
- Stateless authentication scales well
- Easy to implement token refresh
- Clear permission model
- Requires careful token management

---

## ADR-004: Database Schema Design

**Status**: Accepted  
**Date**: 2024-02-01  
**Decision**: Normalized relational schema with UUID primary keys

### Context
Needed to model:
- Users and roles (many-to-many)
- Tournaments with seasons
- Teams and matches
- PC cafes and hardware specs
- Booking system with time slots

### Decision
- UUID primary keys for all entities
- Proper foreign key constraints
- Check constraints for data integrity
- Indexes for query performance
- Audit timestamps on all tables

### Consequences
- Strong data integrity
- Good query performance with proper indexes
- Easy to scale horizontally
- Clear relationships between entities

---

## ADR-005: Caching Strategy

**Status**: Accepted  
**Date**: 2024-02-10  
**Decision**: Multi-tier caching with different TTLs

### Context
Performance requirements:
- Fast API responses for static data
- Real-time data for bookings
- Cache invalidation on updates
- Minimal cache staleness

### Decision
- In-memory caching with NodeCache
- Different TTL tiers (1min, 5min, 1hour)
- Cache middleware for GET endpoints
- Intelligent cache invalidation
- Cache hit/miss metrics

### Consequences
- Significant performance improvement
- Reduced database load
- Complex cache invalidation logic
- Need to monitor cache effectiveness

---

## ADR-006: Observability Implementation

**Status**: Accepted  
**Date**: 2024-02-15  
**Decision**: Comprehensive observability with Prometheus + Grafana

### Context
Production monitoring needs:
- Application metrics
- Request tracing
- Error tracking
- Performance monitoring
- Business metrics

### Decision
- Prometheus for metrics collection
- Grafana for visualization
- Pino for structured logging
- Custom middleware for request tracking
- Business event logging

### Consequences
- Full observability stack
- Easy to troubleshoot issues
- Performance insights
- Additional infrastructure complexity

---

## ADR-007: Testing Strategy

**Status**: Accepted  
**Date**: 2024-02-20  
**Decision**: Multi-layer testing with coverage requirements

### Context
Quality requirements:
- Reliable deployments
- Prevent regressions
- Test user interactions
- Validate API contracts

### Decision
- Unit tests with Vitest (80% coverage threshold)
- Integration tests for API endpoints
- E2E tests with Playwright
- Component testing for UI
- Automated test reporting

### Consequences
- High code quality
- Confidence in deployments
- Longer development cycles
- Maintenance overhead for tests

---

## ADR-008: Security Hardening

**Status**: Accepted  
**Date**: 2024-02-25  
**Decision**: Defense-in-depth security approach

### Context
Security requirements:
- Protect user data
- Prevent common attacks
- Audit trails
- Rate limiting
- Input validation

### Decision
- Helmet for security headers
- Express rate limiting
- Input validation with Zod
- Security event logging
- SQL injection prevention
- Audit logs for sensitive operations

### Consequences
- Strong security posture
- Comprehensive audit trails
- Additional middleware complexity
- Need for security monitoring
