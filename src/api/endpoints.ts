import { API_BASE, del, get, jsonPart, post, postForm, put } from './client';
import type * as T from './types';

// ---------- Auth ----------
export const auth = {
  register: (email: string, password: string, displayName: string) =>
    post<T.CustomerDTO>('/customers/register', { email, password, displayName }),
  login: (email: string, password: string) => post<T.TokenDTO>('/customers/login', { email, password }),
  me: () => get<T.CustomerDTO>('/customers/me'),
  staffLogin: (loginName: string, password: string) => post<T.TokenDTO>('/staff/login', { loginName, password }),
};

// ---------- Public catalog ----------
export const catalog = {
  artworks: () => get<T.ArtworkDTO[]>('/catalog/artworks'),
  artwork: (artworkId: number) => get<T.ArtworkDTO>(`/catalog/artworks/${artworkId}`),
  listings: (artworkId: number) => get<T.CatalogListingDTO[]>(`/catalog/artworks/${artworkId}/listings`),
  previewUrl: (artworkId: number, mediaId: number) =>
    `${API_BASE}/catalog/artworks/${artworkId}/previews/${mediaId}/content`,
};

export const artists = {
  // 403 ARTIST_PROFILE_REQUIRED when the signed-in Customer has no Artist Profile.
  me: () => get<T.ArtistDTO>('/artists/me'),
  get: (artistId: number) => get<T.PublicArtistDTO>(`/artists/${artistId}`),
  terms: (artistId: number) => get<T.ArtistTermsDTO>(`/artists/${artistId}/terms`),
  termsImageUrl: (artistId: number, imageId: number) =>
    `${API_BASE}/artists/${artistId}/terms/images/${imageId}/content`,
  updateSettings: (acceptingCommissions: boolean, startingPrice: number | null) =>
    put<T.ArtistDTO>('/artists/me/commission-settings', { acceptingCommissions, startingPrice }),
  publishTerms: (text: string, keepImageIds: number[], images: File[]) => {
    const form = new FormData();
    form.append('request', jsonPart({ text, keepImageIds }));
    images.forEach((image) => form.append('images', image));
    return postForm<T.ArtistTermsDTO>('/artists/me/terms', form);
  },
};

// ---------- Customer ----------
export const addresses = {
  list: () => get<T.AddressDTO[]>('/addresses'),
  create: (input: T.AddressInput) => post<T.AddressDTO>('/addresses', input),
  update: (addressId: number, input: T.AddressInput) => put<T.AddressDTO>(`/addresses/${addressId}`, input),
  remove: (addressId: number) => del(`/addresses/${addressId}`),
};
export const provinces = {
  supported: () => get<T.ProvinceDTO[]>('/provinces/supported'),
  all: () => get<T.ProvinceDTO[]>('/provinces'),
  create: (provinceCode: string, provinceName: string) => post<T.ProvinceDTO>('/provinces', { provinceCode, provinceName }),
  setSupport: (provinceId: number, supported: boolean, reason: string) =>
    put<T.ProvinceDTO>(`/provinces/${provinceId}/support`, { supported, reason: reason || null }),
};

export const cart = {
  get: () => get<T.CartDTO>('/cart'),
  add: (listingId: number, quantity: number) => post<T.CartDTO>('/cart/items', { listingId, quantity }),
  update: (listingId: number, quantity: number) => put<T.CartDTO>(`/cart/items/${listingId}`, { quantity }),
  remove: (listingId: number) => del(`/cart/items/${listingId}`),
  preview: (addressId?: number) => get<T.CheckoutPreviewDTO>('/cart/checkout-preview', { addressId }),
};

export const orders = {
  create: (preview: T.CheckoutPreviewDTO, addressId?: number) =>
    post<T.OrderDTO>('/orders', {
      cartVersion: preview.cartVersion,
      addressId: addressId ?? null,
      lines: preview.lines.map((line) => ({
        listingId: line.listingId, quantity: line.quantity, unitPrice: line.unitPrice,
      })),
      totalAmount: preview.totalAmount,
    }),
  list: () => get<T.OrderDTO[]>('/orders'),
  get: (orderId: number) => get<T.OrderDTO>(`/orders/${orderId}`),
  pay: (orderId: number) => post<T.PaymentAttemptDTO>(`/orders/${orderId}/payment-attempts`),
  attempt: (attemptRef: string) => get<T.PaymentAttemptStatusDTO>(`/payments/attempts/${encodeURIComponent(attemptRef)}`),
  requestRefund: (orderId: number, orderItemId: number, reason: string) =>
    post<T.RefundRequestDTO>(`/orders/${orderId}/items/${orderItemId}/refund-requests`, { reason }),
};

