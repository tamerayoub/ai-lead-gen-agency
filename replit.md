# Lead2Lease - AI-Powered Property Management CRM

## Overview
Lead2Lease is an AI-powered CRM system designed for property management. Its primary purpose is to automate lead generation, qualification, and the entire rental pipeline from initial contact to application approval across multiple channels (email, SMS, phone, listings). The system provides automated responses, pre-qualifies leads based on customizable criteria, and offers a comprehensive dashboard for property managers to monitor AI interactions, track lead status, manage properties, and analyze conversion metrics. The business vision is to streamline operations, enhance lead conversion rates, and provide property managers with a competitive advantage through intelligent automation.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### December 9, 2025
- **Stripe Checkout Flow Security Improvements:** Fixed three critical issues with membership checkout:
  1. **Authentication Required:** Checkout page now requires login before showing the checkout form. Unauthenticated users see a sign-in prompt with return URL.
  2. **Duplicate Subscription Prevention:** Backend validates both organization-level (via stripeSubscriptionId/stripeCustomerId) and email-level (via Stripe API) before creating checkout sessions. Blocks any existing Founding Partner subscription.
  3. **Orphaned Subscription Linking:** When a subscription lacks orgId metadata, the system automatically links it to the user's current organization and updates both Stripe metadata and database.
  4. **Optimized Membership Status:** Removed heavy per-request Stripe API calls; relies on existing `linkSubscriptionToUser` function for subscription syncing.
- **Membership-Based Feature Gating:** Implemented subscription-based access control via Founding Partner membership. Non-subscribed organizations can only access Settings and Team pages, with all other features greyed out and locked until they upgrade.
- **FoundingMemberBadge Component:** Created a reusable badge component (`client/src/components/FoundingMemberBadge.tsx`) displaying a golden crown icon with "Founding Partner" text. Badge appears next to the organization name in the sidebar org switcher for subscribed members.
- **AppSidebar Membership Integration:** Updated sidebar to show an upgrade banner for non-members, grey out locked menu items with Lock icons, and display the Founding Member badge next to the org name.
- **MembershipGuard Component:** Created route guard (`client/src/components/MembershipGuard.tsx`) that wraps authenticated routes and blocks non-members from accessing protected pages (except Settings, Team, public routes). Shows a locked feature card with upgrade CTA.
- **useMembership Hook:** Frontend hook (`client/src/hooks/useMembership.ts`) that queries `/api/membership/status` endpoint to check organization membership status with caching.

### December 1, 2025
- **Showing Reminder Email Scheduler:** Implemented a background service (`server/reminderScheduler.ts`) that automatically sends reminder emails to leads before their scheduled showings. Supports multiple configurable reminders per showing (e.g., 1 hour, 30 minutes, 15 minutes before). Reminder settings are configured at the property level (via PropertySchedulingDialog) or overridden at the unit level. Added `remindersSent` JSONB column to showings table to track which specific reminders have been sent. The scheduler runs every 60 seconds and sends professional HTML/text emails via Gmail SMTP (lead2leaseai@gmail.com).

### November 30, 2025
- **Calendar/Schedule Multi-Select Filters:** Converted the Calendar/Schedule page from single-select filters to multi-select cascading filters, matching the Bookings page pattern. Now supports Team Members, Properties, Units, and Leads filters with checkbox-based multi-selection. Cascading logic ensures each filter's options reflect valid combinations based on other selected filters. Added "Clear" button when filters are active.
- **Bookings Page Unit Filter Fix:** Fixed critical bug where unit filter was showing "View all units" instead of allowing selection for some properties. The issue was that `availableUnitOptions` was filtering against `allUnits` (from listed units API), but some showings have units not in that list (legacy/unlisted units). Refactored to derive unit options directly from filtered booked showings, ensuring all units with bookings appear in the filter. Also sorts by property name, then unit number, and shows "Property Name - Unit #" format when multiple properties are selected.
- **Unit Number Display in Emails & Calendar Invites:** Enhanced all notification emails and calendar invites to include unit/apartment numbers. Calendar invite locations now display "Property Address" with "Apartment {x}" on a separate line. Email templates (new bookings, cancellations, reschedules) show address with apartment number below property name. Updated CalendarEvent interface, notifications.ts, and email.ts to accept and display unitNumber parameter.
- **WeekView Event Title Display Fix:** Fixed 15-30 minute events in WeekView to display full event names instead of being truncated. Used inline webkit line-clamp styles to allow event titles to wrap across two lines for short-duration events, improving readability.

### November 27, 2025
- **Drag-and-Drop Display Order Fix:** Fixed critical bug where drag-and-drop reordering of properties and units in the Scheduling page was not persisting. The PATCH endpoints `/api/properties/display-orders` and `/api/units/display-orders` were returning 400/404 errors due to complex Promise.allSettled logic with storage layer lookups failing silently. Simplified the routes to use direct Drizzle ORM database updates with sequential processing and proper orgId scoping, eliminating the persistence failures.

