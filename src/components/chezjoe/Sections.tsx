import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Phone, ShoppingBag, Award, Flame, Heart, Star, ChevronDown, MapPin, Clock,
  MessageCircle, Instagram, Facebook, CreditCard, Wallet, Banknote, ArrowRight, Sparkles, Quote,
  Minus, X, Loader2, Plus, Trash2, Menu as MenuIcon
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MagneticButton } from "@/components/chezjoe/MagneticButton";
import { ThemeToggle } from "@/components/chezjoe/ThemeToggle";
import { BookingModal } from "@/components/chezjoe/BookingModal";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "../../context/CartContext";

import heroImg from "../../assets/counter.png";
import aboutImg from "../../assets/store-front-2.jpg";
import tawookImg from "../../assets/tawook.png";
export { tawookImg };
import burgerImg from "../../assets/The Heritage Burger.png";
import franciscoImg from "../../assets/The Francisco Submarine.png";
import platedDishImg from "../../assets/plated-dish.png";
import kitchenActionImg from "../../assets/kitchen-action.png";
import sandwishImg from "../../assets/sandwish.png";
import storefront1Img from "../../assets/storefront-1.jpg";
import storefront3Img from "../../assets/storefront-3.jpg";

export const NAV = [
  { label: "Story", to: "/", hash: "story" },
  { label: "Menu", to: "/menu" },
  { label: "Gallery", to: "/", hash: "gallery" },
  { label: "Reviews", to: "/", hash: "reviews" },
  { label: "FAQ", to: "/", hash: "faq" },
  { label: "Location", to: "/", hash: "location" },
];