export const purchases = {
  list: () => get<T.PurchaseDTO[]>('/purchases'),
  filePath: (assetId: number) => `/purchases/assets/${assetId}/content`,
};
export const refunds = { mine: () => get<T.RefundRequestDTO[]>('/refund-requests') };

// ---------- Commissions ----------
const c = (commissionId: number) => `/commissions/${commissionId}`;
export const commissions = {
  create: (artistId: number, description: string, allowPublicDisplay: boolean, files: File[]) => {
    const request = { artistId, description, allowPublicDisplay };
    if (files.length === 0) return post<T.CommissionDTO>('/commissions', request);
    const form = new FormData();
    form.append('request', jsonPart(request));
    files.forEach((file) => form.append('files', file));
    return postForm<T.CommissionDTO>('/commissions', form);
  },
  list: () => get<T.CommissionSummaryDTO[]>('/commissions'),
  get: (id: number) => get<T.CommissionDTO>(c(id)),
  messages: (id: number) => get<T.CommissionMessageDTO[]>(`${c(id)}/messages`),
  send: (id: number, body: string) => post<T.CommissionMessageDTO>(`${c(id)}/messages`, { body }),
  attach: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return postForm<T.CommissionAttachmentDTO>(`${c(id)}/attachments`, form);
  },
  attachmentPath: (id: number, attachmentId: number) => `${c(id)}/attachments/${attachmentId}/content`,

  quotes: (id: number) => get<T.CommissionQuoteDTO[]>(`${c(id)}/quotes`),
  offerQuote: (id: number, price: number, scopeText: string, expectedCompletionTerms: string) =>
    post<T.CommissionQuoteDTO>(`${c(id)}/quotes`, { price, scopeText, expectedCompletionTerms }),
  acceptQuote: (id: number, quoteId: number, artistTermsId: number) =>
    post<T.CommissionQuoteDTO>(`${c(id)}/quotes/${quoteId}/accept`, { artistTermsId }),
  declineQuote: (id: number, quoteId: number) => post<T.CommissionQuoteDTO>(`${c(id)}/quotes/${quoteId}/decline`),
  withdrawQuote: (id: number, quoteId: number) => post<T.CommissionQuoteDTO>(`${c(id)}/quotes/${quoteId}/withdraw`),
  quoteTerms: (id: number, quoteId: number) => get<T.ArtistTermsDTO>(`${c(id)}/quotes/${quoteId}/terms`),
  declineRequest: (id: number) => post<T.CommissionSummaryDTO>(`${c(id)}/decline`),
  payQuote: (id: number, quoteId: number) =>
    post<T.QuotePaymentAttemptDTO>(`${c(id)}/quotes/${quoteId}/payment-attempts`),

  deliverables: (id: number) => get<T.CommissionDeliverableDTO[]>(`${c(id)}/deliverables`),
  submitDeliverable: (id: number, notes: string, files: File[]) => {
    const form = new FormData();
    if (notes) form.append('request', jsonPart({ notes }));
    files.forEach((file) => form.append('files', file));
    return postForm<T.CommissionDeliverableDTO>(`${c(id)}/deliverables`, form);
  },
  approve: (id: number, deliverableId: number) =>
    post<T.CommissionSummaryDTO>(`${c(id)}/deliverables/${deliverableId}/approve`),
  requestRevision: (id: number, deliverableId: number, details: string) =>
    post<T.RevisionRequestDTO>(`${c(id)}/deliverables/${deliverableId}/revision-requests`, { details }),
  deliverableFilePath: (id: number, deliverableId: number, fileId: number) =>
    `${c(id)}/deliverables/${deliverableId}/files/${fileId}/content`,

  cancel: (id: number, reason: string) => post<T.CommissionSummaryDTO>(`${c(id)}/cancel`, { reason }),
  cancellations: (id: number) => get<T.CancellationRequestDTO[]>(`${c(id)}/cancellation-requests`),
  requestCancellation: (id: number, reason: string, refundPercent: number | null) =>
    post<T.CancellationRequestDTO>(`${c(id)}/cancellation-requests`, { reason, refundPercent }),
  offerRefund: (id: number, cancellationId: number, refundPercent: number) =>
    post<T.CancellationRequestDTO>(`${c(id)}/cancellation-requests/${cancellationId}/refund-offer`, { refundPercent }),
  acceptCancellation: (id: number, cancellationId: number, note: string) =>
    post<T.CancellationRequestDTO>(`${c(id)}/cancellation-requests/${cancellationId}/accept`, { note: note || null }),
  rejectCancellation: (id: number, cancellationId: number, note: string) =>
    post<T.CancellationRequestDTO>(`${c(id)}/cancellation-requests/${cancellationId}/reject`, { note: note || null }),
  withdrawCancellation: (id: number, cancellationId: number) =>
    post<T.CancellationRequestDTO>(`${c(id)}/cancellation-requests/${cancellationId}/withdraw`),

  disputes: (id: number) => get<T.CommissionDisputeDTO[]>(`${c(id)}/disputes`),
  openDispute: (id: number, reason: string) => post<T.CommissionDisputeDTO>(`${c(id)}/disputes`, { reason }),
  refunds: (id: number) => get<T.CommissionRefundDTO[]>(`${c(id)}/refund-requests`),
};

