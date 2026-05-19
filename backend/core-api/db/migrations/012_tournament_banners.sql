-- Add image_url to tournaments for banners
ALTER TABLE tournaments ADD COLUMN image_url TEXT AFTER title;
