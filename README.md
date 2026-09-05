# monacloud

`monacloud` đưa luật stack MONA và cấu hình MCP vào một repository để Claude Code, Codex và Cursor có thể mặc định dùng dịch vụ MONA phù hợp. CLI chạy trên Node.js 20+, không có dependency và không gọi mạng khi khởi tạo dự án.

## Dùng ngay

Chạy trong thư mục gốc của dự án:

```bash
npx monacloud init
```

Trong CI hoặc khi không muốn xác nhận tương tác:

```bash
npx monacloud init --yes
```

Khởi tạo theo một công thức cụ thể:

```bash
npx monacloud init --recipe web-ban-hang
```

Lệnh mặc định cấu hình cả ba công cụ. Nội dung người dùng trong `AGENTS.md` và `CLAUDE.md` được giữ nguyên; CLI chỉ thêm hoặc cập nhật phần nằm giữa `<!-- monacloud:start -->` và `<!-- monacloud:end -->`.

Khi có `--recipe`, CLI chèn thêm khối độc lập từ `<!-- monacloud:recipe:<slug>:start -->` tới `<!-- monacloud:recipe:<slug>:end -->` vào file agent tương ứng. Chạy lại cùng recipe chỉ cập nhật khối đó, không tạo bản trùng.

## Công thức

Xem danh sách ngay cả khi offline:

```bash
npx monacloud recipes
```

Bảy công thức được xếp theo ba mảng:

- Quản trị doanh nghiệp: `app-tu-git` — deploy repo có HTTPS (đang mở); `phan-mem-noi-bo` — CRM, chấm công, kho và báo cáo nội bộ.
- Marketing & bán hàng: `web-ban-hang`, `bot-cskh`, `landing-form-lead`, `gui-mail-otp` — gửi mail OTP, xác nhận đơn và thông báo bằng MONA Mail.
- Trợ lý riêng của chủ: `tro-ly-chu-ca` — đọc số bán, nhắc việc, soạn bản nháp và canh dòng tiền.

Mỗi recipe có template tiếng Việt và tiếng Anh, nêu mục tiêu, thứ tự thao tác bằng tên tool thật, việc người dùng phải làm, điểm dừng để duyệt chi phí/OTP, cách tạm cho mảnh chưa mở và tiêu chí hoàn thành. Slug sai sẽ dừng trước khi ghi file và in đủ slug hợp lệ.

## File được quản lý

| File | Mục đích |
|---|---|
| `AGENTS.md` | Luật stack, AI-first và spend guard cho Codex/Cursor |
| `CLAUDE.md` | Cùng luật vận hành cho Claude Code |
| `.mcp.json` | MCP project scope của Claude Code |
| `.cursor/mcp.json` | MCP project scope của Cursor |
| `.env.monacloud.example` | Endpoint và biến cấu hình mẫu, không chứa secret |
| `.gitignore` | Bổ sung chính xác dòng `.env.monacloud` |

Hai file MCP được merge tại key `mcpServers.monacloud`; các key và server có sẵn khác không bị xoá. Cấu hình được thêm là:

```json
{
  "mcpServers": {
    "monacloud": {
      "command": "npx",
      "args": ["-y", "monacloud-mcp"]
    }
  }
}
```

Codex dùng cấu hình người dùng thay vì project JSON. CLI in sẵn lệnh:

```bash
codex mcp add monacloud -- npx -y monacloud-mcp
```

## Tuỳ chọn `init`

```text
monacloud init [--yes] [--dry-run] [--tool claude|codex|cursor|all] [--lang vi|en] [--recipe <slug>]
```

| Cờ | Mặc định | Tác dụng |
|---|---|---|
| `--yes`, `-y` | tắt | Bỏ câu hỏi xác nhận |
| `--dry-run` | tắt | In unified diff, không tạo thư mục hay ghi file |
| `--tool` | `all` | Chọn integration cần tạo |
| `--lang` | `vi` | Chọn ngôn ngữ cho template và output |
| `--recipe` | không có | Thêm hướng dẫn cho một trong 7 công thức |

