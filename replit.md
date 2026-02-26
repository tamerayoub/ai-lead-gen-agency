# Lead2Lease - AI-Powered Property Management CRM

## Overview

Lead2Lease is an AI-powered CRM system for property management. Its main goal is to automate lead generation, qualification, and the entire rental process from initial contact to application approval across various channels (email, SMS, phone, listings). It provides automated responses, pre-qualifies leads based on customizable criteria, and offers a comprehensive dashboard for property managers to monitor AI interactions, track lead status, manage properties, and analyze conversion metrics. The vision is to streamline operations, boost lead conversion rates, and give property managers a competitive edge through intelligent automation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend is built with React, TypeScript, and Vite, using Wouter for routing. It features a modern SaaS design inspired by Linear and Notion, implemented with Shadcn/ui (Radix UI-based) and Tailwind CSS, supporting both dark and light themes. The brand color palette uses Slate Blue for primary actions, Deep Navy for backgrounds, and Soft White Smoke for CRM interface bases. Key interfaces include Dashboard, Leads, Properties, Analytics, AI Training, and an AI Activity Center. The landing page incorporates Framer Motion for animations and glassmorphism.

### Technical Implementations

The backend is an Express.js and TypeScript REST API, utilizing PostgreSQL with Neon serverless driver and Drizzle ORM. Authentication is handled by Replit Auth, supporting various OAuth providers and email/password. AI integration points include configurable, template-based responses, customizable lead qualification, and automation settings for multi-channel communication.
Key features include:

- **Lead & Property Management:** Automated lead capture, pre-qualification, lead deduplication, and a sales pipeline kanban board. Comprehensive property portfolio management with CRUD operations for properties and individual units.
- **Scheduling & Showings:** Full CRUD for showings, AI-powered scheduling with conflict detection, and real-time calendar sync with Google Calendar. A dedicated bookings page displays showings chronologically. Public booking links are unit-specific, allowing leads to book specific units directly, with property and unit-level scheduling settings. Booking types support configurable modes ("1-to-1" or "Group").
- **AI-Powered Communication:** AI detects showing requests, generates smart replies, and provides a self-service public booking page with AI-optimized time slots.
- **Onboarding & Admin:** A pre-signup onboarding flow and a separate admin area for managing demo requests, sales pipelines, and analytics.
- **Multi-Tenant RBAC:** A comprehensive Role-Based Access Control system with roles and granular permissions, including organization ID scoping and team management.
- **User Profile Management:** Mandatory profile completion on first login and editable user profiles.
- **Membership-Based Feature Gating:** Implemented subscription-based access control via Founding Partner membership, restricting non-subscribed organizations to basic features.
- **Showing Reminder Email Scheduler:** Background service to send automated reminder emails to leads before scheduled showings, configurable at property or unit level.

### Landing Page Architecture

Multiple landing page variants exist, each accessible at their own route:
- **`/` (root) and `/v6`** → LandingV6 ("Agency" brand) — the primary public-facing landing page. Features hero with animated SchedulingDemo, ValueProps (4 cards), HowItWorks (3 steps + VoiceAgentDemo animation), SocialProof, and CTA. Header includes a "Solutions" dropdown.
- **`/product/voice-ai`** → ProductVoiceAI — dedicated Voice AI product page with hero, VoiceAgentDemo animation, How It Works (3 steps + demo), testimonials, and CTA.
- **`/landing` and `/fb-integration`** → LandingV5 (dark, Facebook Marketplace sync theme)
- **`/fb-ai-leasing-agent`** → LandingV4 (blue theme)
- **`/landing-v1`**, **`/landing-v2`**, **`/landing-v3`** → earlier landing versions
- **`/whitepaper`** → Whitepaper lead magnet page

V6 components live in `client/src/components/v6/`: SchedulingDemo.tsx, VoiceAgentDemo.tsx. V6-scoped CSS is under `.v6-page` in index.css.

### System Design Choices

The frontend uses a component-based architecture. The backend API is RESTful with Zod validation. Data storage follows a schema-first approach with an `IStorage` interface. Lead deduplication occurs at the conversation thread level. Email threading uses RFC 822 headers, and an email body cleaning utility removes quoted/forwarded content. Multi-tenant organization management stores the active organization in `users.currentOrgId`. An automatic Gmail scanner imports new messages and creates leads. Public booking endpoints are cross-tenant accessible for listed units, exposing only marketing-safe data.

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
