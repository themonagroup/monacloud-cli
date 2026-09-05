# monacloud 0.3.0 — lệnh compute

| Lệnh | MCP tool | Kết quả |
|---|---|---|
| `monacloud plans` | `cloud_plan_list` | Bảng cấu hình, giá tháng/năm, gợi ý |
| `monacloud vps create --plan kinh-doanh --monthly` | `cloud_plan_list`, `cloud_balance`, `cloud_vps_create`, `cloud_job_status` | Báo giá, hỏi duyệt, tạo VPS và chờ job |
| `monacloud invoices` | `cloud_invoice_list` | Hoá đơn của tài khoản |
| `monacloud invoices --pdf <id>` | `cloud_invoice_pdf` | Đường dẫn PDF tạm riêng tư |
| `monacloud deploy` | `cloud_app_host_list`, `cloud_app_create`, `cloud_balance` | Sandbox trước khi cần host mới, báo ước tính, hỏi duyệt, deploy và in URL |
| `monacloud init --recipe app-tu-git` | Không gọi API | Recipe VI/EN: đọc → ước tính/duyệt → deploy/kiểm URL |

Compute cần executable `monacloud-mcp >=0.3.0` trong `node_modules/.bin`, PATH, `MONACLOUD_MCP_BIN`, hoặc npm cache. CLI gọi MCP qua stdio để dùng chung MONA Pass, refresh token, PDF và spend guard. Fallback npx luôn dùng `--offline`; CLI không tự tải package. Đăng nhập bằng `monacloud-mcp login`, hoặc cấu hình `MONACLOUD_TOKEN` qua env. `MONACLOUD_API`, `MONACLOUD_CONFIG_DIR` và các env MCP hiện có vẫn dùng được; CLI không tự đọc `.env.monacloud`.

VPS nhận `--name` (mặc định tên thư mục), `--period month|year` (mặc định month), `--sandbox`, `--dry-run`, `--yes`. Monthly đọc toàn bộ giá kỳ từ API. Sandbox thử cấu hình plan qua hourly sandbox do backend chưa nhận monthly sandbox, không tạo subscription; giá thật vẫn được hiển thị.

Deploy nhận `--repo`, `--branch`, `--build dockerfile|nixpacks|static`, `--dockerfile`, `--domain`, `--app-host`, `--port`, `--sandbox`, `--dry-run`, `--yes`. Mặc định repo từ `git remote get-url origin`, branch từ `git branch --show-current`, build dockerfile, port 3000. Ngoài git hoặc detached HEAD cần truyền phần còn thiếu. SSH remote phổ biến được đổi sang URL public HTTPS tương đương; private repo chưa được Wave B hỗ trợ.

`--sandbox` (hoặc `MONACLOUD_SANDBOX=1`) chỉ tạo preview 0đ và ghi rõ URL sandbox. `--dry-run` in ước tính, có thể gọi sandbox khi chưa có host, không tạo tài nguyên thật. Lệnh thật luôn in ước tính rồi hỏi duyệt; `--yes` dùng khi đã duyệt (kể cả CI). Non-TTY thiếu `--yes` dừng trước lệnh thật. Khi dùng host có sẵn, phí host tiếp tục theo kỳ; host phải active/ready/running.

App từ git **đang mở**. CLI in URL sau khi job done/succeeded; 404/503, build lỗi hoặc job timeout trả exit code 1. Timeout: dùng `cloud_job_status` với job_id được báo, không chạy create lần nữa. Với env hoặc domain sau deploy, dùng `cloud_app_env_set` + `cloud_app_deploy`, `cloud_app_domain_add`, `cloud_app_logs`, `cloud_app_delete` trong MCP. Xoá app không xoá app host.

PDF nằm trên máy CLI/MCP, file mode 0600 trong thư mục mode 0700. Copy sang chỗ lưu dài hạn nếu cần.

## Ba bước và prompt mẫu

```bash
monacloud init --recipe app-tu-git --yes
monacloud-mcp login
monacloud deploy --sandbox
monacloud deploy
```

Ba bước sau khi init: **đăng nhập → thử sandbox → xem ước tính và duyệt deploy thật**.

Prompt mẫu: “Deploy repo hiện tại lên MONA Cloud. Đọc app host, sandbox trước nếu chưa có host. Báo chi phí để tôi duyệt rồi deploy thật, kiểm HTTPS và trả URL.”
