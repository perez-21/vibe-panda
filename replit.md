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
    profile.tsx    - User profile settings (avatar, display name)
  components/
    app-sidebar.tsx - Navigation sidebar
    share-dialog.tsx - Collaborator sharing dialog
    editor-toolbar.tsx - Rich text editor toolbar

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
- **comment_threads**: id, noteId, fromPos, toPos, resolvedAt, createdAt
- **comments**: id, threadId, userId, content, createdAt

## API Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `GET /api/auth/google` - Initiate Google OAuth (requires GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET env vars)
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/google/enabled` - Check if Google OAuth is configured
- `PATCH /api/auth/profile` - Update display name
- `POST /api/auth/avatar` - Upload avatar (base64 data URI)
- `GET /api/notes/:id/modules` - Get user's module IDs containing this note
- `GET /api/notes/search/accessible?q=` - Search notes accessible to user (own + public + shared)
- `GET/POST /api/notes` - List/create notes
- `GET/PATCH/DELETE /api/notes/:id` - Get/update/delete note
- `POST /api/notes/:id/fork` - Fork a public note
- `GET /api/notes/:id/export?format=txt|md|pdf` - Export note (txt, markdown, or HTML document)
- `GET/POST/DELETE /api/notes/:id/collaborators` - Manage note collaborators (owner only)
- `GET/POST /api/modules` - List/create modules
- `GET/PATCH/DELETE /api/modules/:id` - Get/update/delete module
- `POST /api/modules/:id/items` - Add note to module
- `DELETE /api/modules/:id/items/:noteId` - Remove note from module
- `GET/POST/DELETE /api/modules/:id/collaborators` - Manage module collaborators (owner only)
- `GET/POST /api/notes/:id/comments` - List/create comment threads on a note
- `POST /api/notes/:id/comments/:threadId` - Reply to a comment thread
- `PATCH /api/notes/:id/comments/:threadId` - Resolve a comment thread (owner only)
- `DELETE /api/notes/:id/comments/:threadId` - Delete a comment thread (owner only)
- `GET /api/explore/notes?q=&category=` - Public notes with server-side search
- `GET /api/explore/modules?q=&category=` - Public modules with server-side search
- `GET /api/explore/categories` - Distinct category labels from public modules
- `GET/POST /api/saved` - List/save items
- `DELETE /api/saved/:id` - Remove saved item

## Features Added (Tier 1)
- **Note Export**: Export notes as .txt, .md, or .html via dropdown in note editor
- **Collaborators**: Invite users by email as viewer/commenter/editor on notes and modules; ShareDialog component
- **Server-side Search**: ILIKE search on explore page with category filter dropdown
- **Google OAuth**: Conditional Google sign-in button (shown when env vars configured); googleId column on users table
- **Rich Text**: Tiptap editor with toolbar, HTML content storage, backward-compatible plain text loading
- **User Profile**: Profile page at /profile with avatar upload (base64), display name editing
- **Image Embeds**: Insert images via URL in the editor toolbar
- **LaTeX/Math**: Inline and block math via custom Tiptap nodes with KaTeX rendering

## Rich-Text Editor
- Tiptap-based editor with extensions: StarterKit, Underline, Table, Placeholder, Image, custom MathInline/MathBlock, CommentDecorationExtension
- Toolbar component: `client/src/components/editor-toolbar.tsx`
- Editor integrated in `client/src/pages/note-editor.tsx`
- Comment decoration extension: `client/src/extensions/comment-decoration.ts`
- Content stored as HTML in `notes.content` column; backward-compatible with plain text (converted to `<p>` on load)
- Tiptap CSS styles scoped under `.tiptap` class in `client/src/index.css`
- Toolbar re-renders on editor transactions for accurate active state
- Math nodes use KaTeX for rendering; store LaTeX in `data-latex` attribute; interactive editing via NodeView
- Packages: @tiptap/react, @tiptap/starter-kit, @tiptap/pm, @tiptap/extension-underline, @tiptap/extension-table, @tiptap/extension-table-row, @tiptap/extension-table-cell, @tiptap/extension-table-header, @tiptap/extension-placeholder, @tiptap/extension-image, katex

## Seed Data
- 3 sample users (mary@university.edu, alex@university.edu, sarah@university.edu) - password: password123
- 6 notes (5 public, 1 private) covering CS, Math, OS, and DB topics
- 3 modules with category labels
