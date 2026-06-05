import { motion, useMotionValue, useSpring } from "framer-motion";
import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "solid" | "outline";
}

export function MagneticButton({ children, variant = "solid", className = "", ...rest }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 });
  const sy = useSpring(y, { stiffness: 200, damping: 15 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.35);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.35);
  };
  const onLeave = () => { x.set(0); y.set(0); };

  const base = "magnetic relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-medium tracking-widest uppercase text-xs transition-colors";
  const styles = variant === "solid"
    ? "bg-gold text-[#0A0A0C] hover:bg-[oklch(0.85_0.14_90)]"
    : "border border-gold text-gold hover:bg-gold/10";

  return (
    <motion.button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={`${base} ${styles} ${className}`}
      {...(rest as any)}
    >
      {children}
    </motion.button>
  );
}
