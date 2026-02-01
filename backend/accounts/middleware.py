from django.utils.deprecation import MiddlewareMixin
from django.conf import settings

from django.db.utils import OperationalError, ProgrammingError

from .models import SchoolDomain


class SchoolDomainMiddleware(MiddlewareMixin):
    def process_request(self, request):
        raw_host = (
            request.META.get('HTTP_X_FORWARDED_HOST')
            or request.META.get('HTTP_HOST')
            or ''
        )
        host = raw_host.split(',', 1)[0].strip().split(':', 1)[0].strip().lower()
        if not host:
            request.school = None
            return None

        host_no_www = host[4:] if host.startswith('www.') else host

        base = str(getattr(settings, 'TENANT_BASE_DOMAIN', '') or '').strip().lower().lstrip('.')
        try:
            from .models import SystemConfig
            cfg = SystemConfig.objects.order_by('id').only('default_domain').first()
            if cfg is not None and str(getattr(cfg, 'default_domain', '') or '').strip():
                base = str(getattr(cfg, 'default_domain') or '').strip().lower().lstrip('.')
        except Exception:
            pass

        if base and host_no_www in (base, f"www.{base}"):
            request.school = None
            return None

        try:
            domain_obj = (
                SchoolDomain.objects.select_related('school')
                .filter(domain__iexact=host)
                .first()
            )
            if not domain_obj and host_no_www != host:
                domain_obj = (
                    SchoolDomain.objects.select_related('school')
                    .filter(domain__iexact=host_no_www)
                    .first()
                )

            is_tenant_subdomain = False
            try:
                if base and host.endswith(f".{base}") and host not in (base, f"www.{base}"):
                    is_tenant_subdomain = True
            except Exception:
                is_tenant_subdomain = False

            if not domain_obj and (host.endswith('.localhost') or host.endswith('.lvh.me') or is_tenant_subdomain):
                try:
                    sub = host.split('.', 1)[0].strip().lower()
                except Exception:
                    sub = ''
                if sub:
                    if base:
                        candidate = f"{sub}.{base}".strip().lower()
                        domain_obj = (
                            SchoolDomain.objects.select_related('school')
                            .filter(domain__iexact=candidate)
                            .first()
                        )
                    if not domain_obj:
                        try:
                            from .models import School
                            school = School.objects.filter(code__iexact=sub).first()
                            try:
                                if school is not None and getattr(school, 'is_active', True) is False:
                                    school = None
                            except Exception:
                                pass
                            request.school = school
                            return None
                        except Exception:
                            pass
            school = getattr(domain_obj, 'school', None)
            try:
                if school is not None and getattr(school, 'is_active', True) is False:
                    school = None
            except Exception:
                pass
            request.school = school
        except (OperationalError, ProgrammingError):
            request.school = None
        return None
