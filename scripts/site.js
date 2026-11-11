/*
 * Studio Santé Active - small site enhancements. No build step, no dependencies.
 * Every feature is progressive: pages are complete without JavaScript, and this only adds to them.
 *
 *   1. Current year in the footer copyright
 *   2. "Ouvert maintenant / Fermé" status next to the footer hours
 *   3. Notice bar for upcoming holiday closures + always-current list on the FAQ
 *   4. Floating contact button that appears after the banner and hides at the footer
 *   5. Pause / play button for the homepage video
 *   6. Opening the FAQ question, conditions section or trainer bio that a link points to,
 *      plus "Tout ouvrir / Tout fermer" on the FAQ and conditions
 *   7. Theme slider: light / night / rainbow (the saved choice is applied earlier, by an inline script in each <head>)
 *   8. Hiding homepage events once they are over
 *   9. A "swipe" hint under price tables that are wider than the screen
 *  10. Trainer bios open in a full-width panel under their row of cards
 *  11. Reviews carousel: auto-advances (pause button, stops on hover, focus or any manual move),
 *      previous / next buttons and position dots
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Data: keep these in sync with the footer hours and the JSON-LD in each page's <head>.
  // ---------------------------------------------------------------------------

  var TIME_ZONE = 'America/Montreal';

  // Regular hours by weekday (0 = dimanche). Times are decimal hours: 13.5 = 13h30.
  var HOURS = {
    0: { open: 9, close: 15 },
    1: { open: 6, close: 21 },
    2: { open: 6, close: 21 },
    3: { open: 6, close: 21 },
    4: { open: 6, close: 21 },
    5: { open: 6, close: 21 },
    6: { open: 8, close: 18 }
  };

  // One-off closures or reduced hours (Christmas Eve, a renovation day...).
  // Omit open/close for a full-day closure. Entries override the regular hours and statutory holidays.
  // Also add them to the FAQ list (faq.html) and to specialOpeningHoursSpecification in the
  // JSON-LD of index.html and contact.html.
  var SPECIAL_DAYS = [
    // Source: Google Doc "Congés 2026 + 2027"
    // Holiday season 2026-2027
    { date: '2026-12-24', name: 'Veille de Noël', open: 6, close: 13 },
    { date: '2026-12-26', name: 'Lendemain de Noël' },
    { date: '2026-12-31', name: 'Veille du jour de l\'An', open: 6, close: 13 },
    { date: '2027-01-02', name: 'Lendemain du jour de l\'An' },
    // Vacances de la construction 2027: regular hours except these Sundays (group class schedule adjusted 18-31 July)
    { date: '2027-07-18', name: 'Vacances de la construction' },
    { date: '2027-07-25', name: 'Vacances de la construction' },
    // Holiday season 2027-2028
    { date: '2027-12-24', name: 'Veille de Noël', open: 6, close: 13 },
    { date: '2027-12-26', name: 'Lendemain de Noël' },
    { date: '2027-12-31', name: 'Veille du jour de l\'An', open: 6, close: 13 },
    { date: '2028-01-02', name: 'Lendemain du jour de l\'An' }
  ];

  // Other messages for the notice bar (promotions, events), shown from `from` to `to` included.
  // `href`/`link` are optional. Remove an entry once it is over (it stops showing by itself anyway).
  var ANNOUNCEMENTS = [
    {
      from: '2026-11-11', to: '2026-11-27', label: 'Vendredi fou',
      text: 'nous sommes ouverts le vendredi 27 novembre, de 6h à 21h. 1 mois gratuit à l\'achat de 3 mois en entraînement privé ou semi-privé, du 20 au 27 novembre.',
      href: '/#evenements', link: 'Voir l\'offre'
    }
  ];

  // How many days ahead the notice bar starts announcing a closure, and how many dates it lists at most
  // (the rest are one click away on the FAQ).
  var NOTICE_DAYS_AHEAD = 10;
  var NOTICE_MAX_ITEMS = 3;

  // ---------------------------------------------------------------------------
  // Dates (all computed in Montréal time, whatever the visitor's time zone)
  // ---------------------------------------------------------------------------

  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
    'septembre', 'octobre', 'novembre', 'décembre'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // A calendar day is a UTC-midnight Date, so adding days never trips over DST changes.
  function day(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function addDays(date, n) { return new Date(date.getTime() + n * 86400000); }
  function key(date) { return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()); }

  function montrealNow() {
    var parts = {};
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = +p.value; });
    return { today: day(parts.year, parts.month, parts.day), hour: parts.hour + parts.minute / 60 };
  }

  function easterSunday(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    return day(y, month, ((h + l - 7 * m + 114) % 31) + 1);
  }

  function nthMonday(y, month, n) {
    var first = day(y, month, 1);
    return addDays(first, ((8 - first.getUTCDay()) % 7) + 7 * (n - 1));
  }

  // Statutory holidays the studio closes for (same list as the FAQ). Journée nationale des patriotes: open.
  function holidays(y) {
    return [
      { date: day(y, 1, 1), name: "Jour de l'An" },
      { date: addDays(easterSunday(y), -2), name: 'Vendredi saint' },
      { date: day(y, 6, 24), name: 'Fête nationale du Québec' },
      { date: day(y, 7, 1), name: 'Fête du Canada' },
      { date: nthMonday(y, 9, 1), name: 'Fête du travail' },
      { date: nthMonday(y, 10, 2), name: 'Action de grâce' },
      { date: day(y, 12, 25), name: 'Noël' }
    ];
  }

  // Everything that differs from the regular hours, keyed by 'YYYY-MM-DD'.
  function exceptions(fromYear) {
    var map = {};
    [fromYear, fromYear + 1].forEach(function (y) {
      holidays(y).forEach(function (h) { map[key(h.date)] = { date: h.date, name: h.name }; });
    });
    SPECIAL_DAYS.forEach(function (s) {
      var p = s.date.split('-');
      map[s.date] = { date: day(+p[0], +p[1], +p[2]), name: s.name, open: s.open, close: s.close };
    });
    return map;
  }

  // Hours for a given day: { open, close, name? } or { closed: true, name? }
  function hoursOn(date, exc) {
    var x = exc[key(date)];
    if (x) return x.open == null ? { closed: true, name: x.name } : { open: x.open, close: x.close, name: x.name };
    return HOURS[date.getUTCDay()];
  }

  function formatTime(h) {
    var min = Math.round((h % 1) * 60);
    return Math.floor(h) + 'h' + (min ? pad(min) : '');
  }

  function formatDate(date, withYear) {
    var d = date.getUTCDate();
    return DAYS[date.getUTCDay()] + ' ' + (d === 1 ? '1er' : d) + ' ' + MONTHS[date.getUTCMonth()] +
      (withYear ? ' ' + date.getUTCFullYear() : '');
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function describe(entry) {
    return entry.open == null
      ? 'fermé'
      : 'ouvert de ' + formatTime(entry.open) + ' à ' + formatTime(entry.close);
  }

  // ---------------------------------------------------------------------------
  // 1. Copyright year
  // ---------------------------------------------------------------------------

  function updateYear() {
    var year = String(montrealNow().today.getUTCFullYear());
    document.querySelectorAll('[data-current-year]').forEach(function (el) { el.textContent = year; });
  }

  // ---------------------------------------------------------------------------
  // 2. Open / closed status
  // ---------------------------------------------------------------------------

  function statusText() {
    var now = montrealNow();
    var exc = exceptions(now.today.getUTCFullYear());
    var today = hoursOn(now.today, exc);

    if (!today.closed && now.hour >= today.open && now.hour < today.close) {
      return { open: true, text: 'Ouvert maintenant · ferme à ' + formatTime(today.close) };
    }

    var prefix = today.closed && today.name ? 'Fermé aujourd\'hui (' + today.name + ')' : 'Fermé maintenant';
    if (!today.closed && now.hour < today.open) {
      return { open: false, text: prefix + ' · ouvre aujourd\'hui à ' + formatTime(today.open) };
    }
    for (var i = 1; i <= 14; i++) {
      var date = addDays(now.today, i);
      var h = hoursOn(date, exc);
      if (!h.closed) {
        var when = i === 1 ? 'demain' : DAYS[date.getUTCDay()];
        return { open: false, text: prefix + ' · ouvre ' + when + ' à ' + formatTime(h.open) };
      }
    }
    return { open: false, text: prefix };
  }

  function updateStatus() {
    document.querySelectorAll('[data-hours-status]').forEach(function (el) {
      var s = statusText();
      el.textContent = s.text;
      el.classList.toggle('is-open', s.open);
      el.hidden = false;
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Holiday notice bar and FAQ list
  // ---------------------------------------------------------------------------

  function upcoming(daysAhead) {
    var now = montrealNow();
    var exc = exceptions(now.today.getUTCFullYear());
    var end = addDays(now.today, daysAhead);
    return Object.keys(exc).sort().map(function (k) { return exc[k]; }).filter(function (x) {
      return x.date >= now.today && x.date <= end;
    });
  }

  function updateNotice() {
    var el = document.querySelector('[data-holiday-notice]');
    if (!el) return;
    var today = key(montrealNow().today);
    var items = upcoming(NOTICE_DAYS_AHEAD).slice(0, NOTICE_MAX_ITEMS).map(function (x) {
      var when = key(x.date) === today ? 'aujourd\'hui' : 'le ' + formatDate(x.date);
      return capitalize(describe(x)) + ' ' + when + (x.name ? ' (' + x.name + ')' : '');
    });
    var holidayLine = el.querySelector('p');
    if (items.length) {
      el.querySelector('[data-holiday-notice-text]').textContent = items.join(' · ') + '.';
    } else {
      holidayLine.hidden = true;
    }

    var news = ANNOUNCEMENTS.filter(function (a) { return a.from <= today && today <= a.to; });
    news.forEach(function (a) {
      var p = document.createElement('p');
      var label = document.createElement('strong');
      label.textContent = a.label + ' :';
      p.appendChild(label);
      p.appendChild(document.createTextNode(' ' + a.text));
      if (a.href) {
        var link = document.createElement('a');
        link.href = a.href;
        link.textContent = a.link || 'En savoir plus';
        p.appendChild(document.createTextNode(' '));
        p.appendChild(link);
      }
      el.appendChild(p);
    });

    if (items.length || news.length) el.hidden = false;
  }

  // Replaces the static FAQ list (written for a fixed pair of years) with the next 12 months.
  function updateHolidayList() {
    var list = document.querySelector('[data-holiday-list]');
    if (!list) return;
    var items = upcoming(365);
    if (!items.length) return;
    list.innerHTML = '';
    items.forEach(function (x) {
      var li = document.createElement('li');
      li.textContent = capitalize(formatDate(x.date, true)) + (x.name ? ' - ' + x.name : '') + ' - ' + capitalize(describe(x));
      list.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Floating contact button
  // ---------------------------------------------------------------------------

  function smartContactButton() {
    var popin = document.querySelector('.contact-popin');
    var start = document.querySelector('main .banner') || document.querySelector('.site-header');
    var footer = document.querySelector('.site-footer');
    if (!popin || !start || !footer || !('IntersectionObserver' in window)) return;

    var startVisible = true;
    var footerVisible = false;
    document.documentElement.classList.add('js-contact-popin');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.target === start) startVisible = e.isIntersecting;
        if (e.target === footer) footerVisible = e.isIntersecting;
      });
      popin.classList.toggle('is-visible', !startVisible && !footerVisible);
    });
    observer.observe(start);
    observer.observe(footer);
  }

  // ---------------------------------------------------------------------------
  // 5. Pause / play for the homepage video (the choice is remembered on this device)
  // ---------------------------------------------------------------------------

  var VIDEO_PAUSED_KEY = 'ssa-video-paused';

  function videoToggle() {
    var button = document.querySelector('[data-video-toggle]');
    var video = button && button.parentElement.querySelector('video');
    if (!video) return;

    function setPaused(paused) {
      if (paused) {
        video.pause();
      } else {
        var playing = video.play();
        if (playing && playing.catch) playing.catch(function () {});
      }
      button.classList.toggle('is-paused', paused);
      button.setAttribute('aria-label', paused ? 'Lire la vidéo' : 'Mettre la vidéo en pause');
    }

    // Visitors who ask for less motion get the still poster (CSS hides the video); stop it loading too.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      return;
    }

    var remembered = false;
    try { remembered = localStorage.getItem(VIDEO_PAUSED_KEY) === '1'; } catch (e) {}
    setPaused(remembered);
    button.hidden = false;

    button.addEventListener('click', function () {
      var paused = !button.classList.contains('is-paused');
      setPaused(paused);
      try { localStorage.setItem(VIDEO_PAUSED_KEY, paused ? '1' : '0'); } catch (e) {}
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Open the <details> a link points to (e.g. /faq.html#conges, /equipe.html#yan-thach)
  // ---------------------------------------------------------------------------

  // The target may sit inside a <details> (FAQ answer), be one (conditions section),
  // or be a trainer card holding its bio.
  function detailsFor(target) {
    return target.closest('details') || (target.matches('.trainer-card') && target.querySelector('details'));
  }

  function openTarget(id, scroll) {
    var target = id && document.getElementById(id);
    var details = target && detailsFor(target);
    if (!details) return;
    details.open = true;
    if (scroll) target.scrollIntoView();
  }

  function openLinkedQuestion() {
    openTarget(decodeURIComponent(location.hash.slice(1)), true);
  }

  function linkedDetails() {
    openLinkedQuestion();
    window.addEventListener('hashchange', openLinkedQuestion);

    // Clicking a table-of-contents link whose hash is already in the URL fires no hashchange
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('.toc a[href^="#"]');
      if (link) openTarget(decodeURIComponent(link.getAttribute('href').slice(1)), false);
    });

    var actions = document.querySelector('[data-toc-actions]');
    if (!actions) return;
    var all = document.querySelectorAll('main details');
    function setAll(open) {
      all.forEach(function (d) { d.open = open; });
    }
    actions.querySelector('[data-expand-all]').addEventListener('click', function () { setAll(true); });
    actions.querySelector('[data-collapse-all]').addEventListener('click', function () { setAll(false); });
    actions.hidden = false;
  }

  // ---------------------------------------------------------------------------
  // 7. Theme slider: light / night, plus the optional rainbow theme
  // ---------------------------------------------------------------------------

  // In June the rainbow theme is the default, and choices made in June are kept under their own key
  // (same rule as the inline script in each <head>), so a light/night choice from May doesn't hide it.
  var JUNE = new Date().getMonth() === 5;
  var THEME_KEY = JUNE ? 'ssa-theme-june' : 'ssa-theme';

  // Rainbow ("pride") theme, the default in June. Setting this to false hides the option (June then falls back to light).
  var PRIDE_THEME = true;

  function themeToggle() {
    var group = document.querySelector('[data-theme-toggle]');
    if (!group) return;
    var root = document.documentElement;

    if (PRIDE_THEME) {
      var pride = document.createElement('label');
      pride.className = 'theme-option theme-option-pride';
      pride.title = 'Mode fierté';
      pride.innerHTML = '<input type="radio" name="theme" value="pride" class="visually-hidden">' +
        '<span aria-hidden="true">🌈</span><span class="visually-hidden">Mode fierté</span>';
      group.insertBefore(pride, group.querySelector('.theme-toggle-thumb'));
    }

    var inputs = Array.prototype.slice.call(group.querySelectorAll('input[name="theme"]'));
    var values = inputs.map(function (i) { return i.value; });

    function apply(theme) {
      if (values.indexOf(theme) < 0) theme = 'light';
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-bs-theme', theme === 'dark' ? 'dark' : 'light');
      inputs[values.indexOf(theme)].checked = true;
      group.style.setProperty('--theme-index', values.indexOf(theme));
    }

    function saved() {
      try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }

    apply(root.getAttribute('data-theme'));
    group.hidden = false;

    // Native radios: click, tap and arrow keys all fire "change"
    inputs.forEach(function (input) {
      input.addEventListener('change', function () {
        apply(input.value);
        try { localStorage.setItem(THEME_KEY, input.value); } catch (e) {}
      });
    });

    // Until the visitor picks a theme, follow the device setting as it changes (not in June: rainbow is the default)
    var media = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (media && media.addEventListener) {
      media.addEventListener('change', function (e) {
        if (!saved() && !JUNE) apply(e.matches ? 'dark' : 'light');
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Remove events whose last day (data-event-end="YYYY-MM-DD") has passed.
  //    When none are left, CSS shows the "Aucun événement" message.
  // ---------------------------------------------------------------------------

  function pruneEvents() {
    var today = key(montrealNow().today);
    document.querySelectorAll('.event[data-event-end]').forEach(function (el) {
      if (el.getAttribute('data-event-end') < today) el.remove();
    });
  }

  // ---------------------------------------------------------------------------
  // 11. Reviews carousel. The track is a native scroll-snap row (swipeable without JavaScript);
  //     this adds the arrow buttons and the dots, and keeps them in step with the scroll position.
  // ---------------------------------------------------------------------------

  function reviewsCarousel() {
    var box = document.querySelector('[data-reviews-carousel]');
    if (!box) return;
    var track = box.querySelector('.reviews');
    var cards = Array.prototype.slice.call(track.children);
    var prev = box.querySelector('[data-reviews-prev]');
    var next = box.querySelector('[data-reviews-next]');
    var dotsBox = box.querySelector('[data-reviews-dots]');
    var dots = [];

    function perView() {
      return Math.max(1, Math.round(track.clientWidth / cards[0].getBoundingClientRect().width));
    }

    function pages() { return Math.max(1, Math.ceil(cards.length - perView() + 1)); }

    function current() {
      var step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
      return Math.round(track.scrollLeft / step);
    }

    function goTo(i) {
      i = Math.max(0, Math.min(i, pages() - 1));
      track.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: 'smooth' });
    }

    function buildDots() {
      dotsBox.innerHTML = '';
      dots = [];
      for (var i = 0; i < pages(); i++) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'reviews-dot';
        d.setAttribute('aria-label', 'Avis ' + (i + 1));
        d.addEventListener('click', function (n) { stopAuto(); goTo(n); }.bind(null, i));
        dotsBox.appendChild(d);
        dots.push(d);
      }
      update();
    }

    function update() {
      var i = current();
      prev.disabled = i <= 0;
      next.disabled = i >= pages() - 1;
      dots.forEach(function (d, n) { d.setAttribute('aria-current', n === i ? 'true' : 'false'); });
    }

    // Auto-advance every AUTOPLAY_MS, looping back to the start. Off for visitors who ask for less motion;
    // paused while hovered, focused, off screen or in a background tab; stops for good once the visitor
    // moves the carousel themselves.
    var AUTOPLAY_MS = 6000;
    var play = box.querySelector('[data-reviews-play]');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var playing = !reduced;
    var hovered = false;
    var focused = false;
    var onScreen = true;

    function setPlaying(on) {
      playing = on;
      play.classList.toggle('is-paused', !on);
      play.setAttribute('aria-label', on ? 'Mettre le défilement en pause' : 'Faire défiler les avis');
    }

    function stopAuto() { if (playing) setPlaying(false); }

    setPlaying(playing);
    play.addEventListener('click', function () { setPlaying(!playing); });
    box.addEventListener('mouseenter', function () { hovered = true; });
    box.addEventListener('mouseleave', function () { hovered = false; });
    box.addEventListener('focusin', function (e) { focused = e.target !== play; });
    box.addEventListener('focusout', function () { focused = false; });
    track.addEventListener('touchstart', stopAuto, { passive: true });
    track.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) stopAuto(); }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; }).observe(box);
    }

    setInterval(function () {
      if (!playing || hovered || focused || !onScreen || document.hidden) return;
      var i = current();
      goTo(i >= pages() - 1 ? 0 : i + 1);
    }, AUTOPLAY_MS);

    prev.addEventListener('click', function () { stopAuto(); goTo(current() - 1); });
    next.addEventListener('click', function () { stopAuto(); goTo(current() + 1); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', buildDots);
    box.classList.add('is-ready');
    buildDots();
  }


  // ---------------------------------------------------------------------------
  // 9. "Glissez pour voir tous les forfaits" under price tables wider than the screen
  // ---------------------------------------------------------------------------

  function tableScrollHints() {
    var wraps = document.querySelectorAll('.price-table-wrap');
    if (!wraps.length) return;
    function update() {
      wraps.forEach(function (wrap) {
        var hint = wrap.nextElementSibling;
        var has = hint && hint.classList.contains('price-scroll-hint');
        var overflows = wrap.scrollWidth > wrap.clientWidth + 2;
        if (overflows && !has) {
          hint = document.createElement('p');
          hint.className = 'price-scroll-hint';
          hint.setAttribute('aria-hidden', 'true');
          hint.textContent = 'Glissez le tableau pour voir tous les forfaits →';
          wrap.insertAdjacentElement('afterend', hint);
        } else if (!overflows && has) {
          hint.remove();
        }
      });
    }
    update();
    window.addEventListener('resize', update);
  }

  // ---------------------------------------------------------------------------
  // 10. Trainer bios: without JavaScript each bio opens inside its own card. With it, the open bio is shown
  //     in one panel spanning the whole row, placed right after the last card of the clicked card's row.
  // ---------------------------------------------------------------------------

  function bioPanels() {
    var bios = document.querySelectorAll('.trainer-bio');
    if (!bios.length) return;
    document.documentElement.classList.add('js-bio-panels');

    var panel = document.createElement('section');
    panel.className = 'trainer-bio-panel';
    panel.tabIndex = -1;
    var current = null;
    var fromKeyboard = false;

    function place() {
      panel.remove();
      if (!current) return;
      var card = current.closest('.trainer-card');
      var last = card;
      card.parentElement.querySelectorAll('.trainer-card').forEach(function (c) {
        if (c.offsetTop === card.offsetTop) last = c;
      });
      last.insertAdjacentElement('afterend', panel);
    }

    function render(details) {
      var card = details.closest('.trainer-card');
      var name = card.querySelector('.trainer-name').textContent;
      var role = card.querySelector('.trainer-role').textContent;
      var body = details.querySelector('.trainer-bio-body');
      panel.innerHTML = '';
      panel.setAttribute('aria-label', 'Bio de ' + name);

      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'trainer-bio-close';
      close.innerHTML = '<span aria-hidden="true">×</span><span class="visually-hidden">Fermer la bio de ' + name + '</span>';
      close.addEventListener('click', function () {
        var summary = current && current.querySelector('summary');
        if (current) current.open = false;
        if (summary) summary.focus();
      });

      var title = document.createElement('p');
      title.className = 'trainer-bio-panel-title';
      title.innerHTML = '<strong></strong> <span></span>';
      title.firstChild.textContent = name;
      title.lastChild.textContent = role;

      var cols = document.createElement('div');
      cols.className = 'trainer-bio-panel-body';
      var text = document.createElement('div');
      var specs = document.createElement('div');
      Array.prototype.forEach.call(body.children, function (el) {
        (el.tagName === 'P' ? text : specs).appendChild(el.cloneNode(true));
      });
      cols.appendChild(text);
      cols.appendChild(specs);

      panel.appendChild(close);
      panel.appendChild(title);
      panel.appendChild(cols);
    }

    bios.forEach(function (details) {
      var summary = details.querySelector('summary');
      summary.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') fromKeyboard = true;
      });
      details.addEventListener('toggle', function () {
        var card = details.closest('.trainer-card');
        card.classList.toggle('is-open', details.open);
        if (details.open) {
          bios.forEach(function (other) { if (other !== details) other.open = false; });
          current = details;
          render(details);
          place();
          if (fromKeyboard) panel.focus();
        } else if (current === details) {
          current = null;
          place();
        }
        fromKeyboard = false;
      });
    });

    window.addEventListener('resize', place);
  }


  // ---------------------------------------------------------------------------

  function init() {
    updateYear();
    updateStatus();
    updateNotice();
    updateHolidayList();
    smartContactButton();
    videoToggle();
    bioPanels();
    linkedDetails();
    themeToggle();
    pruneEvents();
    tableScrollHints();
    reviewsCarousel();
    setInterval(updateStatus, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
