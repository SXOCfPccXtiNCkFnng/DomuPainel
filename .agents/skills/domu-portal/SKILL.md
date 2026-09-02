---
name: domu-portal
description: Guidance and context for developing the Domu Tech Multi-Tenant SaaS Portal, starting with the Real Estate messaging & dispatch module and expanding into a scalable multi-segment SaaS with DOMU visual identity.
---

# Domu Tech - Portal & SaaS Development Guide

This skill serves as the single source of truth for building and expanding the **Domu Tech Portal / SaaS Platform**.

---

## 1. Project Overview & Vision

Domu Tech is developing a high-performance **Multi-Tenant SaaS Platform** designed to automate customer engagement, messaging, and operational workflows for businesses.

### Core Goals
1. **Initial Focus (MVP - Real Estate / Setor Imobiliário)**:
   - Automated Messaging & Bulk Dispatch Engine ("Módulo de Disparos & Automações").
   - Lead engagement, property alerts, appointment reminders, WhatsApp notification workflows, lead status pipeline tracking.
2. **Long-Term Vision (Multi-Segment SaaS)**:
   - Scalable, modular multi-tenant architecture.
   - Dynamic feature toggling per tenant/niche.
   - Future expansion to E-commerce, Healthcare, Legal, Retail, and Service industries.

---

## 2. Visual Identity & UI/UX Guidelines (DOMU Brand System)

All portal UI components must align directly with the established **Domu Tech visual identity** derived from `domutech.digital`.

### Color Palette
- **Primary Electric Blue**: `#1E5AF6` / `#0052FF` (Main action buttons, highlighted text, active navigation elements).
- **Dark Navy / Slate**: `#0B132B` / `#0A1128` (Metric summary cards, dark contrast section containers, primary text).
- **Background Slate**: `#F8FAFC` / `#F1F5F9` (Clean layout background, light card fills).
- **Surface / Cards**: `#FFFFFF` with subtle borders (`1px solid #E2E8F0` or `#E0E7FF`).
- **Success / Status Green**: `#10B981` (Online indicators, WhatsApp icon branding `#25D366`).
- **Muted Gray Text**: `#64748B` / `#475569`.

### Design Elements & Component Specs
- **Typography**: Clean sans-serif (Plus Jakarta Sans). Strong title contrast with colored key text.
- **Card Containers**: Border radius `8px` or `12px`, subtle border (`1px solid rgba(226, 232, 240, 0.8)`).
- **Interactive Widgets**: Real-time message previews, glassmorphism overlays, badge counters.
- **Buttons**: Clean rounded `6px` or `8px`, bold text, white icons.

---

## 3. WhatsApp Messaging & Anti-Ban Architecture (Coexistence)

For complete technical reference on anti-ban and WhatsApp Coexistence, see [whatsapp-coexistence-antiban.md](references/whatsapp-coexistence-antiban.md).

### Key Architectural Rules
1. **WhatsApp Coexistence (Coex)**: Official Meta feature linking WhatsApp Business App (Mobile) with Cloud API (DOMU SaaS).
   - Allows business to keep chat history and 1-to-1 mobile chat while DOMU SaaS triggers automated bulk campaigns.
   - Requirement: Open mobile WhatsApp Business App at least once every 13-14 days.
2. **Zero Ban Guarantee on Official API Protocol**: Official Meta Cloud API eliminates protocol bans.
3. **Quality Rating Protection**:
   - Opt-in enforcement & unsubscribe button (`[Não Quero Receber]`).
   - Approved HSM Message Templates for business-initiated chats.
   - Rate limiting via Redis + BullMQ queue to space out dispatch velocity.

---

## 4. Meta Cloud API Message Template Submission & Instant Approval Protocol

### How Meta Template Approvals Work Technical Workflow
1. **Outbound Bulk Messaging Rule**: Outside the 24-hour customer-initiated session window, Meta Cloud API requires all business-initiated messages to be a registered `HSM` template.
2. **Instant Automated NLP AI Validation**:
   - Meta uses an automated AI moderation engine (`POST /v20.0/{waba_id}/message_templates`).
   - Templates categorized under `MARKETING` or `UTILITY` that conform to Meta's syntax rules (standard variable placeholders `{{1}}`, `{{2}}`, valid text headers, and no blacklisted spam keywords) pass Meta's automated validation engine in **10 to 60 seconds**.
3. **DOMU Portal Synchronization**:
   - When a tenant creates or edits a template in the DOMU Portal (or via the Campaign Dispatch Wizard), DOMU submits the text payload to Meta WABA API.
   - Meta responds with `status: "APPROVED"` (or sends a webhook `message_template_status_update`), allowing immediate execution in dispatch campaigns.

---

## 5. Technical Architecture & Development Blueprint

### Immediate Phase (Frontend + Backend/Database Setup)
- **Frontend**: Next.js 14+ (App Router, TypeScript, TailwindCSS / Custom DOMU Design System).
- **Backend & Database**: Next.js API Routes + Node.js + PostgreSQL (via Supabase or Prisma) with Row Level Security (`tenant_id`).
- **Queue & Async Jobs**: Redis + BullMQ for handling messaging queues independently of Meta credential verification.
- **Modular Multi-Tenancy**: Tenant management, user roles, feature flags (`imobiliario`, `disparos`, `crm`).
