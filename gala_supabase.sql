-- ============================================================
--  GALA INSTITUT — Système de Gestion des Tickets
--  Supabase SQL — Tables + RLS + Seed
-- ============================================================

-- ── 0. EXTENSIONS ───────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ── 1. PROFILES (vendeurs, trésorière, admin) ───────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nom         text not null,
  prenom      text not null,
  telephone   text,
  role        text not null check (role in ('admin', 'tresoriere', 'vendeur')),
  actif       boolean default true,
  created_at  timestamptz default now()
);


-- ── 2. QUOTAS (stock max par type de ticket) ────────────────
create table quotas (
  type        text primary key check (type in ('gold','platinum','diamond','royal','standard','vip')),
  prix        integer not null,          -- en FCFA
  public_cible text not null,            -- etudiant | administration | externe
  max_tickets integer not null default 0,
  updated_at  timestamptz default now()
);

-- Seed quotas (l'admin peut modifier les max_tickets)
insert into quotas (type, prix, public_cible, max_tickets) values
  ('gold',     10000, 'etudiant',       100),
  ('platinum', 12000, 'etudiant',       100),
  ('diamond',  15000, 'etudiant',       80),
  ('royal',    25000, 'administration', 50),
  ('standard', 15000, 'externe',        80),
  ('vip',      20000, 'externe',        60);


-- ── 3. RETRAITS_TICKETS (lots retirés par un vendeur) ───────
create table retraits_tickets (
  id            uuid primary key default uuid_generate_v4(),
  vendeur_id    uuid not null references profiles(id),
  gold          integer default 0,
  platinum      integer default 0,
  diamond       integer default 0,
  royal         integer default 0,
  standard      integer default 0,
  vip           integer default 0,
  note          text,
  enregistre_par uuid references profiles(id),  -- admin qui a saisi
  created_at    timestamptz default now()
);


-- ── 4. TICKETS (un par acheteur) ────────────────────────────
create table tickets (
  id              uuid primary key default uuid_generate_v4(),

  -- Numérotation automatique par type
  numero          text not null unique,   -- ex: G001, V012, R005...

  -- Type & prix
  type            text not null check (type in ('gold','platinum','diamond','royal','standard','vip')),
  prix_total      integer not null,       -- FCFA

  -- Infos acheteur
  acheteur_nom    text not null,
  acheteur_prenom text not null,
  telephone       text,
  filiere_classe  text,
  public_cible    text not null check (public_cible in ('etudiant','administration','externe')),

  -- Paiement
  montant_paye    integer not null default 0,
  statut          text not null default 'partiel' check (statut in ('partiel','solde')),

  -- Traçabilité
  vendeur_id      uuid not null references profiles(id),
  created_at      timestamptz default now(),  -- ordre des places
  updated_at      timestamptz default now()
);

-- Index pour tri par ordre d'arrivée (= ordre des places)
create index idx_tickets_created_at on tickets(created_at asc);
create index idx_tickets_type on tickets(type);
create index idx_tickets_vendeur on tickets(vendeur_id);
create index idx_tickets_statut on tickets(statut);


-- ── 5. VERSEMENTS_ACHAT (paiements partiels des acheteurs) ──
create table versements_achat (
  id          uuid primary key default uuid_generate_v4(),
  ticket_id   uuid not null references tickets(id) on delete cascade,
  montant     integer not null check (montant > 0),
  vendeur_id  uuid not null references profiles(id),  -- qui a encaissé
  note        text,
  created_at  timestamptz default now()
);

create index idx_versements_achat_ticket on versements_achat(ticket_id);


-- ── 6. VERSEMENTS_CAISSE (vendeur → trésorière) ─────────────
create table versements_caisse (
  id              uuid primary key default uuid_generate_v4(),
  vendeur_id      uuid not null references profiles(id),
  montant         integer not null check (montant > 0),
  tresoriere_id   uuid not null references profiles(id),
  note            text,
  created_at      timestamptz default now()
);

create index idx_versements_caisse_vendeur on versements_caisse(vendeur_id);


-- ── 7. FUNCTIONS & TRIGGERS ─────────────────────────────────

-- 7a. Générer le numéro de ticket automatiquement
create or replace function generate_ticket_numero(ticket_type text)
returns text as $$
declare
  prefix text;
  next_num integer;
  numero text;
begin
  prefix := case ticket_type
    when 'gold'     then 'G'
    when 'platinum' then 'P'
    when 'diamond'  then 'D'
    when 'royal'    then 'R'
    when 'standard' then 'S'
    when 'vip'      then 'V'
  end;

  select count(*) + 1 into next_num
  from tickets
  where type = ticket_type;

  numero := prefix || lpad(next_num::text, 3, '0');
  return numero;
end;
$$ language plpgsql;


-- 7b. Mettre à jour montant_paye et statut après chaque versement achat
create or replace function update_ticket_paiement()
returns trigger as $$
declare
  total_verse integer;
  prix integer;
begin
  select sum(montant) into total_verse
  from versements_achat
  where ticket_id = NEW.ticket_id;

  select prix_total into prix
  from tickets
  where id = NEW.ticket_id;

  update tickets
  set
    montant_paye = total_verse,
    statut = case when total_verse >= prix then 'solde' else 'partiel' end,
    updated_at = now()
  where id = NEW.ticket_id;

  return NEW;
end;
$$ language plpgsql;

create trigger trg_update_ticket_paiement
after insert on versements_achat
for each row execute function update_ticket_paiement();


-- 7c. updated_at auto sur tickets
create or replace function set_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

create trigger trg_tickets_updated_at
before update on tickets
for each row execute function set_updated_at();


-- ── 8. VIEWS PRATIQUES ──────────────────────────────────────

-- Vue : liste complète triée par ordre de paiement (= plan de placement)
create or replace view v_liste_placement as
select
  t.numero,
  t.type,
  t.prix_total,
  t.acheteur_nom,
  t.acheteur_prenom,
  t.telephone,
  t.filiere_classe,
  t.public_cible,
  t.montant_paye,
  t.prix_total - t.montant_paye as reste_a_payer,
  t.statut,
  p.nom || ' ' || p.prenom as vendeur,
  t.created_at as date_inscription
from tickets t
join profiles p on p.id = t.vendeur_id
order by t.created_at asc;


-- Vue : bilan par vendeur (tickets + argent)
create or replace view v_bilan_vendeurs as
select
  p.id as vendeur_id,
  p.nom || ' ' || p.prenom as vendeur,

  -- Tickets retirés
  coalesce(sum(r.gold), 0)     as retires_gold,
  coalesce(sum(r.platinum), 0) as retires_platinum,
  coalesce(sum(r.diamond), 0)  as retires_diamond,
  coalesce(sum(r.royal), 0)    as retires_royal,
  coalesce(sum(r.standard), 0) as retires_standard,
  coalesce(sum(r.vip), 0)      as retires_vip,
  coalesce(sum(r.gold + r.platinum + r.diamond + r.royal + r.standard + r.vip), 0) as total_retires,

  -- Tickets vendus (enregistrés)
  count(t.id) as total_vendus,

  -- Argent
  coalesce(sum(t.prix_total), 0)    as montant_du,
  coalesce(sum(t.montant_paye), 0)  as montant_encaisse_acheteurs,

  -- Versements à la trésorière
  coalesce((
    select sum(vc.montant)
    from versements_caisse vc
    where vc.vendeur_id = p.id
  ), 0) as verse_a_tresoriere

from profiles p
left join retraits_tickets r on r.vendeur_id = p.id
left join tickets t on t.vendeur_id = p.id
where p.role = 'vendeur' and p.actif = true
group by p.id, p.nom, p.prenom;


-- Vue : stats globales par type de ticket
create or replace view v_stats_par_type as
select
  q.type,
  q.prix,
  q.public_cible,
  q.max_tickets,
  count(t.id) as vendus,
  q.max_tickets - count(t.id) as restants,
  coalesce(sum(t.montant_paye), 0) as recette_encaissee,
  coalesce(sum(t.prix_total), 0) as recette_theorique
from quotas q
left join tickets t on t.type = q.type
group by q.type, q.prix, q.public_cible, q.max_tickets;


-- ── 9. ROW LEVEL SECURITY (RLS) ─────────────────────────────
alter table profiles           enable row level security;
alter table quotas             enable row level security;
alter table retraits_tickets   enable row level security;
alter table tickets            enable row level security;
alter table versements_achat   enable row level security;
alter table versements_caisse  enable row level security;

-- Helper : récupérer le rôle de l'utilisateur connecté
create or replace function get_user_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer;


-- PROFILES
create policy "Lecture profil personnel" on profiles
  for select using (id = auth.uid() or get_user_role() in ('admin','tresoriere'));

create policy "Admin gère les profils" on profiles
  for all using (get_user_role() = 'admin');


-- QUOTAS
create policy "Lecture quotas pour tous" on quotas
  for select using (auth.uid() is not null);

create policy "Admin modifie quotas" on quotas
  for update using (get_user_role() = 'admin');


-- RETRAITS_TICKETS
create policy "Lecture retraits pour tous connectés" on retraits_tickets
  for select using (auth.uid() is not null);

create policy "Admin enregistre retraits" on retraits_tickets
  for insert using (get_user_role() = 'admin');


-- TICKETS
create policy "Lecture tickets pour tous connectés" on tickets
  for select using (auth.uid() is not null);

create policy "Vendeur crée un ticket" on tickets
  for insert with check (
    get_user_role() in ('vendeur','admin') and vendeur_id = auth.uid()
  );

create policy "Admin modifie tickets" on tickets
  for update using (get_user_role() = 'admin');

create policy "Admin supprime tickets" on tickets
  for delete using (get_user_role() = 'admin');


-- VERSEMENTS_ACHAT
create policy "Lecture versements achat" on versements_achat
  for select using (auth.uid() is not null);

create policy "Vendeur ajoute versement achat" on versements_achat
  for insert with check (
    get_user_role() in ('vendeur','admin') and vendeur_id = auth.uid()
  );


-- VERSEMENTS_CAISSE
create policy "Lecture versements caisse" on versements_caisse
  for select using (auth.uid() is not null);

create policy "Trésorière enregistre versement caisse" on versements_caisse
  for insert with check (
    get_user_role() in ('tresoriere','admin') and tresoriere_id = auth.uid()
  );


-- ============================================================
--  FIN DU SCRIPT
--  Prochaine étape : créer les comptes dans Auth > Users
--  puis insérer dans profiles avec le bon rôle.
-- ============================================================
