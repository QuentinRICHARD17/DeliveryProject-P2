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

            if (pseudoElem) pseudoElem.textContent = user.pseudo;
            if (emailElem) emailElem.textContent = user.email;
            if (statsElem) statsElem.textContent = `Score: ${user.score_global} | Streak: ${user.streak}j`;
        } else if (response.status === 401) {
            logout();
        }
    } catch (error) {
        console.error("Erreur lors du chargement du profil:", error);
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

  // Si on est sur la page compte, on charge les infos
  if (currentPage === 'compte.html') {
      loadUserProfile();
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
