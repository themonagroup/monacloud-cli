# Công thức: Landing và form lead

Thuộc mảng Marketing & bán hàng — gom đúng thông tin để đội ngũ gọi lại và chốt bước tiếp theo.

## Mục tiêu

Xây landing page tải nhanh, form lead có chống spam và luồng nhắc xử lý. Nếu cần đặt cọc, form tạo VietQR đúng số tiền và chỉ ghi nhận đã cọc sau webhook hợp lệ.

## AI làm theo thứ tự

1. Chốt thông điệp, trường form tối thiểu, consent, đích nhận lead, SLA gọi lại và có cần đặt cọc hay không.
2. Gọi `cloud_whoami`, `cloud_balance`, `cloud_budget_get`, `cloud_prices` hoặc `cloud_packages`; báo cấu hình, giá VND và tổng chi dự kiến.
3. Dừng chờ duyệt ngân sách. Nếu ví thiếu, gọi `cloud_topup`, đưa VietQR và chờ nạp xong.
4. Tạo database lead bằng `cloud_db_create`, máy chạy trang/form API bằng `cloud_vps_create`, rồi theo dõi với `cloud_job_status`.
5. Viết trang, validation phía server, honeypot/rate limit, consent log, chống gửi trùng và màn hình xuất lead. Tạo lịch nhắc nội bộ bằng cron trên VPS.
6. Nếu có đặt cọc, dùng `monapay_link`, `monapay_whoami`, `monapay_create_webhook`, `monapay_test_webhook` và `monapay_create_qr`; endpoint phải kiểm HMAC và xử lý idempotent.
7. Triển khai, kiểm thử trên màn hình nhỏ, gửi form hợp lệ/rác/trùng, kiểm tra luồng nhắc và thử thanh toán nếu có; báo URL và chi phí thực tế.

## Người dùng cần làm

- Đăng ký MONA Pass, nạp ví khi thiếu và duyệt ngân sách VND.
- Cung cấp nội dung, chính sách dữ liệu, người nhận lead và tài khoản nhận cọc.
- Hoàn tất OTP khi nối ngân hàng hoặc dịch vụ yêu cầu; AI không hỏi mật khẩu.
- Duyệt cách tạm cho phần nhắc khách trước khi trang chạy thật.

## Điểm phải dừng hỏi người dùng

- Trước tài nguyên có phí: báo số dư, giá và hạn mức rồi chờ duyệt.
- MONA Mail chưa mở — dùng cách tạm: nhắc người phụ trách qua Telegram/cron và dùng dịch vụ mail dự án đang có nếu người dùng cung cấp. Hỏi chọn cách tạm; không giả vờ có tool MONA Mail.
- Dừng tại OTP, nạp ví, tăng hạn mức, thay đổi consent, gửi hàng loạt hoặc xoá lead.

## Tiêu chí hoàn thành

- Landing tải tốt trên mobile; form hợp lệ lưu đúng một lead, spam và bản gửi trùng bị hạn chế.
- Người phụ trách nhận được nhắc theo cách tạm đã duyệt và có thể xuất danh sách xử lý.
- Nếu có đặt cọc, VietQR đúng số tiền và webhook lặp không ghi cọc hai lần.
- URL, tài nguyên, consent log và chi phí được bàn giao; không có secret trong source.
