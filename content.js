(() => {
  const ADDRESS_SELECTORS = [
    '[data-testid="PropertyHeaderAddressDesktop-wrapper"]',
    '[data-testid="PropertyHeaderAddressMobile-wrapper"]',
    '.hp_address_subtitle',
    '.js-hp_address_subtitle'
  ];
  const MARK = 'bmlBound';

  const HIDDEN_CONTAINERS = '[role="tooltip"], [aria-hidden="true"], [hidden], [data-testid*="tooltip" i], .bui-u-sr-only';

  function isVisible(node) {
    const el = node.parentElement;
    if (!el || el.closest(HIDDEN_CONTAINERS)) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }

  // Booking puts extra text (location score, hidden disclaimer tooltips) inside
  // the address element; the address is the first visible text node.
  function extractAddress(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.replace(/\s+/g, ' ').trim();
      if (t.length > 5 && isVisible(n)) return t;
    }
    return '';
  }

  function hotelName() {
    // Only specific selectors: a generic h2 fallback picked up section titles like "Yer Durumu".
    const h = document.querySelector('h2.pp-header__title, #hp_hotel_name h2');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function coordinates() {
    const el = document.querySelector('[data-atlas-latlng]');
    return el ? el.getAttribute('data-atlas-latlng') : '';
  }

  function mapsUrl(address) {
    const name = hotelName();
    const query = [name, address].filter(Boolean).join(', ') || coordinates();
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  }

  const STRINGS = {
    tr: { open: "Google Maps'te aç", copy: 'Kopyala', copied: 'Kopyalandı', title: 'Otel konumu' },
    en: { open: 'Open in Google Maps', copy: 'Copy', copied: 'Copied', title: 'Hotel location' },
    nl: { open: 'Openen in Google Maps', copy: 'Kopiëren', copied: 'Gekopieerd', title: 'Locatie hotel' },
    de: { open: 'In Google Maps öffnen', copy: 'Kopieren', copied: 'Kopiert', title: 'Hotelstandort' },
    fr: { open: 'Ouvrir dans Google Maps', copy: 'Copier', copied: 'Copié', title: "Emplacement de l'hôtel" },
    es: { open: 'Abrir en Google Maps', copy: 'Copiar', copied: 'Copiado', title: 'Ubicación del hotel' },
    pt: { open: 'Abrir no Google Maps', copy: 'Copiar', copied: 'Copiado', title: 'Localização do hotel' },
    it: { open: 'Apri in Google Maps', copy: 'Copia', copied: 'Copiato', title: "Posizione dell'hotel" }
  };
  // Follow the Booking page language (e.g. .tr.html → <html lang="tr">), then the browser.
  const lang = (document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase();
  const T = STRINGS[lang] || STRINGS.en;

  const ICON_PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  const ICON_EXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>';
  const ICON_COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

  const tip = document.createElement('div');
  tip.className = 'bml-tip';
  tip.innerHTML =
    '<div class="bml-arrow"></div>' +
    '<div class="bml-head">' +
      '<span class="bml-pin">' + ICON_PIN + '</span>' +
      '<div class="bml-text"><div class="bml-title"></div><div class="bml-address"></div></div>' +
    '</div>' +
    '<div class="bml-actions">' +
      '<a class="bml-link" target="_blank" rel="noopener noreferrer">' + ICON_EXT + '<span></span></a>' +
      '<button class="bml-copy" type="button"></button>' +
    '</div>';
  tip.querySelector('.bml-title').textContent = T.title;
  tip.querySelector('.bml-link span').textContent = T.open;
  const link = tip.querySelector('.bml-link');
  const copyBtn = tip.querySelector('.bml-copy');
  const addressEl = tip.querySelector('.bml-address');
  let hideTimer = null;
  let copyTimer = null;
  let currentAddress = '';

  function setCopyLabel(done) {
    copyBtn.classList.toggle('bml-done', done);
    copyBtn.innerHTML = (done ? ICON_CHECK : ICON_COPY) + '<span></span>';
    copyBtn.querySelector('span').textContent = done ? T.copied : T.copy;
  }
  setCopyLabel(false);

  // Keep clicks from reaching Booking's own map-modal handlers.
  ['click', 'mousedown', 'mouseup'].forEach((ev) =>
    tip.addEventListener(ev, (e) => e.stopPropagation())
  );
  copyBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(currentAddress);
    } catch {
      return;
    }
    setCopyLabel(true);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => setCopyLabel(false), 1500);
  });
  tip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  tip.addEventListener('mouseleave', scheduleHide);

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => tip.classList.remove('bml-visible'), 300);
  }

  function show(el) {
    clearTimeout(hideTimer);
    currentAddress = extractAddress(el);
    if (!currentAddress && !coordinates()) return;
    link.href = mapsUrl(currentAddress);
    addressEl.textContent = currentAddress || coordinates();
    copyBtn.style.display = currentAddress ? '' : 'none';
    if (!tip.isConnected) document.body.appendChild(tip);
    const r = el.getBoundingClientRect();
    const maxLeft = document.documentElement.clientWidth - tip.offsetWidth - 8;
    const left = Math.max(8, Math.min(r.left, maxLeft));
    tip.style.top = window.scrollY + r.bottom + 10 + 'px';
    tip.style.left = window.scrollX + left + 'px';
    tip.style.setProperty('--bml-arrow-x', Math.max(16, Math.min(r.left - left + 20, tip.offsetWidth - 24)) + 'px');
    tip.classList.add('bml-visible');
  }

  function bind() {
    document.querySelectorAll(ADDRESS_SELECTORS.join(',')).forEach((el) => {
      if (el.dataset[MARK]) return;
      el.dataset[MARK] = '1';
      el.addEventListener('mouseenter', () => show(el));
      el.addEventListener('mouseleave', scheduleHide);
    });
  }

  bind();
  new MutationObserver(bind).observe(document.body, { childList: true, subtree: true });
})();
