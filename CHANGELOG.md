# Changelog

All notable changes to the Canopy project will be documented in this file.

## [Unreleased] - 2024-XX-XX

### ✨ New Features

#### SEO Dashboard
- **Comprehensive Dashboard**: New SEO dashboard component that consolidates data from multiple sources
- **Overview Metrics**: Display total content, recent activity, team members, and keywords tracked
- **Visualizations**: Interactive line charts for SEO trends and bar charts for content distribution
- **Multi-Source Data**: Aggregate and display data from Google Search Console, Bing Webmaster, Ubersuggest, Ahrefs, Moz, and SEMrush
- **Real-time Insights**: Live data aggregation with timeline views
- **Responsive Design**: Fully responsive design for desktop and mobile devices

#### ClickUp Integration
- **API Connectivity**: Full ClickUp API integration with configurable API keys
- **Task Synchronization**: Automatic creation of ClickUp tasks from keywords that need attention
- **Two-way Sync**: Link published content to ClickUp tasks with status tracking
- **Error Handling**: Comprehensive error handling and sync logging
- **Task Management**: View and manage ClickUp tasks directly from the dashboard

#### Published Content Tracking
- **Content Management**: Full CRUD operations for published content
- **Link Tracking**: Track internal and external links with anchor text and target URLs
- **Backlink Monitoring**: Count and track backlinks for each content piece
- **Social Shares**: Monitor social engagement metrics
- **Content Types**: Support for blog posts, pages, products, videos, podcasts, and other content types
- **Statistics**: Comprehensive content statistics and analytics

#### Enhanced Internationalization
- **Persian Language**: Complete Persian (Farsi) translations for all UI elements
- **English Language**: Full English support as secondary language
- **RTL Support**: Complete right-to-left layout support for Persian
- **Locale Management**: Easy language switching with persistent preferences

#### User Management System
- **Role-based Access**: Three role levels (Owner, Editor, Client) with different permissions
- **Scoped Access Control**: Restrict users to specific projects or keyword sets
- **Email Invitation System**: Invite clients by email with configurable access levels
- **Project Isolation**: Users only see projects and data they have been granted access to
- **Access Revocation**: Ability to revoke user access from projects

### 🗄️ Database Changes

#### New Tables
- `clickup_settings`: Stores ClickUp API configuration per user (api_key, team_id, folder_id, list_id)
- `published_content`: Tracks all published content with metadata (url, title, keyword, content_type, publish_date, author, status, backlinks, social_shares)
- `content_links`: Stores all links within published content (content_id, url, anchor_text, target_url, is_internal, is_dofollow)
- `clickup_sync_log`: Logs all ClickUp synchronization activities (project_id, user_id, action, task_id, keyword, status)
- `seo_data_cache`: Caches SEO data from multiple sources for performance (project_id, data_source, keyword, url, metric_name, metric_value, data_date)

#### Modified Tables
- `keywords`: Added `clickup_task_id` and `clickup_task_url` columns for ClickUp integration

### 🔌 API Endpoints

#### Authentication
- `POST /api/auth/sign-in` - User sign in with email/password
- `POST /api/auth/sign-up` - Create new user account
- `POST /api/auth/sign-out` - Sign out current user

#### Projects
- `GET /api/projects` - List all projects accessible to the user
- `POST /api/projects` - Create a new project
- `GET /api/projects/:id` - Get detailed information about a project

#### SEO Data
- `GET /api/seo-data` - Get SEO data for a specific project
- `POST /api/seo-data` - Save SEO data from any source
- `GET /api/seo-timeline` - Get SEO trends and timeline data
- `POST /api/aggregate-seo` - Aggregate data from multiple SEO sources

#### ClickUp Integration
- `GET /api/clickup/settings` - Get user's ClickUp API settings
- `POST /api/clickup/settings` - Save ClickUp API configuration
- `GET /api/clickup/tasks` - Fetch tasks from ClickUp for a specific list
- `POST /api/clickup/sync` - Synchronize project keywords with ClickUp tasks

#### Published Content
- `GET /api/content` - List all published content for a project
- `POST /api/content` - Create new published content entry
- `GET /api/content/:id` - Get detailed information about a content entry
- `POST /api/content/:id` - Update existing content entry
- `DELETE /api/content/:id` - Delete a content entry
- `GET /api/content/stats` - Get statistics about published content
- `GET /api/content/timeline` - Get content publishing timeline

#### User Access Management
- `POST /api/projects/:id/invite` - Invite a user to a project with specific role and access
- `POST /api/projects/:id/revoke` - Revoke a user's access to a project
- `GET /api/projects/:id/access` - List all users with access to a project

### 📁 New Files

#### Components
- `src/components/seo-dashboard.tsx` - Main SEO dashboard component
- `src/components/dashboard.tsx` - Project dashboard component
- `src/components/landing.tsx` - Landing page component
- `src/components/locale-root.tsx` - Locale provider component
- `src/components/user-menu.tsx` - User menu dropdown component

