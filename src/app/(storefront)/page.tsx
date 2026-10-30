import { getCategories, getFeatured, getProduct, getProductsBySlugs, getPublicSettings, listProducts } from "@/lib/catalog";
import { Hero } from "@/components/storefront/home/hero";
import { Marquee } from "@/components/storefront/home/marquee";
import { CategoryLanes } from "@/components/storefront/home/category-lanes";
import { Spotlight } from "@/components/storefront/home/spotlight";
import { ProductTabs } from "@/components/storefront/home/product-tabs";
import { Campaign } from "@/components/storefront/home/campaign";
import { Trust } from "@/components/storefront/home/trust";
import { SectionHeading } from "@/components/storefront/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { Swoosh } from "@/components/ui/streaks";
import { Reveal } from "@/components/ui/reveal";

export default async function HomePage() {
  const settings = await getPublicSettings();
  const home = settings.homepage;
  const [heroList, featured, newest, popular, campaign, categories] = await Promise.all([
    home.hero_product_slug ? getProductsBySlugs([home.hero_product_slug]) : Promise.resolve([]),
    getFeatured(8),
    listProducts({ sort: "newest", pageSize: 8 }),
    listProducts({ sort: "popular", pageSize: 8 }),
    listProducts({ collection: home.campaign_collection, pageSize: 4 }),
    getCategories(),
  ]);
  const hero = heroList[0] ?? featured[0] ?? null;
  const spotlight = featured.find((p) => p.slug !== hero?.slug) ?? null;
  const spotlightDetail = spotlight ? await getProduct(spotlight.slug) : null;

  return (
    <>
      <Hero copy={home} hero={hero} />
      <Marquee items={home.marquee} />

      <section aria-labelledby="cats" className="mx-auto mt-24 max-w-7xl px-4 sm:px-8">
        <SectionHeading id="cats" eyebrow="Find your lane" title={<>Shop by <span className="text-gradient">category</span></>} bn="ক্যাটাগরি অনুযায়ী কেনাকাটা" />
        <CategoryLanes categories={categories} />
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
