import os
import sys
import django
from dotenv import load_dotenv

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edutrack.settings') # Adjust if settings path is different
django.setup()

from finance.coop_stk import CoopStkClient

def test_coop_stk():
    print("--- Starting Co-op STK Push Test ---")
    client = CoopStkClient()
    
    # Test phone number (use a valid M-Pesa registered number for actual prompt)
    test_phone = "254796031071" 
    test_amount = 1.0
    
    print(f"Attempting STK Push to {test_phone} for KES {test_amount}...")
    
    try:
        response = client.stk_push(
            phone=test_phone,
            amount=test_amount,
            account_ref="TEST-COOP",
            tx_desc="STK Push Integration Test"
        )
        print("\nResponse received from Co-op:")
        print(response)
        
        if response and response.get('CheckoutRequestID'):
            print("\nSUCCESS: STK Push initiated successfully!")
            print(f"CheckoutRequestID: {response.get('CheckoutRequestID')}")
        else:
            print("\nFAILED: Response did not contain CheckoutRequestID.")
            
    except Exception as e:
        print(f"\nERROR occurred during STK Push: {str(e)}")

if __name__ == "__main__":
    test_coop_stk()
