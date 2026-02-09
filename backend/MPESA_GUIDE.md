# M-Pesa Daraja Integration Guide

This guide describes how to configure the M-Pesa Daraja integration for EDU-TRACK.

## Configuration Options

You can configure M-Pesa at two levels:

### 1. Global Configuration (Environment Variables)
Set these in your `.env` file for a default system-wide configuration:
- `MPESA_CONSUMER_KEY`: Your Daraja App Consumer Key
- `MPESA_CONSUMER_SECRET`: Your Daraja App Consumer Secret
- `MPESA_SHORT_CODE`: Your Paybill or Till Number
- `MPESA_PASSKEY`: Your Lipa Na M-Pesa Online Passkey
- `MPESA_ENV`: `sandbox` or `production`
- `MPESA_CALLBACK_URL`: Your public HTTPS callback URL (e.g., `https://your-domain.com/api/finance/mpesa/callback/`)

### 2. Per-School Configuration (Admin Dashboard)
Schools can have their own credentials via the `MpesaConfig` model in the Finance module. This overrides the global environment variables.

## How it Works

1.  **STK Push (Lipa Na M-Pesa Online):** 
    - Students or Parents initiate a payment from the Finance dashboard.
    - The system sends a prompt to their phone.
    - Once they enter their PIN, Safaricom sends a callback to the `MPESA_CALLBACK_URL`.

2.  **Matching Logic:**
    - The system tries to match the payment to an `Invoice` using the `CheckoutRequestID`.
    - If no invoice is matched, it attempts to find a `Student` using the `AccountReference` (which should be the Admission Number).
    - If a student is found, the payment is automatically allocated to their outstanding invoices using FIFO (First-In-First-Out).
    - If no match is found, the payment is moved to the "Incoming Payments" inbox for manual reconciliation.

3.  **Notifications:**
    - Upon successful payment, an SMS and Email are automatically sent to the student/guardian if their contact details are available.

## Public Callback URL
Ensure your firewall or security groups allow POST requests from Safaricom to:
`https://your-domain.com/api/finance/mpesa/callback/`
