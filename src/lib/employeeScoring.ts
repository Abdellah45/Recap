export type DayData = {
  date: string;
  logged: boolean;
  mood: string | null;
  hasBlocker: boolean;
};

export type EmployeeStats = {
  consistency: number;   // 0–33.33
  reliability: number;   // 0–33.33
  blockerScore: number;  // 0–33.33
  overall: number;       // 0–100
  trend: "up" | "down" | "stable";
  logsInPeriod: number;
  blockedDays: number;
};

export function computeStats(dailyData: DayData[], period = 28): EmployeeStats {
  const slice = dailyData.slice(-period);
  const total = slice.length;
  const logged = slice.filter((d) => d.logged).length;
  const onTrack = slice.filter((d) => d.mood === "on_track").length;
  const blocked = slice.filter((d) => d.mood === "blocked").length;

  const consistency  = total > 0 ? (logged / total) * 33.33 : 0;
  const reliability  = logged > 0 ? (onTrack / logged) * 33.33 : 0;
  const blockerScore = logged > 0 ? ((logged - blocked) / logged) * 33.33 : 16.67;
  const overall = Math.round(consistency + reliability + blockerScore);

  const half = Math.floor(period / 2);
  const firstRate  = half > 0 ? slice.slice(0, half).filter((d) => d.logged).length / half : 0;
  const secondRate = (period - half) > 0 ? slice.slice(half).filter((d) => d.logged).length / (period - half) : 0;
  const trend: "up" | "down" | "stable" =
    secondRate > firstRate + 0.15 ? "up" :
    secondRate < firstRate - 0.15 ? "down" : "stable";

  return { consistency, reliability, blockerScore, overall, trend, logsInPeriod: logged, blockedDays: blocked };
}

export function scoreLabel(score: number) {
  if (score >= 90) return { label: "Excellent",       color: "text-[#006b5f]", bg: "bg-[#d4f5e9]", ring: "#00b894" };
  if (score >= 75) return { label: "Performing",      color: "text-[#1f108e]", bg: "bg-[#eef0ff]", ring: "#1f108e" };
  if (score >= 50) return { label: "Developing",      color: "text-[#7c4f00]", bg: "bg-[#fff3d4]", ring: "#f59e0b" };
  return              { label: "Needs Attention", color: "text-[#7c1f00]", bg: "bg-[#ffdbca]", ring: "#ff4d00" };
}