// ---------- Artist studio ----------
export const studio = {
  artworks: () => get<T.ArtworkDTO[]>('/artworks'),
  artwork: (artworkId: number) => get<T.ArtworkDTO>(`/artworks/${artworkId}`),
  createArtwork: (input: { title: string; description: string; dimension: string; tagIds: number[] }) =>
    post<T.ArtworkDTO>('/artworks', input),
  updateArtwork: (artworkId: number, input: { title: string; description: string; dimension: string; tagIds: number[]; version: string }) =>
    put<T.ArtworkDTO>(`/artworks/${artworkId}`, input),
  setArtworkStatus: (artworkId: number, status: string) =>
    put<T.ArtworkDTO>(`/artworks/${artworkId}/status`, { status, reason: null }),
  addPreview: (artworkId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return postForm<T.ArtworkDTO>(`/artworks/${artworkId}/previews`, form);
  },
  movePreview: (artworkId: number, mediaId: number, sortOrder: number) =>
    put<T.ArtworkDTO>(`/artworks/${artworkId}/previews/${mediaId}`, { sortOrder }),
  removePreview: (artworkId: number, mediaId: number) => del(`/artworks/${artworkId}/previews/${mediaId}`),
  previewPath: (artworkId: number, mediaId: number) => `/artworks/${artworkId}/previews/${mediaId}/content`,
  activeTags: () => get<T.TagDTO[]>('/tags/active'),

  products: () => get<T.ManufacturingProductDTO[]>('/listings/products'),
  listings: (artworkId: number) => get<T.ListingDTO[]>('/listings', { artworkId }),
  createListing: (input: Record<string, unknown>) => post<T.ListingDTO>('/listings', input),
  updateListing: (listingId: number, input: Record<string, unknown>) => put<T.ListingDTO>(`/listings/${listingId}`, input),
  setListingStatus: (listingId: number, status: string) =>
    put<T.ListingDTO>(`/listings/${listingId}/status`, { status, reason: null }),
  confirmCostReview: (listingId: number, artistMarkup: number, version: string) =>
    put<T.ListingDTO>(`/listings/${listingId}/cost-review`, { artistMarkup, version }),
  addAsset: (listingId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return postForm<T.ListingDTO>(`/listings/${listingId}/assets`, form);
  },
  removeAsset: (listingId: number, assetId: number) => del(`/listings/${listingId}/assets/${assetId}`),
  assetPath: (listingId: number, assetId: number) => `/listings/${listingId}/assets/${assetId}/content`,

  proceeds: () => get<T.ProceedsDTO[]>('/proceeds'),
  releases: () => get<T.ReleaseDTO[]>('/proceeds/releases'),
};

