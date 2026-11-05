// Mirrors the backend DTO records (com.exe101.*.dto). Money arrives as JSON numbers (BigDecimal, whole VND).
export type Money = number;
export type Iso = string;

export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  errorCode?: string;
  details?: unknown;
}

export interface TokenDTO { accessToken: string; tokenType: string; expiresIn: number }
export interface CustomerDTO { userId: number; email: string; displayName: string; createdAt: Iso }

export interface AddressDTO {
  addressId: number; label: string | null; recipientName: string; phone: string; line1: string; line2: string | null;
  ward: string; district: string | null; provinceCode: string; postalCode: string | null; countryCode: string;
  defaultAddress: boolean; createdAt: Iso;
}
export type AddressInput = Omit<AddressDTO, 'addressId' | 'createdAt'>;

export interface ProvinceDTO { provinceId: number; provinceCode: string; provinceName: string; supported: boolean; updatedAt: Iso }
export interface TagDTO { tagId: number; name: string; active: boolean }

export interface ArtistDTO {
  artistId: number; userId: number; displayName: string; status: string; acceptingCommissions: boolean;
  startingPrice: Money | null; createdAt: Iso;
}
export interface PublicArtistDTO {
  artistId: number; displayName: string; bio: string | null; status: string; acceptingCommissions: boolean;
  startingPrice: Money | null;
}
export interface ArtistDeactivationDTO {
  deactivationId: number; artistId: number; artistStatus: string; startedAt: Iso; closedAt: Iso | null;
  reason: string; staffId: number;
}
export interface ArtistTermsImageDTO { imageId: number; sortOrder: number; contentType: string; byteLength: number }
export interface ArtistTermsDTO {
  artistTermsId: number; artistId: number; versionNo: number; text: string; publishedAt: Iso;
  images: ArtistTermsImageDTO[];
}

export interface PreviewDTO { mediaId: number; sortOrder: number }
export interface ArtworkDTO {
  artworkId: number; artistId: number; artistDisplayName: string; title: string; description: string | null; dimension: '2D' | '3D';
  status: string; publishedAt: Iso | null; createdAt: Iso; version: string; purchasable: boolean;
  tags: { tagId: number; name: string }[]; previews: PreviewDTO[];
}

export interface ListingAssetDTO { assetId: number; sortOrder: number }
export interface ListingDTO {
  listingId: number; artworkId: number; listingType: 'DIGITAL' | 'PHYSICAL'; name: string; description: string | null;
  status: string; currencyCode: string; price: Money; manufacturingCost: Money | null; artistMarkup: Money | null;
  specifications: string | null; costReviewRequired: boolean; currentManufacturingCost: Money | null;
  publishedAt: Iso | null; createdAt: Iso; version: string; purchasable: boolean; assets: ListingAssetDTO[];
}
export interface CatalogListingDTO {
  listingId: number; artworkId: number; listingType: 'DIGITAL' | 'PHYSICAL'; name: string; description: string | null;
  specifications: string | null; currencyCode: string; price: Money; purchasable: boolean;
}
export interface ManufacturingProductDTO { code: string; name: string; specifications: string; cost: Money }

export interface CartItemDTO {
  listingId: number; listingType: string; name: string; currencyCode: string; unitPrice: Money; quantity: number;
  lineTotal: Money; problem: string | null;
}
export interface CartDTO { version: string; items: CartItemDTO[] }
export interface CheckoutLineDTO {
  listingId: number; listingType: string; name: string; unitPrice: Money; quantity: number; lineTotal: Money;
  taxAmount: Money; problem: string | null;
}
export interface CheckoutPreviewDTO {
  cartVersion: string; currencyCode: string; lines: CheckoutLineDTO[]; itemsSubtotal: Money; shippingAmount: Money;
  taxAmount: Money; totalAmount: Money; problems: string[]; committable: boolean;
}

export interface OrderItemDTO {
  orderItemId: number; listingId: number; listingType: string; artworkId: number; artworkTitle: string;
  listingName: string; artistId: number; artistName: string; specifications: string | null; quantity: number;
  unitPrice: Money; lineSubtotal: Money; taxAmount: Money; assetIds: number[];
  fulfillment: { status: string; carrier: string | null; trackingReference: string | null; deliveredAt: Iso | null } | null;
  refundStatus: string | null;
}
export interface OrderDTO {
  orderId: number; status: string; createdAt: Iso; expiresAt: Iso; paidAt: Iso | null; currencyCode: string;
  itemsSubtotal: Money; shippingAmount: Money; taxAmount: Money; totalAmount: Money; billingName: string;
  items: OrderItemDTO[];
  shippingAddress: ShippingAddressDTO | null;
  payment: { paymentId: number; amount: Money; currencyCode: string; status: string } | null;
}
export interface PaymentAttemptDTO { attemptId: number; orderId: number; paymentUrl: string; expiresAt: Iso }
export interface QuotePaymentAttemptDTO {
  attemptId: number; commissionId: number; quoteId: number; installment: number; amount: Money; paymentUrl: string;
  expiresAt: Iso;
}

