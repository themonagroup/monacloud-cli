# Recipe: Owner assistant

Part of Owner assistant — bring the numbers to review and decisions to make into one place.

## Goal

Build an assistant that reads reports and sales figures, reminds the owner, drafts messages and watches cash flow. It only reads approved sources and never sends mail, transfers money or makes business decisions by itself.

## Steps for the AI, in order

1. Agree on data sources, metrics, reminder schedule, delivery channel and actions that always require human approval. Start with read-only access.
2. Call `cloud_whoami`, `cloud_balance`, `cloud_budget_get`, `cloud_services` and `cloud_packages`; show existing resources, proposed capacity, VND price and total estimate.
3. Explain the MONA Agent, MONA AI and MONA Mail workarounds. Stop for the user's choices and budget approval. If funds are insufficient, call `cloud_topup` and wait for funding.
4. Create a database with `cloud_db_create` when snapshots are needed; create a VPS with `cloud_vps_create` and follow jobs with `cloud_job_status`.
5. Build read-only jobs for approved data. For MONA Pay cash flow, consume linked events and logs using `monapay_link`, `monapay_whoami`, `monapay_create_webhook` and `monapay_webhook_logs`; never treat infrastructure ledger entries as sales revenue.
6. Produce reports with source, timestamp and missing-data warnings. Keep messages as drafts for review; scheduled work may remind but never send or spend automatically.
7. Deploy the process/cron to the VPS. Test missing sources, repeated events, restart behavior and one reporting period; report the URL/channel, resources and actual cost.

## What the user must do

- Register a MONA Pass, fund the wallet when needed and approve the VND budget.
- Select data sources, grant read-only access through a secret store and complete required OTPs.
- Approve the Agent/AI/Mail workarounds, reminder schedule, alert thresholds and every send/spend action.

## Stop and ask

- Before paid resources, show balance, price and limits, then wait for approval.
- MONA Agent is not available yet — workaround: run jobs and cron on a MONA Cloud VPS.
- MONA AI is not available yet — workaround: use deterministic reports or the model API already owned by the project.
- MONA Mail is not available yet — workaround: create drafts and send Telegram reminders; the user reviews and sends.
- Ask the user to accept each workaround. Stop for OTP, permission escalation, new data sources, sending mail, money transfers or limit changes.

## Done when

- Reports include source and timestamp; sales/cash figures reconcile with received MONA Pay events.
- Reminders run on schedule without duplicating after restart and warn clearly about missing data.
- Messages stay as drafts until approved and the assistant has no money-transfer permission.
- The VPS/database appear in `cloud_services_list`, no secrets enter source and spend stays within approval.
