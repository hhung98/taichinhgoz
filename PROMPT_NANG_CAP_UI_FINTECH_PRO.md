# PROMPT NÂNG CẤP GIAO DIỆN & TRẢI NGHIỆM FINTECH CAO CẤP (FINTECH PRO UI/UX UPGRADE)
**Ứng dụng**: Goz Finance (taichinhgoz)  
**Kiến trúc tham chiếu**: Revolut, Apple Wallet, Jinil B2B Portal (/business)  
**Mục tiêu**: Nâng cấp toàn diện thẩm mỹ giao diện, micro-interactions, độ mượt 60-120 FPS, và tính tiện dụng 1-chạm trên cả PC & Mobile.

---

## 1. NÂNG CẤP HEADER & CHUYỂN ĐỔI NGOẠI TỆ TỨC THÌ (INSTANT CURRENCY SELECTOR)
- **Vấn đề**: Người dùng cần chuyển đổi linh hoạt giữa VND, KRW, và USD để theo dõi tài sản tại Việt Nam và Hàn Quốc.
- **Giải pháp**:
  - Tích hợp cụm nút chọn tiền tệ Segmented Control kiểu iOS ngay trên Header (hoặc cạnh thanh tỷ giá) với 3 tùy chọn: `VND`, `KRW`, `USD`.
  - Hiệu ứng trượt pill siêu mượt (smooth sliding pill background), không giật, đồng bộ tức thì toàn bộ số liệu trên màn hình trong 0ms.
  - Trên mobile: Nút nhỏ gọn bo góc 10px, chiều cao 32px, không chiếm diện tích của brand logo hay các nút chức năng.

---

## 2. NÂNG CẤP HERO CARD QUẢN TRỊ TÀI SẢN & ĐẦU TƯ VÀNG (24K GOLD & CRYPTO POLISH)
- **Hero Breakdown 4 Trụ Cột**:
  - **Tiền mặt**: Tone xanh ngọc (Teal / Emerald) an toàn, hiển thị tỷ trọng % và số dư.
  - **Crypto**: Tone tím neon (Purple / Violet), hiển thị logo thật của các đồng Coin (BTC, ETH, SOL, BNB, XRP, ENA...).
  - **Cổ phiếu VN**: Tone xanh dương (Blue / Indigo), hiển thị mã chứng khoán (FPT, HPG, VNM...).
  - **Đầu tư Vàng**: Tone vàng kim sang trọng (Amber / Gold `#f59e0b`), huy hiệu kim loại quý sang trọng kèm nhãn "SJC / PNJ / DOJI Live API".
- **Live Pulse Indicator**:
  - Thêm chấm xanh nhấp nháy nhẹ (Live pulse badge) bên cạnh dòng "Giá thị trường trực tuyến" để người dùng nhận diện ngay dữ liệu đang được đồng bộ theo thời gian thực.
- **Preload ảnh Coin Icons**:
  - Bỏ `loading="lazy"` trên các đồng coin chính để ảnh tải ngay lập tức khi mở tab, không còn hiện tượng chớp tắt hay ảnh vỡ.

---

## 3. NÂNG CẤP THẺ KPI TỔNG QUAN (PREMIUM GLASS CARDS & MICRO-INTERACTIONS)
- **Glassmorphism & Gradient Border**:
  - 4 thẻ KPI (`Số dư hiện tại`, `Tổng thu nhập`, `Tổng chi tiêu`, `Tích lũy ròng`):
    - Đổ bóng đa tầng `box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3)`.
    - Viền kim loại mỏng `1px solid rgba(255, 255, 255, 0.08)` (Dark) / `rgba(15, 23, 42, 0.08)` (Light).
    - Hiệu ứng Hover 3D nhẹ (`transform: translateY(-3px) scale(1.008)`), tăng cảm giác chân thực khi dùng chuột trên PC.
- **Chạm phản hồi trên Mobile (Touch Ripple & Active State)**:
  - Khi người dùng chạm ngón tay vào thẻ hoặc nút bấm, thẻ hơi lõm nhẹ (`transform: scale(0.98)`), mang lại trải nghiệm như ứng dụng Native trên iOS / Android.

---

## 4. TỐI ƯU HÓA RESPONSIVE & THANH ĐIỀU HƯỚNG ĐÁY (MOBILE BOTTOM NAV)
- **Bottom Navigation Ergonomics**:
  - Chiều cao chuẩn 62px, nền kính mờ `backdrop-filter: blur(20px)`.
  - Icon Lucide sắc nét, kích thước 20px.
  - Active indicator: Hiệu ứng viên ngọc phát sáng nhẹ dưới tab đang chọn.
  - An toàn cho iPhone có thanh Home Indicator (`padding-bottom: env(safe-area-inset-bottom, 16px)`).
- **Tránh che khuất nội dung**:
  - Khung nội dung luôn có khoảng đệm cuối trang tối thiểu 110px.

---

## 5. ĐỒNG BỘ CACHE-BUSTER & HIỆU NĂNG TỐI ĐA
- Nâng toàn bộ script (`app.js`, `portfolio.js`, `countup.js`, `gsap.min.js`, `style.css`) lên cùng version cache-buster mới nhất để máy người dùng tự động làm mới tức thì.

