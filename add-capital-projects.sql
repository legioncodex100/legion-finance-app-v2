-- Add Capital Projects Financial Class
INSERT INTO financial_classes (code, name, description, user_id)
VALUES ('8000', 'Capital Projects', 'Major capital expenditures and asset investments', 'e29589a7-3d44-4678-b06c-5829ef68cebc');

-- Get the financial_class_id for Capital Projects
DO $$
DECLARE
    capital_class_id UUID;
    building_group_id UUID;
    equipment_group_id UUID;
    tech_group_id UUID;
    furniture_group_id UUID;
BEGIN
    -- Get Capital Projects class ID
    SELECT id INTO capital_class_id FROM financial_classes WHERE code = '8000';

    -- Add Category Groups under Capital Projects
    INSERT INTO categories (name, parent_id, class_id, description, user_id)
    VALUES ('Building & Property', NULL, capital_class_id, 'Property acquisitions and building improvements', 'e29589a7-3d44-4678-b06c-5829ef68cebc')
    RETURNING id INTO building_group_id;

    INSERT INTO categories (name, parent_id, class_id, description, user_id)
    VALUES ('Equipment & Machinery', NULL, capital_class_id, 'Production equipment and machinery', 'e29589a7-3d44-4678-b06c-5829ef68cebc')
    RETURNING id INTO equipment_group_id;

    INSERT INTO categories (name, parent_id, class_id, description, user_id)
    VALUES ('Technology & Software', NULL, capital_class_id, 'Capitalized software and IT infrastructure', 'e29589a7-3d44-4678-b06c-5829ef68cebc')
    RETURNING id INTO tech_group_id;

    INSERT INTO categories (name, parent_id, class_id, description, user_id)
    VALUES ('Furniture & Fixtures', NULL, capital_class_id, 'Office furniture and fixtures', 'e29589a7-3d44-4678-b06c-5829ef68cebc')
    RETURNING id INTO furniture_group_id;

    -- Add Specific Categories under Building & Property
    INSERT INTO categories (name, parent_id, class_id, description, user_id)
    VALUES 
        ('Building Improvements', building_group_id, capital_class_id, 'Major building renovations and improvements', 'e29589a7-3d44-4678-b06c-5829ef68cebc'),
        ('Property Acquisition', building_group_id, capital_class_id, 'Purchase of land or buildings', 'e29589a7-3d44-4678-b06c-5829ef68cebc'),
        ('Leasehold Improvements', building_group_id, capital_class_id, 'Improvements to leased property', 'e29589a7-3d44-4678-b06c-5829ef68cebc');

    -- Add Specific Categories under Equipment & Machinery
    INSERT INTO categories (name, parent_id, class_id, description, user_id)
    VALUES 
        ('Production Equipment', equipment_group_id, capital_class_id, 'Manufacturing and production machinery', 'e29589a7-3d44-4678-b06c-5829ef68cebc'),
        ('IT Hardware', equipment_group_id, capital_class_id, 'Servers, computers, network equipment', 'e29589a7-3d44-4678-b06c-5829ef68cebc'),
        ('Vehicles', equipment_group_id, capital_class_id, 'Company vehicles and transport equipment', 'e29589a7-3d44-4678-b06c-5829ef68cebc');

    -- Add Specific Categories under Technology & Software
    INSERT INTO categories (name, parent_id, class_id, description, user_id)
    VALUES 
        ('Software Licenses', tech_group_id, capital_class_id, 'Capitalized software licenses', 'e29589a7-3d44-4678-b06c-5829ef68cebc'),
        ('Development Projects', tech_group_id, capital_class_id, 'Internal software development', 'e29589a7-3d44-4678-b06c-5829ef68cebc'),
        ('Infrastructure', tech_group_id, capital_class_id, 'IT infrastructure investments', 'e29589a7-3d44-4678-b06c-5829ef68cebc');

    -- Add Specific Categories under Furniture & Fixtures
    INSERT INTO categories (name, parent_id, class_id, description, user_id)
    VALUES 
        ('Office Furniture', furniture_group_id, capital_class_id, 'Desks, chairs, cabinets', 'e29589a7-3d44-4678-b06c-5829ef68cebc'),
        ('Fixtures', furniture_group_id, capital_class_id, 'Permanent fixtures and fittings', 'e29589a7-3d44-4678-b06c-5829ef68cebc');

END $$;
