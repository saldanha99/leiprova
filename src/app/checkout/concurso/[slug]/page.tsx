import { notFound } from "next/navigation";
import Link from "next/link";
import { ContestCart } from "@/components/checkout/contest-cart";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import { requireUser } from "@/lib/auth";
import {
  CONTEST_CATALOG,
  getCatalogContest,
  getContestAccessOption,
} from "@/lib/commerce/catalog";
import { listReleasedContestProducts } from "@/lib/commerce/store";
import { isDatabaseConfigured } from "@/lib/db/client";
import {
  getCheckoutAvailability,
  isContestCheckoutEnabled,
} from "@/lib/stripe";

export default async function ContestCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ acesso?: string }>;
}) {
  const { slug } = await params;
  const contest = getCatalogContest(slug);
  if (!contest) notFound();
  const access =
    getContestAccessOption((await searchParams).acesso ?? "monthly")?.key ??
    "monthly";
  const released =
    isDatabaseConfigured() && isContestCheckoutEnabled()
      ? await listReleasedContestProducts()
      : [];
  const product = released.find((item) => item.slug === slug);
  const priceId =
    access === "monthly"
      ? product?.stripePriceMonthly
      : product?.stripePriceAnnual;
  const available = Boolean(
    priceId &&
      getCheckoutAvailability(
        { stripePriceEnv: "UNUSED_CONTEST_PRICE" },
        priceId,
      ).available,
  );
  if (available)
    await requireUser(`/checkout/concurso/${slug}?acesso=${access}`);
  const related = CONTEST_CATALOG.filter(
    (item) =>
      item.categorySlug === contest.categorySlug &&
      item.slug !== slug &&
      (!available || released.some((product) => product.slug === item.slug)),
  );
  return (
    <main className="min-h-screen bg-[#060e18] px-5 py-7 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 flex items-center justify-between gap-5">
          <LeiProvaMark />
          <Link href="/concursos" className="text-sm text-slate-400">
            Voltar ao catálogo
          </Link>
        </header>
        <ContestCart
          contest={contest}
          related={related}
          initialAccess={access}
          available={available}
        />
      </div>
    </main>
  );
}
