const API_URL = "http://127.0.0.1:8000";

// --- GESTION DE L'AUTHENTIFICATION ---

async function handleRegister() {
    const pseudo = document.getElementById('regPseudo').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const errorDiv = document.getElementById('registerError');

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pseudo, email, password })
        });

        if (response.ok) {
            showToast("Inscription réussie ! Connectez-vous.", false);
            toggleAuth(); // Basculer vers le formulaire de connexion
        } else {
            const data = await response.json();
            errorDiv.textContent = data.detail || "Erreur lors de l'inscription";
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = "Serveur injoignable";
        errorDiv.style.display = 'block';
    }
}

async function handleLogin() {
    const pseudo = document.getElementById('loginPseudo').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    const formData = new FormData();
    formData.append('username', pseudo);
    formData.append('password', password);

    try {
        const response = await fetch(`${API_URL}/token`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('gact_token', data.access_token);
            window.location.href = 'maison.html';
        } else {
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = "Serveur injoignable";
        errorDiv.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('gact_token');
    window.location.href = 'login.html';
}

async function loadUserProfile() {
    const token = localStorage.getItem('gact_token');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const user = await response.json();
            // Mise à jour du DOM
            const pseudoElem = document.getElementById('user-pseudo');
            const emailElem = document.getElementById('user-email');
            const statsElem = document.getElementById('user-stats');
            
            // Éléments de confiance
            const confidencePctElem = document.querySelector('.rep-pct');
            const confidenceBarFill = document.querySelector('.progress-bar-fill');

            if (pseudoElem) pseudoElem.textContent = user.pseudo;
            if (emailElem) emailElem.textContent = user.email;
            if (statsElem) statsElem.textContent = `Score: ${user.score_global} | Streak: ${user.streak}j`;
            
            if (confidencePctElem) {
                confidencePctElem.textContent = `${Math.round(user.trust_score)}%`;
            }
            if (confidenceBarFill) {
                confidenceBarFill.style.width = `${user.trust_score}%`;
            }
            
            // Charger les badges/pins
            renderUserBadges(user.badges);

            // Charger l'historique
            loadUserHistory();
        } else if (response.status === 401) {
            logout();
        }
    } catch (error) {
        console.error("Erreur lors du chargement du profil:", error);
    }
}

let allBadgesData = {}; // Sera rempli au démarrage

async function loadBadgesRegistry() {
    try {
        const response = await fetch(`${API_URL}/admin/badges-registry`);
        if (response.ok) {
            allBadgesData = await response.json();
        }
    } catch (e) { console.error("Erreur registre:", e); }
}

function togglePinsExpand() {
    const grid = document.getElementById('pins-grid');
    const btn = document.getElementById('expand-pins-btn');
    if (!grid || !btn) return;

    grid.classList.toggle('expanded');
    btn.textContent = grid.classList.contains('expanded') ? 'Réduire -' : 'Voir tout +';
}

function renderUserBadges(userBadges) {
    const pinsGrid = document.querySelector('.pins-grid');
    if (!pinsGrid) return;

    pinsGrid.innerHTML = '';
    
    // On veut afficher TOUS les badges si on a chargé le registre
    // Mais on commence par afficher ceux possédés
    userBadges.forEach(badge => {
        // Retrouver les infos dans le registre via le nom du fichier
        const badgeInfo = Object.values(allBadgesData).find(b => b.file === badge.badge_name);
        const displayName = badgeInfo ? badgeInfo.name : badge.badge_name;
        
        const pinItem = document.createElement('div');
        pinItem.className = 'pin-item';
        pinItem.innerHTML = `
            <div class="pin-circle">
              <img src="../img/pinsCoffreAleatoire/${badge.badge_name}" alt="${displayName}">
            </div>
            <span class="pin-label">${displayName}</span>
        `;
        pinsGrid.appendChild(pinItem);
    });

    // Si on a moins de 4 badges, on ajoute des slots vides pour garder l'alignement
    if (userBadges.length < 4) {
        for (let i = 0; i < (4 - userBadges.length); i++) {
            const empty = document.createElement('div');
            empty.className = 'pin-item';
            empty.innerHTML = `
                <div class="pin-circle pin-circle--empty"><span>+</span></div>
                <span class="pin-label">Vide</span>
            `;
            pinsGrid.appendChild(empty);
        }
    }
}

