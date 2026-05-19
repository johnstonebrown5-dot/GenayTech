# Production Deployment Fixes - Broken Pipe & API Issues

## Executive Summary

This document summarizes all fixes applied to resolve production deployment issues including:
- Broken pipe / SIGPIPE errors
- Unauthorized (401) API requests
- Internal Server Errors (500)
- White screen on frontend route refresh
- Token refresh failures
- Slow database queries causing timeouts

## Root Causes Identified

### 1. **Frontend API Configuration Issue**
- **Problem**: `VITE_API_BASE_URL` environment variable was not set in production on Render
- **Impact**: API calls used relative paths (`/api/...`) which failed because frontend is on Render and backend is on PythonAnywhere
- **Solution**: Set `VITE_API_BASE_URL=https://edutrack45.pythonanywhere.com` in frontend render.yaml

### 2. **CORS Configuration Mismatch**
- **Problem**: Backend `CORS_ALLOWED_ORIGINS` pointed to `https://edutrack-frontend.netlify.app` but actual frontend is at `https://genaytech.onrender.com`
- **Impact**: 401 Unauthorized errors on all API requests
- **Solution**: Updated PythonAnywhere environment variables to include correct frontend URL

### 3. **Database Connection Issues**
- **Problem**: `CONN_MAX_AGE` was too high (60s) causing connection exhaustion on PythonAnywhere shared MySQL
- **Impact**: Broken pipe errors when clients disconnected before queries completed
- **Solution**: Reduced `CONN_MAX_AGE` to 30s, added `CONNECT_TIMEOUT` (10s), added query timeout (30s)

### 4. **Slow Database Queries**
- **Problem**: DeliveryLog queries lacked proper indexes and used N+1 query patterns
- **Impact**: 500 errors on `/api/communications/delivery-logs/recent/` endpoint
- **Solution**: Added composite indexes, optimized queries with `select_related`, used aggregation instead of multiple count queries

### 5. **Frontend Timeout Issues**
- **Problem**: Axios timeout was too low (30s) for slow PythonAnywhere responses
- **Impact**: Requests timed out before backend could respond
- **Solution**: Increased timeout to 60s, added retry logic with exponential backoff

### 6. **Missing Error Handling**
- **Problem**: No custom exception handler for network errors and broken pipes
- **Impact**: Poor error messages, difficult debugging
- **Solution**: Added custom exception handler with proper error logging

## Files Modified

### Frontend Changes

#### 1. `frontend/render.yaml` (NEW)
```yaml
services:
  - type: web
    name: edutrack-frontend
    env: static
    buildCommand: npm install && npm run build
    publish: dist
    envVars:
      - key: VITE_API_BASE_URL
        value: https://edutrack45.pythonanywhere.com
```

**Purpose**: Configure Render deployment with correct backend URL

#### 2. `frontend/src/api.js`
**Changes**:
- Increased timeout from 30s to 60s
- Added retry logic for network errors (ECONNABORTED, ECONNRESET, ETIMEDOUT, EPIPE)
- Added request cancellation support to prevent memory leaks
- Added exponential backoff for retries
- Improved error messages for network errors
- Added cleanup of pending requests

**Key Code**:
```javascript
const api = axios.create({
  baseURL: backendBase.replace(/\/$/, '') + '/api',
  timeout: 60000, // Increased from 30000
})

// Retry logic for network errors
const isRetryable = (
  error.code === 'ECONNABORTED' ||
  error.code === 'ECONNRESET' ||
  error.code === 'ETIMEDOUT' ||
  error.code === 'EPIPE' ||
  (error.response && error.response.status >= 500) ||
  !error.response
)
```

### Backend Changes

#### 3. `backend/edutrack/settings.py`
**Changes**:
- Reduced `CONN_MAX_AGE` from 60 to 30 seconds
- Added `CONNECT_TIMEOUT` (10 seconds)
- Added `TIMEOUT` for queries (30 seconds)
- Added custom exception handler configuration
- Updated MySQL init command to set wait_timeout and interactive_timeout

**Key Code**:
```python
DATABASES = {
    'default': {
        'CONN_MAX_AGE': int(os.getenv('MYSQL_CONN_MAX_AGE', '30')),  # Reduced from 60
        'CONNECT_TIMEOUT': int(os.getenv('MYSQL_CONNECT_TIMEOUT', '10')),
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES', wait_timeout=28800, interactive_timeout=28800",
        },
        'TIMEOUT': int(os.getenv('MYSQL_QUERY_TIMEOUT', '30')),
    }
}

REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'edutrack.exceptions.custom_exception_handler',
}
```

