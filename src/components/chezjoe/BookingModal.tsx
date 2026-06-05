import { AnimatePresence, motion } from "framer-motion";
import { X, Calendar, Clock, Users, User } from "lucide-react";
import { MagneticButton } from "./MagneticButton";

interface Props { open: boolean; onClose: () => void; }

export function BookingModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg bg-surface border border-border rounded-2xl p-8 md:p-10"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-gold">
              <X className="w-5 h-5" />
            </button>
            <p className="text-xs tracking-[0.3em] text-gold uppercase mb-2">Reservation</p>
            <h3 className="text-3xl font-display mb-1">Reserve Your Table</h3>
            <div className="h-px w-12 bg-gold mb-6" />
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); onClose(); }}>
              <Field icon={<User className="w-4 h-4"/>} placeholder="Full name" />
              <Field icon={<Users className="w-4 h-4"/>} placeholder="Guests" type="number" />
              <div className="grid grid-cols-2 gap-3">
                <Field icon={<Calendar className="w-4 h-4"/>} type="date" />
                <Field icon={<Clock className="w-4 h-4"/>} type="time" />
              </div>
              <MagneticButton className="w-full mt-2">Confirm Reservation</MagneticButton>
              <p className="text-xs text-muted-foreground text-center pt-2">Or call us: <a href="tel:+96171967461" className="text-gold">71 967 461</a></p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ icon, ...rest }: any) {
  return (
    <label className="flex items-center gap-3 px-4 py-3 rounded-lg bg-background border border-border focus-within:border-gold transition-colors">
      <span className="text-muted-foreground">{icon}</span>
      <input {...rest} className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted-foreground" />
    </label>
  );
}
