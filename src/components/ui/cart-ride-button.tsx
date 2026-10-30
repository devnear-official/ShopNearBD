"use client";
import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { buttonClass } from "./button";

export type RideState = "idle" | "busy" | "done";

/**
 * Place-order button: while the order is being placed, a cart rolls in from the
 * left, a parcel drops into it and it speeds off to the right (looping until the
 * server answers); then a tick confirms. CSS-only animation (transform/opacity).
 */
export function CartRideButton({ state, children, busyLabel = "Placing your order…", doneLabel = "Order placed!", variant = "primary", className, disabled, ...props }:
  Omit<ComponentProps<"button">, "children"> & { state: RideState; children: ReactNode; busyLabel?: string; doneLabel?: string; variant?: "primary" | "tangerine" | "dark" }) {
  return (
    <button
      {...props}
      disabled={disabled || state !== "idle"}
      aria-busy={state === "busy"}
      data-ride={state}
      className={buttonClass(variant, "lg", clsx("ride-btn disabled:opacity-100", state === "done" && "!bg-mint !text-white", className))}
    >
      <span className={clsx("ride-label inline-flex items-center gap-2", state !== "idle" && "ride-label-out")}>{children}</span>
      {state === "busy" && (
        <span aria-hidden className="ride-lane">
          <span className="ride-cart">
            <span className="ride-streaks"><span /><span /></span>
            <span className="relative"><span className="ride-box" /><CartGlyph /></span>
          </span>
        </span>
      )}
      {state === "done" && <span className="ride-done"><Check className="size-5" /> {doneLabel}</span>}
      <span className="sr-only" role="status">{state === "busy" ? busyLabel : state === "done" ? doneLabel : ""}</span>
    </button>
  );
}

function CartGlyph() {
  return (
    <svg viewBox="0 0 40 32" className="h-7 w-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h6l4.5 17h19L36 9H11" />
      <circle className="ride-wheel" cx="15" cy="27.5" r="2.6" fill="currentColor" stroke="none" />
      <circle className="ride-wheel" cx="29" cy="27.5" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
