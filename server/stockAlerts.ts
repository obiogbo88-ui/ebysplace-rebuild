import * as db from "./db";
import { sendOwnerSmsAndWhatsAppSafely } from "./customerNotifications";

/**
 * Best-effort, non-blocking check for products that just went out of stock.
 * Called after db.markOrderPaid() from the Stripe webhook — never touches
 * markOrderPaid or the stock-decrement logic itself, only reads the
 * already-updated state afterward. Errors are caught by the caller.
 *
 * Note: only covers products in the regular products/productVariants
 * tables. Products backed by the separate Supabase product store (see
 * listSupabaseProducts in db.ts) aren't checked here.
 */
export async function checkAndAlertLowStockAfterPurchase(orderItems: Array<{ productId: number; productName: string }>) {
  const productIds = Array.from(new Set(orderItems.map((item) => item.productId)));
  if (!productIds.length) return;

  const products = await db.getProductsById(productIds);
  const nowOutOfStock = products.filter((product) => product.stockStatus === "out_of_stock");
  if (!nowOutOfStock.length) return;

  const summary = [
    `${nowOutOfStock.length} Eby's Place product${nowOutOfStock.length === 1 ? "" : "s"} just sold out:`,
    ...nowOutOfStock.map((product) => `- ${product.name}`),
  ].join("\n");
  await sendOwnerSmsAndWhatsAppSafely(summary);
}
