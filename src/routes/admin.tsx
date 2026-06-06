import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, ShieldAlert, Lock, Eye, EyeOff, Loader2, Plus, Trash2, CheckCircle2, UploadCloud, X, Mic, Volume2, Bot, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/chezjoe/ThemeToggle";

import heroImg from "../assets/counter.png";
import aboutImg from "../assets/store-front-2.jpg";
import tawookImg from "../assets/tawook.png";
import burgerImg from "../assets/The Heritage Burger.png";
import franciscoImg from "../assets/The Francisco Submarine.png";
import platedDishImg from "../assets/plated-dish.png";
import kitchenActionImg from "../assets/kitchen-action.png";
import sandwishImg from "../assets/sandwish.png";
import storefront1Img from "../assets/storefront-1.jpg";
import storefront3Img from "../assets/storefront-3.jpg";

const IMAGE_MAP: Record<string, string> = {
  tawook: tawookImg,
  burger: burgerImg,
  francisco: franciscoImg,
  plated: platedDishImg,
  kitchen: kitchenActionImg,
  sandwish: sandwishImg,
  storefront1: storefront1Img,
  storefront3: storefront3Img,
};

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Chez Joe | Admin Portal" },
      { name: "robots", content: "noindex, nofollow" }
    ],
  }),
  component: AdminDashboard,
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

