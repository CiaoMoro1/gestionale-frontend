export interface Inventory {
  inventario: number;
  disponibile?: number | null;
  in_produzione?: number | null;
  riservato_sito?: number | null;
}

export interface Product {
  id: string;
  sku: string | null;
  ean: string | null;
  product_title: string | null;
  price?: number | null;
  inventory?: Inventory | null;
  inventario?: number | null;
}

export interface Order {
  id: string;
  number: string;
  customer_name: string;
  channel: string;
  total: number;
  payment_status: string;
  fulfillment_status?: string | null;
  created_at: string;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_province?: string | null;
  shipping_zip?: string | null;
  shipping_country?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  stato_ordine?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string;
  quantity: number;
  products?: {
    sku?: string | null;
    ean?: string | null;
    product_title?: string | null;
    variant_title?: string | null;
    inventory?: Inventory | null;
  } | null;
}

