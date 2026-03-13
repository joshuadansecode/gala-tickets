const TresoriereView = {
    renderDashboard(profile) {
        return `
            <div class="fade-in" style="padding: 1.5rem;">
                <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h1 style="color: var(--primary-color);">Espace Trésorière</h1>
                        <p>Bienvenue, ${profile.prenom}</p>
                    </div>
                    <button id="logout-btn" class="btn btn-secondary" style="width: auto; background: #eee; color: var(--text-dark);">Déconnexion</button>
                </header>

                <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                    <button id="nav-record-payment" class="btn btn-primary" style="width: auto;">Enregistrer un versement vendeur</button>
                    <button id="nav-vendeur-stats" class="btn" style="width: auto; border: 1px solid var(--accent-color); color: var(--primary-color);">Bilan des Vendeurs</button>
                </div>

                <div id="tres-content-area">
                    <!-- Dynamic content -->
                </div>
            </div>
        `;
    },

    renderVendeurBilan(bilans) {
        const rows = bilans.map(b => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 1rem; font-weight: 600;">${b.vendeur}</td>
                <td style="padding: 1rem; text-align: center;">${b.total_vendus}</td>
                <td style="padding: 1rem; text-align: right;">${b.montant_du} F</td>
                <td style="padding: 1rem; text-align: right; color: var(--success);">${b.verse_a_tresoriere} F</td>
                <td style="padding: 1rem; text-align: right; font-weight: 700; color: ${b.montant_du - b.verse_a_tresoriere > 0 ? 'var(--danger)' : 'var(--success)'};">
                    ${b.montant_du - b.verse_a_tresoriere} F
                </td>
            </tr>
        `).join('');

        return `
            <div class="fade-in" style="background: white; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden;">
                <h3 style="padding: 1rem; font-size: 1rem; border-bottom: 1px solid #eee;">Bilan Financier par Vendeur</h3>
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem;">Vendeur</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem; text-align: center;">Vendus</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem; text-align: right;">Dû (Ventes)</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem; text-align: right;">Versé (Caisse)</th>
                            <th style="padding: 1rem; color: #666; font-size: 0.85rem; text-align: right;">Reste Dû</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderRecordPaymentForm(vendeurs) {
        let options = vendeurs.map(v => `<option value="${v.vendeur_id}">${v.vendeur}</option>`).join('');

        return `
            <div class="auth-card" style="max-width: 500px; margin: 0 auto; text-align: left;">
                <h2 style="margin-bottom: 1.5rem; color: var(--primary-color);">Encaisser un Vendeur</h2>
                <form id="record-payment-form">
                    <div class="form-group">
                        <label>Vendeur</label>
                        <select id="vendeur-id" required style="width:100%; padding:0.75rem; border-radius:var(--radius); border:1px solid #ddd;">
                            ${options}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Montant Versé (F)</label>
                        <input type="number" id="caisse-amount" required min="1">
                    </div>
                    <div class="form-group">
                        <label>Note (facultatif)</label>
                        <input type="text" id="caisse-note" placeholder="Ex: Versement partiel semaine 1">
                    </div>
                    <button type="submit" class="btn btn-primary">Enregistrer le versement</button>
                    <button type="button" id="cancel-record-payment" class="btn" style="background:none; color:#666; margin-top:0.5rem;">Annuler</button>
                </form>
            </div>
        `;
    }
};

export default TresoriereView;
