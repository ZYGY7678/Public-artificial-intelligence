(() => {
  const SUPABASE_URL = "https://ikgyozgzhjbdmopsaflp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_ezliwatqX0wz_-ScmiWzHw_-OhgkCH8";
  const supabaseLib = window.supabase;
  if (!supabaseLib?.createClient) return;

  const client = supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  const LOCAL_KEY = "aiplay_v4";
  const RELOAD_KEY = "aiplay_auth_sync_reload";

  function userFromSession(session) {
    const u = session?.user;
    if (!u) return null;
    return {
      id: u.id,
      name: u.user_metadata?.display_name ||
            u.user_metadata?.name ||
            u.user_metadata?.full_name ||
            u.email?.split("@")[0] ||
            "משתמש",
      email: u.email || ""
    };
  }

  function saveUser(user) {
    try {
      const current = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
      current.user = user;
      current.rep = Number(current.rep || 0);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(current));
    } catch (_) {}
  }

  function paint(user) {
    if (!user) return;
    const name = user.name || "משתמש";
    const avatar = (name.trim().charAt(0) || "א").toUpperCase();
    document.getElementById("accountAvatar")?.replaceChildren(document.createTextNode(avatar));
    document.getElementById("accountName")?.replaceChildren(document.createTextNode(name));
    document.getElementById("profileAvatar")?.replaceChildren(document.createTextNode(avatar));
    document.getElementById("profileName")?.replaceChildren(document.createTextNode(name));
    const h = document.getElementById("profileHandle");
    if (h) h.textContent = "@" + name.toLowerCase().replace(/\s+/g, "");
    document.getElementById("authModal")?.classList.remove("open");
  }

  async function sync(session, forceReload = true) {
    const user = userFromSession(session);
    if (!user) {
      sessionStorage.removeItem(RELOAD_KEY);
      return;
    }
    saveUser(user);
    paint(user);

    if (forceReload && sessionStorage.getItem(RELOAD_KEY) !== "1") {
      sessionStorage.setItem(RELOAD_KEY, "1");
      location.reload();
    }
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || session?.user) {
      sync(session, true).catch(() => {});
    } else if (event === "SIGNED_OUT") {
      sessionStorage.removeItem(RELOAD_KEY);
    }
  });

  client.auth.getSession().then(({ data }) => {
    if (data?.session?.user) sync(data.session, false).catch(() => {});
  }).catch(() => {});

  document.addEventListener("click", (e) => {
    if (e.target.closest("#googleAuthBtn")) {
      const started = Date.now();
      const timer = setInterval(async () => {
        try {
          const { data } = await client.auth.getSession();
          if (data?.session?.user) {
            clearInterval(timer);
            await sync(data.session, true);
            return;
          }
        } catch (_) {}
        if (Date.now() - started > 20000) clearInterval(timer);
      }, 500);
    }
  }, true);
})();