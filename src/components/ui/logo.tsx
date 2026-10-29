import Image from "next/image";
import clsx from "clsx";

export function Logo({ tone = "light", className, priority }: { tone?: "light" | "dark"; className?: string; priority?: boolean }) {
  return (
    <Image
      src={tone === "dark" ? "/brand/logo-on-dark-640.png" : "/brand/logo-640.png"}
      alt="ShopNear BD"
      width={640}
      height={184}
      priority={priority}
      className={clsx("w-auto max-w-none shrink-0 self-start object-contain", className)}
    />
  );
}
