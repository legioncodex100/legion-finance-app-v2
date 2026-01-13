-- Create assets table for Asset Register
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('fixed', 'current')),
    category TEXT, -- 'equipment', 'vehicle', 'furniture', 'inventory', 'technology', 'property'
    purchase_date DATE,
    purchase_price DECIMAL(12,2) NOT NULL,
    current_value DECIMAL(12,2),
    depreciation_method TEXT CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none')),
    useful_life_years INTEGER,
    salvage_value DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'sold')),
    disposal_date DATE,
    disposal_amount DECIMAL(12,2),
    linked_transaction_id UUID REFERENCES transactions(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own assets"
    ON assets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assets"
    ON assets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets"
    ON assets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets"
    ON assets FOR DELETE
    USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
