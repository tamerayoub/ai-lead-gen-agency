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
  - `/api/ai-settings` - AI configuration by category
  - `/api/analytics` - Performance metrics and trends
  - `/api/ai-activity` - AI interaction logging
- Request validation using Zod schemas derived from Drizzle tables
- Consistent error handling with status codes

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
- Automation settings (auto-respond, follow-up timing, max follow-ups)
- Tone and speed preferences for AI responses

**Communication Channels:**
- Email, SMS, and Phone support indicated in schema
- AI-generated flag on conversations and notes
- Channel-specific handling in UI components (icons, formatting)

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

### Third-Party Integration Readiness

**Communication Services:**
- Twilio configuration schema for SMS/phone (SID, token, phone number stored in integrationConfig table)
- Email service integration points defined but provider not specified

**Property Management Systems:**
- Generic PMS provider integration schema
- API key storage for external system connections
- Provider selection UI (currently shows "none" as option)

### Session Management

**Planned:**
- connect-pg-simple for PostgreSQL session storage
- Express session middleware (referenced in dependencies)
- Credentials-based fetch requests configured