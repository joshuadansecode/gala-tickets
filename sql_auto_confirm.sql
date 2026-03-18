-- Ce script doit être exécuté dans l'éditeur SQL de Supabase pour contourner
-- l'exigence de confirmation par email et permettre aux comptes créés par l'Admin
-- de se connecter immédiatement.

-- 1. Création de la fonction déclencheur (Trigger Function)
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Met la date de confirmation d'email au moment de l'insertion
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
$$;

-- 2. Attachement du déclencheur à la table auth.users
DROP TRIGGER IF EXISTS trg_auto_confirm_email ON auth.users;

CREATE TRIGGER trg_auto_confirm_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_email();
