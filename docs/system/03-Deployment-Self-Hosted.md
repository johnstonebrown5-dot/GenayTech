# EDU-TRACK — Deployment Guide (School-Hosted)

This guide covers a typical self-hosted deployment where the School manages infrastructure.

## 1. Prerequisites

- A Linux server or Windows server capable of running Docker
- Docker + Docker Compose installed
- Domain name and TLS certificate (recommended)

Recommended minimum sizing (single school):

- CPU: 2–4 vCPU
- RAM: 4–8 GB
- Disk: 60+ GB SSD

## 1.1 Domains, Hosting, and Server Requirements

In a school-hosted deployment, the School provides/maintains hosting. Typical options include:

- on-premises server within the school
- a school-managed cloud VM

Domain and DNS requirements (recommended):

- a valid domain name
- DNS access to create records for the application (A/AAAA, CNAME)
- TLS/SSL certificate for `https://` access

If email deliverability matters, consider configuring:

- SPF
- DKIM
- DMARC

## 1.2 Internet Subscription (Connectivity)

Reliable internet is typically required for:

- remote access (where enabled)
- SMS/email delivery via third-party providers
- operating system and security updates

Recommended considerations:

- stable broadband connection sized for your user count
- backup link (optional)
- firewall/VPN controls for inbound access

## 1.3 Email (SMTP) Setup

To send emails (statements, notifications, password resets), configure an SMTP provider and a valid sender address.

Typical SMTP settings you will need:

- SMTP host
- SMTP port (`587` STARTTLS or `465` SSL)
- username (usually the full email address)
- password (prefer an app password where supported)

Typical Django environment variables:

- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS` / `EMAIL_USE_SSL`
- `DEFAULT_FROM_EMAIL`

## 1.4 Africa’s Talking SMS (Notifications) and Payments

If SMS is enabled, the School must have an Africa’s Talking account and sufficient SMS credit.

Common requirements:

- Africa’s Talking username and API key
- Sender ID approval (where applicable)
- funded wallet/SMS bundle

For payments (where implemented/contracted), integrations typically require:

- provider credentials (sandbox vs production)
- an agreed reconciliation process
- transaction fee budgeting

## 1.5 Exceptional / Optional Charges (Budgeting)

Depending on deployment choices, budget for third-party or optional costs such as:

- domain purchase and annual renewal
- hosting/server rental or hardware maintenance
- internet subscription (primary and optional backup)
- email service fees (if using a paid SMTP provider)
- SMS costs (Africa’s Talking)
- payment provider transaction fees
- off-site backups (cloud storage)
- training (if requested)
- support & maintenance (if purchased)
- custom development/integrations not in base scope

## 2. Environment variables

Create a `.env` file at the repository root or configure environment variables in your deployment system.

Key variables used by `docker-compose.yml` include:

- `DJANGO_SECRET_KEY`
- `DEBUG` (set to `False` in production)
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `FRONTEND_URL`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `VITE_API_BASE_URL`

Notes:

- Never commit `.env` into source control.
- In production, set `DEBUG=False`.
- Ensure `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` match the production domain.

## 3. Start with Docker Compose

From the repository root:

- build and start services using Docker Compose
- confirm the backend is reachable on port `8000`
- confirm the frontend is reachable on port `5173`

First-time setup checklist:

- run database migrations
- create an initial administrator user
- validate login and core workflows

## 4. Production notes

- Do not expose PostgreSQL to the public internet.
- Use a reverse proxy (e.g., Nginx) to serve frontend and proxy API with HTTPS.
- Set `DEBUG=False` and restrict `ALLOWED_HOSTS`.
- Implement backups for the Postgres volume.

Recommended production pattern:

- place a reverse proxy (e.g., Nginx) in front
- terminate HTTPS at the proxy
- route `/api` requests to the backend and serve the frontend assets

## 5. Backup and restore (recommended)

- schedule daily database dumps
- retain backups according to School policy
- test restore procedures regularly

Minimum recommended retention:

- 7 daily backups
- 4 weekly backups
- 12 monthly backups (policy-dependent)
