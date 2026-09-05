# STATUS — monacloud CLI

Cập nhật: 05/09/2026

## 0.3.0 — Wave A/B hoàn tất

- [x] `monacloud plans`: bảng gói, cấu hình, giá tháng/năm và gợi ý từ MCP.
- [x] `monacloud vps create --plan kinh-doanh --monthly`: estimate trước duyệt, spend guard đúng giá kỳ, poll job; `--period month|year`, `--name`, `--sandbox`, `--dry-run`, `--yes`.
- [x] `monacloud invoices [--pdf <id>]`: đọc hoá đơn/tải PDF tạm riêng tư.
- [x] `monacloud deploy [--repo <url>] [--branch <name>] [--build dockerfile|nixpacks|static] [--domain <host>]`: repo/nhánh mặc định từ git local, sandbox trước nếu chưa có host, duyệt chi phí, poll và in URL. Có `--app-host`, `--port`, `--dockerfile`, `--sandbox`, `--dry-run`, `--yes`.
- [x] App từ git ghi **đang mở**; lỗi build/API/timeout trả exit 1, không báo thành công hoặc tự POST lại. Repo public HTTPS; SSH remote phổ biến được đổi sang HTTPS.
- [x] CLI dùng stdio MCP >=0.3.0 local/PATH hoặc cache với npx --offline; dùng chung MONA Pass, refresh, guard và PDF, không thêm dependency và không tự tải package.
- [x] Recipe thứ 7 `app-tu-git` VI/EN, init in ba bước và template có prompt mẫu. Template Mail đã có được giữ nguyên.
- [x] Package/binary **0.3.0**, README + [docs/commands.md](docs/commands.md) có bảng lệnh/tool, auth, cờ và giới hạn rollout.

Ví dụ:

```bash
monacloud plans
monacloud vps create --plan kinh-doanh --monthly --name shop
monacloud invoices --pdf <invoice_id>
monacloud init --recipe app-tu-git --yes
monacloud deploy --sandbox
monacloud deploy
```

Gate cuối offline: `npm test` → **31/31 pass, 0 fail, 0 skip**. Bao gồm CLI executable → MCP thật → mock HTTP cho bảng giá, tạo monthly, PDF nguyên binary, sandbox/duyệt chi phí, URL và build lỗi; git local, schema/cờ, recipe/managed block cũ đều xanh. MCP: `npm test` → **35/35 pass**, version 0.3.0, 133 tool.

Không npm install, không gọi Internet/production, không publish. Chi tiết monthly sandbox và snapshot OpenAPI cũ được ghi trong `mcp/docs/wave-ab.md`.

Kiểm tra đóng gói offline: `npm pack --dry-run --json --offline --ignore-scripts` PASS (CLI 23 file), đủ source build/template/docs mới. Dùng npm CLI trực tiếp với config rỗng và `NODE_USE_SYSTEM_CA=0` để tránh lỗi Keychain/SecItemCopyMatching của Node trên runner. Không tạo tarball và không publish.

CODEX DONE

## Lịch sử trước Wave A/B

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

## 05/09 — 0.2.2 (Claude): recipe `gui-mail-otp` + MONA Mail trong template agent
- Thêm recipe thứ 6 `gui-mail-otp` (vi/en) cho `monacloud init --recipe gui-mail-otp`; `agent.vi.md`/`agent.en.md` đổi dòng "MONA Mail chưa mở" thành luật dùng MONA Mail (`mail_*`, SDK `monamail`, `MONAMAIL_API_KEY`, không cài Resend/SendGrid nếu không được yêu cầu) + ví dụ chuỗi tool + link llms.txt/agent-guide.md monamail.vn; `.env.monacloud` có `MONAMAIL_API`.
- Test cập nhật đếm 6 recipe; `npm test` 20/20. Chưa publish npm 0.2.2: chờ api.monamail.vn live.

## 05/09 tối — publish npm `monacloud@0.3.0` (Claude, phiên monacloud; phiên monapay xác nhận không giữ bản nào)
- `npm test` 31/31 · `npm pack --dry-run` 23 file · publish public. Gồm recipe `gui-mail-otp` + template agent trỏ MONA Mail + lệnh compute Wave B (`plans/vps/invoices/deploy`) của phiên monapay.
