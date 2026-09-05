# Recipe: Customer-care bot

Part of Marketing & sales — answer quickly, hand off correctly and avoid losing orders.

## Goal

Build a customer-care and sales bot for Zalo or Telegram. It records only necessary conversation data, hands off anything outside its scope and can create VietQR payment data without pretending to be human.

## Steps for the AI, in order

1. Agree on the channel, questions, answer rules, human handoff cases and allowed data. Require channel tokens through environment secrets, never source or chat.
2. Call `cloud_whoami`, `cloud_balance`, `cloud_budget_get` and `cloud_packages`; show the capacity, VND price and total estimate.
3. Explain the MONA Agent and MONA AI workarounds, then stop for acceptance and budget approval. If funds are insufficient, use `cloud_topup` and wait for funding.
4. Create the database with `cloud_db_create`, the VPS with `cloud_vps_create`, then follow both with `cloud_job_status`.
5. Build a bot process with an action allowlist, rate limits, redacted logs, a human handoff queue and health checks. Use deterministic rules or the project's existing model API, as approved.
6. For order payment, connect through `monapay_link`, verify `monapay_whoami`, register an endpoint using `monapay_create_webhook`, test with `monapay_test_webhook` and create VietQR data with `monapay_create_qr`.
7. Deploy to the VPS. Test in-scope and out-of-scope messages, handoff, restart and a sandbox transaction or test order; report resources and actual cost.

## What the user must do

- Register a MONA Pass, fund the wallet if needed and approve the VND budget.
- Create the Zalo or Telegram bot/channel, keep its token in a secret store and complete OTP steps required by the platform or bank.
- Approve the bot's allowed answers, the AI/Agent workarounds and mandatory handoff cases.

## Stop and ask

- Before paid resources, show balance, price and limits, then wait for approval.
- MONA Agent is not available yet — workaround: run the bot process and scheduled work on a MONA Cloud VPS. Ask for acceptance before deployment.
- MONA AI is not available yet — workaround: use deterministic rules or the model API already owned by the project. Ask which option to use; do not invent a MONA AI tool.
- Stop for OTP, wallet funding, limit changes, bulk messaging, channel changes or conversation deletion.

## Done when

- The bot receives and sends on the chosen channel, stays within scope and hands off correctly.
- Tokens never appear in source or logs; rate limiting, health checks and restart behavior work.
- The VietQR and test webhook flow is idempotent; the bot never confirms money without a valid event.
- The VPS/database appear in `cloud_services_list` and spending stays within approval.
