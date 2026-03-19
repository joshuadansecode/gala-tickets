-- Script de réparation des rôles et du système d'inscription

-- 1. Suppression de l'ancienne limite stricte qui empêchait de créer les rôles direction et observateur
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Ajout de la nouvelle règle acceptant l'intégralité du staff
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'tresoriere', 'vendeur', 'direction', 'observateur'));

-- 3. Mise à jour définitive du générateur automatique de profil (trigger Supabase)
-- afin qu'il capture scrupuleusement les informations choisies dans le navigateur (dont le telephone et le bon rôle)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  is_first boolean;
BEGIN
  -- Vérifier si c'est le grand manitou (tout premier compte)
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first;

  INSERT INTO public.profiles (id, nom, prenom, email, role, actif, telephone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nom', 'Utilisateur'),
    COALESCE(new.raw_user_meta_data->>'prenom', 'Nouveau'),
    new.email,
    CASE 
      WHEN is_first THEN 'admin'
      ELSE COALESCE(new.raw_user_meta_data->>'role', 'vendeur')
    END,
    true, -- On active les profils par défaut dès la création par l'Admin
    new.raw_user_meta_data->>'telephone'
  );
  RETURN new;
END;
$function$;
