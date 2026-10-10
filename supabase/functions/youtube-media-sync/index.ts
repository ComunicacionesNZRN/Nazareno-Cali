const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");
const youtubeChannelId = Deno.env.get("YOUTUBE_CHANNEL_ID") || "UCiYeT4_HfmnSEbtYjxPnRgg";
const syncIntervalSeconds = Math.max(900, Number(Deno.env.get("YOUTUBE_SYNC_INTERVAL_SECONDS") || 1800));
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
  const minimumSyncTime = new Date(now.getTime() - syncIntervalSeconds * 1000);
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
    const [liveResult, channelResult] = await Promise.all([
      youtubeRequest("search", new URLSearchParams({
        part: "snippet",
        channelId: youtubeChannelId,
        eventType: "live",
        type: "video",
        maxResults: "1",
      })),
      youtubeRequest("channels", new URLSearchParams({
        part: "contentDetails,snippet",
        id: youtubeChannelId,
        maxResults: "1",
      })),
    ]);

    const channel = channelResult.items?.[0];
    const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) throw new Error("No se encontró la lista de videos del canal.");

    const uploadsResult = await youtubeRequest("playlistItems", new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "20",
    }));

    const activeLive = liveResult.items?.[0];
    const activeLiveId = activeLive?.id?.videoId || "";
    const videos = new Map<string, Record<string, any>>();

    for (const item of uploadsResult.items || []) {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      if (videoId) videos.set(videoId, item.snippet || {});
    }

    if (activeLiveId && !videos.has(activeLiveId)) {
      videos.set(activeLiveId, activeLive.snippet || {});
    }

    const channelTitle = channel.snippet?.title || defaultChannelTitle;
    const rows = [...videos.entries()].map(([videoId, snippet]) => ({
      ...sermonFromVideo(videoId, { channelTitle, ...snippet }, videoId === activeLiveId),
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

    return { status: "synced", live: Boolean(activeLiveId), count: rows.length };
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