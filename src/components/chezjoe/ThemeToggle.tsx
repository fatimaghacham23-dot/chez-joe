import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
  }, [light]);

  return (
    <button
      onClick={() => setLight(v => !v)}
      aria-label="Toggle theme"
      className="magnetic relative flex items-center w-16 h-8 rounded-full border border-border bg-surface/60 backdrop-blur-md px-1"
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`absolute top-1 ${light ? "left-9" : "left-1"} w-6 h-6 rounded-full gold-gradient flex items-center justify-center`}
      >
        {light ? <Sun className="w-3.5 h-3.5 text-[#0A0A0C]" /> : <Moon className="w-3.5 h-3.5 text-[#0A0A0C]" />}
      </motion.div>
    </button>
  );
}
