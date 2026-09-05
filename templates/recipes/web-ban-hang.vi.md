# Công thức: Web bán hàng

Thuộc mảng Marketing & bán hàng — chốt đơn và thu tiền trong cùng một luồng.

## Mục tiêu

Xây web/app bán hàng có giỏ hàng, đơn hàng và chuyển khoản VietQR tự báo có. Khách đăng nhập bằng MONA Pass; trạng thái thanh toán chỉ đổi sau khi webhook hợp lệ được xử lý idempotent.

## AI làm theo thứ tự

1. Chốt danh mục, luồng đặt hàng, chính sách giao hàng và dữ liệu tối thiểu cần lưu.
2. Gọi `cloud_whoami`, `cloud_balance`, `cloud_budget_get` và `cloud_packages`; báo cấu hình, giá VND và tổng chi dự kiến.
3. Dừng chờ duyệt ngân sách. Nếu ví thiếu, gọi `cloud_topup`, đưa VietQR và chờ nạp xong.
4. Tạo database bằng `cloud_db_create`, VPS bằng `cloud_vps_create`, rồi theo dõi bằng `cloud_job_status`.
5. Viết app và endpoint webhook kiểm chữ ký HMAC, chống xử lý trùng, lưu raw event an toàn và chỉ cập nhật đúng đơn hàng.
6. Gọi `monapay_link` khi adapter yêu cầu, kiểm tra bằng `monapay_whoami`; chỉ dừng cho người dùng tại các bước OTP bắt buộc khi nối ngân hàng.
7. Tạo webhook bằng `monapay_create_webhook`, kiểm thử bằng `monapay_test_webhook`, xem kết quả qua `monapay_webhook_logs`, rồi tạo luồng thanh toán bằng `monapay_create_qr`.
8. Triển khai, chạy thử một đơn từ lúc đặt tới báo có, đối chiếu số tiền và báo URL cùng chi phí thực tế.

## Người dùng cần làm

- Đăng ký MONA Pass, nạp ví khi thiếu và duyệt ngân sách VND.
- Nhập OTP bắt buộc khi nối MONA Pay với ngân hàng; không đưa mật khẩu cho AI.
- Cung cấp thông tin hàng hoá, giao nhận, tài khoản nhận tiền và xác nhận đơn thử.

## Điểm phải dừng hỏi người dùng

- Trước mọi tài nguyên có phí: gọi spend guard, báo số dư/giá/hạn mức và chờ duyệt.
- MONA Mail chưa mở — dùng cách tạm: bật thông báo Telegram từ MONA Pay hoặc dùng dịch vụ mail dự án đang có. Hỏi người dùng chọn cách tạm; không giả vờ có tool MONA Mail.
- Dừng tại OTP, nạp ví, tăng hạn mức, thay đổi tài khoản nhận tiền hoặc thao tác phá huỷ dữ liệu.

## Tiêu chí hoàn thành

- Khách xem hàng, đặt đơn, nhận VietQR đúng số tiền và đăng nhập được bằng MONA Pass.
- Webhook sai chữ ký bị từ chối; webhook gửi lặp không ghi nhận thanh toán hai lần.
- Giao dịch thử chuyển đúng đơn sang trạng thái đã thanh toán và có log đối chiếu.
- Web và database chạy trên MONA Cloud, chi phí không vượt mức đã duyệt, secret không nằm trong source.
