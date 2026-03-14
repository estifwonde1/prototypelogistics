# CATS Warehouse Management - Deployment Guide

This guide covers deploying the CATS Warehouse Management frontend to production.

## Prerequisites

- Node.js 18+ installed
- Backend API accessible
- Web server (Nginx, Apache) or container platform (Docker, Kubernetes)

## Environment Configuration

### 1. Create Production Environment File

Create `.env.production`:

```env
VITE_API_BASE_URL=https://api.yourdomain.com/cats_warehouse/v1
VITE_ENV=production
```

### 2. Update API Base URL

Ensure your production API URL is correctly set. The app will use this to make API requests.

## Build for Production

### Standard Build

```bash
# Install dependencies
npm ci --only=production

# Build the application
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Build Output

The `dist/` folder contains:
- `index.html` - Main HTML file
- `assets/` - JavaScript, CSS, and other static assets
- `favicon.svg` - Application icon

## Deployment Options

### Option 1: Static File Server (Nginx)

#### 1. Install Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

#### 2. Copy Build Files

```bash
# Copy dist folder to web root
sudo cp -r dist/* /var/www/html/cats-warehouse/
```

#### 3. Configure Nginx

Create `/etc/nginx/sites-available/cats-warehouse`:

```nginx
server {
    listen 80;
    server_name warehouse.yourdomain.com;
    root /var/www/html/cats-warehouse;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (optional - if API is on same domain)
    location /cats_warehouse/ {
        proxy_pass http://backend-server:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 4. Enable Site and Restart Nginx

```bash
sudo ln -s /etc/nginx/sites-available/cats-warehouse /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Setup SSL (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d warehouse.yourdomain.com
```

### Option 2: Docker Deployment

#### 1. Build Docker Image

```bash
docker build -t cats-warehouse-frontend:latest .
```

#### 2. Run Container

```bash
docker run -d \
  --name cats-warehouse-frontend \
  -p 80:80 \
  cats-warehouse-frontend:latest
```

#### 3. Docker Compose (with Backend)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    environment:
      - VITE_API_BASE_URL=http://backend:3000/cats_warehouse/v1
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/cats_warehouse
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=cats_warehouse
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Run with:

```bash
docker-compose up -d
```

### Option 3: Cloud Platforms

#### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

#### AWS S3 + CloudFront

```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Post-Deployment Checklist

### 1. Verify Build

- [ ] Check that all pages load correctly
- [ ] Test navigation between pages
- [ ] Verify API connectivity
- [ ] Test authentication flow
- [ ] Check responsive design on mobile

### 2. Performance

- [ ] Run Lighthouse audit (target: 90+ score)
- [ ] Verify gzip compression is enabled
- [ ] Check asset caching headers
- [ ] Test page load times

### 3. Security

- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] CORS properly configured on backend
- [ ] No sensitive data in client-side code
- [ ] Content Security Policy (CSP) configured

### 4. Monitoring

- [ ] Setup error tracking (Sentry, LogRocket)
- [ ] Configure analytics (Google Analytics, Plausible)
- [ ] Setup uptime monitoring
- [ ] Configure log aggregation

## Environment-Specific Configuration

### Development

```env
VITE_API_BASE_URL=http://localhost:3000/cats_warehouse/v1
VITE_ENV=development
```

### Staging

```env
VITE_API_BASE_URL=https://staging-api.yourdomain.com/cats_warehouse/v1
VITE_ENV=staging
```

### Production

```env
VITE_API_BASE_URL=https://api.yourdomain.com/cats_warehouse/v1
VITE_ENV=production
```

## Troubleshooting

### Issue: 404 on Page Refresh

**Solution**: Configure server to serve `index.html` for all routes (SPA fallback).

For Nginx, use:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Issue: API CORS Errors

**Solution**: Ensure backend CORS is configured to allow your frontend domain.

```ruby
# backend/config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'https://warehouse.yourdomain.com'
    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head]
  end
end
```

### Issue: Assets Not Loading

**Solution**: Check that asset paths are correct. Vite uses absolute paths by default.

If deploying to a subdirectory, update `vite.config.ts`:

```typescript
export default defineConfig({
  base: '/warehouse/', // Subdirectory path
})
```

### Issue: Environment Variables Not Working

**Solution**: Ensure variables are prefixed with `VITE_` and rebuild the application.

```bash
# Rebuild with production env
npm run build
```

## Rollback Procedure

### Nginx Deployment

```bash
# Keep previous build
cp -r dist dist.backup

# Rollback if needed
sudo rm -rf /var/www/html/cats-warehouse/*
sudo cp -r dist.backup/* /var/www/html/cats-warehouse/
```

### Docker Deployment

```bash
# Tag images with versions
docker tag cats-warehouse-frontend:latest cats-warehouse-frontend:v1.0.0

# Rollback to previous version
docker stop cats-warehouse-frontend
docker rm cats-warehouse-frontend
docker run -d --name cats-warehouse-frontend cats-warehouse-frontend:v0.9.0
```

## Performance Optimization

### 1. Enable HTTP/2

Nginx configuration:
```nginx
listen 443 ssl http2;
```

### 2. Configure CDN

Use CloudFlare, AWS CloudFront, or similar CDN to cache static assets globally.

### 3. Preload Critical Resources

Add to `index.html`:
```html
<link rel="preload" href="/assets/main.js" as="script">
<link rel="preload" href="/assets/main.css" as="style">
```

### 4. Service Worker (Optional)

For offline support, add a service worker using Workbox or similar.

## Monitoring and Logging

### Setup Error Tracking

```bash
npm install @sentry/react
```

Configure in `main.tsx`:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: import.meta.env.VITE_ENV,
});
```

### Analytics

```typescript
// Google Analytics
import ReactGA from 'react-ga4';

ReactGA.initialize('YOUR_GA_ID');
```

## Backup and Recovery

### Backup Strategy

1. Keep last 3 production builds
2. Tag Docker images with version numbers
3. Store build artifacts in S3 or similar

### Recovery Steps

1. Identify last known good version
2. Deploy previous build
3. Verify functionality
4. Investigate and fix issue
5. Deploy fixed version

## Support

For deployment issues:
- Check logs: `sudo tail -f /var/log/nginx/error.log`
- Verify environment variables
- Test API connectivity
- Review browser console for errors

Contact: DevOps Team
