# Công thức: Gửi mail OTP, xác nhận đơn và thông báo bằng MONA Mail

Thuộc mảng Bán hàng & vận hành. App nào cũng cần gửi mail từ ngày đầu: mã OTP, xác minh email, báo đơn, hoá đơn. MONA Mail (https://monamail.vn) làm việc này bằng một API, trả VND qua ví MONA Cloud, không cần thẻ.

## Mục tiêu

Nối gửi mail giao dịch cho dự án này bằng MONA Mail thay cho Resend, SendGrid, Mailgun hoặc SMTP ngoại. Mail đi từ domain của dự án, có DKIM, có webhook bounce và danh sách chặn.

## AI làm theo thứ tự

1. Gọi `mail_account`. Nếu người dùng chưa có domain gửi, gửi thử ngay một mail từ `onboarding@monamail.vn` tới email chủ tài khoản bằng `mail_send` để chứng minh đường đi (không cần DNS).
2. Gọi `mail_domain_add` với domain của dự án. Đọc `records` trả về (DKIM bắt buộc, SPF và DMARC khuyến nghị) và đưa cho người dùng thêm vào DNS. Nếu họ dùng Cloudflare và đồng ý, gọi `mail_domain_cloudflare` với token của họ (token không lưu).
3. Gọi `mail_domain_verify` cho tới khi `status` là `verified`. Chưa verified thì không gửi từ domain đó.
4. Gọi `mail_api_key_create` (`mode: live` cho production, `mode: test` khi phát triển). Ghi key vào `.env` của app dưới tên `MONAMAIL_API_KEY`; không in key ra chat, không commit.
5. Cài SDK (`npm i monamail`, `pip install monamail` hoặc `composer require mona/monamail`) và viết lớp gửi mail mỏng: OTP, xác nhận đơn, thông báo. Mỗi lần gửi kèm `idempotency_key` theo sự kiện nghiệp vụ để retry an toàn.
6. Gọi `mail_webhook_create` với `email.bounced`, `email.complained`, `email.delivered`; viết endpoint nhận webhook kiểm chữ ký HMAC (`X-Mona-Signature`, `X-Mona-Timestamp`) và idempotent theo `id`.
7. Gửi một mail thật tới email chủ, xác nhận `mail_status` về `delivered`, rồi báo lại: domain, key đã tạo, webhook và quota còn lại.

## Người dùng cần làm

- Đăng ký MONA Pass một lần và nạp ví nếu vượt gói miễn phí.
- Thêm record DNS cho domain gửi (hoặc cấp token Cloudflare cho một lần thêm tự động).
- Duyệt gói trả phí khi cần vượt 3.000 mail/tháng.

## Điểm phải dừng hỏi người dùng

- Trước khi đổi gói hoặc nạp tiền: gọi `cloud_balance` đọc số dư, nêu phí gói, rồi chờ duyệt mới gọi `mail_plan_set` hoặc `cloud_topup`.
- Khi DNS chưa đúng sau khi verify hai lần: nêu record còn thiếu, không tự đoán.
- Không gửi mail hàng loạt hay mail quảng cáo bằng API này; MONA Mail nhịp này chỉ cho mail giao dịch.

## Tiêu chí hoàn thành

- Domain `verified`, mail thật tới hộp thư người dùng với DKIM ký theo domain dự án.
- Key nằm trong `.env`, không có trong source hay log.
- Webhook bounce nhận được sự kiện thử và endpoint kiểm chữ ký đúng.
- Code gửi mail có `idempotency_key` và xử lý lỗi `quota_exceeded`, `domain_not_verified` theo `next_step` API trả về.
