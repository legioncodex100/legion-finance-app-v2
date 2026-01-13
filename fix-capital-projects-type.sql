UPDATE categories
SET type = 'expense'
WHERE class_id = (
    SELECT id FROM financial_classes WHERE code = 'CAPITAL EXPENDITURE'
);
