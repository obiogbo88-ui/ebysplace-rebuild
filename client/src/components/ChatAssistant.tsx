import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { navigateWithSmoothScroll } from "@/lib/smoothScroll";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  bookService?: string;
  isFallback?: boolean;
};

const BOOK_MARKER = /\s*\[\[BOOK:([^\]]+)\]\]\s*$/;
const WHATSAPP_URL = "https://wa.me/447864585110?text=Hi%20Eby%27s%20Place%2C%20I%20would%20like%20to%20make%20an%20enquiry.";

const STARTER_PROMPTS = [
  "What styles do you offer?",
  "How much is the deposit?",
  "Can you come to my home?",
];

function parseAssistantReply(raw: string): { content: string; bookService?: string } {
  const match = raw.match(BOOK_MARKER);
  if (!match) return { content: raw.trim() };
  return { content: raw.replace(BOOK_MARKER, "").trim(), bookService: match[1].trim() };
}

export default function ChatAssistant() {
  const [location, setLocation] = useLocation();
  const isAdmin = location.startsWith("/admin");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const leadCapturedRef = useRef(false);
  const [nearFooter, setNearFooter] = useState(false);
  const chat = trpc.public.chatAssistant.useMutation();
  const chatLead = trpc.public.chatLead.useMutation();

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, chat.isPending]);

  useEffect(() => {
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;

    function observeFooter() {
      const footer = document.querySelector("footer#site-footer");
      if (!footer) return false;
      io = new IntersectionObserver(([entry]) => setNearFooter(entry.isIntersecting));
      io.observe(footer);
      return true;
    }

    if (!observeFooter()) {
      mo = new MutationObserver(() => {
        if (observeFooter()) mo?.disconnect();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      io?.disconnect();
      mo?.disconnect();
      setNearFooter(false);
    };
  }, [location]);

  if (isAdmin) return null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    try {
      const result = await chat.mutateAsync({
        messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
      });
      const parsed = parseAssistantReply(result.reply);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: parsed.content, bookService: parsed.bookService },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Sorry, I couldn't reply just now. Please try again, or message us on WhatsApp.",
          isFallback: true,
        },
      ]);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function closeChat() {
    setOpen(false);
    const hasBookingHandoff = messages.some((message) => message.bookService);
    if (!leadCapturedRef.current && messages.length > 0 && !hasBookingHandoff) {
      leadCapturedRef.current = true;
      chatLead.mutate({
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
      });
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close chat with Eby" : "Chat with Eby"}
        onClick={() => (open ? closeChat() : setOpen(true))}
        className={`btn-gold !p-0 fixed bottom-24 left-4 z-[80] flex h-14 w-14 items-center justify-center shadow-[0_18px_42px_rgba(17,17,17,.28)] transition-all duration-300 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#C9A84C] md:bottom-6 md:left-6 md:h-16 md:w-16 ${
          nearFooter && !open ? "pointer-events-none translate-y-3 opacity-0" : ""
        }`}
      >
        {open ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 md:h-7 md:w-7" fill="currentColor">
            <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.62 1.32 4.96 3.4 6.56-.12 1.14-.53 2.4-1.29 3.44a.6.6 0 0 0 .6.94c1.94-.42 3.5-1.16 4.63-1.85 .86.2 1.75.31 2.66.31 5.52 0 10-3.94 10-8.8S17.52 2 12 2Z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="lux-card fixed bottom-40 left-4 z-[80] flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden p-0 shadow-2xl md:bottom-24 md:left-6 md:max-h-[32rem] md:w-96">
          <div className="border-b border-primary/20 px-5 py-4">
            <p className="pill w-fit text-xs">Eby's Place Assistant</p>
            <h2 className="serif mt-2 text-xl font-bold text-primary">Chat with Eby</h2>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-white/65">
                  Hi, I'm Eby! Ask me about styles, pricing, or booking — I can point you straight to the right appointment.
                </p>
                <div className="flex flex-col gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void send(prompt)}
                      className="btn-dark py-2 text-left text-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm font-semibold text-black"
                      : "max-w-[85%] space-y-3 rounded-2xl rounded-bl-sm border border-primary/20 bg-black/25 px-4 py-2 text-sm text-white/85"
                  }
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.bookService && (
                    <button
                      type="button"
                      className="btn-gold w-full py-2 text-xs"
                      onClick={() => {
                        closeChat();
                        navigateWithSmoothScroll(
                          `/booking?service=${encodeURIComponent(message.bookService as string)}`,
                          setLocation
                        );
                      }}
                    >
                      Book {message.bookService}
                    </button>
                  )}
                  {message.isFallback && (
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gold block w-full py-2 text-center text-xs"
                    >
                      Message us on WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ))}

            {chat.isPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-primary/20 bg-black/25 px-4 py-3 text-sm text-white/50">
                  Eby is typing…
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-primary/20 px-4 py-3">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Eby a question…"
              maxLength={4000}
              className="w-full rounded-full border border-primary/25 bg-black/30 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
            />
            <button
              type="submit"
              disabled={chat.isPending || !input.trim()}
              aria-label="Send message"
              className="btn-gold flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
                <path d="M3 11.5 21 3l-6.5 18-3.5-7.5L3 11.5Z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
