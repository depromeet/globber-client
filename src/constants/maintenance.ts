export const MAINTENANCE_PATH = "/maintenance";

// 점검 중에도 점검 화면을 그리는 데 필요한 경로 (정적 리소스, Sentry 터널)
export const MAINTENANCE_BYPASS_PATHS: readonly string[] = [
  MAINTENANCE_PATH,
  "/_next",
  "/assets",
  "/icons",
  "/monitoring",
  "/favicon.svg",
  "/favicon.png",
  "/robots.txt",
];

export const isMaintenanceMode = () => process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
