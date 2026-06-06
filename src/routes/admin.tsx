import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/chezjoe/ThemeToggle";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Chez Joe | Admin Portal" },
      { name: "robots", content: "noindex, nofollow" }
    ],
  }),
  component: AdminLayout,
});

interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  tag: string;
  imageKey: string;
  isSoldOut: boolean;
}

function AdminLayout() {
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [authError, setAuthError] = useState("");

  // Load menu data for test verification body
  const { data: menuData } = useQuery<MenuItem[]>({
    queryKey: ["admin_menu_auth"],
    queryFn: async () => {
      const res = await fetch("/api/menu");
      if (!res.ok) throw new Error("Failed to load menu");
      return res.json();
    }
  });

  // Check auth session on mount
  useEffect(() => {
    const isAuth = sessionStorage.getItem("chezjoe_admin_auth") === "true";
    const savedPass = sessionStorage.getItem("chezjoe_admin_pass") || "";
    if (isAuth && savedPass) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingAuth(true);
    setAuthError("");

    try {
      const testBody = menuData || [];
      const res = await fetch("/api/menu/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": passwordInput,
        },
        body: JSON.stringify(testBody),
      });

      if (res.ok) {
        sessionStorage.setItem("chezjoe_admin_auth", "true");
        sessionStorage.setItem("chezjoe_admin_pass", passwordInput);
        setIsAuthenticated(true);
      } else {
        setAuthError("Incorrect PIN or Password. Please try again.");
      }
    } catch (err) {
      setAuthError("Auth request failed. Is the dev server running?");
    } finally {
      setCheckingAuth(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 text-foreground relative admin-page">
        <div className="absolute top-6 right-6 flex items-center gap-4">
          <ThemeToggle />
          <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back Home
          </Link>
        </div>

        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 inset-x-0 h-1 bg-gold" />
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-full border border-gold/40 flex items-center justify-center bg-gold/10 mb-4">
              <Lock className="w-5 h-5 text-gold" />
            </div>
            <h1 className="text-3xl font-display font-medium text-center">Admin Access</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.25em] mt-2">Chez Joe control panel</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <label htmlFor="pass" className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Enter PIN / Password
              </label>
              <div className="relative flex items-center bg-background border border-border rounded-lg focus-within:border-gold transition-colors pr-2">
                <input
                  id="pass"
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted-foreground px-4 py-3"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-gold p-2 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {authError && (
                <div className="mt-3 flex items-start gap-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={checkingAuth}
              className="w-full py-3 rounded-lg bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 h-11"
            >
              {checkingAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Authorize Access"
              )}
            </button>
          </form>
          <p className="text-[10px] text-center text-muted-foreground uppercase tracking-[0.2em] mt-6">
            Default local PIN is <span className="text-gold font-bold">1234</span>
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