function AdminDashboard() {
  const queryClient = useQueryClient();
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [authError, setAuthError] = useState("");

  const [localMenu, setLocalMenu] = useState<MenuItem[]>([]);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  // AI Voice Assistant state
  const [aiStatus, setAiStatus] = useState<"Idle" | "Listening..." | "Thinking..." | "Speaking...">("Idle");
  const [aiHistory, setAiHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await handleAudioProcess(audioBlob);
        
        // Stop all tracks on the stream to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAiStatus("Listening...");
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone access denied or unsupported by browser.");
      setAiStatus("Idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleAudioProcess = async (audioBlob: Blob) => {
    setAiStatus("Thinking...");
    try {
      // 1. Transcribe the audio via backend Nova-2 STT
      const transcribeRes = await fetch("/api/ai-transcribe", {
        method: "POST",
        headers: {
          "Authorization": authPassword,
          "Content-Type": "audio/webm",
        },
        body: audioBlob,
      });

      if (!transcribeRes.ok) {
        const errData = await transcribeRes.json().catch(() => ({}));
        throw new Error(errData.error || "Speech-to-text failed");
      }

      const { transcript } = await transcribeRes.json();
      if (!transcript.trim()) {
        showStatus("error", "No speech detected. Please try again.");
        setAiStatus("Idle");
        return;
      }

      const updatedHistory = [...aiHistory, { role: "user" as const, content: transcript }];
      setAiHistory(updatedHistory);

      // 2. Query the Assistant via backend Gemini with tools
      const assistantRes = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Authorization": authPassword,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: updatedHistory }),
      });

      if (!assistantRes.ok) {
        const errData = await assistantRes.json().catch(() => ({}));
        throw new Error(errData.error || "Assistant request failed");
      }

      const { text, audio, warning } = await assistantRes.json();
      
      if (warning) {
        console.warn(warning);
      }

      setAiHistory(prev => [...prev, { role: "assistant" as const, content: text }]);
      
      // Invalidate queries to reload table data dynamically
      queryClient.invalidateQueries({ queryKey: ["admin_menu"] });

      // 3. Play the returned speech audio
      if (audio) {
        setAiStatus("Speaking...");
        const playAudio = new Audio(audio);
        playAudio.onended = () => setAiStatus("Idle");
        playAudio.onerror = () => setAiStatus("Idle");
        await playAudio.play();
      } else {
        // Fallback to local browser speech synthesis
        setAiStatus("Speaking...");
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setAiStatus("Idle");
          utterance.onerror = () => setAiStatus("Idle");
          window.speechSynthesis.speak(utterance);
        } else {
          setAiStatus("Idle");
        }
      }
    } catch (err: any) {
      console.error(err);
      showStatus("error", err.message || "Failed to process voice request.");
      setAiStatus("Idle");
    }
  };

  // Add Item Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    name: "",
    desc: "",
    price: 10.00,
    tag: "Specialty",
    imageType: "preset" as "preset" | "custom",
    imageKey: "plated",
    customImage: "",
    isSoldOut: false,
  });

  // Load menu data
  const { data: menuData, isLoading: isLoadingMenu, error: loadError } = useQuery<MenuItem[]>({
    queryKey: ["admin_menu"],
    queryFn: async () => {
      const res = await fetch("/api/menu");
      if (!res.ok) throw new Error("Failed to load menu");
      return res.json();
    }
  });

  // Sync loaded data to local state
  useEffect(() => {
    if (menuData) {
      setLocalMenu(menuData);
    }
  }, [menuData]);

  // Check auth session on mount
  useEffect(() => {
    const isAuth = sessionStorage.getItem("chezjoe_admin_auth") === "true";
    const savedPass = sessionStorage.getItem("chezjoe_admin_pass") || "";
    if (isAuth && savedPass) {
      setIsAuthenticated(true);
      setAuthPassword(savedPass);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingAuth(true);
    setAuthError("");

    try {
      // Verify password by attempting to write current data (or empty array if none)
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
        setAuthPassword(passwordInput);
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

  // Mutation to save changes
  const saveMutation = useMutation({
    mutationFn: async (updatedMenu: MenuItem[]) => {
      const res = await fetch("/api/menu/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authPassword,
        },
        body: JSON.stringify(updatedMenu),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update menu");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_menu"] });
      showStatus("success", "Changes saved successfully!");
    },
    onError: (err: any) => {
      showStatus("error", err.message || "Failed to save changes.");
    }
  });

  const showStatus = (type: string, text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: "", text: "" }), 4000);
  };

  const handleFieldChange = (index: number, field: keyof MenuItem, value: any) => {
    const updated = [...localMenu];
    updated[index] = { ...updated[index], [field]: value };
    setLocalMenu(updated);
  };

  const handleOpenAddModal = () => {
    setNewItemForm({
      name: "",
      desc: "",
      price: 10.00,
      tag: "Specialty",
      imageType: "preset",
      imageKey: "plated",
      customImage: "",
      isSoldOut: false,
    });
    setIsAddModalOpen(true);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemForm.name.trim()) {
      alert("Please enter a name for the menu item.");
      return;
    }
    if (newItemForm.price < 0) {
      alert("Price cannot be negative.");
      return;
    }

    const imageKey = newItemForm.imageType === "custom" ? newItemForm.customImage : newItemForm.imageKey;
    if (newItemForm.imageType === "custom" && !newItemForm.customImage) {
      alert("Please upload an image or select a preset instead.");
      return;
    }

    const newItem: MenuItem = {
      id: "item_" + Date.now(),
      name: newItemForm.name.trim(),
      desc: newItemForm.desc.trim() || "Delicious new menu item.",
      price: newItemForm.price,
      tag: newItemForm.tag.trim() || "Specialty",
      imageKey: imageKey || "plated",
      isSoldOut: newItemForm.isSoldOut,
    };

    setLocalMenu([...localMenu, newItem]);
    setIsAddModalOpen(false);
    showStatus("success", `"${newItem.name}" added to list (unsaved).`);
  };

  const handleDeleteItem = (index: number) => {
    if (confirm("Are you sure you want to delete this menu item?")) {
      const updated = localMenu.filter((_, i) => i !== index);
      setLocalMenu(updated);
    }
  };

  const handleSaveChanges = () => {
    saveMutation.mutate(localMenu);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("chezjoe_admin_auth");
    sessionStorage.removeItem("chezjoe_admin_pass");
    setIsAuthenticated(false);
    setAuthPassword("");
    setPasswordInput("");
    setAiHistory([]);
    setAiStatus("Idle");
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
  };

  // Authentication Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 text-foreground relative admin-page">
        <div className="absolute top-6 right-6 flex items-center gap-4">
          <ThemeToggle />
          <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back Home
          </Link>
        </div>

        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
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
                  className="text-muted-foreground hover:text-gold p-2 transition-colors"
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
              className="w-full py-3 rounded-lg bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

  // Admin Dashboard Panel Screen
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-6 admin-page">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* Header bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Site
              </Link>
            </div>
            <h1 className="text-4xl font-display font-medium">Menu Manager</h1>
            <p className="text-xs text-gold uppercase tracking-[0.3em] mt-1">Live Database Editor</p>
          </div>

          <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-border hover:border-red-500/40 hover:text-red-500 rounded-lg text-xs uppercase tracking-[0.25em] transition-all cursor-pointer"
            >
              Log Out
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={saveMutation.isPending}
              className="magnetic px-5 py-2.5 bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-semibold rounded-lg hover:scale-[1.03] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Toast Alert */}
        {statusMsg.text && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border animate-fade-in ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 shrink-0" />
            )}
            <p className="text-sm font-medium">{statusMsg.text}</p>
          </div>
        )}

        {/* AI Voice Assistant Control Panel */}
        <div className="bg-surface border border-border/80 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute top-0 left-0 w-32 h-32 rounded-full bg-gold/5 blur-3xl pointer-events-none" />
          
          <div className="flex-1 space-y-3 w-full">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-gold animate-pulse" />
              <h2 className="font-display text-lg font-medium">AI Voice Assistant</h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gold/10 text-gold uppercase tracking-wider">Free Tier STT/TTS</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Manage the menu hands-free. Talk in English or Lebanese-Arabish (e.g. <i>"change the burger price to 12 dollars"</i> or <i>"3adele se3er l burger l 12 dollar"</i>). Add/remove items require verbal "Yes" confirmation.
            </p>

            {/* Transcript Log Area */}
            {aiHistory.length > 0 && (
              <div className="bg-background/40 border border-border/60 rounded-xl p-4 max-h-[140px] overflow-y-auto space-y-3 text-xs no-scrollbar">
                {aiHistory.slice(-4).map((msg, idx) => (
                  <div key={idx} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-5 h-5 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3 h-3 text-gold" />
                      </div>
                    )}
                    <div className={`px-3 py-1.5 rounded-lg max-w-[85%] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gold/15 text-gold border border-gold/25'
                        : 'bg-surface border border-border text-foreground'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Glowing Microphone Button & Status Panel */}
          <div className="flex flex-col items-center gap-3 shrink-0 w-full md:w-auto">
            <div className="relative">
              {/* Outer pulsing ring for visual indicators */}
              {isRecording && (
                <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
              )}
              {aiStatus === "Thinking..." && (
                <span className="absolute inset-0 rounded-full bg-gold/25 animate-pulse" />
              )}
              {aiStatus === "Speaking..." && (
                <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              )}

              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-16 h-16 rounded-full border flex items-center justify-center transition-all duration-300 shadow-lg cursor-pointer ${
                  isRecording
                    ? "bg-red-500/20 border-red-500 text-red-500 shadow-red-500/10 hover:bg-red-500/30 scale-105"
                    : aiStatus === "Thinking..."
                    ? "bg-gold/10 border-gold text-gold cursor-wait animate-pulse"
                    : aiStatus === "Speaking..."
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-emerald-500/10"
                    : "bg-surface border-border hover:border-gold hover:text-gold text-muted-foreground hover:scale-[1.03]"
                }`}
                aria-label="Toggle Voice Control"
              >
                {isRecording ? (
                  <Mic className="w-6 h-6 animate-pulse" />
                ) : aiStatus === "Thinking..." ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : aiStatus === "Speaking..." ? (
                  <Volume2 className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </button>
            </div>

            <div className="flex flex-col items-center">
              <span className={`text-[10px] uppercase tracking-widest font-bold ${
                isRecording
                  ? "text-red-500 animate-pulse"
                  : aiStatus === "Thinking..."
                  ? "text-gold"
                  : aiStatus === "Speaking..."
                  ? "text-emerald-400"
                  : "text-muted-foreground"
              }`}>
                {isRecording ? "Listening..." : aiStatus}
              </span>
              <span className="text-[9px] text-muted-foreground mt-0.5">
                {isRecording ? "Click to finish speaking" : "Click to talk"}
              </span>
            </div>
          </div>
        </div>

        {/* Database table view */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
          {isLoadingMenu ? (
            <div className="p-20 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-gold" />
              <p className="text-xs uppercase tracking-[0.3em]">Fetching Database...</p>
            </div>
          ) : loadError ? (
            <div className="p-20 text-center flex flex-col items-center justify-center text-red-400 gap-4">
              <ShieldAlert className="w-10 h-10" />
              <p className="font-medium">Failed to retrieve menu.</p>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["admin_menu"] })}
                className="px-4 py-2 border border-red-500/20 bg-red-500/10 rounded-lg text-xs uppercase tracking-[0.2em] hover:bg-red-500/20"
              >
                Retry Request
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-border bg-background/40">
                    <th className="p-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Image Key</th>
                    <th className="p-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Name</th>
                    <th className="p-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold w-24">Price ($)</th>
                    <th className="p-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold w-32">Tag</th>
                    <th className="p-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Description</th>
                    <th className="p-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold text-center w-36">Status</th>
                    <th className="p-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {localMenu.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-background/20 transition-colors">
                      {/* Image key input */}
                      <td className="p-4">
                        <div className="flex flex-col gap-2 items-center">
                          <img
                            src={item.imageKey.startsWith("data:") ? item.imageKey : (IMAGE_MAP[item.imageKey] || platedDishImg)}
                            alt="Preview"
                            className="w-12 h-12 object-cover rounded border border-border shrink-0"
                          />
                          <select
                            value={item.imageKey.startsWith("data:") ? "custom" : item.imageKey}
                            onChange={(e) => {
                              if (e.target.value !== "custom") {
                                handleFieldChange(idx, "imageKey", e.target.value);
                              }
                            }}
                            className="bg-background border border-border rounded-lg text-[10px] py-1 px-1.5 outline-none focus:border-gold text-foreground w-28 font-medium cursor-pointer"
                          >
                            <option value="tawook">Tawouk</option>
                            <option value="burger">Burger</option>
                            <option value="francisco">Francisco</option>
                            <option value="plated">Plated Dish</option>
                            <option value="kitchen">Kitchen</option>
                            <option value="sandwish">Sandwich</option>
                            <option value="storefront1">Storefront 1</option>
                            <option value="storefront3">Storefront 3</option>
                            {item.imageKey.startsWith("data:") && (
                              <option value="custom">Custom Upload</option>
                            )}
                          </select>
                          
                          <label className="px-2 py-1 bg-surface border border-border text-[9px] uppercase tracking-wider rounded hover:border-gold cursor-pointer text-muted-foreground hover:text-gold text-center w-28 transition-colors font-semibold">
                            Upload File
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    handleFieldChange(idx, "imageKey", reader.result);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </td>

                      {/* Name input */}
                      <td className="p-4">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleFieldChange(idx, "name", e.target.value)}
                          className="w-full bg-background border border-border rounded-lg text-sm py-2 px-3 outline-none focus:border-gold text-foreground"
                          required
                        />
                      </td>

                      {/* Price input */}
                      <td className="p-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleFieldChange(idx, "price", parseFloat(e.target.value) || 0)}
                          className="w-full bg-background border border-border rounded-lg text-sm py-2 px-3 outline-none focus:border-gold text-foreground font-mono"
                          required
                        />
                      </td>

                      {/* Tag input */}
                      <td className="p-4">
                        <input
                          type="text"
                          value={item.tag}
                          onChange={(e) => handleFieldChange(idx, "tag", e.target.value)}
                          className="w-full bg-background border border-border rounded-lg text-sm py-2 px-3 outline-none focus:border-gold text-foreground"
                        />
                      </td>

                      {/* Description textarea */}
                      <td className="p-4">
                        <textarea
                          value={item.desc}
                          onChange={(e) => handleFieldChange(idx, "desc", e.target.value)}
                          rows={2}
                          className="w-full bg-background border border-border rounded-lg text-sm py-2 px-3 outline-none focus:border-gold text-foreground resize-y min-h-[44px]"
                        />
                      </td>

                      {/* Out of Stock toggle */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleFieldChange(idx, "isSoldOut", !item.isSoldOut)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                            item.isSoldOut ? "bg-red-500" : "bg-emerald-500"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              item.isSoldOut ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <div className="text-[10px] uppercase tracking-wider mt-1 text-muted-foreground">
                          {item.isSoldOut ? (
                            <span className="text-red-400 font-bold">Sold Out</span>
                          ) : (
                            <span className="text-emerald-400 font-bold">In Stock</span>
                          )}
                        </div>
                      </td>

                      {/* Action buttons (Delete) */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="p-2 border border-border rounded-lg text-muted-foreground hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer controls */}
        {!isLoadingMenu && !loadError && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto px-5 py-3 border border-dashed border-gold/40 text-gold hover:border-gold hover:bg-gold/5 rounded-xl text-xs uppercase tracking-[0.25em] font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Item
            </button>

            <button
              onClick={handleSaveChanges}
              disabled={saveMutation.isPending}
              className="w-full sm:w-auto px-8 py-3 bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-semibold rounded-xl hover:scale-[1.03] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Add New Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="absolute top-0 inset-x-0 h-1 bg-gold" />
            
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xl font-display font-medium text-foreground">Add New Menu Item</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">Define item details and image source</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-2 rounded-lg border border-transparent hover:border-border transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form onSubmit={handleCreateItem} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newItemForm.name}
                      onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                      placeholder="e.g. Garlic Halloumi Deluxe"
                      className="w-full bg-background border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:border-gold text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                        Price ($) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={newItemForm.price}
                        onChange={(e) => setNewItemForm({ ...newItemForm, price: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-background border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:border-gold text-foreground font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                        Category / Tag
                      </label>
                      <input
                        type="text"
                        value={newItemForm.tag}
                        onChange={(e) => setNewItemForm({ ...newItemForm, tag: e.target.value })}
                        placeholder="e.g. Specialty"
                        className="w-full bg-background border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:border-gold text-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                      Description
                    </label>
                    <textarea
                      value={newItemForm.desc}
                      onChange={(e) => setNewItemForm({ ...newItemForm, desc: e.target.value })}
                      placeholder="Describe the dish ingredients and style..."
                      rows={3}
                      className="w-full bg-background border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:border-gold text-foreground resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-background border border-border rounded-xl">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-foreground font-semibold">Stock Status</p>
                      <p className="text-[10px] text-muted-foreground">Is this item ready for ordering?</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewItemForm({ ...newItemForm, isSoldOut: !newItemForm.isSoldOut })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                          newItemForm.isSoldOut ? "bg-red-500" : "bg-emerald-500"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            newItemForm.isSoldOut ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span className="text-xs font-semibold w-16 text-right">
                        {newItemForm.isSoldOut ? (
                          <span className="text-red-400">Sold Out</span>
                        ) : (
                          <span className="text-emerald-400">In Stock</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Image Selection & Upload */}
                <div className="space-y-4 flex flex-col">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                      Image Source
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-background p-1 border border-border rounded-xl">
                      <button
                        type="button"
                        onClick={() => setNewItemForm({ ...newItemForm, imageType: "preset" })}
                        className={`py-1.5 text-xs uppercase tracking-wider rounded-lg transition-all font-semibold ${
                          newItemForm.imageType === "preset"
                            ? "bg-gold text-[#0A0A0C]"
                            : "text-muted-foreground hover:text-gold/80"
                        }`}
                      >
                        Preset Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewItemForm({ ...newItemForm, imageType: "custom" })}
                        className={`py-1.5 text-xs uppercase tracking-wider rounded-lg transition-all font-semibold ${
                          newItemForm.imageType === "custom"
                            ? "bg-gold text-[#0A0A0C]"
                            : "text-muted-foreground hover:text-gold/80"
                        }`}
                      >
                        Custom Upload
                      </button>
                    </div>
                  </div>

                  {/* Image input/select area */}
                  <div className="flex-1 flex flex-col justify-center min-h-[180px]">
                    {newItemForm.imageType === "preset" ? (
                      <div className="space-y-2">
                        <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          Choose Preset
                        </label>
                        <div className="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1">
                          {Object.keys(IMAGE_MAP).map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setNewItemForm({ ...newItemForm, imageKey: key })}
                              className={`p-1 border rounded-lg overflow-hidden transition-all bg-background text-left relative flex flex-col items-center gap-1 ${
                                newItemForm.imageKey === key
                                  ? "border-gold ring-1 ring-gold"
                                  : "border-border hover:border-gold/50"
                              }`}
                            >
                              <img
                                src={IMAGE_MAP[key]}
                                alt={key}
                                className="w-full h-10 object-cover rounded"
                              />
                              <span className="text-[9px] uppercase font-bold text-center truncate w-full text-foreground/80">
                                {key}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 flex-1 flex flex-col justify-center">
                        <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          Upload Custom Image
                        </label>
                        
                        {newItemForm.customImage ? (
                          <div className="relative border border-border rounded-xl overflow-hidden bg-background flex-1 flex items-center justify-center p-2 group max-h-[160px]">
                            <img
                              src={newItemForm.customImage}
                              alt="Upload Preview"
                              className="max-h-[140px] object-contain rounded"
                            />
                            <button
                              type="button"
                              onClick={() => setNewItemForm({ ...newItemForm, customImage: "" })}
                              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="border-2 border-dashed border-border hover:border-gold/55 rounded-xl bg-background hover:bg-gold/5 p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all flex-1 min-h-[140px]">
                            <UploadCloud className="w-7 h-7 text-muted-foreground mb-1.5" />
                            <span className="text-xs font-semibold text-foreground">Click to upload image</span>
                            <span className="text-[9px] text-muted-foreground mt-0.5">PNG, JPG, or WEBP up to 2MB</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 2 * 1024 * 1024) {
                                    alert("Image is too large. Please upload an image under 2MB.");
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setNewItemForm({ ...newItemForm, customImage: reader.result as string });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Small visual card preview */}
                  <div className="p-2.5 bg-background border border-border rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded overflow-hidden border border-border shrink-0 bg-surface flex items-center justify-center">
                      <img
                        src={newItemForm.imageType === "custom" 
                          ? (newItemForm.customImage || platedDishImg) 
                          : (IMAGE_MAP[newItemForm.imageKey] || platedDishImg)
                        }
                        alt="Final Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">{newItemForm.name || "Item Name Preview"}</p>
                      <p className="text-[10px] text-gold font-mono">${(newItemForm.price).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-background rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-semibold rounded-lg hover:scale-[1.02] transition-all cursor-pointer"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