#### 4. `backend/edutrack/exceptions.py` (NEW)
**Purpose**: Custom exception handler for better error responses and logging

**Key Features**:
- Logs all API errors with context (view, path, method, user)
- Provides user-friendly error messages
- Handles 401, 403, 404, 500 errors with appropriate messages
- Includes timestamp for debugging

#### 5. `backend/communications/models.py`
**Changes**:
- Added composite indexes for DeliveryLog model:
  - `school_id, created_at`
  - `school_id, channel, created_at`
  - `school_id, status`

**Purpose**: Optimize query performance for common filter patterns

#### 6. `backend/communications/views.py`
**Changes**:
- Added `select_related('school')` to DeliveryLogViewSet to reduce N+1 queries
- Added `select_related('school', 'klass')` to latest_progress query
- Optimized DeliveryLog count queries using aggregation instead of multiple count() calls
- Added `Count` import from django.db.models

**Key Code**:
```python
# Before: Multiple count queries
sms_sent = dl.filter(channel='sms', ok=True).count()
sms_failed = dl.filter(channel='sms', ok=False).count()
email_sent = dl.filter(channel='email', ok=True).count()
email_failed = dl.filter(channel='email', ok=False).count()

# After: Single aggregation query
dl_counts = (
    DeliveryLog.objects
    .filter(school_id=school_id, context__contains=f"campaign:{camp.id}")
    .values('channel', 'ok')
    .annotate(count=models.Count('id'))
)
```

#### 7. `backend/communications/migrations/0017_add_deliverylog_indexes.py` (NEW)
**Purpose**: Create database indexes for DeliveryLog model

### Configuration Changes

#### 8. `docs/system/pythonanywhere-env-template.txt`
**Changes**:
- Updated `CORS_ALLOWED_ORIGINS` to `https://genaytech.onrender.com`
- Updated `FRONTEND_URL` to `https://genaytech.onrender.com`
- Updated `ALLOWED_HOSTS` to include `edutrack45.pythonanywhere.com` and `genaytech.onrender.com`
- Updated `CSRF_TRUSTED_ORIGINS` to include both domains

#### 9. `render.yaml` (root)
**Changes**: Disabled backend deployment on Render (backend is on PythonAnywhere)

## Deployment Steps

### Step 1: Apply Backend Changes to PythonAnywhere

1. **SSH into PythonAnywhere**:
   ```bash
   # Connect via SSH or use the web console
   cd ~/EDU-TRACK/backend
   ```

2. **Pull latest changes**:
   ```bash
   git pull origin main
   ```

3. **Install dependencies**:
   ```bash
   source ~/.virtualenvs/edutrack/bin/activate
   pip install -r requirements.txt
   ```

4. **Apply migrations**:
   ```bash
   python manage.py migrate
   ```

5. **Update environment variables** in PythonAnywhere web app settings:
   ```
   CORS_ALLOWED_ORIGINS=https://genaytech.onrender.com
   FRONTEND_URL=https://genaytech.onrender.com
   ALLOWED_HOSTS=edutrack45.pythonanywhere.com,.pythonanywhere.com,genaytech.onrender.com
   CSRF_TRUSTED_ORIGINS=https://edutrack45.pythonanywhere.com,https://genaytech.onrender.com
   MYSQL_CONN_MAX_AGE=30
   MYSQL_CONNECT_TIMEOUT=10
   MYSQL_QUERY_TIMEOUT=30
   ```

6. **Reload web app**:
   - Go to PythonAnywhere Web tab
   - Click "Reload" button

### Step 2: Deploy Frontend to Render

1. **Push changes to git**:
   ```bash
   git add .
   git commit -m "Fix production deployment issues - broken pipes and API errors"
   git push origin main
   ```

2. **Render will auto-deploy**:
   - Render will detect the new `frontend/render.yaml` file
   - Build and deploy with correct `VITE_API_BASE_URL`

3. **Verify deployment**:
   - Visit https://genaytech.onrender.com
   - Check browser console for errors
   - Test login functionality
   - Test API calls in Network tab

### Step 3: Verify Fixes

1. **Test API communication**:
   - Open browser DevTools (F12)
   - Go to Network tab
   - Login to the application
   - Verify API requests go to `https://edutrack45.pythonanywhere.com/api/...`
   - Verify no 401 errors
   - Verify no CORS errors

2. **Test delivery logs endpoint**:
   - Navigate to Admin > Communication Logs
   - Verify recent delivery logs load without 500 errors
   - Verify response time is acceptable (< 5 seconds)

