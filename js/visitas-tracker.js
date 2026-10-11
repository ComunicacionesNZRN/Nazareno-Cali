(() => {
  const supabaseClient = window._supabase || window.supabaseAdmin?.client;
  if (!supabaseClient) {
    console.warn('No se pudo registrar la visita: el cliente de Supabase no está disponible.');
    return;
  }

  (async () => {
    try {
      const { error } = await supabaseClient.from('visitas').insert({
        origen: 'web',
        pagina: window.location.pathname,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('No se pudo registrar la visita en Supabase:', error);
      }
    } catch (error) {
      console.warn('No se pudo registrar la visita en Supabase:', error);
    }
  })();
})();