async function loadUserHistory() {
    const token = localStorage.getItem('gact_token');
    const historyContainer = document.getElementById('user-history');
    if (!token || !historyContainer) return;

    try {
        const response = await fetch(`${API_URL}/users/me/actions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const actions = await response.json();
            if (actions.length > 0) {
                historyContainer.innerHTML = '';
                actions.forEach(action => {
                    const item = document.createElement('div');
                    item.className = 'history-item';
                    item.innerHTML = `
                        <img src="${action.photo_url || '../img/autres/ecologique.png'}" alt="${action.category}">
                        <div class="history-badge">${action.category}</div>
                        <button class="delete-btn" onclick="deleteAction(${action.id}, event)">✕</button>
                    `;
                    historyContainer.appendChild(item);
                });
            } else {
                historyContainer.innerHTML = '<p style="font-size: 0.9em; color: #666; padding: 10px;">Aucune action publiée pour le moment.</p>';
            }
        }
    } catch (error) {
        console.error("Erreur lors du chargement de l'historique:", error);
    }
}

async function deleteAction(actionId, event) {
    if (event) event.stopPropagation();
    if (!confirm("Supprimer cette action ?")) return;

    const token = localStorage.getItem('gact_token');
    try {
        const response = await fetch(`${API_URL}/actions/${actionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showToast("Action supprimée", false);
            loadUserProfile(); // Recharger pour maj les points et l'historique
        } else {
            showToast("Erreur lors de la suppression", true);
        }
    } catch (error) {
        console.error("Erreur:", error);
    }
}

async function updateAllHeaders() {
    const token = localStorage.getItem('gact_token');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const user = await response.json();
            // Update points and streak in headers (Home and Vault)
            const ptsHome = document.getElementById('home-points');
            const strHome = document.getElementById('home-streak');
            const ptsVault = document.getElementById('vault-points');
            const strVault = document.getElementById('vault-streak');

            if (ptsHome) ptsHome.textContent = user.score_global;
            if (strHome) strHome.textContent = user.streak;
            if (ptsVault) ptsVault.textContent = user.score_global;
            if (strVault) strVault.textContent = user.streak;
        }
    } catch (error) {
        console.error("Erreur sync headers:", error);
    }
}

let communityActions = [];
let currentFeedIndex = 0;

