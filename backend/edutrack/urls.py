from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.shortcuts import render
from django.http import HttpResponseRedirect
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve as static_serve


def health(_request):
    return JsonResponse({"status": "ok"})


def spa_redirect(request, path: str = ""):
    # Redirect any non-API route to the frontend, preserving path and query
    frontend = str(getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
    if not frontend:
        if getattr(settings, 'DEBUG', False):
            frontend = 'http://localhost:5173'
        else:
            # Fallback to current request origin (behind proxies, SECURE_PROXY_SSL_HEADER handles scheme)
            frontend = request.build_absolute_uri('/').rstrip('/')
    target = f"{frontend}/{path}" if path else f"{frontend}/"
    query = request.META.get('QUERY_STRING')
    if query:
        target = f"{target}?{query}"
    return HttpResponseRedirect(target)


urlpatterns = [
    # Root health check instead of frontend redirect
    path('', health, name='root'),
    # Health check endpoint
    path('health/', health, name='health'),

    # Compatibility redirects for older/incorrect frontend paths hitting /api/invoices/... directly
    # Redirect to the correct finance endpoints to avoid 404s when 'finance' segment is missing.
    re_path(r'^api/invoices/(?P<pk>\d+)/stk_push(?:\.html)?/?$',
            lambda request, pk: HttpResponseRedirect(f"/api/finance/invoices/{pk}/stk_push/")),
    re_path(r'^api/invoices/(?P<pk>\d+)/coop_stk(?:\.html)?/?$',
            lambda request, pk: HttpResponseRedirect(f"/api/finance/invoices/{pk}/coop_stk/")),

    # Also normalize accidental .html and missing slash for already-correct finance paths
    re_path(r'^api/finance/invoices/(?P<pk>\d+)/stk_push(?:\.html)?$',
            lambda request, pk: HttpResponseRedirect(f"/api/finance/invoices/{pk}/stk_push/")),
    re_path(r'^api/finance/invoices/(?P<pk>\d+)/coop_stk(?:\.html)?$',
            lambda request, pk: HttpResponseRedirect(f"/api/finance/invoices/{pk}/coop_stk/")),

    # Django admin available at the standard /admin/ path
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema')),
    path('api/auth/', include('accounts.urls')),
    path('api/academics/', include('academics.urls')),
    path('api/finance/', include('finance.urls')),
    path('api/communications/', include('communications.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/webpush/', include('webpush.urls')),
]

# Serve media files (e.g., uploaded logos) in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    if not getattr(settings, 'USE_S3', False):
        urlpatterns += [
            re_path(r'^media/(?P<path>.*)$', static_serve, {'document_root': settings.MEDIA_ROOT}),
        ]
