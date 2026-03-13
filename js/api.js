import { supabase } from './app.js';

const API = {
    // Quotas
    async getQuotas() {
        const { data, error } = await supabase.from('quotas').select('*');
        if (error) throw error;
        return data;
    },

    // Tickets
    async createTicket(ticketData, firstPayment) {
        // 1. Generate numero using RPC or manual sequence (RPC preferred for concurrency)
        const { data: numero, error: numError } = await supabase.rpc('generate_ticket_numero', {
            ticket_type: ticketData.type
        });

        if (numError) throw numError;

        // 2. Insert ticket
        const { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .insert([{ ...ticketData, numero }])
            .select()
            .single();

        if (ticketError) throw ticketError;

        // 3. Record first payment if > 0
        if (firstPayment > 0) {
            const { error: payError } = await supabase
                .from('versements_achat')
                .insert([{
                    ticket_id: ticket.id,
                    montant: firstPayment,
                    vendeur_id: ticketData.vendeur_id,
                    note: 'Premier versement à l\'achat'
                }]);

            if (payError) throw payError;
        }

        return ticket;
    },

    async getVendeurStats(vendeurId) {
        const { data, error } = await supabase
            .from('v_bilan_vendeurs')
            .select('*')
            .eq('vendeur_id', vendeurId)
            .single();

        if (error) throw error;
        return data;
    },

    async getVendeurTickets(vendeurId) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('vendeur_id', vendeurId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Tresorerie
    async getBilanVendeurs() {
        const { data, error } = await supabase.from('v_bilan_vendeurs').select('*');
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
    }
};

export default API;
