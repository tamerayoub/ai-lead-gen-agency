# Lead2Lease - AI-Powered Property Management CRM

## Overview

Lead2Lease is an AI-powered CRM system for property management, designed to automate lead generation and qualification across multiple communication channels (email, SMS, phone, listing platforms). It provides automated responses, pre-qualifies leads based on customizable criteria, and manages the entire rental pipeline from initial contact to application approval. Property managers use a dashboard to monitor AI interactions, track lead status, manage properties, and analyze conversion metrics, aiming to streamline operations, enhance lead conversion, and gain a competitive edge.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend uses React, TypeScript, and Vite with Wouter for routing. It features a modern SaaS design, inspired by Linear and Notion, implemented with Shadcn/ui (Radix UI-based) and Tailwind CSS, supporting dark and light themes. State management utilizes TanStack Query for server data and local React state for UI. Key interfaces include Dashboard, Leads, Properties, Analytics, AI Training, and an AI Activity Center for real-time communication monitoring. The brand color palette uses Slate Blue for primary actions, Deep Navy for backgrounds, and Soft White Smoke for CRM interface bases.

**Landing Page Animations:**
- Framer Motion scroll-triggered fade-in animations with viewport triggers for all major sections
- Staggered card animations using motion variants for feature grids and benefit cards
- Custom Tailwind CSS blob animations with gradient backgrounds and staggered delays (2s, 4s)
- Advanced hover effects with scale transforms, lift shadows, and glow effects on interactive cards
- Animated Counter component for ROI metrics displaying "3x", "50%", "2x", "40%" with smooth number transitions
- Smooth scroll behavior enabled site-wide for anchor navigation
- Glassmorphism effects on sticky header with backdrop-blur-md and semi-transparent backgrounds
- Subtle pulse animations on key icons (Bot icon) with 3-second cycles

### Technical Implementations

The backend is an Express.js and TypeScript REST API, utilizing PostgreSQL with Neon serverless driver and Drizzle ORM. Database schemas cover users, sessions, properties, leads, conversations, AI settings, and integration configurations. Authentication is handled by Replit Auth, supporting various OAuth providers and email/password, with session management in PostgreSQL.

### Feature Specifications

**AI Integration Points:**
- **Configurable AI:** Template-based responses, customizable lead qualification rules, and automation settings (auto-respond, follow-up, auto-pilot).
- **AI Email Reply Approval:** "Pending Replies Queue" for review/approval/editing, "Auto-Pilot Mode" for automatic sending, and "Scan for Unanswered" for past inquiries.
- **Multi-Channel Communication:** Integrates email (Gmail, Outlook), SMS, and phone with a unified "AI Activity Center".
- **Lead Pre-qualification:** Assigns qualification scores and manages the lead pipeline.
- **Lead Capture:** Real-time capture from Facebook Messenger webhooks and email integrations with AI parsing.

**Demo Booking System:**
- A public `/book-demo` page with dual booking options via tabbed interface:
  - **Schedule Now**: Calendly inline calendar widget for direct appointment booking
  - **Request Callback**: Contact form capturing prospect information
- Form submissions stored in `demo_requests` table with success confirmation flow.
- Calendly integration uses dynamic script loading with proper cleanup on unmount.
- API endpoints exist for public submissions (`/api/demo-requests` POST) and authenticated admin viewing (`/api/demo-requests` GET).
- Responsive design with mobile-friendly tabs and 320px minimum width for calendar widget.

**Pre-Signup Onboarding Flow:**
- A multi-step questionnaire at `/onboarding` captures prospect data before authentication.
- A session token system links onboarding responses to user accounts post-signup, integrating with all Replit Auth methods (Email/Password, Google, Facebook, Microsoft, Apple OAuth).
- Onboarding responses are stored in the `onboarding_intakes` table, viewable by admins at `/admin/onboarding`.

**Admin Area:**
- A separate, isolated admin portal at `/admin` with dedicated login and layout.
- Admin authentication supports OAuth and email/password, enforcing `isAdmin=true` access.
- Admin features include "Demo Requests Management" for viewing and managing demo submissions.

**Sales Pipeline System:**
- A drag-and-drop kanban board at `/admin/sales-pipeline` for managing prospects through 6 pipeline stages: Discovery, Evaluation, Probing, Offer, Sale, and Onboard.
- Automatic prospect creation and email-based deduplication merging demo requests and onboarding intakes into unified sales prospects.
- Pipeline stage badges display on Demo Requests and Onboarding Intakes pages, providing cross-view status visibility.
- "Resync Prospects" feature backfills existing data from demo requests and onboarding submissions.
- Database tables: `sales_prospects` (prospect records with pipeline stages) and `prospect_sources` (tracking source attribution from demo/onboarding).
- Uses @dnd-kit library for drag-and-drop functionality with proper droppable targets and collision detection.

**Admin Analytics Dashboard:**
- Comprehensive analytics page at `/admin/analytics` displaying platform-wide KPIs and trends.
- Real-time metrics include: total signups, demo requests, onboarding submissions, paying customers (organizations), sales prospects, and conversion rate.
- Conversion rate calculated as percentage of prospects in "sale" or "onboard" stages relative to total prospects.
- Visual data representations using Recharts: line charts for 6-month signup and demo request trends, pie chart for pipeline stage distribution.
- Backend API endpoint `/api/admin/analytics` with SQL aggregation queries for efficient data retrieval.
- Error handling and loading states for robust user experience.

### System Design Choices

The frontend uses a component-based architecture. The backend API is RESTful, organized by resource, with Zod validation. Data storage uses a schema-first approach with an `IStorage` interface. Lead deduplication is implemented at the conversation thread level for emails and by normalized email/phone for multi-channel communications. Email threading uses RFC 822 headers and Gmail's `threadId` to ensure all conversations for a given lead are from the same thread. An email body cleaning utility removes quoted/forwarded content from incoming messages while preserving original formatting. Multi-tenant organization management stores the active organization in `users.currentOrgId`. Sync sessions track lead IDs to prevent accidental deletion of established leads during disconnect actions. An automatic Gmail scanner runs every 60 seconds to import new messages from existing threads and create new leads for new threads, using `externalId` for deduplication. Session-level email deduplication prevents duplicate lead creation within a single sync batch across different threads from the same email address.

## External Dependencies

### Core Infrastructure
- **Database:** Neon PostgreSQL serverless database.
- **ORM & Validation:** Drizzle ORM, Drizzle-Zod, Zod.

### UI Framework
- **Component Libraries:** Radix UI primitives, Shadcn/ui, React Hook Form.
- **Styling:** Tailwind CSS, PostCSS, Class Variance Authority (CVA), Inter and JetBrains Mono fonts.

### Data Visualization
- **Charts:** Recharts library.

### Utility Libraries
- **State & Data:** TanStack Query, date-fns, clsx, tailwind-merge.
- **Development:** Replit-specific dev tools, TypeScript, ESBuild.

### Third-Party Integrations
- **Communication Services:** Twilio (SMS/voice), Gmail (OAuth 2.0), Microsoft Outlook (OAuth 2.0), Facebook Messenger (Webhook).
- **Calendar Integration:** Google Calendar (OAuth 2.0).
- **Property Management Systems (PMS):** Buildium, AppFolio, Yardi, Rent Manager.
- **Authentication & Session Management:** Replit Auth (Google, GitHub, X, Apple OAuth, email/password).