/* =====================================================
   AJIS — Adaptive JavaScript Interaction System
   ===================================================== */

const AJIS = {
  version: "0.2.0",
  apis: {
    anilist: "https://graphql.anilist.co",
    wikipedia: "https://en.wikipedia.org/api/rest_v1/page/summary/"
  }
};

/* =====================================================
   INTENT DEFINITIONS
===================================================== */

const INTENTS = {
  RECAP: ["what happened", "episode", "recap", "summary", "remind me"],
  INFO: ["what is", "about", "tell me about"],
  WHERE: ["where can", "watch", "read"],
  SUPPORT: ["help", "issue", "problem"]
};

/* =====================================================
   UTILITIES
===================================================== */

function detectIntent(text) {
  const t = text.toLowerCase();
  for (const [intent, keys] of Object.entries(INTENTS)) {
    if (keys.some(k => t.includes(k))) return intent;
  }
  return "INFO";
}

function extractEpisode(text) {
  const match = text.match(/episode\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function clean(text, limit = 400) {
  if (!text) return "";
  return text.replace(/<[^>]+>/g, "").slice(0, limit);
}

/* =====================================================
   API LAYER
===================================================== */

// AniList — Anime info
async function fetchAnimeInfo(title) {
  const query = `
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        title { romaji english }
        description(asHtml: false)
        episodes
        seasonYear
      }
    }
  `;

  const res = await fetch(AJIS.apis.anilist, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { search: title } })
  });

  const json = await res.json();
  return json?.data?.Media || null;
}

// Wikipedia — universal fallback
async function fetchWikiSummary(title) {
  const url = AJIS.apis.wikipedia + encodeURIComponent(title);
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}

/* =====================================================
   HANDLERS (LOGIC ONLY)
===================================================== */

const Handlers = {

  async recap(title, episode) {
    if (!title) return "Which series are you referring to?";
    if (!episode) return `Which episode of ${title} would you like a recap for?`;

    // Episode-level recap fallback (Wikipedia plot summary)
    const wiki = await fetchWikiSummary(`${title} episode ${episode}`);
    if (wiki?.extract) {
      return clean(wiki.extract);
    }

    return `A recap for ${title} Episode ${episode} could not be found.`;
  },

  async info(title) {
    if (!title) return "What title would you like information on?";

    const anime = await fetchAnimeInfo(title);
    if (anime) {
      const name = anime.title.english || anime.title.romaji;
      return `${name} (${anime.seasonYear}) has ${anime.episodes || "an unknown number of"} episodes. ${clean(anime.description)}`;
    }

    const wiki = await fetchWikiSummary(title);
    if (wiki?.extract) {
      return clean(wiki.extract);
    }

    return `I could not find information on ${title}.`;
  },

  async where(title) {
    if (!title) return "What title are you trying to find?";
    return `Availability varies by region. Let me know if you want streaming or reading options for ${title}.`;
  },

  async support() {
    return "Describe the issue you are experiencing and I will try to help.";
  }
};

/* =====================================================
   PERSONALITY MODULES
===================================================== */

const Static = {
  name: "Static",
  tone: [
    "That’s where it all begins.",
    "This sets the foundation for everything after.",
    "This moment defines the series early on.",
    "From here, things escalate quickly."
  ],
  format(core) {
    const line = this.tone[Math.floor(Math.random() * this.tone.length)];
    return `${core}\n\n${line}`;
  }
};

const Steele = {
  name: "Steele",
  format(core) {
    return core;
  }
};

/* =====================================================
   AJIS PROCESSOR
===================================================== */

async function AJIS_Process(input) {
  if (!input || typeof input !== "string") {
    return { response: "Please enter a valid request." };
  }

  const intent = detectIntent(input);
  const episode = extractEpisode(input);

  // Entity = remove intent keywords, keep remainder
  const title = input
    .replace(/episode\s*\d+/i, "")
    .replace(/what happened|recap|summary|tell me about|about|watch|read/gi, "")
    .trim();

  let response;

  switch (intent) {
    case "RECAP":
      response = await Handlers.recap(title, episode);
      break;
    case "WHERE":
      response = await Handlers.where(title);
      break;
    case "SUPPORT":
      response = await Handlers.support();
      break;
    case "INFO":
    default:
      response = await Handlers.info(title);
      break;
  }

  return { response };
}

/* =====================================================
   PUBLIC INTERFACE
===================================================== */

async function AJIS_Respond(input, speaker = "Static") {
  const result = await AJIS_Process(input);

  if (speaker === "Steele") {
    return Steele.format(result.response);
  }

  return Static.format(result.response);
}

/* =====================================================
   EXPORT (OPTIONAL)
===================================================== */

// Browser: AJIS_Respond is global
// Module:
// export { AJIS_Respond, AJIS };
