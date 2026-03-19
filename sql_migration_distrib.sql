-- ============================================================
--  GALA INSTITUT — Migration V2 : Système de Distribution
-- ============================================================

-- 1. Nettoyage des anciennes tables de test (si elles existent)
DROP VIEW IF EXISTS v_bilan_vendeurs CASCADE;
DROP TABLE IF EXISTS versements_achat CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS ventes CASCADE;

-- 2. Mise à jour de la table "quotas"
-- Supprimer la contrainte restrictive sur le nom des types de tickets
ALTER TABLE quotas DROP CONSTRAINT IF EXISTS quotas_type_check;
ALTER TABLE quotas ADD CONSTRAINT quotas_type_check CHECK (type IN ('gold_int', 'plat_int', 'diam_int', 'gold_ext', 'diam_ext', 'royal'));

TRUNCATE TABLE quotas CASCADE;

-- Insertion des 6 nouveaux types
INSERT INTO quotas (type, prix, public_cible, max_tickets) VALUES
  ('gold_int', 10000, 'etudiant', 100),
  ('plat_int', 12000, 'etudiant', 100),
  ('diam_int', 15000, 'etudiant', 80),
  ('gold_ext', 15000, 'externe', 80),
  ('diam_ext', 20000, 'externe', 60),
  ('royal',    25000, 'administration', 50);

-- 3. NOUVELLE TABLE : DISTRIBUTIONS
CREATE TABLE distributions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_ticket text, -- Peut être NULL pour les tickets Royal
  type_ticket text NOT NULL REFERENCES quotas(type),
  
  -- Infos acheteur
  acheteur_nom text NOT NULL,
  acheteur_prenom text NOT NULL,
  acheteur_filiere text NOT NULL,
  acheteur_whatsapp text NOT NULL, -- Format forcé via JS : +229XXXXXXX
  
  -- Données Financières
  prix_unitaire integer NOT NULL,
  reduction integer NOT NULL DEFAULT 0,
  source_reduction text CHECK (source_reduction IN ('bde', 'administration')),
  prix_final integer GENERATED ALWAYS AS (prix_unitaire - reduction) STORED,
  
  montant_paye integer NOT NULL DEFAULT 0,
  reste_a_payer integer GENERATED ALWAYS AS (prix_unitaire - reduction - montant_paye) STORED,
  
  statut text GENERATED ALWAYS AS (
    CASE 
      WHEN (prix_unitaire - reduction - montant_paye) <= 0 THEN 'paye'
      WHEN montant_paye > 0 THEN 'partiel'
      ELSE 'impaye'
    END
  ) STORED,
  
  -- Métadonnées de distribution
  distribue_par uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- RLS: Les vendeurs voient tout pour l'instant (besoin de vérifier doublons)
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture globale" ON distributions FOR SELECT USING (true);
CREATE POLICY "insertion libre" ON distributions FOR INSERT WITH CHECK (auth.uid() = distribue_par);
-- L'admin ou la tresoriere ou "comite" pourront modifier si besoin de corriger
CREATE POLICY "modification" ON distributions FOR UPDATE USING (
  exists (
    select 1 from profiles 
    where profiles.id = auth.uid() 
    and profiles.role IN ('admin', 'tresoriere', 'comite')
  )
);

-- 4. NOUVELLE TABLE : VERSEMENTS (Suivi des paiements progressifs)
CREATE TABLE versements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distribution_id uuid NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  montant integer NOT NULL CHECK (montant > 0),
  enregistre_par uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- RLS Versements
ALTER TABLE versements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture" ON versements FOR SELECT USING (true);
-- Seuls admin et tresoriere peuvent enregistrer des versements ultérieurs
CREATE POLICY "insertion" ON versements FOR INSERT WITH CHECK (
  exists (
    select 1 from profiles 
    where profiles.id = auth.uid() 
    and profiles.role IN ('admin', 'tresoriere')
  )
);

-- 5. TRIGGER INTELLIGENT : Mise à jour de "montant_paye" dans "distributions" à chaque versement
CREATE OR REPLACE FUNCTION update_distribution_montant_paye()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE distributions
  SET montant_paye = montant_paye + NEW.montant
  WHERE id = NEW.distribution_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_distribution
AFTER INSERT ON versements
FOR EACH ROW EXECUTE FUNCTION update_distribution_montant_paye();

-- 6. VUE : Dettes du Comité
CREATE OR REPLACE VIEW v_dettes_comite AS
SELECT 
  COALESCE(SUM(CASE WHEN source_reduction = 'bde' THEN reduction ELSE 0 END), 0) AS dette_bde,
  COALESCE(SUM(CASE WHEN source_reduction = 'administration' THEN reduction ELSE 0 END), 0) AS dette_admin,
  COALESCE(SUM(reduction), 0) AS dette_totale
FROM distributions;

-- 7. VUE : Suivi des débiteurs
CREATE OR REPLACE VIEW v_suivi_creances AS
SELECT 
  d.id AS distribution_id,
  d.numero_ticket,
  d.acheteur_nom, d.acheteur_prenom, d.acheteur_filiere, d.acheteur_whatsapp,
  d.type_ticket, d.prix_final, d.montant_paye, d.reste_a_payer, d.statut
FROM distributions d
WHERE d.reste_a_payer > 0
ORDER BY d.created_at DESC;
