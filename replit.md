# LeaseLoopAI - AI-Powered Property Management CRM

## Overview

LeaseLoopAI is an AI-powered CRM system for property management companies. Its core purpose is to automate lead generation and qualification across multiple communication channels (email, SMS, phone, listing platforms). The system provides automated responses, lead pre-qualification based on customizable criteria, and comprehensive management of the rental pipeline from initial contact to application approval. Property managers gain a dashboard to monitor AI interactions, track lead status, manage properties, analyze conversion metrics, and intervene manually as needed.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 13, 2025 - Facebook Messenger Integration Completed
**Problem:** Users needed to capture leads from Facebook Messenger conversations on their business pages.

**Solution:** Implemented complete Facebook Messenger webhook integration for real-time lead capture:
- **Backend Infrastructure:**
  - Created `server/messenger.ts` with Facebook Graph API utilities
  - Implemented `parseMessengerWebhook()` for extracting messages from webhook events
  - Implemented `getMessengerUserProfile()` for fetching user details (name, profile picture)
  - Implemented `sendMessengerMessage()` for sending replies via Messenger
  - Added webhook routes: `GET /api/integrations/messenger/webhook` for verification, `POST /api/integrations/messenger/webhook` for message events
  - Added configuration endpoints: `POST /api/integrations/messenger/configure`, `GET /api/integrations/messenger`, `POST /api/integrations/messenger/disconnect`
- **Storage Layer:** Extended `IStorage` with `getAllMessengerIntegrations()` method for multi-tenant webhook handling
- **Frontend Integration:**
  - Added Messenger card to Integrations.tsx with MessageSquare icon and setup instructions
  - Implemented configuration dialog with step-by-step Facebook Developer setup guide
  - Includes webhook URL display and field subscriptions (messages, messaging_postbacks)
  - Disconnect dialog with keep/delete leads option
- **Lead Capture Logic:**
  - Real-time webhook processing with 200 response within 20 seconds (Facebook requirement)
  - Lead deduplication by `externalId` pattern `messenger_{senderId}`
  - Automatic user profile fetching from Facebook Graph API
  - Conversation storage with proper channel tagging ('messenger')
  - Graceful error handling with profile fetch fallback
  - Multi-tenant support via pageId matching in webhook handler
- **Configuration:** Uses Page Access Token and custom Verify Token stored in `integration_config` table
- **Webhook URL:** `https://[REPLIT_URL]/api/integrations/messenger/webhook`
- **Required Facebook Subscriptions:** messages, messaging_postbacks

**Result:** Full Messenger integration enabling real-time lead capture from Facebook Page conversations. Webhook properly handles message events, creates leads with user profiles, stores conversations, and manages multi-tenant configurations. Future enhancement: AI auto-response generation (marked as TODO in webhook handler).

### October 12, 2025 - Outlook Integration Completed
**Problem:** Users needed Microsoft Outlook email integration alongside Gmail for lead management.

**Solution:** Implemented complete Outlook integration mirroring Gmail functionality:
- **Backend Infrastructure:**
  - Created `server/outlook.ts` with Microsoft Graph API OAuth2 client
  - Implemented `getOutlookAuthUrl()`, `getOutlookTokensFromCode()`, `listOutlookMessages()`, `getUserProfile()`, and `sendOutlookReply()`
  - Added OAuth routes: `/api/integrations/outlook/auth`, `/callback`
  - Added status endpoint: `GET /api/integrations/outlook`
  - Added disconnect endpoint: `POST /api/integrations/outlook/disconnect`
  - Added sync endpoint: `POST /api/leads/sync-from-outlook` with AI-powered lead parsing
- **Storage Layer:** Extended `IStorage` with `getAllOutlookIntegrations()` method for background scanning capability
- **Frontend Integration:**
  - Added Outlook card to Integrations.tsx with Mail icon, category badge, and status indicators
  - Implemented connect/disconnect/sync functionality with real-time progress tracking
  - Added sync logs display with color-coded messages (success/error/warning/info)
  - OAuth callback handling with success/error redirects
