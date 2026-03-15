# AC Control PWA – Backend API Specification

Base URL: `https://iot-ac.c024.click`

---

## Overview

The PWA expects a REST API backend with the following capabilities:

| Area           | Endpoints                                      | Auth Required |
| -------------- | ---------------------------------------------- | ------------- |
| Health Check   | `GET /api/ping`                                | No            |
| Authentication | `POST /api/login`                              | No            |
| Device List    | `GET /api/devices`                             | Yes           |
| AC Status      | `GET /api/status?id=<deviceId>`                | No\*          |
| AC Control     | `POST /api/on`, `POST /api/off`                | Yes           |
| Scheduling     | `POST/GET /api/schedule`, `DELETE /api/schedule/:id` | Yes     |

\* Status currently works without auth, but the frontend sends the session header if available.

---

## CORS

The backend **must** return proper CORS headers for cross-origin requests from the PWA origin:

```
Access-Control-Allow-Origin: <pwa-origin or *>
Access-Control-Allow-Headers: Content-Type, x-session-id
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
```

All endpoints should handle `OPTIONS` preflight requests.

---

## Health Check

### GET /api/ping

Lightweight endpoint used by the frontend to verify the API server is reachable before showing the login form. No authentication required.

**Auth:** None

**Success (200):**

```json
{ "status": 1, "message": "pong" }
```

If the server is unreachable (network error, DNS failure, server down), the fetch will throw a `TypeError`. The frontend catches this and shows a "server unavailable" screen instead of the login form.

---

## Authentication

### POST /api/login

Create a new session.

**Auth:** None

**Request:**

```
Content-Type: application/json
```

```json
{
  "username": "string (required)",
  "password": "string (required)"
}

```

Also accepts `application/x-www-form-urlencoded`.

**Success (200):**

```json
{
  "status": 1,
  "message": "Login successful",
  "sessionId": "uuid-string"
}
```

**Failure (200):**

```json
{ "status": 0, "message": "Username and password are required" }
{ "status": 0, "message": "Invalid credentials" }
```

**Session rules:**
- `sessionId` is a UUID, valid for **30 days**.
- The frontend stores it in `localStorage` and sends it via the `x-session-id` request header on all subsequent authenticated requests.
- If a session expires or is invalid, return HTTP `401`.

---

## Session Authentication

All endpoints marked "Auth Required" expect the session ID in **one** of:

| Method          | Location                  |
| --------------- | ------------------------- |
| **Header**      | `x-session-id: <uuid>`    |
| **JSON body**   | `{ "sessionId": "<uuid>" }` |

The frontend uses the header method. If the session is missing or invalid, respond with:

```
HTTP 401
```

```json
{ "status": 0, "message": "Unauthorized – valid session required" }
```

---

## Device Management

### GET /api/devices

Return all devices owned by the authenticated user.

**Auth:** `x-session-id` header

**Success (200):**

```json
{
  "status": 1,
  "devices": [
    {
      "id": "string (unique device ID)",
      "name": "string (display name, e.g. 'Living Room AC')",
      "power": "on | off"
    }
  ]
}
```

**Notes:**
- Each user can own up to 10 devices.
- `power` reflects the last known state (`"on"` or `"off"`).
- The frontend renders these as clickable cards on the dashboard.

### Device Data Schema

```
Device {
  id:       string    // unique identifier (UUID or similar)
  name:     string    // user-facing display name
  power:    string    // "on" or "off" — last known power state
  ownerId:  string    // references the owning user
}
```

---

## AC Status

### GET /api/status

Read the current state of a specific AC unit. **No auth required.**

**Query parameters:**

| Param | Type   | Required | Description          |
| ----- | ------ | -------- | -------------------- |
| `id`  | string | Yes      | The target device ID |

**Example:** `GET /api/status?id=abc123`

**Success (200):**

```json
{
  "power": "off",
  "temperature": 24,
  "mode": "cool",
  "fan": "auto"
}
```

| Field         | Type   | Values                           |
| ------------- | ------ | -------------------------------- |
| `power`       | string | `"on"`, `"off"`                  |
| `temperature` | number | Current set temperature (°C)     |
| `mode`        | string | `"cool"`, `"heat"`, `"fan"`, `"auto"`, `"dry"` |
| `fan`         | string | `"auto"`, `"low"`, `"medium"`, `"high"` |

**Failure (502):**

```json
{
  "error": "Unable to reach AC hardware",
  "details": "Connection to ac-internal-ip timed out"
}
```

---

## AC Control

Both endpoints require session auth and a device ID in the JSON body.

### POST /api/on

Turn a device on.

**Auth:** `x-session-id` header

**Request:**

```json
{ "id": "device-id-string" }
```

**Success (200):**

```json
{
  "status": 1,
  "message": "AC turned ON",
  "hardware": { "power": "on" }
}
```

### POST /api/off

Turn a device off.

**Auth:** `x-session-id` header

**Request:**

```json
{ "id": "device-id-string" }
```

**Success (200):**

```json
{
  "status": 1,
  "message": "AC turned OFF",
  "hardware": { "power": "off" }
}
```

### Shared Failure Responses

| Status | Body |
| ------ | ---- |
| 401    | `{ "status": 0, "message": "Unauthorized – valid session required" }` |
| 502    | `{ "error": "Unable to reach AC hardware", "details": "..." }` |

**Security:** The backend **must** verify the authenticated user owns the device identified by `id` before executing the command.

