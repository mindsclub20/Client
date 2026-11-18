(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var user = null;

  function loadSession() {
    return fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { user = d && d.user ? d.user : null; })
      .catch(function () { user = null; });
  }

  function route() {
    var h = window.location.hash, screen = "site";
    if (user && user.role === "admin" && (h === "#login" || h === "#portal")) {
      window.location.replace("/admin");
      return;
    }
    if (h === "#login" || h === "#portal") screen = user ? "portal" : "login";
    $("site").hidden = screen !== "site";
    $("login").hidden = screen !== "login";
    $("portal").hidden = screen !== "portal";
    if (screen !== "site") window.scrollTo(0, 0);
    var a = document.querySelector(".nav .btn.ghost");
    if (a) {
      a.textContent = user ? (user.role === "admin" ? "Admin dashboard" : "My portal") : "Log in";
      a.setAttribute("href", user ? (user.role === "admin" ? "/admin" : "#portal") : "#login");
    }
    if (user) {
      $("who").textContent = user.name || user.email;
      var wa = $("pwa");
      if (wa && window.MAXWEB_waLink) wa.href = window.MAXWEB_waLink("Hi MAXWEB, I am a client (" + user.email + ") and have a question about my project.");
    }
  }

  // Authgear is the sole visible sign-in and sign-up experience.
  // Keep the legacy Supabase endpoints available for existing sessions and integrations,
  // but do not expose a second email/password form on the client login screen.
  $("af").hidden = true;
  $("sw").hidden = true;
  $("lh").textContent = "Sign in to MAXWEB";
  $("ls").textContent = "Continue securely with Authgear. New clients can create an account on the next screen.";

  var authgearButton = document.createElement("a");
  authgearButton.id = "authgear-login";
  authgearButton.href = "/api/auth/authgear/start";
  authgearButton.textContent = "Continue with Authgear";
  authgearButton.setAttribute("aria-label", "Continue to secure MAXWEB sign in with Authgear");
  authgearButton.style.cssText = "display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;box-sizing:border-box;margin-top:22px;padding:14px 20px;border:1px solid #53658a;border-radius:12px;background:#17243d;color:#fff;text-align:center;text-decoration:none;font-weight:700;letter-spacing:.01em;transition:transform .18s ease,background .18s ease;";
  authgearButton.addEventListener("mouseenter", function () { authgearButton.style.background = "#223657"; });
  authgearButton.addEventListener("mouseleave", function () { authgearButton.style.background = "#17243d"; });
  $("login").appendChild(authgearButton);

  $("lo").addEventListener("click", function () {
    var button = this;
    button.classList.add("ld");
    fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(function (res) {
        if (!res.ok) throw new Error("logout failed");
        return res.json();
      })
      .then(function (data) {
        user = null;
        if (data && data.redirectTo) { window.location.assign(data.redirectTo); return; }
        window.location.hash = "#";
        window.location.reload();
      })
      .catch(function () {
        button.classList.remove("ld");
        window.MAXWEB_toast && window.MAXWEB_toast("Could not log out. Try again.");
      });
  });

  window.addEventListener("hashchange", route);
  loadSession().then(route);
})();