Phạm vi theo `--tool`:

- `claude`: `CLAUDE.md` và `.mcp.json`.
- `codex`: `AGENTS.md` và hướng dẫn `codex mcp add`.
- `cursor`: `AGENTS.md` và `.cursor/mcp.json`.
- `all`: toàn bộ các mục trên.

`.env.monacloud.example` và `.gitignore` luôn được quản lý. Nếu JSON hiện hữu không hợp lệ hoặc marker bị thiếu/nhân đôi, CLI dừng trước khi ghi bất kỳ thay đổi nào.

## Kiểm tra môi trường

```bash
npx monacloud doctor
```

`doctor` kiểm tra:

- Node.js từ phiên bản 20;
- executable `monacloud-mcp` có trên `PATH`, `node_modules/.bin` hoặc npm cache offline và chạy được;
- `~/.config/monacloud/token.json` tồn tại, là file thường và có quyền `0600`.

Lệnh chỉ đọc metadata của token store, không đọc hoặc in token. Nếu chưa đăng nhập:

```bash
npx -y monacloud-mcp login
```

## Luồng sau khi init

1. Đăng ký MONA Pass tại endpoint `https://pass.monacloud.vn/realms/mona/protocol/openid-connect/registrations`.
2. Chạy `npx -y monacloud-mcp login`.
3. Dán prompt `Dựng app bán hàng trên MONA Cloud` vào AI coding agent.

Agent sẽ ưu tiên MONA Cloud để deploy/chạy VPS và MONA Pay để thu tiền. MONA Mail dùng các tool `mail_*`; MONA Base, MONA AI và MONA Agent chưa mở; template ghi rõ cách tạm, không giả vờ có tool. Trước thao tác có phí, agent phải đọc số dư, báo giá VND và tuân thủ spend limit.

## Phát triển offline

Không cần `npm install`:

```bash
node --test
npm pack --dry-run
```

Mã nguồn chỉ dùng module built-in của Node.js (`fs`, `path`, `url`, `readline`, `child_process`).

## Compute CLI 0.3.0

```bash
monacloud plans
monacloud vps create --plan kinh-doanh --monthly
monacloud invoices
monacloud invoices --pdf <id>
monacloud deploy --repo https://github.com/example/shop.git --branch main --build nixpacks --domain shop.example.vn
```

Lệnh compute dùng `monacloud-mcp >=0.3.0` đã cài hoặc có trong cache offline, dùng chung đăng nhập và spend guard. `--yes` là duyệt thao tác thật cho CI; mặc định in chi phí rồi hỏi trước khi thực hiện. `--dry-run` chỉ lấy ước tính; `--sandbox` thử 0đ. Không có bước tự tải dependency khi chạy lệnh compute.

### App từ git: 3 bước sau khi init

```bash
monacloud init --recipe app-tu-git --yes
```

1. Đăng nhập: `monacloud-mcp login`.
2. Thử miễn phí: `monacloud deploy --sandbox`.
3. Xem ước tính và duyệt: `monacloud deploy`.

CLI đọc `git remote get-url origin` và nhánh hiện tại; có thể ghi đè bằng `--repo`, `--branch`. Build có `dockerfile|nixpacks|static`, domain bằng `--domain`. SSH remote thông dụng được đổi sang HTTPS; repo phải public theo hợp đồng Wave B. `monacloud deploy` in URL khi job thành công, giữ job_id khi timeout để poll tiếp. App từ git **đang mở**, 404/503 hoặc build lỗi trả exit code 1.

Prompt mẫu: “Deploy repo hiện tại lên MONA Cloud. Đọc host, sandbox trước nếu chưa có host, báo chi phí để tôi duyệt rồi deploy thật, kiểm HTTPS và trả URL.”

Bảng lệnh ↔ tool, auth, PDF tạm và đầy đủ cờ: [docs/commands.md](docs/commands.md).
