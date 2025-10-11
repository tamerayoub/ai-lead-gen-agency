# LeadGenAI - AI-Powered Property Management CRM

## Overview

LeadGenAI is an AI-powered CRM system for property management companies. Its core purpose is to automate lead generation and qualification across multiple communication channels (email, SMS, phone, listing platforms). The system provides automated responses, lead pre-qualification based on customizable criteria, and comprehensive management of the rental pipeline from initial contact to application approval. Property managers gain a dashboard to monitor AI interactions, track lead status, manage properties, analyze conversion metrics, and intervene manually as needed.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend uses React with TypeScript, Wouter for routing, and Vite for building. It features a modern SaaS aesthetic, inspired by platforms like Linear and Notion, implemented with Shadcn/ui (built on Radix UI) and Tailwind CSS, supporting dark/light themes. State management is handled by TanStack Query for server state and local React state for UI specifics. Key pages include a Dashboard, Leads management, Properties, Analytics, AI Training, and a unified AI Activity Center for real-time monitoring.

### Technical Implementations

The backend is built with Express.js and TypeScript, providing a REST API. It utilizes PostgreSQL via Neon serverless driver and Drizzle ORM for type-safe data access. The schema includes tables for users, properties, leads, conversations, AI settings, and integration configurations. Authentication is planned using session-based methods with a PostgreSQL session store.

### Feature Specifications

**AI Integration Points:**
- **Configuration System:** Template-based responses, customizable qualification rules (income, move-in date), and automation settings (auto-respond, follow-up timing, auto-pilot mode).
- **AI Email Reply Approval System:** A "Pending Replies Queue" displays AI-generated email replies for review and approval. Features include side-by-side viewing of original inquiries and AI responses, options to approve, reject, or edit replies, and a "Scan for Unanswered" button to retroactively generate replies. An "Auto-Pilot Mode" allows automatic sending of approved AI replies. Email threading is preserved for proper conversation flow.
- **Multi-Channel Communication:** Supports email, SMS, and phone, with an "AI Activity Center" providing a real-time, unified monitoring hub for all AI communications, including status tracking and full context views.
- **Pre-qualification Logic:** Assigns qualification scores to leads based on criteria like income and move-in dates, managing a pipeline from new lead to approved application.

### System Design Choices

A component-based architecture is used for the frontend, with clear separation between UI primitives, feature-specific components, and page-level components. Backend API design is RESTful, organized by resource, with Zod for request validation and consistent error handling. Data storage follows a schema-first approach with an abstract `IStorage` interface. Lead deduplication is implemented at the thread level for email and also by normalized email and phone to ensure all communications for a person are linked to a single lead.

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

### Session Management (Planned)
- `connect-pg-simple` for PostgreSQL session storage and Express session middleware.