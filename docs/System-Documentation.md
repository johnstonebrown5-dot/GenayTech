# EDU-TRACK — System Overview

## Vendor (Company) Contact

- **Company:** EDUTRACK
- **Email:** edutrack46@gmail.com
- **Phone:** 0796031071

## Document Scope

This documentation provides a practical overview of EDU-TRACK as implemented in this repository, including:

- what the system does (modules and users);
- how the system is structured (architecture);
- how to deploy and operate it in a school-hosted environment;
- how administrators and teachers typically use it;
- common operational issues and maintenance routines.

## 1. Purpose

EDU-TRACK is a school management system designed to support day-to-day school operations including student management, academics, and finance workflows.

## 2. Target Users

- School administrators
- Teachers
- Accounts/finance staff
- Students/parents (if enabled)

## 3. Major Features (high level)

- Student registration and management
- Class/stream management
- Attendance tracking
- Academic records and reporting
- Fee management and statement templates
- Role-based access control (RBAC)

Additional common capabilities (depending on configuration and enabled modules) include:

- Staff account management and access control
- Term/semester setup and academic calendars
- Fee item setup, balances, statements, and exports
- Activity/audit logging (where enabled)
- Optional integration placeholders (e.g., M-Pesa, external storage)

## 3.1 Dashboards (role-based)

EDU-TRACK provides dashboards depending on the signed-in user role. Common dashboards include:

- **Admin dashboard:** high-level school status such as total learners, staff, class distribution, quick links to configuration, and operational summaries.
- **Teacher dashboard:** quick access to assigned classes/streams, attendance shortcuts, and marks entry areas.
- **Finance dashboard:** fee balances, collection summaries, arrears lists, and quick statement generation.
- **Student dashboard (if enabled):** results/performance views, fee balance/statement access, and notifications.

## 3.2 Navigation tabs / modules (what is in the system)

Exact names may differ by deployment, but most schools will see tabs similar to the following:

- **Dashboard/Home:** role-based overview and shortcuts
- **Students:** admissions, biodata, enrollment, and profiles
- **Guardians/Parents:** parent/guardian contacts and communication targets (where enabled)
- **Classes/Streams:** class lists, stream setup, and allocations
- **Subjects:** subject setup and mapping to classes
- **Attendance:** daily attendance capture and summaries
- **Timetable:** lesson schedules by class/teacher (where enabled)
- **Exams/Assessments:** exam setup, mark entry, grading, and moderation (where enabled)
- **Results/Reports:** performance summaries, report cards, exports (where enabled)
- **Finance/Fees:** fee structures, balances, payments, statements, exports
- **Messaging/Notifications:** SMS/email/in-app notices (where enabled)
- **Users/Roles:** staff accounts, permissions, and access control
- **Settings:** school profile, academic year/term, and system configuration

## 3.3 Notifications (SMS, Email, and In-app)

EDU-TRACK supports multiple communication channels depending on how the school configures it:

- **SMS notifications:** commonly used for fee reminders, attendance alerts, or announcements (requires an SMS provider such as Africa’s Talking and sufficient credit).
- **Email notifications (SMTP):** commonly used for statements, official communication, and system messages (requires a valid email address and SMTP configuration).
- **In-app notifications:** alerts visible when the user signs into EDU-TRACK (useful for staff/student announcements).

Recommended practice:

- use SMS for short, time-sensitive notices
- use email for detailed communication and statements
- avoid including sensitive information in SMS

## 3.4 Timetable management

Where enabled, the Timetable area can be used to:

- define lesson periods (start/end times)
- assign subjects to classes/streams
- allocate teachers and rooms (if configured)
- publish timetables for teachers and students

## 3.5 Exam and assessment management

Where enabled, the Exams/Assessments area typically supports:

- creating an exam/assessment (term, class, subject, category)
- entering marks per learner
- computing totals, averages, and performance summaries
- generating class and student reports

Controls typically include role restrictions (teachers enter marks, admins approve/close submissions).

## 3.6 Finance management

The Finance/Fees area typically supports:

