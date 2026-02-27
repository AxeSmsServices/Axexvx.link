# Axexvx.link — URL Shortener

A full-stack URL shortener with APK distribution support, Bulk SMS campaigns, real-time analytics, and custom domains.

## Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (via `better-sqlite3`) — zero-config, file-based
- **Frontend**: Vanilla HTML/CSS/JS (served as static files)
- **Deployment**: Docker + Docker Compose + Nginx (optional)

---

## Quick Start (Local)

```bash
# 1. Clone & install
git clone https://github.com/yourname/axexvx-link.git
cd axexvx-link
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env as needed

# 3. Start server
npm start
# → http://localhost:3000
```

---

## Deploy with Docker

```bash
# Build & run
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

The SQLite database is persisted in a Docker volume (`axexvx_data`).

---

## Deploy on VPS (Ubuntu/Debian)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone & install
git clone https://github.com/yourname/axexvx-link.git /opt/axexvx
cd /opt/axexvx
npm install --omit=dev

# Configure
cp .env.example .env
nano .env  # set BASE_DOMAIN, PORT, etc.

# Run with PM2 (process manager)
npm install -g pm2
pm2 start server.js --name axexvx
pm2 save
pm2 startup
```

### Nginx + SSL (Let's Encrypt)

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d axexvx.link -d www.axexvx.link
sudo cp nginx.conf /etc/nginx/sites-available/axexvx
sudo ln -s /etc/nginx/sites-available/axexvx /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## API Reference

### Shorten a URL
```
POST /api/links
Content-Type: application/json

{
  "url": "https://your-long-url.com",
  "alias": "my-brand",          // optional custom alias
  "domain": "axexvx.link",      // optional domain
  "expires_at": "2025-12-31",   // optional expiry date
  "max_clicks": 1000            // optional click limit
}
```

### Get link info + stats
```
GET /api/links/:code
```

### List all links
```
GET /api/links?page=1&limit=20
```

### Delete a link
```
DELETE /api/links/:code
```

### Global stats
```
GET /api/stats
```

### Link-specific stats
```
GET /api/stats/:code
```

### Create SMS campaign
```
POST /api/sms
Content-Type: application/json

{
  "name": "Summer Sale",
  "sender_id": "AXEXVX",
  "message": "Hi! Check this: https://axexvx.link/sale",
  "phone_numbers": ["+1234567890", "+0987654321"],
  "scheduled_at": "2025-06-01T10:00:00Z"  // optional
}
```

### Health check
```
GET /health
```

---

## Database Schema

| Table | Description |
|-------|-------------|
| `links` | Shortened URLs with metadata |
| `clicks` | Click tracking (IP, device, country, referrer) |
| `sms_campaigns` | Bulk SMS campaign records |
| `apk_files` | APK file metadata and download stats |

---

## Environment Variables

See [`.env.example`](.env.example) for all options.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `BASE_DOMAIN` | `axexvx.link` | Primary short domain |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins |
| `NODE_ENV` | `development` | Environment |
