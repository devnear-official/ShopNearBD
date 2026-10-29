import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · ShopNear Admin" }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#eef2f8]">{children}</div>;
}
