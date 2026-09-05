import { z } from "zod";
import { getCatalogContest, getContestAccessOption } from "./catalog";

export const contestCartSchema = z
  .object({
    attemptId: z.uuid(),
    items: z
      .array(
        z
          .object({
            productSlug: z.string().min(1).max(180),
            accessKey: z.enum(["6m", "12m"]),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict()
  .superRefine((cart, ctx) => {
    if (
      new Set(cart.items.map((item) => item.productSlug)).size !==
      cart.items.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Escolha apenas um período por concurso.",
      });
    if (cart.items.some((item) => !getCatalogContest(item.productSlug)))
      ctx.addIssue({ code: "custom", message: "Concurso inválido." });
    const category = getCatalogContest(
      cart.items[0]?.productSlug,
    )?.categorySlug;
    if (
      cart.items.some(
        (item) =>
          getCatalogContest(item.productSlug)?.categorySlug !== category,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Adicionais devem pertencer à carreira escolhida.",
      });
  });

export function contestCartTotal(items: { accessKey: string }[]) {
  return items.reduce(
    (total, item) =>
      total + (getContestAccessOption(item.accessKey)?.amountCents ?? 0),
    0,
  );
}

export function orderPaymentMatches(input: {
  expectedCents: number;
  actualCents: number | null;
  currency: string | null;
  mode: string | null;
  paymentStatus: string;
  expectedLive: boolean;
  actualLive: boolean;
}) {
  return (
    input.expectedCents === input.actualCents &&
    input.currency === "brl" &&
    input.mode === "payment" &&
    input.paymentStatus === "paid" &&
    input.expectedLive === input.actualLive
  );
}
