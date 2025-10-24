from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.shortcuts import render
from django.http import HttpResponseRedirect
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.conf import settings
from django.conf.urls.static import static


def health(_request):
    return JsonResponse({"status": "ok"})


def spa_redirect(request, path: str = ""):
    # Redirect any non-API route to the frontend, preserving path and query
    frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    target = f"{frontend}/{path}" if path else f"{frontend}/"
    query = request.META.get('QUERY_STRING')
    if query:
        target = f"{target}?{query}"
    return HttpResponseRedirect(target)


def root_redirect(request):
    # Root now opens frontend index
    return spa_redirect(request)


urlpatterns = [
    # Root now opens frontend index
    path('', root_redirect, name='root'),
    # Health check endpoint
    path('health/', health, name='health'),

    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema')),
    path('api/auth/', include('accounts.urls')),
    path('api/academics/', include('academics.urls')),
    path('api/finance/', include('finance.urls')),
    path('api/communications/', include('communications.urls')),
    path('api/reports/', include('reports.urls')),
    # Catch-all for any non-API route: send to frontend SPA
    re_path(r'^(?!api/).*$', spa_redirect),
]

# Serve media files (e.g., uploaded logos) in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
