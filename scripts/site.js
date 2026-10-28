/*
 * Studio Santé Active - small site enhancements. No build step, no dependencies.
 * Every feature is progressive: pages are complete without JavaScript, and this only adds to them.
 *
 *   1. Current year in the footer copyright
 *   2. "Ouvert maintenant / Fermé" status next to the footer hours
 *   3. Notice bar for upcoming holiday closures + always-current list on the FAQ
 *   4. Floating contact button that appears after the banner and hides at the footer
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
  var SPECIAL_DAYS = [
    // { date: '2026-12-24', name: 'Veille de Noël', open: 6, close: 13 },
    // { date: '2026-12-26', name: 'Lendemain de Noël' },
  ];

  // How many days ahead the notice bar starts announcing a closure.
  var NOTICE_DAYS_AHEAD = 10;

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

  // Statutory holidays the studio closes for (same list as the FAQ).
  function holidays(y) {
    return [
      { date: day(y, 1, 1), name: "Jour de l'An" },
      { date: easterSunday(y), name: 'Pâques' },
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
    var items = upcoming(NOTICE_DAYS_AHEAD).map(function (x) {
      var when = key(x.date) === today ? 'aujourd\'hui' : 'le ' + formatDate(x.date);
      return capitalize(describe(x)) + ' ' + when + (x.name ? ' (' + x.name + ')' : '');
    });
    if (!items.length) return;
    el.querySelector('[data-holiday-notice-text]').textContent = items.join(' · ') + '.';
    el.hidden = false;
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

  function init() {
    updateYear();
    updateStatus();
    updateNotice();
    updateHolidayList();
    smartContactButton();
    setInterval(updateStatus, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
