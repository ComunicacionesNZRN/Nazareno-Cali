const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");
const youtubeChannelId = Deno.env.get("YOUTUBE_CHANNEL_ID") || "UCiYeT4_HfmnSEbtYjxPnRgg";
// El cron corre cada 5 min; 270 s con 30 s de margen evita que una corrida llegue "cached".
const syncIntervalSeconds = Math.max(240, Number(Deno.env.get("YOUTUBE_SYNC_INTERVAL_SECONDS") || 270));
const syncMarginSeconds = 30;
// Lista de subidas del canal: "UU" + id del canal sin "UC" (evita channels.list).
const uploadsPlaylistId = `UU${youtubeChannelId.slice(2)}`;
const defaultChannelTitle = "Iglesia del Nazareno Cali";

const allowedOrigins = (Deno.env.get("YOUTUBE_SYNC_ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const originIsAllowed = (origin: string | null) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "nazarenocali.org" || hostname.endsWith(".nazarenocali.org");
  } catch {
    return false;
  }
};

const responseHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  Vary: "Origin",
});

const jsonResponse = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });

const databaseRequest = async (resource: string, options: { method?: string; query?: URLSearchParams; body?: unknown; prefer?: string } = {}) => {
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Faltan las variables de Supabase en la Edge Function.");

  const url = new URL(`/rest/v1/${resource}`, supabaseUrl);
  options.query?.forEach((value, key) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.message || `Supabase respondió ${response.status}.`);
  return payload;
};

const youtubeRequest = async (endpoint: string, params: URLSearchParams) => {
  if (!youtubeApiKey) throw new Error("Configura YOUTUBE_API_KEY en los secretos de Supabase.");
  params.set("key", youtubeApiKey);

  const response = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${params}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `YouTube API respondió ${response.status}.`);
  return payload;
};

const loadCachedSermons = () => databaseRequest("sermones", {
  query: new URLSearchParams({ select: "*", publicado: "eq.true", order: "fecha.desc", limit: "50" }),
});

const sermonFromVideo = (videoId: string, snippet: Record<string, any>, isLive: boolean) => {
  const title = String(snippet.title || "Predicación de Nazareno Cali");
  const preacher = title.match(/\b(?:Pr\.?|Pastor(?:a)?)\s+(.+)$/i)?.[1]
    ?.replace(/\s*[|•].*$/, "")
    .trim();
  const thumbnails = snippet.thumbnails || {};

  return {
    titulo: title,
    predicador: preacher || snippet.channelTitle || defaultChannelTitle,
    fecha: String(snippet.publishedAt || new Date().toISOString()).slice(0, 10),
    youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
    youtube_video_id: videoId,
    youtube_channel_id: youtubeChannelId,
    thumbnail_url: thumbnails.maxres?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    en_vivo: isLive,
    publicado: true,
  };
};

const synchronizeChannel = async () => {
  if (!supabaseUrl || !serviceRoleKey || !youtubeApiKey) {
    throw new Error("Configura SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y YOUTUBE_API_KEY en Supabase.");
  }

  const now = new Date();
  const minimumSyncTime = new Date(now.getTime() - (syncIntervalSeconds - syncMarginSeconds) * 1000);
  const stateRows = await databaseRequest("youtube_sync_state", {
    query: new URLSearchParams({ id: "eq.1", select: "last_attempt_at,last_success_at" }),
  });
  const state = stateRows?.[0];

  if (state?.last_success_at && new Date(state.last_success_at).getTime() > minimumSyncTime.getTime()) {
    return { status: "cached", live: false, sermons: await loadCachedSermons() };
  }

  const claim = await databaseRequest("youtube_sync_state", {
    method: "PATCH",
    query: new URLSearchParams({ id: "eq.1", last_attempt_at: `lt.${minimumSyncTime.toISOString()}` }),
    body: { last_attempt_at: now.toISOString(), last_error: null },
  });

  if (!claim?.length) {
    return { status: "syncing", live: false, sermons: await loadCachedSermons() };
  }

  try {
    // Costo por corrida: playlistItems (1 unidad) + videos.list (1 unidad). Sin search.list (100).
    const uploadsResult = await youtubeRequest("playlistItems", new URLSearchParams({
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "20",
    }));

    const videoIds = [...new Set((uploadsResult.items || [])
      .map((item: Record<string, any>) => item.contentDetails?.videoId)
      .filter(Boolean))] as string[];

    const videosResult = videoIds.length
      ? await youtubeRequest("videos", new URLSearchParams({
        part: "snippet,liveStreamingDetails",
        id: videoIds.join(","),
        maxResults: "50",
      }))
      : { items: [] };

    const videos = new Map<string, Record<string, any>>();
    const liveIds = new Set<string>();
    for (const item of videosResult.items || []) {
      if (!item?.id) continue;
      videos.set(item.id, item.snippet || {});
      // Solo "live" cuenta como en vivo; "upcoming" (programado) no.
      if (item.snippet?.liveBroadcastContent === "live") liveIds.add(item.id);
    }

    const channelTitle = defaultChannelTitle;
    const rows = [...videos.entries()].map(([videoId, snippet]) => ({
      ...sermonFromVideo(videoId, { channelTitle, ...snippet }, liveIds.has(videoId)),
    }));

    await databaseRequest("sermones", {
      method: "PATCH",
      query: new URLSearchParams({ youtube_channel_id: `eq.${youtubeChannelId}`, en_vivo: "eq.true" }),
      body: { en_vivo: false },
      prefer: "return=minimal",
    });

    if (rows.length) {
      await databaseRequest("sermones", {
        method: "POST",
        query: new URLSearchParams({ on_conflict: "youtube_video_id" }),
        body: rows,
        prefer: "resolution=merge-duplicates,return=representation",
      });
    }

    await databaseRequest("youtube_sync_state", {
      method: "PATCH",
      query: new URLSearchParams({ id: "eq.1" }),
      body: { last_attempt_at: now.toISOString(), last_success_at: now.toISOString(), last_error: null },
      prefer: "return=minimal",
    });

    return { status: "synced", live: liveIds.size > 0, count: rows.length };
  } catch (error) {
    await databaseRequest("youtube_sync_state", {
      method: "PATCH",
      query: new URLSearchParams({ id: "eq.1" }),
      body: { last_error: error instanceof Error ? error.message : "Error de sincronización." },
      prefer: "return=minimal",
    }).catch(() => undefined);

    throw error;
  }
};

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");

  if (!originIsAllowed(origin)) return jsonResponse({ error: "Origen no permitido." }, 403, null);
  if (request.method === "OPTIONS") return new Response("ok", { headers: responseHeaders(origin) });
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405, origin);

  try {
    const result = await synchronizeChannel();
    return jsonResponse(result, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible sincronizar YouTube.";
    console.error("youtube-media-sync:", message);
    return jsonResponse({ error: message }, 500, origin);
  }
});