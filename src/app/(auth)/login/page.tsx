"use client"

// Force dynamic rendering - Supabase client needs env vars at runtime
export const dynamic = 'force-dynamic'

import * as React from "react"
import { Shield, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function LoginPage() {
    const [isLoading, setIsLoading] = React.useState(false)
    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [error, setError] = React.useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    async function handleLogin(event: React.SyntheticEvent) {
        event.preventDefault()
        setIsLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            // Try to sign up if it's the first time
            if (error.message.includes("Invalid login credentials")) {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                })
                if (signUpError) {
                    setError(signUpError.message)
                    setIsLoading(false)
                    return
                }
                setError("Account created! Please check your email for verification or try logging in again if email verification is disabled.")
            } else {
                setError(error.message)
            }
            setIsLoading(false)
        } else {
            router.push("/")
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black p-6">
            <div className="w-full max-w-md flex flex-col gap-8">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black font-black text-3xl shadow-xl">
                        L
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight mt-4">Legion Finance</h1>
                    <p className="text-sm text-muted-foreground">Internal Financial Management Portal</p>
                </div>

                <Card className="border-slate-200 dark:border-zinc-800 shadow-2xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-xl">Welcome Partner</CardTitle>
                        <CardDescription>
                            Enter your academy credentials to access the portal.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleLogin}>
                        <CardContent className="grid gap-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold dark:bg-rose-950/30 dark:border-rose-900/50">
                                    {error}
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label htmlFor="email">Work Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="partner@legiongrappling.com"
                                    required
                                    className="h-11"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="password">Security Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    className="h-11"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button className="w-full h-11 bg-black text-white dark:bg-white dark:text-black gap-2 font-bold" disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Access Dashboard"}
                                {!isLoading && <ArrowRight className="h-4 w-4" />}
                            </Button>
                            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground mx-auto tracking-widest">
                                <Shield className="h-3 w-3" /> Encrypted Session
                            </div>
                        </CardFooter>
                    </form>
                </Card>

                <p className="px-8 text-center text-xs text-muted-foreground leading-relaxed">
                    Authorized personnel only. All access and transactions are monitored and encrypted via Supabase Auth & RLS.
                </p>
            </div>
        </div>
    )
}
