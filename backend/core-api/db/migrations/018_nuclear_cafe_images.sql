-- Nuclear update for cafe images using flexible pattern matching
-- This avoids issues with different dash types (hyphen vs em-dash)

UPDATE cafes SET image_url = '/img/cafe_pro.webp' WHERE name LIKE '%Pro%Gaming%' OR name LIKE '%Төв%';
UPDATE cafes SET image_url = '/img/cafe_khanuul.webp' WHERE name LIKE '%Хан%Уул%';
UPDATE cafes SET image_url = '/img/cafe_bayangol.webp' WHERE name LIKE '%Баянгол%';
UPDATE cafes SET image_url = '/img/cafe_p.webp' WHERE name LIKE '%P%Gaming%' OR name LIKE '%талбай%';
UPDATE cafes SET image_url = '/img/cafe_bayanzurkh.webp' WHERE name LIKE '%Баянзүрх%';
UPDATE cafes SET image_url = '/img/cafe_shangrila.webp' WHERE name LIKE '%Шангри%';
UPDATE cafes SET image_url = '/img/cafe_shk.webp' WHERE name LIKE '%Сонгино%' OR name LIKE '%ШХ%';
UPDATE cafes SET image_url = '/img/cafe_sansar.webp' WHERE name LIKE '%Сансар%';
