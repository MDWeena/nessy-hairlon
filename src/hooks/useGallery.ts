import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { assertAuthenticated, handleWriteError } from "../lib/authGuard";
import { uploadImage } from "../lib/cloudinary";
import type { Database } from "../types/database";

type GalleryRow = Database["public"]["Tables"]["gallery"]["Row"];

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface GalleryEntry {
  dayOfWeek: string;
  styleName: string;
  imageUrl: string | null;
}

interface UseGalleryResult {
  entries: GalleryEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateStyleName: (dayOfWeek: string, styleName: string) => Promise<void>;
  uploadImageForDay: (dayOfWeek: string, file: File) => Promise<void>;
}

export function useGallery(): UseGalleryResult {
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from("gallery").select("*");
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    const sorted = [...(data ?? [])].sort(
      (a, b) => DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week)
    );
    setRows(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const updateStyleName = useCallback(async (dayOfWeek: string, styleName: string) => {
    await assertAuthenticated();
    const { error: updateError } = await supabase.from("gallery")
      .update({ style_name: styleName, updated_at: new Date().toISOString() }).eq("day_of_week", dayOfWeek);
    if (updateError) await handleWriteError(updateError);
    await fetchGallery();
  }, [fetchGallery]);

  const uploadImageForDay = useCallback(async (dayOfWeek: string, file: File) => {
    await assertAuthenticated();
    const { data: sessionData } = await supabase.auth.getSession();
    const imageUrl = await uploadImage(file, sessionData.session?.access_token);
    const { error: updateError } = await supabase.from("gallery")
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() }).eq("day_of_week", dayOfWeek);
    if (updateError) await handleWriteError(updateError);
    await fetchGallery();
  }, [fetchGallery]);

  return {
    entries: rows.map(r => ({ dayOfWeek: r.day_of_week, styleName: r.style_name, imageUrl: r.image_url })),
    loading, error, refetch: fetchGallery, updateStyleName, uploadImageForDay,
  };
}
