/* MAXWEB site: logo, animations, WhatsApp links and the Priya chat. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var WA = "918106257124";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function waLink(text) {
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(text);
  }
  window.MAXWEB_waLink = waLink;

  /* Toast */
  var toastT;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 2600);
  }
  window.MAXWEB_toast = toast;

  /* Logo: use images/logo.png if you add one, otherwise the bundled SVG */
  document.querySelectorAll("img.logo").forEach(function (img) {
    img.onerror = function () { img.onerror = null; img.src = "images/logo.svg"; };
    img.src = "images/logo.png";
  });

  /* WhatsApp buttons */
  var heroWa = $("heroWa"), priceWa = $("priceWa"), pwa = $("pwa"), wa2 = $("wa2");
  if (heroWa) heroWa.href = waLink("Hi MAXWEB, I would like a website for my business.");
  if (priceWa) priceWa.href = waLink("Hi MAXWEB, please share my quote for a website package.");
  if (pwa) pwa.href = waLink("Hi MAXWEB, I am a client and have a question about my project.");
  if (wa2) wa2.href = waLink("Hi MAXWEB, I was chatting with Priya and would like to continue here.");

  /* Hero headline: word by word */
  var h1 = document.querySelector(".hero h1");
  if (h1) {
    var words = h1.textContent.trim().split(/\s+/);
    h1.textContent = "";
    words.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "w";
      s.style.animationDelay = (1.6 + i * 0.12) + "s";
      s.textContent = w;
      h1.appendChild(s);
      if (i < words.length - 1) h1.appendChild(document.createTextNode(" "));
    });
  }

  /* Rotating word */
  var rw = $("rw");
  if (rw) {
    var list = ["fast", "private", "secure", "beautiful", "trusted"], ri = 0;
    setInterval(function () {
      ri = (ri + 1) % list.length;
      var n = rw.cloneNode(false);
      n.textContent = list[ri];
      rw.parentNode.replaceChild(n, rw);
      rw = n;
    }, 2200);
  }

  /* Intro: remove after it finishes */
  var intro = $("intro");
  if (intro) setTimeout(function () { intro.remove(); }, 2500);

  /* Scroll progress bar */
  var bar = $("bar");
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (h > 0 ? window.scrollY / h : 0) + ")";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Cursor ring and spotlight */
  var cur = $("cur"), spot = $("spot");
  var fine = window.matchMedia("(pointer:fine)").matches;
  window.addEventListener("mousemove", function (e) {
    if (spot) spot.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)";
    if (cur && fine) {
      cur.style.opacity = 1;
      cur.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)";
      cur.classList.toggle("h", !!e.target.closest("a,button,input,textarea"));
    }
  });

  /* 3D hero tilt */
  var stage = $("stage");
  if (stage && !reduce) {
    var scene = stage.querySelector(".scene");
    stage.addEventListener("mousemove", function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      scene.style.setProperty("--ry", (-18 + x * 26) + "deg");
      scene.style.setProperty("--rx", (12 - y * 22) + "deg");
    });
    stage.addEventListener("mouseleave", function () {
      scene.style.setProperty("--ry", "-18deg");
      scene.style.setProperty("--rx", "12deg");
    });
  }

  /* Tilt and glow on cards */
  document.querySelectorAll(".tilt").forEach(function (c) {
    c.addEventListener("mousemove", function (e) {
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty("--mx", x * 100 + "%");
      c.style.setProperty("--my", y * 100 + "%");
      if (!reduce) {
        c.style.setProperty("--ry", (x - 0.5) * 10 + "deg");
        c.style.setProperty("--rx", (0.5 - y) * 10 + "deg");
      }
    });
    c.addEventListener("mouseleave", function () {
      c.style.setProperty("--ry", "0deg");
      c.style.setProperty("--rx", "0deg");
    });
  });

  /* Button ripple */
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".btn");
    if (!b || b.classList.contains("fab")) return;
    var r = b.getBoundingClientRect(), d = document.createElement("span");
    d.className = "rp";
    d.style.left = e.clientX - r.left + "px";
    d.style.top = e.clientY - r.top + "px";
    b.appendChild(d);
    setTimeout(function () { d.remove(); }, 650);
  });

  /* Scroll reveal */
  var revealEls = document.querySelectorAll(".svc > div, .card, .sec p, .team > div, .pay, .cf, .lead, section h2");
  revealEls.forEach(function (el) { if (el.tagName !== "H2") el.classList.add("rv"); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* Animated network background */
  var cv = $("net");
  if (cv && !reduce) {
    var ctx = cv.getContext("2d"), pts = [], W, H;
    function size() {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
      var n = Math.min(70, Math.floor(W * H / 22000));
      pts = [];
      for (var i = 0; i < n; i++) pts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35 });
    }
    size();
    window.addEventListener("resize", size);
    (function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.fillStyle = "rgba(47,181,174,.55)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 6.283); ctx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
          if (d < 16000) {
            ctx.strokeStyle = "rgba(47,181,174," + (0.18 * (1 - d / 16000)) + ")";
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    })();
  }

  /* Copy UPI IDs */
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast("UPI ID copied"); }, function () { toast("Copy failed. Select the ID and copy it."); });
    } else { toast("Select the ID and copy it."); }
  }
  var cp = $("cp");
  if (cp) cp.addEventListener("click", function () { copyText($("upi").textContent.trim()); });
  var ppId = ((window.MAXWEB_CONFIG || {}).phonepeUpi || "").trim();
  if (ppId) {
    $("ppUpi").textContent = ppId;
    $("ppBtns").hidden = false;
    $("ppPay").href = "upi://pay?pa=" + encodeURIComponent(ppId) + "&pn=MAXWEB&cu=INR";
    $("ppCp").addEventListener("click", function () { copyText(ppId); });
  }

  /* Contact form opens WhatsApp */
  var cform = $("cform");
  if (cform) cform.addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = "Hi MAXWEB, I am " + $("cn").value.trim() + ". " + $("cm").value.trim();
    window.open(waLink(msg), "_blank", "noopener");
  });

  /* Priya chat */
  var chat = $("chat"), fab = $("fab"), msgs = $("msgs"), voice = false;
  var started = false;
  var answers = [
    { k: ["price", "cost", "how much", "quote", "rate", "3000", "3,000"], a: "Website packages start at ₹6,000. Your exact quote depends on what you need, and we confirm it with you on WhatsApp before any work begins." },
    { k: ["warranty", "guarantee", "fix", "support", "problem"], a: "Every website comes with a free one-year warranty. If something breaks in that year, we fix it at no cost." },
    { k: ["pay", "payment", "upi", "fampay", "fam", "phonepe", "phone pe"], a: "We take payments through PhonePe and FamPay only, so every transaction is traceable. The FamPay UPI ID is 8978957342@fam. You pay only after your quote is confirmed on WhatsApp." },
    { k: ["privacy", "private", "safe", "secure", "security", "data"], a: "We use your details only to work on your project, and your chat messages go straight to the founders on WhatsApp. Forms and logins are built with security in mind." },
    { k: ["design", "demo", "work", "sample", "portfolio", "example"], a: "You can open our live grocery shop demo in the Our work section. We design in your brand colours so it works on phones, tablets and computers." },
    { k: ["login", "log in", "account", "portal"], a: "Use the Log in button at the top of the page to open your client portal. You can create an account there in a minute." },
    { k: ["hi", "hello", "hey", "namaste"], a: "Hello! I am Priya from MAXWEB. Packages start at ₹6,000 with a free one-year warranty. Ask me about prices, payment, privacy or designs." },
    { k: ["contact", "whatsapp", "call", "founder", "talk"], a: "The quickest way is WhatsApp: +91 81062 57124 or +91 89789 57342. Tap Continue on WhatsApp below and your chat opens ready to send." }
  ];
  function reply(q) {
    q = q.toLowerCase();
    for (var i = 0; i < answers.length; i++)
      for (var j = 0; j < answers[i].k.length; j++)
        if (q.indexOf(answers[i].k[j]) > -1) return answers[i].a;
    return "I can help with prices, warranty, payment, privacy and designs. For anything else, tap Continue on WhatsApp and the founders will reply directly.";
  }
  function add(text, who) {
    var d = document.createElement("div");
    d.className = "m " + who;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var calling = false, rec = null, speaking = false;
  function femaleVoice() {
    var vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    var en = vs.filter(function (v) { return /^en/i.test(v.lang); });
    var pick = function (re) { return en.filter(function (v) { return re.test(v.name); })[0]; };
    return pick(/heera|veena|lekha|neerja/i) || pick(/female|zira|aria|jenny|samantha|karen|tessa|moira|fiona|susan|hazel/i) ||
      en.filter(function (v) { return /IN/i.test(v.lang); })[0] || en[0] || null;
  }
  function speak(t) {
    if (!(voice || calling) || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(t);
    var v = femaleVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-IN"; }
    u.pitch = 1.15; u.rate = 1;
    speaking = true;
    u.onend = u.onerror = function () { speaking = false; if (calling) setTimeout(listen, 250); };
    speechSynthesis.speak(u);
  }
  function listen() {
    if (!calling || speaking || !SR) return;
    try { rec && rec.abort(); } catch (e) {}
    rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = function (e) {
      var t = e.results[0][0].transcript.trim();
      if (t) ask(t);
    };
    rec.onerror = function (e) {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        endCall();
        toast("Microphone is blocked. Allow it in your browser, or type to Priya.");
      }
    };
    rec.onend = function () { if (calling && !speaking) setTimeout(listen, 400); };
    try { rec.start(); } catch (e) {}
  }
  function startCall() {
    if (!SR || !window.speechSynthesis) {
      toast("Voice calls need Chrome, Edge or Safari. You can still type to Priya.");
      return;
    }
    calling = true;
    $("cl").classList.add("on");
    $("cl").textContent = "⏹";
    $("cl").title = "End call";
    add("Call started. Speak after Priya greets you.", "s");
    var g = "Hello, this is Priya from MAXWEB. How can I help you today?";
    add(g, "b");
    speak(g);
  }
  function endCall() {
    calling = false; speaking = false;
    try { rec && rec.abort(); } catch (e) {}
    if (window.speechSynthesis) speechSynthesis.cancel();
    var b = $("cl");
    b.classList.remove("on"); b.textContent = "📞"; b.title = "Call Priya";
  }
  if (window.speechSynthesis) speechSynthesis.getVoices();
  var aiConversationId = null;
  function ask(q) {
    add(q, "u");
    var ty = document.createElement("div");
    ty.className = "m b";
    ty.innerHTML = '<div class="ty"><i></i><i></i><i></i></div>';
    msgs.appendChild(ty);
    msgs.scrollTop = msgs.scrollHeight;
    fetch("/api/ai", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: q, conversationId: aiConversationId, source: window.location.pathname === "/portal.html" ? "client_portal" : "website" })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.message || data.error || "assistant_unavailable");
        aiConversationId = data.conversationId || aiConversationId;
        if (data.accountRequired) return data.reply + " To receive a formal quotation, create a MAXWEB account and continue this conversation while signed in.";
        return data.reply;
      });
    }).catch(function () {
      return "The MAXWEB AI assistant is temporarily unavailable. You can contact the team by WhatsApp, phone, or Instagram using the contact options on this page.";
    }).then(function (answer) {
      ty.remove();
      add(answer || "The MAXWEB team will review your message.", "b");
      speak(answer || "");
    });
  }
  function openChat() {
    chat.hidden = false;
    fab.hidden = true;
    if (!started) {
      started = true;
      add("Hi, I am Priya, the MAXWEB assistant. Ask me about prices, warranty, payment, privacy or designs.", "b");
    }
    $("ci").focus();
  }
  function closeChat() {
    chat.hidden = true;
    fab.hidden = false;
    endCall();
  }
  fab.addEventListener("click", openChat);
  $("callP").addEventListener("click", openChat);
  $("cx").addEventListener("click", closeChat);
  if (new URLSearchParams(window.location.search).get("chat") === "1") openChat();
  $("cl").addEventListener("click", function () {
    if (calling) { endCall(); add("Call ended.", "s"); } else { startCall(); }
  });
  $("vo").addEventListener("click", function () {
    voice = !voice;
    this.textContent = voice ? "🔊" : "🔇";
    if (!voice && window.speechSynthesis) speechSynthesis.cancel();
  });
  document.querySelectorAll(".chips button").forEach(function (b) {
    b.addEventListener("click", function () { ask(b.textContent); });
  });
  $("cf").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("ci").value.trim();
    if (!v) return;
    $("ci").value = "";
    ask(v);
  });
})();
