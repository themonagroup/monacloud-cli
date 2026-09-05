# Công thức: Bot CSKH

Thuộc mảng Marketing & bán hàng — trả lời nhanh, chuyển đúng việc cho người và không bỏ sót đơn.

## Mục tiêu

Xây bot CSKH/chốt đơn trên Zalo hoặc Telegram. Bot ghi lại hội thoại cần thiết, chuyển cho người khi vượt phạm vi và có thể tạo VietQR để chốt đơn mà không tự nhận mình là con người.

## AI làm theo thứ tự

1. Chốt kênh, bộ câu hỏi, quy tắc trả lời, trường hợp chuyển người và dữ liệu được phép lưu. Yêu cầu người dùng cấp token kênh qua biến môi trường, không qua source hay chat.
2. Gọi `cloud_whoami`, `cloud_balance`, `cloud_budget_get` và `cloud_packages`; báo cấu hình, giá VND và tổng chi dự kiến.
3. Nêu rõ cách tạm cho MONA Agent và MONA AI, rồi dừng chờ người dùng chấp nhận và duyệt ngân sách. Nếu ví thiếu, dùng `cloud_topup` và chờ nạp xong.
4. Tạo database bằng `cloud_db_create`, VPS bằng `cloud_vps_create`, sau đó theo dõi bằng `cloud_job_status`.
5. Viết tiến trình bot có allowlist lệnh, rate limit, log đã lọc dữ liệu nhạy cảm, hàng đợi chuyển người và health check. Dùng luồng luật cố định hoặc model API mà dự án đã có theo lựa chọn được duyệt.
6. Khi bot cần chốt đơn, liên kết MONA Pay bằng `monapay_link`, kiểm tra `monapay_whoami`, tạo endpoint qua `monapay_create_webhook`, kiểm thử với `monapay_test_webhook` và tạo VietQR bằng `monapay_create_qr`.
7. Triển khai bot lên VPS, thử câu hỏi đúng/sai phạm vi, chuyển người, restart và một giao dịch sandbox hoặc đơn thử; báo tài nguyên và chi phí thực tế.

## Người dùng cần làm

- Đăng ký MONA Pass, nạp ví khi thiếu và duyệt ngân sách VND.
- Tạo bot/kênh Zalo hoặc Telegram, giữ token trong secret store và hoàn tất OTP khi nền tảng hoặc ngân hàng yêu cầu.
- Duyệt nội dung bot được phép trả lời, cách tạm cho AI/Agent và các trường hợp phải chuyển người.

## Điểm phải dừng hỏi người dùng

- Trước tài nguyên có phí: báo số dư, giá và hạn mức rồi chờ duyệt.
- MONA Agent chưa mở — dùng cách tạm: chạy tiến trình bot và lịch nền trên VPS MONA Cloud. Hỏi người dùng chấp nhận trước khi deploy.
- MONA AI chưa mở — dùng cách tạm: luồng luật cố định hoặc model API mà dự án đã có. Hỏi người dùng chọn cách tạm; không bịa tool MONA AI.
- Dừng tại OTP, nạp ví, tăng hạn mức, gửi tin hàng loạt, thay đổi kênh hoặc xoá dữ liệu hội thoại.

## Tiêu chí hoàn thành

- Bot nhận/gửi tin trên kênh đã chọn, trả lời đúng phạm vi và chuyển người đúng quy tắc.
- Token không xuất hiện trong source/log; rate limit, health check và tự khởi động lại hoạt động.
- Luồng tạo VietQR và webhook đơn thử chạy idempotent; bot không tự xác nhận tiền khi chưa có sự kiện hợp lệ.
- VPS/database hiện trong `cloud_services_list` và chi phí không vượt mức đã duyệt.
