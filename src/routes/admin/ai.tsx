import { createFileRoute, Link } from "@tanstack/react-router";
import { useAdminContext, type MenuItem } from "@/context/AdminContext";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Mic,
  Volume2,
  Phone,
  PhoneOff,
  Send,
  Bot,
  Sparkles,
  Loader2,
  Play,
  Pause,
  UploadCloud,
  ImagePlus,
} from "lucide-react";
import { ThemeToggle } from "@/components/chezjoe/ThemeToggle";
import { resolveMenuImage } from "@/components/chezjoe/Sections";

export const Route = createFileRoute("/admin/ai")({
  component: AIAssistantPage,
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  audio?: string | null;
  addedItem?: MenuPreviewItem | null;
  menuEvent?: MenuEvent | null;
}

type MenuEventType =
  | "addItem"
  | "editItem"
  | "updateItemPrice"
  | "removeItem"
  | "updateItemImage";

interface MenuPreviewItem {
  id: string;
  name: string;
  price: number;
  desc: string;
  tag: string;
  imageKey: string;
  isSoldOut?: boolean;
}

interface MenuEvent {
  type: MenuEventType;
  itemId?: string;
  itemName?: string;
  item?: MenuPreviewItem;
  removedItem?: MenuPreviewItem;
  newPrice?: number;
  imageKey?: string;
  message?: string;
}

function toMenuItem(item: MenuPreviewItem): MenuItem {
  return {
    id: item.id,
    name: item.name,
    desc: item.desc || "",
    price: Number(item.price) || 0,
    tag: item.tag || "Signature",
    imageKey: item.imageKey || "plated",
    isSoldOut: Boolean(item.isSoldOut),
  };
}

function eventPreviewItem(event: MenuEvent) {
  return event.item || event.removedItem || null;
}

function applyMenuEvent(menu: MenuItem[] | undefined, event: MenuEvent | null | undefined) {
  if (!event) return menu;

  const currentMenu = menu ? [...menu] : [];
  const eventItem = eventPreviewItem(event);
  const targetId = event.itemId || eventItem?.id;
  if (!targetId) return currentMenu;

  if (event.type === "removeItem") {
    return currentMenu.filter((item) => item.id !== targetId);
  }

  if (!eventItem) return currentMenu;

  const nextItem = toMenuItem(eventItem);
  const existingIndex = currentMenu.findIndex((item) => item.id === targetId);
  if (existingIndex >= 0) {
    currentMenu[existingIndex] = { ...currentMenu[existingIndex], ...nextItem };
    return currentMenu;
  }

  return [...currentMenu, nextItem];
}

function legacyAddEvent(addedItem: MenuPreviewItem | null | undefined): MenuEvent | null {
  if (!addedItem) return null;
  return {
    type: "addItem",
    itemId: addedItem.id,
    itemName: addedItem.name,
    item: addedItem,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function AIAssistantPage() {
  const queryClient = useQueryClient();
  const { menuData, refetchMenu } = useAdminContext();
  const [authPassword, setAuthPassword] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Voice States
  const [isCallActive, setIsCallActive] = useState(false);
  const [aiStatus, setAiStatus] = useState<"Idle" | "Listening..." | "Thinking..." | "Speaking...">(
    "Idle",
  );
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const composerFileInputRef = useRef<HTMLInputElement>(null);

  const syncMenuEvent = (menuEvent?: MenuEvent | null) => {
    if (menuEvent) {
      queryClient.setQueryData<MenuItem[]>(["admin_menu"], (current) =>
        applyMenuEvent(current, menuEvent),
      );
      queryClient.setQueryData<MenuItem[]>(["menu"], (current) =>
        applyMenuEvent(current, menuEvent),
      );
    }
    queryClient.invalidateQueries({ queryKey: ["admin_menu"] });
    queryClient.invalidateQueries({ queryKey: ["menu"] });
    refetchMenu();
  };

  // Sync scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiStatus]);

  // Load password from session
  useEffect(() => {
    const isAuth = sessionStorage.getItem("chezjoe_admin_auth") === "true";
    const savedPass = sessionStorage.getItem("chezjoe_admin_pass") || "";
    if (isAuth && savedPass) {
      setAuthPassword(savedPass);
    } else {
      window.location.reload();
    }
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  // Voice loop trigger when Call state changes
  useEffect(() => {
    if (isCallActive) {
      startVoiceSession();
    } else {
      stopVoiceSession();
    }
  }, [isCallActive]);

  const startVoiceSession = async () => {
    if (isRecording || isSending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        await handleVoiceQuery(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAiStatus("Listening...");
    } catch (err) {
      console.error(err);
      alert("Microphone access denied or unsupported by browser.");
      setIsCallActive(false);
      setAiStatus("Idle");
    }
  };

  const stopVoiceSession = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setAiStatus("Idle");
  };

  const handleVoiceQuery = async (audioBlob: Blob) => {
    setAiStatus("Thinking...");
    try {
      // 1. Transcribe speech audio
      const transcribeRes = await fetch("/api/ai-transcribe", {
        method: "POST",
        headers: {
          Authorization: authPassword,
          "Content-Type": "audio/webm",
        },
        body: audioBlob,
      });

      if (!transcribeRes.ok) {
        throw new Error("Failed to transcribe audio.");
      }

      const { transcript } = await transcribeRes.json();
      if (!transcript.trim()) {
        setAiStatus("Idle");
        // Re-record if call is still active
        if (isCallActive) startVoiceSession();
        return;
      }

      // Add user speech to chat
      const updatedMessages: ChatMessage[] = [...messages, { role: "user", content: transcript }];
      setMessages(updatedMessages);

      // 2. Query Assistant
      const assistantRes = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          Authorization: authPassword,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!assistantRes.ok) {
        throw new Error("Assistant failed to process query.");
      }

      const { text, audio, reloadMenu, addedItem, menuEvent } = await assistantRes.json();
      const assistantMenuEvent = menuEvent || legacyAddEvent(addedItem);

      if (reloadMenu || assistantMenuEvent) {
        syncMenuEvent(assistantMenuEvent);
      }

      // Add assistant response to chat
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: text, audio, addedItem, menuEvent: assistantMenuEvent },
      ]);

      // 3. Play voice reply
      if (audio) {
        setAiStatus("Speaking...");
        const playAudio = new Audio(audio);
        activeAudioRef.current = playAudio;

        playAudio.onended = () => {
          setAiStatus("Idle");
          // Re-record next turn if call toggle remains active
          if (isCallActive) startVoiceSession();
        };

        playAudio.onerror = () => {
          setAiStatus("Idle");
          if (isCallActive) startVoiceSession();
        };

        await playAudio.play();
      } else {
        // Fallback TTS
        setAiStatus("Speaking...");
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => {
            setAiStatus("Idle");
            if (isCallActive) startVoiceSession();
          };
          utterance.onerror = () => {
            setAiStatus("Idle");
            if (isCallActive) startVoiceSession();
          };
          window.speechSynthesis.speak(utterance);
        } else {
          setAiStatus("Idle");
          if (isCallActive) startVoiceSession();
        }
      }
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err, "Failed to process voice query."));
      setAiStatus("Idle");
      setIsCallActive(false);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isSending) return;

    const userText = textInput.trim();
    setTextInput("");
    setIsSending(true);
    setAiStatus("Thinking...");

    const updatedMessages: ChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(updatedMessages);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          Authorization: authPassword,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok) {
        throw new Error("Assistant request failed.");
      }

      const { text, audio, reloadMenu, addedItem, menuEvent } = await res.json();
      const assistantMenuEvent = menuEvent || legacyAddEvent(addedItem);

      if (reloadMenu || assistantMenuEvent) {
        syncMenuEvent(assistantMenuEvent);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: text, audio, addedItem, menuEvent: assistantMenuEvent },
      ]);

      if (audio) {
        // Automatically play the voice response even if call mode is off, as requested
        setAiStatus("Speaking...");
        const playAudio = new Audio(audio);
        activeAudioRef.current = playAudio;
        playAudio.onended = () => setAiStatus("Idle");
        playAudio.onerror = () => setAiStatus("Idle");
        await playAudio.play();
      } else {
        setAiStatus("Idle");
      }
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err, "Connection error"));
      setAiStatus("Idle");
    } finally {
      setIsSending(false);
    }
  };

  const readImageFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });

  const getImageTargetName = () => {
    const typedTarget = textInput.trim();
    if (typedTarget && menuData?.length) {
      const normalizedText = typedTarget.toLowerCase();
      const matchedItem = menuData.find(
        (item) =>
          normalizedText.includes(item.name.toLowerCase()) ||
          normalizedText.includes(item.id.toLowerCase()),
      );
      if (matchedItem) return matchedItem.name;
    }

    if (typedTarget) return typedTarget;

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const event = messages[i].menuEvent || legacyAddEvent(messages[i].addedItem);
      if (event?.itemName) return event.itemName;
      if (event?.item?.name) return event.item.name;
      if (event?.removedItem?.name) return event.removedItem.name;
    }

    return "";
  };

  const handleImageFileProvided = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please upload an image under 2MB.");
      return;
    }

    const targetItemName = getImageTargetName();
    if (!targetItemName) {
      alert("Type the item name in the message box before attaching a photo.");
      return;
    }

    const instruction = `The user has provided an image for ${targetItemName}. Use the updateItemImage tool to update this item.`;
    setIsSending(true);
    setAiStatus("Thinking...");

    try {
      const imageKey = await readImageFile(file);
      setTextInput("");
      setMessages((prev) => [...prev, { role: "user", content: instruction }]);

      const res = await fetch("/api/ai-tool", {
        method: "POST",
        headers: {
          Authorization: authPassword,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toolName: "updateItemImage",
          args: {
            itemId: targetItemName,
            imageKey,
          },
        }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.result?.error || result.error || "Failed to update item image.");
      }

      if (result.reloadMenu || result.menuEvent) {
        syncMenuEvent(result.menuEvent);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            result.result?.message ||
            `Updated the image for ${targetItemName}. Do you need any further modifications to the menu?`,
          menuEvent: result.menuEvent,
        },
      ]);
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to update image."));
    } finally {
      setIsSending(false);
      setAiStatus("Idle");
    }
  };

  const handleComposerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      await handleImageFileProvided(file);
    }
  };

  const handleComposerDrop = async (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = Array.from(e.dataTransfer.files).find((item) => item.type.startsWith("image/"));
    if (file) {
      await handleImageFileProvided(file);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col admin-page relative">
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-gold/5 blur-3xl pointer-events-none" />

      {/* Navbar Topbar */}
      <header className="sticky top-0 z-30 py-4 px-6 bg-surface border-b border-border flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-2"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="hidden sm:flex items-center gap-2 border-l border-border pl-4">
            <Bot className="w-5 h-5 text-gold animate-pulse" />
            <h1 className="font-display text-lg font-medium leading-none">AI Assistant</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          <Link
            to="/admin/call"
            className="flex items-center justify-center rounded-xl transition-all cursor-pointer h-11 px-4 text-xs font-semibold uppercase tracking-wider border gap-2 shadow-md bg-surface border-border text-muted-foreground hover:text-foreground hover:border-gold"
            aria-label="Open Call Session"
          >
            <Phone className="w-4 h-4 text-gold" /> Call
          </Link>
        </div>
      </header>

      {/* Chat Messages Log Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-3xl w-full mx-auto flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4 select-none">
            <div className="w-16 h-16 rounded-full border border-gold/30 bg-gold/5 flex items-center justify-center text-gold">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-medium text-foreground">
                Talk to Chez Joe
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2 leading-relaxed">
                Type your command below, or open the dedicated call screen from the topbar.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 w-full ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-gold" />
              </div>
            )}

            <div className="flex flex-col gap-1.5 max-w-[80%]">
              <div
                className={`rounded-2xl px-4 py-3 leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-gold/15 text-gold border border-gold/20 rounded-tr-none"
                    : "bg-surface border border-border text-foreground rounded-tl-none"
                }`}
              >
                <p className="text-sm">{msg.content}</p>

                {/* Sleek Custom Audio Player Component */}
                {msg.role === "assistant" && msg.audio && (
                  <div className="mt-3.5 pt-3 border-t border-border/40">
                    <CustomAudioPlayer src={msg.audio} />
                  </div>
                )}
              </div>

              {/* Render the Live Preview Card right under the assistant bubble */}
              {msg.role === "assistant" && (msg.menuEvent || msg.addedItem) && (
                <LivePreviewCard
                  menuEvent={(msg.menuEvent || legacyAddEvent(msg.addedItem)) as MenuEvent}
                  authPassword={authPassword}
                  onMenuEvent={syncMenuEvent}
                />
              )}
            </div>
          </div>
        ))}

        {/* Real-time Status Bubble */}
        {aiStatus !== "Idle" && (
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground pl-11">
            {aiStatus === "Listening..." && (
              <Mic className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            )}
            {aiStatus === "Thinking..." && (
              <Loader2 className="w-3.5 h-3.5 text-gold animate-spin" />
            )}
            {aiStatus === "Speaking..." && (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
            )}
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              {aiStatus === "Listening..." ? "Listening... Speak now" : aiStatus}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Form Bar (Min 44px touch-friendly size) */}
      <footer className="p-4 bg-surface border-t border-border sticky bottom-0">
        <form
          onSubmit={handleSendText}
          onDrop={handleComposerDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setIsDragActive(true)}
          onDragLeave={() => setIsDragActive(false)}
          className={`max-w-3xl w-full mx-auto flex items-center gap-2 rounded-2xl border p-1.5 transition-all ${
            isDragActive
              ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
              : "border-transparent bg-transparent"
          }`}
        >
          <input
            ref={composerFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleComposerFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => composerFileInputRef.current?.click()}
            disabled={isSending || isRecording}
            className="h-12 w-12 rounded-xl border border-border bg-background text-muted-foreground hover:text-gold hover:border-gold transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
            aria-label="Upload item image"
            title="Upload item image"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={isSending || isRecording}
            placeholder={isRecording ? "Recording voice..." : "Ask Chez Joe AI Assistant..."}
            className="flex-1 bg-background border border-border focus:border-gold outline-none rounded-xl text-sm px-4 h-12 text-foreground disabled:opacity-50 placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || isSending || isRecording}
            className="h-12 w-12 rounded-xl bg-gold text-[#0A0A0C] hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
            aria-label="Send Message"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}

