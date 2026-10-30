"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import clsx from "clsx";
import { deleteProduct } from "@/actions/admin-products";
import { toast } from "./form";

/** Deletes a product after a confirmation. Used in the product list and on the editor page. */
export function DeleteProductButton({ id, name, redirectTo, className, label }: { id: string; name: string; redirectTo?: string; className?: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onClick = () => {
    if (!window.confirm(`Delete "${name}"?\n\nThe product, its variants and its photos are removed for good. Past orders keep their own record of it.`)) return;
    start(async () => {
      const r = await deleteProduct(id);
      if (!r.ok) return toast(r.error, "error");
      toast("Product deleted.");
      if (redirectTo) router.replace(redirectTo);
      else router.refresh();
    });
  };
  return (
    <button type="button" onClick={onClick} disabled={pending} aria-label={`Delete ${name}`}
      className={clsx("inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-flame transition hover:bg-flame/10 disabled:opacity-50", className)}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{label ?? <span className="sr-only sm:not-sr-only">Delete</span>}
    </button>
  );
}
