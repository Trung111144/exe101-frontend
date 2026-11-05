import { artists } from '../../api/endpoints';
import type { ArtistTermsDTO } from '../../api/types';
import { when } from '../../lib/format';

export function TermsView({ terms, compact }: { terms: ArtistTermsDTO; compact?: boolean }) {
  const images = [...terms.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const body = (
    <>
      <p className="terms-meta">Phiên bản {terms.versionNo}, đăng {when(terms.publishedAt)}</p>
      <div className="terms-text">{terms.text}</div>
      {images.length > 0 && (
        <div className="terms-images">
          {images.map((image) => (
            <a key={image.imageId} href={artists.termsImageUrl(terms.artistId, image.imageId)} target="_blank" rel="noreferrer">
              <img src={artists.termsImageUrl(terms.artistId, image.imageId)} alt={`Điều khoản, ảnh ${image.sortOrder + 1}`} />
            </a>
          ))}
        </div>
      )}
    </>
  );
  if (compact) {
    return (
      <details className="terms">
        <summary>Điều khoản nhận vẽ của hoạ sĩ</summary>
        {body}
      </details>
    );
  }
  return <div className="terms terms-open">{body}</div>;
}