---

## Scheduling

### POST /api/schedule

Create a delayed on/off schedule for a device.

**Auth:** `x-session-id` header

**Request:**

```json
{
  "id": "device-id-string",
  "action": "on | off",
  "delayMinutes": 20
}
```

| Field          | Type   | Required | Validation              |
| -------------- | ------ | -------- | ----------------------- |
| `id`           | string | Yes      | Must belong to user     |
| `action`       | string | Yes      | `"on"` or `"off"` only  |
| `delayMinutes` | number | Yes      | Must be > 0             |

**Success (200):**

```json
{
  "status": 1,
  "message": "AC will turn on in 20 minutes",
  "id": "schedule-uuid",
  "executeAt": "2026-03-14T15:30:00.000Z"
}
```

**Failure:**

| Status | Body |
| ------ | ---- |
| 400    | `{ "status": 0, "message": "action must be \"on\" or \"off\"" }` |
| 400    | `{ "status": 0, "message": "delayMinutes must be a positive number" }` |
| 401    | `{ "status": 0, "message": "Unauthorized – valid session required" }` |

### GET /api/schedule

List active schedules for a device.

**Auth:** `x-session-id` header

**Query parameters:**

| Param | Type   | Required | Description          |
| ----- | ------ | -------- | -------------------- |
| `id`  | string | Yes      | The target device ID |

**Example:** `GET /api/schedule?id=abc123`

**Success (200):**

```json
{
  "status": 1,
  "schedules": [
    {
      "id": "schedule-uuid",
      "action": "on",
      "executeAt": "2026-03-14T15:30:00.000Z",
      "userId": 1
    }
  ]
}
```

### DELETE /api/schedule/:id

Cancel a pending schedule.

**Auth:** `x-session-id` header

**URL parameter:** `:id` — the schedule UUID to cancel.

**Success (200):**

```json
{ "status": 1, "message": "Schedule cancelled" }
```

**Failure:**

| Status | Body |
| ------ | ---- |
| 404    | `{ "status": 0, "message": "Schedule not found" }` |
| 401    | `{ "status": 0, "message": "Unauthorized – valid session required" }` |

---

## Security Checklist

The backend must enforce these rules:

1. **Session validation** — every authenticated endpoint checks `x-session-id` (or body `sessionId`) against a sessions store. Return `401` if missing, expired, or invalid.
2. **Device ownership** — before executing any command (`/api/on`, `/api/off`, `/api/schedule`), verify the authenticated user's `userId` matches the device's `ownerId`. Return `401` or `403` if not.
3. **Input validation** — sanitize `action`, `delayMinutes`, and `id` fields. Reject unknown values.
4. **Session expiry** — sessions expire after 30 days. Clean up expired sessions periodically.
5. **Rate limiting** — recommended on `/api/login` to prevent brute-force attacks.

---

## Suggested Database Schema

### Users

| Column       | Type    | Notes               |
| ------------ | ------- | ------------------- |
| `id`         | INTEGER | Primary key         |
| `username`   | TEXT    | Unique, required    |
| `password`   | TEXT    | Hashed (bcrypt)     |

### Sessions

| Column       | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| `id`         | UUID     | Primary key (the sessionId)     |
| `userId`     | INTEGER  | FK → users.id                   |
| `createdAt`  | DATETIME | Used for 30-day expiry check    |

### Devices

| Column       | Type    | Notes                         |
| ------------ | ------- | ----------------------------- |
| `id`         | UUID    | Primary key                   |
| `name`       | TEXT    | Display name                  |
| `power`      | TEXT    | `"on"` or `"off"`             |
| `ownerId`    | INTEGER | FK → users.id                 |
| `hardwareIp` | TEXT    | Internal IP of the AC unit    |

### Schedules

| Column         | Type     | Notes                              |
| -------------- | -------- | ---------------------------------- |
| `id`           | UUID     | Primary key                        |
| `deviceId`     | UUID     | FK → devices.id                    |
| `userId`       | INTEGER  | FK → users.id                      |
| `action`       | TEXT     | `"on"` or `"off"`                  |
| `executeAt`    | DATETIME | When the action should fire        |
| `executed`     | BOOLEAN  | Whether it has already been run    |

---

## PWA Frontend Request Summary

Every request the frontend makes, for quick backend implementation reference:

```
GET /api/ping                              ← startup health check
  → 200 { status, message }
  → TypeError (server unreachable)         ← frontend shows offline screen

POST /api/login
  Body: { username, password }
  → 200 { status, message, sessionId }

GET /api/devices
  Header: x-session-id
  → 200 { status, devices: [{ id, name, power }] }

GET /api/status?id=<deviceId>
  Header: x-session-id (optional)
  → 200 { power, temperature, mode, fan }

POST /api/on
  Header: x-session-id, Content-Type: application/json
  Body: { id }
  → 200 { status, message, hardware }

POST /api/off
  Header: x-session-id, Content-Type: application/json
  Body: { id }
  → 200 { status, message, hardware }

POST /api/schedule
  Header: x-session-id, Content-Type: application/json
  Body: { id, action, delayMinutes }
  → 200 { status, message, id, executeAt }

GET /api/schedule?id=<deviceId>
  Header: x-session-id
  → 200 { status, schedules: [{ id, action, executeAt, userId }] }

DELETE /api/schedule/:scheduleId
  Header: x-session-id
  → 200 { status, message }
```
