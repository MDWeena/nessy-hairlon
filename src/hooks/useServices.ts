import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { assertAuthenticated, handleWriteError } from "../lib/authGuard";
import { uploadImage } from "../lib/cloudinary";
import { resolveIcon } from "../lib/icons";
import type { ServiceCategory, ServiceItem } from "../types";
import type { Database } from "../types/database";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

function formatPriceRange(min: number | null, max: number | null): string | undefined {
  if (min == null || max == null) return undefined;
  return `₦${min.toLocaleString()} – ₦${max.toLocaleString()}`;
}

function rowToServiceItem(row: ServiceRow): ServiceItem {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    priceRange: formatPriceRange(row.price_range_min, row.price_range_max),
    desc: row.description,
    duration: row.duration,
    icon: resolveIcon(row.icon_name),
    imageUrl: row.image_url,
  };
}

function groupByCategory(rows: ServiceRow[]): ServiceCategory[] {
  const order: string[] = [];
  const map = new Map<string, ServiceItem[]>();
  for (const row of rows) {
    if (!map.has(row.category)) {
      map.set(row.category, []);
      order.push(row.category);
    }
    map.get(row.category)!.push(rowToServiceItem(row));
  }
  return order.map(cat => ({ cat, items: map.get(cat)! }));
}

export interface ServiceInput {
  category: string;
  name: string;
  description: string;
  duration: string;
  price: string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  iconName: string;
  imageUrl?: string | null;
}

interface UseServicesResult {
  services: ServiceCategory[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addService: (input: ServiceInput) => Promise<void>;
  updateService: (id: string, input: Partial<ServiceInput>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  uploadServiceImage: (file: File) => Promise<string>;
}

export function useServices(): UseServicesResult {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const addService = useCallback(async (input: ServiceInput) => {
    await assertAuthenticated();
    const { error: insertError } = await supabase.from("services").insert({
      category: input.category,
      name: input.name,
      description: input.description,
      duration: input.duration,
      price: input.price,
      price_range_min: input.priceRangeMin,
      price_range_max: input.priceRangeMax,
      icon_name: input.iconName,
      image_url: input.imageUrl ?? null,
    });
    if (insertError) await handleWriteError(insertError);
    await fetchServices();
  }, [fetchServices]);

  const updateService = useCallback(async (id: string, input: Partial<ServiceInput>) => {
    await assertAuthenticated();
    const patch: Database["public"]["Tables"]["services"]["Update"] = {};
    if (input.category !== undefined) patch.category = input.category;
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.duration !== undefined) patch.duration = input.duration;
    if (input.price !== undefined) patch.price = input.price;
    if (input.priceRangeMin !== undefined) patch.price_range_min = input.priceRangeMin;
    if (input.priceRangeMax !== undefined) patch.price_range_max = input.priceRangeMax;
    if (input.iconName !== undefined) patch.icon_name = input.iconName;
    if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;

    const { error: updateError } = await supabase.from("services").update(patch).eq("id", id);
    if (updateError) await handleWriteError(updateError);
    await fetchServices();
  }, [fetchServices]);

  const deleteService = useCallback(async (id: string) => {
    await assertAuthenticated();
    const { error: deleteError } = await supabase.from("services").delete().eq("id", id);
    if (deleteError) await handleWriteError(deleteError);
    await fetchServices();
  }, [fetchServices]);

  const uploadServiceImage = useCallback(async (file: File): Promise<string> => {
    await assertAuthenticated();
    const { data: sessionData } = await supabase.auth.getSession();
    return uploadImage(file, sessionData.session?.access_token);
  }, []);

  return {
    services: groupByCategory(rows),
    loading,
    error,
    refetch: fetchServices,
    addService,
    updateService,
    deleteService,
    uploadServiceImage,
  };
}
