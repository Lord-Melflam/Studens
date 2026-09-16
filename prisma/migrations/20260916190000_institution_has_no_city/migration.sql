-- An institution does not have a city.
--
-- The column said UCLouvain is in Louvain-la-Neuve, and the first run printed
-- it beside the name. Counted from UCLouvain's own 2025-2026 catalogue, 268 of
-- its 692 programmes are taught somewhere else: Woluwe, Saint-Louis, Mons,
-- Charleroi, Tournai, Saint-Gilles. Their own catalogue page opens with
-- "L'UCLouvain est une universite multisite", and names eight campuses.
--
-- Not a UCLouvain quirk, which is why the column goes rather than the one row
-- being emptied: ULiege's campus page names Gembloux and Arlon besides Liege.
-- A column that has to stay null everywhere it is not wrong is a trap, and the
-- next person fills it in.
--
-- The site is a real dimension, and it belongs to the CATALOGUE, where a
-- programme is taught at one: `sinc1ba` and `sinf1ba` are both "Bachelier en
-- sciences informatiques", one in Charleroi and one in Louvain-la-Neuve. It is
-- modelled there, on the row where it is a fact, and not here on the row where
-- it is an average.

ALTER TABLE "ref"."Institution" DROP COLUMN "city";
