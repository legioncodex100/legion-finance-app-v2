"use client"

import * as React from "react"
import { Plus, Loader2, Package, Truck, Monitor, Building2, ChevronRight, Pencil, Trash2, Calculator, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type AssetType = 'fixed' | 'current'
type AssetStatus = 'active' | 'disposed' | 'sold'
type DepreciationMethod = 'straight_line' | 'declining_balance' | 'none'

interface Asset {
    id: string
    name: string
    description?: string
    asset_type: AssetType
    category?: string
    purchase_date?: string
    purchase_price: number
    current_value?: number
    amount_paid?: number
    depreciation_method?: DepreciationMethod
    useful_life_years?: number
    salvage_value?: number
    status: AssetStatus
    disposal_date?: string
    disposal_amount?: number
    linked_transaction_id?: string
    notes?: string
    created_at: string
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'equipment': <Package className="h-4 w-4" />,
    'vehicle': <Truck className="h-4 w-4" />,
    'technology': <Monitor className="h-4 w-4" />,
    'property': <Building2 className="h-4 w-4" />,
}

export default function AssetsPage() {
    const [assets, setAssets] = React.useState<Asset[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    const [editingAsset, setEditingAsset] = React.useState<Asset | null>(null)
    const [isSaving, setIsSaving] = React.useState(false)

    // Form state
    const [name, setName] = React.useState("")
    const [description, setDescription] = React.useState("")
    const [assetType, setAssetType] = React.useState<AssetType>("fixed")
    const [category, setCategory] = React.useState("")
    const [purchaseDate, setPurchaseDate] = React.useState("")
    const [purchasePrice, setPurchasePrice] = React.useState("")
    const [currentValue, setCurrentValue] = React.useState("")
    const [depreciationMethod, setDepreciationMethod] = React.useState<DepreciationMethod>("straight_line")
    const [usefulLifeYears, setUsefulLifeYears] = React.useState("")
    const [salvageValue, setSalvageValue] = React.useState("")
    const [notes, setNotes] = React.useState("")
    const [assetPayments, setAssetPayments] = React.useState<Record<string, any[]>>({})

    const supabase = createClient()

    const fetchAssets = React.useCallback(async () => {
        setIsLoading(true)
        const { data } = await supabase
            .from('assets')
            .select('*')
            .order('created_at', { ascending: false })
        if (data) {
            setAssets(data)
            // Fetch linked transactions for all assets
            const assetIds = data.map(a => a.id)
            if (assetIds.length > 0) {
                const { data: transactions } = await supabase
                    .from('transactions')
                    .select('id, asset_id, amount, transaction_date, description')
                    .in('asset_id', assetIds)
                    .order('transaction_date', { ascending: false })
                if (transactions) {
                    const grouped = transactions.reduce((acc, tx) => {
                        if (tx.asset_id) {
                            if (!acc[tx.asset_id]) acc[tx.asset_id] = []
                            acc[tx.asset_id].push(tx)
                        }
                        return acc
                    }, {} as Record<string, any[]>)
                    setAssetPayments(grouped)
                }
            }
        }
        setIsLoading(false)
    }, [supabase])

    React.useEffect(() => {
        fetchAssets()
    }, [fetchAssets])

    const resetForm = () => {
        setName("")
        setDescription("")
        setAssetType("fixed")
        setCategory("")
        setPurchaseDate("")
        setPurchasePrice("")
        setCurrentValue("")
        setDepreciationMethod("straight_line")
        setUsefulLifeYears("")
        setSalvageValue("")
        setNotes("")
        setEditingAsset(null)
    }

    const handleOpenModal = (asset?: Asset) => {
        if (asset) {
            setEditingAsset(asset)
            setName(asset.name)
            setDescription(asset.description || "")
            setAssetType(asset.asset_type)
            setCategory(asset.category || "")
            setPurchaseDate(asset.purchase_date || "")
            setPurchasePrice(asset.purchase_price.toString())
            setCurrentValue(asset.current_value?.toString() || "")
            setDepreciationMethod(asset.depreciation_method || "straight_line")
            setUsefulLifeYears(asset.useful_life_years?.toString() || "")
            setSalvageValue(asset.salvage_value?.toString() || "")
            setNotes(asset.notes || "")
        } else {
            resetForm()
        }
        setIsModalOpen(true)
    }

    const calculateDepreciation = (asset: Asset): number => {
        if (!asset.purchase_date || !asset.useful_life_years || asset.depreciation_method === 'none') {
            return asset.purchase_price
        }

        const purchaseDate = new Date(asset.purchase_date)
        const now = new Date()
        const yearsElapsed = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
        const salvage = asset.salvage_value || 0

        if (asset.depreciation_method === 'straight_line') {
            const annualDepreciation = (asset.purchase_price - salvage) / asset.useful_life_years
            const totalDepreciation = Math.min(annualDepreciation * yearsElapsed, asset.purchase_price - salvage)
            return Math.max(asset.purchase_price - totalDepreciation, salvage)
        }

        // Declining balance (simplified)
        const rate = 2 / asset.useful_life_years
        let value = asset.purchase_price
        for (let i = 0; i < Math.floor(yearsElapsed); i++) {
            value = Math.max(value * (1 - rate), salvage)
        }
        return value
    }

    const handleSave = async () => {
        if (!name || !purchasePrice) return
        setIsSaving(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const assetData = {
                user_id: user.id,
                name,
                description: description || null,
                asset_type: assetType,
                category: category || null,
                purchase_date: purchaseDate || null,
                purchase_price: parseFloat(purchasePrice),
                current_value: currentValue ? parseFloat(currentValue) : null,
                depreciation_method: depreciationMethod,
                useful_life_years: usefulLifeYears ? parseInt(usefulLifeYears) : null,
                salvage_value: salvageValue ? parseFloat(salvageValue) : 0,
                notes: notes || null,
            }

            if (editingAsset) {
                await supabase.from('assets').update(assetData).eq('id', editingAsset.id)
            } else {
                await supabase.from('assets').insert(assetData)
            }

            fetchAssets()
            setIsModalOpen(false)
            resetForm()
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this asset?')) return
        await supabase.from('assets').delete().eq('id', id)
        fetchAssets()
    }

    // Group assets by type
    const fixedAssets = assets.filter(a => a.asset_type === 'fixed' && a.status === 'active')
    const currentAssets = assets.filter(a => a.asset_type === 'current' && a.status === 'active')

    const totalFixedValue = fixedAssets.reduce((sum, a) => sum + calculateDepreciation(a), 0)
    const totalCurrentValue = currentAssets.reduce((sum, a) => sum + (a.current_value || a.purchase_price), 0)

    return (
        <div className="max-w-[1400px] mx-auto pb-20 space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Asset Register</h1>
                    <p className="text-zinc-500 font-medium">Track and manage your business assets.</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="bg-white text-black hover:bg-zinc-200 font-bold">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Asset
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-zinc-950 border-zinc-900 p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Fixed Assets</p>
                            <p className="text-2xl font-bold text-white mt-1">£{totalFixedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <Badge variant="outline" className="text-zinc-500">{fixedAssets.length}</Badge>
                    </div>
                </Card>
                <Card className="bg-zinc-950 border-zinc-900 p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Current Assets</p>
                            <p className="text-2xl font-bold text-white mt-1">£{totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <Badge variant="outline" className="text-zinc-500">{currentAssets.length}</Badge>
                    </div>
                </Card>
                <Card className="bg-white text-black border-none p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Total Assets</p>
                            <p className="text-2xl font-black mt-1">£{(totalFixedValue + totalCurrentValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <Calculator className="h-5 w-5 text-black/20" />
                    </div>
                </Card>
            </div>

            {/* Asset Lists */}
            {isLoading ? (
                <div className="py-20 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
                </div>
            ) : assets.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-zinc-900 rounded-3xl text-center">
                    <p className="text-zinc-500">No assets found. Add your first asset to get started.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Fixed Assets */}
                    {fixedAssets.length > 0 && (
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 px-1">Fixed Assets</h2>
                            <Card className="bg-zinc-950 border-zinc-900 divide-y divide-zinc-900">
                                {fixedAssets.map(asset => {
                                    const depreciatedValue = calculateDepreciation(asset)
                                    const depreciation = asset.purchase_price - depreciatedValue
                                    return (
                                        <div key={asset.id} className="flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-500">
                                                    {CATEGORY_ICONS[asset.category || ''] || <Package className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-white">{asset.name}</p>
                                                        {(assetPayments[asset.id]?.length > 1 || (asset.amount_paid !== null && asset.amount_paid !== undefined && asset.amount_paid < asset.purchase_price)) ? (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">INSTALLMENT</span>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-xs text-zinc-600">{asset.category || 'Uncategorized'}</p>
                                                    {assetPayments[asset.id]?.length > 0 && (
                                                        <p className="text-[10px] text-sky-400">{assetPayments[asset.id].length} payment{assetPayments[asset.id].length > 1 ? 's' : ''} linked</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="font-bold text-white tabular-nums">£{depreciatedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                    {depreciation > 0 && (
                                                        <p className="text-[10px] text-rose-500">-£{depreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })} dep.</p>
                                                    )}
                                                    {asset.amount_paid !== undefined && asset.amount_paid < asset.purchase_price && (
                                                        <div className="mt-1">
                                                            <div className="flex items-center gap-1 justify-end">
                                                                <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                                                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.min((asset.amount_paid / asset.purchase_price) * 100, 100)}%` }} />
                                                                </div>
                                                                <span className="text-[10px] text-sky-400">{Math.round((asset.amount_paid / asset.purchase_price) * 100)}%</span>
                                                            </div>
                                                            <p className="text-[10px] text-zinc-500">£{asset.amount_paid.toFixed(2)} of £{asset.purchase_price.toFixed(2)} paid</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => handleOpenModal(asset)} className="text-zinc-600 hover:text-white transition-colors">
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleDelete(asset.id)} className="text-zinc-600 hover:text-rose-500 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </Card>
                        </div>
                    )}

                    {/* Current Assets */}
                    {currentAssets.length > 0 && (
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 px-1">Current Assets</h2>
                            <Card className="bg-zinc-950 border-zinc-900 divide-y divide-zinc-900">
                                {currentAssets.map(asset => (
                                    <div key={asset.id} className="flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-500">
                                                <Package className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-white">{asset.name}</p>
                                                <p className="text-xs text-zinc-600">{asset.category || 'Uncategorized'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="font-bold text-white tabular-nums">£{(asset.current_value || asset.purchase_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            <button onClick={() => handleOpenModal(asset)} className="text-zinc-600 hover:text-white transition-colors">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => handleDelete(asset.id)} className="text-zinc-600 hover:text-rose-500 transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </Card>
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">{editingAsset ? 'Edit Asset' : 'Add Asset'}</h2>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Asset Name *</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" placeholder="e.g. MacBook Pro" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Type</label>
                                    <select value={assetType} onChange={e => setAssetType(e.target.value as AssetType)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                        <option value="fixed">Fixed Asset</option>
                                        <option value="current">Current Asset</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Category</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                        <option value="">Select...</option>
                                        <option value="equipment">Equipment</option>
                                        <option value="vehicle">Vehicle</option>
                                        <option value="technology">Technology</option>
                                        <option value="furniture">Furniture</option>
                                        <option value="property">Property</option>
                                        <option value="inventory">Inventory</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Purchase Date</label>
                                    <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Purchase Price *</label>
                                    <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" placeholder="0.00" />
                                </div>
                            </div>
                            {assetType === 'fixed' && (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Depreciation</label>
                                            <select value={depreciationMethod} onChange={e => setDepreciationMethod(e.target.value as DepreciationMethod)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                                <option value="straight_line">Straight Line</option>
                                                <option value="declining_balance">Declining Balance</option>
                                                <option value="none">None</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Useful Life (yrs)</label>
                                            <input type="number" value={usefulLifeYears} onChange={e => setUsefulLifeYears(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" placeholder="5" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Salvage Value</label>
                                            <input type="number" value={salvageValue} onChange={e => setSalvageValue(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" placeholder="0.00" />
                                        </div>
                                    </div>
                                </>
                            )}
                            {assetType === 'current' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Current Value</label>
                                    <input type="number" value={currentValue} onChange={e => setCurrentValue(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" placeholder="0.00" />
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Notes</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full h-20 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm resize-none" placeholder="Additional details..." />
                            </div>
                            {/* Linked Payments Section */}
                            {editingAsset && assetPayments[editingAsset.id]?.length > 0 && (
                                <div className="border-t border-zinc-800 pt-4">
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                                        Linked Payments ({assetPayments[editingAsset.id].length})
                                    </label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {assetPayments[editingAsset.id].map((payment: any) => (
                                            <div key={payment.id} className="flex justify-between items-center p-2 rounded-lg bg-zinc-900/50 text-sm">
                                                <div>
                                                    <p className="text-white">{new Date(payment.transaction_date).toLocaleDateString()}</p>
                                                    <p className="text-xs text-zinc-500 truncate max-w-[200px]">{payment.description}</p>
                                                </div>
                                                <span className="text-emerald-400 font-bold">£{Math.abs(payment.amount).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-zinc-800 flex justify-between text-sm">
                                        <span className="text-zinc-500">Total Paid</span>
                                        <span className="text-white font-bold">£{assetPayments[editingAsset.id].reduce((sum: number, p: any) => sum + Math.abs(p.amount), 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-zinc-900 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancel</Button>
                            <Button onClick={handleSave} disabled={!name || !purchasePrice || isSaving} className="bg-white text-black hover:bg-zinc-200 font-bold">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {editingAsset ? 'Save Changes' : 'Add Asset'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
