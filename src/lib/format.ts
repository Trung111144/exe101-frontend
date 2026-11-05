const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });

export const money = (value: number | null | undefined) => (value === null || value === undefined ? '—' : vnd.format(value));
export const when = (value: string | null | undefined) => (value ? dateTime.format(new Date(value)) : '—');
export const bytes = (value: number) =>
  value < 1024 ? `${value} B` : value < 1024 ** 2 ? `${(value / 1024).toFixed(0)} KB` : `${(value / 1024 ** 2).toFixed(1)} MB`;

// Vietnamese labels for backend status codes. Unknown codes fall back to the raw value.
const labels: Record<string, string> = {
  DRAFT: 'Bản nháp', PUBLISHED: 'Đã đăng', UNLISTED: 'Ẩn khỏi danh mục', MODERATED: 'Bị kiểm duyệt', ARCHIVED: 'Lưu trữ',
  DIGITAL: 'Bản số', PHYSICAL: 'Bản in',
  PENDING_PAYMENT: 'Chờ thanh toán', PAID: 'Đã thanh toán', EXPIRED: 'Hết hạn', CANCELLED: 'Đã huỷ',
  PENDING: 'Đang chờ', IN_PRODUCTION: 'Đang sản xuất', READY_TO_SHIP: 'Sẵn sàng giao', SHIPPED: 'Đang giao',
  DELIVERED: 'Đã giao', FAILED: 'Thất bại', SUCCEEDED: 'Thành công', EXCEPTION: 'Bất thường', PROCESSING: 'Đang xử lý',
  REQUESTED: 'Đã gửi yêu cầu', APPROVED: 'Đã duyệt', REJECTED: 'Bị từ chối', REFUNDED: 'Đã hoàn tiền',
  QUOTED: 'Đã báo giá', AWAITING_PAYMENT: 'Chờ thanh toán', IN_PROGRESS: 'Đang thực hiện',
  SUBMITTED_FOR_REVIEW: 'Chờ duyệt bản giao', REVISION_REQUESTED: 'Yêu cầu chỉnh sửa', COMPLETED: 'Hoàn thành',
  DECLINED: 'Từ chối', DISPUTED: 'Đang tranh chấp', OFFERED: 'Chờ phản hồi', ACCEPTED: 'Đã chấp nhận',
  WITHDRAWN: 'Đã rút', OPEN: 'Mới mở', UNDER_REVIEW: 'Đang xem xét', RESOLVED: 'Đã giải quyết',
  HELD: 'Đang giữ', ELIGIBLE: 'Đủ điều kiện chi', RESERVED: 'Đang chi trả', VOID: 'Huỷ bỏ',
  ACTIVE: 'Hoạt động', SUSPENDED: 'Tạm ngưng',
  CONTINUE: 'Tiếp tục', CANCEL_REFUND: 'Huỷ và hoàn tiền', CANCEL_NO_REFUND: 'Huỷ không hoàn tiền',
};
export const label = (code: string | null | undefined) => (code ? labels[code] ?? code : '—');

export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'info';
const tones: Record<string, Tone> = {
  PUBLISHED: 'ok', PAID: 'ok', DELIVERED: 'ok', SUCCEEDED: 'ok', COMPLETED: 'ok', APPROVED: 'ok', REFUNDED: 'ok',
  ACTIVE: 'ok', ACCEPTED: 'ok', RESOLVED: 'ok', ELIGIBLE: 'ok',
  PENDING_PAYMENT: 'warn', AWAITING_PAYMENT: 'warn', OFFERED: 'warn', REQUESTED: 'warn', PENDING: 'warn',
  SUBMITTED_FOR_REVIEW: 'warn', QUOTED: 'warn', IN_PROGRESS: 'info', REVISION_REQUESTED: 'warn', OPEN: 'warn', UNDER_REVIEW: 'warn', HELD: 'warn',
  DISPUTED: 'bad', MODERATED: 'bad', FAILED: 'bad', REJECTED: 'bad', EXCEPTION: 'bad', SUSPENDED: 'bad',
  CANCELLED: 'muted', EXPIRED: 'muted', ARCHIVED: 'muted', DECLINED: 'muted', WITHDRAWN: 'muted', VOID: 'muted',
  DRAFT: 'muted', UNLISTED: 'muted',
};
export const tone = (code: string | null | undefined): Tone => (code ? tones[code] ?? 'info' : 'muted');

const problemLabels: Record<string, string> = {
  CART_EMPTY: 'Giỏ hàng trống.',
  LISTING_UNAVAILABLE: 'Sản phẩm không còn bán.',
  OWN_LISTING: 'Bạn không thể mua sản phẩm của chính mình.',
  QUANTITY_NOT_ALLOWED: 'Số lượng không hợp lệ (bản số chỉ mua 1).',
  ADDRESS_REQUIRED: 'Đơn có bản in cần địa chỉ giao hàng.',
  DELIVERY_NOT_SUPPORTED: 'Chưa giao tới tỉnh/thành này.',
  AMOUNT_TOO_LARGE: 'Tổng tiền vượt giới hạn cho phép.',
};
export const problem = (code: string) => problemLabels[code] ?? code;