### November 24, 2025
- **Calendar Event Positioning Fix:** Fixed critical bug in DayView and WeekView where calendar events were misaligned with time markers. The first event displayed correctly, but subsequent events showed cumulative offset (e.g., second event 1px off, third event 2px off, etc.). Root cause: Each hour grid cell had a 1px `border-top`, but the height was set to 80px without accounting for the border, making each row effectively 81px tall. This created cumulative drift where later events appeared progressively further from their markers. Even after adding `boxSizing: 'border-box'`, the time labels column still had borders without border-box, causing visual marker drift. Final fix: Removed ALL borders from layout and replaced with CSS `repeating-linear-gradient` backgrounds to draw hour lines. This ensures both visual markers and event positioning use exactly 80px per hour, eliminating cumulative drift completely.
- **Dual Environment Support:** Added separate npm scripts for Replit (`npm run dev`) and Cursor (`npm run dev:cursor`) development environments. Created comprehensive DEVELOPMENT.md documentation for setup and troubleshooting.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, and Vite, using Wouter for routing. It features a modern SaaS design inspired by Linear and Notion, implemented with Shadcn/ui (Radix UI-based) and Tailwind CSS, supporting both dark and light themes. The brand color palette uses Slate Blue for primary actions, Deep Navy for backgrounds, and Soft White Smoke for CRM interface bases. Key interfaces include Dashboard, Leads, Properties, Analytics, AI Training, and an AI Activity Center. The landing page incorporates Framer Motion for animations and glassmorphism. The application sidebar features hover-based navigation with keyboard accessibility for nested subsections.

### Technical Implementations
The backend is an Express.js and TypeScript REST API, utilizing PostgreSQL with Neon serverless driver and Drizzle ORM. Authentication is handled by Replit Auth, supporting various OAuth providers and email/password. AI integration points include configurable, template-based responses, customizable lead qualification, and automation settings for multi-channel communication.

Key features include:
- **Lead & Property Management:** Automated lead capture, pre-qualification, lead deduplication, and a sales pipeline kanban board. Comprehensive property portfolio management with CRUD operations for properties and individual units.
- **Scheduling & Showings:** Full CRUD for showings, AI-powered scheduling with conflict detection, and real-time calendar sync with Google Calendar. A dedicated bookings page displays showings chronologically. Public booking links are unit-specific, allowing leads to book specific units directly, with property and unit-level scheduling settings (event duration, buffer times, minimum lead time). Booking types support configurable modes ("1-to-1" for individual appointments or "Group" for multiple attendees), configured during booking type creation and displayed on unit cards.
- **AI-Powered Communication:** AI detects showing requests in emails, generates smart replies, and provides a self-service public booking page with AI-optimized time slots.
- **Onboarding & Admin:** A pre-signup onboarding flow and a separate admin area for managing demo requests, sales pipelines, and analytics.
- **Multi-Tenant RBAC:** A comprehensive Role-Based Access Control system with roles (Admin, Property Manager, Leasing Agent, Owner Portal User) and granular permissions, including organization ID scoping and team management.
- **User Profile Management:** Mandatory profile completion on first login and editable user profiles.

### System Design Choices
The frontend uses a component-based architecture. The backend API is RESTful with Zod validation. Data storage follows a schema-first approach with an `IStorage` interface. Lead deduplication occurs at the conversation thread level. Email threading uses RFC 822 headers, and an email body cleaning utility removes quoted/forwarded content. Multi-tenant organization management stores the active organization in `users.currentOrgId`. An automatic Gmail scanner imports new messages and creates leads. Public booking endpoints are cross-tenant accessible for listed units, exposing only marketing-safe data while protecting internal organizational data.

## External Dependencies

### Core Infrastructure
- **Database:** Neon PostgreSQL serverless database.
- **ORM & Validation:** Drizzle ORM, Drizzle-Zod, Zod.

### UI Framework
- **Component Libraries:** Radix UI primitives, Shadcn/ui, React Hook Form, react-day-picker.
- **Styling:** Tailwind CSS.

### Data Visualization
- **Charts:** Recharts library.

### Utility Libraries
- **State & Data:** TanStack Query, date-fns.

### Third-Party Integrations
- **Communication Services:** Twilio (SMS/voice), Gmail (OAuth 2.0), Microsoft Outlook (OAuth 2.0), Facebook Messenger (Webhook).
- **Calendar Integration:** Google Calendar (OAuth 2.0).
- **Property Management Systems (PMS):** Buildium, AppFolio, Yardi, Rent Manager.
- **Authentication & Session Management:** Replit Auth (Google, GitHub, X, Apple OAuth, email/password).
- **Payments:** Stripe (subscription billing for Founding Partner membership).

## Environment Variables

### Stripe Configuration
The Stripe integration supports both environment variables and Replit's connector system. Environment variables take priority over the connector.

**Mode Selection:**
- `STRIPE_MODE` - Set to `test` or `live` (defaults to `test` in development, `live` in production)

**Pricing Configuration:**
- `STRIPE_LOOKUP_KEY` - Stripe price lookup key for Founding Partner membership. This allows controlling which price/product is used via environment variable. The lookup key should match a price's `lookup_key` in your Stripe dashboard. If set, the app will use this price instead of searching by product name/metadata. Supports both one-time payments and recurring subscriptions.

**Test Mode Keys** (for development/testing):
- `STRIPE_TEST_SECRET_KEY` - Test secret key (starts with `sk_test_`)
- `STRIPE_TEST_PUBLISHABLE_KEY` - Test publishable key (starts with `pk_test_`)
- `STRIPE_TEST_WEBHOOK_SECRET` - Test webhook signing secret

**Live Mode Keys** (for production):
- `STRIPE_SECRET_KEY` - Live secret key (starts with `sk_live_`)
- `STRIPE_PUBLISHABLE_KEY` - Live publishable key (starts with `pk_live_`)
- `STRIPE_WEBHOOK_SECRET` - Live webhook signing secret

**Getting Your Keys:**
- Test keys: https://dashboard.stripe.com/test/apikeys
- Live keys: https://dashboard.stripe.com/apikeys

**For Replit Users:**
If no environment variables are set, the system automatically uses Replit's Stripe connector. Connect your Stripe account via the Integrations panel in Replit.