import { useEffect, useState } from "react";

export const OPEN_MIN = 6 * 60 + 30;          
export const CLOSE_MIN = 16 * 60;   
const TIMEZONE = "Asia/Jakarta";         

export const fmtTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function minutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  return h * 60 + m;
}

// null until the first check, so the first render never flashes "closed"
export function useIsOperating() {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => {
      const t = minutesNow();
      setOpen(t >= OPEN_MIN && t < CLOSE_MIN);
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);
  return open;
}