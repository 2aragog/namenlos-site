/* ═══════════════════════════════════════════════════
   NAMENLOS · GA4 Analytics
   Replace GA_ID with your Measurement ID (G-XXXXXXXXXX)
   ═══════════════════════════════════════════════════ */

(function(){
  var GA_ID = 'G-ZEBJ33H2HF';

  // — Load gtag.js —
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, {
    page_title: document.title,
    cookie_flags: 'SameSite=None;Secure'
  });

  // — Helper: fire event once per session per key —
  var fired = {};
  function once(name, params) {
    var key = name + '|' + (params.item || params.room || '');
    if (fired[key]) return;
    fired[key] = true;
    gtag('event', name, params);
  }

  // ═══ PAGE-LEVEL EVENTS ═══
  // Detect which page we're on
  var path = location.pathname.replace(/^\//, '') || 'home';
  var page = path.replace('.html','');

  // ═══ SHOP SCENE TRACKING ═══
  // Monkey-patch goTo() to track room navigation
  if (typeof window.goTo === 'function') { patchGoTo(); }
  else { document.addEventListener('DOMContentLoaded', function(){ setTimeout(patchGoTo, 100); }); }

  function patchGoTo() {
    if (typeof window.goTo !== 'function') return;
    var _orig = window.goTo;
    window.goTo = function(sceneId) {
      // Track room view
      gtag('event', 'room_view', {
        room: sceneId,
        room_name: (window.SCENE_TITLES && window.SCENE_TITLES[sceneId]) || sceneId
      });

      // Special events
      if (sceneId === 'cash') {
        once('purchase_intent', { item: 'drawer' });
      }
      if (sceneId === 'secret') {
        once('secret_room_enter', { method: 'code' });
      }

      return _orig.apply(this, arguments);
    };
  }

  // ═══ BOOK / ARTIFACT / MEDIA CLICKS ═══
  document.addEventListener('DOMContentLoaded', function(){

    // Patch openBookModal
    if (typeof window.openBookModal === 'function') {
      var _book = window.openBookModal;
      window.openBookModal = function(id) {
        gtag('event', 'book_click', { book_id: id });
        return _book.apply(this, arguments);
      };
    }

    // Patch openArtifactModal
    if (typeof window.openArtifactModal === 'function') {
      var _art = window.openArtifactModal;
      window.openArtifactModal = function(id) {
        gtag('event', 'artifact_click', { artifact_id: id });
        return _art.apply(this, arguments);
      };
    }

    // Patch openMediaDetail
    if (typeof window.openMediaDetail === 'function') {
      var _media = window.openMediaDetail;
      window.openMediaDetail = function(id) {
        gtag('event', 'media_click', { media_id: id });
        return _media.apply(this, arguments);
      };
    }

    // Patch openMediaModal
    if (typeof window.openMediaModal === 'function') {
      var _mm = window.openMediaModal;
      window.openMediaModal = function(type) {
        gtag('event', 'media_click', { media_id: type });
        return _mm.apply(this, arguments);
      };
    }

    // Track shopkeeper chat
    if (typeof window.sendChat === 'function') {
      var _chat = window.sendChat;
      window.sendChat = function() {
        once('shopkeeper_chat', { item: 'message' });
        return _chat.apply(this, arguments);
      };
    }

    // Track secret code attempts
    if (typeof window.checkSecretCode === 'function') {
      var _code = window.checkSecretCode;
      window.checkSecretCode = function() {
        gtag('event', 'secret_code_attempt', {});
        return _code.apply(this, arguments);
      };
    }
  });

  // ═══ OUTBOUND LINK TRACKING ═══
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.href || '';
    // Track Digistore / external purchase links
    if (href.indexOf('digistore') > -1) {
      gtag('event', 'purchase_click', { url: href, source: page });
    }
    // Track outbound links
    if (a.hostname && a.hostname !== location.hostname) {
      gtag('event', 'outbound_click', { url: href, source: page });
    }
  });

  // ═══ SCROLL DEPTH (browse.html) ═══
  if (page === 'browse') {
    var milestones = [25, 50, 75, 100];
    var scrollFired = {};
    window.addEventListener('scroll', function() {
      var pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      milestones.forEach(function(m) {
        if (pct >= m && !scrollFired[m]) {
          scrollFired[m] = true;
          gtag('event', 'scroll_depth', { percent: m, page: page });
        }
      });
    }, { passive: true });
  }

  // ═══ TIME ON PAGE ═══
  var intervals = [30, 60, 120, 300]; // seconds
  intervals.forEach(function(sec) {
    setTimeout(function() {
      gtag('event', 'engaged_time', { seconds: sec, page: page });
    }, sec * 1000);
  });

})();