async function loadCommunityFeed() {
    const token = localStorage.getItem('gact_token');
    const feedContainer = document.querySelector('main.page-scroll');
    if (!token || !feedContainer) return;

    try {
        const response = await fetch(`${API_URL}/actions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            communityActions = await response.json();
            currentFeedIndex = 0;
            displayNextAction();
        }
    } catch (error) {
        console.error("Erreur chargement feed:", error);
    }
}

function displayNextAction() {
    const feedContainer = document.getElementById('feed-container');
    if (!feedContainer) return;

    // Supprimer l'ancienne carte, le message de fin ou le spinner de chargement
    const oldCard = feedContainer.querySelector('.feed-card');
    if (oldCard) oldCard.remove();
    const oldMsg = feedContainer.querySelector('.no-actions-msg');
    if (oldMsg) oldMsg.remove();
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.remove();

    if (currentFeedIndex >= communityActions.length) {
        const msg = document.createElement('div');
        msg.className = 'no-actions-msg';
        msg.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; background: var(--glass-bg); border-radius: 20px; margin-top: 20px;">
                <p style="font-size: 1.2em; font-weight: 800; color: var(--text-dark);">Félicitations ! 🎉</p>
                <p style="color: var(--text-mid); margin-top: 10px;">Vous avez validé toutes les actions disponibles. Revenez plus tard !</p>
            </div>
        `;
        feedContainer.appendChild(msg);
        return;
    }

    const action = communityActions[currentFeedIndex];
    const card = document.createElement('article');
    card.className = 'feed-card';
    card.innerHTML = `
        <div class="feed-user-row">
          <img class="feed-avatar" src="../img/autres/photoDeProfilDeBase.png" alt="Avatar">
          <div>
            <div class="feed-username">${action.author_pseudo || 'Utilisateur'}</div>
            <div class="feed-time">Action récente</div>
          </div>
        </div>
        <div class="feed-photo-wrap">
          <img src="${action.photo_url}" alt="Action photo">
        </div>
        <div class="feed-vote-row">
          <button class="vote-btn vote-btn--accept" onclick="handleVote(${action.id}, 'up')">
            <img src="../img/autres/CocheValide.png" alt="Valider">
          </button>
          <div class="vote-chevrons">«</div>
          <span style="flex:1; text-align:center; font-size:13px; font-weight:700; color:var(--text-light);">Swipe</span>
          <div class="vote-chevrons">»</div>
          <button class="vote-btn vote-btn--reject" onclick="handleVote(${action.id}, 'down')">
            <span style="font-size: 32px; color: white; font-weight: 800;">✕</span>
          </button>
        </div>
        <div class="feed-info">
          <p class="feed-action-title">${action.description}</p>
          <span class="feed-tag">#${action.category}</span>
        </div>
    `;
    feedContainer.appendChild(card);
}

async function handleVote(actionId, type) {
    const token = localStorage.getItem('gact_token');
    if (!token) return;

    const voteType = (type === 'up') ? 'up' : 'down';

    try {
        const response = await fetch(`${API_URL}/actions/${actionId}/vote`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ vote_type: voteType })
        });

        if (response.ok) {
            showToast(type === 'up' ? "✅ Vote positif !" : "❌ Vote négatif", type !== 'up');
            currentFeedIndex++;
            displayNextAction();
            // Mettre à jour les points en haut au cas où le vote en donne
            updateAllHeaders();
        } else {
            const data = await response.json();
            showToast(data.detail || "Erreur lors du vote", true);
        }
    } catch (error) {
        console.error("Erreur vote:", error);
        showToast("Serveur injoignable", true);
    }
}