// Sleek Custom HTML5 Audio Component Player
function CustomAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / (audio.duration || 1)) * 100);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = clickX / width;
    const newTime = clickPercent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(clickPercent * 100);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="flex items-center gap-3 w-full max-w-[280px] bg-background/50 border border-border/40 p-2.5 rounded-xl">
      <button
        type="button"
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-gold text-[#0A0A0C] flex items-center justify-center shrink-0 cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-transform"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-[#0A0A0C]" />
        ) : (
          <Play className="w-4 h-4 fill-[#0A0A0C] translate-x-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Progress Bar Timeline */}
        <div
          onClick={handleProgressBarClick}
          className="h-1.5 bg-border rounded-full cursor-pointer relative overflow-hidden group w-full"
        >
          <div
            className="absolute top-0 left-0 bottom-0 bg-gold rounded-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Elapsed Time & Length */}
        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground select-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// Dynamic Live Preview Component
function LivePreviewCard({
  menuEvent,
  authPassword,
  onMenuEvent,
}: {
  menuEvent: MenuEvent;
  authPassword: string;
  onMenuEvent: (event?: MenuEvent | null) => void;
}) {
  const { menuData } = useAdminContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pulse, setPulse] = useState(false);

  const isRemoved = menuEvent.type === "removeItem";
  const eventItem = eventPreviewItem(menuEvent);
  const liveItem =
    !isRemoved && menuEvent.itemId ? menuData?.find((m) => m.id === menuEvent.itemId) : undefined;
  const currentItem: MenuPreviewItem = liveItem ||
    eventItem || {
      id: menuEvent.itemId || "unknown",
      name: menuEvent.itemName || "Menu item",
      desc: "",
      price: menuEvent.newPrice || 0,
      tag: "Signature",
      imageKey: "plated",
      isSoldOut: false,
    };

  const badgeLabel =
    menuEvent.type === "addItem"
      ? "Added"
      : menuEvent.type === "editItem"
        ? "Edited"
      : menuEvent.type === "updateItemPrice"
        ? "Price Updated"
        : menuEvent.type === "updateItemImage"
          ? "Photo Updated"
          : "Removed";

  useEffect(() => {
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 1200);
    return () => clearTimeout(timer);
  }, [menuEvent.type, liveItem?.price, liveItem?.imageKey, liveItem?.name, liveItem?.desc]);

  const handleUploadClick = () => {
    if (!isRemoved) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || isRemoved) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please upload an image under 2MB.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        await onImageUploadedWithBase64(currentItem.id, base64Data);
      } catch (err: unknown) {
        alert(getErrorMessage(err, "Failed to update image."));
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onImageUploadedWithBase64 = async (itemId: string, base64Data: string) => {
    const optimisticEvent: MenuEvent = {
      type: "updateItemImage",
      itemId,
      itemName: currentItem.name,
      imageKey: base64Data,
      item: { ...currentItem, imageKey: base64Data },
    };
    onMenuEvent(optimisticEvent);

    const res = await fetch("/api/ai-assistant", {
      method: "POST",
      headers: {
        Authorization: authPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `[System Action: The user selected an upload file. Directly execute updateItemImage with itemId: "${itemId}" and imageKey: "${base64Data}". Do not ask for confirmation.]`,
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to update item image via AI assistant.");
    }

    const result = await res.json();
    onMenuEvent(result.menuEvent || optimisticEvent);
  };

  const imageSrc = resolveMenuImage(currentItem.imageKey);

  return (
    <div
      className={`mt-3 border rounded-2xl overflow-hidden bg-background max-w-sm shadow-md transition-all duration-300 ${
        pulse
          ? "ring-2 ring-gold scale-[1.01] shadow-gold/10 animate-pulse"
          : isRemoved
            ? "border-red-500/40"
            : "border-border"
      }`}
    >
      <div className="relative h-40 bg-surface/50 overflow-hidden flex items-center justify-center border-b border-border/60">
        <img
          src={imageSrc}
          alt={currentItem.name}
          className={`w-full h-full object-cover ${isRemoved ? "grayscale opacity-45" : ""}`}
        />
        {isRemoved && <div className="absolute inset-0 bg-black/40" />}
        <div
          className={`absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10 text-[9px] font-mono uppercase tracking-wider ${
            isRemoved ? "text-red-300" : "text-gold"
          }`}
        >
          {badgeLabel}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <h4
            className={`font-semibold text-sm leading-tight truncate ${isRemoved ? "text-muted-foreground line-through" : "text-foreground"}`}
          >
            {currentItem.name}
          </h4>
          <span
            className={`font-mono text-xs font-semibold shrink-0 ${isRemoved ? "text-muted-foreground" : "text-gold"}`}
          >
            ${Number(currentItem.price || 0).toFixed(2)}
          </span>
        </div>

        {currentItem.desc && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {currentItem.desc}
          </p>
        )}

        <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/40">
          <span
            className={`text-[9px] uppercase tracking-wider font-semibold ${isRemoved ? "text-red-300" : "text-muted-foreground"}`}
          >
            {isRemoved ? "Removed from menu" : currentItem.tag || "Signature"}
          </span>

          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading || isRemoved}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold/30 hover:border-gold text-gold bg-gold/5 hover:bg-gold/10 text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-8"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Updating
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" /> Upload
              </>
            )}
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