export function Header({ onBook }: { onBook: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { setCartDrawerOpen, cartCount } = useCart();

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", f);
    return () => window.removeEventListener("scroll", f);
  }, []);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "py-3 bg-background/70 backdrop-blur-xl border-b border-border" : "py-6"}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link to="/" hash="top" className="font-display text-xl tracking-[0.2em] relative z-50">CHEZ<span className="text-gold"> JOE</span></Link>
        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map(n => (
            <Link
              key={n.label}
              to={n.to}
              hash={n.hash}
              className="magnetic group relative text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors"
            >
              {n.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold group-hover:w-full transition-all duration-500" />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 relative z-50">
          <ThemeToggle />

          <button
            onClick={() => setCartDrawerOpen(true)}
            className="magnetic relative p-2.5 rounded-full border border-border bg-surface/40 hover:border-gold hover:text-gold transition-colors flex items-center justify-center cursor-pointer text-foreground"
            aria-label="Open Cart"
          >
            <ShoppingBag className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-gold text-[#0A0A0C] text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-background">
                {cartCount}
              </span>
            )}
          </button>

          <button onClick={onBook} className="magnetic hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-medium hover:scale-[1.03] transition-transform cursor-pointer">
            Book a Table
          </button>

          {/* Hamburger Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-full border border-border bg-surface/40 text-foreground hover:border-gold hover:text-gold transition-colors cursor-pointer flex items-center justify-center"
            aria-label="Toggle Mobile Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <MenuIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-x-0 top-0 pt-24 pb-8 bg-background/95 backdrop-blur-2xl border-b border-border shadow-2xl z-40 lg:hidden flex flex-col items-center gap-6"
          >
            <nav className="flex flex-col items-center gap-5 w-full">
              {NAV.map(n => (
                <Link
                  key={n.label}
                  to={n.to}
                  hash={n.hash}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm uppercase tracking-[0.25em] text-muted-foreground hover:text-gold transition-colors font-medium py-1.5"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="w-full px-6 pt-4 border-t border-border flex flex-col gap-3 max-w-sm">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onBook();
                }}
                className="w-full py-3 rounded-full bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-semibold text-center cursor-pointer shadow-lg shadow-gold/10"
              >
                Book a Table
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section id="top" ref={ref} className="relative h-screen overflow-hidden flex items-center justify-center">
      <motion.div style={{ y }} className="absolute inset-0 -z-10 will-change-transform">
        <img
          src={heroImg}
          alt="Chez Joe Restaurant Counter"
          className="w-full h-[120%] object-cover rounded-none"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/25 to-background" />
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 text-center px-6 max-w-5xl">
        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.8 }}
          className="text-[10px] md:text-xs tracking-[0.5em] text-gold uppercase mb-8"
        >
          A Culinary Journey in the Heart of Beirut
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.0, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-semibold leading-[0.95] tracking-tighter text-[2.5rem] xs:text-[3.2rem] sm:text-5xl md:text-7xl lg:text-9xl break-keep whitespace-normal"
        >
          CHEZ <span className="italic text-gold">Joe</span>
        </motion.h1>
        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ delay: 2.4, duration: 0.9 }}
          className="h-px w-40 bg-gold mx-auto my-10 origin-center"
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6, duration: 0.8 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <MagneticButton>
            <ShoppingBag className="w-4 h-4" /> Order Now
          </MagneticButton>
          <MagneticButton variant="outline" onClick={() => (window.location.href = "tel:+96171967461")}>
            <Phone className="w-4 h-4" /> Call: 71 967 461
          </MagneticButton>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground"
      >
        <span className="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
        <motion.div className="will-change-transform" animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </motion.div>
    </section>
  );
}

const SectionTitle = ({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) => (
  <div className="text-center mb-10 md:mb-16">
    <motion.p
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
      className="text-[10px] tracking-[0.5em] text-gold uppercase mb-3 md:mb-4"
    >— {eyebrow} —</motion.p>
    <motion.h2
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="font-display text-3xl md:text-5xl leading-[1.05]"
    >{title}</motion.h2>
  </div>
);

export function About() {
  return (
    <section id="story" className="relative py-12 px-4 md:py-24 md:px-6">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="overflow-hidden rounded-2xl border border-border"
        >
          <img
            src={aboutImg}
            alt="Chez Joe Storefront"
            className="w-full aspect-[3/4] object-cover hover:scale-105 transition-transform duration-700"
            loading="lazy"
          />
        </motion.div>
        <div>
          <p className="text-[10px] tracking-[0.5em] text-gold uppercase mb-3 md:mb-4">— Our Story —</p>
          <h2 className="font-display text-3xl md:text-5xl leading-[1.05] mb-6 md:mb-8">
            The Heartbeat of <span className="italic">Salim Slem</span>
          </h2>
          <div className="h-px w-16 bg-gold mb-6 md:mb-8" />
          <p className="text-muted-foreground text-sm md:text-base leading-snug md:leading-relaxed max-w-xl">
            Nestled in the vibrant core of Beirut, mere steps from the Lebanese International University,
            Chez Joe is a cornerstone of the neighborhood's daily rhythm. We elevate beloved traditional
            flavor profiles through meticulous ingredient sourcing, masterful preparation, and an
            uncompromising guarantee of quality. Whether you seek a midday interlude or a late-night
            indulgence, we deliver a symphony of nostalgia and modern innovation.
          </p>

          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-border">
            <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-4 md:mb-6">Trusted By the Neighborhood</p>
            <div className="flex flex-wrap items-center gap-x-6 md:gap-x-10 gap-y-3 text-muted-foreground">
              {["LIU Community", "Salim Slem Locals", "Beirut Foodies", "Late-Night Crowd"].map(s => (
                <span key={s} className="text-[10px] md:text-xs tracking-[0.2em] uppercase">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Menu() {
  const { data: menu = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: async () => {
      const res = await fetch("/api/menu");
      if (!res.ok) throw new Error("Failed to fetch menu");
      return res.json();
    }
  });

  const featuredItems = menu.slice(0, 3);

  return (
    <section id="menu" className="relative py-12 px-4 md:py-24 md:px-6 bg-surface overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-copper/20 blur-[140px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-gold/10 blur-[120px]" />

      <div className="max-w-7xl mx-auto relative text-center">
        <SectionTitle eyebrow="Featured Offerings" title={<>Savor the <span className="italic">Excellence</span></>} />

        <p className="text-muted-foreground max-w-2xl mx-auto mb-12 text-sm md:text-base leading-relaxed">
          From charcoal-grilled tawouk to artisan burgers and classic Lebanese appetizers, explore a teaser of our signature creations below.
        </p>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
            <p className="text-xs uppercase tracking-[0.2em]">Loading Preview...</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
              {featuredItems.map((m, i) => (
                <div
                  key={m.id}
                  className="group relative overflow-hidden rounded-2xl bg-background border border-border hover:border-gold/30 transition-colors"
                >
                  <div className="overflow-hidden aspect-[4/3] relative">
                    <img
                      src={m.imageKey.startsWith("data:") ? m.imageKey : (IMAGE_MAP[m.imageKey] || tawookImg)}
                      alt={m.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {m.isSoldOut && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="px-3 py-1 bg-red-500 text-white text-[10px] uppercase tracking-[0.15em] font-bold rounded">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <p className="text-[10px] tracking-[0.3em] text-gold uppercase mb-2">{m.tag || "Specialty"}</p>
                    <h3 className="font-display text-xl mb-2 leading-tight truncate">{m.name}</h3>
                    <p className="text-sm text-muted-foreground leading-snug line-clamp-2 mb-4">{m.desc}</p>
                    <span className="text-3xl md:text-4xl lg:text-5xl font-black text-gold font-mono">${m.price.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16">
              <Link
                to="/menu"
                className="magnetic inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-semibold hover:scale-[1.05] transition-all shadow-lg shadow-gold/10"
              >
                <ShoppingBag className="w-4 h-4" /> View Full Menu
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const FILTERS = ["All", "Plated Mastery", "The Atmosphere", "The Craft"] as const;
type Filter = typeof FILTERS[number];

export function Gallery() {
  const [filter, setFilter] = useState<Filter>("All");
  const items = [
    { cat: "Plated Mastery" as const, aspect: "aspect-[4/5]", label: "Plated dish", src: platedDishImg },
    { cat: "The Atmosphere" as const, aspect: "aspect-[4/3]", label: "Interior", src: storefront3Img },
    { cat: "The Craft" as const, aspect: "aspect-square", label: "Kitchen action", src: kitchenActionImg },
    { cat: "Plated Mastery" as const, aspect: "aspect-[3/4]", label: "Burger", src: burgerImg },
    { cat: "The Atmosphere" as const, aspect: "aspect-[4/5]", label: "Storefront", src: storefront1Img },
    { cat: "The Craft" as const, aspect: "aspect-[4/3]", label: "Grill", src: tawookImg },
    { cat: "Plated Mastery" as const, aspect: "aspect-square", label: "Sandwich", src: sandwishImg },
    { cat: "The Atmosphere" as const, aspect: "aspect-[3/4]", label: "Counter", src: heroImg },
  ];
  const filtered = items.filter(i => filter === "All" || i.cat === filter);

  return (
    <section id="gallery" className="py-12 px-4 md:py-24 md:px-6">
      <div className="max-w-7xl mx-auto">
        <SectionTitle eyebrow="Gallery" title={<>The <span className="italic">Experience</span></>} />

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`magnetic px-5 py-2 rounded-full text-[11px] uppercase tracking-[0.25em] border transition-all ${
                filter === f ? "bg-gold text-[#0A0A0C] border-gold" : "border-border text-muted-foreground hover:border-gold hover:text-gold"
              }`}
            >{f}</button>
          ))}
        </div>

        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {filtered.map((it, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
              className="break-inside-avoid overflow-hidden rounded-2xl border border-border will-change-transform"
            >
              <img
                src={it.src}
                alt={it.label}
                className={`w-full ${it.aspect} object-cover hover:scale-105 transition-transform duration-500`}
                loading="lazy"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const REVIEWS = [
  { name: "Customer Name", text: "Replace this with a real review. The flavor is unmatched — every visit feels like a return to something familiar yet exciting.", role: "Local Regular" },
  { name: "Customer Name", text: "Replace this with a real review. Service, quality, and atmosphere — Chez Joe sets the standard in Salim Slem.", role: "LIU Student" },
  { name: "Customer Name", text: "Replace this with a real review. The Heritage Burger is hands-down the best in the neighborhood. A must-try.", role: "Food Enthusiast" },
];

export function Reviews() {
  const [idx, setIdx] = useState(0);
  return (
    <section id="reviews" className="py-12 px-4 md:py-24 md:px-6 bg-surface">
      <div className="max-w-5xl mx-auto">
        <SectionTitle eyebrow="Reviews" title={<>Voices of <span className="italic">Our Guests</span></>} />

        <div className="relative overflow-hidden">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center px-6"
          >
            <Quote className="w-10 h-10 text-gold mx-auto mb-6" />
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-gold text-gold" />)}
            </div>
            <p className="text-lg md:text-2xl font-display italic leading-snug md:leading-relaxed mb-8 max-w-3xl mx-auto">
              "{REVIEWS[idx].text}"
            </p>
            <p className="text-sm tracking-[0.2em] uppercase">{REVIEWS[idx].name}</p>
            <p className="text-xs text-muted-foreground mt-1">{REVIEWS[idx].role}</p>
          </motion.div>
        </div>

        <div className="flex justify-center gap-2 mt-10">
          {REVIEWS.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className={`magnetic h-1 transition-all rounded-full ${i === idx ? "w-10 bg-gold" : "w-4 bg-border"}`} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 pt-16 border-t border-border">
          {[
            { icon: Award, title: "Premium Ingredients", desc: "Sourced with intention" },
            { icon: Flame, title: "Fast Preparation", desc: "Charcoal-fired in minutes" },
            { icon: Heart, title: "100% Satisfaction", desc: "Crafted to delight" },
          ].map((g) => (
            <motion.div
              key={g.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-center"
            >
              <div className="w-14 h-14 rounded-full border border-gold/40 flex items-center justify-center mx-auto mb-4">
                <g.icon className="w-6 h-6 text-gold" />
              </div>
              <h4 className="font-display text-xl mb-1">{g.title}</h4>
              <p className="text-sm text-muted-foreground">{g.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  { q: "Do you offer delivery?", a: "Please contact us via WhatsApp to arrange local delivery." },
  { q: "Do you accommodate dietary restrictions?", a: "Ask our staff about our customizable menu options." },
  { q: "Do I need a reservation?", a: "Walk-ins are welcome, but reservations are recommended for larger groups." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-12 px-4 md:py-24 md:px-6">
      <div className="max-w-3xl mx-auto">
        <SectionTitle eyebrow="FAQ" title={<>Frequently <span className="italic">Asked</span></>} />
        <div className="divide-y divide-border border-y border-border">
          {FAQ.map((f, i) => (
            <div key={i}>
              <button onClick={() => setOpen(open === i ? null : i)} className="magnetic w-full flex items-center justify-between py-5 md:py-6 text-left group">
                <span className="font-display text-lg md:text-2xl pr-6">{f.q}</span>
                <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="text-gold text-2xl font-light">+</motion.span>
              </button>
              <motion.div
                initial={false}
                animate={{ height: open === i ? "auto" : 0, opacity: open === i ? 1 : 0 }}
                className="overflow-hidden"
              >
                <p className="pb-6 text-sm md:text-base text-muted-foreground leading-snug md:leading-relaxed">{f.a}</p>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const width = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <footer id="location" ref={ref} className="relative pt-16 px-4 md:pt-24 md:px-6 bg-surface">
      <div className="max-w-7xl mx-auto">
        <SectionTitle eyebrow="Visit" title={<>Find <span className="italic">Us</span></>} />

        <div className="grid lg:grid-cols-2 gap-10 md:gap-12 items-start">
          <div>
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-border/60 hover:border-gold/40 shadow-[0_0_30px_rgba(212,175,55,0.08)] bg-background relative transition-colors duration-500">
              <iframe
                title="Chez Joe Location"
                src="https://maps.google.com/maps?q=33.8825,35.5050&t=&z=16&ie=UTF8&iwloc=&output=embed"
                className="w-full h-full border-0 focus:outline-none"
                style={{
                  filter: "invert(90%) hue-rotate(180deg) brightness(85%) contrast(110%)",
                }}
                loading="lazy"
              />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-gold/40 text-[10px] tracking-[0.3em] uppercase text-gold whitespace-nowrap pointer-events-none">
                Chez Joe
              </div>
            </div>
            <div className="mt-6 flex items-start gap-4">
              <MapPin className="w-5 h-5 text-gold mt-1 shrink-0" />
              <div>
                <p className="font-display text-xl">Salim Slem, Beirut</p>
                <p className="text-sm text-muted-foreground mb-2">Near Lebanese International University</p>
                <a href="https://maps.google.com/?q=Salim+Slem+Beirut" target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[0.3em] text-gold border-b border-gold/40">Get Directions</a>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <Clock className="w-5 h-5 text-gold mt-1 shrink-0" />
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">Opening Hours</p>
                <p className="font-display text-xl">7:00 AM — 12:00 AM</p>
                <p className="text-sm text-muted-foreground">Daily</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Phone className="w-5 h-5 text-gold mt-1 shrink-0" />
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">Contact</p>
                <a href="tel:+96171967461" className="font-display text-xl hover:text-gold transition-colors">+961 71 967 461</a>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <a href="https://wa.me/96171967461" className="magnetic inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#25D366] text-white text-xs uppercase tracking-[0.2em] font-medium">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
              <a href="tel:+96171967461" className="magnetic inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gold text-gold text-xs uppercase tracking-[0.2em] font-medium">
                <Phone className="w-4 h-4" /> Call Now
              </a>
            </div>

            <div className="pt-6">
              <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Payment</p>
              <div className="flex items-center gap-4 text-muted-foreground">
                <Banknote className="w-5 h-5" /><CreditCard className="w-5 h-5" /><Wallet className="w-5 h-5" />
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Follow</p>
              <div className="flex items-center gap-4">
                <a href="#" className="magnetic w-10 h-10 rounded-full border border-border hover:border-gold hover:text-gold flex items-center justify-center transition-colors"><Instagram className="w-4 h-4" /></a>
                <a href="#" className="magnetic w-10 h-10 rounded-full border border-border hover:border-gold hover:text-gold flex items-center justify-center transition-colors"><Facebook className="w-4 h-4" /></a>
              </div>
            </div>
          </div>
        </div>

        <motion.div style={{ width }} className="h-px bg-gold mt-16 md:mt-24 origin-left" />
        <div className="py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-display text-lg tracking-[0.2em]">CHEZ <span className="text-gold">JOE</span></p>
          <p className="text-xs text-muted-foreground tracking-[0.2em] uppercase">© {new Date().getFullYear()} — Beirut</p>
        </div>
      </div>
    </footer>
  );
}

export function BookingProvider({ children }: { children: (open: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      <BookingModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export const IMAGE_MAP: Record<string, string> = {
  tawook: tawookImg,
  burger: burgerImg,
  francisco: franciscoImg,
  plated: platedDishImg,
  kitchen: kitchenActionImg,
  sandwish: sandwishImg,
  storefront1: storefront1Img,
  storefront3: storefront3Img,
};

export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  tag: string;
  imageKey: string;
  isSoldOut: boolean;
}

interface ItemDetailModalProps {
  item: MenuItem;
  onClose: () => void;
}

export function ItemDetailModal({ item, onClose }: ItemDetailModalProps) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const handleAdd = () => {
    if (item.isSoldOut) return;
    addToCart({ id: item.id, name: item.name, price: item.price, imageKey: item.imageKey }, quantity, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0"
      />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="relative w-full max-w-lg bg-surface border border-border rounded-2xl p-6 md:p-8 overflow-hidden shadow-2xl flex flex-col gap-6 text-foreground"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-gold p-1.5 rounded-full bg-background/60 border border-border/30 transition-colors z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-border">
          <img
            src={item.imageKey.startsWith("data:") ? item.imageKey : (IMAGE_MAP[item.imageKey] || tawookImg)}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          {item.isSoldOut && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <span className="px-4 py-2 border border-red-500 bg-red-500/20 text-red-500 text-xs uppercase tracking-[0.2em] font-bold rounded-lg animate-pulse">
                Sold Out
              </span>
            </div>
          )}
        </div>

        <div>
          <span className="text-[10px] tracking-[0.3em] text-gold uppercase mb-1.5 block">
            {item.tag || "Specialty"}
          </span>
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-2xl font-display font-medium leading-tight">{item.name}</h3>
            <span className="text-xl font-mono text-gold shrink-0">${item.price.toFixed(2)}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">{item.desc}</p>
        </div>

        {!item.isSoldOut && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Quantity</span>
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="p-2 hover:text-gold transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-5 text-sm font-mono">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="p-2 hover:text-gold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Special Instructions / Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g. No onions, extra garlic sauce, well done..."
                rows={3}
                className="w-full bg-background border border-border focus:border-gold outline-none rounded-lg text-sm p-3 resize-none text-foreground"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={item.isSoldOut}
          className={`w-full py-4 rounded-xl text-xs uppercase tracking-[0.2em] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
            item.isSoldOut
              ? "bg-muted text-muted-foreground border border-border shadow-none cursor-not-allowed opacity-50"
              : "bg-gold text-[#0A0A0C] hover:scale-[1.02] active:scale-[0.98] shadow-gold/10"
          }`}
        >
          {item.isSoldOut ? "Sold Out" : `Add to Cart - $${(item.price * quantity).toFixed(2)}`}
        </button>
      </motion.div>
    </div>
  );
}

const formatWhatsAppMessage = (cart: any[]) => {
  // We build the string with %0A to force line breaks in the URL
  let message = "*New Order - Chez Joe* 🍔%0A";
  message += "------------------------%0A";
  
  cart.forEach(item => {
    message += `*${item.quantity}x ${item.name}*%0A`;
    message += `Price: $${(item.price * item.quantity).toFixed(2)} ($${item.price.toFixed(2)} each)%0A`;
    if (item.notes && item.notes.trim() !== "") {
      message += `Note: ${item.notes}%0A`;
    }
    message += "%0A"; // Adds a clean gap between items
  });

  message += "------------------------%0A";
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
  message += `*Grand Total:* $${grandTotal}`;
  
  return encodeURIComponent(message).replace(/%250A/g, '%0A'); 
};

export function CartDrawer() {
  const { cart, cartDrawerOpen, setCartDrawerOpen, updateQuantity, removeFromCart, cartSubtotal, clearCart } = useCart();

  const handleCheckout = () => {
    if (cart.length === 0) return;

    window.open('https://wa.me/96171967461?text=' + formatWhatsAppMessage(cart), '_blank');
    
    clearCart();
    setCartDrawerOpen(false);
  };

  return (
    <AnimatePresence>
      {cartDrawerOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartDrawerOpen(false)}
            className="fixed inset-0 z-[8000] bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-[8001] w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col justify-between text-foreground"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-gold" />
                <h3 className="font-display text-xl">Your Order</h3>
              </div>
              <button
                onClick={() => setCartDrawerOpen(false)}
                className="p-2 text-muted-foreground hover:text-gold transition-colors rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
                  <ShoppingBag className="w-12 h-12 text-gold/30 animate-pulse" />
                  <p className="text-sm uppercase tracking-[0.2em]">Your cart is empty</p>
                  <p className="text-xs text-muted-foreground max-w-[200px]">Add some signature items to start your checkout.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.cartItemId} className="flex gap-4 p-4 rounded-xl bg-background border border-border/60">
                    <img
                      src={item.imageKey.startsWith("data:") ? item.imageKey : (IMAGE_MAP[item.imageKey] || tawookImg)}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg shrink-0 border border-border"
                    />
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm truncate">{item.name}</h4>
                          <span className="text-sm font-mono text-gold shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground italic mt-1 bg-surface/50 p-2 rounded border border-border/30">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-border rounded-lg overflow-hidden bg-surface">
                          <button
                            onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                            className="p-1.5 hover:text-gold transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-mono">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                            className="p-1.5 hover:text-gold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="text-muted-foreground hover:text-red-500 transition-colors p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t border-border bg-background/30 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono">${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Delivery</span>
                    <span className="text-emerald-400">Free</span>
                  </div>
                  <div className="h-px bg-border my-2" />
                  <div className="flex justify-between text-base font-medium">
                    <span>Grand Total</span>
                    <span className="font-mono text-gold">${cartSubtotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full py-3.5 bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-semibold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-gold/10"
                >
                  Send Order to WhatsApp
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
