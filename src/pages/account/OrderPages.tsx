import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { orders, purchases, refunds } from '../../api/endpoints';
import type { OrderItemDTO, PaymentAttemptStatusDTO } from '../../api/types';
import { Action, Badge, DownloadButton, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHead, useAsync } from '../../components/ui';
import { bytes, label, money, when } from '../../lib/format';
import { payOrder } from '../../lib/payment';
import { Link, useQuery } from '../../lib/router';

export function OrdersPage() {
  const { data, error, loading, reload } = useAsync(() => orders.list());
  if (loading && !data) return <Loading />;
  return (
    <div>
      <PageHead title="Đơn hàng" />
      <ErrorBox error={error} onRetry={reload} />
      {data?.length === 0 && <Empty title="Bạn chưa có đơn hàng nào."><Link className="btn btn-primary" to="/">Xem tranh</Link></Empty>}
      {!!data?.length && (
        <table className="table">
          <thead><tr><th>Mã đơn</th><th>Ngày đặt</th><th>Sản phẩm</th><th>Trạng thái</th><th className="num">Tổng</th></tr></thead>
          <tbody>
            {data.map((order) => (
              <tr key={order.orderId}>
                <td><Link to={`/orders/${order.orderId}`} className="link-strong">#{order.orderId}</Link></td>
                <td>{when(order.createdAt)}</td>
                <td>{order.items.map((item) => item.listingName).join(', ')}</td>
                <td><Badge status={order.status} /></td>
                <td className="num">{money(order.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function OrderDetailPage({ orderId }: { orderId: number }) {
  const { data: order, error, loading, reload } = useAsync(() => orders.get(orderId), [orderId]);
  const [refundItem, setRefundItem] = useState<OrderItemDTO | null>(null);
  const [payError, setPayError] = useState<unknown>(null);

  if (loading && !order) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!order) return null;
  const payable = order.status === 'PENDING_PAYMENT' && new Date(order.expiresAt).getTime() > Date.now();

  return (
    <div>
      <PageHead title={`Đơn hàng #${order.orderId}`} sub={<>Đặt lúc {when(order.createdAt)} <Badge status={order.status} /></>}
        actions={payable && <Action onError={setPayError} onClick={() => payOrder(order.orderId)}>Thanh toán qua VNPay</Action>} />
      <ErrorBox error={payError} />
      {payable && <Notice kind="warn">Hãy thanh toán trước {when(order.expiresAt)}, sau đó đơn sẽ tự huỷ.</Notice>}
      {order.status === 'PAID' && <Notice kind="ok">Đã thanh toán lúc {when(order.paidAt)}. Bản số nằm trong mục <Link to="/purchases">Tệp đã mua</Link>.</Notice>}

      <div className="checkout">
        <section>
          <table className="table">
            <thead><tr><th>Sản phẩm</th><th>SL</th><th className="num">Thành tiền</th><th>Giao hàng / hoàn tiền</th></tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.orderItemId}>
                  <td>
                    <div className="cell-strong">{item.artworkTitle}: {item.listingName}</div>
                    <div className="muted small">{item.artistName}, {label(item.listingType)}{item.specifications ? `, ${item.specifications}` : ''}</div>
                  </td>
                  <td>{item.quantity}</td>
                  <td className="num">{money(item.lineSubtotal)}</td>
                  <td>
                    {item.fulfillment && (
                      <div>
                        <Badge status={item.fulfillment.status} />
                        {item.fulfillment.carrier && <div className="small">{item.fulfillment.carrier} {item.fulfillment.trackingReference}</div>}
                        {item.fulfillment.deliveredAt && <div className="small muted">Giao lúc {when(item.fulfillment.deliveredAt)}</div>}
                      </div>
                    )}
                    {item.refundStatus && <div className="small">Hoàn tiền: <Badge status={item.refundStatus} /></div>}
                    {order.status === 'PAID' && item.listingType === 'PHYSICAL' && (!item.refundStatus || item.refundStatus === 'REJECTED') && (
                      <button className="btn btn-quiet btn-sm" onClick={() => setRefundItem(item)}>
                        {item.fulfillment?.status === 'DELIVERED' ? 'Yêu cầu trả hàng' : 'Yêu cầu hoàn tiền'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="panel summary">
          <dl className="totals">
            <dt>Tạm tính</dt><dd>{money(order.itemsSubtotal)}</dd>
            <dt>Phí giao hàng</dt><dd>{money(order.shippingAmount)}</dd>
            <dt>Thuế</dt><dd>{money(order.taxAmount)}</dd>
            <dt className="total">Tổng cộng</dt><dd className="total">{money(order.totalAmount)}</dd>
          </dl>
          {order.payment && <p className="small">Thanh toán: <Badge status={order.payment.status} /></p>}
          {order.shippingAddress && (
            <div className="address-block">
              <div className="cell-strong">{order.shippingAddress.recipientName}, {order.shippingAddress.phone}</div>
              <div>{order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}</div>
              <div>{order.shippingAddress.ward}{order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ''}, {order.shippingAddress.provinceName}</div>
            </div>
          )}
        </aside>
      </div>

      {refundItem && (
        <RefundModal orderId={order.orderId} item={refundItem} onClose={() => setRefundItem(null)} onDone={() => { setRefundItem(null); reload(); }} />
      )}
    </div>
  );
}

function RefundModal({ orderId, item, onClose, onDone }: { orderId: number; item: OrderItemDTO; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <Modal title={`Hoàn tiền: ${item.listingName}`} onClose={onClose}>
      <p className="muted">Hàng đã giao có thể trả trong 48 giờ. Quản trị viên sẽ xem xét và chuyển khoản hoàn tiền thủ công.</p>
      <Field label="Lý do"><textarea className="input" rows={4} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <ErrorBox error={error} />
      <Action disabled={!reason.trim()} onError={setError} onClick={async () => { await orders.requestRefund(orderId, item.orderItemId, reason.trim()); onDone(); }}>Gửi yêu cầu</Action>
    </Modal>
  );
}

// VNPay sends the buyer back here. Only the signed IPN confirms a payment, so the page ignores vnp_ResponseCode and
// asks the backend about vnp_TxnRef until the attempt leaves INITIATED/PENDING.
export function PaymentReturnPage() {
  const ref = useQuery().get('vnp_TxnRef');
  const [attempt, setAttempt] = useState<PaymentAttemptStatusDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!ref) return;
    let stop = false;
    let tries = 0;
    async function check() {
      tries += 1;
      try {
        const result = await orders.attempt(ref!);
        if (stop) return;
        setAttempt(result);
        setError(null);
        if (result.status !== 'INITIATED' && result.status !== 'PENDING') return;
      } catch (err) {
        if (stop) return;
        setError(err);
        if (err instanceof ApiError && err.status === 404) return;
      }
      if (tries < 15) setTimeout(check, 2000);
      else setGaveUp(true);
    }
    check();
    return () => {
      stop = true;
    };
  }, [ref]);

  const target = attempt?.orderId ? `/orders/${attempt.orderId}` : attempt?.commissionId ? `/commissions/${attempt.commissionId}` : '/orders';
  const what = attempt?.orderId ? `đơn hàng #${attempt.orderId}`
    : attempt?.commissionId ? `đợt ${attempt.installment} của đơn vẽ #${attempt.commissionId}` : 'giao dịch';
  const waiting = !attempt || attempt.status === 'INITIATED' || attempt.status === 'PENDING';

  return (
    <div className="auth-card">
      <h1>Kết quả thanh toán</h1>
      {!ref && <Notice>Không có mã giao dịch VNPay trên đường dẫn này.</Notice>}
      {ref && error instanceof ApiError && error.status === 404 ? <Notice kind="warn">Không tìm thấy giao dịch này trong tài khoản của bạn.</Notice> : <ErrorBox error={error} />}
      {ref && waiting && !gaveUp && !error && <Loading text="Đang chờ VNPay xác nhận với cửa hàng…" />}
      {waiting && gaveUp && <Notice kind="warn">Cửa hàng chưa nhận được xác nhận từ VNPay cho {what}. Kiểm tra lại sau ít phút; đừng thanh toán lại ngay.</Notice>}
      {attempt?.status === 'SUCCEEDED' && <Notice kind="ok">Đã thanh toán {what}.</Notice>}
      {attempt?.status === 'FAILED' && <Notice kind="warn">Thanh toán {what} không thành công. Bạn có thể thử lại.</Notice>}
      {attempt?.status === 'EXCEPTION' && <Notice kind="warn">Tiền đã tới nhưng không áp được vào {what} (đơn đã hết hạn, sai số tiền hoặc đã được trả bằng lần khác). Hãy liên hệ đội ngũ để được hoàn tiền.</Notice>}
      <p><Link className="btn btn-primary" to={target}>Xem chi tiết</Link></p>
    </div>
  );
}

export function PurchasesPage() {
  const { data, error, loading, reload } = useAsync(() => purchases.list());
  if (loading && !data) return <Loading />;
  return (
    <div>
      <PageHead title="Tệp đã mua" sub="Tệp của bản số có ngay sau khi thanh toán; tệp kèm bản in mở sau khi hết hạn đổi trả 48 giờ." />
      <ErrorBox error={error} onRetry={reload} />
      {data?.length === 0 && <Empty title="Chưa có tệp nào." />}
      <div className="stack">
        {data?.map((purchase) => (
          <div key={purchase.entitlementId} className="panel">
            <div className="row-between">
              <div>
                <div className="cell-strong">{purchase.artworkTitle}: {purchase.listingName}</div>
                <div className="muted small">{purchase.artistName}, nhận lúc {when(purchase.grantedAt)}, <Link to={`/orders/${purchase.orderId}`}>đơn #{purchase.orderId}</Link></div>
              </div>
            </div>
            <ul className="file-list">
              {purchase.files.map((file) => (
                <li key={file.assetId}>
                  <span>{file.fileName} <span className="muted small">({bytes(file.byteLength)})</span></span>
                  <DownloadButton path={purchases.filePath(file.assetId)} name={file.fileName} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RefundsPage() {
  const { data, error, loading, reload } = useAsync(() => refunds.mine());
  if (loading && !data) return <Loading />;
  return (
    <div>
      <PageHead title="Yêu cầu hoàn tiền" />
      <ErrorBox error={error} onRetry={reload} />
      {data?.length === 0 && <Empty title="Bạn chưa gửi yêu cầu hoàn tiền nào." />}
      {!!data?.length && (
        <table className="table">
          <thead><tr><th>Yêu cầu</th><th>Lý do</th><th>Trạng thái</th><th>Chuyển khoản</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.refundRequestId}>
                <td>
                  <div className="cell-strong">#{r.refundRequestId}</div>
                  <div className="small muted">{r.commissionId ? <Link to={`/commissions/${r.commissionId}`}>Đơn vẽ #{r.commissionId}</Link> : `Sản phẩm #${r.orderItemId}`}</div>
                  <div className="small muted">{when(r.requestedAt)}</div>
                </td>
                <td>{r.reason}{r.decisionReason && <div className="small muted">Phản hồi: {r.decisionReason}</div>}</td>
                <td><Badge status={r.status} />{r.refundPercent !== null && <div className="small">{r.refundPercent}%</div>}</td>
                <td>{r.transfer ? <>{money(r.transfer.amount)} <Badge status={r.transfer.status} /></> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
