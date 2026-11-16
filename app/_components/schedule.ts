export const OPEN_MIN = 6 * 60 + 30;
export const CLOSE_MIN = 16 * 60;   

export const fmtTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;