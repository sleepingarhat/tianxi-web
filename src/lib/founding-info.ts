import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FoundingInfo = { total: number; threshold: number; founding_slots: number; remaining: number; gate_open: boolean };
export function useFoundingInfo() {
  return useQuery({
    queryKey: ["founding-info"],
    queryFn: async (): Promise<FoundingInfo> => {
      const { data, error } = await supabase.rpc("public_founding_info");
      if (error) throw error;
      const r = data as unknown as FoundingInfo;
      if (!r || !Number.isInteger(r.total) || !Number.isInteger(r.threshold) || r.threshold <= 0 || !Number.isInteger(r.founding_slots) || !Number.isInteger(r.remaining) || typeof r.gate_open !== "boolean") throw new Error("暫時未能讀取創始名額");
      return r;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}