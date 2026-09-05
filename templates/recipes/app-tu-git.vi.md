# Công thức: Đưa app lên web (git hoặc thư mục)

## Mục tiêu

Đưa dự án local hoặc git thành app có URL HTTPS. AI làm 99% bằng cloud_app_detect và cloud_app_create(local_dir); khi API trả lỗi phải báo trạng thái thật.

## AI làm theo thứ tự

1. Gọi `cloud_app_detect({local_dir})` offline để nhận diện stack/port/start/env cần; AI hoàn thiện cấu hình build. Nguồn git dùng repo_url/branch khi được yêu cầu. Gọi `cloud_app_list`, `cloud_app_host_list`, `cloud_prices` và `cloud_packages`; kiểm tài nguyên của host đang có. Nếu chưa có host, gọi `cloud_app_create` với `sandbox: true` để lấy URL thử và ước tính host mới (0đ).
2. Gọi `cloud_balance` và `cloud_budget_get`, trình bày ước tính VND cùng repo, nhánh, build, domain. Hỏi người dùng một lần duyệt chi phí giờ/gói nếu chưa được duyệt. Giữ secret trong env, không commit hoặc in ra chat. Nếu người dùng chọn VPS thủ công, dùng `cloud_vps_create` sau khi đọc giá và duyệt.
3. Gọi `cloud_app_create` với `local_dir` và cấu hình đã duyệt; MCP ZIP → upload → poll. `app_host_id` chỉ dùng nguồn git. Poll tới `done`/`succeeded`; đọc `cloud_app_get`, `cloud_app_logs`, kiểm HTTPS/health rồi trả URL. Job timeout: tiếp tục `cloud_job_status`, không tạo app lần nữa. Custom domain: `cloud_app_domain_add` trả hướng dẫn CNAME, chờ DNS trước xác minh HTTPS.

## Người dùng cần làm

Đăng ký MONA Pass/device flow, duyệt ngân sách một lần, nạp ví khi hết credit 20k và thêm DNS cho domain riêng nếu cần.

## Điểm phải dừng hỏi người dùng

Trước chi phí mới chưa được duyệt, khi thiếu tiền, khi cần DNS, và trước khi xoá app bằng `cloud_app_delete`. Xoá app không đồng nghĩa dừng tính phí app host.

## Tiêu chí hoàn thành

Job thành công, URL thật truy cập được, secret được lưu riêng và người dùng nhận URL cùng chi phí host. Sandbox chỉ là URL thử. Khi endpoint trả 404/503 do chưa mở, báo lỗi và bước tiếp theo; không mô phỏng thành công.

Prompt Claude Code: **“Đưa dự án này lên MONA Cloud, dùng thư mục hiện tại”**.

CLI `monacloud deploy` tự dùng cwd có Dockerfile/package.json; `--local` ép thư mục, `--git` dùng origin. Cập nhật source: `cloud_app_deploy({app_id,local_dir})`; không truyền local_dir để redeploy bản cũ. ZIP loại node_modules/.git/.env*/pem/symlink, tôn trọng ignore rules, tối đa 80 MiB, giữ dist mặc định.
