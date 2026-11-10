import { supabase } from './supabase-client.js';

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var mode = "login", user = null, busy = false;
  function dashboard() { return user && (user.role === "admin" || user.role === "super_admin") ? "/admin.html" : "/portal.html"; }
  function setErr(msg) { $("err").textContent = msg || ""; }
  function friendly(error) {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { user = null; return; }
      const response = await fetch("/api/me", {
        credentials: "same-origin", cache: "no-store",
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const data = response.ok ? await response.json() : null;
      user = data && data.user ? Object.assign({}, data.user, { role: data.profile && data.profile.role || "client" }) : null;
    } catch { user = null; }
  }
  function paint() {
    var signup = mode === "signup";
    $("nameRow").hidden = !signup;
    $("lh").textContent = signup ? "Create your account" : "Welcome back";
    $("ls").textContent = signup ? "Create your MAXWEB client portal account." : "Log in to your MAXWEB workspace.";
    $("go").textContent = signup ? "Create account" : "Log in";
    $("sw").firstChild.textContent = signup ? "Already have an account? " : "New here? ";
    $("ca").textContent = signup ? "Log in" : "Create an account";
    $("ap").setAttribute("autocomplete", signup ? "new-password" : "current-password");
    $("forgotRow").hidden = signup;
  }
  function route() {
    var h = window.location.hash, target = dashboard();
    if (user && (h === "#login" || h === "#portal" || h === "#admin")) {
      if (!window.location.pathname.endsWith(target)) { window.location.replace(target); return; }
    }
    var screen = h === "#login" || h === "#portal" || h === "#admin" ? (user ? "portal" : "login") : "site";
    $("site").hidden = screen !== "site"; $("login").hidden = screen !== "login"; $("portal").hidden = screen !== "portal";
    if (screen !== "site") window.scrollTo(0, 0);
    var a = document.querySelector(".nav .btn.ghost");
    if (a) { a.textContent = user ? "My workspace" : "Log in"; a.setAttribute("href", user ? target : "#login"); }
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
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin + "/#login" },
        });
        if (error) throw error;
        $("ap").value = "";
        setErr("Account created. Check your inbox and verify your email before logging in.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await loadSession();
      if (!user) { setErr("Your session could not be confirmed. Verify your email and try again."); return; }
      $("ap").value = "";
      window.location.assign(dashboard());
    } catch (error) { setErr(friendly(error)); }
    finally { setBusy(false); }
  });

  $("forgot").addEventListener("click", async function (event) {
    event.preventDefault();
    if (busy) return;
    var email = $("ae").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter your account email first.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password.html",
      });
      if (error) throw error;
      setErr("If an account exists for this email, a password-reset link has been sent. Check your inbox.");
    } catch (error) { setErr(friendly(error)); }
    finally { setBusy(false); }
  });
  $("ca").addEventListener("click", function (event) { event.preventDefault(); mode = mode === "login" ? "signup" : "login"; setErr(""); paint(); });
  $("pt").addEventListener("click", function () { var p = $("ap"), show = p.type === "password"; p.type = show ? "text" : "password"; this.textContent = show ? "Hide" : "Show"; });
  $("lo").addEventListener("click", async function () { await supabase.auth.signOut(); user = null; window.location.href = "/"; });
  supabase.auth.onAuthStateChange(function (event) { if (event === "SIGNED_OUT") { user = null; route(); } });
  window.addEventListener("hashchange", route);
  paint();
  loadSession().then(route);
})();