// ---------- Admin ----------
export const admin = {
  artworks: () => get<T.ArtworkDTO[]>('/admin/artworks'),
  setArtworkStatus: (artworkId: number, status: string, reason: string) =>
    put<T.ArtworkDTO>(`/admin/artworks/${artworkId}/status`, { status, reason: reason || null }),
  artworkPreviewPath: (artworkId: number, mediaId: number) => `/admin/artworks/${artworkId}/previews/${mediaId}/content`,
  listings: (artworkId: number) => get<T.ListingDTO[]>('/admin/listings', { artworkId }),
  setListingStatus: (listingId: number, status: string, reason: string) =>
    put<T.ListingDTO>(`/admin/listings/${listingId}/status`, { status, reason: reason || null }),
  listingAssetPath: (listingId: number, assetId: number) => `/admin/listings/${listingId}/assets/${assetId}/content`,

  tags: () => get<T.TagDTO[]>('/tags'),
  createTag: (name: string) => post<T.TagDTO>('/tags', { name }),
  updateTag: (tagId: number, name: string, active: boolean) => put<T.TagDTO>(`/tags/${tagId}`, { name, active }),

  // Exact email match (as at login), any account status; 404 when no account has it.
  customerByEmail: (email: string) => get<T.CustomerDTO & { status?: string }>('/admin/customers', { email }),
  artists: () => get<T.ArtistDTO[]>('/admin/artists'),
  grantArtist: (userId: number, displayName: string, reason: string) =>
    post<T.ArtistDTO>('/artists', { userId, displayName, reason: reason || null }),
  deactivateArtist: (artistId: number, reason: string) =>
    post<T.ArtistDeactivationDTO>(`/admin/artists/${artistId}/deactivation`, { reason }),
  reinstateArtist: (artistId: number, reason: string) =>
    post<T.ArtistDeactivationDTO>(`/admin/artists/${artistId}/reinstatement`, { reason }),

  fulfillments: (status?: string) => get<T.FulfillmentDTO[]>('/admin/fulfillments', { status }),
  advanceFulfillment: (orderItemId: number, body: { status: string; carrier?: string; trackingReference?: string; reason?: string }) =>
    post<T.FulfillmentDTO>(`/admin/fulfillments/${orderItemId}/transitions`, body),

  refunds: (status?: string) => get<T.RefundRequestDTO[]>('/admin/refund-requests', { status }),
  decideRefund: (refundRequestId: number, decision: 'APPROVE' | 'REJECT', reason: string) =>
    post<T.RefundRequestDTO>(`/admin/refund-requests/${refundRequestId}/decision`, { decision, reason: reason || null }),
  recordRefundTransfer: (transferId: number, status: string, transferReference: string, reason: string) =>
    post<T.RefundRequestDTO>(`/admin/refund-transfers/${transferId}/status`, {
      status, transferReference: transferReference || null, reason: reason || null,
    }),
  commissionRefunds: (status?: string) => get<T.CommissionRefundDTO[]>('/admin/commission-refund-requests', { status }),

  disputes: (status?: string) => get<T.CommissionDisputeDTO[]>('/admin/commission-disputes', { status }),
  dispute: (disputeId: number) => get<T.DisputeEvidenceDTO>(`/admin/commission-disputes/${disputeId}`),
  reviewDispute: (disputeId: number) => post<T.CommissionDisputeDTO>(`/admin/commission-disputes/${disputeId}/review`),
  resolveDispute: (disputeId: number, outcome: string, reason: string, refundPercent: number | null) =>
    post<T.CommissionDisputeDTO>(`/admin/commission-disputes/${disputeId}/resolution`, { outcome, reason, refundPercent }),
  quoteTerms: (commissionId: number, quoteId: number) =>
    get<T.ArtistTermsDTO>(`/admin/commissions/${commissionId}/quotes/${quoteId}/terms`),

  releases: (status?: string) => get<T.ReleaseDTO[]>('/admin/releases', { status }),
  recordRelease: (payoutId: number, status: string, transferReference: string, reason: string) =>
    post<T.ReleaseDTO>(`/admin/releases/${payoutId}/status`, {
      status, transferReference: transferReference || null, reason: reason || null,
    }),
  rerelease: (proceedsId: number) => post<T.ReleaseDTO>(`/admin/proceeds/${proceedsId}/releases`),
  reconciliation: () => get<T.ReconciliationDTO>('/admin/finance/reconciliation'),
};