- **Lead Sync Logic:**
  - Fetches up to 500 emails from Outlook inbox
  - AI parsing using GPT-4o-mini to identify rental inquiries and extract lead data
  - Conversation threading by conversationId for proper email chain consolidation
  - Lead deduplication by email and phone number
  - Property matching based on mentioned property names
  - Multi-tenant organization context enforcement
- **Configuration:** Requires `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` environment variables
- **OAuth Redirect URI:** `https://[REPLIT_URL]/api/integrations/outlook/callback`
- **Required Azure Permissions:** Mail.Read, Mail.Send, offline_access (Delegated)

**Result:** Full Outlook integration with same feature parity as Gmail - OAuth authentication, email syncing with AI lead detection, manual sync with progress tracking, disconnect with keep/delete options, and proper multi-tenant support.

### October 12, 2025 - Gmail Integration Migrated to Dedicated Integrations Page
**Problem:** Gmail integration logic was duplicated across Settings and Integrations pages, causing maintenance issues and confusing UX.

**Solution:** Consolidated all integration management into dedicated Integrations page:
- **Settings Cleanup:** Removed all integration code (Gmail, Twilio, Outlook) from Settings.tsx - no queries, mutations, state, or UI components
- **Settings Redirect:** Integrations tab in Settings now shows only a redirect card directing users to the dedicated Integrations page
- **Gmail Preservation:** All Gmail functionality preserved in Integrations.tsx including:
  - OAuth connection flow with redirect handling
  - Manual sync with real-time progress tracking and polling
  - Disconnect with keep/delete leads option
  - Stop sync with keep/delete leads option  
  - Notification integration with unread count badges
  - Sync logs display with collapsible UI
- **Code Quality:** Removed all unused imports, state variables, queries, and mutations from Settings - clean LSP state with no TypeScript errors
- **Single Source of Truth:** Gmail integration exists only in `client/src/pages/Integrations.tsx` - no duplication

**Result:** Clean separation of concerns with AI training/configuration in Settings and all integrations (Gmail, Zillow, future integrations) in dedicated Integrations page. Eliminates code duplication and provides centralized integration management.

### October 11, 2025 - Notification System and Gmail Lead Detection
**Problem:** Users had no way to know when new potential leads arrived in their Gmail inbox without manually running sync.

**Solution:** Implemented a comprehensive notification system with background Gmail scanning:
- **Database Schema:** Added `notifications` table with fields for type, title, message, actionUrl, metadata, read status, and org/user scoping
- **Storage Interface:** Extended `IStorage` with full CRUD operations for notifications (create, getById, list with filtering, markAsRead, delete)
- **API Endpoints:** Created RESTful endpoints (`GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications`, `PATCH /api/notifications/:id/read`, `DELETE /api/notifications/:id`)
- **Background Scanner:** Implemented `gmailScanner.ts` that runs every 5 minutes, detects new email threads from connected Gmail accounts, and creates notifications without auto-importing leads
- **Deduplication:** Scanner maintains in-memory map (`notifiedThreadsByOrg`) of already-notified threads, cleared after successful sync to prevent duplicate notifications
- **UI Components:** Added `NotificationBell` component in header with unread count badge, dropdown showing all notifications with actions (mark read, delete, navigate to actionUrl)
- **Settings Integration:** Updated Settings page to display pending leads count in Gmail integration section with visual alert and count badge on sync button
- **Query Invalidation:** Gmail sync properly invalidates notification queries to clear stale counts after import

**Result:** Users now receive real-time notifications about new Gmail leads with visual indicators throughout the app. The notification bell in the header shows unread count, Settings page displays actionable alerts, and all notifications clear automatically after sync. The system prevents duplicate notifications and properly handles multi-tenant organization scoping.

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