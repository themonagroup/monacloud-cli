# Công thức: Trợ lý riêng của chủ

Thuộc mảng Trợ lý riêng của chủ — gom số cần nhìn và việc cần quyết vào một chỗ.

## Mục tiêu

Xây trợ lý đọc báo cáo/số bán, nhắc việc, soạn bản nháp và canh dòng tiền. Trợ lý chỉ đọc nguồn đã cho phép, không tự gửi thư, chuyển tiền hay thực hiện quyết định kinh doanh.

## AI làm theo thứ tự

1. Chốt nguồn dữ liệu, chỉ số, lịch nhắc, kênh nhận và danh sách hành động luôn cần người duyệt. Bắt đầu ở quyền chỉ đọc.
2. Gọi `cloud_whoami`, `cloud_balance`, `cloud_budget_get`, `cloud_services` và `cloud_packages`; báo tài nguyên sẵn có, cấu hình, giá VND và tổng chi dự kiến.
3. Nêu rõ cách tạm cho MONA Agent, MONA AI và MONA Mail; dừng chờ người dùng chọn cách tạm và duyệt ngân sách. Nếu ví thiếu, gọi `cloud_topup` và chờ nạp xong.
4. Tạo database bằng `cloud_db_create` khi cần lưu snapshot; tạo VPS bằng `cloud_vps_create` và theo dõi bằng `cloud_job_status`.
5. Viết job chỉ đọc để tổng hợp dữ liệu được duyệt. Với dòng tiền MONA Pay, dùng sự kiện và log đã liên kết qua `monapay_link`, `monapay_whoami`, `monapay_create_webhook` và `monapay_webhook_logs`; không coi ledger hạ tầng là doanh thu bán hàng.
6. Tạo báo cáo có nguồn, mốc thời gian và cảnh báo thiếu dữ liệu. Soạn thư thành bản nháp để người dùng xem; lịch nền chỉ nhắc, không tự gửi hay tự chi tiền.
7. Triển khai tiến trình/cron lên VPS, thử mất nguồn dữ liệu, sự kiện lặp, restart và báo cáo một kỳ; báo URL/kênh nhận, tài nguyên và chi phí thực tế.

## Người dùng cần làm

- Đăng ký MONA Pass, nạp ví khi thiếu và duyệt ngân sách VND.
- Chọn nguồn dữ liệu, cấp quyền chỉ đọc qua secret store và hoàn tất OTP khi hệ thống yêu cầu.
- Duyệt cách tạm cho Agent/AI/Mail, lịch nhắc, ngưỡng cảnh báo và từng hành động gửi/chi tiền.

## Điểm phải dừng hỏi người dùng

- Trước tài nguyên có phí: báo số dư, giá và hạn mức rồi chờ duyệt.
- MONA Agent chưa mở — dùng cách tạm: chạy job/cron trên VPS MONA Cloud.
- MONA AI chưa mở — dùng cách tạm: báo cáo theo luật cố định hoặc model API mà dự án đã có.
- MONA Mail chưa mở — dùng cách tạm: tạo bản nháp và nhắc qua Telegram; người dùng tự duyệt và gửi.
- Hỏi người dùng chấp nhận từng cách tạm. Dừng tại OTP, tăng quyền, thêm nguồn dữ liệu, gửi thư, chuyển tiền hoặc thay đổi hạn mức.

## Tiêu chí hoàn thành

- Báo cáo ghi rõ nguồn và thời điểm; số bán/dòng tiền đối chiếu được với sự kiện MONA Pay đã nhận.
- Nhắc việc chạy đúng lịch, không nhân đôi sau restart và cảnh báo rõ khi dữ liệu thiếu.
- Thư chỉ ở dạng bản nháp cho tới khi người dùng duyệt; trợ lý không có quyền chuyển tiền.
- VPS/database hiện trong `cloud_services_list`, secret không vào source và chi phí không vượt mức duyệt.
