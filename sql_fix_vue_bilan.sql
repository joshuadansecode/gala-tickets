-- Ce script met à jour la vue des bilans (utilisée par la Trésorière et l'Admin)
-- pour qu'elle puisse calculer l'argent dû par TOUS les membres du staff (Direction, Trésorière, Admin, Observateur) 
-- au cas où ils auraient reçu des tickets physiques pour les vendre.

CREATE OR REPLACE VIEW public.v_bilan_vendeurs AS
SELECT
  p.id AS vendeur_id,
  ((p.nom || ' ') || p.prenom) AS vendeur,
  COALESCE(sum(r.gold), (0)::bigint) AS retires_gold,
  COALESCE(sum(r.platinum), (0)::bigint) AS retires_platinum,
  COALESCE(sum(r.diamond), (0)::bigint) AS retires_diamond,
  COALESCE(sum(r.royal), (0)::bigint) AS retires_royal,
  COALESCE(sum(r.standard), (0)::bigint) AS retires_standard,
  COALESCE(sum(r.vip), (0)::bigint) AS retires_vip,
  COALESCE(sum((((((r.gold + r.platinum) + r.diamond) + r.royal) + r.standard) + r.vip)), (0)::bigint) AS total_retires,
  count(t.id) AS total_vendus,
  COALESCE(sum(t.prix_total), (0)::bigint) AS montant_du,
  COALESCE(sum(t.montant_paye), (0)::bigint) AS montant_encaisse_acheteurs,
  COALESCE(( SELECT sum(vc.montant) AS sum
           FROM versements_caisse vc
          WHERE (vc.vendeur_id = p.id)), (0)::bigint) AS verse_a_tresoriere
FROM ((profiles p
  LEFT JOIN retraits_tickets r ON ((r.vendeur_id = p.id)))
  LEFT JOIN tickets t ON ((t.vendeur_id = p.id)))
WHERE (p.actif = true) -- <<< ICI : On a retiré le filtre strict "role = 'vendeur'"
GROUP BY p.id, p.nom, p.prenom;
