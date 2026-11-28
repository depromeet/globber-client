export const dynamic = "force-dynamic";

import { logger } from "@globber/shared/utils/logger";

import { NationSelectClient } from "@/components/nationSelect/NationSelectClient";
import { fetchCities } from "@/services/cityService";

export default async function NationSelectPage() {
  try {
    const initialCities = await fetchCities({ limit: 53 });
    return <NationSelectClient initialCities={initialCities} />;
  } catch (error) {
    logger.error("Failed to fetch initial cities:", error);
    return <NationSelectClient initialCities={[]} isInitialCitiesError />;
  }
}
