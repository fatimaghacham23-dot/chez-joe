import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Loader2,
  Mic,
  Phone,
  PhoneOff,
  Radio,
  Sparkles,
  Volume2,
  Waves,
} from "lucide-react";
import { ThemeToggle } from "@/components/chezjoe/ThemeToggle";
import { useAdminContext, type MenuItem } from "@/context/AdminContext";

export const Route = createFileRoute("/admin/call")({
  component: AdminCallPage,
});

type CallStatus = "idle" | "connecting" | "listening" | "thinking" | "talking" | "error";
type CallLogRole = "user" | "assistant" | "system";
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

interface CallLogEntry {
  role: CallLogRole;
  content: string;
  menuEvent?: MenuEvent | null;
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getSupportedMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function extractRealtimeSecret(payload: any) {
  const secret =
    payload?.client_secret?.value ||
    payload?.client_secret ||
    payload?.value ||
    payload?.secret?.value ||
    payload?.secret;

  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("OpenAI Realtime client secret was not returned.");
  }

  return secret.trim();
}

function extractDeepgramToken(payload: any) {
  const token = payload?.access_token || payload?.token || payload?.key;
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Deepgram temporary token was not returned.");
  }
  return token.trim();
}

function base64ToUint8Array(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function AdminCallPage() {
  const queryClient = useQueryClient();
  const { refetchMenu } = useAdminContext();
  const [authPassword, setAuthPassword] = useState("");
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [latestTranscript, setLatestTranscript] = useState("");
  const [assistantLine, setAssistantLine] = useState("");
  const [callLog, setCallLog] = useState<CallLogEntry[]>([
    { role: "system", content: "Call interface ready." },
  ]);

  const openAiSocketRef = useRef<WebSocket | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueTimeRef = useRef(0);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const transcriptBufferRef = useRef("");
  const assistantBufferRef = useRef("");
  const processedCallIdsRef = useRef<Set<string>>(new Set());
  const authPasswordRef = useRef("");

  const isConnected = status === "listening" || status === "thinking" || status === "talking";
  const isBusy = status === "connecting";

  const syncMenuEvent = useCallback(
    (menuEvent?: MenuEvent | null) => {
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
    },
    [queryClient, refetchMenu],
  );

  const addLog = useCallback((entry: CallLogEntry) => {
    setCallLog((prev) => [...prev.slice(-12), entry]);
  }, []);

  const stopQueuedAudio = useCallback(() => {
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
    });
    audioSourcesRef.current = [];
    audioQueueTimeRef.current = 0;
  }, []);

  const disconnectCall = useCallback(
    (nextStatus: CallStatus = "idle") => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // Recorder may already be stopped by the browser.
      }

      mediaRecorderRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;

      const deepgramSocket = deepgramSocketRef.current;
      if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
        deepgramSocket.send(JSON.stringify({ type: "CloseStream" }));
      }
      deepgramSocket?.close();
      deepgramSocketRef.current = null;

      openAiSocketRef.current?.close();
      openAiSocketRef.current = null;

      stopQueuedAudio();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
      }
      audioContextRef.current = null;

      transcriptBufferRef.current = "";
      assistantBufferRef.current = "";
      processedCallIdsRef.current.clear();
      setPartialTranscript("");
      setStatus(nextStatus);
    },
    [stopQueuedAudio],
  );

  useEffect(() => {
    const isAuth = sessionStorage.getItem("chezjoe_admin_auth") === "true";
    const savedPass = sessionStorage.getItem("chezjoe_admin_pass") || "";
    if (isAuth && savedPass) {
      setAuthPassword(savedPass);
      authPasswordRef.current = savedPass;
    } else {
      window.location.reload();
    }

    return () => disconnectCall("idle");
  }, [disconnectCall]);

  const sendRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const socket = openAiSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }, []);

  const playRealtimeAudioDelta = useCallback(async (base64Delta: string) => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const context = audioContextRef.current || new AudioContextCtor({ sampleRate: 24000 });
    audioContextRef.current = context;

    if (context.state === "suspended") {
      await context.resume();
    }

    const bytes = base64ToUint8Array(base64Delta);
    const pcm16 = new Int16Array(bytes.buffer);
    const audioBuffer = context.createBuffer(1, pcm16.length, 24000);
    const channel = audioBuffer.getChannelData(0);

    for (let i = 0; i < pcm16.length; i += 1) {
      channel[i] = pcm16[i] / 32768;
    }

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);

    const startAt = Math.max(context.currentTime, audioQueueTimeRef.current);
    source.start(startAt);
    audioQueueTimeRef.current = startAt + audioBuffer.duration;
    audioSourcesRef.current.push(source);
    source.onended = () => {
      audioSourcesRef.current = audioSourcesRef.current.filter((item) => item !== source);
    };
  }, []);

  const requestRealtimeResponse = useCallback(() => {
    sendRealtimeEvent({
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
      },
    });
  }, [sendRealtimeEvent]);

  const sendTranscriptToRealtime = useCallback(
    (transcript: string) => {
      const text = transcript.trim();
      if (!text || openAiSocketRef.current?.readyState !== WebSocket.OPEN) return;

      setLatestTranscript(text);
      setPartialTranscript("");
      setAssistantLine("");
      assistantBufferRef.current = "";
      addLog({ role: "user", content: text });
      setStatus("thinking");

      sendRealtimeEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      });
      requestRealtimeResponse();
    },
    [addLog, requestRealtimeResponse, sendRealtimeEvent],
  );

  const executeRealtimeToolCall = useCallback(
    async (toolName: string, rawArgs: string, callId: string) => {
      if (!callId || processedCallIdsRef.current.has(callId)) return;
      processedCallIdsRef.current.add(callId);
      setStatus("thinking");

      let args: Record<string, unknown> = {};
      try {
        args = rawArgs ? JSON.parse(rawArgs) : {};
      } catch {
        args = {};
      }

      try {
        const res = await fetch("/api/ai-tool", {
          method: "POST",
          headers: {
            Authorization: authPasswordRef.current,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ toolName, args }),
        });
        const payload = await res.json().catch(() => ({}));
        const output = payload.result || payload;

        if (payload.reloadMenu || payload.menuEvent) {
          syncMenuEvent(payload.menuEvent);
          addLog({
            role: "system",
            content: payload.result?.message || `Tool executed: ${toolName}.`,
            menuEvent: payload.menuEvent,
          });
        }

        sendRealtimeEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(output),
          },
        });
        requestRealtimeResponse();
      } catch (err: unknown) {
        sendRealtimeEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({
              success: false,
              error: getErrorMessage(err, "Tool execution failed."),
            }),
          },
        });
        requestRealtimeResponse();
      }
    },
    [addLog, requestRealtimeResponse, sendRealtimeEvent, syncMenuEvent],
  );

  const handleRealtimeMessage = useCallback(
    async (event: MessageEvent<string>) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === "error") {
        const message = data.error?.message || "Realtime API error.";
        setErrorMessage(message);
        addLog({ role: "system", content: message });
        return;
      }

      if (data.type === "response.audio.delta" && data.delta) {
        setStatus("talking");
        await playRealtimeAudioDelta(data.delta);
        return;
      }

      if (
        (data.type === "response.text.delta" ||
          data.type === "response.output_text.delta" ||
          data.type === "response.audio_transcript.delta") &&
        data.delta
      ) {
        assistantBufferRef.current += data.delta;
        setAssistantLine(assistantBufferRef.current);
        return;
      }

      if (data.type === "response.function_call_arguments.done") {
        await executeRealtimeToolCall(data.name, data.arguments || "", data.call_id);
        return;
      }

      if (data.type === "response.output_item.done" && data.item?.type === "function_call") {
        await executeRealtimeToolCall(data.item.name, data.item.arguments || "", data.item.call_id);
        return;
      }

      if (data.type === "response.done") {
        const spokenText = assistantBufferRef.current.trim();
        if (spokenText) {
          addLog({ role: "assistant", content: spokenText });
        }
        assistantBufferRef.current = "";
        if (openAiSocketRef.current?.readyState === WebSocket.OPEN) {
          setStatus("listening");
        }
      }
    },
    [addLog, executeRealtimeToolCall, playRealtimeAudioDelta],
  );

  const handleDeepgramMessage = useCallback(
    (event: MessageEvent<string>) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === "Results") {
        const transcript = data.channel?.alternatives?.[0]?.transcript?.trim() || "";
        if (!transcript) return;

        if (data.is_final) {
          transcriptBufferRef.current = `${transcriptBufferRef.current} ${transcript}`.trim();
        } else {
          setPartialTranscript(transcript);
        }

        if (data.speech_final && transcriptBufferRef.current) {
          const finalTranscript = transcriptBufferRef.current;
          transcriptBufferRef.current = "";
          sendTranscriptToRealtime(finalTranscript);
        }
      }

      if (data.type === "UtteranceEnd" && transcriptBufferRef.current) {
        const finalTranscript = transcriptBufferRef.current;
        transcriptBufferRef.current = "";
        sendTranscriptToRealtime(finalTranscript);
      }
    },
    [sendTranscriptToRealtime],
  );

  const startCall = async () => {
    if (isConnected || isBusy) return;
    const password = authPassword || sessionStorage.getItem("chezjoe_admin_pass") || "";
    authPasswordRef.current = password;
    setStatus("connecting");
    setErrorMessage("");
    setLatestTranscript("");
    setAssistantLine("");
    setPartialTranscript("");

    try {
      const [realtimeRes, deepgramTokenRes, stream] = await Promise.all([
        fetch("/api/realtime-session", {
          method: "POST",
          headers: { Authorization: password },
        }),
        fetch("/api/deepgram-token", {
          method: "POST",
          headers: { Authorization: password },
        }),
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }),
      ]);

      const realtimePayload = await realtimeRes.json().catch(() => ({}));
      if (!realtimeRes.ok) {
        throw new Error(
          realtimePayload.error || realtimePayload.details?.error || "Failed to start realtime API.",
        );
      }

      const deepgramPayload = await deepgramTokenRes.json().catch(() => ({}));
      if (!deepgramTokenRes.ok) {
        throw new Error(deepgramPayload.error || "Failed to create Deepgram token.");
      }

      const realtimeSecret = extractRealtimeSecret(realtimePayload);
      const deepgramToken = extractDeepgramToken(deepgramPayload);
      const model = realtimePayload.model || realtimePayload.session?.model || "gpt-realtime-2";

      mediaStreamRef.current = stream;

      const realtimeUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
      const openAiSocket = new WebSocket(realtimeUrl, [
        "realtime",
        `openai-insecure-api-key.${realtimeSecret}`,
      ]);
      openAiSocketRef.current = openAiSocket;
      openAiSocket.onmessage = handleRealtimeMessage;
      openAiSocket.onerror = () => {
        setErrorMessage("OpenAI Realtime WebSocket failed.");
        setStatus("error");
      };
      openAiSocket.onclose = () => {
        setStatus((current) => (current === "error" ? "error" : "idle"));
      };

      const deepgramUrl =
        "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&endpointing=350&utterance_end_ms=1000&vad_events=true";
      const deepgramSocket = new WebSocket(deepgramUrl, ["token", deepgramToken]);
      deepgramSocketRef.current = deepgramSocket;
      deepgramSocket.onmessage = handleDeepgramMessage;
      deepgramSocket.onerror = () => {
        setErrorMessage("Deepgram live transcription WebSocket failed.");
        setStatus("error");
      };

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          openAiSocket.onopen = () => {
            sendRealtimeEvent({
              type: "session.update",
              session: {
                instructions: realtimePayload.instructions,
                tools: realtimePayload.toolDefinitions,
                tool_choice: "auto",
              },
            });
            resolve();
          };
          openAiSocket.onerror = () => reject(new Error("OpenAI Realtime WebSocket failed."));
        }),
        new Promise<void>((resolve, reject) => {
          deepgramSocket.onopen = () => resolve();
          deepgramSocket.onerror = () => reject(new Error("Deepgram WebSocket failed."));
        }),
      ]);

      openAiSocket.onerror = () => {
        setErrorMessage("OpenAI Realtime WebSocket failed.");
        setStatus("error");
      };
      deepgramSocket.onerror = () => {
        setErrorMessage("Deepgram live transcription WebSocket failed.");
        setStatus("error");
      };

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (audioEvent) => {
        if (
          audioEvent.data.size > 0 &&
          deepgramSocketRef.current?.readyState === WebSocket.OPEN
        ) {
          deepgramSocketRef.current.send(audioEvent.data);
        }
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;

      setStatus("listening");
      addLog({ role: "system", content: "Realtime call connected." });
    } catch (err: unknown) {
      disconnectCall("error");
      const message = getErrorMessage(err, "Failed to start call.");
      setErrorMessage(message);
      addLog({ role: "system", content: message });
    }
  };

  const statusMeta = useMemo(() => {
    if (status === "connecting") return { label: "Connecting", icon: Loader2 };
    if (status === "listening") return { label: "Listening", icon: Mic };
    if (status === "thinking") return { label: "Thinking", icon: Sparkles };
    if (status === "talking") return { label: "Talking", icon: Volume2 };
    if (status === "error") return { label: "Error", icon: Radio };
    return { label: "Ready", icon: Phone };
  }, [status]);

  const StatusIcon = statusMeta.icon;

  return (
    <div className="min-h-screen bg-background text-foreground admin-page flex flex-col">
      <header className="sticky top-0 z-30 py-4 px-6 bg-surface border-b border-border flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/ai"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-2"
          >
            <ArrowLeft className="w-4 h-4" /> AI Chat
          </Link>
          <div className="hidden sm:flex items-center gap-2 border-l border-border pl-4">
            <Bot className="w-5 h-5 text-gold" />
            <h1 className="font-display text-lg font-medium leading-none">Realtime Call</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => disconnectCall("idle")}
            disabled={!isConnected && !isBusy}
            className="flex items-center justify-center rounded-xl transition-all cursor-pointer h-11 px-4 text-xs font-semibold uppercase tracking-wider border gap-2 shadow-md bg-red-500/10 border-red-500/40 text-red-400 hover:border-red-500 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <PhoneOff className="w-4 h-4" /> Disconnect
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:p-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_360px] gap-6 h-full">
          <section className="min-h-[620px] rounded-2xl border border-border bg-surface/70 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl border border-gold/30 bg-gold/10 flex items-center justify-center text-gold">
                  <StatusIcon
                    className={`w-5 h-5 ${status === "connecting" ? "animate-spin" : ""}`}
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Voice Session
                  </p>
                  <h2 className="font-display text-2xl leading-tight">{statusMeta.label}</h2>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isConnected ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"
                  }`}
                />
                {isConnected ? "Live" : "Offline"}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-8">
              <CallWave status={status} />

              <div className="space-y-3 max-w-2xl w-full">
                <div className="min-h-[48px]">
                  <p className="text-xs uppercase tracking-[0.25em] text-gold mb-2">
                    {status === "talking" ? "Assistant" : "Caller"}
                  </p>
                  <p className="text-lg sm:text-xl font-medium leading-relaxed">
                    {assistantLine ||
                      partialTranscript ||
                      latestTranscript ||
                      (status === "idle"
                        ? "Ready for a restaurant management call."
                        : "Listening for the next request.")}
                  </p>
                </div>

                {errorMessage && (
                  <div className="mx-auto max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
                    {errorMessage}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                <button
                  onClick={startCall}
                  disabled={isConnected || isBusy}
                  className="w-full sm:w-auto h-12 px-7 rounded-xl bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gold/15"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Connecting
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4" /> Start Call
                    </>
                  )}
                </button>
                <button
                  onClick={() => disconnectCall("idle")}
                  disabled={!isConnected && !isBusy}
                  className="w-full sm:w-auto h-12 px-7 rounded-xl border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40 text-xs uppercase tracking-[0.2em] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PhoneOff className="w-4 h-4" /> Disconnect
                </button>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-border bg-surface/70 overflow-hidden flex flex-col min-h-[620px]">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <Waves className="w-5 h-5 text-gold" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Activity
                </p>
                <h3 className="font-display text-xl leading-tight">Call Log</h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {callLog.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  className={`rounded-xl border p-3 ${
                    entry.role === "user"
                      ? "border-gold/25 bg-gold/10"
                      : entry.role === "assistant"
                        ? "border-border bg-background"
                        : "border-emerald-500/20 bg-emerald-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {entry.role === "system" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : entry.role === "assistant" ? (
                      <Sparkles className="w-3.5 h-3.5 text-gold" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-gold" />
                    )}
                    <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      {entry.role}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{entry.content}</p>
                  {entry.menuEvent?.itemName && (
                    <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-gold">
                      {entry.menuEvent.type}: {entry.menuEvent.itemName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function CallWave({ status }: { status: CallStatus }) {
  const isActive = status === "listening" || status === "thinking" || status === "talking";
  const bars = Array.from({ length: 32 });
  const ringClass =
    status === "talking"
      ? "border-emerald-400/60"
      : status === "thinking"
        ? "border-gold/60"
        : "border-gold/35";

  return (
    <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
      <div
        className={`absolute inset-8 rounded-full border ${ringClass} ${
          isActive ? "call-wave-ring" : ""
        }`}
      />
      <div
        className={`absolute inset-20 rounded-full border ${ringClass} ${
          isActive ? "call-wave-ring call-wave-ring-delay" : ""
        }`}
      />
      <div className="relative w-52 h-52 rounded-full border border-border bg-background/80 flex items-center justify-center shadow-2xl">
        <div className="absolute inset-4 rounded-full border border-gold/20" />
        <div className="flex items-center justify-center gap-1.5 h-28">
          {bars.map((_, index) => (
            <span
              key={index}
              className={`call-wave-bar ${
                status === "talking"
                  ? "bg-emerald-400"
                  : status === "thinking"
                    ? "bg-copper"
                    : "bg-gold"
              } ${isActive ? "" : "call-wave-muted"}`}
              style={{
                animationDelay: `${index * 42}ms`,
                height: `${18 + ((index * 7) % 54)}px`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
