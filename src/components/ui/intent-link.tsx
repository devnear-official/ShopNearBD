"use client";
import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A link that prefetches only when the shopper shows intent (hover, touch,
 * keyboard focus) instead of as soon as it scrolls into view. Product grids
 * have dozens of links; prefetching all of them on a phone connection slows
 * down the images the shopper is actually looking at.
 */
export function IntentLink({ onMouseEnter, onTouchStart, onFocus, ...props }: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [active, setActive] = useState(false);
  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(e) => { setActive(true); onMouseEnter?.(e); }}
      onTouchStart={(e) => { setActive(true); onTouchStart?.(e); }}
      onFocus={(e) => { setActive(true); onFocus?.(e); }}
    />
  );
}
