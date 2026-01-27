# EDU-TRACK — Troubleshooting and Maintenance (School-Hosted)

## 1. Common issues

### Frontend cannot reach backend

- confirm `VITE_API_BASE_URL` is correct
- confirm backend is running and reachable
- check firewall and reverse proxy rules

Also check:

- CORS configuration and `FRONTEND_URL`
- whether the API base URL is correct for the environment (http vs https)
- whether requests are failing with 401/403 (authentication/permissions)

### Database connection errors

- confirm Postgres container/service is running
- verify `POSTGRES_*` environment variables
- check disk space and permissions

Also check:

- whether Postgres ran out of disk space
- whether credentials changed but services were not restarted

## 2. Operational maintenance

- apply OS security updates regularly
- rotate secrets and admin passwords
- verify backups and test restores

Recommended routine:

- weekly: check disk usage, container health, and error logs
- monthly: review staff accounts/roles, apply non-urgent updates
- quarterly: perform a restore drill in a test environment

## 3. Incident checklist

- capture logs (backend/frontend)
- note timestamps and affected users
- identify recent changes (updates/config)

Escalation (vendor support):

- company: EDUTRACK
- email: edutrack46@gmail.com
- phone: 0796031071
