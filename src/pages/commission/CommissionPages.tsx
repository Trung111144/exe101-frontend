import { useState } from 'react';
import { ApiError } from '../../api/client';
import { artists, commissions } from '../../api/endpoints';
import type {
  ArtistTermsDTO, CommissionDTO, CommissionQuoteDTO, CommissionDeliverableDTO, CancellationRequestDTO,
} from '../../api/types';
import {
  Action, Badge, DownloadButton, Empty, ErrorBox, Field, FilePicker, Loading, Modal, Notice, PageHead, useAsync,
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { bytes, label, money, when } from '../../lib/format';
import { payQuote } from '../../lib/payment';
import { Link } from '../../lib/router';
import { TermsView } from './TermsView';

export function CommissionsPage() {
  const { me } = useAuth();
  const { data, error, loading, reload } = useAsync(() => commissions.list());
  if (loading && !data) return <Loading />;
  return (
    <div>
      <PageHead title="Đơn vẽ theo yêu cầu" sub="Gồm đơn bạn đặt và đơn khách gửi cho bạn (nếu bạn là hoạ sĩ)." />
      <ErrorBox error={error} onRetry={reload} />
      {data?.length === 0 && <Empty title="Chưa có đơn vẽ nào.">Mở trang của một hoạ sĩ để gửi yêu cầu.</Empty>}
      {!!data?.length && (
        <table className="table">
          <thead><tr><th>Đơn</th><th>Vai trò</th><th>Với</th><th>Ngày tạo</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {data.map((c) => {
              const mine = c.customerId === me?.userId;
              return (
                <tr key={c.commissionId}>
                  <td><Link className="link-strong" to={`/commissions/${c.commissionId}`}>#{c.commissionId}</Link></td>
                  <td>{mine ? 'Tôi đặt' : 'Khách đặt cho tôi'}</td>
                  <td>{mine ? c.artistNameSnapshot : c.customerNameSnapshot}</td>
                  <td>{when(c.createdAt)}</td>
                  <td><Badge status={c.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function CommissionDetailPage({ commissionId }: { commissionId: number }) {
  const { me } = useAuth();
  const id = commissionId;
  const state = useAsync(async () => {
    const commission = await commissions.get(id);
    const settle = <X,>(promise: Promise<X>) => promise.then((value) => value, () => null);
    const [messages, quotes, deliverables, cancellations, disputes, refunds] = await Promise.all([
      settle(commissions.messages(id)), settle(commissions.quotes(id)), settle(commissions.deliverables(id)),
      settle(commissions.cancellations(id)), settle(commissions.disputes(id)), settle(commissions.refunds(id)),
    ]);
    return { commission, messages, quotes, deliverables, cancellations, disputes, refunds };
  }, [id]);

  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (!state.data || !me) return null;
  const { commission, messages, quotes, deliverables, cancellations, disputes, refunds } = state.data;
  const isCustomer = commission.customerId === me.userId;
  const isArtist = !isCustomer;
  const closed = ['COMPLETED', 'DECLINED', 'CANCELLED'].includes(commission.status);
  const reload = state.reload;
  const nameOf = (userId: number) => (userId === me.userId ? 'Bạn' : isCustomer ? commission.artistNameSnapshot : commission.customerNameSnapshot);

  return (
    <div>
      <PageHead
        title={`Đơn vẽ #${commission.commissionId}`}
        sub={<>{isCustomer ? `Hoạ sĩ ${commission.artistNameSnapshot}` : `Khách ${commission.customerNameSnapshot}`}, tạo {when(commission.createdAt)} <Badge status={commission.status} /></>}
      />
      <NextStep commission={commission} isCustomer={isCustomer} quotes={quotes ?? []} />

      <div className="commission-layout">
        <div className="stack">
          <section className="panel">
            <h2 className="section-title">Yêu cầu</h2>
            <p className="prose pre">{commission.requestDescription}</p>
            <p className="small muted">{commission.allowPublicDisplay ? 'Khách cho phép đăng công khai tác phẩm hoàn thiện.' : 'Khách không cho phép đăng công khai.'}</p>
            <Attachments commission={commission} closed={closed} onChange={reload} />
          </section>

          <QuotesSection commission={commission} quotes={quotes ?? []} isCustomer={isCustomer} isArtist={isArtist} closed={closed} onChange={reload} />
          <DeliverablesSection commission={commission} deliverables={deliverables ?? []} isCustomer={isCustomer} isArtist={isArtist} onChange={reload} />
          <CancellationSection commission={commission} requests={cancellations ?? []} me={me.userId} isArtist={isArtist} closed={closed} quotes={quotes ?? []} onChange={reload} nameOf={nameOf} />

          <section className="panel">
            <h2 className="section-title">Tranh chấp và hoàn tiền</h2>
            {disputes?.length ? disputes.map((d) => (
              <div key={d.disputeId} className="item">
                <div className="row-between"><span className="cell-strong">Tranh chấp #{d.disputeId} do {nameOf(d.openedByUserId)} mở</span><Badge status={d.status} /></div>
                <p className="pre">{d.reason}</p>
                {d.outcome && <p className="small">Kết quả: {label(d.outcome)}. {d.resolutionReason}</p>}
              </div>
            )) : <p className="muted small">Chưa có tranh chấp.</p>}
            {refunds?.map((r) => (
              <div key={r.refundRequestId} className="item">
                <div className="row-between"><span>Hoàn tiền {r.refundPercent ?? 0}%</span><Badge status={r.status} /></div>
                {r.transfer && <div className="small">{money(r.transfer.amount)} <Badge status={r.transfer.status} /></div>}
              </div>
            ))}
            {!closed && commission.status !== 'DISPUTED' && <OpenDispute id={commission.commissionId} onDone={reload} />}
          </section>
        </div>

        <Thread commission={commission} messages={messages ?? []} closed={closed} meId={me.userId} nameOf={nameOf} onSent={reload} />
      </div>
    </div>
  );
}

function NextStep({ commission, isCustomer, quotes }: { commission: CommissionDTO; isCustomer: boolean; quotes: CommissionQuoteDTO[] }) {
  const offered = quotes.find((q) => q.status === 'OFFERED');
  const text: Record<string, [string, string]> = {
    REQUESTED: ['Chờ hoạ sĩ gửi báo giá.', 'Đọc yêu cầu rồi gửi báo giá, hoặc từ chối đơn.'],
    QUOTED: [offered ? 'Hoạ sĩ đã gửi báo giá. Hãy chấp nhận hoặc từ chối.' : 'Chờ hoạ sĩ gửi báo giá mới.', 'Chờ khách phản hồi báo giá.'],
    AWAITING_PAYMENT: ['Đến lượt bạn thanh toán.', 'Chờ khách thanh toán.'],
    IN_PROGRESS: ['Hoạ sĩ đang vẽ.', 'Khi xong, gửi bản giao để khách duyệt.'],
    SUBMITTED_FOR_REVIEW: ['Hoạ sĩ đã gửi bản giao. Hãy duyệt hoặc yêu cầu chỉnh sửa.', 'Chờ khách duyệt bản giao.'],
    REVISION_REQUESTED: ['Chờ hoạ sĩ chỉnh sửa.', 'Khách yêu cầu chỉnh sửa. Gửi phiên bản mới.'],
    DISPUTED: ['Quản trị viên đang xem xét tranh chấp.', 'Quản trị viên đang xem xét tranh chấp.'],
  };
  const pair = text[commission.status];
  if (!pair) return null;
  return <Notice kind={commission.status === 'DISPUTED' ? 'warn' : 'info'}>{isCustomer ? pair[0] : pair[1]}</Notice>;
}

function Attachments({ commission, closed, onChange }: { commission: CommissionDTO; closed: boolean; onChange: () => void }) {
  const [error, setError] = useState<unknown>(null);
  return (
    <div>
      {commission.attachments.length > 0 && (
        <ul className="file-list">
          {commission.attachments.map((a) => (
            <li key={a.attachmentId}>
              <span>{a.originalName} <span className="muted small">({bytes(a.byteLength)})</span></span>
              <DownloadButton path={commissions.attachmentPath(commission.commissionId, a.attachmentId)} name={a.originalName} />
            </li>
          ))}
        </ul>
      )}
      {!closed && (
        <FilePicker accept=".png,.jpg,.jpeg,.webp,.pdf,.psd,.zip" text="Thêm tệp tham khảo" onPick={async (files) => {
          setError(null);
          try {
            for (const file of files) await commissions.attach(commission.commissionId, file);
            onChange();
          } catch (err) {
            setError(err);
          }
        }} />
      )}
      <ErrorBox error={error} />
    </div>
  );
}

function QuotesSection({ commission, quotes, isCustomer, isArtist, closed, onChange }: {
  commission: CommissionDTO; quotes: CommissionQuoteDTO[]; isCustomer: boolean; isArtist: boolean; closed: boolean; onChange: () => void;
}) {
  const id = commission.commissionId;
  const [accepting, setAccepting] = useState<CommissionQuoteDTO | null>(null);
  const [viewTerms, setViewTerms] = useState<ArtistTermsDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const hasOffered = quotes.some((q) => q.status === 'OFFERED');
  const canOffer = isArtist && !hasOffered && ['REQUESTED', 'QUOTED'].includes(commission.status);
  const payable = quotes.find((q) => q.status === 'ACCEPTED');

  return (
    <section className="panel">
      <h2 className="section-title">Báo giá</h2>
      <ErrorBox error={error} />
      {quotes.length === 0 && <p className="muted small">Chưa có báo giá.</p>}
      {[...quotes].sort((a, b) => b.sequenceNo - a.sequenceNo).map((q) => (
        <div key={q.quoteId} className="item quote">
          <div className="row-between">
            <span className="cell-strong">Báo giá lần {q.sequenceNo}: {money(q.totalAmount)}</span>
            <Badge status={q.status} />
          </div>
          <p className="pre">{q.scopeText}</p>
          <p className="small">Thời hạn hoàn thành: {q.expectedCompletionTerms}</p>
          <dl className="totals totals-inline">
            <dt>Giá</dt><dd>{money(q.price)}</dd>
            <dt>Thuế</dt><dd>{money(q.taxAmount)}</dd>
            <dt>Đợt 1 (trước khi vẽ)</dt><dd>{money(q.firstPaymentAmount)}</dd>
            <dt>Đợt 2 (sau khi duyệt)</dt><dd>{money(q.finalPaymentAmount)}</dd>
          </dl>
          <div className="row-gap">
            {isCustomer && q.status === 'OFFERED' && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => setAccepting(q)}>Đọc điều khoản và chấp nhận</button>
                <Action variant="ghost" size="sm" onError={setError} confirm="Từ chối báo giá này?" onClick={async () => { await commissions.declineQuote(id, q.quoteId); onChange(); }}>Từ chối</Action>
              </>
            )}
            {isArtist && q.status === 'OFFERED' && (
              <Action variant="ghost" size="sm" onError={setError} confirm="Rút báo giá này?" onClick={async () => { await commissions.withdrawQuote(id, q.quoteId); onChange(); }}>Rút báo giá</Action>
            )}
            {q.artistTermsId && (
              <Action variant="quiet" size="sm" onError={setError} onClick={async () => setViewTerms(await commissions.quoteTerms(id, q.quoteId))}>Điều khoản đã đồng ý</Action>
            )}
          </div>
        </div>
      ))}

      {isCustomer && payable && commission.status === 'AWAITING_PAYMENT' && (
        <div className="pay-box">
          <span>Thanh toán đợt tiếp theo cho báo giá lần {payable.sequenceNo}.</span>
          <Action onError={setError} onClick={() => payQuote(id, payable.quoteId)}>Thanh toán qua VNPay</Action>
        </div>
      )}

      {canOffer && <OfferQuote id={id} onDone={onChange} />}
      {isArtist && commission.status === 'REQUESTED' && (
        <Action variant="quiet" size="sm" onError={setError} confirm="Từ chối nhận đơn vẽ này?" onClick={async () => { await commissions.declineRequest(id); onChange(); }}>Từ chối nhận đơn</Action>
      )}

      {accepting && <AcceptQuote commission={commission} quote={accepting} onClose={() => setAccepting(null)} onDone={() => { setAccepting(null); onChange(); }} />}
      {viewTerms && <Modal title="Điều khoản đã đồng ý" onClose={() => setViewTerms(null)} wide><TermsView terms={viewTerms} /></Modal>}
    </section>
  );
}

function OfferQuote({ id, onDone }: { id: number; onDone: () => void }) {
  const [price, setPrice] = useState('');
  const [scope, setScope] = useState('');
  const [terms, setTerms] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <details className="sub-form">
      <summary>Gửi báo giá</summary>
      <div className="form">
        <Field label="Giá (VND, chưa thuế)"><input className="input" type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="Phạm vi công việc"><textarea className="input" rows={4} maxLength={5000} value={scope} onChange={(e) => setScope(e.target.value)} /></Field>
        <Field label="Thời hạn hoàn thành" hint="Ví dụ: 10 ngày làm việc sau khi nhận thanh toán đợt 1"><input className="input" maxLength={1000} value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
        <ErrorBox error={error} />
        <Action disabled={!price || !scope.trim() || !terms.trim()} onError={(err) => setError(
          err instanceof ApiError && err.code === 'ARTIST_TERMS_REQUIRED' ? new Error('Bạn cần đăng điều khoản nhận vẽ trong Xưởng trước khi báo giá.') : err)}
          onClick={async () => { await commissions.offerQuote(id, Number(price), scope.trim(), terms.trim()); onDone(); }}>
          Gửi báo giá
        </Action>
      </div>
    </details>
  );
}

function AcceptQuote({ commission, quote, onClose, onDone }: { commission: CommissionDTO; quote: CommissionQuoteDTO; onClose: () => void; onDone: () => void }) {
  const terms = useAsync(() => artists.terms(commission.artistId), [commission.artistId]);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <Modal title={`Chấp nhận báo giá ${money(quote.totalAmount)}`} onClose={onClose} wide>
      {terms.loading && <Loading />}
      <ErrorBox error={terms.error} onRetry={terms.reload} />
      {terms.data && <TermsView terms={terms.data} />}
      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        Tôi đã đọc và đồng ý điều khoản trên
      </label>
      <ErrorBox error={error} />
      <Action disabled={!agreed || !terms.data} onError={(err) => {
        setError(err);
        if (err instanceof ApiError && err.code === 'ARTIST_TERMS_OUTDATED') terms.reload();
      }} onClick={async () => { await commissions.acceptQuote(commission.commissionId, quote.quoteId, terms.data!.artistTermsId); onDone(); }}>
        Chấp nhận báo giá
      </Action>
    </Modal>
  );
}

function DeliverablesSection({ commission, deliverables, isCustomer, isArtist, onChange }: {
  commission: CommissionDTO; deliverables: CommissionDeliverableDTO[]; isCustomer: boolean; isArtist: boolean; onChange: () => void;
}) {
  const id = commission.commissionId;
  const sorted = [...deliverables].sort((a, b) => b.versionNo - a.versionNo);
  const latest = sorted[0];
  const [revising, setRevising] = useState(false);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<unknown>(null);
  const canSubmit = isArtist && ['IN_PROGRESS', 'REVISION_REQUESTED'].includes(commission.status);

  if (!deliverables.length && !canSubmit) {
    // Delivery opens only after the first payment; say what has to happen first instead of hiding the section.
    const waiting = ['REQUESTED', 'QUOTED', 'AWAITING_PAYMENT'].includes(commission.status);
    if (!waiting) return null;
    return (
      <section className="panel">
        <h2 className="section-title">Bản giao</h2>
        <p className="muted small">
          {isArtist
            ? 'Bạn gửi được bản giao sau khi khách chấp nhận báo giá và thanh toán đợt 1.'
            : 'Hoạ sĩ sẽ gửi bản giao sau khi bạn chấp nhận báo giá và thanh toán đợt 1.'}
        </p>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2 className="section-title">Bản giao</h2>
      <ErrorBox error={error} />
      {isCustomer && commission.status !== 'COMPLETED' && deliverables.length > 0 && (
        <p className="small muted">Bạn tải được tệp sau khi thanh toán đợt cuối.</p>
      )}
      {sorted.map((d) => (
        <div key={d.deliverableId} className="item">
          <div className="row-between"><span className="cell-strong">Phiên bản {d.versionNo}</span><span className="small muted">{when(d.submittedAt)}</span></div>
          {d.notes && <p className="pre">{d.notes}</p>}
          <ul className="file-list">
            {d.files.map((f) => (
              <li key={f.fileId}>
                <span>{f.originalName} <span className="muted small">({bytes(f.byteLength)})</span></span>
                <DownloadButton path={commissions.deliverableFilePath(id, d.deliverableId, f.fileId)} name={f.originalName} />
              </li>
            ))}
          </ul>
          {d.revisionRequests.map((r) => <p key={r.revisionId} className="small revision">Yêu cầu chỉnh sửa ({when(r.requestedAt)}): {r.details}</p>)}
        </div>
      ))}

      {isCustomer && latest && commission.status === 'SUBMITTED_FOR_REVIEW' && (
        <div className="row-gap">
          <Action onError={setError} confirm="Duyệt phiên bản này? Sau đó bạn thanh toán đợt cuối để nhận tệp." onClick={async () => { await commissions.approve(id, latest.deliverableId); onChange(); }}>Duyệt phiên bản {latest.versionNo}</Action>
          <button className="btn btn-ghost" onClick={() => setRevising(true)}>Yêu cầu chỉnh sửa</button>
        </div>
      )}
      {revising && latest && (
        <Modal title="Yêu cầu chỉnh sửa" onClose={() => setRevising(false)}>
          <Field label="Cần sửa gì?"><textarea className="input" rows={5} maxLength={5000} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
          <ErrorBox error={error} />
          <Action disabled={!details.trim()} onError={setError} onClick={async () => { await commissions.requestRevision(id, latest.deliverableId, details.trim()); setRevising(false); setDetails(''); onChange(); }}>Gửi yêu cầu</Action>
        </Modal>
      )}
      {canSubmit && <SubmitDeliverable id={id} onDone={onChange} />}
    </section>
  );
}

function SubmitDeliverable({ id, onDone }: { id: number; onDone: () => void }) {
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<unknown>(null);
  return (
    <details className="sub-form" open>
      <summary>Gửi phiên bản mới</summary>
      <div className="form">
        <Field label="Ghi chú cho khách"><textarea className="input" rows={3} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="file-row"><FilePicker multiple onPick={(picked) => setFiles([...files, ...picked])} text="Chọn tệp giao" /></div>
        {files.length > 0 && <ul className="file-list">{files.map((f, i) => <li key={i}>{f.name} ({bytes(f.size)})</li>)}</ul>}
        <ErrorBox error={error} />
        <Action disabled={!files.length} onError={setError} onClick={async () => { await commissions.submitDeliverable(id, notes.trim(), files); setFiles([]); setNotes(''); onDone(); }}>Gửi bản giao</Action>
      </div>
    </details>
  );
}

function CancellationSection({ commission, requests, me, isArtist, closed, quotes, onChange, nameOf }: {
  commission: CommissionDTO; requests: CancellationRequestDTO[]; me: number; isArtist: boolean; closed: boolean;
  quotes: CommissionQuoteDTO[]; onChange: () => void; nameOf: (userId: number) => string;
}) {
  const id = commission.commissionId;
  const [error, setError] = useState<unknown>(null);
  const [mode, setMode] = useState<'none' | 'cancel' | 'request'>('none');
  const [reason, setReason] = useState('');
  const [percent, setPercent] = useState('100');
  const [offer, setOffer] = useState('100');
  const [note, setNote] = useState('');
  const pending = requests.find((r) => r.status === 'PENDING');
  // Before the first payment either side can cancel at once; after it a request the other side accepts is needed.
  const paid = quotes.some((q) => q.paidAt) || ['IN_PROGRESS', 'SUBMITTED_FOR_REVIEW', 'REVISION_REQUESTED'].includes(commission.status);

  return (
    <section className="panel">
      <h2 className="section-title">Huỷ đơn</h2>
      <ErrorBox error={error} />
      {requests.map((r) => (
        <div key={r.cancellationId} className="item">
          <div className="row-between"><span className="cell-strong">{nameOf(r.requestedByUserId)} đề nghị huỷ</span><Badge status={r.status} /></div>
          <p className="pre">{r.reason}</p>
          {r.refundPercent !== null && <p className="small">Hoạ sĩ đề nghị hoàn {r.refundPercent}% khoản đã thanh toán đợt 1.</p>}
          {r.status === 'PENDING' && (
            <div className="row-gap">
              {r.requestedByUserId === me ? (
                <Action variant="ghost" size="sm" onError={setError} onClick={async () => { await commissions.withdrawCancellation(id, r.cancellationId); onChange(); }}>Rút đề nghị</Action>
              ) : (
                <>
                  {isArtist && r.refundPercent === null && (
                    <span className="inline-form">
                      <input className="input input-qty" type="number" min={0} max={100} value={offer} onChange={(e) => setOffer(e.target.value)} aria-label="Phần trăm hoàn" />%
                      <Action size="sm" onError={setError} onClick={async () => { await commissions.offerRefund(id, r.cancellationId, Number(offer)); onChange(); }}>Đề nghị mức hoàn</Action>
                    </span>
                  )}
                  <input className="input" placeholder="Ghi chú (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <Action size="sm" onError={setError} confirm="Đồng ý huỷ đơn?" onClick={async () => { await commissions.acceptCancellation(id, r.cancellationId, note); onChange(); }}>Đồng ý huỷ</Action>
                  <Action variant="ghost" size="sm" onError={setError} onClick={async () => { await commissions.rejectCancellation(id, r.cancellationId, note); onChange(); }}>Không đồng ý</Action>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {!closed && !pending && commission.status !== 'DISPUTED' && mode === 'none' && (
        <button className="btn btn-quiet btn-sm" onClick={() => setMode(paid ? 'request' : 'cancel')}>{paid ? 'Đề nghị huỷ đơn' : 'Huỷ đơn'}</button>
      )}
      {mode !== 'none' && (
        <div className="form">
          <Field label="Lý do huỷ"><textarea className="input" rows={3} maxLength={5000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          {mode === 'request' && isArtist && (
            <Field label="Hoàn cho khách (% khoản đợt 1)"><input className="input input-qty" type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} /></Field>
          )}
          <div className="row-gap">
            <Action variant="danger" disabled={!reason.trim()} onError={(err) => {
              if (err instanceof ApiError && err.code === 'CANCELLATION_REQUEST_REQUIRED') setMode('request');
              setError(err);
            }} onClick={async () => {
              if (mode === 'cancel') await commissions.cancel(id, reason.trim());
              else await commissions.requestCancellation(id, reason.trim(), isArtist ? Number(percent) : null);
              setMode('none');
              setReason('');
              onChange();
            }}>{mode === 'cancel' ? 'Huỷ đơn ngay' : 'Gửi đề nghị huỷ'}</Action>
            <button className="btn btn-quiet" onClick={() => setMode('none')}>Thôi</button>
          </div>
        </div>
      )}
    </section>
  );
}

function OpenDispute({ id, onDone }: { id: number; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <details className="sub-form">
      <summary>Mở tranh chấp</summary>
      <div className="form">
        <p className="small muted">Đơn sẽ tạm dừng cho tới khi quản trị viên quyết định.</p>
        <Field label="Vấn đề là gì?"><textarea className="input" rows={4} maxLength={5000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <ErrorBox error={error} />
        <Action variant="danger" disabled={!reason.trim()} onError={setError} onClick={async () => { await commissions.openDispute(id, reason.trim()); onDone(); }}>Mở tranh chấp</Action>
      </div>
    </details>
  );
}

function Thread({ commission, messages, closed, meId, nameOf, onSent }: {
  commission: CommissionDTO; messages: { messageId: number; senderUserId: number; body: string; sentAt: string }[];
  closed: boolean; meId: number; nameOf: (userId: number) => string; onSent: () => void;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <aside className="panel thread">
      <h2 className="section-title">Trao đổi</h2>
      <div className="messages">
        {messages.length === 0 && <p className="muted small">Chưa có tin nhắn.</p>}
        {messages.map((m) => (
          <div key={m.messageId} className={`message ${m.senderUserId === meId ? 'message-me' : ''}`}>
            <div className="message-meta">{nameOf(m.senderUserId)}, {when(m.sentAt)}</div>
            <div className="pre">{m.body}</div>
          </div>
        ))}
      </div>
      {closed ? <p className="muted small">Đơn đã đóng, chỉ xem lại được tin nhắn.</p> : (
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <textarea className="input" rows={3} maxLength={5000} placeholder="Nhắn cho đối phương" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Tin nhắn" />
          <ErrorBox error={error} />
          <Action disabled={!body.trim()} onError={setError} onClick={async () => { await commissions.send(commission.commissionId, body.trim()); setBody(''); onSent(); }}>Gửi</Action>
        </form>
      )}
    </aside>
  );
}
