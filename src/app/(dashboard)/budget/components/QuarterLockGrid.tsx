'use client'

import { Lock, Unlock } from 'lucide-react'
import { getQuarterDescription } from '../utils'

interface QuarterLockGridProps {
    getQuarterLock: (q: 1 | 2 | 3 | 4) => boolean
    onLockQuarter: (q: 1 | 2 | 3 | 4) => Promise<void>
    onUnlockQuarter: (q: 1 | 2 | 3 | 4) => Promise<void>
}

export function QuarterLockGrid({
    getQuarterLock,
    onLockQuarter,
    onUnlockQuarter
}: QuarterLockGridProps) {
    return (
        <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Quarterly Commitments</span>
                <span className="text-xs text-muted-foreground">Lock quarters when ready to track actuals</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {([1, 2, 3, 4] as const).map(q => {
                    const isLocked = getQuarterLock(q)
                    return (
                        <div
                            key={q}
                            className={`rounded-xl border-2 p-4 ${isLocked
                                ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30'
                                : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-2xl font-black ${isLocked ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'}`}>
                                    Q{q}
                                </span>
                                {isLocked && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                                        <Lock className="h-2.5 w-2.5" /> LOCKED
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mb-3">{getQuarterDescription(q)}</p>
                            {isLocked ? (
                                <button
                                    onClick={() => onUnlockQuarter(q)}
                                    className="w-full py-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                >
                                    <Unlock className="h-3 w-3 inline mr-1.5" /> Unlock to Edit
                                </button>
                            ) : (
                                <button
                                    onClick={() => onLockQuarter(q)}
                                    className="w-full py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <Lock className="h-3 w-3 inline mr-1.5" /> Lock & Commit
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
