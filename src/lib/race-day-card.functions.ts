import { createServerFn } from "@tanstack/react-start";

export const getRaceDayCardDisplay = createServerFn({ method: "GET" })
  .inputValidator((input: { date?: string; venue?: string; raceNumbers?: number[]; needGoing?: boolean }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input?.date ?? ""))) throw new Error("日期格式無效");
    if (input?.venue !== "ST" && input?.venue !== "HV") throw new Error("馬場無效");
    const raceNumbers = [...new Set((input.raceNumbers ?? []).map((n) => Number(n)))]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 14)
      .slice(0, 14);
    return {
      date: String(input.date),
      venue: input.venue === "HV" ? "HV" as const : "ST" as const,
      raceNumbers,
      needGoing: input.needGoing !== false,
    };
  })
  .handler(async ({ data }) => {
    const { loadRaceDayCardDisplay } = await import("./race-day-card.server");
    return loadRaceDayCardDisplay(data);
  });
