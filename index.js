const dotenv = require("dotenv");
const { existsSync, writeFileSync } = require("fs");
if (existsSync(".env")) {
    if (!process.env.CH_EMAIL || !process.env.CH_PASSWORD) {
        dotenv.config();
    }
} else {
    console.error("Not found env data");
    process.exit();
}
const cr = require("crunchyroll.js");
const { PrismaClient } = require("@prisma/client");

const getUuid = require("uuid-by-string");

const db = new PrismaClient();

function createId(...ids) {
    if (ids.length === 0) return getUuid(["_", Date.now()].join("/"));
    return getUuid(`$${ids.join("/")}`);
}
/**
 *
 * @param {import("./response.json")['items'][0]} item
 */
async function addItemOrIgnore(item) {
    if (!item?.series_metadata || !item?.series_metadata?.episode_count) {
        console.log(`${item.title} ignorado`, item);
        return;
    }
    const element = await db.item.findFirst({
        where: {
            id: createId(
                "serie",
                item.id,
                item.series_metadata.season_count || 1,
                item.series_metadata.episode_count
            ),
        },
    });
    if (element) {
        return;
    }
    const images = [];
    if (item.images.poster_tall) {
        for (const imgs of item.images.poster_tall) {
            if (Array.isArray(imgs))
                for (const img of imgs) {
                    images.push(img);
                }
        }
    }
    await db.item.create({
        data: {
            id: createId(
                "serie",
                item.id,
                item.series_metadata.season_count || 1,
                item.series_metadata.episode_count
            ),
            serie_id: item.id,
            season: item.series_metadata.season_count || 1,
            episode: item.series_metadata.episode_count,
            slug: item.slug_title || null,
            title: item.title || "",
            description: item.description || "",
            audio_locales: Array.isArray(item.series_metadata.audio_locales)
                ? item.series_metadata.audio_locales
                      .filter((e) => e)
                      .map((e) => String(e))
                : [],
            subtitle_locales: Array.isArray(
                item.series_metadata.subtitle_locales
            )
                ? item.series_metadata.subtitle_locales
                      .filter((e) => e)
                      .map((e) => String(e))
                : [],
            is_dubbed: item.series_metadata.is_dubbed,
            is_subbed: item.series_metadata.is_subbed,
            images: images,
        },
    });
}

// (async () => {
//     // Login to crunchyroll
//     const res = await cr.login(process.env.CH_EMAIL, process.env.CH_PASSWORD);

//     // Get anime info
//     const response = await cr.getAllAnimes(0, 10, "newly_added");
//     for (const item of response.items) {
//         await addItemOrIgnore(item);
//     }
//     console.log(
//         await db.item.findMany({ take: 10, orderBy: { pubDate: "desc" } })
//     );
//     writeFileSync("response.json", JSON.stringify(response || [], null, 4));
// })();

const express = require("express");
const app = express();

app.use((req, res, next) => {
    if (!process.env.AUTH_TOKEN) return next();
    if (req.headers.authorization !== "Bearer " + process.env.AUTH_TOKEN) {
        return res.status(401).send({ message: "Unathorized" });
    }
});

app.get("/api/recent/anime", async (req, res) => {
    if (!req.query.after_at) {
        return res.status(400).send({
            message: "Invalid parameters (Query parameters is required)",
        });
    }
    const after_at = Number(req.query.after_at);
    if (isNaN(after_at))
        return res
            .status(400)
            .send({ message: "Invalid parameters (after_at is NaN)" });
    if (after_at > ~~(Date.now() / 1000))
        return res
            .status(400)
            .send({ message: "Invalid parameters (after_at is future)" });
    const items = await db.item.findMany({
        where: {
            pubDate: {
                gte: new Date(after_at * 1000),
            },
        },
        take: 10,
        orderBy: { pubDate: "desc" },
    });
    res.send({ success: true, items: items });
});
(async function () {
    await cr.login(process.env.CH_EMAIL, process.env.CH_PASSWORD);
    const interval = setInterval(async () => {
        console.log("Buscando atualizações na crunchyroll");
        const response = await cr.getAllAnimes(0, 10, "newly_added");
        for (const item of response.items) {
            await addItemOrIgnore(item);
        }
    }, 60 * 1000 * 4);
    app.listen(process.env.PORT || 3000, () => {
        console.log("Server Running");
    });
})();
