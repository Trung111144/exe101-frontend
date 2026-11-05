import { useState } from 'react';
import { artists, cart, catalog } from '../../api/endpoints';
import type { CatalogListingDTO } from '../../api/types';
import { Action, ErrorBox, Loading, Notice, useAsync } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { money } from '../../lib/format';
import { Link, navigate } from '../../lib/router';

export function ArtworkPage({ artworkId }: { artworkId: number }) {
  const { data, error, loading, reload } = useAsync(async () => {
    const [artwork, listings] = await Promise.all([catalog.artwork(artworkId), catalog.listings(artworkId)]);
    const artist = await artists.get(artwork.artistId).catch(() => null);
    return { artwork, listings, artist };
  }, [artworkId]);
  const [active, setActive] = useState(0);
  const { artist: myArtist } = useAuth();

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;
  const { artwork, listings, artist } = data;
  // The backend refuses self-purchase (SELF_PURCHASE_NOT_ALLOWED); say so before the Artist tries.
  const own = myArtist?.artistId === artwork.artistId;
  const previews = [...artwork.previews].sort((a, b) => a.sortOrder - b.sortOrder);
  const current = previews[Math.min(active, previews.length - 1)];

  return (
    <article className="artwork">
      <div className="artwork-view">
        <div className="artwork-stage">
          {current ? <img src={catalog.previewUrl(artwork.artworkId, current.mediaId)} alt={artwork.title} /> : <div className="img-missing">Chưa có ảnh</div>}
        </div>
        {previews.length > 1 && (
          <div className="thumbs">
            {previews.map((preview, index) => (
              <button key={preview.mediaId} className={`thumb ${index === active ? 'thumb-on' : ''}`} onClick={() => setActive(index)} aria-label={`Ảnh ${index + 1}`}>
                <img src={catalog.previewUrl(artwork.artworkId, preview.mediaId)} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="artwork-info">
        <h1>{artwork.title}</h1>
        <p className="artwork-by">
          {artist ? <Link to={`/artists/${artist.artistId}`}>{artist.displayName}</Link> : 'Hoạ sĩ'}, tranh {artwork.dimension}
        </p>
        {artwork.tags.length > 0 && (
          <div className="chips">{artwork.tags.map((t) => <span key={t.tagId} className="chip">{t.name}</span>)}</div>
        )}
        {artwork.description && <p className="prose">{artwork.description}</p>}

        <h2 className="section-title">Chọn phiên bản</h2>
        {own && <Notice>Đây là tranh của bạn nên bạn không mua được. Đăng nhập tài khoản khác để thử mua, hoặc <Link to={`/studio/artworks/${artwork.artworkId}`}>sửa tranh trong Xưởng</Link>.</Notice>}
        {listings.length === 0 && <Notice>Tranh này chưa có phiên bản nào để bán.</Notice>}
        <div className="offers">
          {listings.map((listing) => <Offer key={listing.listingId} listing={listing} own={own} />)}
        </div>

        {artist?.acceptingCommissions && !own && (
          <div className="commission-cta">
            <p>Thích nét vẽ này? {artist.displayName} đang nhận vẽ theo yêu cầu{artist.startingPrice ? `, từ ${money(artist.startingPrice)}` : ''}.</p>
            <Link className="btn btn-ghost" to={`/artists/${artist.artistId}`}>Đặt vẽ riêng</Link>
          </div>
        )}
      </div>
    </article>
  );
}

function Offer({ listing, own }: { listing: CatalogListingDTO; own: boolean }) {
  const { session } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const physical = listing.listingType === 'PHYSICAL';

  return (
    <div className={`offer ${listing.purchasable ? '' : 'offer-off'}`}>
      <div className="offer-main">
        <div>
          <div className="offer-name">{listing.name}</div>
          <div className="offer-kind">{physical ? 'Bản in giao tận nơi' : 'Bản số, tải về sau khi thanh toán'}</div>
          {listing.specifications && <div className="offer-spec">{listing.specifications}</div>}
          {listing.description && <div className="offer-spec">{listing.description}</div>}
        </div>
        <div className="offer-price">{money(listing.price)}</div>
      </div>
      {own ? null : listing.purchasable ? (
        <div className="offer-buy">
          {physical && (
            <input className="input input-qty" type="number" min={1} max={99} value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} aria-label="Số lượng" />
          )}
          <Action
            onError={setError}
            onClick={async () => {
              if (session?.kind !== 'customer') {
                navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
                return;
              }
              await cart.add(listing.listingId, physical ? quantity : 1);
              setAdded(true);
              setError(null);
            }}
          >
            Thêm vào giỏ
          </Action>
          {added && <Link to="/cart" className="link-strong">Đã thêm. Xem giỏ hàng</Link>}
        </div>
      ) : (
        <div className="offer-kind">Tạm ngưng bán</div>
      )}
      <ErrorBox error={error} />
    </div>
  );
}
