# Action Board - Project Overview

## Purpose
Action Board for Maison Marc is a gamification system where users can complete missions/tasks (called "グッジョブ") to gain XP, level up, and earn badges. The platform includes social features like rankings, user profiles, and sharing capabilities.

## Core Features
- **Mission System**: Users complete missions with various submission types (LINK, TEXT, IMAGE, IMAGE_WITH_GEOLOCATION, NONE)
- **XP & Leveling**: Experience point tracking with automatic level progression and notifications
- **User Profiles**: Public profiles with social media integration (GitHub, X/Twitter)  
- **Ranking System**: Leaderboards and competitive elements
- **Social Sharing**: Facebook, Twitter, LINE integration
- **Badge System**: Achievement tracking and badge collection
- **Authentication**: Supabase Auth with LINE Login support
- **Location Features**: Geolocation support for certain mission types

## Technology Stack
- **Frontend**: Next.js 15 with App Router
- **Backend/Database**: Supabase (PostgreSQL with Row Level Security)
- **Styling**: Tailwind CSS with Radix UI components
- **Authentication**: Supabase Auth (with LINE Login)
- **Error Monitoring**: Sentry
- **Testing**: Jest (unit/RLS), Playwright (E2E), Storybook (components)
- **Deployment**: Cloudflare Pages
- **Type Safety**: TypeScript with strict mode
- **Code Quality**: Biome (formatter/linter), Lefthook (git hooks)

## Architecture Highlights
- Edge Runtime compatibility for Cloudflare Pages
- Row Level Security (RLS) for data access control  
- Comprehensive test coverage across multiple layers
- Component-driven development with Storybook
- Path aliases for clean imports (`@/*` maps to project root)