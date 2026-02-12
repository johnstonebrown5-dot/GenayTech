#!/usr/bin/env python
"""
Comprehensive data seeding script for Genay Technologies
Seeds: Schools, Classes, Teachers, Students, Payments, and Results
"""

import os
import sys
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edutrack.settings')

# Setup Django
django.setup()

from django.core.management import call_command

def main():
    print("=" * 60)
    print("Genay Technologies Comprehensive Data Seeding")
    print("=" * 60)
    
    # Step 1: Seed basic data (schools, classes, teachers, students)
    print("\n[1/3] Seeding schools, classes, teachers, and students...")
    print("-" * 60)
    try:
        call_command('seed_data', '--schools=2', '--teachers-per-school=15', '--students-per-school=100')
        print("✓ Basic data seeded successfully!")
    except Exception as e:
        print(f"✗ Error seeding basic data: {e}")
        return
    
    # Step 2: Seed payment data
    print("\n[2/3] Seeding payment data (invoices and payments)...")
    print("-" * 60)
    try:
        call_command('seed_payments', '--invoices-per-student=2', '--payments-per-invoice=1')
        print("✓ Payment data seeded successfully!")
    except Exception as e:
        print(f"✗ Error seeding payment data: {e}")
        # Continue even if payment seeding fails
    
    # Step 3: Seed exam results
    print("\n[3/3] Seeding exam results...")
    print("-" * 60)
    try:
        call_command('seed_results', '--exams-per-class=2')
        print("✓ Exam results seeded successfully!")
    except Exception as e:
        print(f"✗ Error seeding exam results: {e}")
        # Continue even if results seeding fails
    
    print("\n" + "=" * 60)
    print("✓ All data seeding completed!")
    print("=" * 60)
    print("\nYou can now:")
    print("  1. Run the Django server: python manage.py runserver")
    print("  2. Login with seeded user credentials")
    print("  3. Explore the application with realistic data")
    print("\nNote: All users have the default password 'password123'")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nSeeding interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