export interface PurchaseDTO {
  entitlementId: number; grantedAt: Iso; orderId: number; orderItemId: number; listingId: number; listingType: string;
  artworkTitle: string; listingName: string; artistName: string;
  files: { assetId: number; fileName: string; contentType: string; byteLength: number }[];
}

export interface RefundTransferDTO {
  transferId: number; amount: Money; currencyCode: string; status: string; transferReference: string | null;
  createdAt: Iso; succeededAt: Iso | null;
}
export interface RefundRequestDTO {
  refundRequestId: number; orderItemId: number | null; commissionId: number | null; status: string; reason: string;
  requestedAt: Iso; decidedAt: Iso | null; decisionReason: string | null; refundPercent: number | null;
  shippingAmount: Money | null; transfer: RefundTransferDTO | null;
}
export interface CommissionRefundDTO {
  refundRequestId: number; commissionId: number; status: string; refundPercent: number | null; reason: string;
  requestedAt: Iso; decidedAt: Iso | null; decisionReason: string | null; transfer: RefundTransferDTO | null;
}

export interface ShippingAddressDTO {
  recipientName: string; phone: string; line1: string; line2: string | null; ward: string; district: string | null;
  provinceCode: string; provinceName: string; postalCode: string | null; countryCode: string;
}
export interface FulfillmentDTO {
  orderItemId: number; orderId: number; status: string; carrier: string | null; trackingReference: string | null;
  deliveredAt: Iso | null; updatedAt: Iso; artworkTitle: string; listingName: string; specifications: string | null;
  quantity: number; shippingAddress: ShippingAddressDTO | null;
}
// GET /payments/attempts/{vnp_TxnRef}: only the signed VNPay IPN changes status.
export interface PaymentAttemptStatusDTO {
  attemptRef: string; status: 'INITIATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXCEPTION';
  orderId: number | null; commissionId: number | null; quoteId: number | null; installment: number | null;
}
export interface ProceedsDTO {
  proceedsId: number; orderItemId: number | null; quoteId: number | null; installment: number | null; amount: Money;
  currencyCode: string; status: string; eligibleAt: Iso | null; paidAt: Iso | null;
}
export interface ReleaseDTO {
  payoutId: number; artistId: number; proceedsId: number; amount: Money; currencyCode: string; status: string;
  transferReference: string | null; createdAt: Iso; paidAt: Iso | null;
}
export interface ReconciliationDTO {
  clean: boolean; balances: { account: string; amount: Money }[];
  mismatches: { check: string; recordType: string; recordId: number }[];
}

export interface CommissionAttachmentDTO {
  attachmentId: number; uploadedByUserId: number; originalName: string; contentType: string; byteLength: number;
  createdAt: Iso;
}
export interface CommissionSummaryDTO {
  commissionId: number; customerId: number; artistId: number; status: string; customerNameSnapshot: string;
  artistNameSnapshot: string; createdAt: Iso; completedAt: Iso | null;
}
export interface CommissionDTO extends CommissionSummaryDTO {
  requestDescription: string; allowPublicDisplay: boolean; attachments: CommissionAttachmentDTO[];
}
export interface CommissionMessageDTO { messageId: number; senderUserId: number; body: string; sentAt: Iso }
export interface CommissionQuoteDTO {
  quoteId: number; commissionId: number; sequenceNo: number; scopeText: string; expectedCompletionTerms: string;
  price: Money; taxAmount: Money; totalAmount: Money; firstPaymentAmount: Money; finalPaymentAmount: Money;
  currencyCode: string; status: string; offeredAt: Iso; acceptedAt: Iso | null; paidAt: Iso | null;
  artistTermsId: number | null;
}
export interface DeliverableFileDTO { fileId: number; originalName: string; contentType: string; byteLength: number }
export interface RevisionRequestDTO {
  revisionId: number; deliverableId: number; requestedByUserId: number; details: string; requestedAt: Iso;
}
export interface CommissionDeliverableDTO {
  deliverableId: number; commissionId: number; versionNo: number; notes: string | null; submittedAt: Iso;
  files: DeliverableFileDTO[]; revisionRequests: RevisionRequestDTO[];
}
export interface CancellationRequestDTO {
  cancellationId: number; commissionId: number; requestedByUserId: number; reason: string; status: string;
  createdAt: Iso; resolvedAt: Iso | null; refundPercent: number | null;
}
export interface CommissionDisputeDTO {
  disputeId: number; commissionId: number; openedByUserId: number; reason: string; status: string;
  outcome: string | null; decidedByStaffId: number | null; resolutionReason: string | null; openedAt: Iso;
  resolvedAt: Iso | null;
}
export interface DisputeEvidenceDTO {
  dispute: CommissionDisputeDTO; commission: CommissionSummaryDTO; messages: CommissionMessageDTO[];
  quotes: CommissionQuoteDTO[]; deliverables: CommissionDeliverableDTO[];
  cancellationRequests: CancellationRequestDTO[];
}
