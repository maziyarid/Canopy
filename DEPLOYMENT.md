# Deployment Guide

## Overview

This guide covers deploying Canopy to a subdomain of maziyarid.com using Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Domain Access**: Access to maziyarid.com DNS settings
3. **GitHub Repository**: The merged Canopy repository

## Step 1: Prepare the Repository

1. Ensure all changes are committed and pushed to the main branch:
```bash
git add .
git commit -m "feat: Merge repositories and add SEO dashboard features"
git push origin main
```

2. Verify the repository contains:
   - All source files from both repositories
   - New features (SEO dashboard, ClickUp integration, etc.)
   - Database migrations
   - Updated configuration files

## Step 2: Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" > "Project"
3. Select "Import" from GitHub
4. Choose the `maziyarid/Canopy` repository
5. Configure project settings:
   - **Project Name**: Canopy - SEO Dashboard
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Install Command**: `npm install`
   - **Output Directory**: `dist`
   - **Root Directory**: (leave empty)

## Step 3: Configure Environment Variables

In the Vercel project settings, add these environment variables:

### Required
- `AUTH_SECRET`: Generate with `openssl rand -base64 32`
- `DATABASE_URL`: Your Neon PostgreSQL connection string

### Optional (for full functionality)
- `MANGOOLS_API_KEY`: Your Mangools API key
- `CLICKUP_API_KEY`: Your ClickUp API key
- `CLICKUP_TEAM_ID`: Your ClickUp team ID
- `CLICKUP_LIST_ID`: Your ClickUp list ID for SEO tasks
- `MONDAY_WEBHOOK_URL`: Your Monday.com webhook URL
- `XAI_API_KEY`: Your xAI API key for AI features

## Step 4: Set Up Custom Domain

1. In Vercel project settings, go to "Domains"
2. Click "Add Domain"
3. Enter: `canopy.maziyarid.com`
4. Vercel will provide DNS records to configure

### DNS Configuration

Add these records to your DNS provider (where maziyarid.com is hosted):

#### For Vercel Deployment
```
Type: CNAME
Name: canopy
Value: cname.vercel-dns.com
TTL: Automatic or 3600
```

Or, if Vercel provides specific values:
```
Type: CNAME
Name: canopy
Value: [value provided by Vercel]
TTL: Automatic or 3600
```

#### For SSL Certificate (Automatic)
Vercel will automatically provision an SSL certificate for `canopy.maziyarid.com`. This may take a few minutes to several hours to propagate.

## Step 5: Configure Database

### For Production (Recommended)
1. Create a Neon PostgreSQL database at [neon.tech](https://neon.tech)
2. Get the connection string from Neon dashboard
3. Add to Vercel environment variables as `DATABASE_URL`

### For Development
The application uses PGLite automatically when no `DATABASE_URL` is set, so no database configuration is needed for local development.

## Step 6: Deploy

1. In Vercel, click "Deploy" button
2. Wait for the build to complete
3. Once deployed, Vercel will show the deployment URL
4. After DNS propagation, `https://canopy.maziyarid.com` will point to your deployment

## Step 7: Verify Deployment

1. Wait for DNS propagation (up to 48 hours, usually much faster)
2. Visit `https://canopy.maziyarid.com`
3. Verify the application loads correctly
4. Test authentication flow
5. Create a test project and verify all features work

## Step 8: Set Up Monitoring (Optional)

1. In Vercel, go to project settings
2. Enable monitoring and alerts
3. Set up error tracking
4. Configure performance monitoring

## Step 9: Set Up CI/CD (Optional)

For automatic deployments on push:

1. In Vercel project settings, go to "Git"
2. Enable "Automatic Deployments"
3. Configure branch settings (deploy main branch)
4. Optionally, enable preview deployments for PRs

## Step 10: Configure Backups

1. Set up regular database backups in Neon
2. Consider setting up Vercel deployment backups
3. Document backup procedures

## Post-Deployment Checklist

- [ ] Application loads at `https://canopy.maziyarid.com`
- [ ] Authentication works (sign up, sign in, sign out)
- [ ] Projects can be created and viewed
- [ ] ClickUp integration works (if configured)
- [ ] SEO data can be saved and retrieved
- [ ] Content can be published and tracked
- [ ] User access control works
- [ ] Persian language displays correctly
- [ ] RTL layout works properly
- [ ] All charts and visualizations render
- [ ] Mobile responsive design works

## Troubleshooting

### DNS Not Propagating
- Check DNS settings with your provider
- Use `dig canopy.maziyarid.com` to check DNS resolution
- Wait up to 48 hours for full propagation

### SSL Certificate Issues
- Vercel automatically provisions certificates
- If issues persist, check in Vercel project settings > Domains
- Ensure CNAME record is correctly configured

### Database Connection Issues
- Verify `DATABASE_URL` is correct in Vercel
- Check Neon database is running
- Test connection string locally first

### Build Failures
- Check build logs in Vercel
- Ensure all dependencies are installed
- Verify Node.js version (18+ required)

### Authentication Issues
- Verify `AUTH_SECRET` is set and consistent
- Check database tables were created (run migrations if needed)
- Test locally first to isolate issues

## Rolling Back

1. In Vercel, go to "Deployments"
2. Find the previous working deployment
3. Click "Redeploy" on that deployment
4. Or, revert the git commit and push

## Scaling

### For Increased Traffic
1. Vercel automatically scales, but consider:
   - Upgrading to Pro plan for better performance
   - Adding caching for SEO data
   - Implementing rate limiting

### For More Data
1. Consider adding:
   - Database connection pooling
   - Query optimization
   - Caching layer (Redis)

## Security Considerations

1. **Environment Variables**: Never commit secrets to git
2. **Database Security**: Use strong passwords, enable SSL
3. **Authentication**: Use strong `AUTH_SECRET`, enable email verification
4. **Rate Limiting**: Consider adding rate limiting for API endpoints
5. **CORS**: Configure properly for your domain
6. **HTTPS**: Always use HTTPS (Vercel provides this automatically)

## Performance Optimization

1. **Images**: Optimize all images, use modern formats
2. **Caching**: Cache SEO data that doesn't change frequently
3. **Lazy Loading**: Implement lazy loading for charts and heavy components
4. **Code Splitting**: Already implemented with Vite
5. **CDN**: Vercel automatically uses their CDN

## Analytics (Optional)

Add analytics to track usage:

1. Google Analytics
2. Vercel Analytics (built-in)
3. Custom tracking for key actions

## Maintenance

1. **Regular Updates**: Keep dependencies updated
2. **Database Maintenance**: Regular vacuum and analyze
3. **Backups**: Regular database backups
4. **Monitoring**: Monitor for errors and performance issues
5. **Security**: Regular security audits

## Support

For deployment issues:
- Vercel Support: [https://vercel.com/support](https://vercel.com/support)
- Neon Support: [https://neon.tech/support](https://neon.tech/support)
- Canopy Issues: Create issue in GitHub repository

## Links

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Canopy Repository](https://github.com/maziyarid/Canopy)
- [Live Deployment](https://canopy.maziyarid.com)
