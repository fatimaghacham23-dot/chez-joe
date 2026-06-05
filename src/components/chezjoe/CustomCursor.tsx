import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 150, damping: 20, mass: 0.5 });
  const ry = useSpring(y, { stiffness: 150, damping: 20, mass: 0.5 });
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const move = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      setHover(!!t.closest("a,button,[role=button],.magnetic,input,textarea,select"));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
    };
  }, [x, y]);

  return (
    <>
      <motion.div
        style={{ x, y }}
        className="pointer-events-none fixed top-0 left-0 z-[9999] -translate-x-1/2 -translate-y-1/2 hidden md:block"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-gold" />
      </motion.div>
      <motion.div
        style={{ x: rx, y: ry }}
        animate={{ scale: hover ? 1.6 : 1, opacity: hover ? 0.4 : 0.6 }}
        className="pointer-events-none fixed top-0 left-0 z-[9998] -translate-x-1/2 -translate-y-1/2 hidden md:block"
      >
        <div className="w-9 h-9 rounded-full border border-gold/60" />
      </motion.div>
    </>
  );
}
