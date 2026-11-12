import { redirect } from "next/navigation";

/** Preserve legacy bookmarks and query parameters; saved preferences stay in /api/invest. */
export default async function Invest({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  redirect(`/money${query.size ? `?${query}` : ""}`);
}
