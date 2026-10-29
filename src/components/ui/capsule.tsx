"use client";
import type { CSSProperties, MouseEvent } from "react";
import clsx from "clsx";

/**
 * Press feedback for capsule buttons: the pressed colour floods the button from the
 * exact point of the tap (a circular wipe), and the label/icon colour cross-fades with it.
 * Pure CSS transition — toggle `on` to wipe in and back out.
 */
export type PressOrigin = { x: number; y: number } | null;

/** Where inside the button the press happened (centre for keyboard activation). */
export function pressOrigin(e: MouseEvent<HTMLElement>): PressOrigin {
  const r = e.currentTarget.getBoundingClientRect();
  const keyboard = e.clientX === 0 && e.clientY === 0;
  return { x: keyboard ? r.width / 2 : e.clientX - r.left, y: keyboard ? r.height / 2 : e.clientY - r.top };
}

export function CapsuleFill({ on, origin, className }: { on: boolean; origin: PressOrigin; className?: string }) {
  const style = { "--ox": `${origin?.x ?? 0}px`, "--oy": `${origin?.y ?? 0}px` } as CSSProperties;
  return (
    <span
      aria-hidden
      data-on={on}
      style={style}
      className={clsx(
        "pointer-events-none absolute inset-0 bg-ink [clip-path:circle(0px_at_var(--ox)_var(--oy))] transition-[clip-path] duration-700 ease-[var(--ease-snap)] data-[on=true]:[clip-path:circle(160%_at_var(--ox)_var(--oy))]",
        className,
      )}
    />
  );
}

/** A soft highlight that glides across the capsule on hover. */
export function CapsuleShine() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -translate-x-full skew-x-[-20deg] bg-white/25 transition-transform duration-700 ease-out group-hover/cap:translate-x-[460%]" />
  );
}
