# Recipe: Git app on MONA Cloud (rollout in progress)

## Goal

Deploy a repository to an HTTPS URL using `cloud_app_create`. Wave B endpoints are rolling out; report unavailable endpoints accurately.

## Agent workflow

1. Read git remote origin and the current branch; choose dockerfile/nixpacks/static. Read `cloud_app_list`, `cloud_app_host_list`, `cloud_prices` and `cloud_packages`. If no host exists, call `cloud_app_create` with `sandbox: true` for a free preview and host estimate.
2. Read `cloud_balance` and `cloud_budget_get`. Present the VND estimate, repository, branch, build and domain, then obtain approval for new costs. Keep secrets in environment variables. If the user chooses a manual VPS, use `cloud_vps_create` after pricing and approval.
3. Call `cloud_app_create` with the approved configuration, including `app_host_id` when reusing a host. Poll until `done`/`succeeded`; inspect `cloud_app_get`, `cloud_app_logs` and HTTPS health before reporting the URL. On timeout, resume `cloud_job_status` instead of creating another app. Use `cloud_app_domain_add` for custom domains and follow the returned CNAME instructions.

## What the user must do

Sign in with MONA Pass, approve costs, top up when needed and add custom DNS records if required.

## Stop and ask

For unapproved costs, insufficient funds, private repository access, DNS changes and deletion with `cloud_app_delete`. Deleting an app does not stop host billing.

## Done when

The job succeeds, the real URL responds, secrets are stored privately and the user receives the URL and host costs. A sandbox URL is only a preview. Surface rollout 404/503 errors without claiming success.

Sample prompt: “Deploy this repository on MONA Cloud. Inspect hosts, use sandbox if no host exists, and show the cost for approval before deploying.”
