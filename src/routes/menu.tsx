import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Preloader } from "@/components/chezjoe/Preloader";
import { CustomCursor } from "@/components/chezjoe/CustomCursor";
import {
  Header, Footer, BookingProvider, CartDrawer, ItemDetailModal, IMAGE_MAP, tawookImg, MenuItem
} from "@/components/chezjoe/Sections";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Chez Joe | Full Menu" },
      { name: "description", content: "Explore the full Chez Joe menu featuring signature tawouk, gourmet burgers, sandwiches, sides, and classics." },
    ],
  }),
  component: MenuPage,
});

const CATEGORIES = ["All", "Main Dishes", "Sides", "Beverages"] as const;
type Category = typeof CATEGORIES[number];

function MenuPage() {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const { data: menu = [], isLoading, error } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: async () => {
      const res = await fetch("/api/menu");
      if (!res.ok) throw new Error("Failed to fetch menu");
      return res.json();
    }
  });

  // Category Filtering Logic
  const filteredMenu = menu.filter((item) => {
    if (activeCategory === "All") return true;
    const tag = (item.tag || "").toLowerCase();

    if (activeCategory === "Main Dishes") {
      return ["signature", "house favorite", "chef's pick", "main dishes", "main"].includes(tag);
    }
    if (activeCategory === "Sides") {
      return ["side", "classic app", "fresh green", "sides"].includes(tag);
    }
    if (activeCategory === "Beverages") {
      return ["beverage", "beverages", "drink", "drinks"].includes(tag);
    }
    return false;
  });

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-clip menu-page">
      {/* Ambient geometric grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_85%)]"
      />

      {/* Atmospheric ambient glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[#D4AF37]/15 blur-[160px]" />
        <div className="absolute top-[50%] right-0 w-[600px] h-[600px] rounded-full bg-[#B87333]/10 blur-[140px]" />
      </div>

      <Preloader />
      <CustomCursor />

      {/* Film grain overlay */}
      <div className="grain pointer-events-none fixed inset-0 z-[60] opacity-[0.04] mix-blend-overlay" />

      <BookingProvider>
        {(openBooking) => (
          <>
            <Header onBook={openBooking} />
            <CartDrawer />

            <main className="relative z-10 pt-32 pb-24">
              <div className="max-w-7xl mx-auto px-6">
                
                {/* Page Title */}
                <div className="text-center mb-12">
                  <span className="text-[10px] tracking-[0.5em] text-gold uppercase mb-3 block">Chez Joe Beirut</span>
                  <h1 className="font-display font-medium text-4xl sm:text-5xl md:text-6xl tracking-tight">
                    The Full <span className="italic text-gold">Menu</span>
                  </h1>
                  <p className="text-muted-foreground text-sm max-w-xl mx-auto mt-4 leading-relaxed">
                    Indulge in premium Lebanese street food, luxury burgers, signature sandwiches, and charcoal-grilled specialties.
                  </p>
                </div>

                {/* Sticky Category Filter Bar */}
                <div className="sticky top-16 z-30 py-3 bg-background/85 backdrop-blur-xl border-y border-border/80 mb-12 flex items-center justify-between gap-2 md:gap-3 w-full px-2 sm:px-4 sm:rounded-2xl sm:border shadow-lg shadow-black/10">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`magnetic flex-1 text-center py-2.5 rounded-full text-[10px] xs:text-xs uppercase tracking-normal xs:tracking-wider transition-all duration-300 cursor-pointer ${
                        activeCategory === cat
                          ? "bg-gold text-[#0A0A0C] font-bold shadow-md shadow-gold/20"
                          : "border border-border text-muted-foreground hover:text-foreground hover:border-gold/45"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Loading / Error States */}
                {isLoading ? (
                  <div className="py-24 flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-gold" />
                    <p className="text-xs uppercase tracking-[0.2em]">Retrieving delicacies...</p>
                  </div>
                ) : error ? (
                  <div className="py-24 text-center text-red-400">
                    <p className="font-semibold">Failed to retrieve menu.</p>
                    <p className="text-xs text-muted-foreground mt-2">Please check your network connection and try again.</p>
                  </div>
                ) : filteredMenu.length === 0 ? (
                  <div className="py-24 text-center text-muted-foreground">
                    <p>No dishes found in this category.</p>
                  </div>
                ) : (
                  /* Menu Grid */
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
                    {filteredMenu.map((m, i) => (
                      <motion.article
                        key={m.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        onClick={() => setSelectedItem(m)}
                        className="group relative overflow-hidden rounded-2xl bg-surface/50 border border-border hover:border-gold/40 transition-colors cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="overflow-hidden aspect-[4/3] relative">
                            <img
                              src={m.imageKey.startsWith("data:") ? m.imageKey : (IMAGE_MAP[m.imageKey] || tawookImg)}
                              alt={m.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              loading="lazy"
                            />
                            {m.isSoldOut && (
                              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                <span className="px-3.5 py-1.5 bg-red-500 text-white text-[10px] uppercase tracking-[0.15em] font-bold rounded">
                                  Sold Out
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="p-6">
                            <span className="text-[10px] tracking-[0.3em] text-gold uppercase mb-2 block font-medium">
                              {m.tag || "Specialty"}
                            </span>
                            <h3 className="font-display text-xl mb-2 leading-tight group-hover:text-gold transition-colors truncate">
                              {m.name}
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                              {m.desc}
                            </p>
                          </div>
                        </div>

                        <div className="p-6 pt-0 mt-4">
                          <div className="flex items-center justify-between pt-4 border-t border-border/60">
                            <span className="text-3xl md:text-4xl lg:text-5xl font-black text-gold font-mono">${m.price.toFixed(2)}</span>
                            <div className="flex items-center gap-1.5 text-xs text-gold uppercase tracking-wider font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                              Add to cart <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                )}
              </div>
            </main>

            <Footer />
          </>
        )}
      </BookingProvider>

      {/* Selected Item Modal */}
      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
