import { useState } from 'react';
import { ApiError } from '../../api/client';
import { artists, catalog, commissions } from '../../api/endpoints';
import { ErrorBox, Field, FilePicker, Loading, Notice, SignInPrompt, useAsync } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { bytes, money } from '../../lib/format';
import { Link, navigate } from '../../lib/router';
import { TermsView } from '../commission/TermsView';

export function ArtistPage({ artistId }: { artistId: number }) {
  const { session } = useAuth();
  const { data, error, loading, reload } = useAsync(async () => {
    const [artist, artworks, terms] = await Promise.all([
      artists.get(artistId),
      catalog.artworks(),
      artists.terms(artistId).catch((err) => {
        if (err instanceof ApiError && err.code === 'ARTIST_TERMS_NOT_FOUND') return null;
        throw err;
      }),
    ]);
    return { artist, artworks: artworks.filter((artwork) => artwork.artistId === artistId), terms };
  }, [artistId]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;
  const { artist, artworks, terms } = data;

  return (
    <div className="artist-page">
      <header className="artist-head">
        <h1>{artist.displayName}</h1>
        {artist.bio && <p className="prose">{artist.bio}</p>}
        {artist.status !== 'ACTIVE' && <Notice kind="warn">Hoạ sĩ đang tạm ngưng hoạt động.</Notice>}
      </header>

      <div className="two-col">
        <section>
          <h2 className="section-title">Tranh đã đăng ({artworks.length})</h2>
          <div className="mini-grid">
            {artworks.map((artwork) => {
              const preview = [...artwork.previews].sort((a, b) => a.sortOrder - b.sortOrder)[0];
              return (
                <Link key={artwork.artworkId} to={`/artworks/${artwork.artworkId}`} className="mini">
                  {preview ? <img src={catalog.previewUrl(artwork.artworkId, preview.mediaId)} alt={artwork.title} loading="lazy" /> : <div className="img-missing" />}
                  <span>{artwork.title}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="panel">
          <h2 className="section-title">Đặt vẽ theo yêu cầu</h2>
          {!artist.acceptingCommissions ? (
            <p className="muted">Hiện hoạ sĩ chưa nhận đơn vẽ riêng.</p>
          ) : (
            <>
              <p className="muted">{artist.startingPrice ? `Giá khởi điểm ${money(artist.startingPrice)}. ` : ''}Hoạ sĩ sẽ đọc yêu cầu và gửi báo giá; bạn chỉ trả tiền sau khi đồng ý báo giá.</p>
              {terms && <TermsView terms={terms} compact />}
              {session?.kind === 'customer' ? <CommissionForm artistId={artistId} /> : <SignInPrompt what="gửi yêu cầu vẽ" />}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function CommissionForm({ artistId }: { artistId: number }) {
  const [description, setDescription] = useState('');
  const [allowPublic, setAllowPublic] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  return (
    <form className="form" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const created = await commissions.create(artistId, description.trim(), allowPublic, files);
        navigate(`/commissions/${created.commissionId}`);
      } catch (err) {
        setError(err);
      } finally {
        setBusy(false);
      }
    }}>
      <Field label="Bạn muốn vẽ gì?" hint="Tối đa 5000 ký tự. Mô tả chủ đề, kích thước, phong cách, hạn mong muốn.">
        <textarea className="input" rows={6} maxLength={5000} required value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <div className="file-row">
        <FilePicker multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.psd,.zip" onPick={(picked) => setFiles([...files, ...picked])} text="Đính kèm ảnh tham khảo" />
        <span className="field-hint">PNG, JPEG, WebP, PDF, PSD hoặc ZIP</span>
      </div>
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file, index) => (
            <li key={index}>{file.name} ({bytes(file.size)}) <button type="button" className="btn btn-quiet btn-sm" onClick={() => setFiles(files.filter((_, i) => i !== index))}>Bỏ</button></li>
          ))}
        </ul>
      )}
      <label className="check">
        <input type="checkbox" checked={allowPublic} onChange={(event) => setAllowPublic(event.target.checked)} />
        Cho phép hoạ sĩ đăng tác phẩm hoàn thiện công khai
      </label>
      <ErrorBox error={error} />
      <button className="btn btn-primary" disabled={busy || !description.trim()}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
    </form>
  );
}
