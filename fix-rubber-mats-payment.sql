-- Fix Gym Rubber Mats: Mark as fully paid
UPDATE assets 
SET amount_paid = purchase_price 
WHERE name = 'Gym Rubber Mats';
