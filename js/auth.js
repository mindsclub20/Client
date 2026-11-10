import { supabase } from './supabase-client.js';

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var mode = "login", user = null, authProvider = null, busy = false;

  function legacyApi(path, body) {
    var opts = { method: body ? "POST" : "GET", credentials: "same-origin", headers: {} };
    if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch("/api/auth" + path, opts).then(function (r) {
      return r.text().then(function (t) {
        var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
        return { ok: r.ok, status: r.status, data: d };
      });
    });
  }

  function setErr(msg) { $("err").textContent = msg || ""; }
  function friendlyLegacy(res) {
    var code = String((res.data && res.data.code) || "").toUpperCase();
    if (res.status === 429) return "Too many attempts. Please wait a minute and try again.";
    if (code.indexOf("EMAIL_NOT_VERIFIED") > -1) return "Verify your email before signing in. Check your inbox for the verification link.";
    if (code.indexOf("USER_ALREADY_EXISTS") === 0) return "An account with this email already exists. Try logging in.";
    if (code.indexOf("INVALID_EMAIL_OR_PASSWORD") === 0) return "That email or password is not right.";
    if (code.indexOf("PASSWORD_TOO_SHORT") === 0) return "Use a password of at least 8 characters.";
    if (code.indexOf("INVALID_EMAIL") === 0) return "Enter a valid email address.";
    return (res.data && res.data.message) || "The existing login could not authenticate this account.";
  }
  function friendlySupabase(error) {
    var message = String(error && (error.message || error.code) || "");
    if (/invalid login credentials/i.test(message)) return "That email or password is not right.";
    if (/email not confirmed/i.test(message)) return "Verify your email before signing in. Check your inbox for the confirmation link.";
    if (/already registered|user already registered/i.test(message)) return "An account with this email already exists. Try logging in.";
    if (/password should be at least/i.test(message)) return "Use a password of at least 8 characters.";
    if (/invalid email/i.test(message)) return "Enter a valid email address.";
    if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
    return message || "Something went wrong. Please try again.";
  }

  async function loadSession() {
    try {
      const legacy = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
      if (legacy.ok) {
        const data = await legacy.json();
        if (data && data.user) {
          user = Object.assign({}, data.user, { role: data.profile && data.profile.role || "client" });
          authProvider = "legacy";
          return;
        }
      }
    } catch {}
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata && session.user.user_metadata.full_name || session.user.email,
        role: "client",
        emailVerified: !!(session.user.email_confirmed_at || session.user.confirmed_at),
      };
      authProvider = "supabase";
    } else {
      user = null;
      authProvider = null;
    }
  }

  function dashboard() {
    if (authProvider === "supabase") return "/client.html";
    return user && (user.role === "admin" || user.role === "super_admin") ? "/admin.html" : "/portal.html";
  }
  function paint() {
    var signup = mode === "signup";
    $("nameRow").hidden = !signup;
    $("lh").textContent = signup ? "Create your account" : "Welcome back";
    $("ls").textContent = signup ? "Create your MAXWEB client account." : "Log in to your MAXWEB workspace.";
    $("go").textContent = signup ? "Create account" : "Log in";
    $("sw").firstChild.textContent = signup ? "Already have an account? " : "New here? ";
    $("ca").textContent = signup ? "Log in" : "Create an account";
    $("ap").setAttribute("autocomplete", signup ? "new-password" : "current-password");
    $("forgotRow").hidden = signup;
  }
  function route() {
    var h = window.location.hash;
    if (user && (h === "#login" || h === "#portal" || h === "#admin")) {
      var target = dashboard();
      if (!window.location.pathname.endsWith(target)) { window.location.replace(target); return; }
    }
    var screen = h === "#login" || h === "#portal" || h === "#admin" ? (user ? "portal" : "login") : "site";
    $("site").hidden = screen !== "site";
    $("login").hidden = screen !== "login";
    $("portal").hidden = screen !== "portal";
    if (screen !== "site") window.scrollTo(0, 0);
    var link = document.querySelector(".nav .btn.ghost");
    if (link) {
      link.textContent = user ? "My workspace" : "Log in";
      link.setAttribute("href", user ? dashboard() : "#login");
    }
    if (user) {
      $("who").textContent = user.name || user.email;
      var wa = $("pwa");
      if (wa && window.MAXWEB_waLink) wa.href = window.MAXWEB_waLink("Hi MAXWEB, I have a question about my project.");
    }
  }
  function setBusy(value) { busy = value; $("go").classList.toggle("ld", value); $("go").disabled = value; }

  $("af").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (busy) return;
    setErr("");
    var signup = mode === "signup";
    var name = $("an").value.trim(), email = $("ae").value.trim(), password = $("ap").value;
    if (signup && !name) return setErr("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email address.");
    if (password.length < 8 || password.length > 128) return setErr("Use a password between 8 and 128 characters.");
    setBusy(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin + "/client.html",
          },
        });
        if (error) throw error;
        $("ap").value = "";
        if (data && data.session) {
          await loadSession();
          window.location.assign("/client.html");
          return;
        }
        setErr("Account created. Check your inbox and verify your email before logging in.");
        return;
      }

      // Keep the existing administrator and legacy client sign-in path intact.
      let legacy = null;
      try { legacy = await legacyApi("/sign-in/email", { email: email, password: password }); } catch {}
      if (legacy && legacy.ok) {
        await loadSession();
        if (user && authProvider === "legacy") {
          $("ap").value = "";
          window.location.assign(dashboard());
          return;
        }
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await loadSession();
      if (!user || authProvider !== "supabase") {
        setErr("Your client session could not be confirmed. Verify your email and try again.");
        return;
      }
      $("ap").value = "";
      window.location.assign("/client.html");
    } catch (error) {
      setErr(error && error.message ? friendlySupabase(error) : friendlyLegacy({ data: null, status: 500 }));
    } finally {
      setBusy(false);
    }
  });

  $("forgot").addEventListener("click", async function (event) {
    event.preventDefault();
    if (busy) return;
    var email = $("ae").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter your account email first.");
    setBusy(true);
    try {
      const legacy = await legacyApi("/request-password-reset", {
        email: email,
        redirectTo: window.location.origin + "/reset-password.html",
      });
      if (legacy.ok) {
        setErr("If an account exists for this email, a password-reset link has been sent. Check your inbox.");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/client-reset-password.html",
      });
      if (error) throw error;
      setErr("If a client account exists for this email, a password-reset link has been sent. Check your inbox.");
    } catch (error) {
      setErr(friendlySupabase(error));
    } finally { setBusy(false); }
  });

  $("ca").addEventListener("click", function (event) {
    event.preventDefault(); mode = mode === "login" ? "signup" : "login"; setErr(""); paint();
  });
  $("pt").addEventListener("click", function () {
    var p = $("ap"), show = p.type === "password";
    p.type = show ? "text" : "password"; this.textContent = show ? "Hide" : "Show";
  });
  $("lo").addEventListener("click", async function () {
    if (authProvider === "supabase") await supabase.auth.signOut();
    else await legacyApi("/sign-out", {});
    user = null; authProvider = null; window.location.href = "/";
  });
  supabase.auth.onAuthStateChange(function (event) {
    if (event === "SIGNED_OUT" && authProvider === "supabase") { user = null; authProvider = null; route(); }
  });
  window.addEventListener("hashchange", route);
  paint();
  loadSession().then(route).catch(function () { route(); });
})();
