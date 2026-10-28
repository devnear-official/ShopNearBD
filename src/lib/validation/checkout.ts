import { z } from "zod";
import { DISTRICTS } from "../shipping";
import { bdPhone, uuid } from "./common";

export const cartLine = z.object({ variantId: uuid, quantity: z.number().int().min(1).max(20) });
export const cartLines = z.array(cartLine).min(1, "Your cart is empty").max(30);

export const deliverySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: bdPhone,
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email or leave it empty")]).optional(),
  district: z.string().refine((d) => DISTRICTS.includes(d), "Choose your district"),
  zone: z.string().max(40).optional(),
  area: z.string().trim().max(80).optional(),
  address: z.string().trim().min(8, "Add house, road and area so the courier can find you").max(300),
  note: z.string().trim().max(300).optional(),
});

export const paymentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("cod") }),
  z.object({
    method: z.enum(["bkash_manual", "nagad_manual"]),
    // Customers may pay now (with TrxID) or later from the order page.
    payLater: z.boolean().default(false),
    senderNumber: z.string().optional(),
    transactionId: z.string().optional(),
  }).superRefine((v, ctx) => {
    if (v.payLater) return;
    const sender = bdPhone.safeParse(v.senderNumber ?? "");
    if (!sender.success) ctx.addIssue({ code: "custom", path: ["senderNumber"], message: "Enter the number you paid from" });
    if (!/^[A-Za-z0-9]{6,20}$/.test((v.transactionId ?? "").trim())) ctx.addIssue({ code: "custom", path: ["transactionId"], message: "Enter the Transaction ID from the payment SMS" });
  }),
]);

export const checkoutSchema = z.object({
  items: cartLines,
  delivery: deliverySchema,
  payment: paymentSchema,
  couponCode: z.string().trim().max(32).optional(),
  idempotencyKey: z.string().min(16).max(100),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type DeliveryInput = z.input<typeof deliverySchema>;
