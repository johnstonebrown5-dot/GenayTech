import json
from django.test import TestCase, Client
from django.urls import reverse
from finance.models import Invoice, Payment, FeeCategory, IncomingPayment
from academics.models import Student, Class, Stream
from accounts.models import School
from django.contrib.auth import get_user_model

User = get_user_model()

class MpesaIntegrationTest(TestCase):
    def setUp(self):
        self.school = School.objects.create(name="Test School")
        self.stream = Stream.objects.create(name="East", school=self.school)
        self.klass = Class.objects.create(grade_level="Grade 1", stream=self.stream, school=self.school)
        self.student = Student.objects.create(
            admission_no="STU001",
            name="Test Student",
            klass=self.klass,
            school=self.school,
            phone="254700000000",
            email="test@example.com"
        )
        self.category = FeeCategory.objects.create(name="Tuition", school=self.school)
        self.invoice = Invoice.objects.create(
            student=self.student,
            amount=5000,
            category=self.category,
            year=2024,
            term=1,
            mpesa_transaction_id="ws_CO_0000000000000000000000"
        )
        self.client = Client()

    def test_mpesa_callback_success(self):
        url = reverse('mpesa-callback')
        payload = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": "12345-67890-1",
                    "CheckoutRequestID": "ws_CO_0000000000000000000000",
                    "ResultCode": 0,
                    "ResultDesc": "The service request is processed successfully.",
                    "CallbackMetadata": {
                        "Item": [
                            {"Name": "Amount", "Value": 5000.0},
                            {"Name": "MpesaReceiptNumber", "Value": "QWERTYUIOP"},
                            {"Name": "TransactionDate", "Value": 20240101120000},
                            {"Name": "PhoneNumber", "Value": 254700000000}
                        ]
                    }
                }
            }
        }
        
        response = self.client.post(url, data=json.dumps(payload), content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, 'paid')
        self.assertTrue(Payment.objects.filter(invoice=self.invoice, reference="QWERTYUIOP").exists())

    def test_mpesa_callback_auto_allocate_by_admission(self):
        # Create an invoice WITHOUT checkout ID to test auto-allocation
        invoice2 = Invoice.objects.create(
            student=self.student,
            amount=10000,
            category=self.category,
            year=2024,
            term=2
        )
        
        url = reverse('mpesa-callback')
        payload = {
            "Body": {
                "stkCallback": {
                    "ResultCode": 0,
                    "CheckoutRequestID": "unrelated_id",
                    "CallbackMetadata": {
                        "Item": [
                            {"Name": "Amount", "Value": 2000.0},
                            {"Name": "MpesaReceiptNumber", "Value": "ASDFGHJKL"},
                            {"Name": "AccountReference", "Value": "STU001"}
                        ]
                    }
                }
            }
        }
        
        response = self.client.post(url, data=json.dumps(payload), content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        # FIFO allocation pays the oldest outstanding invoice first
        self.invoice.refresh_from_db()
        invoice2.refresh_from_db()
        # self.invoice was 5000, callback was 2000 -> remains partial
        self.assertEqual(self.invoice.status, 'partial')
        # invoice2 was 10000 -> remains unpaid
        self.assertEqual(invoice2.status, 'unpaid')
        self.assertTrue(Payment.objects.filter(invoice=self.invoice, reference="ASDFGHJKL").exists())
