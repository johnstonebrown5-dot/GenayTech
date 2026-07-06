from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import School


class SuperadminSchoolAccessPolicyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.User = get_user_model()
        self.superuser = self.User.objects.create_superuser(
            username='superadmin',
            email='superadmin@example.com',
            password='superpass123',
        )
        self.school = School.objects.create(name='Test School', code='test-school')

    def test_superadmin_can_update_school_access_policy(self):
        self.client.force_authenticate(self.superuser)
        payload = {
            'is_suspended': True,
            'suspension_notice': 'Temporary maintenance for this school.',
            'suspension_until': '2030-01-01T00:00:00Z',
            'access_restrictions': {'pages': ['fees', 'reports'], 'features': ['messages']},
        }

        response = self.client.patch(f'/auth/superadmin/schools/{self.school.id}/', payload, format='json')

        self.assertEqual(response.status_code, 200)
        self.school.refresh_from_db()
        self.assertTrue(self.school.is_suspended)
        self.assertEqual(self.school.suspension_notice, 'Temporary maintenance for this school.')
        self.assertEqual(self.school.access_restrictions['pages'], ['fees', 'reports'])
        self.assertEqual(self.school.access_restrictions['features'], ['messages'])
