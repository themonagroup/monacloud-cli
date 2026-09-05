# Recipe: Sales website

Part of Marketing & sales — close the order and collect payment in one flow.

## Goal

Build a store or sales app with a cart, orders and VietQR transfers that confirm automatically. Customers sign in with MONA Pass; payment status changes only after a valid, idempotently processed webhook.

## Steps for the AI, in order

1. Agree on the catalog, checkout flow, delivery policy and minimum stored data.
2. Call `cloud_whoami`, `cloud_balance`, `cloud_budget_get` and `cloud_packages`; show the capacity, VND price and total estimate.
3. Stop for budget approval. If funds are insufficient, call `cloud_topup`, present the VietQR and wait for funding.
4. Create the database with `cloud_db_create`, the VPS with `cloud_vps_create`, then follow both with `cloud_job_status`.
5. Build the app and an HMAC-verified, idempotent webhook endpoint that safely records events and updates only the matching order.
6. Call `monapay_link` if the adapter requires it and verify with `monapay_whoami`; stop only for mandatory bank-link OTP steps.
7. Create the endpoint registration with `monapay_create_webhook`, test it with `monapay_test_webhook`, inspect `monapay_webhook_logs`, then create payment QR data with `monapay_create_qr`.
8. Deploy and run one order from checkout through payment confirmation. Reconcile the amount and report the URL and actual cost.

## What the user must do

- Register a MONA Pass, fund the wallet when needed and approve the VND budget.
- Enter mandatory OTPs while linking MONA Pay to the bank; never share a password with the AI.
- Supply catalog, delivery and receiving-account details, then confirm the test order.

## Stop and ask

- Before any paid resource, run the spend guard, show balance, price and limits, then wait for approval.
- MONA Mail is not available yet — workaround: enable MONA Pay Telegram notifications or use the project's existing mail service. Ask which workaround to use; do not pretend a MONA Mail tool exists.
- Stop for OTP, wallet funding, limit changes, receiving-account changes or destructive data actions.

## Done when

- A customer can browse, order, receive the correct VietQR and sign in with MONA Pass.
- Invalid signatures are rejected and repeated webhooks cannot record payment twice.
- A test transaction moves the matching order to paid and leaves an auditable log.
- The web app and database run on MONA Cloud within the approved spend, with no secrets in source.
