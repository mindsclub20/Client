(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var mode = "login", user = null, busy = false;

  function api(path, body) {
    var opts = { method: body ? "POST" : "GET", credentials: "same-origin", headers: {} };
    if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch("/api/auth" + path, opts).then(function (r) {
      return r.text().then(function (t) {
        var d = null;
        try { d = t ? JSON.parse(t) : null; } catch (e) {}
        return { ok: r.ok, status: r.status, data: d };
      });
    });
  }

  function setErr(msg) { $("err").textContent = msg || ""; }

  function friendly(res) {
    var code = String((res.data && res.data.code) || "").toUpperCase();
    if (res.status === 429) return "Too many attempts. Please wait a minute and try again.";
    if (code.indexOf("USER_ALREADY_EXISTS") === 0) return "An account with this email already exists. Try logging in.";
    if (code.indexOf("INVALID_EMAIL_OR_PASSWORD") === 0) return "That email or password is not right.";
    if (code.indexOf("PASSWORD_TOO_SHORT") === 0) return "Use a password of at least 8 characters.";
    if (code.indexOf("PASSWORD_TOO_LONG") === 0) return "That password is too long.";
    if (code.indexOf("INVALID_EMAIL") === 0) return "Enter a valid email address.";
    if (res.status === 403) return "This request was blocked for security reasons. Reload the page and try again.";
    if (res.status >= 500) return "The server had a problem. Please try again in a moment.";
    return (res.data && res.data.message) || "Something went wrong. Please try again.";
  }

  function loadSession() {
    return fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { user = d && d.user ? d.user : null; })
      .catch(function () { user = null; });
  }

  function paint() {
    var signup = mode === "signup";
    $("nameRow").hidden = !signup;
    $("lh").textContent = signup ? "Create your account" : "Welcome back";
    $("ls").textContent = signup ? "Join the MAXWEB client portal." : "Log in to your MAXWEB client portal.";
    $("go").textContent = signup ? "Create account" : "Log in";
    $("sw").firstChild.textContent = signup ? "Already have an account? " : "New here? ";
    $("ca").textContent = signup ? "Log in" : "Create an account";
    $("ap").setAttribute("autocomplete", signup ? "new-password" : "current-password");
  }

  function route() {
    var h = window.location.hash, screen = "site";
    if (h === "#login" || h === "#portal") screen = user ? "portal" : "login";
    $("site").hidden = screen !== "site";
    $("login").hidden = screen !== "login";
    $("portal").hidden = screen !== "portal";
    if (screen !== "site") window.scrollTo(0, 0);
    var a = document.querySelector(".nav .btn.ghost");
    if (a) { a.textContent = user ? "My portal" : "Log in"; a.setAttribute("href", user ? "#portal" : "#login"); }
    if (user) {
      $("who").textContent = user.name || user.email;
      var wa = $("pwa");
      if (wa && window.MAXWEB_waLink) {
        wa.href = window.MAXWEB_waLink("Hi MAXWEB, I am a client (" + user.email + ") and have a question about my project.");
      }
    }
  }

  function setBusy(b) {
    busy = b;
    $("go").classList.toggle("ld", b);
    $("go").disabled = b;
  }

  $("af").addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    var signup = mode === "signup";
    var name = $("an").value.trim(), email = $("ae").value.trim(), pw = $("ap").value;
    if (signup && !name) return setErr("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email address.");
    if (pw.length < 8) return setErr("Use a password of at least 8 characters.");
    setBusy(true);
    var req = signup ? api("/sign-up/email", { name: name, email: email, password: pw }) : api("/sign-in/email", { email: email, password: pw });
    req.then(function (res) {
      if (!res.ok) { setBusy(false); setErr(friendly(res)); return; }
      return loadSession().then(function () {
        setBusy(false);
        if (!user) { setErr("Signed in, but the session could not be confirmed. Check that cookies are allowed and try again."); return; }
        $("ap").value = "";
        window.location.hash = "#portal";
        route();
      });
    }).catch(function () { setBusy(false); setErr("Could not reach the server. Check your connection and try again."); });
  });

  $("ca").addEventListener("click", function (e) {
    e.preventDefault();
    mode = mode === "login" ? "signup" : "login";
    setErr("");
    paint();
  });

  $("pt").addEventListener("click", function () {
    var p = $("ap"), show = p.type === "password";
    p.type = show ? "text" : "password";
    this.textContent = show ? "Hide" : "Show";
  });

  $("lo").addEventListener("click", function () {
    var b = this;
    b.classList.add("ld");
    api("/sign-out", {}).then(function () {
      user = null;
      window.location.hash = "#";
      window.location.reload();
    }).catch(function () {
      b.classList.remove("ld");
      window.MAXWEB_toast && window.MAXWEB_toast("Could not log out. Try again.");
    });
  });

  window.addEventListener("hashchange", route);
  paint();
  loadSession().then(route);
})();
