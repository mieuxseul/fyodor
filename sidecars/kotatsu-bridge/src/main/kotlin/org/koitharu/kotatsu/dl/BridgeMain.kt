package org.koitharu.kotatsu.dl

import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.koitharu.kotatsu.dl.parsers.MangaLoaderContextImpl
import org.koitharu.kotatsu.parsers.model.Manga
import org.koitharu.kotatsu.parsers.model.MangaListFilter
import org.koitharu.kotatsu.parsers.model.MangaParserSource
import org.koitharu.kotatsu.parsers.model.SortOrder
/**
 * JSON CLI bridge for Fyodor. GPL-3 (inherits kotatsu-parsers / kotatsu-dl).
 *
 * Usage:
 *   java -jar kotatsu-bridge.jar list-sources
 *   java -jar kotatsu-bridge.jar search --source MANGADEX --query "one piece" [--limit 20]
 *   java -jar kotatsu-bridge.jar details --source MANGADEX --url "/title/..." --title "..." [--cover URL]
 *   java -jar kotatsu-bridge.jar chapters --source MANGADEX --url "..." --title "..."
 *   java -jar kotatsu-bridge.jar pages --source MANGADEX --manga-url "..." --chapter-url "..." --chapter-id 123
 *   java -jar kotatsu-bridge.jar health
 */
fun main(args: Array<String>) {
    if (args.isEmpty() || args[0] == "--help" || args[0] == "-h") {
        System.err.println(
            """
            kotatsu-bridge commands:
              list-sources
              search --source <ID> --query <q> [--limit N]
              details --source <ID> --url <path> --title <t> [--id N] [--cover URL]
              chapters --source <ID> --url <path> --title <t> [--id N] [--cover URL]
              pages --source <ID> --manga-url <path> --chapter-url <path> --chapter-id <N>
              health
            """.trimIndent(),
        )
        return
    }

    try {
        val result = runBlocking { dispatch(args) }
        println(result)
    } catch (error: Throwable) {
        val payload = JSONObject()
            .put("ok", false)
            .put("error", error.message ?: error::class.java.simpleName)
        System.err.println(payload.toString())
        kotlin.system.exitProcess(1)
    }
}

private suspend fun dispatch(args: Array<String>): String {
    val command = args[0]
    val opts = parseOptions(args.drop(1))
    val context = MangaLoaderContextImpl()

    return when (command) {
        "health" -> JSONObject()
            .put("ok", true)
            .put("sources", MangaParserSource.entries.count { !it.name.equals("DUMMY", true) })
            .toString()

        "list-sources" -> {
            val arr = JSONArray()
            for (source in MangaParserSource.entries) {
                if (source.name.equals("DUMMY", true)) continue
                val domain = runCatching {
                    context.newParserInstance(source).domain
                }.getOrNull()
                arr.put(
                    JSONObject()
                        .put("id", source.name)
                        .put("title", source.title)
                        .put("locale", source.locale)
                        .put("contentType", source.contentType.name)
                        .put("broken", source.isBroken)
                        .put("domain", domain),
                )
            }
            JSONObject().put("ok", true).put("sources", arr).toString()
        }

        "search" -> {
            val source = requireSource(opts["source"])
            val query = opts["query"]?.trim().orEmpty()
            require(query.isNotEmpty()) { "Missing --query" }
            val limit = opts["limit"]?.toIntOrNull()?.coerceIn(1, 50) ?: 20
            val parser = context.newParserInstance(source)
            val order = parser.availableSortOrders.firstOrNull() ?: SortOrder.UPDATED
            val list = parser.getList(0, order, MangaListFilter(query = query)).take(limit)
            val arr = JSONArray()
            for (manga in list) {
                arr.put(mangaToJson(manga))
            }
            JSONObject()
                .put("ok", true)
                .put("source", source.name)
                .put("results", arr)
                .toString()
        }

        "details", "chapters" -> {
            val source = requireSource(opts["source"])
            val url = opts["url"] ?: error("Missing --url")
            val title = opts["title"] ?: "Untitled"
            val parser = context.newParserInstance(source)
            val seed = seedManga(source, opts, url, title)
            val details = parser.getDetails(seed)
            if (command == "details") {
                JSONObject()
                    .put("ok", true)
                    .put("details", mangaToJson(details, includeChapters = false))
                    .toString()
            } else {
                val chapters = details.chapters.orEmpty()
                val arr = JSONArray()
                chapters.forEachIndexed { index, chapter ->
                    arr.put(
                        JSONObject()
                            .put("id", chapter.id.toString())
                            .put("url", chapter.url)
                            .put("title", chapter.title ?: "Chapter")
                            .put("number", chapter.number.takeIf { it > 0f })
                            .put("scanlator", chapter.scanlator)
                            .put("uploadDate", chapter.uploadDate.takeIf { it > 0L })
                            .put("branch", chapter.branch)
                            .put("sortIndex", index),
                    )
                }
                JSONObject()
                    .put("ok", true)
                    .put("source", source.name)
                    .put("mangaUrl", details.url)
                    .put("chapters", arr)
                    .toString()
            }
        }

        "pages" -> {
            val source = requireSource(opts["source"])
            val mangaUrl = opts["manga-url"] ?: error("Missing --manga-url")
            val chapterUrl = opts["chapter-url"] ?: error("Missing --chapter-url")
            val chapterId = opts["chapter-id"]?.toLongOrNull() ?: error("Missing --chapter-id")
            val parser = context.newParserInstance(source)
            val seed = seedManga(source, opts, mangaUrl, opts["title"] ?: "Untitled")
            val details = parser.getDetails(seed)
            val chapter = details.chapters.orEmpty().find { it.id == chapterId || it.url == chapterUrl }
                ?: error("Chapter not found")
            val pages = parser.getPages(chapter)
            val arr = JSONArray()
            for (page in pages) {
                val direct = runCatching { parser.getPageUrl(page) }.getOrNull() ?: page.url
                arr.put(direct)
            }
            JSONObject()
                .put("ok", true)
                .put("pages", arr)
                .toString()
        }

        else -> error("Unknown command: $command")
    }
}

