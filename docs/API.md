# REST API Documentation

Base URL: `http://localhost:8080`

## Authentication

### POST `/api/v1/auth/register`

Creates a new user account with default role `User`.

### POST `/api/v1/auth/login`

Authenticates an existing user.

Response envelope for both endpoints:

```json
{
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "User Name",
    "isActive": true,
    "roles": ["User"]
  }
}
```

## Profile

### GET `/api/v1/users/me`

Auth required. Returns current authenticated user context.

## Admin / Moderator

### GET `/api/v1/admin/users?page=1&limit=20&search=indra`

Roles: `Admin`, `Moderator`.

Returns paginated users:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

## PC Discovery

### GET `/api/v1/pcs?gpu=RTX&district=Sukhbaatar`

Public endpoint. Returns PC inventory with cafe metadata.

### GET `/api/v1/pcs/{id}`

Public endpoint. Returns full detail for one PC node.

## Bookings

### GET `/api/v1/bookings/my`

Auth required. Returns booking history for current user.

### POST `/api/v1/bookings`

Auth required (`User`, `Moderator`, `Admin`).

Request:

```json
{
  "pcId": "uuid",
  "startTime": "2026-04-23T10:00:00.000Z",
  "endTime": "2026-04-23T12:00:00.000Z"
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "pcId": "uuid",
    "startTime": "2026-04-23T10:00:00.000Z",
    "endTime": "2026-04-23T12:00:00.000Z",
    "status": "ACTIVE"
  }
}
```

## Agent Command

### POST `/api/v1/agent/command`

Auth required. Executes a safe summary command handler.

Request:

```json
{
  "prompt": "system summary"
}
```

## Tournaments

### GET `/api/v1/tournaments?page=1&limit=10&season=2026&search=open`

Auth required. Supports server-side pagination and filtering.

### POST `/api/v1/tournaments`

Roles: `Admin`, `Moderator`.

## Error Envelope

```json
{
  "message": "Validation failed",
  "details": {}
}
```
