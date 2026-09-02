# Project Manager API

A small Express + Prisma/PostgreSQL backend for managing projects, tasks, and per-project membership.

## Tech stack

- **Express 5** — HTTP layer
- **Prisma 7** (`@prisma/adapter-pg`) — ORM over PostgreSQL
- **Zod** — request body validation
- **JWT** (`jsonwebtoken`) + **bcrypt** — authentication
- **Vitest** + **Supertest** — integration tests (run against a real database, not mocks)

## Prerequisites

- Node.js
- Docker (for the local Postgres instance), or your own PostgreSQL database

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start Postgres:
   ```
   docker compose up -d
   ```
   This starts Postgres 17 on `localhost:5433` (see `docker-compose.yml`).

3. Copy the env file and fill in a real `JWT_SECRET`:
   ```
   cp .env.example .env
   ```

4. Apply the database schema:
   ```
   npx prisma migrate dev
   ```

5. Start the dev server:
   ```
   npm run dev
   ```
   The API listens on `http://localhost:3000`.

## Environment variables

| Variable       | Description                                      |
|----------------|---------------------------------------------------|
| `DATABASE_URL` | Postgres connection string                         |
| `JWT_SECRET`   | Secret used to sign/verify auth tokens (HS256)     |

Tests read from `.env.test` instead of `.env` (see `vitest.setup.ts`) — point it at a database you're okay with tests writing to.

## Scripts

| Command        | Description                          |
|----------------|---------------------------------------|
| `npm run dev`  | Start the server with hot reload      |
| `npm test`     | Run the Vitest/Supertest suite        |

## Authentication & authorization

- `POST /auth/register` and `POST /auth/login` issue a JWT (`Authorization: Bearer <token>`, 2h expiry) carrying the user's id as `sub`.
- Project-scoped routes are protected by two layers of middleware:
  - `auth` — verifies the JWT.
  - `requireProjectMember` / `requireProjectOwner` — checks the caller's `ProjectMember` row for the target project. A project has two roles: `OWNER` and `MEMBER`. The user who creates a project is automatically added as its `OWNER`.

## API overview

**Auth** (`/auth`)
| Method | Path        | Auth | Description            |
|--------|-------------|------|-------------------------|
| POST   | `/register` | —    | Create an account        |
| POST   | `/login`    | —    | Get a JWT                |
| GET    | `/me`       | ✓    | Current user's profile   |

**Projects** (`/project`)
| Method | Path                | Auth        | Description                              |
|--------|---------------------|-------------|--------------------------------------------|
| GET    | `/`                 | any user    | List all projects (temporary/admin route)  |
| GET    | `/:id`              | member      | Get a project                              |
| POST   | `/`                 | any user    | Create a project (creator becomes owner)   |
| POST   | `/:id/members`      | owner       | Add a user to the project by email         |
| GET    | `/:id/tasks`        | member      | List a project's tasks                     |
| POST   | `/:id/tasks`        | owner       | Create a task                              |
| PATCH  | `/tasks/:taskId`    | owner       | Update a task                              |
| DELETE | `/tasks/:taskId`    | owner       | Delete a task                              |

## Project structure

```
src/
  routes/          Express routers
  middleware/       auth, authorization, request loaders, validation
  validators/       Zod schemas per resource
  generated/prisma/  Prisma client (generated, do not edit)
prisma/
  schema.prisma      Data model
lib/prisma.ts        Prisma client instance
```
