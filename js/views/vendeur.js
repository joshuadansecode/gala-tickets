const VendeurView = {
    renderDashboard(profile) {
        return `
            <div class="fade-in" style="padding: 1.5rem;">
                <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h1 style="color: var(--primary-color);">Tableau de Bord Vendeur</h1>
                        <p>Bienvenue, ${profile.prenom}</p>
                    </div>
                    <button id="logout-btn" class="btn btn-secondary" style="width: auto; background: #eee; color: var(--text-dark);">Déconnexion</button>
                </header>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <div class="glass" style="padding: 1.5rem; border-radius: var(--radius); background: white; box-shadow: var(--shadow);">
                        <h3 style="font-size: 0.9rem; color: #666;">Encaissé Aujourd'hui</h3>
                        <p style="font-size: 1.8rem; font-weight: 700; color: var(--success);">0 F</p>
                    </div>
                    <div class="glass" style="padding: 1.5rem; border-radius: var(--radius); background: white; box-shadow: var(--shadow);">
                        <h3 style="font-size: 0.9rem; color: #666;">Tickets Vendus</h3>
                        <p style="font-size: 1.8rem; font-weight: 700; color: var(--primary-color);">0</p>
                    </div>
                    <div class="glass" style="padding: 1.5rem; border-radius: var(--radius); background: white; box-shadow: var(--shadow);">
                        <h3 style="font-size: 0.9rem; color: #666;">Reste à Verser</h3>
                        <p style="font-size: 1.8rem; font-weight: 700; color: var(--warning);">0 F</p>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                    <button id="nav-new-ticket" class="btn btn-primary" style="width: auto;">+ Nouveau Ticket</button>
                    <button id="nav-list-tickets" class="btn" style="width: auto; border: 1px solid var(--accent-color); color: var(--primary-color);">Mes Ventes</button>
                    <button id="nav-refresh-stats" class="btn" style="width: auto; background: none; color: #666; font-size: 0.8rem;">Actualiser</button>
                </div>

                <div id="vendeur-content-area">
                    <!-- Dynamic content will be injected here -->
                </div>
            </div>
        `;
    },

    renderNewTicketForm(quotas) {
        let options = quotas.map(q => `<option value="${q.type}" data-prix="${q.prix}">${q.type.toUpperCase()} (${q.prix} F)</option>`).join('');

        return `
            <div class="auth-card" style="max-width: 600px; margin: 0 auto; text-align: left;">
                <h2 style="margin-bottom: 1.5rem; color: var(--primary-color);">Vendre un Nouveau Ticket</h2>
                <form id="new-ticket-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label>Nom de l'acheteur</label>
                            <input type="text" id="buyer-nom" required>
                        </div>
                        <div class="form-group">
                            <label>Prénom de l'acheteur</label>
                            <input type="text" id="buyer-prenom" required>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label>Téléphone</label>
                            <input type="text" id="buyer-phone">
                        </div>
                        <div class="form-group">
                            <label>Filière / Classe</label>
                            <input type="text" id="buyer-class">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Type de Ticket</label>
                        <select id="ticket-type" style="width:100%; padding:0.75rem; border-radius:var(--radius); border:1px solid #ddd;">
                            ${options}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Premier Versement (F)</label>
                        <input type="number" id="first-payment" required min="0">
                    </div>
                    <button type="submit" class="btn btn-primary">Enregistrer la vente</button>
                    <button type="button" id="cancel-new-ticket" class="btn" style="background:none; color:#666; margin-top:0.5rem;">Annuler</button>
                </form>
            </div>
        `;
    },

    renderTicketList(tickets) {
        if (!tickets || tickets.length === 0) return '<p style="text-align:center; padding: 2rem; color: #666;">Aucune vente enregistrée pour le moment.</p>';

        const rows = tickets.map(t => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 1rem; font-weight: 600; color: var(--primary-color);">${t.numero}</td>
                <td style="padding: 1rem;">${t.acheteur_nom} ${t.acheteur_prenom}</td>
                <td style="padding: 1rem;">${t.type.toUpperCase()}</td>
                <td style="padding: 1rem;">${t.prix_total} F</td>
                <td style="padding: 1rem;">${t.montant_paye} F</td>
                <td style="padding: 1rem;">
                    <span style="padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; 
                        background: ${t.statut === 'solde' ? '#d1fae5' : '#fef3c7'}; 
                        color: ${t.statut === 'solde' ? '#065f46' : '#92400e'};">
                        ${t.statut === 'solde' ? '✅ Soldé' : '🟡 Partiel'}
                    </span>
                </td>
                <td style="padding: 1rem;">
                    <button class="btn-add-payment" data-id="${t.id}" style="background: none; border: none; color: var(--accent-color); cursor: pointer; font-weight: 600;">+ Payer</button>
                </td>
            </tr>
        `).join('');

        return `
            <div class="fade-in" style="background: white; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem;">Numéro</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem;">Acheteur</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem;">Type</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem;">Total</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem;">Payé</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem;">Statut</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }
};

export default VendeurView;
