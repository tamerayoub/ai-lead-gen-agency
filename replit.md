# LeadGenAI - AI-Powered Property Management CRM

## Overview

LeadGenAI is a modern CRM system designed for property management companies to automate lead generation and qualification through AI-powered multi-channel communication. The platform handles incoming inquiries across email, SMS, phone, and listing platforms, automatically responding to potential tenants, pre-qualifying leads based on customizable criteria, and managing the entire rental pipeline from first contact to approved application.

The system provides property managers with a comprehensive dashboard to monitor AI interactions, track lead status, manage multiple properties, and analyze conversion metrics - all while maintaining the ability to intervene manually when needed.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Routing:**
- React with TypeScript for type safety
- Wouter for client-side routing (lightweight alternative to React Router)
- Vite as the build tool and dev server with HMR support

**UI System:**
- Shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for styling with custom design system
- Theme support (dark/light mode) via ThemeProvider context
- Custom design tokens following modern SaaS aesthetics (Linear, Notion, Attio-inspired)

**State Management:**
- TanStack Query (React Query) for server state and data fetching
- Local React state for UI-specific concerns
- Custom hooks for shared logic (useIsMobile, useToast, useTheme)

**Key Pages:**
- Dashboard - Overview stats, recent leads, and AI activity feed
- Leads - Lead management with pipeline and list views
- Properties - Property portfolio management
- Analytics - Charts and performance metrics
- AI Training - Response templates and qualification criteria
- **AI Activity Center** - Unified real-time monitoring of all AI communications across email, SMS, and phone
- Settings - System configuration and integrations

**Key Design Decisions:**
- Component-based architecture with reusable UI primitives in `/components/ui`
- Feature-specific components in `/components` (LeadCard, PropertyCard, ConversationTimeline, etc.)
- Page-level components in `/pages` following route structure
- Path aliases configured for clean imports (@/, @shared/, @assets/)

### Backend Architecture

**Server Framework:**
- Express.js for REST API with TypeScript
- Custom route registration system in `server/routes.ts`
- Middleware for logging, JSON parsing, and error handling

**API Design:**
- RESTful endpoints organized by resource:
  - `/api/leads` - Lead CRUD operations with status filtering
  - `/api/properties` - Property portfolio management
  - `/api/ai-settings/:category` - AI configuration by category (responses, qualification, behavior, automation)
  - `/api/analytics` - Performance metrics and trends
  - `/api/ai-activity` - AI interaction logging across all channels
  - `/api/integrations/:service` - Integration configuration (gmail, outlook, twilio, buildium, appfolio, etc.)
- Request validation using Zod schemas derived from Drizzle tables
- Consistent error handling with status codes
- Generic integration endpoint supports multiple service types

**Development Environment:**
- Vite integration for development with middleware mode
- Replit-specific plugins for runtime error overlay and dev tools
- Hot module replacement (HMR) for rapid development

### Data Storage

**Database:**
- PostgreSQL via Neon serverless driver with WebSocket support
- Drizzle ORM for type-safe database access and migrations
- Schema-first approach with TypeScript types generated from tables

**Schema Design:**
- `users` - Authentication and user profiles
- `properties` - Property portfolio with occupancy/revenue tracking
- `leads` - Lead information with status pipeline and qualification scores
- `conversations` - Multi-channel communication history (email, SMS, phone)
- `notes` - Manual and AI-generated notes on leads
- `aiSettings` - Configurable AI behavior by category (responses, qualification, automation)
- `integrationConfig` - Third-party service credentials (Twilio, PMS systems, etc.)
- `pendingReplies` - AI-generated email replies awaiting approval or auto-sent records

**Storage Layer:**
- Abstract `IStorage` interface defining all database operations
- Implementation in `server/storage.ts` with Drizzle queries
- Support for filtering, relationships, and upsert operations

**Data Relationships:**
- Leads reference Properties (foreign key)
- Conversations and Notes reference Leads (foreign key)
- Settings and integrations stored as key-value with category grouping

### Authentication & Authorization

**Current State:**
- User schema defined with username/password fields
- No authentication middleware currently implemented
- Session infrastructure prepared (connect-pg-simple referenced in dependencies)

**Intended Design:**
- Session-based authentication with PostgreSQL session store
- User operations defined in storage layer (getUser, getUserByUsername, createUser, updateUser)
- Protected routes to be implemented with session validation

### AI Integration Points

**Configuration System:**
- Template-based responses with variable substitution (e.g., {property_name}, {unit_type})
- Qualification rules (income thresholds, credit scores, pet policies)
- Automation settings (auto-respond, follow-up timing, max follow-ups, auto-pilot mode)
- Tone and speed preferences for AI responses

**AI Email Reply Approval System:**
- **Pending Replies Queue:** Dashboard component displaying AI-generated email replies awaiting approval
- **Auto-Pilot Mode:** Toggle in Settings > Automation to automatically send approved AI replies
  - When enabled: AI replies are sent immediately without manual review
  - When disabled: Replies are queued for manual approval/editing
