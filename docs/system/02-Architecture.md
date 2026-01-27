# EDU-TRACK — Architecture

## 1. High-level architecture

EDU-TRACK uses a standard web application architecture:

- **React (frontend)** communicates with
- **Django REST API (backend)** which reads/writes
- **PostgreSQL (database)**

Typical request flow:

- User signs in via the frontend.
- Frontend sends API calls to the backend with a JWT access token.
- Backend validates authentication and permissions, then performs business logic.
- Backend returns JSON responses consumed by the frontend.

## 2. Repository structure

- `backend/` — Django project and apps
- `frontend/` — React application
- `docker-compose.yml` — local/dev orchestration for backend, frontend, and postgres
- `templates/` — HTML templates for statements

Operational note: the system is effectively two services (frontend + backend) plus a database. In production you typically front them with a reverse proxy (TLS termination + routing).

## 3. Authentication and Authorization

- Authentication: JWT (JSON Web Tokens)
- Authorization: role-based access control to constrain actions per user role

Recommended role model:

- **Admin:** full administrative control and configuration.
- **Teacher:** academic workflows (attendance and marks).
- **Finance:** fee setup, balances, statements and exports.

## 4. Data and storage

- Primary datastore: PostgreSQL
- Optional integrations (placeholders may exist): S3 storage, M-Pesa

Backups should focus on the PostgreSQL database (and any uploaded files if the deployment enables them).

## 5. Security considerations (minimum recommended)

- enforce HTTPS in production
- restrict database/network access to trusted hosts
- rotate secrets and use strong admin credentials
- implement regular backups and restore drills

Additional recommended controls:

- restrict SSH/RDP to trusted IPs
- centralize and retain logs for incident analysis
- separate database network access from public internet
