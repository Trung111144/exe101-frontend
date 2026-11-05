import { useState } from 'react';
import { ApiError } from '../../api/client';
import { admin, provinces } from '../../api/endpoints';
import type { ArtistDTO, ArtworkDTO, CustomerDTO, DisputeEvidenceDTO, RefundRequestDTO, ReleaseDTO, FulfillmentDTO } from '../../api/types';
import {
  Action, Badge, DownloadButton, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHead, ProtectedImage, Tabs, useAsync,
} from '../../components/ui';
import { label, money, when } from '../../lib/format';
import { Link, navigate, useQuery } from '../../lib/router';

type Section = 'artworks' | 'fulfillments' | 'refunds' | 'disputes' | 'finance' | 'artists' | 'tags' | 'provinces';
const sections: [Section, string][] = [
  ['artworks', 'Kiểm duyệt tranh'], ['fulfillments', 'Giao hàng'], ['refunds', 'Hoàn tiền'], ['disputes', 'Tranh chấp'],
  ['finance', 'Chi trả và đối soát'], ['artists', 'Hoạ sĩ'], ['tags', 'Thẻ'], ['provinces', 'Khu vực giao'],
];

export function AdminPage() {
  const query = useQuery();
  const section = (query.get('tab') as Section) || 'artworks';
  return (
    <div>
      <PageHead title="Quản trị" />
      <Tabs tabs={sections} value={section} onChange={(next) => navigate(`/admin?tab=${next}`)} />
      {section === 'artworks' && <ArtworksAdmin />}
      {section === 'fulfillments' && <FulfillmentsAdmin />}
      {section === 'refunds' && <RefundsAdmin />}
      {section === 'disputes' && <DisputesAdmin />}
      {section === 'finance' && <FinanceAdmin />}
      {section === 'artists' && <ArtistsAdmin />}
      {section === 'tags' && <TagsAdmin />}
      {section === 'provinces' && <ProvincesAdmin />}
    </div>
  );
}

