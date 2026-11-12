/** Demo store catalog. Prices are set here on the server; the browser never sends a price. */
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  alternativeId?: string;
}

export const CATALOG: Product[] = [
  {
    id: "aero-14",
    name: "Aero 14 Laptop",
    price: 900,
    description: "14-inch, 16 GB RAM, 512 GB SSD",
    alternativeId: "aero-13",
  },
  {
    id: "aero-13",
    name: "Aero 13 Laptop",
    price: 600,
    description: "13-inch, 16 GB RAM, 256 GB SSD",
  },
  {
    id: "quiet-buds",
    name: "Quiet Buds Pro",
    price: 249,
    description: "Noise-cancelling earbuds",
  },
];

export function getProduct(id: string): Product | undefined {
  return CATALOG.find((p) => p.id === id);
}
