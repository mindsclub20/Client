type DemoVariant = "restaurant" | "business" | "portfolio";

const content = {
  restaurant: {
    className: "restaurant",
    brand: "SAFFRON & SAGE",
    eyebrow: "A neighborhood table",
    title: "Good food. Good company. No occasion needed.",
    intro:
      "A warm, modern restaurant experience built around seasonal ingredients, thoughtful cooking and the pleasure of gathering.",
    primary: "Explore the menu",
    secondary: "Our story",
    sectionTitle: "Made for lingering",
    sectionText:
      "From relaxed weekday lunches to long dinners with friends, every detail is designed to make time around the table matter.",
    cards: [
      ["01 / THE MENU", "Seasonal, always", "A concise menu shaped by fresh produce and local inspiration."],
      ["02 / THE SPACE", "Come as you are", "A welcoming room for quick catch-ups and unhurried evenings."],
      ["03 / THE TABLE", "Save your seat", "Simple reservations and clear details before you arrive."],
    ],
    layout: "editorial" as const,
  },
  business: {
    className: "business",
    brand: "ORBIT DIGITAL",
    eyebrow: "Strategy · Design · Technology",
    title: "Turn ambitious ideas into useful digital products.",
    intro:
      "A focused digital studio helping growing teams clarify their message, improve customer journeys and launch better experiences.",
    primary: "View our services",
    secondary: "Start a project",
    sectionTitle: "Built around outcomes",
    sectionText:
      "One connected team for the thinking, design and engineering that move a business forward.",
    cards: [
      ["01 / DISCOVER", "Find the signal", "Research and strategy that turn complexity into a clear direction."],
      ["02 / DESIGN", "Make it intuitive", "Distinctive brand and product experiences people can navigate."],
      ["03 / DELIVER", "Build with purpose", "Reliable websites and digital tools made to grow with you."],
    ],
    layout: "split" as const,
  },
  portfolio: {
    className: "portfolio",
    brand: "AARAV MEHTA",
    eyebrow: "Independent designer & creative developer",
    title: "Digital experiences with clarity, character and craft.",
    intro:
      "I partner with thoughtful teams to shape identities, interfaces and websites that make complex things feel simple.",
    primary: "Explore selected work",
    secondary: "Get in touch",
    sectionTitle: "Selected explorations",
    sectionText:
      "A small collection of concept projects showing how strategy and visual systems come together.",
    cards: [
      ["01 / BRAND SYSTEM", "Fieldnotes", "A flexible identity for a modern outdoor journal."],
      ["02 / DIGITAL PRODUCT", "Forma", "A calmer workspace for teams planning creative projects."],
      ["03 / COMMERCE", "Common Ground", "A considered storefront for everyday essentials."],
    ],
    layout: "gallery" as const,
  },
} satisfies Record<
  DemoVariant,
  {
    className: string;
    brand: string;
    eyebrow: string;
    title: string;
    intro: string;
    primary: string;
    secondary: string;
    sectionTitle: string;
    sectionText: string;
    cards: string[][];
    layout: "editorial" | "split" | "gallery";
  }
>;

export default function DemoPage({ variant }: { variant: DemoVariant }) {
  const demo = content[variant];
  const isGallery = demo.layout === "gallery";
  const isSplit = demo.layout === "split";

  return (
    <main className={`demo-page demo-page--${demo.className} demo-layout--${demo.layout}`}>
      <div className="demo-preview-note">
        <a href="/">← MAXWEB</a>
        <span>LIVE CONCEPT DEMO · NOT A REAL BUSINESS</span>
      </div>
      <nav className="demo-nav">
        <a className="demo-brand" href="#top">
          {demo.brand}
        </a>
        <div>
          <a href="#about">About</a>
          <a href="#work">Highlights</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>
      <section
        className="demo-hero"
        id="top"
        style={isGallery ? { gridTemplateColumns: "1fr" } : undefined}
      >
        <div className="demo-hero-copy" style={isGallery ? { maxWidth: 720, margin: "0 auto", textAlign: "center" } : undefined}>
          <p className="demo-eyebrow">{demo.eyebrow}</p>
          <h1 style={isSplit ? { fontFamily: "Manrope, Arial, sans-serif", letterSpacing: "-0.04em" } : undefined}>
            {demo.title}
          </h1>
          <p className="demo-intro" style={isGallery ? { margin: "0 auto" } : undefined}>
            {demo.intro}
          </p>
          <div className="demo-actions" style={isGallery ? { justifyContent: "center" } : undefined}>
            <a className="demo-button demo-button--primary" href="#work">
              {demo.primary} ↗
            </a>
            <a className="demo-text-link" href="#contact">
              {demo.secondary} →
            </a>
          </div>
        </div>
        {!isGallery ? (
          <div className="demo-art" aria-hidden="true">
            <div className="demo-art-orbit" />
            <div className="demo-art-core">
              <span>
                {variant === "restaurant" ? "S&S" : variant === "business" ? "OD" : "AM"}
              </span>
            </div>
            <div className="demo-art-caption">DESIGNED TO MAKE AN IMPRESSION</div>
          </div>
        ) : null}
      </section>
      <section
        className="demo-details"
        id="about"
        style={isGallery ? { margin: "0 auto", textAlign: "center" } : undefined}
      >
        <p className="demo-eyebrow">THE APPROACH</p>
        <h2>{demo.sectionTitle}</h2>
        <p>{demo.sectionText}</p>
      </section>
      <section
        className="demo-cards"
        id="work"
        style={isSplit ? { gridTemplateColumns: "1fr" } : undefined}
      >
        {demo.cards.map(([label, title, description]) => (
          <article
            className="demo-card"
            key={label}
            style={isSplit ? { display: "grid", gridTemplateColumns: "160px 1fr", gap: 18, alignItems: "start" } : undefined}
          >
            <span>{label}</span>
            <div>
              <h3 style={isSplit ? { marginTop: 0 } : undefined}>{title}</h3>
              <p>{description}</p>
              <a href="#contact" aria-label={`Learn more about ${title}`}>
                Explore ↗
              </a>
            </div>
          </article>
        ))}
      </section>
      <footer className="demo-footer" id="contact">
        <div>
          <p className="demo-eyebrow">A CONCEPT BY MAXWEB</p>
          <h2>Have a project in mind?</h2>
        </div>
        <a className="demo-button demo-button--primary" href="/">
          Back to MAXWEB ↗
        </a>
      </footer>
    </main>
  );
}