private fun requireSource(raw: String?): MangaParserSource {
    val name = raw?.trim()?.uppercase().orEmpty()
    require(name.isNotEmpty()) { "Missing --source" }
    return MangaParserSource.entries.find { it.name.equals(name, ignoreCase = true) }
        ?: error("Unknown source: $name")
}

private fun seedManga(
    source: MangaParserSource,
    opts: Map<String, String>,
    url: String,
    title: String,
): Manga {
    return Manga(
        id = opts["id"]?.toLongOrNull() ?: url.hashCode().toLong(),
        title = title,
        altTitles = emptySet(),
        url = url,
        publicUrl = opts["public-url"].orEmpty(),
        rating = -1f,
        contentRating = null,
        coverUrl = opts["cover"],
        tags = emptySet(),
        state = null,
        authors = emptySet(),
        largeCoverUrl = null,
        description = null,
        chapters = null,
        source = source,
    )
}

private fun mangaToJson(manga: Manga, includeChapters: Boolean = false): JSONObject {
    val json = JSONObject()
        .put("id", manga.id.toString())
        .put("source", manga.source.name)
        .put("title", manga.title)
        .put("alternateTitles", JSONArray(manga.altTitles.toList()))
        .put("url", manga.url)
        .put("publicUrl", manga.publicUrl)
        .put("coverUrl", manga.coverUrl)
        .put("largeCoverUrl", manga.largeCoverUrl)
        .put("description", manga.description)
        .put("authors", JSONArray(manga.authors.toList()))
        .put("tags", JSONArray(manga.tags.map { it.title }))
        .put("state", manga.state?.name)
        .put("contentRating", manga.contentRating?.name)
        .put("rating", manga.rating.takeIf { it >= 0f })
    if (includeChapters) {
        val chapters = JSONArray()
        manga.chapters.orEmpty().forEachIndexed { index, chapter ->
            chapters.put(
                JSONObject()
                    .put("id", chapter.id.toString())
                    .put("url", chapter.url)
                    .put("title", chapter.title)
                    .put("number", chapter.number)
                    .put("sortIndex", index),
            )
        }
        json.put("chapters", chapters)
    }
    return json
}

private fun parseOptions(args: List<String>): Map<String, String> {
    val out = linkedMapOf<String, String>()
    var i = 0
    while (i < args.size) {
        val token = args[i]
        if (token.startsWith("--") && i + 1 < args.size) {
            out[token.removePrefix("--")] = args[i + 1]
            i += 2
        } else {
            i += 1
        }
    }
    return out
}
