import { commissions, orders } from '../api/endpoints';

// VNPay sends the buyer back to /payment/return?vnp_TxnRef=…; that page looks the attempt up with
// GET /payments/attempts/{ref}, so nothing needs to be remembered in the browser.
export async function payOrder(orderId: number) {
  const attempt = await orders.pay(orderId);
  window.location.assign(attempt.paymentUrl);
}

export async function payQuote(commissionId: number, quoteId: number) {
  const attempt = await commissions.payQuote(commissionId, quoteId);
  window.location.assign(attempt.paymentUrl);
}
