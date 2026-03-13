import CONFIG from './config.js';
import API from './api.js';
import VendeurView from './views/vendeur.js';
import TresoriereView from './views/tresoriere.js';

// Initialize Supabase client
const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const App = {
    user: null,
    profile: null,

    async init() {
        console.log("App Initializing...");
        this.checkAuth();
        this.setupEventListeners();
    },

    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            this.user = session.user;
            await this.fetchProfile();
            this.route();
        } else {
            this.showLogin();
        }
    },

    async fetchProfile() {
        if (!this.user) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', this.user.id)
            .single();

        if (error) {
            console.error("Profile fetch error:", error);
            return;
        }
        this.profile = data;
    },

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                this.login(email, password);
            });
        }
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            this.showNotification(error.message, 'error');
            return;
        }

        this.user = data.user;
        await this.fetchProfile();
        this.showNotification(`Bienvenue, ${this.profile?.prenom || 'Utilisateur'} !`, 'success');
        this.route();
    },

    async logout() {
        await supabase.auth.signOut();
        this.user = null;
        this.profile = null;
        window.location.reload();
    },

    async route() {
        if (!this.profile) return;

        const appEl = document.getElementById('app');
        if (this.profile.role === 'vendeur') {
            appEl.innerHTML = VendeurView.renderDashboard(this.profile);
            this.setupVendeurHandlers();
            this.refreshVendeurStats();
        } else if (this.profile.role === 'tresoriere') {
            appEl.innerHTML = TresoriereView.renderDashboard(this.profile);
            this.setupTresoriereHandlers();
            this.showVendeurBilan();
        } else {
            // Placeholder for other roles
            appEl.innerHTML = `
                <div style="padding: 2rem;">
                    <h1>Bonjour, ${this.profile.nom}</h1>
                    <p>Rôle: <strong>${this.profile.role}</strong></p>
                    <button id="logout-btn" class="btn" style="width: auto; margin-top: 1rem;">Déconnexion</button>
                </div>
            `;
            document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        }
    },

    setupVendeurHandlers() {
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('nav-new-ticket')?.addEventListener('click', () => this.showNewTicketForm());
        document.getElementById('nav-list-tickets')?.addEventListener('click', () => this.showTicketList());
        document.getElementById('nav-refresh-stats')?.addEventListener('click', () => this.refreshVendeurStats());
    },

    async refreshVendeurStats() {
        try {
            const stats = await API.getVendeurStats(this.user.id);
            const statsCards = document.querySelectorAll('.glass p');
            if (statsCards.length >= 3) {
                statsCards[0].innerText = `${stats.montant_encaisse_acheteurs || 0} F`;
                statsCards[1].innerText = stats.total_vendus || 0;
                statsCards[2].innerText = `${(stats.montant_du || 0) - (stats.verse_a_tresoriere || 0)} F`;
            }
        } catch (err) {
            console.error("Refresh stats error:", err);
        }
    },

    async showNewTicketForm() {
        const area = document.getElementById('vendeur-content-area');
        try {
            const quotas = await API.getQuotas();
            area.innerHTML = VendeurView.renderNewTicketForm(quotas);

            document.getElementById('new-ticket-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleNewTicketSubmit();
            });

            document.getElementById('cancel-new-ticket').addEventListener('click', () => {
                area.innerHTML = '';
            });
        } catch (err) {
            this.showNotification("Erreur lors de la récupération des types de tickets", "error");
        }
    },

    async handleNewTicketSubmit() {
        const type = document.getElementById('ticket-type').value;
        const select = document.getElementById('ticket-type');
        const selectedOption = select.options[select.selectedIndex];
        const prixTotal = parseInt(selectedOption.dataset.prix);

        const ticketData = {
            type: type,
            prix_total: prixTotal,
            acheteur_nom: document.getElementById('buyer-nom').value,
            acheteur_prenom: document.getElementById('buyer-prenom').value,
            telephone: document.getElementById('buyer-phone').value,
            filiere_classe: document.getElementById('buyer-class').value,
            public_cible: type === 'royal' ? 'administration' : (['gold', 'platinum', 'diamond'].includes(type) ? 'etudiant' : 'externe'),
            vendeur_id: this.user.id
        };

        const firstPayment = parseInt(document.getElementById('first-payment').value) || 0;

        try {
            await API.createTicket(ticketData, firstPayment);
            this.showNotification("Vente enregistrée avec succès !", "success");
            document.getElementById('vendeur-content-area').innerHTML = '';
            this.refreshVendeurStats();
        } catch (err) {
            console.error("Create ticket error:", err);
            this.showNotification("Erreur lors de l'enregistrement: " + err.message, "error");
        }
    },

    async showTicketList() {
        const area = document.getElementById('vendeur-content-area');
        area.innerHTML = '<p style="text-align:center; padding: 2rem;">Chargement des ventes...</p>';
        try {
            const tickets = await API.getVendeurTickets(this.user.id);
            area.innerHTML = VendeurView.renderTicketList(tickets);

            // Add payment handlers
            document.querySelectorAll('.btn-add-payment').forEach(btn => {
                btn.addEventListener('click', (e) => this.showAddPaymentModal(e.target.dataset.id));
            });
        } catch (err) {
            this.showNotification("Erreur lors du chargement des tickets", "error");
        }
    },

    showAddPaymentModal(ticketId) {
        // We'll implement this simple inline or as a separate form
        const amount = prompt("Entrez le montant du versement (F) :");
        if (amount && !isNaN(amount)) {
            this.handlePaymentSubmit(ticketId, parseInt(amount));
        }
    },

    async handlePaymentSubmit(ticketId, amount) {
        try {
            const { error } = await supabase
                .from('versements_achat')
                .insert([{
                    ticket_id: ticketId,
                    montant: amount,
                    vendeur_id: this.user.id,
                    note: 'Versement complémentaire'
                }]);

            if (error) throw error;

            this.showNotification("Paiement enregistré !", "success");
            this.showTicketList(); // Refresh list
            this.refreshVendeurStats();
        } catch (err) {
            this.showNotification("Erreur lors du paiement: " + err.message, "error");
        }
    },

    // TRESORIERE HANDLERS
    setupTresoriereHandlers() {
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('nav-record-payment')?.addEventListener('click', () => this.showRecordCaisseForm());
        document.getElementById('nav-vendeur-stats')?.addEventListener('click', () => this.showVendeurBilan());
    },

    async showVendeurBilan() {
        const area = document.getElementById('tres-content-area');
        area.innerHTML = '<p style="text-align:center; padding: 2rem;">Chargement du bilan...</p>';
        try {
            const bilans = await API.getBilanVendeurs();
            area.innerHTML = TresoriereView.renderVendeurBilan(bilans);
        } catch (err) {
            this.showNotification("Erreur lors du chargement du bilan", "error");
        }
    },

    async showRecordCaisseForm() {
        const area = document.getElementById('tres-content-area');
        try {
            const vendeurs = await API.getBilanVendeurs();
            area.innerHTML = TresoriereView.renderRecordPaymentForm(vendeurs);

            document.getElementById('record-payment-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const vendeurId = document.getElementById('vendeur-id').value;
                const montant = parseInt(document.getElementById('caisse-amount').value);
                const note = document.getElementById('caisse-note').value;

                try {
                    await API.recordCaisseVersement(vendeurId, this.user.id, montant, note);
                    this.showNotification("Versement enregistré !", "success");
                    this.showVendeurBilan();
                } catch (err) {
                    this.showNotification("Erreur: " + err.message, "error");
                }
            });

            document.getElementById('cancel-record-payment').addEventListener('click', () => {
                this.showVendeurBilan();
            });
        } catch (err) {
            this.showNotification("Erreur de récupération des vendeurs", "error");
        }
    },

    showLogin() {
        // index.html already shows login by default
    },

    showNotification(message, type = 'success') {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerText = message;

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());

export { supabase, App };
