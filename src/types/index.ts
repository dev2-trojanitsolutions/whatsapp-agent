export interface Customer {
  id: string;
  phone_e164: string;
  name: string | null;
  company: string | null;
  status: "prospect" | "customer";
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  customer_id: string;
  human_takeover: boolean;
  updated_at: string;
}

export interface CatalogItem {
  name: string;
  bestFor: string;
  priceBand: string;
  notes: string;
}

export interface CatalogCategory {
  category: string;
  items: CatalogItem[];
}