- setting fee items and fee structures
- applying/posting charges per term
- recording payments and references (receipts/transaction IDs)
- generating statements (print/email where enabled)
- tracking arrears and finance summaries

## 3.7 Key benefits

Common benefits of EDU-TRACK in a school environment include:

- **Centralized data:** one source of truth for learners, staff, academics, and finance records.
- **Faster reporting:** quicker access to class lists, performance summaries, and finance reports.
- **Improved accountability:** role-based access and clearer workflows reduce errors.
- **Better communication:** SMS, email, and in-app announcements improve parent/student engagement (where enabled).
- **Operational efficiency:** standardized processes for admissions, attendance, exams, and statements.

## 4. Technology Stack (as implemented in this repository)

- Backend: Django 5 + Django REST Framework (DRF) + JWT
- Database: PostgreSQL
- Frontend: React 18 + Vite + TailwindCSS + Axios
- Deployment (recommended): Docker Compose

## 5. Environments

- Development: local machine
- Production: school-hosted server (on-premises or school-managed cloud VM)

## 6. Assumptions and Responsibilities (School-Hosted)

- The School manages the hosting server, network access, backups, and security.
- The Vendor provides the Software and may provide support if purchased separately.

In a school-hosted deployment, the most important operational responsibilities are:

- keeping server and database credentials secure;
- performing routine backups and periodically testing restores;
- controlling who has access (especially admin accounts);
- monitoring availability (uptime) and basic resource usage (CPU/RAM/disk).

<div style='page-break-after: always;'></div>

# EDU-TRACK — Architecture

## 1. High-level architecture

EDU-TRACK uses a standard web application architecture:

- **React (frontend)** communicates with
- **Django REST API (backend)** which reads/writes
- **PostgreSQL (database)**

Typical request flow:

- A user logs in via the frontend UI.
- The frontend calls backend API endpoints over HTTP(S).
- The backend validates the request (JWT + permissions), executes business logic, and reads/writes data in PostgreSQL.
- The backend returns JSON responses that the frontend renders into the dashboard.

## 2. Repository structure

- `backend/` — Django project and apps
- `frontend/` — React application
- `docker-compose.yml` — local/dev orchestration for backend, frontend, and postgres
- `templates/` — HTML templates for statements

Operationally, you can treat the repository as two deployable units (frontend + backend) with a shared database.

## 3. Authentication and Authorization

- Authentication: JWT (JSON Web Tokens)
- Authorization: role-based access control to constrain actions per user role

Recommended approach to permissions:

- Keep a small set of clearly defined roles (e.g., Admin, Teacher, Finance).
- Grant permissions by role rather than per-user where possible.
- Review admin privileges regularly and remove access for staff who leave.

## 4. Data and storage

- Primary datastore: PostgreSQL
- Optional integrations (placeholders may exist): S3 storage, M-Pesa

Data categories commonly managed in EDU-TRACK include:

- student biodata and enrollment details
- class/stream membership
- attendance events
- exam/assessment records and computed performance summaries
- finance ledgers: invoices/fee items, balances, and statement data

## 5. Security considerations (minimum recommended)

- enforce HTTPS in production
- restrict database/network access to trusted hosts
- rotate secrets and use strong admin credentials
- implement regular backups and restore drills

Additional recommended controls for school-hosted deployments:

- place the database on a private network segment (not internet-facing)
- restrict SSH/RDP access by IP allowlists and strong authentication
- centralize server logs (or at minimum, keep logs for incident investigation)
- use a dedicated service account for automated backups

<div style='page-break-after: always;'></div>

# EDU-TRACK — Deployment Guide (School-Hosted)

This guide covers a typical self-hosted deployment where the School manages infrastructure.

## 1. Prerequisites

- A Linux server or Windows server capable of running Docker
- Docker + Docker Compose installed
- Domain name and TLS certificate (recommended)

Recommended minimum server sizing (typical single-school deployment):

- CPU: 2–4 vCPU
- RAM: 4–8 GB
- Disk: 60+ GB SSD (more if storing many years of records / file uploads)

