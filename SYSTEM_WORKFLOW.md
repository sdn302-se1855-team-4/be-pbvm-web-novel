# Tài liệu Luồng Hoạt động Hệ thống (System Workflow)

Tài liệu này mô tả chi tiết các quyền hạn và luồng hoạt động của từng vai trò (Role) trong hệ thống Web Novel.

---

## 1. Vai trò: Độc giả (READER)
Đây là vai trò mặc định của mọi người dùng mới khi đăng ký.

### Luồng hoạt động chính:
*   **Tài khoản & Cá nhân hóa:**
    *   Đăng ký, đăng nhập (hệ thống hỗ trợ Google Login).
    *   Quản lý thông tin cá nhân (Avatar, Display Name, Bio).
    *   Quản lý Ví (Wallet): Nạp xu để sử dụng các dịch vụ trả phí.
*   **Tương tác với nội dung:**
    *   **Tìm kiếm & Khám phá:** Xem danh sách truyện, lọc theo Thể loại (Genre) và Tag.
    *   **Đọc truyện:** Xem chi tiết truyện, danh sách chương. Đọc các chương miễn phí.
    *   **Chương trả phí (Premium):** Sử dụng xu trong ví để mở khóa (Unlock) các chương VIP do tác giả thiết lập.
    *   **Lịch sử & Đánh dấu:** Tự động lưu lịch sử đọc (Reading History) và Đánh dấu truyện yêu thích (Bookmark).
*   **Tương tác cộng đồng:**
    *   **Bình luận (Comment):** Viết bình luận dưới truyện/chương, Trả lời (Reply) bình luận của người khác, và Like bình luận.
    *   **Đánh giá (Review):** Viết đánh giá kèm số sao (Rating) cho bộ truyện.
    *   **Theo dõi (Follow):** Theo dõi tác giả yêu thích để nhận thông báo khi có chương mới.
    *   **Ủng hộ (Donation):** Gửi tặng xu trực tiếp cho tác giả để ủng hộ tinh thần và công sức của họ.

---

## 2. Vai trò: Tác giả (WRITER)
Bao gồm toàn bộ quyền hạn của **Reader** và thêm các tính năng quản lý nội dung.

### Luồng hoạt động chính:
*   **Quản lý Truyện (Story Management):**
    *   Tạo truyện mới (Thiết lập Tiêu đề, Slug, Mô tả, Ảnh bìa, Loại truyện, Trạng thái).
    *   Gửi yêu cầu duyệt truyện lên Admin để được xuất bản (Published).
    *   Quản lý chương (Chapter): Viết nội dung, quản lý số thứ tự chương.
    *   **Kiếm tiền:** Thiết lập các chương Premium (cần xu để đọc) để tạo thu nhập.
*   **Theo dõi Analytics:**
    *   Xem thống kê chi tiết cho từng bộ truyện: Lượt view, số người đọc duy nhất, lượt follow mới, doanh thu từ chương/donation.
*   **Quản lý Tài chính:**
    *   Nhận xu từ việc bán chương Premium và từ Donation của độc giả.
    *   **Rút tiền (Withdrawal):** Gửi yêu cầu rút xu thành tiền mặt về tài khoản ngân hàng (cần Admin phê duyệt).
*   **Thông báo:**
    *   Nhận thông báo khi: Có người follow, có bình luận mới, có review mới, nhận được donation, hoặc khi truyện/yêu cầu rút tiền được Admin duyệt.

---

## 2. Vai trò: Quản trị viên (ADMIN)
Người điều hành toàn bộ hệ thống, đảm bảo nội dung tuân thủ quy định và vận hành tài chính minh bạch.

### Luồng hoạt động chính:
*   **Kiểm duyệt Nội dung:**
    *   **Duyệt truyện:** Xem danh sách truyện mới được tạo và phê duyệt (Approve) hoặc Từ chối (Reject).
    *   Quản lý danh mục hệ thống: Thêm/Sửa/Xóa các Thể loại (Genre) và Tag.
*   **Quản lý Người dùng:**
    *   **Thay đổi vai trò:** Cấp quyền WRITER cho Reader hoặc bổ nhiệm ADMIN mới.
    *   **Xử lý vi phạm:** Khóa (Block) tài khoản người dùng vi phạm tiêu chuẩn cộng đồng kèm lý do cụ thể; Mở khóa (Unblock) khi cần.
*   **Quản lý Tài chính & Giao dịch:**
    *   Duyệt các yêu cầu rút tiền (Withdrawal) từ tác giả sau khi kiểm tra tính hợp lệ.
    *   Thực hiện hoàn trả xu nếu yêu cầu rút tiền bị từ chối.
*   **Giám sát Hệ thống (Dashboard V2):**
    *   **Analytics mở rộng:** Theo dõi tăng trưởng toàn sàn (Người dùng, Truyện, Chương, Doanh thu) theo thời gian (biểu đồ Area Chart).
    *   **Phân bổ vai trò:** Xem tỷ lệ phần trăm các nhóm người dùng (biểu đồ Pie Chart).
    *   **Thống kê nội dung:** Xem số lượng truyện theo từng loại (Novel, Manga, v.v.) qua biểu đồ Bar Chart.
