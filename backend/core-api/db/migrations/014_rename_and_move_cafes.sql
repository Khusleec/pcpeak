-- Rename and Move Cafe Branches
-- 1. Mongol PC — Төв -> Pro Gaming (Bayangol)
-- 2. Mongol PC — Сүхбаатарын талбай -> P Gaming (100 ail)

UPDATE cafes 
SET name = 'Pro Gaming', 
    address = 'Баянгол дүүрэг, Улаанбаатар', 
    latitude = 47.9100, 
    longitude = 106.8700 
WHERE name = 'Mongol PC — Төв';

UPDATE cafes 
SET name = 'P Gaming', 
    address = '100 айл, Сүхбаатар дүүрэг, Улаанбаатар', 
    latitude = 47.9300, 
    longitude = 106.9200 
WHERE name = 'Mongol PC — Сүхбаатарын талбай';