## 1.1 Domains, Hosting, and Server Requirements

In a school-hosted deployment, the School provides/maintains hosting. Typical options include:

- on-premises server within the school
- a school-managed cloud VM (preferred for reliability)

Domain and DNS requirements (recommended):

- a valid domain name (e.g., `schoolname.ac.ke` or similar)
- DNS access to create records for the application (A/AAAA, CNAME)
- TLS/SSL certificate (Let’s Encrypt is common) for secure `https://` access

If email deliverability matters (sending statements, notifications), consider adding:

- SPF records for your sending domain
- DKIM signing (provided by your mail provider)
- a DMARC policy

## 1.2 Internet Subscription (Connectivity)

EDU-TRACK can run on a local network, but many deployments require reliable internet for:

- remote access (off-site admin/teacher access)
- SMS/email delivery via third-party providers
- operating system and security updates

Recommended considerations:

- stable broadband connection sized for expected users
- backup link (optional) to reduce downtime
- router/firewall configuration to control inbound access (or use VPN)

## 1.3 Email (SMTP) Setup

To send emails (e.g., statements, password resets, notifications), configure an SMTP provider and a valid sender address.

Recommended approach:

- use a dedicated mailbox such as `no-reply@your-domain` or `admin@your-domain`
- prefer a provider that supports SMTP with TLS

Typical SMTP settings you will need:

- SMTP host (e.g., `smtp.yourprovider.com`)
- SMTP port (commonly `587` for STARTTLS or `465` for SSL)
- username (usually the full email address)
- password (prefer an app password if using Gmail/Workspace)

Common Django environment variables (typical pattern):

- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS` / `EMAIL_USE_SSL`
- `DEFAULT_FROM_EMAIL`

Operational notes:

- do not use a personal email account for system sending in production
- if using Gmail, you may need an app password and to meet account security requirements
- test by sending a single email before enabling bulk sends

## 1.4 Africa’s Talking SMS (Notifications) and Payments

If SMS is enabled (e.g., notifying parents/guardians), the School must have an Africa’s Talking account and sufficient SMS credit.

Common requirements:

- Africa’s Talking **username** and **API key**
- approved **Sender ID** (where applicable)
- funded wallet/SMS bundle to send messages

For payments (where implemented/contracted), integrations typically require:

- an agreed payment flow (who initiates, who confirms, who reconciles)
- provider credentials and environment separation (sandbox vs production)
- audit logging and reconciliation reports

Important: SMS and payment provider charges are billed by the provider, not by EDU-TRACK, unless explicitly included in a commercial agreement.

## 1.5 Exceptional / Optional Charges (Budgeting)

Depending on the deployment choices, schools should budget for third-party or optional costs such as:

- domain purchase and annual renewal
- hosting/server rental (cloud VM) or on-premise hardware purchase/maintenance
- SSL certificate (often free with Let’s Encrypt, but may be paid in some scenarios)
- internet subscription (primary and optional backup link)
- email service fees (if using a paid SMTP provider)
- SMS costs (Africa’s Talking per-SMS charge, sender ID approval where applicable)
- payment provider transaction fees and settlement charges (where used)
- off-site backup storage (cloud storage) and backup tooling
- training (on-site/remote) if requested
- ongoing support & maintenance plan (if purchased)
- custom development or integrations not included in the base scope

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

- Never commit the `.env` file to git.
- In production, generate a strong `DJANGO_SECRET_KEY` and set `DEBUG=False`.
- Keep `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` aligned with your domain.

## 3. Start with Docker Compose

From the repository root:

- build and start services using Docker Compose
- confirm the backend is reachable on port `8000`
- confirm the frontend is reachable on port `5173`

Initial provisioning checklist (typical first-time setup):

- start the stack
- run database migrations
- create an initial administrator account
- verify login and basic CRUD operations (create a class, register a student, etc.)

## 4. Production notes

- Do not expose PostgreSQL to the public internet.
- Use a reverse proxy (e.g., Nginx) to serve frontend and proxy API with HTTPS.
- Set `DEBUG=False` and restrict `ALLOWED_HOSTS`.
- Implement backups for the Postgres volume.

Reverse proxy (recommended):

- terminate TLS at the proxy
- serve the frontend as static assets
- proxy API requests to the backend service

## 5. Backup and restore (recommended)

- schedule daily database dumps
- retain backups according to School policy
- test restore procedures regularly

Minimum recommended backup policy:

- daily automated backups
- keep at least 7 daily backups
- keep at least 4 weekly backups
- keep at least 12 monthly backups (depending on policy)

Restore drills:

- perform a restore to a test environment at least quarterly
- validate that key workflows still work (login, search students, open statements)

<div style='page-break-after: always;'></div>

# EDU-TRACK — Administrator Guide

## 1. Admin responsibilities

- create and manage user accounts
- assign roles and permissions
- configure school settings (terms, classes, fee structures)
- monitor data quality and resolve conflicts
- manage backups and retention (school-hosted)

In practice, administrators are responsible for keeping system data accurate and ensuring each staff member only sees what they need.

## 2. Suggested operational workflows

- onboarding: create staff accounts and roles
- student intake: add/import students and guardians
- term setup: create terms and class allocations
- finance setup: configure fee items and balances

Suggested month/term cycle:

- create a new term
- confirm class lists and enrollments
- configure fee items for the term (if fee structure changes)
- confirm user access for new staff
- generate reports (attendance, performance, fee collection) at agreed intervals

## 3. Security checklist

- enforce strong passwords
- restrict admin access to trusted devices/networks
- review audit logs if available
- remove accounts for exiting staff

Incident readiness:

- know where application logs live (backend and reverse proxy)
- keep an inventory of servers and credentials (stored securely)
- document a rollback plan before applying upgrades

<div style='page-break-after: always;'></div>

# EDU-TRACK — Teacher Guide

## 1. Typical teacher tasks

- view class lists
- take attendance
- enter/update marks
- view student performance

Suggested daily routine:

- confirm you are operating in the correct class/stream and term
- take attendance early in the day
- enter marks as soon as assessments are completed (to avoid end-term rush)

## 2. Data accuracy

- confirm the correct term and class before entering marks
- avoid sharing credentials
- report data issues to the administrator

Common errors to avoid:

- entering marks under the wrong term or exam category
- editing the wrong student because of similar names (always confirm admission number)
- sharing login credentials across staff

## 3. Support

If you encounter errors, provide the administrator with:

- what you were doing
- the exact error message
- time of occurrence

If possible, also include:

- screenshot of the error
- browser name/version (Chrome/Edge/Firefox)
- whether other users are affected

<div style='page-break-after: always;'></div>

# EDU-TRACK — Troubleshooting and Maintenance (School-Hosted)

## 1. Common issues

### Frontend cannot reach backend

- confirm `VITE_API_BASE_URL` is correct
- confirm backend is running and reachable
- check firewall and reverse proxy rules

Also check:

- CORS settings and `FRONTEND_URL`
- whether the API URL is using the correct scheme (http vs https)
- whether the backend is returning 401/403 due to authentication/permissions

### Database connection errors

- confirm Postgres container/service is running
- verify `POSTGRES_*` environment variables
- check disk space and permissions

Also check:

- whether the database password changed in `.env` but the running service wasn't restarted
- whether Postgres ran out of disk space (a common cause of sudden failures)

## 2. Operational maintenance

- apply OS security updates regularly
- rotate secrets and admin passwords
- verify backups and test restores

Recommended routines:

- weekly: review disk usage, container/service health, and error logs
- monthly: rotate privileged credentials, review staff accounts, apply non-urgent updates
- quarterly: restore drill and basic security review

## 3. Incident checklist

- capture logs (backend/frontend)
- note timestamps and affected users
- identify recent changes (updates/config)

Escalation (vendor support):

- company: EDUTRACK
- email: edutrack46@gmail.com
- phone: 0796031071

<div style='page-break-after: always;'></div>
