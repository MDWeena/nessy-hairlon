-- Optional photo per service, shown as a thumbnail on the client-facing
-- services list and in the booking flow's service picker. Uploaded to
-- Cloudinary from the admin panel, same as gallery images.

alter table services add column if not exists image_url text default null;
