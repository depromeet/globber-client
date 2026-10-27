export const dynamic = "force-dynamic";

import { NationSelectClient } from "@/components/nationSelect/NationSelectClient";
import { fetchCities } from "@/services/cityService";

export default async function NationSelectPage() {
  try {
    const initialCities = await fetchCities({ limit: 53 });
    return <NationSelectClient initialCities={initialCities} />;
  } catch (error) {
    console.error("Failed to fetch initial cities:", error);
    return <NationSelectClient initialCities={[]} />;
  }
}
