# Recipe: Put an app on the web (git or folder)

## Goal

Deploy a local project or repository to HTTPS. AI handles 99% using cloud_app_detect and cloud_app_create(local_dir); report API errors accurately.

## Agent workflow

1. Run `cloud_app_detect({local_dir})` offline for stack/port/start/env needs, and finish the build configuration. Use repo_url/branch for an explicitly selected git source. Read `cloud_app_list`, `cloud_app_host_list`, `cloud_prices` and `cloud_packages`. If no host exists, call `cloud_app_create` with `sandbox: true` for a free preview and host estimate.
2. Read `cloud_balance` and `cloud_budget_get`. Present the VND estimate, repository, branch, build and domain, then obtain cost approval once if not already approved. Keep secrets in environment variables. If the user chooses a manual VPS, use `cloud_vps_create` after pricing and approval.
3. Call `cloud_app_create` with the approved configuration, using `local_dir`; MCP zips, uploads and polls. `app_host_id` is only supported for git. Poll until `done`/`succeeded`; inspect `cloud_app_get`, `cloud_app_logs` and HTTPS health before reporting the URL. On timeout, resume `cloud_job_status` instead of creating another app. Use `cloud_app_domain_add` for custom domains and follow the returned CNAME instructions.

## What the user must do

Register with MONA Pass/device flow, approve costs once, top up after the 20k VND credit is exhausted and add custom DNS records if required.

## Stop and ask

For unapproved costs, insufficient funds, DNS changes and deletion with `cloud_app_delete`. Deleting an app does not stop host billing.

## Done when

The job succeeds, the real URL responds, secrets are stored privately and the user receives the URL and host costs. A sandbox URL is only a preview. Surface rollout 404/503 errors without claiming success.

Sample Claude Code prompt: “Put this project on MONA Cloud using the current folder.”

CLI `monacloud deploy` uses cwd with Dockerfile/package.json; `--local` forces the folder, `--git` uses origin. Update source with `cloud_app_deploy({app_id,local_dir})`; omit local_dir to reuse the old upload. ZIP excludes node_modules/.git/.env*/pem/symlinks, respects ignore rules, retains dist by default and is capped at 80 MiB.
