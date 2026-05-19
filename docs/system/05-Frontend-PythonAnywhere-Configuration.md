# Frontend Configuration for PythonAnywhere Backend

This guide explains how to configure the frontend to connect to your PythonAnywhere backend.

## Environment Variable Configuration

The frontend uses the `VITE_API_BASE_URL` environment variable to determine the backend API endpoint.

### For Local Development

Create or edit `.env` in the frontend directory:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### For PythonAnywhere Production

Create or edit `.env.production` in the frontend directory:

```env
VITE_API_BASE_URL=https://yourusername.pythonanywhere.com
```

### For Custom Domain on PythonAnywhere

If you have a custom domain configured:

```env
VITE_API_BASE_URL=https://your-custom-domain.com
```

## Building for Production

After setting the environment variable, build the frontend:

```bash
cd frontend
npm install
npm run build
```

## Deployment Options

### Option 1: Deploy Frontend Separately (Recommended)

Deploy the frontend to a separate service (Vercel, Netlify, or GitHub Pages):

1. Build the frontend: `npm run build`
2. Deploy the `dist/` folder to your chosen service
3. Set `VITE_API_BASE_URL` to your PythonAnywhere backend URL

### Option 2: Serve Frontend from PythonAnywhere

You can also serve the frontend from PythonAnywhere:

1. Build the frontend locally: `npm run build`
2. Upload the `dist/` folder to PythonAnywhere
3. Configure PythonAnywhere to serve static files from the `dist/` folder
4. Update the WSGI configuration to serve the frontend

### Option 3: Use PythonAnywhere as Full Stack

Configure PythonAnywhere to serve both backend and frontend:

1. Build the frontend: `npm run build`
2. Copy the `dist/` contents to PythonAnywhere static files
3. Update Django settings to serve the frontend as the root URL

## CORS Configuration

Ensure your PythonAnywhere backend allows CORS from your frontend domain. In your backend `.env` file:

```env
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
```

If using the same domain for both frontend and backend:

```env
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://yourusername.pythonanywhere.com
```

## Testing the Connection

After deployment, test the API connection:

1. Open browser developer tools
2. Navigate to your frontend
3. Check the Network tab
4. Verify API requests are going to the correct PythonAnywhere URL
5. Check for CORS errors in the console

## Common Issues

### CORS Errors

If you see CORS errors:
- Verify `CORS_ALLOWED_ORIGINS` includes your frontend domain
- Check that the protocol (http vs https) matches
- Ensure the backend is running and accessible

### Mixed Content Errors

If your frontend is HTTPS but backend is HTTP:
- Ensure PythonAnywhere is using HTTPS (automatic on paid plans)
- Update `VITE_API_BASE_URL` to use `https://`

### API Timeout Errors

If requests timeout:
- Check PythonAnywhere web app is running
- Verify the backend URL is correct
- Check PythonAnywhere error logs

## Environment Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `https://username.pythonanywhere.com` |

## Next Steps

1. Deploy your backend to PythonAnywhere following the [PythonAnywhere Deployment Guide](./04-Deployment-PythonAnywhere.md)
2. Configure your frontend environment variables
3. Build and deploy the frontend
4. Test the full application
