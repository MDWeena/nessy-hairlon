alter table gallery add column if not exists description text default null;

update gallery set description = 'Elegant faux locs with a soft, flowing finish. Lightweight and versatile.'
  where day_of_week = 'Monday';
update gallery set description = 'Tension-free braids that start thin and gradually increase in size. Gentle on edges.'
  where day_of_week = 'Tuesday';
update gallery set description = 'Traditional braided pattern with side braids and a center braid. Cultural and chic.'
  where day_of_week = 'Wednesday';
update gallery set description = 'Bohemian-inspired twists with a soft, textured look. Low maintenance.'
  where day_of_week = 'Thursday';
update gallery set description = 'Sleek, flat braids cornrowed close to the scalp. Clean lines, long-lasting.'
  where day_of_week = 'Friday';
update gallery set description = 'Distressed faux locs with a messy, bohemian vibe. Trendy and unique.'
  where day_of_week = 'Saturday';
update gallery set description = 'Loose, free-flowing twists with curly ends. Effortlessly beautiful.'
  where day_of_week = 'Sunday';
