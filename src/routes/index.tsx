import { createFileRoute } from "@tanstack/react-router";
import { Preloader } from "@/components/chezjoe/Preloader";
import { CustomCursor } from "@/components/chezjoe/CustomCursor";
import {
  Header, Hero, About, Menu, Gallery, Reviews, Faq, Footer, BookingProvider, CartDrawer
} from "@/components/chezjoe/Sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chez Joe | Premium Dining in Salim Slem, Beirut" },
      { name: "description", content: "Indulge in premium Lebanese street food, luxury burgers, signature sandwiches, and charcoal-grilled specialties at Chez Joe in Salim Slem, Beirut. Near LIU." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-clip">
      {/* Ambient geometric grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_85%)]"
      />

      {/* Atmospheric ambient glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[#D4AF37]/20 blur-[160px]" />
        <div className="absolute top-[60%] -left-40 w-[600px] h-[600px] rounded-full bg-[#B87333]/15 blur-[140px]" />
        <div className="absolute top-[120%] right-0 w-[700px] h-[700px] rounded-full bg-[#D4AF37]/10 blur-[150px]" />
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
            <main className="relative z-10">
              <Hero />
              <About />
              <Menu />
              <Gallery />
              <Reviews />
              <Faq />
              <Footer />
            </main>
          </>
        )}
      </BookingProvider>
    </div>
  );
}
