# Notepanda

A collaborative note-taking and document curation platform for students. Replaces ad-hoc file sharing over WhatsApp with a structured, permanent, community-driven system.

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Passport.js with local strategy (email/password), session-based with connect-pg-simple

## Project Structure
```
client/src/
  App.tsx          - Root component with routing and auth
  lib/auth.tsx     - Auth context provider and useAuth hook
  lib/queryClient.ts - TanStack Query setup
  pages/
    auth.tsx       - Login/register page
    dashboard.tsx  - Dashboard with stats and recent items
    notes-list.tsx - Notes listing page
    note-editor.tsx - Note creation/editing
    modules-list.tsx - Modules listing
    module-detail.tsx - Module detail with notes
    explore.tsx    - Public content discovery
    saved.tsx      - Saved collection
  components/
    app-sidebar.tsx - Navigation sidebar

server/
  index.ts         - Express server setup
  routes.ts        - API route handlers
  auth.ts          - Auth setup (passport, sessions)
  storage.ts       - Database storage layer (IStorage interface)
  db.ts            - Database connection
  seed.ts          - Seed data

shared/
  schema.ts        - Drizzle schema (users, notes, modules, moduleItems, savedItems, collaborators)
```

## Database Schema
- **users**: id, username, email, password, displayName, avatar
- **notes**: id, title, content, ownerId, isPublic, createdAt, updatedAt, forkedFromId
- **modules**: id, title, description, ownerId, isPublic, categoryLabels[], createdAt, updatedAt
- **module_items**: id, moduleId, noteId, orderIndex
- **saved_items**: id, userId, noteId, moduleId, savedAt
- **collaborators**: id, noteId, moduleId, userId, role

## API Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `GET/POST /api/notes` - List/create notes
- `GET/PATCH/DELETE /api/notes/:id` - Get/update/delete note
- `POST /api/notes/:id/fork` - Fork a public note
- `GET/POST /api/modules` - List/create modules
- `GET/PATCH/DELETE /api/modules/:id` - Get/update/delete module
- `POST /api/modules/:id/items` - Add note to module
- `DELETE /api/modules/:id/items/:noteId` - Remove note from module
- `GET /api/explore/notes` - Public notes
- `GET /api/explore/modules` - Public modules
- `GET/POST /api/saved` - List/save items
- `DELETE /api/saved/:id` - Remove saved item

## Seed Data
- 3 sample users (mary@university.edu, alex@university.edu, sarah@university.edu) - password: password123
- 6 notes (5 public, 1 private) covering CS, Math, OS, and DB topics
- 3 modules with category labels
