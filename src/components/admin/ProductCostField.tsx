import { Lock } from "lucide-react";
import { formatNaira } from "../../lib/finance";

interface ProductCostFieldProps {
  /** null = not entered (flagged as missing in Finances); 0 = genuinely none used. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** The typical cost for this booking's category, if one is set (shown as a hint). */
  typical?: number | null;
  category?: string | null;
  label?: string;
}

/**
 * "Products you'll use" — admin-only. Stored on bookings.product_cost, which clients can never
 * read (see supabase/migrations/024_finances.sql). Keeps "not entered" and "₦0" distinct.
 */
export function ProductCostField({ value, onChange, typical, category, label = "Products you'll use" }: ProductCostFieldProps) {
  return (
    <div data-testid="product-cost-field">
      <label className="text-[11px] text-text-muted font-semibold mb-1 flex items-center gap-1">
        <Lock size={11} aria-hidden="true" /> {label} <span className="font-normal">(private — not shown to client)</span>
      </label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-[13px]">₦</span>
        <input
          type="text" inputMode="numeric" aria-label={`${label} (private)`}
          value={value === null ? "" : value.toLocaleString("en-US")}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits ? parseInt(digits, 10) : null);
          }}
          placeholder={typical != null ? typical.toLocaleString("en-US") : "e.g. 3,000"}
          className="w-full py-2 pr-2 pl-5 rounded-md border border-border bg-bg-alt text-text outline-none box-border text-[13px] min-h-11 md:min-h-0"
        />
      </div>
      {typical != null && (
        <p className="text-[11px] text-text-muted mt-1 mb-0">
          Typical for {category ?? "this category"}: {formatNaira(typical)}
          {value !== typical && (
            <button type="button" onClick={() => onChange(typical)} className="ml-2 bg-transparent border-none p-0 text-gold underline cursor-pointer text-[11px]">Use typical</button>
          )}
        </p>
      )}
    </div>
  );
}
