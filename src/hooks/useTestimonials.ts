import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Story } from "../types";
import type { Database } from "../types/database";

type TestimonialRow = Database["public"]["Tables"]["testimonials"]["Row"];

export interface TestimonialInput {
  name: string;
  text: string;
  stars: number;
}

interface UseTestimonialsResult {
  testimonials: Story[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addTestimonial: (input: TestimonialInput) => Promise<void>;
  updateTestimonial: (id: string, input: Partial<TestimonialInput>) => Promise<void>;
  toggleVisibility: (id: string) => Promise<void>;
  deleteTestimonial: (id: string) => Promise<void>;
}

/** RLS restricts anon reads to `is_visible = true`; an authenticated admin session sees all rows. */
export function useTestimonials(): UseTestimonialsResult {
  const [rows, setRows] = useState<TestimonialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("testimonials").select("*").order("sort_order", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const addTestimonial = useCallback(async (input: TestimonialInput) => {
    const { error: insertError } = await supabase.from("testimonials").insert({
      client_name: input.name, review_text: input.text, stars: input.stars,
    });
    if (insertError) throw new Error(insertError.message);
    await fetchTestimonials();
  }, [fetchTestimonials]);

  const updateTestimonial = useCallback(async (id: string, input: Partial<TestimonialInput>) => {
    const patch: Database["public"]["Tables"]["testimonials"]["Update"] = {};
    if (input.name !== undefined) patch.client_name = input.name;
    if (input.text !== undefined) patch.review_text = input.text;
    if (input.stars !== undefined) patch.stars = input.stars;

    const { error: updateError } = await supabase.from("testimonials").update(patch).eq("id", id);
    if (updateError) throw new Error(updateError.message);
    await fetchTestimonials();
  }, [fetchTestimonials]);

  const toggleVisibility = useCallback(async (id: string) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    const { error: updateError } = await supabase.from("testimonials")
      .update({ is_visible: !row.is_visible }).eq("id", id);
    if (updateError) throw new Error(updateError.message);
    await fetchTestimonials();
  }, [rows, fetchTestimonials]);

  const deleteTestimonial = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from("testimonials").delete().eq("id", id);
    if (deleteError) throw new Error(deleteError.message);
    await fetchTestimonials();
  }, [fetchTestimonials]);

  return {
    testimonials: rows.map(r => ({ id: r.id, name: r.client_name, text: r.review_text, stars: r.stars, visible: r.is_visible })),
    loading, error, refetch: fetchTestimonials, addTestimonial, updateTestimonial, toggleVisibility, deleteTestimonial,
  };
}
