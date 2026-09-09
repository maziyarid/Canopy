# Canopy - SEO Dashboard

A comprehensive SEO management platform that consolidates data from multiple sources (Google Search Console, Bing Webmaster, Ubersuggest, Ahrefs, etc.) into a single, user-friendly dashboard. Designed for agencies to provide clients with easy-to-understand SEO insights without requiring technical knowledge.

## Features

### Core Functionality
- **Multi-source SEO Data**: Aggregate data from Google Search Console, Bing Webmaster, Ubersuggest, Ahrefs, Moz, and SEMrush
- **Client Access Control**: Grant users access to specific websites or keywords they can view
- **ClickUp Integration**: Sync keywords and tasks with ClickUp for content management
- **Content Tracking**: Track newly published content and its backlinks
- **Keyword Research**: Full keyword research workflow with Mangools integration

### Dashboard
- **Overview Metrics**: Total content, recent activity, team members, keywords tracked
- **SEO Trends**: Visualize ranking changes, traffic trends, and keyword performance
- **Content Management**: View and manage published content with links tracking
- **Task Sync**: Automatic synchronization with ClickUp for content creation workflows
- **Data Source Status**: Monitor which SEO data sources are connected and active

### User Management
- **Role-based Access**: Owner, Editor, and Client roles with different permissions
- **Scoped Access**: Restrict users to specific projects or keyword sets
- **Invite System**: Email-based invitation system for client onboarding

### Internationalization
- **Primary Language**: Persian (Farsi) - فارسی
- **Secondary Language**: English
- **RTL Support**: Full right-to-left layout support for Persian

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: Tailwind CSS v4 + Radix UI components
- **State Management**: Zustand
- **Data Fetching**: TanStack Query + React Router
- **Charts**: Recharts
- **Backend**: TanStack Start server functions
- **Database**: PostgreSQL (Neon) / PGLite for local development
- **Authentication**: Better Auth
- **Deployment**: Vercel

## Project Structure

```
merged-canopy/
├── src/
│   ├── components/          # React components
│   │   ├── seo-dashboard.tsx  # Main SEO dashboard component
│   │   ├── dashboard.tsx      # Project dashboard
│   │   └── ...
│   ├── lib/
│   │   ├── server/           # Server functions
│   │   │   ├── clickup.ts     # ClickUp API integration
│   │   │   ├── seo-sources.ts # Multi-source SEO data
│   │   │   ├── published-content.ts # Content management
│   │   │   └── ...
│   │   ├── i18n.ts           # Internationalization strings
│   │   └── ...
│   ├── routes/              # Page routes
│   └── types.ts             # TypeScript types
├── migrations/              # Database migrations
│   ├── 0001_auth.sql        # Auth tables
│   ├── 0002_canopy.sql      # Core Canopy tables
│   └── 0003_clickup.sql     # ClickUp integration tables
├── server/                 # Server middleware
├── package.json
└── vercel.json            # Vercel deployment config
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- PostgreSQL (for production) or PGLite (for development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/maziyarid/Canopy.git
cd Canopy
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/canopy

# Auth
AUTH_SECRET=your-secret-key

# Optional: Mangools API
MANGOOLS_API_KEY=your-mangools-key

# Optional: ClickUp API
CLICKUP_API_KEY=your-clickup-key
```

4. Run migrations:
```bash
npm run db:migrate
```

5. Start development server:
```bash
npm run dev
```

6. Open [http://localhost:8080](http://localhost:8080)

## Deployment

### Vercel

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string
   - `AUTH_SECRET`: Random secret for authentication
   - `MANGOOLS_API_KEY`: (Optional) Your Mangools API key
   - `CLICKUP_API_KEY`: (Optional) Your ClickUp API key

3. Deploy!

### Subdomain Setup

To deploy as a subdomain of maziyarid.com:

1. In Vercel, go to project settings
2. Add custom domain: `canopy.maziyarid.com`
3. Configure DNS records with your domain provider
4. Vercel will provide the necessary DNS records to add

## API Endpoints

### Authentication
- `POST /api/auth/sign-in` - Sign in with email/password
- `POST /api/auth/sign-up` - Create new account
- `POST /api/auth/sign-out` - Sign out

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details

### SEO Data
- `GET /api/seo-data` - Get SEO data for project
- `POST /api/seo-data` - Save SEO data
- `GET /api/seo-timeline` - Get SEO trends timeline
- `POST /api/aggregate-seo` - Aggregate data from multiple sources

### ClickUp Integration
- `GET /api/clickup/settings` - Get ClickUp settings
- `POST /api/clickup/settings` - Save ClickUp settings
- `GET /api/clickup/tasks` - Get ClickUp tasks
- `POST /api/clickup/sync` - Sync project with ClickUp

### Published Content
- `GET /api/content` - List published content
- `POST /api/content` - Create published content
- `GET /api/content/:id` - Get content details
- `POST /api/content/:id` - Update content
- `DELETE /api/content/:id` - Delete content
- `GET /api/content/stats` - Get content statistics

### User Management
- `POST /api/projects/:id/invite` - Invite user to project
- `POST /api/projects/:id/revoke` - Revoke user access
- `GET /api/projects/:id/access` - List project access

## Database Schema

### Core Tables
- `user` - User accounts
- `session` - Auth sessions
- `account` - Auth accounts
- `verification` - Email verification tokens

### Canopy Tables
- `studio_settings` - User studio settings (API keys, etc.)
- `projects` - SEO projects/websites
- `project_access` - User access to projects
- `keywords` - Tracked keywords
- `rank_history` - Ranking history
- `serp_rows` - SERP results
- `competitors` - Competitor data
- `gaps` - Keyword gap analysis
- `briefs` - Content briefs
- `agent_runs` - AI agent execution history
- `activity_log` - Activity logging
- `monday_events` - Monday.com webhook events

### New Tables (ClickUp Integration)
- `clickup_settings` - ClickUp API configuration
- `published_content` - Published content tracking
- `content_links` - Links within published content
- `clickup_sync_log` - ClickUp sync history
- `seo_data_cache` - Cached SEO data from multiple sources

## Usage

### For Agencies
1. Create projects for each client website
2. Invite clients to their respective projects
3. Set up keyword tracking and research
4. Connect data sources (Mangools, Search Console, etc.)
5. Monitor SEO performance and create reports

### For Clients
1. Sign in with your email
2. View your granted projects
3. See SEO performance metrics
4. Track keyword rankings
5. View published content and backlinks

## License

Private - For use by MAZ//ID agency and authorized clients only.

## Contributing

This is a private project. Contributions are by invitation only.

## Support

For support, contact: support@maziyarid.com
