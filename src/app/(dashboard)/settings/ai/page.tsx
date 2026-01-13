"use client"

import * as React from "react"
import Image from "next/image"
import { Bot, Save, RefreshCw, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getAISettings, updateAISettings } from "@/lib/actions/ai-settings"
import { AVAILABLE_MODELS, DEFAULT_AI_SETTINGS, type AISettings } from "@/lib/ai/settings"
import { toast } from "sonner"

export default function AISettingsPage() {
    const [settings, setSettings] = React.useState<AISettings>(DEFAULT_AI_SETTINGS)
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)

    React.useEffect(() => {
        async function load() {
            const data = await getAISettings()
            setSettings(data)
            setLoading(false)
        }
        load()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        const result = await updateAISettings(settings)
        if (result.success) {
            toast.success("AI settings saved successfully")
        } else {
            toast.error("Failed to save settings")
        }
        setSaving(false)
    }

    const handleReset = () => {
        setSettings(DEFAULT_AI_SETTINGS)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center overflow-hidden">
                        <Image src="/aria-logo.png" alt="Aria" width={36} height={36} className="object-cover" />
                    </div>
                    <h1 className="text-3xl font-bold">AI Assistant Settings</h1>
                </div>
                <p className="text-muted-foreground">
                    Configure Aria's model, behavior, and custom instructions.
                </p>
            </div>

            {/* Model Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>AI Model</CardTitle>
                    <CardDescription>Choose which Gemini model powers Aria</CardDescription>
                </CardHeader>
                <CardContent>
                    <RadioGroup
                        value={settings.model}
                        onValueChange={(v) => setSettings({ ...settings, model: v as AISettings['model'] })}
                        className="space-y-3"
                    >
                        {AVAILABLE_MODELS.map((model) => (
                            <div key={model.id} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                                <RadioGroupItem value={model.id} id={model.id} className="mt-1" />
                                <div className="flex-1">
                                    <Label htmlFor={model.id} className="font-medium cursor-pointer">
                                        {model.name}
                                        {model.recommended && (
                                            <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                                                Recommended
                                            </span>
                                        )}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">{model.description}</p>
                                </div>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
            </Card>

            {/* Temperature */}
            <Card>
                <CardHeader>
                    <CardTitle>Response Style (Temperature)</CardTitle>
                    <CardDescription>
                        Lower = more focused and consistent. Higher = more creative and varied.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Focused</span>
                        <span className="font-mono text-lg font-bold">{settings.temperature.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">Creative</span>
                    </div>
                    <Slider
                        value={[settings.temperature]}
                        onValueChange={([v]) => setSettings({ ...settings, temperature: v })}
                        min={0.1}
                        max={1.0}
                        step={0.1}
                        className="w-full"
                    />
                </CardContent>
            </Card>

            {/* Context Options */}
            <Card>
                <CardHeader>
                    <CardTitle>Context Injection</CardTitle>
                    <CardDescription>What data should Aria have access to when responding?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="font-medium">Include Financial Summary</Label>
                            <p className="text-sm text-muted-foreground">YTD revenue, expenses, cash position</p>
                        </div>
                        <Switch
                            checked={settings.includeFinancials}
                            onCheckedChange={(v) => setSettings({ ...settings, includeFinancials: v })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="font-medium">Include Transaction Data</Label>
                            <p className="text-sm text-muted-foreground">Recent transactions for analysis</p>
                        </div>
                        <Switch
                            checked={settings.includeTransactions}
                            onCheckedChange={(v) => setSettings({ ...settings, includeTransactions: v })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Custom Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle>Custom Instructions</CardTitle>
                    <CardDescription>
                        Add specific instructions for how Aria should respond to you.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={settings.customInstructions}
                        onChange={(e) => setSettings({ ...settings, customInstructions: e.target.value })}
                        placeholder="e.g., Always include UK tax implications. Focus on cash flow over profit margins. Keep responses under 3 paragraphs."
                        className="min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        These instructions will be added to every conversation with Aria.
                    </p>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
                <Button variant="outline" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset to Defaults
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Settings
                </Button>
            </div>
        </div>
    )
}
