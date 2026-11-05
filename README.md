# EXE101 Frontend

Giao diện web (React 18 + Vite + TypeScript) cho backend `EXE101_BACK_END`. Chỉ phụ thuộc React và Vite; router tự viết trong `src/lib/router.tsx`.

## Chạy

```bash
npm install
npm run dev        # http://localhost:3000
```

Backend cần chạy ở `http://localhost:8080` (đổi bằng `BACKEND_URL` trong `.env`, xem `.env.example`).
Vite chuyển tiếp mọi request `/api/*` sang backend, nên chạy local không cần CORS.

Muốn gọi thẳng backend (không qua proxy), bật CORS ở BE bằng `CORS_ALLOWED_ORIGINS=http://localhost:3000`
(danh sách origin chính xác, cách nhau bằng dấu phẩy, không dùng `*`) rồi đặt `VITE_API_BASE=http://localhost:8080`.

Cổng 3000 trùng với `VNPAY_RETURN_URL` mặc định của backend (`http://localhost:3000/payment/return`).

```bash
npm run build      # kiểm tra kiểu + build ra dist/
npm run preview    # chạy bản build ở cổng 3000, vẫn có proxy /api
```

Khi deploy, chọn một trong hai cách:
- FE và BE cùng domain, ví dụ nginx: `/api/` → BE (bỏ tiền tố `/api`), thêm `client_max_body_size 201m;`.
- FE domain riêng: đặt `CORS_ALLOWED_ORIGINS=https://ten-mien-fe` ở BE và build FE với `VITE_API_BASE=https://ten-mien-be`.

Thanh toán VNPay sandbox: làm theo mục "VNPay sandbox" trong README của BE (merchant sandbox riêng, tunnel cho IPN).

## Các màn hình

| Ai | Đường dẫn | Làm gì |
| --- | --- | --- |
| Khách | `/`, `/artworks/:id`, `/artists/:id` | Xem tranh, chọn bản số/bản in, thêm giỏ, gửi yêu cầu vẽ |
| Khách | `/login`, `/register` | Đăng ký, đăng nhập (mật khẩu 12–128 ký tự) |
| Khách | `/cart` | Sửa số lượng, chọn địa chỉ, xem tổng tiền, đặt hàng |
| Khách | `/orders`, `/orders/:id`, `/payment/return` | Thanh toán VNPay, theo dõi giao hàng, yêu cầu hoàn/trả |
| Khách | `/purchases`, `/refunds`, `/account`, `/account/addresses` | Tải tệp đã mua, hoàn tiền, sổ địa chỉ, thông tin tài khoản |
| Khách / hoạ sĩ | `/commissions`, `/commissions/:id` | Trao đổi, báo giá, chấp nhận điều khoản, trả 2 đợt, giao bản, duyệt, chỉnh sửa, huỷ, tranh chấp |
| Hoạ sĩ | `/studio`, `/studio/artworks/:id` | Tạo tranh, ảnh xem trước, phiên bản bán, tệp, xác nhận đổi chi phí in |
| Hoạ sĩ | `/studio/settings`, `/studio/proceeds` | Nhận vẽ, giá khởi điểm, đăng điều khoản; xem doanh thu |
| Nhân viên | `/staff/login`, `/admin` | Kiểm duyệt, giao hàng, hoàn tiền, tranh chấp, chi trả, đối soát, cấp quyền hoạ sĩ, thẻ, tỉnh/thành |

## Ghi chú tích hợp

Viết theo phản hồi BE ngày 05/11/2026 (nhánh `_feature_f20`).

- Đăng nhập: token sống theo `expiresIn` (mặc định 2 giờ), chưa có refresh token. FE tự đăng xuất khi hết hạn hoặc gặp `401`.
- `GET /artists/me` quyết định có hiện Xưởng hay không; `403 ARTIST_PROFILE_REQUIRED` nghĩa là chưa phải hoạ sĩ.
- Trang `/payment/return` chỉ dùng `vnp_TxnRef` để gọi `GET /payments/attempts/{ref}` và chờ IPN; không tin `vnp_ResponseCode`.
- Admin cấp quyền hoạ sĩ bằng email (`GET /admin/customers?email=`), tạm ngưng/khôi phục từ danh sách `GET /admin/artists`.
- Admin giao hàng thấy tên sản phẩm, số lượng và địa chỉ người nhận ngay trong danh sách.
- Upload: FE chặn tệp trên 200 MB (ảnh xem trước trên 10 MB) trước khi gửi.
- Ảnh/tệp cần đăng nhập được tải bằng `fetch` kèm token rồi hiển thị/tải xuống.
- Danh mục tranh chưa phân trang (BE hoãn); FE lọc và tìm kiếm ngay trên trình duyệt.
