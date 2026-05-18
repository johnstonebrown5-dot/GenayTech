# PythonAnywhere Deployment Guide

This guide covers deploying the EDU-TRACK backend to PythonAnywhere.

## Prerequisites

- PythonAnywhere account (free or paid)
- Basic understanding of Django deployment
- Git repository with your code

## Step 1: Set Up PythonAnywhere Account

1. Sign up at [pythonanywhere.com](https://www.pythonanywhere.com)
2. Choose your plan (free tier has limitations)
3. Create a "Web" app in your dashboard

## Step 2: Create Virtual Environment

In the PythonAnywhere Bash console:

```bash
# Create virtual environment
mkvirtualenv edutrack

# Activate it (if not already active)
workon edutrack
```

## Step 3: Clone Your Repository

```bash
cd ~/  # Go to your home directory
git clone https://github.com/yourusername/EDU-TRACK.git
cd EDU-TRACK/backend
```

## Step 4: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 5: Set Up MySQL Database

PythonAnywhere provides MySQL databases. Set it up:

1. Go to the "Databases" tab in your PythonAnywhere dashboard
2. Create a new MySQL database
3. Note your database credentials:
   - Database name (format: `username$database_name`)
   - Username (your PythonAnywhere username)
   - Password

## Step 6: Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cd ~/EDU-TRACK/backend
nano .env
```

Add the following configuration:

```env
# Django Settings
DJANGO_SECRET_KEY=your-secure-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourusername.pythonanywhere.com,.pythonanywhere.com
CSRF_TRUSTED_ORIGINS=https://yourusername.pythonanywhere.com

# Database (MySQL)
USE_MYSQL=True
MYSQL_DB=yourusername$edutrack
MYSQL_USER=yourusername
MYSQL_PASSWORD=your-mysql-password
MYSQL_HOST=mysql.server
MYSQL_PORT=3306

# CORS Settings (for frontend)
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Frontend URL
FRONTEND_URL=https://your-frontend-domain.com

# Time Zone
TIME_ZONE=Africa/Nairobi
```

## Step 7: Run Migrations

```bash
cd ~/EDU-TRACK/backend
python manage.py migrate
```

## Step 8: Collect Static Files

```bash
python manage.py collectstatic --noinput
```

## Step 9: Configure Web App

In the PythonAnywhere "Web" tab:

1. **Set the web app type**: "Manual configuration"
2. **Python version**: 3.12
3. **Working directory**: `/home/yourusername/EDU-TRACK/backend`
4. **Virtualenv**: `/home/yourusername/.virtualenvs/edutrack`

### WSGI Configuration File

Edit the WSGI configuration file (click the link in the Web tab):

```python
import os
import sys

# Add the backend directory to the Python path
path = '/home/yourusername/EDU-TRACK/backend'
if path not in sys.path:
    sys.path.append(path)

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edutrack.settings')

# Get the WSGI application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

### Static Files Configuration

In the "Static files" section of the Web tab:

- **URL**: `/static/`
- **Directory**: `/home/yourusername/EDU-TRACK/backend/staticfiles`

## Step 10: Configure Gunicorn

In the "WSGI configuration file" section, add Gunicorn:

```python
# At the top of your WSGI file:
import os
import sys

path = '/home/yourusername/EDU-TRACK/backend'
if path not in sys.path:
    sys.path.append(path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edutrack.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()

# Gunicorn will be configured in the "Worker configuration" section
```

In the "Worker configuration" section:
- **Worker type**: `gunicorn`
- **Worker command**: `gunicorn edutrack.wsgi:application`
- **Number of workers**: 2-4 (depending on your plan)

## Step 11: Create Superuser (Optional)

```bash
cd ~/EDU-TRACK/backend
python manage.py createsuperuser
```

## Step 12: Test Your Deployment

1. Click the "Reload" button in the Web tab
2. Visit your app at `https://yourusername.pythonanywhere.com`
3. Check the error logs if something goes wrong

## Step 13: Set Up Automatic Reload

To automatically reload when you push changes:

1. Go to the "Web" tab
2. Scroll to "Source code"
3. Set up a git webhook or use manual reloads

## Troubleshooting

### 500 Errors

Check the error log in the Web tab. Common issues:
- Missing dependencies: Install them with pip
- Database connection errors: Verify MySQL credentials
- Static files not found: Run `collectstatic` again

### Database Connection Issues

```bash
# Test MySQL connection from PythonAnywhere console
mysql -h mysql.server -u yourusername -p yourusername$edutrack
```

### Permission Denied Errors

```bash
# Fix file permissions
chmod 755 ~/EDU-TRACK/backend
chmod 644 ~/EDU-TRACK/backend/.env
```

### Static Files Not Loading

- Ensure `STATIC_ROOT` is correct in settings
- Run `collectstatic` again
- Check static files path in Web tab configuration

## Security Considerations

1. **Never commit `.env` file** to git
2. **Use strong SECRET_KEY** - generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
3. **Set DEBUG=False** in production
4. **Use HTTPS** - PythonAnywhere provides SSL certificates
5. **Keep dependencies updated** - run `pip install --upgrade -r requirements.txt` regularly

## Updating the Application

When you make changes:

```bash
cd ~/EDU-TRACK/backend
git pull origin main
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

Then reload the web app in the PythonAnywhere dashboard.

## Cost Considerations

- **Free tier**: Limited CPU, no custom domain, 1 web app
- **Paid tiers**: More CPU, custom domains, multiple web apps
- MySQL database is included in paid plans

## Next Steps

1. Configure your frontend to point to the new PythonAnywhere backend
2. Set up a custom domain (if on paid plan)
3. Configure email services for notifications
4. Set up regular database backups
