# Notepanda

A collaborative note-taking and document curation platform for students. Notepanda replaces ad-hoc file sharing over WhatsApp and similar channels with a structured, permanent, community-driven system where notes and documents can be created, organised, shared, and improved over time.

## The Problem

Students often share notes, practice questions, and study guides informally—mainly via WhatsApp groups. Materials get buried in chat history, there’s no way to improve or version shared files, and every cohort starts from scratch with no shared, searchable library. Notepanda provides a single place for note creation, real-time collaboration, structured organisation, and community curation.

## Features

- **Notes** — Rich-text editor (Tiptap) with headings, lists, tables, code blocks, and more. Create, edit, and set notes as public or private.
- **Collaboration** — Invite others as viewers, commenters, or editors on notes and modules. Share via email.
- **Modules** — Group related notes and documents. Add category labels and control visibility (public/private).
- **Explore** — Discover public notes and modules with server-side search and category filters.
- **Saved** — Save notes and modules to a personal collection.
- **Export** — Export notes as `.txt`, `.md`, or HTML.
- **Fork** — Copy any public note into your own editable version.
- **Auth** — Email/password registration and login; optional Google OAuth when configured.

## Tech Stack

| Layer     | Technology                          |
|----------|-------------------------------------|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Editor   | Tiptap (StarterKit, Underline, Table, Placeholder) |
| Backend  | Express.js, TypeScript              |
| Database | PostgreSQL, Drizzle ORM             |
| Auth     | Passport.js (local + Google OAuth), express-session, connect-pg-simple |

## Project Structure

```
client/src/
  App.tsx, main.tsx     — App shell, routing (wouter), auth gate
  lib/                  — auth context, TanStack Query, utils
  pages/                — dashboard, notes, note-editor, modules, explore, saved, auth
  components/           — app-sidebar, editor-toolbar, share-dialog, shadcn/ui

server/
  index.ts              — Express server, static serve, WebSocket
  routes.ts             — API route handlers
  auth.ts               — Passport (local + Google), session config
  storage.ts            — DB access (IStorage)
  db.ts                 — Drizzle + pg connection
  seed.ts               — Seed script

shared/
  schema.ts             — Drizzle schema (users, notes, modules, moduleItems, savedItems, collaborators)
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (local or hosted; set `DATABASE_URL`)

### Install

```bash
npm install
```

### Environment

Create a `.env` (or set in your environment):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/notepanda`) |
| `SESSION_SECRET` | No | Secret for session cookies (defaults to a dev value if unset) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID (enables “Sign in with Google”) |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `PORT` | No | Server port (default `5000`) |

### Database

Push the Drizzle schema to your database:

```bash
npm run db:push
```

Optional: run the seed script to create sample users and content (see `server/seed.ts`).

### Development

```bash
npm run dev
```

Runs the Express server with Vite in dev mode. Open the URL shown (e.g. `http://localhost:5000`).

### Build & production

```bash
npm run build
npm start
```

Serves the built client and API from the same process.

## API Overview

- **Auth** — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/google`, `GET /api/auth/google/callback`
- **Notes** — `GET|POST /api/notes`, `GET|PATCH|DELETE /api/notes/:id`, `POST /api/notes/:id/fork`, `GET /api/notes/:id/export?format=txt|md|pdf`, collaborators CRUD
- **Modules** — `GET|POST /api/modules`, `GET|PATCH|DELETE /api/modules/:id`, items and collaborators
- **Explore** — `GET /api/explore/notes`, `GET /api/explore/modules`, `GET /api/explore/categories` (query params: `q`, `category`)
- **Saved** — `GET|POST /api/saved`, `DELETE /api/saved/:id`

See `replit.md` in the repo for a more detailed API list.

## Product spec

Full product requirements, user stories, and non-functional requirements are in **Notepanda_PRD_v1.1.md**.

## License

MIT
