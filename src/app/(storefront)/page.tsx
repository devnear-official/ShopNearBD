import { Suspense } from "react";
import { getCategories, getFeatured, getHeroBanners, getProduct, getProductsBySlugs, getPublicSettings, getTickerItems, listProducts, type ProductCard } from "@/lib/catalog";
import { resolveLink } from "@/lib/promo";
import { HeroBanners } from "@/components/storefront/home/hero-banners";
import { Hero } from "@/components/storefront/home/hero";
import { Marquee } from "@/components/storefront/home/marquee";
import { CategoryMall } from "@/components/storefront/home/category-mall";
import { Spotlight } from "@/components/storefront/home/spotlight";
import { ProductTabs } from "@/components/storefront/home/product-tabs";
import { Campaign } from "@/components/storefront/home/campaign";
import { Trust } from "@/components/storefront/home/trust";
import { SectionHeading } from "@/components/storefront/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { Swoosh } from "@/components/ui/streaks";
import { Reveal } from "@/components/ui/reveal";

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

async function HomePageContent() {
  const settings = await getPublicSettings();
  const home = settings.homepage;
  const [heroList, featured, newest, popular, campaign, categories, banners, ticker] = await Promise.all([
    home.hero_product_slug ? getProductsBySlugs([home.hero_product_slug]) : Promise.resolve([]),
    getFeatured(8),
    listProducts({ sort: "newest", pageSize: 8 }),
    listProducts({ sort: "popular", pageSize: 8 }),
    listProducts({ collection: home.campaign_collection, pageSize: 4 }),
    getCategories(),
    getHeroBanners(),
    getTickerItems(),
  ]);
  // Collect up to 5 rotating hero products: configured hero product first, then newest added products, then featured
  const heroProductsMap = new Map<string, ProductCard>();
  for (const p of [...heroList, ...newest.items, ...featured]) {
    if (p && !heroProductsMap.has(p.id) && p.images?.length > 0) {
      heroProductsMap.set(p.id, p);
    }
    if (heroProductsMap.size >= 5) break;
  }
  const heroProducts = Array.from(heroProductsMap.values());
  const hero = heroProducts[0] ?? null;
  const spotlight = featured.find((p) => p.slug !== hero?.slug) ?? null;
  const spotlightDetail = spotlight ? await getProduct(spotlight.slug) : null;
  // Only the first floor's products ship with the page; the other floors load on demand.
  const firstProducts = categories[0] ? (await listProducts({ category: categories[0].slug, pageSize: 4 })).items : [];

  return (
    <>
      {banners.length > 0 ? (
        <HeroBanners slides={banners.map((b) => ({ id: b.id, title: b.title, description: b.description, button_text: b.button_text, image_url: b.image_url, href: resolveLink(b.link_type, b.link_target) }))} />
      ) : (
        <Hero copy={home} hero={hero} heroes={heroProducts} />
      )}
      <Marquee items={ticker} fallback={home.marquee} />

      <section aria-labelledby="cats" className="mx-auto mt-24 max-w-7xl px-4 sm:px-8">
        <SectionHeading id="cats" eyebrow="Find your lane" title={<>Shop by <span className="text-gradient">category</span></>} bn="ক্যাটাগরি অনুযায়ী কেনাকাটা" />
        <CategoryMall categories={categories} initialProducts={firstProducts} />
      </section>

      {spotlight && spotlightDetail && (
        <section aria-label="Featured product" className="mx-auto mt-28 max-w-7xl px-4 sm:px-8">
          <Spotlight product={spotlight} specs={spotlightDetail.specifications} />
        </section>
      )}

      <section aria-labelledby="fresh" className="mx-auto mt-28 max-w-7xl px-4 sm:px-8">
        <SectionHeading id="fresh" eyebrow="Fresh off the van" title="Just landed & loved" bn="নতুন এবং জনপ্রিয়" />
        <ProductTabs tabs={[
          { key: "new", label: "New arrivals", href: "/shop?sort=newest", items: newest.items },
          { key: "popular", label: "Most popular", href: "/shop?sort=popular", items: popular.items },
        ]} />
      </section>

      {campaign.items.length > 0 && (
        <div className="mt-32">
          <Campaign title={home.campaign_title} body={home.campaign_body} collection={home.campaign_collection} products={campaign.items} />
        </div>
      )}

      <section aria-labelledby="trust" className="mx-auto mt-28 max-w-7xl px-4 sm:px-8">
        <SectionHeading id="trust" eyebrow="Shop with confidence" title="No surprises at the door" bn="নিশ্চিন্তে কেনাকাটা" />
        <Trust settings={settings} />
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 text-center sm:px-8">
        <Reveal>
          <h2 className="display mx-auto max-w-4xl t-page">
            Closer than <span className="relative inline-block">you think.<Swoosh className="absolute -bottom-2 left-0 h-4 w-full" /></span>
          </h2>
          <p className="bn mx-auto mt-6 max-w-md text-base sm:text-lg text-slate" lang="bn">যা দরকার, সব কাছেই — অর্ডার করুন, বাকিটা আমাদের।</p>
          <ButtonLink href="/shop" size="lg" className="mt-8">Start shopping</ButtonLink>
        </Reveal>
      </section>
    </>
  );
}

function HomePageSkeleton() {
  return (
    <div role="status" aria-label="Loading homepage" className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8">
      <div aria-hidden="true" className="skeleton h-[28rem] rounded-[2.5rem]" />
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        <div className="skeleton h-52 rounded-[2rem]" />
        <div className="skeleton h-52 rounded-[2rem]" />
        <div className="skeleton h-52 rounded-[2rem]" />
      </div>
      <div aria-hidden="true" className="skeleton h-80 rounded-[2rem]" />
    </div>
  );
}
