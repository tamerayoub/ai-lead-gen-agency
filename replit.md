# LeadGenAI - AI-Powered Property Management CRM

## Overview

LeadGenAI is an AI-powered CRM system for property management companies. Its core purpose is to automate lead generation and qualification across multiple communication channels (email, SMS, phone, listing platforms). The system provides automated responses, lead pre-qualification based on customizable criteria, and comprehensive management of the rental pipeline from initial contact to application approval. Property managers gain a dashboard to monitor AI interactions, track lead status, manage properties, analyze conversion metrics, and intervene manually as needed.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 11, 2025 - Organization Switching Persistence Fixed
**Problem:** Organization switching used session storage which didn't persist reliably across requests.

**Solution:** Migrated to database-based organization storage:
- Added `currentOrgId` field to users table
- Updated `/api/organizations/current` endpoint to read from database
- Updated `/api/organizations/switch` endpoint to update database
- Updated `attachOrgContext` middleware to use database field
- Implemented robust fallback to first membership if preference is unset

**Result:** Organization selection now persists correctly across page refreshes and navigation. Verified with end-to-end testing.

## System Architecture

### UI/UX Decisions

The frontend uses React with TypeScript, Wouter for routing, and Vite for building. It features a modern SaaS aesthetic, inspired by platforms like Linear and Notion, implemented with Shadcn/ui (built on Radix UI) and Tailwind CSS, supporting dark/light themes. State management is handled by TanStack Query for server state and local React state for UI specifics. Key pages include a Dashboard, Leads management, Properties, Analytics, AI Training, and a unified AI Activity Center for real-time monitoring.

### Technical Implementations

The backend is built with Express.js and TypeScript, providing a REST API. It utilizes PostgreSQL via Neon serverless driver and Drizzle ORM for type-safe data access. The schema includes tables for users (with OAuth support), sessions, properties, leads, conversations, AI settings, and integration configurations. Authentication is fully implemented using Replit Auth with session-based methods and PostgreSQL session store.

### Feature Specifications

**AI Integration Points:**
- **Configuration System:** Template-based responses, customizable qualification rules (income, move-in date), and automation settings (auto-respond, follow-up timing, auto-pilot mode).
- **AI Email Reply Approval System:** A "Pending Replies Queue" displays AI-generated email replies for review and approval. Features include side-by-side viewing of original inquiries and AI responses, options to approve, reject, or edit replies, and a "Scan for Unanswered" button to retroactively generate replies. An "Auto-Pilot Mode" allows automatic sending of approved AI replies. Email threading is preserved for proper conversation flow.
- **Multi-Channel Communication:** Supports email, SMS, and phone, with an "AI Activity Center" providing a real-time, unified monitoring hub for all AI communications, including status tracking and full context views.
- **Pre-qualification Logic:** Assigns qualification scores to leads based on criteria like income and move-in dates, managing a pipeline from new lead to approved application.

### System Design Choices

A component-based architecture is used for the frontend, with clear separation between UI primitives, feature-specific components, and page-level components. Backend API design is RESTful, organized by resource, with Zod for request validation and consistent error handling. Data storage follows a schema-first approach with an abstract `IStorage` interface. Lead deduplication is implemented at the thread level for email and also by normalized email and phone to ensure all communications for a person are linked to a single lead.

**Multi-Tenant Organization Management:** User's currently active organization is stored in the `users.currentOrgId` database field (not session storage) for reliable persistence across requests. When switching organizations, the database is updated via `POST /api/organizations/switch`. The `GET /api/organizations/current` endpoint retrieves the current organization from the user's database record, falling back to the first membership if none is set.

## External Dependencies

### Core Infrastructure
- **Database:** Neon PostgreSQL serverless database.
- **ORM & Validation:** Drizzle ORM, Drizzle-Zod, and Zod.

### UI Framework
- **Component Libraries:** Radix UI primitives, Shadcn/ui, React Hook Form.
- **Styling:** Tailwind CSS, PostCSS, Class Variance Authority (CVA), Inter and JetBrains Mono fonts.

### Data Visualization
- **Charts:** Recharts library for analytics dashboards.

### Utility Libraries
- **State & Data:** TanStack Query, date-fns, clsx, tailwind-merge.
- **Development:** Replit-specific dev tools, TypeScript, ESBuild.

### Third-Party Integrations
- **Communication Services:**
    - **Twilio:** For SMS and voice calls, authenticated via Replit Connectors API.
    - **Gmail (OAuth 2.0):** For email integration, including background sync, lead deduplication, and email chain consolidation.
- **Calendar Integration:**
    - **Google Calendar (OAuth 2.0):** For availability management and scheduling, including event sync and user-configurable schedule preferences for AI.
- **Property Management Systems (PMS):** Supported providers include Buildium, AppFolio, Yardi, and Rent Manager, configured via API keys.

### Authentication & Session Management (Implemented)

**Replit Auth Integration:**
- Full OAuth 2.0 support via Replit Auth: Google, GitHub, X (Twitter), and Apple sign-in
- Email/password authentication also supported
- Session-based authentication using PostgreSQL session store (`connect-pg-simple`)
- 7-day session expiration with automatic token refresh

**Implementation Details:**
- **Backend:** `server/replitAuth.ts` handles OAuth flow (/api/login, /api/callback, /api/logout)
- **Middleware:** `isAuthenticated` middleware protects ALL API routes except auth endpoints
- **Frontend:** `useAuth` hook provides auth state and user data
- **Protected Routes:** Unauthenticated users see Landing page only; all other routes redirect to landing
- **Database:** Sessions stored in `sessions` table; users stored in `users` table with OAuth fields (firstName, lastName, profileImageUrl)

**Security:**
- HttpOnly, Secure cookies for session management
- All sensitive API endpoints require authentication
- Expired tokens automatically refreshed via refresh_token
- Session cleared on logout