3. **Test token refresh**:
   - Wait for access token to expire (60 minutes)
   - Make an API request
   - Verify automatic token refresh works
   - Verify no redirect to login page

4. **Test route refresh**:
   - Navigate to a protected route (e.g., /admin/students)
   - Refresh the page (F5)
   - Verify page loads correctly (no white screen)
   - Verify user remains authenticated

## Testing Checklist

- [ ] Frontend loads without white screen on route refresh
- [ ] Login works correctly
- [ ] API requests go to correct backend URL
- [ ] No 401 Unauthorized errors
- [ ] No CORS errors in console
- [ ] Delivery logs endpoint loads without 500 errors
- [ ] Token refresh works automatically
- [ ] No broken pipe errors in PythonAnywhere logs
- [ ] Response times are acceptable (< 5 seconds for most endpoints)
- [ ] Network errors are retried automatically
- [ ] Error messages are user-friendly

## Monitoring

### PythonAnywhere Logs
Check these logs regularly:
- **Error log**: `/var/log/edutrack45.pythonanywhere.com.server.log`
- **Access log**: `/var/log/edutrack45.pythonanywhere.com.access.log`

Look for:
- SIGPIPE errors (should be significantly reduced)
- 500 errors (should be eliminated)
- Timeout errors (should be reduced)
- Database connection errors (should be eliminated)

### Render Logs
Check Render dashboard for:
- Build errors
- Runtime errors
- Deployment status

## Expected Improvements

### Before Fixes
- Frequent SIGPIPE errors
- 401 Unauthorized errors on most endpoints
- 500 Internal Server Errors on delivery-logs endpoint
- White screen on route refresh
- Token refresh failures
- Slow API responses (> 10 seconds)

### After Fixes
- SIGPIPE errors eliminated or significantly reduced
- No 401 errors (CORS configured correctly)
- No 500 errors (queries optimized)
- No white screen (SPA routing works)
- Token refresh works automatically
- API responses < 5 seconds
- Automatic retry on network errors
- Better error messages for users

## Rollback Plan

If issues occur after deployment:

1. **Frontend Rollback**:
   ```bash
   git revert <commit-hash>
   git push origin main
   # Render will auto-revert
   ```

2. **Backend Rollback**:
   ```bash
   cd ~/EDU-TRACK/backend
   git revert <commit-hash>
   python manage.py migrate
   # Reload web app in PythonAnywhere dashboard
   ```

3. **Environment Variables Rollback**:
   - Revert to previous values in PythonAnywhere web app settings
   - Reload web app

## Additional Recommendations

### 1. Enable Database Connection Pooling
Consider using connection pooling middleware like `django-db-geventpool` for better performance on PythonAnywhere.

### 2. Add Monitoring
Set up application monitoring (Sentry, New Relic, or similar) to track errors and performance.

### 3. Add Rate Limiting
Implement rate limiting on critical endpoints to prevent abuse and reduce load.

### 4. Add Caching
Consider caching frequently accessed data (school settings, user profiles) using Redis or Django's cache framework.

### 5. Optimize Static Files
Ensure static files are served efficiently using WhiteNoise or CDN.

## Support

If issues persist after applying these fixes:

1. Check PythonAnywhere error logs for specific error messages
2. Check browser console for frontend errors
3. Verify environment variables are set correctly
4. Test API endpoints directly using curl or Postman
5. Check database connection status in PythonAnywhere

## Summary of Changes

| File | Type | Purpose |
|------|------|---------|
| frontend/render.yaml | NEW | Configure Render deployment with backend URL |
| frontend/src/api.js | MODIFIED | Add retry logic, increase timeout, add request cancellation |
| backend/edutrack/settings.py | MODIFIED | Optimize database connections, add exception handler |
| backend/edutrack/exceptions.py | NEW | Custom exception handler for better error responses |
| backend/communications/models.py | MODIFIED | Add database indexes for query optimization |
| backend/communications/views.py | MODIFIED | Optimize queries, add select_related, use aggregation |
| backend/communications/migrations/0017_add_deliverylog_indexes.py | NEW | Create database indexes |
| docs/system/pythonanywhere-env-template.txt | MODIFIED | Update CORS and frontend URL configuration |
| render.yaml (root) | MODIFIED | Disable backend deployment on Render |

## Next Steps

1. Apply all changes to production
2. Monitor logs for 24-48 hours
3. Verify all issues are resolved
4. Document any additional issues found
5. Consider implementing additional optimizations from recommendations section
