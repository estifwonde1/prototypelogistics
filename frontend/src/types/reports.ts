export interface BinCardEntry {
  id: number;
  source_id: number | null;
  destination_id: number | null;
  unit_id: number | null;
  transaction_date: string;
  quantity: number;
  balance?: number | null;
  reference_no?: string | null;
}
