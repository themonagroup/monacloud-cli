# Công thức: App từ git trên MONA Cloud (đang mở)

## Mục tiêu

Deploy repository thành app có URL HTTPS bằng `cloud_app_create`. Endpoint Wave B đang mở; khi API chưa live phải báo trạng thái thật, không báo deploy thành công.

## AI làm theo thứ tự

1. Đọc git remote origin và nhánh hiện tại, chọn dockerfile/nixpacks/static. Gọi `cloud_app_list`, `cloud_app_host_list`, `cloud_prices` và `cloud_packages`; kiểm tài nguyên của host đang có. Nếu chưa có host, gọi `cloud_app_create` với `sandbox: true` để lấy URL thử và ước tính host mới (0đ).
2. Gọi `cloud_balance` và `cloud_budget_get`, trình bày ước tính VND cùng repo, nhánh, build, domain. Chờ người dùng duyệt chi phí trước khi tạo thật. Giữ secret trong env, không commit hoặc in ra chat. Nếu người dùng chọn VPS thủ công, dùng `cloud_vps_create` sau khi đọc giá và duyệt.
3. Gọi `cloud_app_create` với cấu hình đã duyệt và `app_host_id` nếu dùng host có sẵn. Poll tới `done`/`succeeded`; đọc `cloud_app_get`, `cloud_app_logs`, kiểm HTTPS/health rồi trả URL. Job timeout: tiếp tục `cloud_job_status`, không tạo app lần nữa. Custom domain: `cloud_app_domain_add` trả hướng dẫn CNAME, chờ DNS trước xác minh HTTPS.

## Người dùng cần làm

Đăng nhập MONA Pass, duyệt ngân sách, nạp ví khi thiếu và thêm DNS cho domain riêng nếu cần.

## Điểm phải dừng hỏi người dùng

Trước chi phí mới chưa được duyệt, khi thiếu tiền, khi cần quyền truy cập repo private hoặc DNS, và trước khi xoá app bằng `cloud_app_delete`. Xoá app không đồng nghĩa dừng tính phí app host.

## Tiêu chí hoàn thành

Job thành công, URL thật truy cập được, secret được lưu riêng và người dùng nhận URL cùng chi phí host. Sandbox chỉ là URL thử. Khi endpoint trả 404/503 do chưa mở, báo lỗi và bước tiếp theo; không mô phỏng thành công.

Prompt mẫu: “Deploy repo hiện tại lên MONA Cloud. Đọc host, thử sandbox nếu chưa có host, báo chi phí để tôi duyệt rồi mới deploy thật.”
