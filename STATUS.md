# STATUS — monacloud CLI

Cập nhật: 04/09/2026

## Phạm vi đã triển khai

- [x] Package ESM `monacloud@0.2.1`, bin `monacloud`, Node.js >=20, không dependency và không build step.
- [x] `monacloud init` tạo/merge `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `.cursor/mcp.json`, `.env.monacloud.example` và `.gitignore`.
- [x] Managed block idempotent, giữ nội dung người dùng; cấu hình JSON giữ root field và MCP server khác.
- [x] `--yes`, `--dry-run`, `--tool claude|codex|cursor|all`, `--lang vi|en`.
- [x] `init --recipe <slug>` thêm khối recipe riêng vào `AGENTS.md`/`CLAUDE.md`, chạy lại không trùng và slug sai in đủ lựa chọn hợp lệ.
- [x] 5 recipe VI/EN đã chốt: `phan-mem-noi-bo`, `web-ban-hang`, `bot-cskh`, `landing-form-lead`, `tro-ly-chu-ca`; đã bỏ `saas-thu-phi`.
- [x] `monacloud recipes` liệt kê 5 công thức theo 3 mảng: Quản trị doanh nghiệp, Marketing & bán hàng, Trợ lý riêng của chủ.
- [x] Mỗi recipe có mục tiêu, thứ tự tool thật, phần người làm, spend guard/OTP, cách tạm cho mảnh chưa mở và tiêu chí hoàn thành.
- [x] Template VI/EN có stack MONA, luật AI-first, spend guard, ví dụ tool và link llms.txt.
- [x] Trạng thái thật: Base/AI/Mail/Agent đều ghi “chưa mở — dùng cách tạm”, không bịa tool.
- [x] `monacloud doctor` kiểm Node, executable MCP và metadata/quyền `0600` của token mà không đọc token.
- [x] README có hướng dẫn cài, ví dụ, cờ, doctor và luồng tiếp theo.

## Verification

- [x] `node --test` — 20/20 test pass.
- [x] `npm pack --dry-run` — tarball sạch, 16 file: `package.json`, `README.md`, `bin/*`, `templates/*`; không bundled dependency.

Không có hạng mục P0 nào được để lại ngoài package này.
- Bản `0.2.0` đã publish trước thay đổi tên compute; bản `0.2.1` chưa publish.
- JOB B 04/09: template/recipe đã dùng MONA Cloud, tool compute `cloud_*` và `MONACLOUD_API=https://api.monacloud.vn`; `VIBECLOUD_API` chỉ còn là env tương thích.
- Gate `node --test`: 20/20 test pass; `--recipe` idempotent, slug sai báo đúng, recipes theo 3 mảng, voice sạch.