async function handleOpenChest(rarity) {
    const token = localStorage.getItem('gact_token');
    if (!token) return;

    // Charger le registre si pas fait
    if (Object.keys(allBadgesData).length === 0) await loadBadgesRegistry();

    try {
        const response = await fetch(`${API_URL}/chests/open/${rarity}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const result = await response.json();
            
            // Mettre à jour les points en haut
            updateAllHeaders();

            // Afficher le résultat dans la modal
            const modal = document.getElementById('reward-modal');
            const img = document.getElementById('reward-img');
            const nameTxt = document.getElementById('reward-name-text');
            const rarityTxt = document.getElementById('reward-rarity-text');
            const dupMsg = document.getElementById('reward-duplicate-msg');
            const confirmBtn = document.getElementById('reward-confirm-btn');

            if (modal && img && nameTxt && rarityTxt) {
                img.src = `../img/pinsCoffreAleatoire/${result.pin_file}`;
                nameTxt.textContent = result.badge_name;
                rarityTxt.textContent = result.rarity;
                
                // Colorer la rareté
                const colors = { common: '#56ab2f', rare: '#4facde', epic: '#a29bfe', legendary: '#f9c74f' };
                rarityTxt.style.color = colors[result.rarity] || 'white';
                
                // Gérer le doublon
                if (result.is_duplicate) {
                    dupMsg.style.display = 'block';
                    confirmBtn.textContent = 'Mince...';
                    confirmBtn.style.background = 'linear-gradient(135deg, #888, #555)';
                } else {
                    dupMsg.style.display = 'none';
                    confirmBtn.textContent = 'Super !';
                    confirmBtn.style.background = 'linear-gradient(135deg, var(--green-mid), #3d8b22)';
                }
                
                modal.style.display = 'flex';
            }
            
            showToast(`🎁 Coffre ouvert !`, false);
        } else {
            const error = await response.json();
            showToast(error.detail || "Erreur lors de l'ouverture", true);
        }
    } catch (error) {
        console.error("Erreur coffre:", error);
        showToast("Serveur injoignable", true);
    }
}

// Vérification de l'authentification au chargement
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('gact_token');
  const currentPage = window.location.pathname.split('/').pop();

  if (!token && currentPage !== 'login.html' && currentPage !== '') {
      window.location.href = 'login.html';
      return;
  }

  // Synchroniser les headers sur toutes les pages
  updateAllHeaders();

  // Si on est sur la page compte, on charge les infos
  if (currentPage === 'compte.html') {
      loadUserProfile();
  }

  // Si on est sur le feed
  if (currentPage === 'maison.html') {
      loadCommunityFeed();
  }

  // Gestion du bouton déconnexion
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
  }

  // Nav click → redirect
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      if (page) window.location.href = page;
    });
  });

  // ─── MAISON: Vote buttons ──────────────────
  const btnAccept = document.getElementById('btn-accept');
  const btnReject = document.getElementById('btn-reject');

  if (btnAccept) {
    btnAccept.addEventListener('click', () => {
      btnAccept.classList.remove('animate-accept');
      void btnAccept.offsetWidth; // reflow to restart animation
      btnAccept.classList.add('animate-accept');
      showToast('✅ Action validée !', false);
    });
  }

  if (btnReject) {
    btnReject.addEventListener('click', () => {
      btnReject.classList.remove('animate-reject');
      void btnReject.offsetWidth;
      btnReject.classList.add('animate-reject');
      showToast('❌ Action rejetée', true);
    });
  }

  // ─── CAMERA: Category selection ────────────
  const catBtns = document.querySelectorAll('.cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // ─── CAMERA: Shutter button ─────────────────
  const shutter = document.getElementById('camera-shutter');
  if (shutter) {
    shutter.addEventListener('click', () => {
      const inner = shutter.querySelector('.camera-shutter-inner');
      inner.style.transform = 'scale(0.85)';
      setTimeout(() => { inner.style.transform = 'scale(1)'; }, 180);
      showToast('📸 Photo prise !', false);
    });
  }

  // ─── CAMERA: Submit button ──────────────────
  const submitBtn = document.getElementById('submit-action');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const selectedCat = document.querySelector('.cat-btn.selected');
      const category = selectedCat ? selectedCat.getAttribute('data-cat') : 'Écologie';
      const description = document.getElementById('action-desc')?.value || "";
      const token = localStorage.getItem('gact_token');
      
      // Récupérer l'image capturée si elle existe (depuis le script interne ou global)
      const photoPreview = document.getElementById('photo-preview');
      const photoUrl = photoPreview && photoPreview.src && photoPreview.src.startsWith('data:') 
                       ? photoPreview.src 
                       : "img/autres/ecologique.png";

      if (!token) {
          showToast('❌ Erreur: Non connecté', true);
          return;
      }
      
      if (!description.trim()) {
          showToast('⚠️ Ajoutez une description !', true);
          return;
      }

      try {
          const response = await fetch(`${API_URL}/actions`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                  category: category,
                  description: description,
                  photo_url: photoUrl
              })
          });

          if (response.ok) {
              showToast('🌿 Action publiée ! +50 G-Points', false);
              setTimeout(() => { window.location.href = 'maison.html'; }, 1500);
          } else {
              const errorData = await response.json();
              showToast('❌ Erreur: ' + (errorData.detail || 'Serveur'), true);
          }
      } catch (error) {
          console.error("Erreur:", error);
          showToast('❌ Serveur injoignable (Vérifiez le backend)', true);
      }
    });
  }

  // ─── COFFRE: Open chest ─────────────────────
  const coffreCards = document.querySelectorAll('.coffre-card');
  coffreCards.forEach(card => {
    card.addEventListener('click', () => {
      const title = card.querySelector('.coffre-title')?.textContent || 'Coffre';
      showToast('🎁 ' + title + ' ouvert !', false);
    });
  });

  // ─── COMPTE: Settings button ─────────────────
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      showToast('⚙️ Paramètres bientôt disponibles', false);
    });
  }
});

// ─── Toast utility ──────────────
function showToast(message, isReject = false) {
  // Remove existing toast if any
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast' + (isReject ? ' reject' : '');
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 2200);
}

// Charger le registre au d�marrage global
loadBadgesRegistry();

