"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import {
    MessageCircle,
    X,
    Send,
    Sparkles,
    Bot,
    Loader2,
    ChevronDown,
    PlusCircle,
    BrainCircuit
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { askFinancialAI } from "@/lib/actions/financial-ai"
import { cn } from "@/lib/utils"

interface Message {
    role: "user" | "model"
    content: string
}

export function FinancialAIChat() {
    const [isOpen, setIsOpen] = React.useState(false)
    const [messages, setMessages] = React.useState<Message[]>([
        {
            role: "model",
            content: "Hi! I'm **Aria**, your financial assistant. How can I help you organize your academy's categories today?"
        }
    ])
    const [input, setInput] = React.useState("")
    const [isLoading, setIsLoading] = React.useState(false)
    const pathname = usePathname()
    const bottomRef = React.useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom
    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isLoading])

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMsg: Message = { role: "user", content: input }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput("")
        setIsLoading(true)

        try {
            const result = await askFinancialAI(newMessages, pathname)
            setMessages(prev => [...prev, { role: "model", content: result.content }])
        } catch (error) {
            setMessages(prev => [...prev, { role: "model", content: "Sorry, I hit a snag. Please try again." }])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-none">
            {/* Chat Window */}
            <Card className={cn(
                "w-[380px] h-[550px] flex flex-col shadow-2xl transition-all duration-300 transform origin-bottom-right pointer-events-auto border-none overflow-hidden",
                isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4 pointer-events-none"
            )}>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md overflow-hidden">
                            <Image src="/aria-logo.png" alt="Aria" width={32} height={32} className="object-cover" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm leading-none">Aria AI</h3>
                            <span className="text-[10px] opacity-70 uppercase tracking-widest font-black">Financial Expert</span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={() => setIsOpen(false)}
                    >
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-zinc-950">
                    <div className="flex flex-col gap-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={cn(
                                "flex flex-col max-w-[85%]",
                                msg.role === "user" ? "ml-auto items-end" : "items-start"
                            )}>
                                <div className={cn(
                                    "px-4 py-2 rounded-2xl text-sm leading-relaxed",
                                    msg.role === "user"
                                        ? "bg-indigo-600 text-white rounded-tr-none"
                                        : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-tl-none shadow-sm"
                                )}>
                                    {/* Minimal Markdown-like bolding support */}
                                    {msg.content.split(/(\*\*.*?\*\*)/).map((part, j) =>
                                        part.startsWith("**") && part.endsWith("**")
                                            ? <strong key={j}>{part.slice(2, -2)}</strong>
                                            : part
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                                <div className="h-6 w-10 bg-slate-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">Thinking...</span>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>
                </div>

                {/* Input */}
                <div className="p-4 border-t bg-white dark:bg-zinc-950">
                    <div className="relative">
                        <input
                            placeholder="Ask Aria anything..."
                            className="w-full bg-slate-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:ring-2 ring-indigo-500 transition-all font-medium"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <Button
                            size="sm"
                            className="absolute right-1.5 top-1.5 h-8 w-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg shadow-indigo-500/20"
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                        >
                            <Send className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-2 text-center opacity-50 px-4">
                        Aria analyzes your chart of accounts and current page context for relevant help.
                    </p>
                </div>
            </Card>

            {/* Toggle Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-14 w-14 rounded-full shadow-2xl transition-all duration-500 pointer-events-auto bg-black hover:bg-zinc-900",
                    isOpen
                        ? "text-white rotate-90 scale-110"
                        : "text-white scale-100"
                )}
            >
                {isOpen ? <X className="h-6 w-6" /> : (
                    <div className="relative flex items-center justify-center">
                        <Image src="/aria-logo.png" alt="Aria" width={32} height={32} className="rounded-full" />
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-indigo-500 rounded-full border-2 border-black animate-pulse"></div>
                    </div>
                )}
            </Button>
        </div>
    )
}
