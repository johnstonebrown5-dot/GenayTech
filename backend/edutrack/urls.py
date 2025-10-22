from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.shortcuts import render
from django.http import HttpResponseRedirect
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.conf import settings
from django.conf.urls.static import static


def health(_request):
    return JsonResponse({"status": "ok"})


def root_redirect(request):
    # Open the frontend index (SchoolHome) on the frontend
    frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    return HttpResponseRedirect(f"{frontend.rstrip('/')}/")


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
]

# Serve media files (e.g., uploaded logos) in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
