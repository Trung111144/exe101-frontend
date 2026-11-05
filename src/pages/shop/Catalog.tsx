import { useMemo, useState } from 'react';
import { catalog } from '../../api/endpoints';
import { Empty, ErrorBox, Loading, useAsync } from '../../components/ui';
import { Link } from '../../lib/router';

export function Catalog() {
  const { data, error, loading, reload } = useAsync(async () => ({ artworks: await catalog.artworks() }));
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string>('');
  const [onlyBuyable, setOnlyBuyable] = useState(false);

  const tags = useMemo(() => {
    const names = new Set<string>();
    data?.artworks.forEach((artwork) => artwork.tags.forEach((t) => names.add(t.name)));
    return [...names].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [data]);

  // The hero shows one real painting: the newest purchasable one with a preview, else the newest with a preview.
  const featured = useMemo(() => {
    const withPreview = (data?.artworks ?? []).filter((a) => a.previews.length > 0);
    return withPreview.find((a) => a.purchasable) ?? withPreview[0];
  }, [data]);
  const featuredPreview = featured ? [...featured.previews].sort((a, b) => a.sortOrder - b.sortOrder)[0] : undefined;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.artworks ?? []).filter((artwork) => {
      if (onlyBuyable && !artwork.purchasable) return false;
      if (tag && !artwork.tags.some((t) => t.name === tag)) return false;
      if (!q) return true;
      return `${artwork.title} ${artwork.description ?? ''} ${artwork.artistDisplayName ?? ''}`.toLowerCase().includes(q);
    });
  }, [data, query, tag, onlyBuyable]);

  return (
    <div className="catalog">
      <section className="hero">
        <div className="segmented hero-switch" role="tablist" aria-label="Lọc tranh">
          <button role="tab" aria-selected={!onlyBuyable} className={!onlyBuyable ? 'on' : ''} onClick={() => setOnlyBuyable(false)}>Tất cả</button>
          <button role="tab" aria-selected={onlyBuyable} className={onlyBuyable ? 'on' : ''} onClick={() => setOnlyBuyable(true)}>Đang bán</button>
        </div>
        <h1 className="hero-title">Phòng tranh</h1>
        <p className="hero-sub">Tranh vẽ tay của nhóm hoạ sĩ. Tải bản số ngay, đặt bản in giao tận nhà, hoặc nhờ vẽ riêng cho bạn.</p>
        {featured && featuredPreview && (
          <Link to={`/artworks/${featured.artworkId}`} className="hero-card" aria-label={`Xem tranh ${featured.title}`}>
            <div className="hero-card-head">
              <span className="hero-card-title">{featured.title}</span>
              <span className="hero-card-meta">{featured.artistDisplayName}</span>
            </div>
            <img src={catalog.previewUrl(featured.artworkId, featuredPreview.mediaId)} alt={featured.title} />
          </Link>
        )}
        {data && data.artworks.length > 0 && (
          <div className="hero-actions">
            <a className="btn btn-primary btn-lg" href="#tuong-tranh">Khám phá {data.artworks.length} tác phẩm</a>
            {featured && <Link className="btn btn-ghost btn-lg" to={`/artists/${featured.artistId}`}>Đặt vẽ riêng</Link>}
          </div>
        )}
      </section>

      <div className="catalog-tools" id="tuong-tranh">
        <input className="input" type="search" placeholder="Tìm theo tên tranh, mô tả, hoạ sĩ" value={query}
          onChange={(event) => setQuery(event.target.value)} aria-label="Tìm tranh" />
        <select className="input" value={tag} onChange={(event) => setTag(event.target.value)} aria-label="Lọc theo thẻ">
          <option value="">Tất cả thẻ</option>
          {tags.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data && <Loading />}
      {data && shown.length === 0 && (
        <Empty title={data.artworks.length ? 'Không có tranh khớp bộ lọc.' : 'Chưa có tranh nào được đăng.'}>
          {data.artworks.length ? 'Thử bỏ bớt bộ lọc.' : 'Hoạ sĩ có thể đăng tranh trong Xưởng.'}
        </Empty>
      )}

      <div className="salon">
        {shown.map((artwork) => {
          const preview = [...artwork.previews].sort((a, b) => a.sortOrder - b.sortOrder)[0];
          return (
            <Link key={artwork.artworkId} to={`/artworks/${artwork.artworkId}`} className="frame">
              <div className="frame-art">
                {preview ? (
                  <img src={catalog.previewUrl(artwork.artworkId, preview.mediaId)} alt={artwork.title} loading="lazy" />
                ) : (
                  <div className="img-missing">Chưa có ảnh</div>
                )}
              </div>
              <div className="frame-plate">
                <span className="plate-title">{artwork.title}</span>
                <span className="plate-meta">
                  {artwork.artistDisplayName ?? 'Hoạ sĩ'}, {artwork.dimension}
                  {!artwork.purchasable && <em> (chưa mở bán)</em>}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
