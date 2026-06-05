import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Preloader() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 1700);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[10000] bg-background flex flex-col items-center justify-center"
        >
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-5xl md:text-7xl font-display tracking-[0.15em] text-foreground"
          >
            CHEZ JOE
          </motion.h1>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 220 }}
            transition={{ delay: 0.55, duration: 0.7, ease: "easeOut" }}
            className="h-px bg-gold mt-5"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
