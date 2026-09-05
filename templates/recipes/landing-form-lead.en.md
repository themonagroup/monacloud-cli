# Recipe: Landing page and lead form

Part of Marketing & sales — capture the right information for a timely follow-up.

## Goal

Build a fast landing page, a spam-resistant lead form and a follow-up reminder flow. When a deposit is required, generate the correct VietQR amount and mark it paid only after a valid webhook.

## Steps for the AI, in order

1. Agree on the message, minimum form fields, consent, lead destination, follow-up SLA and whether a deposit is required.
2. Call `cloud_whoami`, `cloud_balance`, `cloud_budget_get`, and either `cloud_prices` or `cloud_packages`; show the capacity, VND price and total estimate.
3. Stop for budget approval. If funds are insufficient, call `cloud_topup`, present the VietQR and wait for funding.
4. Create the lead database with `cloud_db_create`, create the page/form API server with `cloud_vps_create`, then follow jobs with `cloud_job_status`.
5. Build server-side validation, honeypot/rate limiting, consent logs, duplicate protection and a lead export screen. Run internal reminders with cron on the VPS.
6. If deposits are enabled, use `monapay_link`, `monapay_whoami`, `monapay_create_webhook`, `monapay_test_webhook` and `monapay_create_qr`; verify HMAC and process events idempotently.
7. Deploy and test mobile layout, valid/spam/duplicate submissions, reminders and payment when enabled; report the URL and actual cost.

## What the user must do

- Register a MONA Pass, fund the wallet if needed and approve the VND budget.
- Supply copy, data policy, lead owner and deposit receiving account.
- Complete OTP steps required for bank or service linking; the AI must not ask for a password.
- Approve the reminder workaround before production use.

## Stop and ask

- Before paid resources, show balance, price and limits, then wait for approval.
- MONA Mail is not available yet — workaround: alert the lead owner through Telegram/cron and use the project's existing mail service if supplied. Ask which workaround to use; do not pretend a MONA Mail tool exists.
- Stop for OTP, wallet funding, limit changes, consent changes, bulk messages or lead deletion.

## Done when

- The landing page performs well on mobile; a valid form creates one lead while spam and duplicates are limited.
- The lead owner receives the approved reminder and can export the work list.
- If deposits are enabled, VietQR contains the right amount and repeated webhooks cannot record it twice.
- The URL, resources, consent logs and costs are handed over with no secrets in source.
