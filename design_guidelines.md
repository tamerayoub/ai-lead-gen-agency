# Lead2Lease Design Guidelines

## Design Approach

**Selected Approach**: Design System with Modern SaaS References

**Primary Inspiration**: Linear, Notion, Attio (modern CRM)
- Clean, data-focused interfaces
- Professional aesthetics with subtle sophistication
- Emphasis on information hierarchy and workflow efficiency

**Design Principles**:
1. Clarity over decoration - information must be instantly scannable
2. Consistent spacing and rhythm for reduced cognitive load
3. Thoughtful use of color to indicate status and priority
4. Smooth, purposeful micro-interactions for feedback

---

## Core Design Elements

### A. Color Palette

**Dark Mode Primary** (default):
- Background: 222 15% 10%
- Surface: 222 15% 14%
- Surface Elevated: 222 15% 18%
- Border: 222 10% 25%
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 65%

**Light Mode**:
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Border: 220 10% 90%
- Text Primary: 222 15% 15%
- Text Secondary: 222 10% 45%

**Brand Colors**:
- Primary: 262 70% 60% (vibrant purple for CTAs, active states)
- Primary Hover: 262 70% 55%
- Success: 142 70% 45% (lead qualified, approved)
- Warning: 38 92% 50% (pending actions)
- Danger: 0 72% 51% (rejected, issues)
- Info: 210 100% 56% (AI interactions, automation)

**Status Colors**:
- New Lead: 210 100% 56%
- Contacted: 262 70% 60%
- Pre-qualified: 38 92% 50%
- Application Sent: 280 65% 60%
- Approved: 142 70% 45%

### B. Typography

**Font Families**: 
- Interface: Inter (via Google Fonts)
- Monospace: JetBrains Mono (for data/IDs)

**Hierarchy**:
- Dashboard Headers: text-3xl font-semibold (30px)
- Section Titles: text-xl font-semibold (20px)
- Card Titles: text-base font-semibold (16px)
- Body Text: text-sm (14px)
- Labels/Meta: text-xs text-secondary (12px)
- Data Tables: text-sm font-medium

### C. Layout System

**Spacing Primitives**: Use Tailwind units of **2, 3, 4, 6, 8, 12, 16**
- Component padding: p-4 or p-6
- Section spacing: gap-6 or gap-8
- Card spacing: p-4 (mobile) to p-6 (desktop)
- Dashboard margins: mx-4 md:mx-8

**Grid System**:
- Dashboard: 12-column responsive grid
- Property cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- KPI cards: grid-cols-2 md:grid-cols-4
- Lead pipeline: Kanban columns with equal width distribution

### D. Component Library

**Navigation**:
- Sidebar: Fixed 240px width on desktop, collapsible on mobile
- Top bar: 64px height with breadcrumbs and user menu
- Tabs: Underline style with smooth transitions

**Data Display**:
- Tables: Striped rows, sortable headers, sticky header on scroll
- Cards: Rounded corners (rounded-lg), subtle shadows (shadow-sm)
- Stats/KPIs: Large numbers (text-3xl font-bold) with trend indicators
- Pipeline: Kanban board with drag-drop (visual only, interaction handled by code)

**Forms & Inputs**:
- Input fields: h-10, rounded-md, consistent border treatment
- Buttons: Primary (filled), Secondary (outline), Ghost (text-only)
- Dropdowns: Searchable with keyboard navigation
- AI Training: Code editor-like interface with syntax highlighting

**Overlays**:
- Modals: Max-width lg, centered, backdrop blur
- Slide-overs: 400px width for details/forms
- Tooltips: Subtle, appears on hover with 200ms delay
- Toast notifications: Top-right, auto-dismiss after 4s

### E. Page-Specific Layouts

**Dashboard (Home)**:
- Top KPI row: 4 stat cards showing total leads, conversion rate, avg response time, active properties
- Main content: Grid with recent leads table + AI activity feed + properties overview
- Quick actions: Floating action button for "New Lead" (bottom-right on mobile)

**Lead Management**:
- Pipeline view: Kanban columns for each stage with lead cards
- List view: Filterable/sortable table with bulk actions
- Lead detail: Slide-over with conversation history, notes, timeline, and actions

**Properties Section**:
- Property grid: Cards with cover image, name, address, key metrics
- Property detail: Header with image, tabs for KPIs, active leads, automation settings

**AI Training Interface**:
- Split view: Response templates on left, preview/test on right
- Training data: Table of conversations with edit/approve actions

**Settings/Configuration**:
- Sidebar navigation for sections
- Form-heavy layouts with clear grouping and help text

---

## Images

**Hero Section**: Not applicable - this is a dashboard application, not a marketing site

**Application Images**:
- **Property Cards**: Rectangular property images (16:9 aspect ratio) as card headers
- **Lead Profile**: Small circular avatar (40x40px) or initials fallback
- **Empty States**: Illustration-style graphics for "No leads yet", "No properties"
- **AI Activity Icons**: Small iconography (24x24px) for different AI actions

**Icon Library**: Heroicons (outline for navigation, solid for actions)

---

## Key UX Patterns

**AI Interactions**:
- Conversation bubbles: User (right-aligned), AI (left-aligned) with subtle background differentiation
- AI suggestions: Highlighted with info color border and lightbulb icon
- Training feedback: Real-time preview of AI responses

**Lead Qualification**:
- Progressive disclosure: Show criteria checklist that expands on click
- Visual scoring: Progress bars or radial charts for qualification score

**Data Visualization**:
- Charts: Line charts for trends, bar charts for comparisons, donut for composition
- Trend indicators: Up/down arrows with percentage change
- Time filters: Quick presets (Today, Week, Month, Quarter) + custom range picker

**Automation Indicators**:
- Automation badge: Small pill showing "AI Handled" with robot icon
- Manual override: Clear visual difference for human-taken actions

This design system creates a professional, efficient CRM experience that prioritizes information density and workflow optimization while maintaining visual polish appropriate for a modern SaaS product.