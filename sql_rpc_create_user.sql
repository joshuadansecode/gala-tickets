-- Ce script doit être exécuté dans l'éditeur SQL de Supabase.

-- 1. Supprimer le trigger qui faisait planter l'API Supabase
DROP TRIGGER IF EXISTS trg_auto_confirm_email ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_email();

-- 2. Créer une fonction distante (RPC) 100% sécurisée
CREATE OR REPLACE FUNCTION admin_create_user(
  email_input text,
  password_input text,
  nom_input text,
  prenom_input text,
  role_input text,
  tel_input text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Permet d'ignorer les règles RLS pour insérer l'utilisateur
AS $$
DECLARE
  new_uid uuid;
  role_check text;
BEGIN
  -- Vérifier que la personne qui fait l'appel est bien un Admin
  SELECT role INTO role_check FROM public.profiles WHERE id = auth.uid();
  IF role_check != 'admin' THEN
    RAISE EXCEPTION 'Non autorisé: Seul un Admin peut créer un compte directly.';
  END IF;

  -- Générer un nouvel ID
  new_uid := gen_random_uuid();

  -- Insérer l'utilisateur dans l'authentification native de Supabase
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    new_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email_input,
    crypt(password_input, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nom', nom_input, 'prenom', prenom_input, 'role', role_input, 'telephone', tel_input),
    now(), now()
  );

  -- Créer l'identité liée pour permettre la connexion
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at, email
  ) VALUES (
    gen_random_uuid(), new_uid, format('{"sub":"%s","email":"%s"}', new_uid::text, email_input)::jsonb, 'email', new_uid::text, now(), now(), now(), email_input
  );

  -- Insérer le profil GalaTickets
  INSERT INTO public.profiles (id, nom, prenom, email, role, telephone, actif)
  VALUES (new_uid, nom_input, prenom_input, email_input, role_input, tel_input, true)
  ON CONFLICT (id) DO UPDATE SET
    nom = EXCLUDED.nom, prenom = EXCLUDED.prenom, role = EXCLUDED.role, telephone = EXCLUDED.telephone;

  RETURN new_uid;
END;
$$;
