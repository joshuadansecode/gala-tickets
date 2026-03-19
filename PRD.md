# Product Requirements Document (PRD) & Technical Specs - GalaTickets

**ATTENTION POUR L'IA (Maintien de Contexte) :** 
Ce document est la source de vérité absolue pour l'architecture de GalaTickets. Lisez-le de A à Z avant toute modification. 

## 1. Vue d'ensemble du Projet
**GalaTickets** est une plateforme web sur-mesure (Hébergée sur Vercel : `https://gala-tickets.vercel.app`) conçue pour gérer la vente, le suivi et la distribution de tickets premium pour un événement de Gala. L'application est destinée à un usage interne par le staff organisateur, offrant un contrôle strict sur la trésorerie et la traçabilité des billets avec **Supabase** en backend.
Le code source est versionné sur `https://github.com/joshuadansecode/gala-tickets.git`.

## 2. Architecture Technique
- **Frontend** : HTML5, CSS3 modulaire, JavaScript (Architecture ES Modules stricte `type="module"`).
- **Backend & Base de Données** : Supabase (PostgreSQL).
- **Format UI** : Un fichier par Rôle (Ex: `admin.html`, `vendeur.html`, `tresoriere.html`, `direction.html`). Le design exploite un thème sombre premium (Or/Neon) avec police `Inter`.

## 3. Base de Données & Schéma (Supabase)

### A. Tables Principales
1. **`profiles`**
   - Colonnes : `id` (UUID refs auth.users), `nom`, `prenom`, `email`, `role`, `telephone`, `actif` (bool), `created_at`.
   - Automatisme : Un trigger PostgreSQL `handle_new_user()` s'active à chaque Inscription Auth (Signup) pour remplir automatiquement cette table.
2. **`tickets`**
   - Colonnes : `id`, `vendeur_id` (refs profiles), `numero_ticket` (Optionnel), `acheteur_nom`, `acheteur_prenom`, `acheteur_tel`, `filiere`, `type_ticket`, `prix_unitaire`, `montant_verse`, `reste_a_payer`, `statut` (paye, partiel, impaye), `source_reduction`, `created_at`.
3. **`versements_distributions`**
   - Rôle : Gère le transfert d'argent liquide du vendeur vers la trésorière.
   - Colonnes : `id`, `vendeur_id`, `tresoriere_id`, `montant`, `statut` (en_attente, valide, rejete), `date_versement`, `date_validation`.
4. **`retraits_tickets`**
   - Rôle : Trace de la quantité de carnets (par type) remis physiquement par l'admin au vendeur.
5. **`quotas_vendeurs`**
   - Rôle : Le nombre exact de tickets maximum autorisés à la vente par utilisateur pour chaque catégorie de tickets physiques.

### B. Vues SQL (Materialisées Virtuelles) pour Dashboards
Pour optimiser les performances RLS et éviter de coder en Js les statistiques :
- **`v_bilan_distributions`** : Somme l'argent attendu VS argent versé du Vendeur -> Trésorière.
- **`v_suivi_creances`** : Suivi global des dettes (reste à payer).
- **`v_stats_par_type_de_tickets`** : Statistiques globales par type de tickets (Standard, VIP, etc.).

## 4. Sécurité & Roles (RBAC + RLS)
Les rôles disponibles sont : **admin**, **tresoriere**, **vendeur**, **comite**, **direction** et **observateur**.
- Le système utilise un backend `Row Level Security (RLS)`.
- **Note CRITIQUE RLS** : Une boucle infinie a été corrigée. La fonction `get_user_role()` (SECURITY DEFINER) est utilisée pour lire `profiles.role` en toute sécurité afin d'appliquer le RLS sans déclencher de récursion (Error 500 API Supabase évité).
- **Modification de Mots de Passe** : Un script Deno Edge Function a été déployé sous Supabase : `update-user-password` pour permettre aux Admins de réinitialiser les MDP des vendeurs via le client `invoke()`.

## 5. Spécificités du Code (À conserver pour la suite)
1. **Modules JS (Le Piège)** : Tous les fichiers HTML importent leurs logiques via `<script type="module">`. Par conséquent, toute fonction appelée par un attribut HTML `onclick="maFonction()"` **DOIT IMPERATIVEMENT ÊTRE EXPOSÉE** via `window.maFonction = maFonction` à la fin du `<script>` JS, sans quoi elle retournera "ReferenceError".
2. **Client Supabase Actuel** : Le chargement de `lib/supabase.js` en CDN + Création via `js/auth.js` est fragile. **Ne réintroduisez jamais de fichier `js/app.js`**, il a été supprimé pour conflit de double-client (GoTrueClient Multiple instances).
3. **Robustesse de Rendu** : Dans `admin.html`, la boucle `allProfiles.map()` a été sécurisée sur `prenom` et `nom` (ex: `(p.prenom || '')`) pour prévenir les crashs Javascript de la page si un utilisateur s'inscrit sans nom défini dans ses méta-données.

## 6. Workflow Trésorerie
1. Vendeur ajoute une vente partielle ou totale (Table `tickets`).
2. Vendeur encaisse physiquement l'argent.
3. Vendeur déclare un "Versement" sur son tableau de bord (`versements_distributions`).
4. Trésorière voit le versement apparaître dans "Brouillards en attente" (`tresoriere.html`).
5. Trésorière valide, ce qui diminue la dette du Vendeur affichée dans la base.
