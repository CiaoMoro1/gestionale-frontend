export interface Ordine {
  id: string;
  number: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  shipping_address?: string | null;
  shipping_zip?: string | null;
  shipping_city?: string | null;
  shipping_province?: string | null;
  shipping_country?: string | null;
  channel: string;
  total: number;
  payment_status: string;
  fulfillment_status: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string | null;
  quantity: number;
  products?: {
    sku?: string | null;
    ean?: string | null;
    product_title?: string | null;
    variant_title?: string | null;
    inventory?: {
      inventario?: number;
      disponibile?: number;
      riservato_sito?: number;
    } | null;
  } | null;
  [key: string]: unknown;
}