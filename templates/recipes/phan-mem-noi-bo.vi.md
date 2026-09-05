# Công thức: Phần mềm nội bộ

Thuộc mảng Quản trị doanh nghiệp — tối ưu chi là tối ưu lời.

## Mục tiêu

Xây CRM, chấm công, quản lý kho hoặc báo cáo cho chính công ty. Phần mềm phải có phân quyền, dữ liệu riêng của doanh nghiệp và chạy được trên hạ tầng MONA đang mở.

## AI làm theo thứ tự

1. Chốt với người dùng một quy trình nhỏ cần chạy trước, vai trò sử dụng, trường dữ liệu và báo cáo cần xem; không tự mở rộng phạm vi.
2. Gọi `cloud_whoami`, `cloud_balance`, `cloud_budget_get` và `cloud_packages`. Đưa cấu hình, giá VND và tổng chi dự kiến trước khi tạo tài nguyên.
3. Dừng để người dùng duyệt ngân sách. Nếu ví thiếu, gọi `cloud_topup`, đưa VietQR và chờ người dùng nạp xong.
4. Sau khi được duyệt, tạo database PostgreSQL/MySQL phù hợp bằng `cloud_db_create`, tạo máy chạy app bằng `cloud_vps_create`, rồi theo dõi từng job bằng `cloud_job_status`.
5. Viết schema, migration, API, giao diện và kiểm thử cho quy trình đã chốt. Dùng MONA Pass cho đăng nhập; giữ role và quyền kiểm tra ở phía server.
6. Triển khai app lên VPS, kiểm thử đăng nhập, phân quyền, tạo/sửa dữ liệu, báo cáo và bản sao lưu. Cuối cùng báo URL, tài nguyên đã tạo, chi phí và cách dừng dịch vụ.

## Người dùng cần làm

- Đăng ký MONA Pass và đăng nhập khi MCP yêu cầu.
- Nạp ví bằng VietQR nếu số dư thiếu và duyệt ngân sách VND trước thao tác có phí.
- Nhập OTP khi MONA Pass hoặc dịch vụ liên kết yêu cầu; AI không được hỏi mật khẩu hay tự đoán OTP.
- Xác nhận quy trình, vai trò và một bộ dữ liệu mẫu để nghiệm thu.

## Điểm phải dừng hỏi người dùng

- Trước `cloud_db_create`, `cloud_vps_create` hoặc mọi thao tác có phí: báo cấu hình, giá, số dư, hạn mức và chờ duyệt.
- MONA Base chưa mở — dùng cách tạm: database MONA Cloud, MONA Pass và API do app quản lý. Hỏi người dùng có chấp nhận cách tạm trước khi dựng schema.
- Dừng khi cần OTP, nạp ví, tăng hạn mức, thay đổi phá huỷ dữ liệu hoặc mở rộng quy trình ngoài phạm vi đã chốt.

## Tiêu chí hoàn thành

- URL chạy được; người dùng đăng nhập bằng MONA Pass và chỉ thấy đúng quyền.
- Quy trình chính tạo, sửa, tìm và xuất báo cáo bằng dữ liệu mẫu mà không lỗi.
- Database và VPS hiện trong `cloud_services_list`; chi phí thực tế không vượt mức đã duyệt.
- Bàn giao biến môi trường mẫu, migration, hướng dẫn sao lưu/khôi phục và không ghi secret vào source.
