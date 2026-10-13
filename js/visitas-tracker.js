(() => {
  const supabaseClient = window._supabase || window.supabaseAdmin?.client;
  if (!supabaseClient) return;

  (async () => {
    try {
      await supabaseClient.from('visitas').insert({
        origen: 'web',
        pagina: window.location.pathname,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Un fallo al registrar la visita no debe afectar al sitio.
    }
  })();
})();
