import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { addresses, cart, orders } from '../../api/endpoints';
import type { CheckoutPreviewDTO } from '../../api/types';
import { Action, Empty, ErrorBox, Loading, Notice, PageHead, useAsync } from '../../components/ui';
import { money, problem } from '../../lib/format';
import { Link, navigate } from '../../lib/router';

export function CartPage() {
  const cartState = useAsync(() => cart.get());
  const addressState = useAsync(() => addresses.list());
  const [addressId, setAddressId] = useState<number | undefined>();
  const [preview, setPreview] = useState<CheckoutPreviewDTO | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [orderError, setOrderError] = useState<unknown>(null);
  const [changedNotice, setChangedNotice] = useState(false);

  const items = cartState.data?.items ?? [];
  const hasPhysical = items.some((item) => item.listingType === 'PHYSICAL');

  useEffect(() => {
    if (addressId === undefined && addressState.data?.length) {
      setAddressId((addressState.data.find((a) => a.defaultAddress) ?? addressState.data[0]).addressId);
    }
  }, [addressState.data, addressId]);

  const loadPreview = async () => {
    try {
      setPreview(await cart.preview(hasPhysical ? addressId : undefined));
      setPreviewError(null);
    } catch (err) {
      setPreview(null);
      setPreviewError(err);
    }
  };

  useEffect(() => {
    if (cartState.data && items.length) loadPreview();
    else setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartState.data, addressId]);

  const refresh = async () => {
    await cartState.reload();
  };

  if (cartState.loading && !cartState.data) return <Loading />;

  return (
    <div>
      <PageHead title="Giỏ hàng" />
      <ErrorBox error={cartState.error} onRetry={cartState.reload} />
      {cartState.data && items.length === 0 && (
        <Empty title="Giỏ hàng đang trống.">
          <Link className="btn btn-primary" to="/">Xem tranh</Link>
        </Empty>
      )}

      {items.length > 0 && (
        <div className="checkout">
          <section>
            <table className="table">
              <thead><tr><th>Sản phẩm</th><th>Đơn giá</th><th>Số lượng</th><th className="num">Thành tiền</th><th /></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.listingId} className={item.problem ? 'row-problem' : ''}>
                    <td>
                      <div className="cell-strong">{item.name}</div>
                      <div className="muted small">{item.listingType === 'PHYSICAL' ? 'Bản in' : 'Bản số'}</div>
                      {item.problem && <div className="text-bad small">{problem(item.problem)}</div>}
                    </td>
                    <td>{money(item.unitPrice)}</td>
                    <td>
                      {item.listingType === 'PHYSICAL' ? (
                        <QuantityInput value={item.quantity} onCommit={async (quantity) => {
                          cartState.setData(await cart.update(item.listingId, quantity));
                        }} />
                      ) : 1}
                    </td>
                    <td className="num">{money(item.lineTotal)}</td>
                    <td><Action variant="quiet" size="sm" onClick={async () => { await cart.remove(item.listingId); await refresh(); }}>Xoá</Action></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside className="panel summary">
            {hasPhysical && (
              <div className="summary-block">
                <h2 className="section-title">Giao tới</h2>
                {addressState.data?.length ? (
                  <select className="input" value={addressId ?? ''} onChange={(e) => setAddressId(Number(e.target.value))} aria-label="Địa chỉ giao hàng">
                    {addressState.data.map((a) => (
                      <option key={a.addressId} value={a.addressId}>{a.label ? `${a.label}: ` : ''}{a.recipientName}, {a.line1}, {a.ward}</option>
                    ))}
                  </select>
                ) : (
                  <Notice kind="warn">Bạn chưa có địa chỉ. <Link to="/account/addresses">Thêm địa chỉ</Link></Notice>
                )}
              </div>
            )}

            <ErrorBox error={previewError} onRetry={loadPreview} />
            {preview && (
              <>
                <dl className="totals">
                  <dt>Tạm tính</dt><dd>{money(preview.itemsSubtotal)}</dd>
                  <dt>Phí giao hàng</dt><dd>{money(preview.shippingAmount)}</dd>
                  <dt>Thuế</dt><dd>{money(preview.taxAmount)}</dd>
                  <dt className="total">Tổng cộng</dt><dd className="total">{money(preview.totalAmount)}</dd>
                </dl>
                {preview.problems.length > 0 && (
                  <ul className="problems">{preview.problems.map((p) => <li key={p}>{problem(p)}</li>)}</ul>
                )}
                {changedNotice && <Notice kind="warn">Giá hoặc giỏ hàng vừa thay đổi. Đây là số tiền mới, hãy kiểm tra lại.</Notice>}
                <ErrorBox error={orderError} />
                <Action
                  disabled={!preview.committable}
                  onError={setOrderError}
                  onClick={async () => {
                    setOrderError(null);
                    setChangedNotice(false);
                    try {
                      const order = await orders.create(preview, hasPhysical ? addressId : undefined);
                      navigate(`/orders/${order.orderId}`);
                    } catch (err) {
                      if (err instanceof ApiError && (err.code === 'CHECKOUT_CHANGED' || err.code === 'CHECKOUT_BLOCKED')) {
                        await cartState.reload();
                        setChangedNotice(err.code === 'CHECKOUT_CHANGED');
                      }
                      throw err;
                    }
                  }}
                >
                  Đặt hàng
                </Action>
                <p className="muted small">Đơn hàng giữ trong 30 phút để bạn thanh toán qua VNPay.</p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function QuantityInput({ value, onCommit }: { value: number; onCommit: (quantity: number) => Promise<void> }) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<unknown>(null);
  useEffect(() => setDraft(String(value)), [value]);
  const commit = async () => {
    const next = Number(draft);
    if (!Number.isInteger(next) || next < 1 || next === value) {
      setDraft(String(value));
      return;
    }
    try {
      await onCommit(next);
      setError(null);
    } catch (err) {
      setError(err);
      setDraft(String(value));
    }
  };
  return (
    <>
      <input className="input input-qty" type="number" min={1} max={99} value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} aria-label="Số lượng" />
      <ErrorBox error={error} />
    </>
  );
}
