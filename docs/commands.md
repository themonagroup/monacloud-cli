# monacloud 0.4.0 — lệnh compute

| Lệnh | MCP tool | Kết quả |
|---|---|---|
| `monacloud plans` | `cloud_plan_list` | Bảng cấu hình, giá tháng/năm, gợi ý |
| `monacloud vps create --plan kinh-doanh --monthly` | `cloud_plan_list`, `cloud_balance`, `cloud_vps_create`, `cloud_job_status` | Báo giá, hỏi duyệt, tạo VPS và chờ job |
| `monacloud invoices` | `cloud_invoice_list` | Hoá đơn của tài khoản |
| `monacloud invoices --pdf <id>` | `cloud_invoice_pdf` | Đường dẫn PDF tạm riêng tư |
| `monacloud deploy` | `cloud_app_detect`, `cloud_app_host_list`, `cloud_app_create`, `cloud_balance` | Sandbox trước khi cần host mới, báo ước tính, hỏi duyệt, deploy và in URL |
| `monacloud init --recipe app-tu-git` | Không gọi API | Recipe VI/EN: đọc → ước tính/duyệt → deploy/kiểm URL |

Compute cần executable `monacloud-mcp >=0.4.0` trong `node_modules/.bin`, PATH, `MONACLOUD_MCP_BIN`, hoặc npm cache. CLI gọi MCP qua stdio để dùng chung MONA Pass, refresh token, PDF và spend guard. Fallback npx luôn dùng `--offline`; CLI không tự tải package. Đăng nhập bằng `monacloud-mcp login`, hoặc cấu hình `MONACLOUD_TOKEN` qua env. `MONACLOUD_API`, `MONACLOUD_CONFIG_DIR` và các env MCP hiện có vẫn dùng được; CLI không tự đọc `.env.monacloud`.

VPS nhận `--name` (mặc định tên thư mục), `--period month|year` (mặc định month), `--sandbox`, `--dry-run`, `--yes`. Monthly đọc toàn bộ giá kỳ từ API. Sandbox thử cấu hình plan qua hourly sandbox do backend chưa nhận monthly sandbox, không tạo subscription; giá thật vẫn được hiển thị.

Deploy mặc định dùng **thư mục hiện tại** nếu có `Dockerfile` hoặc `package.json`; không cần git/remote/commit. `--local` ép thư mục (kể cả Python/PHP/static). `--git` dùng git remote origin như trước; `--repo <url>` cũng chọn nguồn git. Ngoài thư mục có hai file nhận diện trên, nếu không ép local thì giữ fallback origin cũ.

Local gọi `cloud_app_detect` offline để lấy stack/build/port rồi MCP ZIP → upload → poll; in tiến trình và URL cuối. ZIP tối đa 80 MiB (83,886,080 bytes), luôn loại `.env*`, `*.pem`, `.git`, `node_modules`, symlink; tôn trọng `.gitignore` ở các cấp và `.dockerignore` root. `dist` giữ mặc định, chỉ ignore nếu build tạo lại được. Env trong `.env.example` chỉ đọc tên để nhắc cấu hình; secret truyền qua MCP `env`/`cloud_app_env_set`.

Deploy nhận `--local`, `--git`, `--name`, `--repo`, `--branch`, `--build dockerfile|nixpacks|static`, `--dockerfile`, `--domain`, `--app-host`, `--port`, `--sandbox`, `--dry-run`, `--yes`. `--local` không dùng cùng các tuỳ chọn git. `--branch`, `--app-host` và `--dockerfile <path khác Dockerfile>` chỉ dùng nguồn git; upload dùng Dockerfile root, backend tự chọn host. Local tự chọn tên theo thư mục; `--name`, `--build`, `--port` ghi đè nhận diện.

Git lấy branch bằng `git branch --show-current`, mặc định build dockerfile, port 3000. Ngoài git hoặc detached HEAD cần truyền phần còn thiếu. SSH remote phổ biến được đổi sang URL public HTTPS; repo private dùng local upload nếu source đã có trên máy.

```bash
monacloud deploy                     # cwd có Dockerfile hoặc package.json
monacloud deploy --local --sandbox   # ép thư mục, thử 0đ
monacloud deploy --local --name shop  # duyệt một lần rồi upload/deploy
monacloud deploy --git               # remote origin như cũ
```

`--sandbox` (hoặc `MONACLOUD_SANDBOX=1`) chỉ tạo preview 0đ và ghi rõ URL sandbox. `--dry-run` in ước tính, có thể gọi sandbox khi chưa có host, không tạo tài nguyên thật. Lệnh thật luôn in ước tính rồi hỏi duyệt; `--yes` dùng khi đã duyệt (kể cả CI). Non-TTY thiếu `--yes` dừng trước lệnh thật. Khi dùng host có sẵn, phí host tiếp tục theo kỳ; host phải active/ready/running.

Nguồn git và upload đều dùng job compute. CLI in URL sau khi job done/succeeded; 404/503, build lỗi hoặc job timeout trả exit code 1. Timeout: dùng `cloud_job_status` với job_id được báo, không chạy create lần nữa. Với env hoặc domain sau deploy, dùng `cloud_app_env_set` + `cloud_app_deploy`, `cloud_app_domain_add`, `cloud_app_logs`, `cloud_app_delete` trong MCP. Xoá app không xoá app host.

PDF nằm trên máy CLI/MCP, file mode 0600 trong thư mục mode 0700. Copy sang chỗ lưu dài hạn nếu cần.

## Ba bước và prompt mẫu

```bash
monacloud init --recipe app-tu-git --yes
monacloud-mcp login
monacloud deploy --sandbox
monacloud deploy
```

Ba bước sau khi init: **đăng nhập → thử sandbox → xem ước tính và duyệt deploy thật**.

Prompt Claude Code: **“Đưa dự án này lên MONA Cloud, dùng thư mục hiện tại”**. AI detect → báo giá giờ/gói từ sandbox khi cần host → hỏi human duyệt một lần → create(local_dir) → trả URL. Domain riêng: cloud_app_domain_add và hướng dẫn CNAME. Human đăng ký MONA Pass/device flow, nạp tiền khi hết credit 20k; AI làm 99% còn lại.
