
# Camping Platform - Starter Repo

This starter repository contains a frontend (Vite + React + TypeScript + Tailwind) and a backend (Node + Express + TypeScript) scaffold,
plus Docker compose, basic SQL migrations, and sample routes. It's a production-ready starter to build an online camping/homestay/packaging platform.

## Quick start (local, requires Docker)

1. Clone or extract the repo
2. Copy `.env.example` -> `.env` and set variables
3. Run: `docker-compose up --build`
4. Open frontend at http://localhost:5173 and backend at http://localhost:4000

## Project structure
- frontend/ - Vite React app
- backend/ - Node Express API
- migrations/ - SQL schema
- docker-compose.yml - local dev stack (Postgres, Redis, API, web)

## Notes
- For production, use managed DB, object storage (S3), CDN, and autoscaling.
- Replace JWT secret and other secrets with env vars and a secret manager.
- Implement real authentication, input validation and secure file uploads before going live.

