-- User-facing rename: "Commute Kit" -> "Combo Bag".
-- Only the display title changes. The collection slug 'commute-kit' stays, so every product
-- collection link and relationship keeps working. Edited titles are left untouched.
update public.site_settings
set value = jsonb_set(value, '{campaign_title}', '"The Combo Bag"')
where key = 'homepage' and value ->> 'campaign_title' = 'The Commute Kit';