function StatusFilter({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="input input-inline" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Lọc trạng thái">
      <option value="">Tất cả trạng thái</option>
      {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
    </select>
  );
}

// ---------- Artworks & listings ----------
function ArtworksAdmin() {
  const { data, error, loading, reload } = useAsync(() => admin.artworks());
  const [status, setStatus] = useState('PUBLISHED');
  const [open, setOpen] = useState<ArtworkDTO | null>(null);
  const shown = (data ?? []).filter((a) => !status || a.status === status);
  return (
    <section>
      <div className="toolbar"><StatusFilter options={['DRAFT', 'PUBLISHED', 'UNLISTED', 'MODERATED', 'ARCHIVED']} value={status} onChange={setStatus} /></div>
      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />
      {data && shown.length === 0 && <Empty title="Không có tranh nào ở trạng thái này." />}
      {shown.length > 0 && (
        <table className="table">
          <thead><tr><th /><th>Tranh</th><th>Hoạ sĩ</th><th>Trạng thái</th><th>Tạo lúc</th></tr></thead>
          <tbody>
            {shown.map((a) => {
              const preview = [...a.previews].sort((x, y) => x.sortOrder - y.sortOrder)[0];
              return (
                <tr key={a.artworkId}>
                  <td className="thumb-cell">{preview && <ProtectedImage path={admin.artworkPreviewPath(a.artworkId, preview.mediaId)} alt="" className="thumb-img" />}</td>
                  <td><button className="link-button" onClick={() => setOpen(a)}>{a.title}</button></td>
                  <td>{a.artistDisplayName ?? `#${a.artistId}`}</td>
                  <td><Badge status={a.status} /></td>
                  <td>{when(a.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {open && <ArtworkReview artwork={open} onClose={() => setOpen(null)} onChange={() => { setOpen(null); reload(); }} />}
    </section>
  );
}

function ArtworkReview({ artwork, onClose, onChange }: { artwork: ArtworkDTO; onClose: () => void; onChange: () => void }) {
  const listings = useAsync(() => admin.listings(artwork.artworkId), [artwork.artworkId]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const previews = [...artwork.previews].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <Modal title={artwork.title} onClose={onClose} wide>
      <div className="preview-grid">
        {previews.map((p) => <ProtectedImage key={p.mediaId} path={admin.artworkPreviewPath(artwork.artworkId, p.mediaId)} alt="" />)}
      </div>
      {artwork.description && <p className="pre">{artwork.description}</p>}
      <p className="small">Trạng thái: <Badge status={artwork.status} /> Thẻ: {artwork.tags.map((t) => t.name).join(', ') || '—'}</p>

      <Field label="Lý do (bắt buộc khi kiểm duyệt)"><textarea className="input" rows={2} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <ErrorBox error={error} />
      <div className="row-gap">
        {artwork.status !== 'MODERATED' && <Action variant="danger" onError={setError} disabled={!reason.trim()} onClick={async () => { await admin.setArtworkStatus(artwork.artworkId, 'MODERATED', reason.trim()); onChange(); }}>Kiểm duyệt (gỡ xuống)</Action>}
        {artwork.status === 'MODERATED' && (
          <>
            <Action onError={setError} onClick={async () => { await admin.setArtworkStatus(artwork.artworkId, 'PUBLISHED', reason.trim()); onChange(); }}>Khôi phục và đăng lại</Action>
            <Action variant="ghost" onError={setError} onClick={async () => { await admin.setArtworkStatus(artwork.artworkId, 'UNLISTED', reason.trim()); onChange(); }}>Khôi phục ở chế độ ẩn</Action>
          </>
        )}
      </div>

      <h3 className="section-title">Phiên bản bán</h3>
      <ErrorBox error={listings.error} onRetry={listings.reload} />
      {listings.data?.length === 0 && <p className="muted small">Không có phiên bản bán.</p>}
      {listings.data?.map((l) => (
        <div key={l.listingId} className="item">
          <div className="row-between"><span className="cell-strong">{l.name} ({label(l.listingType)}) {money(l.price)}</span><Badge status={l.status} /></div>
          <ul className="file-list">{l.assets.map((a) => <li key={a.assetId}><span>Tệp #{a.assetId}</span><DownloadButton path={admin.listingAssetPath(l.listingId, a.assetId)} name={`listing-${l.listingId}-${a.assetId}`} /></li>)}</ul>
          <div className="row-gap">
            {l.status !== 'MODERATED'
              ? <Action variant="danger" size="sm" disabled={!reason.trim()} onError={setError} onClick={async () => { await admin.setListingStatus(l.listingId, 'MODERATED', reason.trim()); listings.reload(); }}>Kiểm duyệt</Action>
              : <Action size="sm" onError={setError} onClick={async () => { await admin.setListingStatus(l.listingId, 'UNLISTED', reason.trim()); listings.reload(); }}>Khôi phục (ẩn)</Action>}
          </div>
        </div>
      ))}
    </Modal>
  );
}

// ---------- Fulfillment ----------
const nextFulfillment: Record<string, string[]> = {
  PENDING: ['IN_PRODUCTION'], IN_PRODUCTION: ['READY_TO_SHIP'], READY_TO_SHIP: ['SHIPPED'], SHIPPED: ['DELIVERED'],
};
function FulfillmentsAdmin() {
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useAsync(() => admin.fulfillments(status || undefined), [status]);
  const [shipping, setShipping] = useState<FulfillmentDTO | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  return (
    <section>
      <div className="toolbar"><StatusFilter options={['PENDING', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED']} value={status} onChange={setStatus} /></div>
      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />
      <ErrorBox error={actionError} />
      {data?.length === 0 && <Empty title="Không có sản phẩm cần giao." />}
      {!!data?.length && (
        <table className="table">
          <thead><tr><th>Sản phẩm</th><th>Giao tới</th><th>Trạng thái</th><th>Vận chuyển</th><th /></tr></thead>
          <tbody>
            {data.map((f) => (
              <tr key={f.orderItemId}>
                <td>
                  <div className="cell-strong">{f.artworkTitle}: {f.listingName}</div>
                  <div className="small">Số lượng {f.quantity}{f.specifications ? `, ${f.specifications}` : ''}</div>
                  <div className="small muted">Đơn #{f.orderId}, mục #{f.orderItemId}, cập nhật {when(f.updatedAt)}</div>
                </td>
                <td className="small">
                  {f.shippingAddress ? (
                    <>
                      <div className="cell-strong">{f.shippingAddress.recipientName}, {f.shippingAddress.phone}</div>
                      <div>{f.shippingAddress.line1}{f.shippingAddress.line2 ? `, ${f.shippingAddress.line2}` : ''}</div>
                      <div>{f.shippingAddress.ward}{f.shippingAddress.district ? `, ${f.shippingAddress.district}` : ''}, {f.shippingAddress.provinceName}</div>
                    </>
                  ) : '—'}
                </td>
                <td><Badge status={f.status} /></td>
                <td>{f.carrier ? `${f.carrier} ${f.trackingReference ?? ''}` : '—'}</td>
                <td>
                  {(nextFulfillment[f.status] ?? []).map((next) => next === 'SHIPPED'
                    ? <button key={next} className="btn btn-primary btn-sm" onClick={() => setShipping(f)}>Giao cho vận chuyển</button>
                    : <Action key={next} size="sm" onError={setActionError} onClick={async () => { await admin.advanceFulfillment(f.orderItemId, { status: next }); reload(); }}>Chuyển sang {label(next)}</Action>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {shipping && <ShipModal item={shipping} onClose={() => setShipping(null)} onDone={() => { setShipping(null); reload(); }} />}
    </section>
  );
}

function ShipModal({ item, onClose, onDone }: { item: FulfillmentDTO; onClose: () => void; onDone: () => void }) {
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <Modal title={`Giao: ${item.listingName} (đơn #${item.orderId})`} onClose={onClose}>
      <Field label="Đơn vị vận chuyển"><input className="input" maxLength={120} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="GHN, GHTK, Viettel Post…" /></Field>
      <Field label="Mã vận đơn"><input className="input" maxLength={160} value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
      <ErrorBox error={error} />
      <Action onError={setError} onClick={async () => { await admin.advanceFulfillment(item.orderItemId, { status: 'SHIPPED', carrier: carrier || undefined, trackingReference: tracking || undefined }); onDone(); }}>Xác nhận đã giao cho vận chuyển</Action>
    </Modal>
  );
}

// ---------- Refunds ----------
function RefundsAdmin() {
  const [status, setStatus] = useState('REQUESTED');
  const orderRefunds = useAsync(() => admin.refunds(status || undefined), [status]);
  const commissionRefunds = useAsync(() => admin.commissionRefunds(status || undefined), [status]);
  const [deciding, setDeciding] = useState<RefundRequestDTO | null>(null);
  const [transfer, setTransfer] = useState<RefundRequestDTO | null>(null);
  const rows: RefundRequestDTO[] = [
    ...(orderRefunds.data ?? []),
    ...(commissionRefunds.data ?? []).map((r) => ({ ...r, orderItemId: null, shippingAmount: null })),
  ].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return (
    <section>
      <div className="toolbar"><StatusFilter options={['REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED']} value={status} onChange={setStatus} /></div>
      <ErrorBox error={orderRefunds.error} onRetry={orderRefunds.reload} />
      <ErrorBox error={commissionRefunds.error} onRetry={commissionRefunds.reload} />
      {(orderRefunds.loading || commissionRefunds.loading) && !rows.length && <Loading />}
      {!orderRefunds.loading && rows.length === 0 && <Empty title="Không có yêu cầu hoàn tiền." />}
      {rows.length > 0 && (
        <table className="table">
          <thead><tr><th>Yêu cầu</th><th>Lý do</th><th>Trạng thái</th><th>Chuyển khoản</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.commissionId ? 'c' : 'o'}${r.refundRequestId}`}>
                <td><div className="cell-strong">#{r.refundRequestId}</div><div className="small muted">{r.commissionId ? `Đơn vẽ #${r.commissionId}, ${r.refundPercent}%` : `Sản phẩm #${r.orderItemId}`}</div><div className="small muted">{when(r.requestedAt)}</div></td>
                <td>{r.reason}{r.decisionReason && <div className="small muted">Quyết định: {r.decisionReason}</div>}</td>
                <td><Badge status={r.status} /></td>
                <td>{r.transfer ? <>{money(r.transfer.amount)} <Badge status={r.transfer.status} />{r.transfer.transferReference && <div className="small">{r.transfer.transferReference}</div>}</> : '—'}</td>
                <td>
                  {!r.commissionId && r.status === 'REQUESTED' && <button className="btn btn-primary btn-sm" onClick={() => setDeciding(r)}>Xét duyệt</button>}
                  {r.transfer && r.transfer.status !== 'SUCCEEDED' && <button className="btn btn-ghost btn-sm" onClick={() => setTransfer(r)}>Ghi nhận chuyển khoản</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {deciding && <DecideRefund refund={deciding} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); orderRefunds.reload(); }} />}
      {transfer && transfer.transfer && (
        <OutcomeModal title={`Chuyển khoản hoàn tiền ${money(transfer.transfer.amount)}`} statuses={transfer.transfer.status === 'FAILED' ? ['PENDING'] : ['SUCCEEDED', 'FAILED']} referenceFor="SUCCEEDED"
          onClose={() => setTransfer(null)}
          onSubmit={async (s, ref, reason) => { await admin.recordRefundTransfer(transfer.transfer!.transferId, s, ref, reason); setTransfer(null); orderRefunds.reload(); commissionRefunds.reload(); }} />
      )}
    </section>
  );
}

function DecideRefund({ refund, onClose, onDone }: { refund: RefundRequestDTO; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <Modal title={`Yêu cầu hoàn tiền #${refund.refundRequestId}`} onClose={onClose}>
      <p className="pre">{refund.reason}</p>
      <Field label="Lý do quyết định" hint="Bắt buộc khi từ chối."><textarea className="input" rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <ErrorBox error={error} />
      <div className="row-gap">
        <Action onError={setError} onClick={async () => { await admin.decideRefund(refund.refundRequestId, 'APPROVE', reason.trim()); onDone(); }}>Duyệt hoàn tiền</Action>
        <Action variant="danger" disabled={!reason.trim()} onError={setError} onClick={async () => { await admin.decideRefund(refund.refundRequestId, 'REJECT', reason.trim()); onDone(); }}>Từ chối</Action>
      </div>
    </Modal>
  );
}

function OutcomeModal({ title, statuses, referenceFor, onClose, onSubmit }: {
  title: string; statuses: string[]; referenceFor: string; onClose: () => void; onSubmit: (status: string, ref: string, reason: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(statuses[0]);
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="small muted">Chỉ ghi nhận sau khi đã kiểm tra ngân hàng.</p>
      <Field label="Kết quả"><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
      {status === referenceFor && <Field label="Mã giao dịch ngân hàng"><input className="input" maxLength={200} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>}
      <Field label="Ghi chú"><input className="input" maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <ErrorBox error={error} />
      <Action disabled={status === referenceFor && !ref.trim()} onError={setError} onClick={() => onSubmit(status, status === referenceFor ? ref.trim() : '', reason.trim())}>Ghi nhận</Action>
    </Modal>
  );
}

// ---------- Disputes ----------
function DisputesAdmin() {
  const [status, setStatus] = useState('OPEN');
  const { data, error, loading, reload } = useAsync(() => admin.disputes(status || undefined), [status]);
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <section>
      <div className="toolbar"><StatusFilter options={['OPEN', 'UNDER_REVIEW', 'RESOLVED']} value={status} onChange={setStatus} /></div>
      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />
      {data?.length === 0 && <Empty title="Không có tranh chấp." />}
      {!!data?.length && (
        <table className="table">
          <thead><tr><th>Tranh chấp</th><th>Đơn vẽ</th><th>Lý do</th><th>Trạng thái</th><th>Mở lúc</th></tr></thead>
          <tbody>{data.map((d) => (
            <tr key={d.disputeId}>
              <td><button className="link-button" onClick={() => setOpenId(d.disputeId)}>#{d.disputeId}</button></td>
              <td>#{d.commissionId}</td><td className="clip">{d.reason}</td><td><Badge status={d.status} /></td><td>{when(d.openedAt)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {openId && <DisputeModal disputeId={openId} onClose={() => setOpenId(null)} onChange={reload} />}
    </section>
  );
}

function DisputeModal({ disputeId, onClose, onChange }: { disputeId: number; onClose: () => void; onChange: () => void }) {
  const state = useAsync(() => admin.dispute(disputeId), [disputeId]);
  const [outcome, setOutcome] = useState('CONTINUE');
  const [reason, setReason] = useState('');
  const [percent, setPercent] = useState('100');
  const [error, setError] = useState<unknown>(null);
  const ev: DisputeEvidenceDTO | undefined = state.data;
  const who = (userId: number) => (ev && userId === ev.commission.customerId ? `Khách ${ev.commission.customerNameSnapshot}` : `Hoạ sĩ ${ev?.commission.artistNameSnapshot}`);
  return (
    <Modal title={`Tranh chấp #${disputeId}`} onClose={onClose} wide>
      {state.loading && !ev && <Loading />}
      <ErrorBox error={state.error} onRetry={state.reload} />
      {ev && (
        <div className="stack">
          <div className="item">
            <div className="row-between"><span className="cell-strong">{who(ev.dispute.openedByUserId)} mở tranh chấp</span><Badge status={ev.dispute.status} /></div>
            <p className="pre">{ev.dispute.reason}</p>
            <p className="small">Đơn vẽ #{ev.commission.commissionId}: {ev.commission.customerNameSnapshot} đặt {ev.commission.artistNameSnapshot}, <Badge status={ev.commission.status} /></p>
          </div>
          <details><summary>Báo giá ({ev.quotes.length})</summary>{ev.quotes.map((q) => (
            <div key={q.quoteId} className="item"><span className="cell-strong">Lần {q.sequenceNo}: {money(q.totalAmount)}</span> <Badge status={q.status} /><p className="pre small">{q.scopeText}</p>
              {q.artistTermsId && <Action variant="quiet" size="sm" onClick={async () => { const t = await admin.quoteTerms(ev.commission.commissionId, q.quoteId); window.alert(t.text); }}>Xem điều khoản đã đồng ý</Action>}
            </div>))}</details>
          <details><summary>Bản giao ({ev.deliverables.length})</summary>{ev.deliverables.map((d) => (
            <div key={d.deliverableId} className="item">Phiên bản {d.versionNo}, {when(d.submittedAt)}: {d.files.map((f) => f.originalName).join(', ')}{d.revisionRequests.map((r) => <p key={r.revisionId} className="small">Yêu cầu sửa: {r.details}</p>)}</div>))}</details>
          <details><summary>Đề nghị huỷ ({ev.cancellationRequests.length})</summary>{ev.cancellationRequests.map((c) => (
            <div key={c.cancellationId} className="item">{who(c.requestedByUserId)}: {c.reason} <Badge status={c.status} /></div>))}</details>
          <details open><summary>Tin nhắn ({ev.messages.length})</summary><div className="messages">{ev.messages.map((m) => (
            <div key={m.messageId} className="message"><div className="message-meta">{who(m.senderUserId)}, {when(m.sentAt)}</div><div className="pre">{m.body}</div></div>))}</div></details>

          <ErrorBox error={error} />
          {ev.dispute.status === 'OPEN' && <Action onError={setError} onClick={async () => { await admin.reviewDispute(disputeId); state.reload(); onChange(); }}>Nhận xem xét</Action>}
          {ev.dispute.status !== 'RESOLVED' && (
            <div className="panel form">
              <h3 className="section-title">Quyết định</h3>
              <Field label="Kết quả">
                <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  <option value="CONTINUE">Tiếp tục đơn</option><option value="CANCEL_REFUND">Huỷ và hoàn tiền</option><option value="CANCEL_NO_REFUND">Huỷ, không hoàn tiền</option>
                </select>
              </Field>
              {outcome === 'CANCEL_REFUND' && <Field label="Hoàn cho khách (% đợt 1)"><input className="input input-qty" type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} /></Field>}
              <Field label="Lý do"><textarea className="input" rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              <Action disabled={!reason.trim()} onError={setError} onClick={async () => {
                await admin.resolveDispute(disputeId, outcome, reason.trim(), outcome === 'CANCEL_REFUND' ? Number(percent) : null);
                state.reload(); onChange();
              }}>Ghi nhận quyết định</Action>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------- Finance ----------
function FinanceAdmin() {
  const [status, setStatus] = useState('PENDING');
  const releases = useAsync(() => admin.releases(status || undefined), [status]);
  const recon = useAsync(() => admin.reconciliation());
  const [recording, setRecording] = useState<ReleaseDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  return (
    <section className="stack">
      <div className="panel">
        <div className="row-between"><h2 className="section-title">Đối soát sổ cái</h2><Action variant="ghost" size="sm" onClick={recon.reload}>Kiểm tra lại</Action></div>
        <ErrorBox error={recon.error} onRetry={recon.reload} />
        {recon.data && (
          <>
            {recon.data.clean ? <Notice kind="ok">Sổ cái khớp với dữ liệu. Có thể chi trả.</Notice> : <Notice kind="warn">Sổ cái và dữ liệu không khớp. Mọi khoản chi bị chặn cho tới khi xử lý.</Notice>}
            <table className="table table-compact">
              <thead><tr><th>Tài khoản</th><th className="num">Số dư</th></tr></thead>
              <tbody>{recon.data.balances.map((b) => <tr key={b.account}><td>{b.account}</td><td className="num">{money(b.amount)}</td></tr>)}</tbody>
            </table>
            {recon.data.mismatches.length > 0 && (
              <table className="table table-compact">
                <thead><tr><th>Kiểm tra</th><th>Bản ghi</th></tr></thead>
                <tbody>{recon.data.mismatches.map((m, i) => <tr key={i}><td>{m.check}</td><td>{m.recordType} #{m.recordId}</td></tr>)}</tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div>
        <div className="toolbar"><h2 className="section-title">Chi trả cho hoạ sĩ</h2><StatusFilter options={['PENDING', 'PROCESSING', 'PAID', 'FAILED']} value={status} onChange={setStatus} /></div>
        <ErrorBox error={releases.error} onRetry={releases.reload} />
        <ErrorBox error={error} />
        {releases.data?.length === 0 && <Empty title="Không có khoản chi nào." />}
        {!!releases.data?.length && (
          <table className="table">
            <thead><tr><th>Lần chi</th><th>Hoạ sĩ</th><th className="num">Số tiền</th><th>Trạng thái</th><th>Mã giao dịch</th><th /></tr></thead>
            <tbody>{releases.data.map((r) => (
              <tr key={r.payoutId}>
                <td>#{r.payoutId}<div className="small muted">{when(r.createdAt)}</div></td>
                <td>#{r.artistId}</td><td className="num">{money(r.amount)}</td><td><Badge status={r.status} /></td><td>{r.transferReference ?? '—'}</td>
                <td>
                  {['PENDING', 'PROCESSING'].includes(r.status) && <button className="btn btn-primary btn-sm" onClick={() => setRecording(r)}>Ghi nhận</button>}
                  {r.status === 'FAILED' && <Action size="sm" variant="ghost" onError={setError} onClick={async () => { await admin.rerelease(r.proceedsId); releases.reload(); }}>Tạo lần chi mới</Action>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {recording && (
        <OutcomeModal title={`Chi ${money(recording.amount)} cho hoạ sĩ #${recording.artistId}`} statuses={recording.status === 'PENDING' ? ['PROCESSING', 'PAID', 'FAILED'] : ['PAID', 'FAILED']} referenceFor="PAID"
          onClose={() => setRecording(null)}
          onSubmit={async (s, ref, reason) => { await admin.recordRelease(recording.payoutId, s, ref, reason); setRecording(null); releases.reload(); recon.reload(); }} />
      )}
    </section>
  );
}

// ---------- Artists ----------
function ArtistsAdmin() {
  const list = useAsync(() => admin.artists());
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<(CustomerDTO & { status?: string }) | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [changing, setChanging] = useState<{ artist: ArtistDTO; action: 'deactivate' | 'reinstate' } | null>(null);

  return (
    <section className="stack">
      <div className="panel form">
        <h2 className="section-title">Cấp quyền hoạ sĩ</h2>
        <div className="toolbar">
          <input className="input" style={{ flex: "1 1 260px", width: "auto" }} type="email" placeholder="Email tài khoản khách" value={email} onChange={(e) => { setEmail(e.target.value); setFound(null); }} aria-label="Email khách hàng" />
          <Action variant="ghost" disabled={!email.trim()} onError={(err) => {
            setFound(null);
            setError(err instanceof ApiError && err.status === 404 ? new Error('Không có tài khoản nào dùng email này.') : err);
          }} onClick={async () => {
            setError(null);
            setResult(null);
            const customer = await admin.customerByEmail(email.trim());
            setFound(customer);
            setDisplayName(customer.displayName);
          }}>Tìm</Action>
        </div>
        {found && (
          <>
            <p className="small">Tài khoản #{found.userId}: <strong>{found.displayName}</strong>, {found.email}{found.status ? <> <Badge status={found.status} /></> : null}</p>
            <Field label="Tên hoạ sĩ"><input className="input" maxLength={160} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></Field>
            <Field label="Ghi chú"><input className="input" maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <Action disabled={!displayName.trim()} onError={setError} onClick={async () => {
              const artist = await admin.grantArtist(found.userId, displayName.trim(), reason.trim());
              setResult(`Đã cấp quyền hoạ sĩ cho ${found.email} (hoạ sĩ #${artist.artistId}).`);
              setFound(null);
              setEmail('');
              setReason('');
              list.reload();
            }}>Cấp quyền hoạ sĩ</Action>
          </>
        )}
        {result && <Notice kind="ok">{result}</Notice>}
        <ErrorBox error={error} />
      </div>

      <div>
        <h2 className="section-title">Hoạ sĩ</h2>
        {list.loading && !list.data && <Loading />}
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.data?.length === 0 && <Empty title="Chưa có hoạ sĩ nào." />}
        {!!list.data?.length && (
          <table className="table">
            <thead><tr><th>Hoạ sĩ</th><th>Trạng thái</th><th>Nhận vẽ</th><th>Từ</th><th /></tr></thead>
            <tbody>{list.data.map((a) => (
              <tr key={a.artistId}>
                <td><Link className="link-strong" to={`/artists/${a.artistId}`}>{a.displayName}</Link><div className="small muted">Hoạ sĩ #{a.artistId}, tài khoản #{a.userId}</div></td>
                <td><Badge status={a.status} /></td>
                <td>{a.acceptingCommissions ? `Có${a.startingPrice != null ? `, từ ${money(a.startingPrice)}` : ''}` : 'Không'}</td>
                <td>{when(a.createdAt)}</td>
                <td>{a.status === 'ACTIVE'
                  ? <button className="btn btn-ghost btn-sm" onClick={() => setChanging({ artist: a, action: 'deactivate' })}>Tạm ngưng</button>
                  : <button className="btn btn-ghost btn-sm" onClick={() => setChanging({ artist: a, action: 'reinstate' })}>Khôi phục</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {changing && <ArtistStatusModal {...changing} onClose={() => setChanging(null)} onDone={() => { setChanging(null); list.reload(); }} />}
    </section>
  );
}

function ArtistStatusModal({ artist, action, onClose, onDone }: { artist: ArtistDTO; action: 'deactivate' | 'reinstate'; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const deactivate = action === 'deactivate';
  return (
    <Modal title={`${deactivate ? 'Tạm ngưng' : 'Khôi phục'} hoạ sĩ ${artist.displayName}`} onClose={onClose}>
      {deactivate && <p className="muted small">Tranh của hoạ sĩ ngừng bán và họ không nhận đơn vẽ mới. Đơn cũ, tiền đang giữ và lịch sử giữ nguyên.</p>}
      <Field label="Lý do"><textarea className="input" rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <ErrorBox error={error} />
      <Action variant={deactivate ? 'danger' : 'primary'} disabled={!reason.trim()} onError={setError} onClick={async () => {
        if (deactivate) await admin.deactivateArtist(artist.artistId, reason.trim());
        else await admin.reinstateArtist(artist.artistId, reason.trim());
        onDone();
      }}>{deactivate ? 'Tạm ngưng' : 'Khôi phục'}</Action>
    </Modal>
  );
}

// ---------- Tags ----------
function TagsAdmin() {
  const { data, error, loading, reload } = useAsync(() => admin.tags());
  const [name, setName] = useState('');
  const [actionError, setActionError] = useState<unknown>(null);
  return (
    <section>
      <div className="toolbar">
        <input className="input" placeholder="Tên thẻ mới" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        <Action disabled={!name.trim()} onError={setActionError} onClick={async () => { await admin.createTag(name.trim()); setName(''); reload(); }}>Thêm thẻ</Action>
      </div>
      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />
      <ErrorBox error={actionError} />
      <table className="table">
        <thead><tr><th>Thẻ</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>{data?.map((t) => (
          <tr key={t.tagId}>
            <td>{t.name}</td>
            <td><Badge status={t.active ? 'ACTIVE' : 'ARCHIVED'} text={t.active ? 'Đang dùng' : 'Đã tắt'} /></td>
            <td className="row-gap">
              <Action size="sm" variant="ghost" onError={setActionError} onClick={async () => { await admin.updateTag(t.tagId, t.name, !t.active); reload(); }}>{t.active ? 'Tắt' : 'Bật'}</Action>
              <Action size="sm" variant="quiet" onError={setActionError} onClick={async () => { const next = window.prompt('Tên mới', t.name); if (next && next.trim()) { await admin.updateTag(t.tagId, next.trim(), t.active); reload(); } }}>Đổi tên</Action>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}

// ---------- Provinces ----------
function ProvincesAdmin() {
  const { data, error, loading, reload } = useAsync(() => provinces.all());
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [actionError, setActionError] = useState<unknown>(null);
  return (
    <section>
      <div className="toolbar">
        <input className="input input-num" placeholder="Mã (2 số)" pattern="\d{2}" maxLength={2} value={code} onChange={(e) => setCode(e.target.value)} />
        <input className="input" placeholder="Tên tỉnh/thành" maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
        <Action disabled={!/^\d{2}$/.test(code) || !name.trim()} onError={setActionError} onClick={async () => { await provinces.create(code, name.trim()); setCode(''); setName(''); reload(); }}>Thêm</Action>
      </div>
      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />
      <ErrorBox error={actionError} />
      <table className="table">
        <thead><tr><th>Mã</th><th>Tỉnh/thành</th><th>Giao hàng</th><th>Cập nhật</th><th /></tr></thead>
        <tbody>{data?.map((p) => (
          <tr key={p.provinceId}>
            <td>{p.provinceCode}</td><td>{p.provinceName}</td>
            <td><Badge status={p.supported ? 'ACTIVE' : 'ARCHIVED'} text={p.supported ? 'Có giao' : 'Chưa giao'} /></td>
            <td>{when(p.updatedAt)}</td>
            <td><Action size="sm" variant="ghost" onError={setActionError} onClick={async () => { await provinces.setSupport(p.provinceId, !p.supported, ''); reload(); }}>{p.supported ? 'Ngừng giao' : 'Bật giao hàng'}</Action></td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}
