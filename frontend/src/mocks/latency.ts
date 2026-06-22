/** Small artificial delay so TanStack Query loading states are visible in dev. */
export function latency(min = 120, max = 380): Promise<void> {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((resolve) => setTimeout(resolve, ms));
}
