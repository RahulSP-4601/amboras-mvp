import {
  ArrowRight,
  BarChart3,
  Check,
  FlaskConical,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <Hero />
      <ProofStrip />
      <ProductStory />
      <ExperimentStory />
      <MarketingFooter />
    </main>
  );
}

function MarketingNav() {
  return (
    <header className="marketing-nav">
      <Link className="brand" href="/" aria-label="Evolv home">
        <span className="brand-mark">
          <Sparkles size={17} />
        </span>
        Evolv
      </Link>
      <nav aria-label="Primary navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#experiments">Experiments</a>
        <a href="#product">Product</a>
      </nav>
      <Link className="button button-secondary" href="/login">
        Get started
      </Link>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero-shell">
      <div className="hero-copy">
        <p className="eyebrow">
          <Sparkles size={15} /> AI-native storefront experiments
        </p>
        <h1>Build a store that improves itself.</h1>
        <p className="hero-lede">
          Describe your product, publish a storefront, test improvements, and
          learn which version performs better.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/login">
            Create your store <ArrowRight size={18} />
          </Link>
          <a className="text-link" href="#how-it-works">
            See how it works
          </a>
        </div>
        <p className="hero-note">
          One product. One focused experiment loop. No payment required.
        </p>
      </div>
      <StoreMockup />
    </section>
  );
}

function StoreMockup() {
  return (
    <div className="store-mockup" aria-label="Generated storefront preview">
      <div className="mockup-bar">
        <span />
        <b>FIELDNOTE</b>
        <span>Bag</span>
      </div>
      <div className="mockup-product">
        <div className="mockup-copy">
          <small>BUILT FOR THE LONG WAY HOME</small>
          <h2>The everyday bag, considered.</h2>
          <button type="button">Explore the field bag</button>
        </div>
        <div className="product-art" aria-hidden="true">
          <div className="bag-handle" />
          <div className="bag-body">
            <div className="bag-pocket" />
          </div>
        </div>
      </div>
      <div className="mockup-benefits">
        <span>Weather ready</span>
        <span>Built for daily use</span>
        <span>Quietly durable</span>
      </div>
    </div>
  );
}

function ProofStrip() {
  return (
    <section className="proof-strip" id="how-it-works">
      {[
        ["01", "Describe", "Tell the system what you want to sell."],
        ["02", "Publish", "Review a structured, editable storefront."],
        ["03", "Experiment", "Test one controlled improvement at a time."],
        ["04", "Learn", "Measure behaviour and publish your selection."],
      ].map(([number, title, body]) => (
        <article key={number}>
          <span>{number}</span>
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
    </section>
  );
}

function ProductStory() {
  return (
    <section className="story-section" id="product">
      <div>
        <p className="eyebrow">A controlled system, not generated code</p>
        <h2>Your product becomes a storefront you can trust.</h2>
      </div>
      <div className="story-grid">
        <Feature icon={<Sparkles />} title="Structured generation">
          AI creates validated content and visual direction. The application
          owns every component.
        </Feature>
        <Feature icon={<Check />} title="Safe versioning">
          Drafts, published versions, and rollback remain separate and
          immutable.
        </Feature>
        <Feature icon={<BarChart3 />} title="Behavioural evidence">
          Analytics come from validated events—not invented AI numbers.
        </Feature>
      </div>
    </section>
  );
}

function Feature(props: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="feature-card">
      <span>{props.icon}</span>
      <h3>{props.title}</h3>
      <p>{props.children}</p>
    </article>
  );
}

function ExperimentStory() {
  return (
    <section className="experiment-story" id="experiments">
      <div className="experiment-copy">
        <p className="eyebrow">
          <FlaskConical size={15} /> Controlled A/B experiments
        </p>
        <h2>A storefront that learns, one clear hypothesis at a time.</h2>
        <p>
          Freeze the published version, preview one safe change, split visitors
          consistently, and use deterministic analytics to identify the current
          leader.
        </p>
        <Link className="button button-light" href="/login">
          Start with your product <ArrowRight size={18} />
        </Link>
      </div>
      <div className="variant-comparison">
        <Variant label="A · Control" headline="Designed for the everyday." />
        <Variant
          label="B · Variant"
          headline="Built to outlast every commute."
          active
        />
      </div>
    </section>
  );
}

function Variant(props: { label: string; headline: string; active?: boolean }) {
  return (
    <article className={props.active ? "variant-card active" : "variant-card"}>
      <small>{props.label}</small>
      <div className="variant-art" />
      <h3>{props.headline}</h3>
      <span>Explore the product</span>
    </article>
  );
}

function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <span className="brand">Evolv</span>
      <p>Storefront experimentation, built with evidence.</p>
      <span>© 2026 Evolv</span>
    </footer>
  );
}