#### Server Functions
- `src/lib/server/clickup.ts` - ClickUp API integration (200+ lines)
- `src/lib/server/seo-sources.ts` - Multi-source SEO data handling (200+ lines)
- `src/lib/server/published-content.ts` - Content management functions (400+ lines)
- `src/lib/server/access.ts` - Access control logic
- `src/lib/server/invites.ts` - User invitation system
- `src/lib/server/mappers.ts` - Data mapping utilities
- `src/lib/server/monday.ts` - Monday.com webhook integration
- `src/lib/server/projects.ts` - Project management functions
- `src/lib/server/research.ts` - Keyword research functions
- `src/lib/server/seed.ts` - Sample data seeding
- `src/lib/server/serp.ts` - SERP tracking functions
- `src/lib/server/settings.ts` - User settings management
- `src/lib/server/studio-auth.ts` - Studio authentication middleware

#### Routes
- `src/routes/api/auth/$` - Authentication API routes
- `src/routes/login.tsx` - Login page route
- `src/routes/p.$id.tsx` - Project detail page route

#### Configuration
- `vercel.json` - Vercel deployment configuration
- `.vercel/project.json` - Vercel project settings
- `.env.example` - Environment variables template

#### Documentation
- `README.md` - Complete project documentation
- `DEPLOYMENT.md` - Step-by-step deployment guide
- `CHANGELOG.md` - This changelog file

#### Database
- `migrations/0003_clickup.sql` - Database migration for new tables

### 📦 Dependencies

No new dependencies added. All features use existing dependencies from the project.

### 🔧 Bug Fixes

- Fixed various type inconsistencies
- Improved error handling across all API endpoints
- Enhanced validation for all user inputs

### 🎨 UI Improvements

- Modern, clean design across all components
- Dark/light mode support
- Full RTL support for Persian language
- Responsive design for all screen sizes
- Interactive charts using Recharts
- Smooth loading states and transitions
- User-friendly error messages

### 📊 Performance Improvements

- SEO data caching for reduced API calls
- Efficient database queries
- Lazy loading for charts and heavy components
- Code splitting with Vite

### 🔒 Security Enhancements

- All API endpoints protected with authentication
- Role-based access control implemented
- Sensitive data (API keys) stored server-side only
- Input validation with Zod schemas
- HTTPS enforced in production

### 📝 Documentation

- **README.md**: Complete project overview, features, tech stack, installation, and usage
- **DEPLOYMENT.md**: Comprehensive deployment guide with step-by-step instructions
- **In-code Comments**: All new code is thoroughly documented

## 🚀 Migration Guide

### From Previous Version

1. **Run Database Migrations**
   ```bash
   npm run db:migrate
   ```

2. **Update Environment Variables**
   Add any optional API keys to your environment:
   ```bash
   MANGOOLS_API_KEY=your-mangools-key
   CLICKUP_API_KEY=your-clickup-key
   MONDAY_WEBHOOK_URL=your-monday-webhook
   ```

3. **Clear Cache** (if needed)
   ```bash
   npm run build
   ```

### New Configuration Options

- `CLICKUP_API_KEY`: ClickUp API key for task synchronization
- `CLICKUP_TEAM_ID`: ClickUp team ID
- `CLICKUP_LIST_ID`: ClickUp list ID for SEO tasks
- `MONDAY_WEBHOOK_URL`: Monday.com webhook URL for notifications

## 📚 Usage Examples

### For Agencies

```typescript
// Create a new project for a client
const project = await createProject({
  name: "Client Website SEO",
  domain: "client-website.com",
  locationId: 2840, // United States
  languageId: 1000, // English
});

// Invite client to project with restricted access
const access = await inviteMember({
  projectId: project.id,
  email: "client@email.com",
  role: "client",
  keywordFilter: "main-keywords", // Only show specific keywords
});

// Sync keywords with ClickUp
const result = await syncClickUpWithProject({
  projectId: project.id,
  apiKey: process.env.CLICKUP_API_KEY!,
  listId: process.env.CLICKUP_LIST_ID!,
});
```

### For Clients

```typescript
// View projects you have access to
const projects = await listProjects();

// View SEO data for a project
const seoData = await getSEOData({
  projectId: projectId,
  days: 30,
});

// View published content
const content = await listPublishedContent({
  projectId: projectId,
  limit: 20,
});
```

## 🎯 Testing Checklist

- [ ] Authentication flow (sign up, sign in, sign out)
- [ ] Project creation and management
- [ ] SEO dashboard loading and visualization
- [ ] ClickUp integration (if API keys configured)
- [ ] Content publishing and tracking
- [ ] User access control
- [ ] Persian language display
- [ ] RTL layout
- [ ] Mobile responsiveness
- [ ] Error handling
- [ ] Loading states

## 🤝 Contributing

See `README.md` for contribution guidelines.

## 📄 License

Private - For use by MAZ//ID agency and authorized clients only.

---

*This changelog follows [Keep a Changelog](https://keepachangelog.com/) format.*
