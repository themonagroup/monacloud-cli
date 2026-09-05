# Recipe: Internal business software

Part of Business operations — reducing operating cost protects profit.

## Goal

Build a CRM, attendance, inventory or reporting tool for the company itself. The app must enforce roles, keep company data private and run on MONA services that are available now.

## Steps for the AI, in order

1. Agree on one small workflow to ship first, its user roles, data fields and required report. Do not expand the scope without approval.
2. Call `cloud_whoami`, `cloud_balance`, `cloud_budget_get` and `cloud_packages`. Show the proposed capacity, VND price and total estimate before creating resources.
3. Stop for budget approval. If funds are insufficient, call `cloud_topup`, present the VietQR and wait for the user to fund the wallet.
4. After approval, create a suitable PostgreSQL/MySQL database with `cloud_db_create`, create the app server with `cloud_vps_create`, then follow each job with `cloud_job_status`.
5. Build the schema, migrations, API, interface and tests for the agreed workflow. Use MONA Pass for sign-in and enforce roles on the server.
6. Deploy to the VPS and test sign-in, permissions, record changes, reports and backups. Report the URL, created resources, actual cost and shutdown procedure.

## What the user must do

- Register a MONA Pass and sign in when MCP requests it.
- Fund the wallet with VietQR if needed and approve the VND budget before any paid action.
- Enter required OTPs; the AI must never request a password or guess an OTP.
- Confirm the workflow, roles and a small acceptance dataset.

## Stop and ask

- Before `cloud_db_create`, `cloud_vps_create` or any paid action, show capacity, price, balance and limits, then wait for approval.
- MONA Base is not available yet — workaround: use a MONA Cloud database, MONA Pass and an app-managed API. Ask the user to accept this workaround before creating the schema.
- Stop for OTP, wallet funding, limit changes, destructive data changes or scope expansion.

## Done when

- The URL works; MONA Pass sign-in and server-side permissions behave correctly.
- The primary workflow can create, update, find and report on the acceptance data without errors.
- The database and VPS appear in `cloud_services_list`; actual spend stays within the approved amount.
- Environment examples, migrations and backup/restore instructions are handed over without secrets in source.
