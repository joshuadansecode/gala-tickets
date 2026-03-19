import { supabase } from './app.js';

const API = {
    // Utilitaires
    formatWhatsAppLink(phone) {
        if (!phone) return '#';
        // Garder uniquement les chiffres
        let clean = phone.replace(/\D/g, '');
        
        // Si ça commence par 229, on nettoie
        if (clean.startsWith('229')) {
            let core = clean.substring(3);
            // Si le core commence par 01, on le coupe
            if (core.startsWith('01') && core.length === 10) {
                core = core.substring(2);
            }
            return `https://wa.me/229${core}`;
        }
        
        // Autre pays ou format bizarre, on laisse tel quel
        return `https://wa.me/${clean}`;
    },

    // Quotas
    async getQuotas() {
        const { data, error } = await supabase.from('quotas').select('*');
        if (error) throw error;
        return data;
    },

    // Distributions (Remplace les anciens tickets/ventes)
    async distribuerTicket(distData) {
        // Enregistrer la distribution (ticket remis)
        const { data: dist, error: distError } = await supabase
            .from('distributions')
            .insert([{
                numero_ticket: distData.numero_ticket || null,
                type_ticket: distData.type_ticket,
                acheteur_nom: distData.acheteur_nom,
                acheteur_prenom: distData.acheteur_prenom,
                acheteur_filiere: distData.acheteur_filiere,
                acheteur_whatsapp: distData.acheteur_whatsapp,
                prix_unitaire: distData.prix_unitaire,
                reduction: distData.reduction || 0,
                source_reduction: distData.source_reduction || null,
                distribue_par: distData.distribue_par
            }])
            .select()
            .single();

        if (distError) throw distError;

        // S'il y a un acompte initial, l'enregistrer dans versements
        if (distData.montant_paye > 0) {
            await this.ajouterVersement({
                distribution_id: dist.id,
                montant: distData.montant_paye,
                enregistre_par: distData.distribue_par
            });
        }

        return dist;
    },

    async ajouterVersement(versData) {
        const { data, error } = await supabase
            .from('versements')
            .insert([versData])
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },

    // Récupérer les distributions faites par quelqu'un
    async getDistributions(userId) {
        const { data, error } = await supabase
            .from('distributions')
            .select('*')
            .eq('distribue_par', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Tresorerie & Suivi Admin
    async getSuiviCreances() {
        const { data, error } = await supabase.from('v_suivi_creances').select('*');
        if (error) throw error;
        return data;
    },

    async getUserStats(vendeurId) {
        const { data } = await supabase.from('v_bilan_distributions').select('*').eq('vendeur_id', vendeurId).single();
        return data || null;
    },

    async getDettesComite() {
        const { data, error } = await supabase.from('v_dettes_comite').select('*').single();
        if (error) throw error;
        return data;
    },

    async recordCaisseVersement(vendeurId, tresoriereId, montant, note) {
        const { error } = await supabase
            .from('versements_caisse')
            .insert([{
                vendeur_id: vendeurId,
                tresoriere_id: tresoriereId,
                montant: montant,
                note: note
            }]);
        if (error) throw error;
    },

    formatWhatsAppLink(tel) {
        if (!tel) return '#';
        let clean = tel.replace(/\D/g, '');
        if (!clean.startsWith('229') && clean.length === 8) {
            clean = '22901' + clean;
        } else if (!clean.startsWith('229') && clean.length >= 10) {
            clean = '229' + clean;
        }
        return `https://wa.me/${clean}?text=${encodeURIComponent('Bonjour, suite à l\'enregistrement de votre ticket, nous vous contactons...')}`;
    }
};

export default API;
