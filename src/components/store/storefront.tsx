import Image from "next/image";

import type { Product } from "@/lib/domain/product";
import type { StoreConfig } from "@/lib/domain/store-config";

type StorefrontProps = {
  config: StoreConfig;
  product: Pick<Product, "name" | "description" | "price" | "imageUrl">;
  onCta?: () => void;
};

const HEADER_LINKS = [
  { section: "product_details", href: "#product", label: "Product" },
  { section: "benefits", href: "#benefits", label: "Details" },
  { section: "faq", href: "#faq", label: "FAQ" },
] as const;

export function Storefront(props: StorefrontProps) {
  const sections = sectionRegistry(props);
  return (
    <div
      className={`storefront storefront-${props.config.typography}`}
      style={
        {
          "--store-bg": props.config.colors.background,
          "--store-fg": props.config.colors.foreground,
          "--store-accent": props.config.colors.accent,
          "--store-surface": props.config.colors.surface,
        } as React.CSSProperties
      }
    >
      {props.config.sectionOrder.map((section) =>
        props.config.enabledSections.includes(section)
          ? sections[section]
          : null,
      )}
    </div>
  );
}

function sectionRegistry(
  props: StorefrontProps,
): Record<string, React.ReactNode> {
  return {
    ...topSections(props),
    ...contentSections(props),
    ...closingSections(props),
  };
}

function topSections(props: StorefrontProps): Record<string, React.ReactNode> {
  return {
    announcement: (
      <div className="sf-announcement" key="announcement">
        A considered product, built around you.
      </div>
    ),
    header: (
      <header className="sf-header" key="header">
        <strong>{props.config.brandName}</strong>
        <HeaderNavigation config={props.config} />
      </header>
    ),
    hero: <StoreHero key="hero" {...props} />,
  };
}

function HeaderNavigation({ config }: { config: StoreConfig }) {
  const links = HEADER_LINKS.filter(({ section }) =>
    config.enabledSections.includes(section),
  );
  if (links.length === 0) return null;
  return (
    <nav>
      {links.map((link) => (
        <a href={link.href} key={link.section}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function contentSections(
  props: StorefrontProps,
): Record<string, React.ReactNode> {
  const { config, product } = props;
  return {
    product_details: (
      <section className="sf-product-details" id="product" key="product">
        <p>THE PRODUCT</p>
        <h2>{product.name}</h2>
        <span>{product.description}</span>
        {product.price ? <strong>${product.price.toFixed(2)}</strong> : null}
      </section>
    ),
    benefits: (
      <section className="sf-benefits" id="benefits" key="benefits">
        {config.benefits.map((benefit, index) => (
          <article key={benefit}>
            <span>0{index + 1}</span>
            <h3>{benefit}</h3>
          </article>
        ))}
      </section>
    ),
    trust: <TrustSection config={config} key="trust" />,
  };
}

function closingSections(
  props: StorefrontProps,
): Record<string, React.ReactNode> {
  return {
    faq: <FaqSection config={props.config} key="faq" />,
    final_cta: <StoreCta config={props.config} key="cta" onCta={props.onCta} />,
    footer: (
      <footer className="sf-footer" key="footer">
        <strong>{props.config.brandName}</strong>
        <span>{props.config.tagline}</span>
      </footer>
    ),
  };
}

function TrustSection({ config }: { config: StoreConfig }) {
  return (
    <section className="sf-trust" key="trust">
      <p>Made for thoughtful everyday use.</p>
      <div>
        {config.trustMessages.map((message) => (
          <span key={message}>{message}</span>
        ))}
      </div>
    </section>
  );
}

function FaqSection({ config }: { config: StoreConfig }) {
  return (
    <section className="sf-faq" id="faq" key="faq">
      <p>QUESTIONS, ANSWERED</p>
      {config.faq.map((item) => (
        <details key={item.question}>
          <summary>{item.question}</summary>
          <span>{item.answer}</span>
        </details>
      ))}
    </section>
  );
}

function StoreHero(props: StorefrontProps) {
  return (
    <section className="sf-hero">
      <div className="sf-hero-copy">
        <p>{props.config.tagline}</p>
        <h1>{props.config.heroHeadline}</h1>
        <span>{props.config.heroSupportingText}</span>
        <button onClick={props.onCta} type="button">
          {props.config.ctaText}
        </button>
        <small>{props.config.offerText}</small>
      </div>
      <div className="sf-image">
        {props.product.imageUrl ? (
          <Image
            alt=""
            height={900}
            src={props.product.imageUrl}
            unoptimized
            width={900}
          />
        ) : (
          <div className="sf-product-art">
            <span />
          </div>
        )}
      </div>
    </section>
  );
}

function StoreCta(props: { config: StoreConfig; onCta?: () => void }) {
  return (
    <section className="sf-final-cta">
      <h2>{props.config.heroHeadline}</h2>
      <button onClick={props.onCta} type="button">
        {props.config.ctaText}
      </button>
    </section>
  );
}
