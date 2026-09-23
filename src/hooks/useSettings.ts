import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { assertAuthenticated, handleWriteError } from "../lib/authGuard";
import type { Database, Json } from "../types/database";

type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];

export interface SettingsMap {
  business_name: string;
  phone: string;
  instagram: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  deposit_percentage: number;
  slot_duration_minutes: number;
  min_booking_notice_hours: number;
}

interface UseSettingsResult {
  settings: Partial<SettingsMap>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateSetting: (key: keyof SettingsMap, value: string | number) => Promise<void>;
}

export function useSettings(): UseSettingsResult {
  const [rows, setRows] = useState<SettingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from("settings").select("*");
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(async (key: keyof SettingsMap, value: string | number) => {
    await assertAuthenticated();
    const { error: upsertError } = await supabase.from("settings")
      .upsert({ key, value: value as Json }, { onConflict: "key" });
    if (upsertError) await handleWriteError(upsertError);
    await fetchSettings();
  }, [fetchSettings]);

  const settings = Object.fromEntries(rows.map(r => [r.key, r.value])) as Partial<SettingsMap>;

  return { settings, loading, error, refetch: fetchSettings, updateSetting };
}
