"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Secondary analysis starts expanded on desktop, and stays discoverable on mobile. */
export default function ResponsiveDetails({ children, className, expanded = false, startCollapsed = false }: {
  children: ReactNode; className?: string; expanded?: boolean; startCollapsed?:boolean;
}) {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 851px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return <details className={className} open={expanded || (!startCollapsed && desktop) || undefined}>{children}</details>;
}
