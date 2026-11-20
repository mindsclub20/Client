(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var form = $("af");
  if (!form) return;

  var mode = "login", user = null, busy = false;
  var AUTHGEAR_START = "/api/auth/authgear/start";

  function api(path, body) {
    var opts = { method: body ? "POST" : "GET", credentials: "same-origin", headers: {} };
    if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch("/api/auth" + path, opts).then(function (r) {
      return r.text().then(function (t) {
        var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
        return { ok: r.ok, status: r.status, data: d };
      });
    });
  }

  function setErr(message) { $("err").textContent = message || ""; }
  function friendly(res) {
    var code = String((res.data && res.data.code) || "").toUpperCase();
    if (res.status === 429) return "Too many attempts. Please wait and try again.";
    if (code.indexOf("EMAIL_NOT_CONFIRMED") >= 0) return "Confirm your email address before logging in.";
    if (code.indexOf("INVALID_CREDENTIALS") >= 0 || code.indexOf("INVALID_LOGIN_CREDENTIALS") >= 0) return "That email or password is not right.";
    if (code.indexOf("WEAK_PASSWORD") >= 0) return "Use a password of at least 8 characters.";
    if (res.status === 403) return "This request was blocked for security reasons. Reload and try again.";
    if (res.status >= 500) return "The server had a problem. Please try again.";
    return (res.data && res.data.message) || "Something went wrong. Please try again.";
  }

  function loadSession() {
    return fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { user = d && d.user ? d.user : null; })
      .catch(function () { user = null; });
  }

  function goAuthgear() {
    window.location.assign(AUTHGEAR_START);
  }

  function paint() {
    var signup = mode === "signup";
    $("nameRow").hidden = !signup;
    $("lh").textContent = signup ? "Create your account" : "Sign in to MAXWEB";
    $("ls").textContent = signup
      ? "Join the MAXWEB client portal."
      : "You will be redirected to Authgear for secure sign-in.";
    $("go").textContent = signup ? "Create account" : "Continue with Authgear";
    $("sw").firstChild.textContent = signup ? "Already have an account? " : "New here? ";
    $("ca").textContent = signup ? "Log in" : "Create an account";
    $("ap").setAttribute("autocomplete", signup ? "new-password" : "current-password");
  }

  function route() {
    var h = window.location.hash, screen = "site";

    // Logged-in users go to dashboards.
    if (user && user.role === "admin" && (h === "#login" || h === "#portal")) {
      window.location.replace("/admin");
      return;
    }
    if (user && user.role !== "admin" && (h === "#login" || h === "#portal")) {
      window.location.replace("/client");
      return;
    }

    // Clicking Log in / #login → Authgear immediately (unless an authgear= error is shown).
    if (!user && h === "#login") {
      var params = new URLSearchParams(window.location.search);
      if (!params.get("authgear")) {
        goAuthgear();
        return;
      }
    }

    if (h === "#login" || h === "#portal") screen = user ? "portal" : "login";
    $("site").hidden = screen !== "site";
    $("login").hidden = screen !== "login";
    $("portal").hidden = screen !== "portal";
    if (screen !== "site") window.scrollTo(0, 0);

    var a = document.querySelector(".nav .btn.ghost");
    if (a) {
      if (user) {
        a.textContent = user.role === "admin" ? "Admin dashboard" : "My portal";
        a.setAttribute("href", user.role === "admin" ? "/admin" : "/client");
      } else {
        a.textContent = "Login with Authgear";
        a.setAttribute("aria-label", "Login securely with Authgear");
        a.setAttribute("href", AUTHGEAR_START);
      }
    }
    if (user) {
      var who = $("who");
      if (who) who.textContent = user.name || user.email;
      var wa = $("pwa");
      if (wa && window.MAXWEB_waLink) wa.href = window.MAXWEB_waLink("Hi MAXWEB, I am a client (" + user.email + ") and have a question about my project.");
    }
  }

  function setBusy(value) { busy = value; $("go").classList.toggle("ld", value); $("go").disabled = value; }

  if (!$("authgear-login")) {
    var authgearButton = document.createElement("a");
    authgearButton.id = "authgear-login";
    authgearButton.href = AUTHGEAR_START;
    authgearButton.textContent = "Continue with Authgear";
    authgearButton.setAttribute("aria-label", "Continue to secure MAXWEB sign in with Authgear");
    authgearButton.style.cssText = "display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;box-sizing:border-box;margin:8px 0 18px;padding:14px 20px;border:1px solid #53658a;border-radius:12px;background:#17243d;color:#fff;text-align:center;text-decoration:none;font-weight:700;letter-spacing:.01em;";
    form.parentNode.insertBefore(authgearButton, form);
  }

  // Primary login submit also goes to Authgear when in login mode.
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy) return;

    if (mode === "login") {
      goAuthgear();
      return;
    }

    setErr("");
    var name = $("an").value.trim(), email = $("ae").value.trim(), password = $("ap").value;
    if (!name) return setErr("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email address.");
    if (password.length < 8) return setErr("Use a password of at least 8 characters.");
    setBusy(true);
    api("/sign-up/email", { name: name, email: email, password: password }).then(function (res) {
      if (res.status === 202 && res.data && res.data.needsEmailConfirmation) {
        setBusy(false); $("ap").value = ""; mode = "login"; paint();
        setErr(res.data.message || "Check your email for a confirmation link, then log in with Authgear.");
        return;
      }
      if (!res.ok) { setBusy(false); setErr(friendly(res)); return; }
      return loadSession().then(function () {
        setBusy(false);
        if (!user) {
          // Prefer Authgear after account creation.
          goAuthgear();
          return;
        }
        $("ap").value = "";
        if (user.role === "admin") window.location.replace("/admin");
        else window.location.replace("/client");
      });
    }).catch(function () { setBusy(false); setErr("Could not reach the server. Check your connection and try again."); });
  });

  $("ca").addEventListener("click", function (event) {
    event.preventDefault();
    // "Log in" from signup mode → Authgear directly.
    if (mode === "signup") {
      goAuthgear();
      return;
    }
    mode = "signup";
    setErr("");
    paint();
  });
  $("pt").addEventListener("click", function () {
    var input = $("ap"), show = input.type === "password";
    input.type = show ? "text" : "password"; this.textContent = show ? "Hide" : "Show";
  });
  $("lo").addEventListener("click", function () {
    var button = this; button.classList.add("ld");
    fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }).then(function (res) {
      if (!res.ok) throw new Error("logout failed");
      return res.json();
    }).then(function (data) {
      user = null;
      if (data && data.redirectTo) { window.location.assign(data.redirectTo); return; }
      window.location.hash = "#";
      window.location.reload();
    }).catch(function () {
      button.classList.remove("ld");
      window.MAXWEB_toast && window.MAXWEB_toast("Could not log out. Try again.");
    });
  });

  window.addEventListener("hashchange", route);
  paint();
  loadSession().then(route);
})();
