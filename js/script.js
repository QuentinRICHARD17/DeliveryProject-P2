document.addEventListener('DOMContentLoaded', () => {

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
    submitBtn.addEventListener('click', () => {
      showToast('🌿 Action publiée ! +50 G-Points', false);
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
