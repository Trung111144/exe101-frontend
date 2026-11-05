import { useState } from 'react';
import { ApiError, downloadFile } from '../../api/client';
import { artists, studio } from '../../api/endpoints';
import type { ArtistTermsDTO, ArtworkDTO } from '../../api/types';
import {
  Action, Badge, Empty, ErrorBox, Field, FilePicker, Loading, MB, Modal, Notice, PageHead, ProtectedImage, Tabs, useAsync,
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { bytes, label, money, when } from '../../lib/format';
import { Link, navigate } from '../../lib/router';
import { TermsView } from '../commission/TermsView';


export function StudioNav({ current }: { current: 'artworks' | 'settings' | 'proceeds' }) {
  return (
    <nav className="subnav">
      <Link to="/studio" className={current === 'artworks' ? 'on' : ''}>Tranh của tôi</Link>
      <Link to="/studio/settings" className={current === 'settings' ? 'on' : ''}>Nhận vẽ và điều khoản</Link>
      <Link to="/studio/proceeds" className={current === 'proceeds' ? 'on' : ''}>Doanh thu</Link>
      <Link to="/commissions">Đơn vẽ</Link>
    </nav>
  );
}

export function StudioHome() {
  const { artist } = useAuth();
  const { data, error, loading, reload } = useAsync(() => studio.artworks());
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHead title="Xưởng của hoạ sĩ" sub={artist ? <>{artist.displayName} <Badge status={artist.status} /></> : undefined} actions={<button className="btn btn-primary" onClick={() => setCreating(true)}>Thêm tranh</button>} />
      <StudioNav current="artworks" />
      {artist && artist.status !== 'ACTIVE' && <Notice kind="warn">Hồ sơ hoạ sĩ đang tạm ngưng: tranh của bạn không bán được và bạn không nhận đơn vẽ mới.</Notice>}
      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />
      {data?.length === 0 && <Empty title="Bạn chưa có tranh nào.">Thêm tranh, tải ảnh xem trước, tạo phiên bản bán rồi đăng lên.</Empty>}
      {!!data?.length && (
        <table className="table">
          <thead><tr><th /><th>Tranh</th><th>Loại</th><th>Trạng thái</th><th>Khách mua được</th><th>Tạo lúc</th></tr></thead>
          <tbody>
            {data.map((artwork) => {
              const preview = [...artwork.previews].sort((a, b) => a.sortOrder - b.sortOrder)[0];
              return (
                <tr key={artwork.artworkId}>
                  <td className="thumb-cell">{preview && <ProtectedImage path={studio.previewPath(artwork.artworkId, preview.mediaId)} alt="" className="thumb-img" />}</td>
                  <td><Link className="link-strong" to={`/studio/artworks/${artwork.artworkId}`}>{artwork.title}</Link></td>
                  <td>{artwork.dimension}</td>
                  <td><Badge status={artwork.status} /></td>
                  <td>{artwork.purchasable ? 'Có' : <Link to={`/studio/artworks/${artwork.artworkId}`} className="text-bad">Chưa, xem cần làm gì</Link>}</td>
                  <td>{when(artwork.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {creating && <ArtworkForm onClose={() => setCreating(false)} onSaved={(artwork) => navigate(`/studio/artworks/${artwork.artworkId}`)} />}
    </div>
  );
}

function ArtworkForm({ artwork, onClose, onSaved }: { artwork?: ArtworkDTO; onClose: () => void; onSaved: (a: ArtworkDTO) => void }) {
  const tags = useAsync(() => studio.activeTags());
  const [title, setTitle] = useState(artwork?.title ?? '');
  const [description, setDescription] = useState(artwork?.description ?? '');
  const [dimension, setDimension] = useState<string>(artwork?.dimension ?? '2D');
  const [tagIds, setTagIds] = useState<number[]>(artwork?.tags.map((t) => t.tagId) ?? []);
  const [error, setError] = useState<unknown>(null);
  return (
    <Modal title={artwork ? 'Sửa thông tin tranh' : 'Thêm tranh'} onClose={onClose}>
      <div className="form">
        <Field label="Tên tranh"><input className="input" maxLength={240} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Mô tả"><textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Loại" hint="Không đổi được sau lần đăng đầu tiên.">
          <select className="input" value={dimension} onChange={(e) => setDimension(e.target.value)}><option value="2D">2D</option><option value="3D">3D</option></select>
        </Field>
        <div className="field">
          <span className="field-label">Thẻ</span>
          <ErrorBox error={tags.error} />
          <div className="chips">
            {tags.data?.map((t) => (
              <label key={t.tagId} className={`chip chip-toggle ${tagIds.includes(t.tagId) ? 'chip-on' : ''}`}>
                <input type="checkbox" checked={tagIds.includes(t.tagId)} onChange={(e) => setTagIds(e.target.checked ? [...tagIds, t.tagId] : tagIds.filter((x) => x !== t.tagId))} />
                {t.name}
              </label>
            ))}
            {tags.data?.length === 0 && <span className="muted small">Quản trị viên chưa tạo thẻ.</span>}
          </div>
        </div>
        <ErrorBox error={error} />
        <Action disabled={!title.trim()} onError={setError} onClick={async () => {
          const input = { title: title.trim(), description, dimension, tagIds };
          const saved = artwork ? await studio.updateArtwork(artwork.artworkId, { ...input, version: artwork.version }) : await studio.createArtwork(input);
          onSaved(saved);
        }}>{artwork ? 'Lưu' : 'Tạo tranh'}</Action>
      </div>
    </Modal>
  );
}

const artistTransitions: Record<string, [string, string][]> = {
  DRAFT: [['PUBLISHED', 'Đăng bán'], ['ARCHIVED', 'Lưu trữ']],
  PUBLISHED: [['UNLISTED', 'Ẩn khỏi danh mục'], ['ARCHIVED', 'Lưu trữ']],
  UNLISTED: [['PUBLISHED', 'Đăng lại'], ['ARCHIVED', 'Lưu trữ']],
};

export function StudioArtwork({ artworkId }: { artworkId: number }) {
  const state = useAsync(async () => {
    const [artwork, listings, products] = await Promise.all([studio.artwork(artworkId), studio.listings(artworkId), studio.products()]);
    return { artwork, listings, products };
  }, [artworkId]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<'previews' | 'listings'>('previews');

  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  const { artwork, listings, products } = state.data;
  const previews = [...artwork.previews].sort((a, b) => a.sortOrder - b.sortOrder);
  const editable = !['MODERATED', 'ARCHIVED'].includes(artwork.status);

  return (
    <div>
      <PageHead title={artwork.title} sub={<><Badge status={artwork.status} /> Tranh {artwork.dimension}{artwork.publishedAt ? `, đăng ${when(artwork.publishedAt)}` : ''}</>}
        actions={<>
          {editable && <button className="btn btn-ghost" onClick={() => setEditing(true)}>Sửa thông tin</button>}
          {(artistTransitions[artwork.status] ?? []).map(([status, base]) => [status, status === 'PUBLISHED' ? (artwork.status === 'DRAFT' ? 'Đăng tranh' : 'Đăng lại tranh') : base]).map(([status, text]) => (
            <Action key={status} variant={status === 'PUBLISHED' ? 'primary' : 'ghost'} onError={setError}
              confirm={status === 'ARCHIVED' ? 'Lưu trữ thì không sửa hay đăng lại được nữa. Tiếp tục?' : undefined}
              onClick={async () => { await studio.setArtworkStatus(artwork.artworkId, status); state.reload(); }}>{text}</Action>
          ))}
          {artwork.status === 'PUBLISHED' && <Link className="btn btn-quiet" to={`/artworks/${artwork.artworkId}`}>Xem trang bán</Link>}
        </>} />
      <StudioNav current="artworks" />
      <ErrorBox error={error} />
      {artwork.status === 'MODERATED' && <Notice kind="warn">Tranh bị quản trị viên kiểm duyệt nên không sửa được.</Notice>}
      <SaleHint artwork={artwork} listings={listings} onOpenListings={() => setTab('listings')} />
      {artwork.description && <p className="prose pre">{artwork.description}</p>}

      <Tabs tabs={[['previews', `Ảnh xem trước (${previews.length})`], ['listings', `Phiên bản bán (${listings.length})`]]} value={tab} onChange={setTab} />

      {tab === 'previews' && (
        <section>
          <p className="muted small">Ảnh JPEG, PNG hoặc WebP, tối đa 10 MB. Ảnh đầu tiên là ảnh bìa. Tranh đăng bán cần ít nhất một ảnh.</p>
          <div className="preview-grid">
            {previews.map((p, index) => (
              <figure key={p.mediaId} className="preview-card">
                <ProtectedImage path={studio.previewPath(artwork.artworkId, p.mediaId)} alt={`Ảnh ${index + 1}`} />
                {editable && (
                  <figcaption className="row-gap">
                    <Action variant="quiet" size="sm" disabled={index === 0} onError={setError} onClick={async () => { await studio.movePreview(artwork.artworkId, p.mediaId, previews[index - 1].sortOrder); state.reload(); }}>Lên trước</Action>
                    <Action variant="quiet" size="sm" onError={setError} confirm="Xoá ảnh này?" onClick={async () => { await studio.removePreview(artwork.artworkId, p.mediaId); state.reload(); }}>Xoá</Action>
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
          {editable && <FilePicker multiple accept="image/jpeg,image/png,image/webp" text="Tải ảnh lên" maxBytes={10 * MB} onPick={async (files) => {
            setError(null);
            try { for (const f of files) await studio.addPreview(artwork.artworkId, f); } catch (err) { setError(err); }
            state.reload();
          }} />}
        </section>
      )}

      {tab === 'listings' && <ListingsPanel artwork={artwork} listings={listings} products={products} onChange={state.reload} />}

      {editing && <ArtworkForm artwork={artwork} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); state.reload(); }} />}
    </div>
  );
}

// Why the Artwork is not for sale yet, in the order the backend requires: the Artwork is published first, then a
// Listing with at least one file is published (and not waiting for a manufacturing-cost review).
function SaleHint({ artwork, listings, onOpenListings }: {
  artwork: ArtworkDTO; listings: Awaited<ReturnType<typeof studio.listings>>; onOpenListings: () => void;
}) {
  if (artwork.purchasable || ['MODERATED', 'ARCHIVED'].includes(artwork.status)) return null;
  let text: string;
  if (artwork.status !== 'PUBLISHED') {
    text = 'Tranh chưa mở bán. Bước 1: bấm "Đăng tranh" ở trên. Bước 2: ở tab "Phiên bản bán", thêm ít nhất 1 tệp cho một phiên bản rồi bấm "Đăng bán" trên phiên bản đó.';
  } else if (listings.length === 0) {
    text = 'Tranh đã đăng nhưng chưa có phiên bản bán nào. Thêm một bản số hoặc bản in, tải ít nhất 1 tệp rồi bấm "Đăng bán".';
  } else if (listings.some((l) => l.status === 'PUBLISHED' && l.costReviewRequired)) {
    text = 'Chi phí in đã thay đổi. Xác nhận phần lời ở phiên bản bản in để tiếp tục bán.';
  } else if (!listings.some((l) => l.status === 'PUBLISHED')) {
    const noFile = listings.some((l) => l.assets.length === 0 && !['ARCHIVED', 'MODERATED'].includes(l.status));
    text = `Tranh đã đăng nhưng khách chưa mua được vì chưa có phiên bản nào được đăng bán.${noFile ? ' Phiên bản cần ít nhất 1 tệp trước khi đăng.' : ''} Mở tab "Phiên bản bán" và bấm "Đăng bán".`;
  } else {
    text = 'Tranh chưa mở bán vì hồ sơ hoạ sĩ đang tạm ngưng.';
  }
  return (
    <div className="alert alert-warn">
      <span>{text}</span>
      {artwork.status === 'PUBLISHED' && <button className="btn btn-ghost btn-sm" onClick={onOpenListings}>Mở phiên bản bán</button>}
    </div>
  );
}

function ListingsPanel({ artwork, listings, products, onChange }: {
  artwork: ArtworkDTO; listings: Awaited<ReturnType<typeof studio.listings>>; products: Awaited<ReturnType<typeof studio.products>>; onChange: () => void;
}) {
  const [form, setForm] = useState<null | { listing?: (typeof listings)[number] }>(null);
  const [error, setError] = useState<unknown>(null);
  return (
    <section>
      <p className="muted small">Bản số: bạn đặt giá, khách tải tệp sau khi thanh toán. Bản in: giá = chi phí in + phần lời của bạn.</p>
      <ErrorBox error={error} />
      <div className="stack">
        {listings.map((l) => {
          const editable = !['MODERATED', 'ARCHIVED'].includes(l.status);
          return (
            <div key={l.listingId} className="panel">
              <div className="row-between">
                <div>
                  <div className="cell-strong">{l.name} <span className="muted">({label(l.listingType)})</span></div>
                  <div className="small muted">{l.specifications}</div>
                </div>
                <div className="right"><div className="cell-strong">{money(l.price)}</div><Badge status={l.status} /></div>
              </div>
              {l.listingType === 'PHYSICAL' && <p className="small">Chi phí in {money(l.manufacturingCost)}, lời {money(l.artistMarkup)}</p>}
              {l.costReviewRequired && <CostReview listing={l} onDone={onChange} />}
              <div className="small">Tệp kèm theo: {l.assets.length}
                {editable && !l.publishedAt && <FilePicker text="Thêm tệp" onPick={async (files) => {
                  setError(null);
                  try { for (const f of files) await studio.addAsset(l.listingId, f); } catch (err) { setError(err); }
                  onChange();
                }} />}
              </div>
              {l.assets.length > 0 && (
                <ul className="file-list">
                  {l.assets.map((a) => (
                    <li key={a.assetId}>
                      <span>Tệp #{a.assetId}</span>
                      <span className="row-gap">
                        <Action variant="quiet" size="sm" onError={setError} onClick={() => downloadFile(studio.assetPath(l.listingId, a.assetId), `listing-${l.listingId}-${a.assetId}`)}>Tải</Action>
                        {editable && !l.publishedAt && <Action variant="quiet" size="sm" onError={setError} onClick={async () => { await studio.removeAsset(l.listingId, a.assetId); onChange(); }}>Xoá</Action>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="row-gap">
                {editable && <button className="btn btn-ghost btn-sm" onClick={() => setForm({ listing: l })}>Sửa</button>}
                {(artistTransitions[l.status] ?? []).map(([status, text]) => (
                  <Action key={status} size="sm" variant={status === 'PUBLISHED' ? 'primary' : 'ghost'} onError={setError}
                    onClick={async () => { await studio.setListingStatus(l.listingId, status); onChange(); }}>{text}</Action>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!['MODERATED', 'ARCHIVED'].includes(artwork.status) && <button className="btn btn-primary" onClick={() => setForm({})}>Thêm phiên bản bán</button>}
      {form && <ListingForm artworkId={artwork.artworkId} listing={form.listing} products={products} onClose={() => setForm(null)} onSaved={() => { setForm(null); onChange(); }} />}
    </section>
  );
}

function CostReview({ listing, onDone }: { listing: { listingId: number; artistMarkup: number | null; currentManufacturingCost: number | null; manufacturingCost: number | null; version: string }; onDone: () => void }) {
  const [markup, setMarkup] = useState(String(listing.artistMarkup ?? 0));
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="alert alert-warn">
      <div>
        <strong>Chi phí in đã đổi từ {money(listing.manufacturingCost)} thành {money(listing.currentManufacturingCost)}.</strong>
        <div className="small">Xác nhận phần lời để tiếp tục bán. Giá mới = {money((listing.currentManufacturingCost ?? 0) + Number(markup || 0))}.</div>
        <span className="inline-form">
          <input className="input input-num" type="number" min={0} value={markup} onChange={(e) => setMarkup(e.target.value)} aria-label="Phần lời" />
          <Action size="sm" onError={setError} onClick={async () => { await studio.confirmCostReview(listing.listingId, Number(markup), listing.version); onDone(); }}>Xác nhận</Action>
        </span>
        <ErrorBox error={error} />
      </div>
    </div>
  );
}

function ListingForm({ artworkId, listing, products, onClose, onSaved }: {
  artworkId: number; listing?: Awaited<ReturnType<typeof studio.listings>>[number];
  products: Awaited<ReturnType<typeof studio.products>>; onClose: () => void; onSaved: () => void;
}) {
  const [type, setType] = useState<'DIGITAL' | 'PHYSICAL'>(listing?.listingType ?? 'DIGITAL');
  const [name, setName] = useState(listing?.name ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [price, setPrice] = useState(String(listing?.listingType === 'DIGITAL' ? listing.price : ''));
  const currentProduct = products.find((p) => listing?.specifications && p.specifications === listing.specifications);
  const [productCode, setProductCode] = useState(currentProduct?.code ?? products[0]?.code ?? '');
  const [markup, setMarkup] = useState(String(listing?.artistMarkup ?? ''));
  const [error, setError] = useState<unknown>(null);
  const product = products.find((p) => p.code === productCode);

  return (
    <Modal title={listing ? 'Sửa phiên bản bán' : 'Thêm phiên bản bán'} onClose={onClose}>
      <div className="form">
        {!listing && (
          <div className="segmented">
            <button className={type === 'DIGITAL' ? 'on' : ''} onClick={() => setType('DIGITAL')}>Bản số</button>
            <button className={type === 'PHYSICAL' ? 'on' : ''} onClick={() => setType('PHYSICAL')}>Bản in</button>
          </div>
        )}
        <Field label="Tên phiên bản"><input className="input" maxLength={240} value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'DIGITAL' ? 'Tệp gốc độ phân giải cao' : 'Bản in A3'} /></Field>
        <Field label="Mô tả"><textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {type === 'DIGITAL' ? (
          <Field label="Giá (VND)"><input className="input" type="number" min={0} step={1} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        ) : (
          <>
            <Field label="Sản phẩm in" hint={listing?.publishedAt ? 'Không đổi được sau lần đăng đầu tiên.' : undefined}>
              <select className="input" value={productCode} onChange={(e) => setProductCode(e.target.value)}>
                {products.map((p) => <option key={p.code} value={p.code}>{p.name} ({money(p.cost)})</option>)}
              </select>
            </Field>
            {product && <p className="small muted">{product.specifications}</p>}
            <Field label="Phần lời của bạn (VND)"><input className="input" type="number" min={0} step={1} value={markup} onChange={(e) => setMarkup(e.target.value)} /></Field>
            {product && <p className="small">Giá bán sẽ là {money(product.cost + Number(markup || 0))}</p>}
          </>
        )}
        <ErrorBox error={error} />
        <Action disabled={!name.trim()} onError={setError} onClick={async () => {
          const body = type === 'DIGITAL'
            ? { name: name.trim(), description, price: Number(price || 0), productCode: null, artistMarkup: null }
            : { name: name.trim(), description, price: null, productCode, artistMarkup: Number(markup || 0) };
          if (listing) await studio.updateListing(listing.listingId, { ...body, version: listing.version });
          else await studio.createListing({ ...body, artworkId, listingType: type });
          onSaved();
        }}>Lưu</Action>
      </div>
    </Modal>
  );
}

export function StudioSettings() {
  const { artist: myArtist, refreshArtist } = useAuth();
  const artistId = myArtist?.artistId ?? null;
  const lookup = useAsync(async () => {
    if (!artistId) return { artist: null, terms: null as ArtistTermsDTO | null };
    const [artist, terms] = await Promise.all([
      artists.get(artistId),
      artists.terms(artistId).catch((err) => { if (err instanceof ApiError && err.code === 'ARTIST_TERMS_NOT_FOUND') return null; throw err; }),
    ]);
    return { artist, terms };
  }, [artistId]);

  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [startingPrice, setStartingPrice] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const acceptingValue = accepting ?? lookup.data?.artist?.acceptingCommissions ?? false;
  const priceValue = startingPrice || (lookup.data?.artist?.startingPrice != null ? String(lookup.data.artist.startingPrice) : '');

  return (
    <div>
      <PageHead title="Nhận vẽ và điều khoản" />
      <StudioNav current="settings" />
      <ErrorBox error={lookup.error} onRetry={lookup.reload} />
      <div className="two-col">
        <section className="panel">
          <h2 className="section-title">Nhận vẽ theo yêu cầu</h2>
          <label className="check"><input type="checkbox" checked={acceptingValue} onChange={(e) => setAccepting(e.target.checked)} /> Đang nhận đơn vẽ</label>
          <Field label="Giá khởi điểm (VND)" hint="Để trống nếu không muốn hiển thị."><input className="input" type="number" min={0} step={1} value={priceValue} onChange={(e) => setStartingPrice(e.target.value)} /></Field>
          <ErrorBox error={error} />
          {saved && <Notice kind="ok">Đã lưu.</Notice>}
          <Action onError={setError} onClick={async () => {
            await artists.updateSettings(acceptingValue, priceValue === '' ? null : Number(priceValue));
            await refreshArtist();
            lookup.reload();
            setSaved(true);
          }}>Lưu cài đặt</Action>
        </section>
        <TermsEditor terms={lookup.data?.terms ?? null} known={!!lookup.data || !!lookup.error} onPublished={() => lookup.reload()} />
      </div>
    </div>
  );
}

function TermsEditor({ terms, known, onPublished }: { terms: ArtistTermsDTO | null; known: boolean; onPublished: (t: ArtistTermsDTO) => void }) {
  const [text, setText] = useState<string | null>(null);
  const [keep, setKeep] = useState<number[] | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState<unknown>(null);
  const value = text ?? terms?.text ?? '';
  const kept = keep ?? terms?.images.map((i) => i.imageId) ?? [];
  return (
    <section className="panel">
      <h2 className="section-title">Điều khoản nhận vẽ</h2>
      <p className="small muted">Bắt buộc trước khi gửi báo giá. Mỗi lần đăng tạo một phiên bản mới; báo giá đã chấp nhận giữ phiên bản cũ.</p>
      {!known && <Loading />}
      {terms && <details className="terms"><summary>Phiên bản hiện tại ({terms.versionNo})</summary><TermsView terms={terms} /></details>}
      <Field label="Nội dung" hint="Tối đa 20.000 ký tự."><textarea className="input" rows={10} maxLength={20000} value={value} onChange={(e) => setText(e.target.value)} /></Field>
      {terms && terms.images.length > 0 && (
        <div className="field">
          <span className="field-label">Giữ ảnh của phiên bản hiện tại</span>
          {terms.images.map((img) => (
            <label key={img.imageId} className="check">
              <input type="checkbox" checked={kept.includes(img.imageId)} onChange={(e) => setKeep(e.target.checked ? [...kept, img.imageId] : kept.filter((x) => x !== img.imageId))} />
              Ảnh {img.sortOrder + 1} ({bytes(img.byteLength)})
            </label>
          ))}
        </div>
      )}
      <div className="file-row"><FilePicker multiple accept="image/jpeg,image/png,image/webp" text="Thêm ảnh" onPick={(files) => setImages([...images, ...files])} /></div>
      {images.length > 0 && <ul className="file-list">{images.map((f, i) => <li key={i}>{f.name} <button className="btn btn-quiet btn-sm" onClick={() => setImages(images.filter((_, j) => j !== i))}>Bỏ</button></li>)}</ul>}
      <ErrorBox error={error} />
      <Action disabled={!value.trim()} onError={setError} onClick={async () => {
        const published = await artists.publishTerms(value.trim(), kept, images);
        setImages([]); setText(null); setKeep(null);
        onPublished(published);
      }}>Đăng điều khoản</Action>
    </section>
  );
}

export function StudioProceeds() {
  const state = useAsync(async () => {
    const [proceeds, releases] = await Promise.all([studio.proceeds(), studio.releases()]);
    return { proceeds, releases };
  });
  if (state.loading && !state.data) return <Loading />;
  const proceeds = state.data?.proceeds ?? [];
  const sum = (status: string[]) => proceeds.filter((p) => status.includes(p.status)).reduce((total, p) => total + p.amount, 0);
  return (
    <div>
      <PageHead title="Doanh thu" sub="Tiền giữ lại cho tới khi đủ điều kiện, sau đó quản trị viên chuyển khoản và ghi nhận." />
      <StudioNav current="proceeds" />
      <ErrorBox error={state.error} onRetry={state.reload} />
      <div className="stats">
        <div><span>Đang giữ</span><strong>{money(sum(['HELD']))}</strong></div>
        <div><span>Chờ chuyển</span><strong>{money(sum(['ELIGIBLE', 'RESERVED']))}</strong></div>
        <div><span>Đã nhận</span><strong>{money(sum(['PAID']))}</strong></div>
      </div>
      <h2 className="section-title">Các khoản</h2>
      {proceeds.length === 0 ? <Empty title="Chưa có khoản doanh thu nào." /> : (
        <table className="table">
          <thead><tr><th>Khoản</th><th>Nguồn</th><th className="num">Số tiền</th><th>Trạng thái</th><th>Đủ điều kiện</th><th>Đã trả</th></tr></thead>
          <tbody>
            {proceeds.map((p) => (
              <tr key={p.proceedsId}>
                <td>#{p.proceedsId}</td>
                <td>{p.orderItemId ? `Sản phẩm #${p.orderItemId}` : `Báo giá #${p.quoteId}, đợt ${p.installment}`}</td>
                <td className="num">{money(p.amount)}</td>
                <td><Badge status={p.status} /></td>
                <td>{when(p.eligibleAt)}</td>
                <td>{when(p.paidAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2 className="section-title">Lần chuyển khoản</h2>
      {state.data?.releases.length === 0 ? <p className="muted">Chưa có lần chuyển nào.</p> : (
        <table className="table">
          <thead><tr><th>Lần</th><th className="num">Số tiền</th><th>Trạng thái</th><th>Mã giao dịch</th><th>Tạo lúc</th></tr></thead>
          <tbody>{state.data?.releases.map((r) => (
            <tr key={r.payoutId}><td>#{r.payoutId}</td><td className="num">{money(r.amount)}</td><td><Badge status={r.status} /></td><td>{r.transferReference ?? '—'}</td><td>{when(r.createdAt)}</td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}
