-- Force update all cafe images using IDs to be absolutely sure
-- IDs are 1-8 based on the seed order
UPDATE cafes SET image_url = '/img/cafe_pro.webp' WHERE id = 1 OR name LIKE '%Pro Gaming%';
UPDATE cafes SET image_url = '/img/cafe_khanuul.webp' WHERE id = 2 OR name LIKE '%Хан-Уул%';
UPDATE cafes SET image_url = '/img/cafe_bayangol.webp' WHERE id = 3 OR name LIKE '%Баянгол%';
UPDATE cafes SET image_url = '/img/cafe_p.webp' WHERE id = 4 OR name LIKE '%P Gaming%';
UPDATE cafes SET image_url = '/img/cafe_bayanzurkh.webp' WHERE id = 5 OR name LIKE '%Баянзүрх%';
UPDATE cafes SET image_url = '/img/cafe_shangrila.webp' WHERE id = 6 OR name LIKE '%Шангри-Ла%';
UPDATE cafes SET image_url = '/img/cafe_shk.webp' WHERE id = 7 OR name LIKE '%Сонгинохайрхан%';
UPDATE cafes SET image_url = '/img/cafe_sansar.webp' WHERE id = 8 OR name LIKE '%Сансар%';
