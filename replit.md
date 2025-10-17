# LeaseLoopAI - AI-Powered Property Management CRM

## Overview

LeaseLoopAI is an AI-powered CRM system designed for property management companies. Its primary goal is to automate lead generation and qualification across various communication channels like email, SMS, phone, and listing platforms. The system provides automated responses, pre-qualifies leads based on customizable criteria, and manages the entire rental pipeline from initial contact to application approval. Property managers utilize a dashboard to monitor AI interactions, track lead status, manage properties, analyze conversion metrics, and perform manual interventions when necessary. The project aims to streamline property management operations, enhance lead conversion, and provide a competitive edge in the rental market.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend is built with React, TypeScript, and Vite, using Wouter for routing. It features a modern SaaS design inspired by platforms like Linear and Notion, implemented with Shadcn/ui (Radix UI-based) and Tailwind CSS, supporting both dark and light themes. State management utilizes TanStack Query for server-side data and local React state for UI-specific elements. Key user interfaces include a Dashboard, Leads management, Properties, Analytics, AI Training, and a unified AI Activity Center for real-time monitoring of AI communications.

### Technical Implementations

The backend is an Express.js and TypeScript REST API. It uses PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe data access. The database schema includes tables for users, sessions, properties, leads, conversations, AI settings, and integration configurations. Authentication is handled by Replit Auth, supporting various OAuth providers and email/password, with session management stored in PostgreSQL.

### Feature Specifications

**AI Integration Points:**
- **Configurable AI:** Supports template-based responses, customizable lead qualification rules (e.g., income, move-in date), and automation settings (auto-respond, follow-up scheduling, auto-pilot mode).
- **AI Email Reply Approval:** Features a "Pending Replies Queue" for reviewing, approving, rejecting, or editing AI-generated email responses. An "Auto-Pilot Mode" enables automatic sending of approved replies, and a "Scan for Unanswered" feature generates replies for past inquiries. Email threading is maintained.
- **Multi-Channel Communication:** Integrates email (Gmail, Outlook), SMS, and phone. An "AI Activity Center" provides a real-time, unified view of all AI communications, their status, and full conversation context.
- **Lead Pre-qualification:** Assigns qualification scores to leads based on defined criteria, managing the lead pipeline from initial contact to application approval.
- **Lead Capture:** Real-time lead capture from various sources including Facebook Messenger webhooks, and email integrations (Gmail, Outlook) with AI parsing to identify rental inquiries and extract lead data.

### System Design Choices

The frontend employs a component-based architecture, separating UI primitives, feature-specific components, and page-level elements. The backend API is RESTful, organized by resource, with Zod for request validation and standardized error handling. Data storage uses a schema-first approach with an abstract `IStorage` interface. Lead deduplication is implemented at the conversation thread level for emails and by normalized email/phone for multi-channel communications.

**Email Threading & Conversation Management:** Gmail and Outlook email threads are tracked using `gmailThreadId` and `outlookConversationId` fields in the leads table. When a reply is received in an existing email thread, the system:
1. Checks if the exact message ID was already processed (true duplicate) → skip
2. Checks if the thread ID matches an existing lead → add message to that lead's conversation history
3. Otherwise → create new lead and store thread ID for future replies

This ensures email conversations are properly threaded and replies are not incorrectly treated as duplicate leads.

**Email Body Cleaning:** The system includes a `cleanEmailBody()` utility function that processes incoming email messages before storage. This function:
1. Removes quoted/threaded content (lines starting with ">", "On...wrote:" patterns and everything after)
2. Removes forwarded email markers ("From:") and everything after them
3. Preserves EXACT original formatting and line breaks from the email as written
4. Ensures stored conversations contain only the relevant, original message content without quoted replies

The function does NOT reformat or rejoin lines - it preserves the email body exactly as it appears in the original message. This cleaning is applied to all email conversations stored in the system (Gmail, Outlook, initial messages, and replies).

**Multi-Tenant Organization Management:** The user's active organization is persistently stored in the `users.currentOrgId` database field. Organization switching updates this field, and the system defaults to the user's first membership if no preference is set.

**Sync Session Tracking:** Each email sync session tracks the lead IDs created during that specific sync. When users choose to "disconnect and delete leads" or "stop sync and delete leads" during an active sync, the system only deletes leads from the current sync session, preserving all previously imported leads from earlier syncs. This prevents accidental deletion of established lead data.

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
- **Communication Services:**
    - **Twilio:** For SMS and voice calls, integrated via Replit Connectors API.
    - **Gmail (OAuth 2.0):** Email integration for background sync, lead detection, and conversation threading.
    - **Microsoft Outlook (OAuth 2.0):** Email integration for background sync, lead detection, and conversation threading.
    - **Facebook Messenger (Webhook):** Real-time lead capture from Facebook business pages.
- **Calendar Integration:**
    - **Google Calendar (OAuth 2.0):** For availability management, scheduling, and user-configurable AI scheduling preferences.
- **Property Management Systems (PMS):** Supported providers include Buildium, AppFolio, Yardi, and Rent Manager, integrated via API keys.
- **Authentication & Session Management:**
    - **Replit Auth:** Provides full OAuth 2.0 support for Google, GitHub, X (Twitter), and Apple, as well as email/password authentication. Sessions are stored in PostgreSQL with a 7-day expiration and automatic token refresh.