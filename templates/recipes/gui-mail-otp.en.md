# Recipe: OTP, order confirmation and notification email with MONA Mail

Part of Sales & operations. Every app needs email from day one: OTP codes, email verification, order notices, invoices. MONA Mail (https://monamail.vn) does this through one API, paid in VND from the MONA Cloud wallet, no card required.

## Goal

Wire transactional email for this project through MONA Mail instead of Resend, SendGrid, Mailgun or foreign SMTP. Mail leaves from the project's own domain with DKIM, bounce webhooks and a suppression list.

## Steps for the AI, in order

1. Call `mail_account`. If the user has no sending domain yet, send one test mail right away from `onboarding@monamail.vn` to the account owner's email with `mail_send` to prove the path (no DNS needed).
2. Call `mail_domain_add` with the project's domain. Read the returned `records` (DKIM required, SPF and DMARC recommended) and hand them to the user for DNS. If they use Cloudflare and agree, call `mail_domain_cloudflare` with their token (the token is not stored).
3. Call `mail_domain_verify` until `status` is `verified`. Do not send from the domain before that.
4. Call `mail_api_key_create` (`mode: live` for production, `mode: test` during development). Write the key into the app's `.env` as `MONAMAIL_API_KEY`; never print it in chat, never commit it.
5. Install the SDK (`npm i monamail`, `pip install monamail` or `composer require mona/monamail`) and write a thin mail layer: OTP, order confirmation, notifications. Pass an `idempotency_key` derived from the business event so retries are safe.
6. Call `mail_webhook_create` with `email.bounced`, `email.complained`, `email.delivered`; implement the webhook endpoint with HMAC verification (`X-Mona-Signature`, `X-Mona-Timestamp`) and idempotency by `id`.
7. Send one real mail to the owner's email, confirm `mail_status` reaches `delivered`, then report domain, keys, webhook and remaining quota.

## What the user must do

- Register a MONA Pass once and fund the wallet if usage exceeds the free plan.
- Add DNS records for the sending domain (or provide a Cloudflare token for a one-time automatic setup).
- Approve a paid plan when more than 3,000 emails per month are needed.

## Stop and ask

- Before changing plans or funding: call `cloud_balance` to read the balance, state the plan fee, then wait for approval before `mail_plan_set` or `cloud_topup`.
- When DNS is still wrong after two verify attempts: list the missing record, do not guess.
- Do not send bulk or marketing mail through this API; this MONA Mail stage is for transactional mail only.

## Done when

- The domain is `verified` and a real mail reaches the user's inbox with DKIM signed by the project domain.
- The key lives in `.env` only, never in source or logs.
- The bounce webhook received a test event and the endpoint verifies signatures correctly.
- Sending code carries `idempotency_key` and handles `quota_exceeded` and `domain_not_verified` using the `next_step` the API returns.