- **Testing Constraint:** AI replies only generated for infinimoji@gmail.com (Gustavo Pueblo) for testing
- **Email Threading:** Preserves threadId, inReplyTo, and references headers for proper conversation flow
- **Reply Management:**
  - Review: View AI-generated reply content before sending
  - Approve: Send reply and record as outgoing conversation
  - Reject: Delete pending reply without sending
  - Edit: Modify reply content before approval (UI ready, backend pending)
- **Status Tracking:** Pending replies marked as 'pending', 'sent', or 'rejected'
- **Conversation Recording:** All sent replies automatically logged in conversations table with AI flag

**Communication Channels:**
- **Multi-Channel Support:** Email, SMS, and Phone
- **AI Activity Center:** Centralized real-time monitoring hub
  - Unified view of all AI communications across channels
  - Real-time search and filtering by channel, status, and lead name
  - Tabbed interface for channel-specific views (All, Email, SMS, Phone)
  - Visual indicators: channel icons, AI badges, status colors
  - Activity cards show full context: lead info, action, message preview, timestamp
  - Status tracking: success (green), pending (yellow), failed (red)
- AI-generated flag on conversations and notes
- Channel-specific handling in UI components (icons, formatting, color coding)

**Pre-qualification Logic:**
- Qualification scores stored on leads
- Income, move-in date, and other criteria captured
- Status pipeline: new → contacted → prequalified → application → approved

## External Dependencies

### Core Infrastructure

**Database:**
- Neon PostgreSQL serverless database
- Connection pooling via `@neondatabase/serverless`
- WebSocket support for serverless environments

**ORM & Validation:**
- Drizzle ORM for database operations and migrations
- Drizzle-Zod for schema-to-validation conversion
- Zod for runtime type validation

### UI Framework

**Component Libraries:**
- Radix UI primitives (20+ components: dialog, dropdown, tabs, toast, etc.)
- Shadcn/ui design system configuration
- React Hook Form with Zod resolvers for form validation

**Styling:**
- Tailwind CSS with custom configuration
- PostCSS for processing
- Class Variance Authority (CVA) for component variants
- Inter and JetBrains Mono fonts from Google Fonts

### Data Visualization

**Charts:**
- Recharts library for analytics dashboards
- Support for bar charts, line charts, and pie charts
- Responsive containers for mobile support

### Utility Libraries

**State & Data:**
- TanStack Query for server state management
- date-fns for date formatting and manipulation
- clsx and tailwind-merge for conditional class names

**Development:**
- Replit-specific dev tools (cartographer, dev banner, runtime error modal)
- TypeScript for type safety across full stack
- ESBuild for production bundling

### Third-Party Integrations

**Communication Services:**
- **Twilio Integration (Active):** Replit-managed Twilio connection for SMS and voice calls
  - Authentication via Replit Connectors API using API key method (accountSid + apiKey + apiKeySecret)
  - Helper functions in `server/twilio.ts` for sending SMS and making calls
  - Credentials automatically managed by Replit - no manual key storage needed
  - Phone number configured in Twilio connection settings
  - Users can also manually configure Twilio via Settings page integration UI

- **Email Integrations (User-Configurable):**
  - **Gmail OAuth 2.0 (Active):** Secure Google account connection
    - OAuth 2.0 flow using googleapis package
    - Authentication route: `/api/auth/google` generates OAuth URL
    - Callback route: `/api/auth/google/callback` exchanges code for tokens
    - Redirect URI format: `https://{REPLIT_DEV_DOMAIN}/api/auth/google/callback`
    - Tokens (access_token, refresh_token) stored in integrationConfig table
    - Credentials managed via GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets
    - Helper functions in `server/gmail.ts` for listing, reading, and sending emails
    - **Background Sync Automation:**
      - Automatic sync on page load (3-second delay after initialization)
      - Periodic sync every 5 minutes when user is active
      - Activity tracking via mouse, keyboard, click, and scroll events
      - Sync pauses after 10 minutes of inactivity
      - Only runs when Gmail is connected (verified access_token)
      - Toast notifications only shown for new leads
      - Silent error logging without user disruption
      - Cache invalidation for leads and AI activity on every sync
      - Implemented via `useBackgroundGmailSync` hook in App.tsx
  - Outlook/Office 365: Users connect via email address and app password
  - Configuration stored in integrationConfig table
  - Settings UI provides "Connect with Google" OAuth button for Gmail

**Property Management Systems (User-Configurable):**
- Supported providers: Buildium, AppFolio, Yardi, Rent Manager
- Generic integration schema with API key storage
- Configuration via Settings page integration UI
- Provider-specific API credentials stored securely in integrationConfig table

**Integration Management:**
- All integrations configured via Settings → Integrations tab
- Unified storage in integrationConfig table with service identifier
- Real-time status monitoring in AI Activity Center
- Support for enabling/disabling integrations without deleting credentials

### Session Management

**Planned:**
- connect-pg-simple for PostgreSQL session storage
- Express session middleware (referenced in dependencies)
- Credentials-based fetch requests configured