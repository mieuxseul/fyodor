package org.koitharu.kotatsu.dl

import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.koitharu.kotatsu.dl.parsers.MangaLoaderContextImpl
import org.koitharu.kotatsu.parsers.model.Manga
import org.koitharu.kotatsu.parsers.model.MangaListFilter
import org.koitharu.kotatsu.parsers.model.MangaParserSource
import org.koitharu.kotatsu.parsers.model.RATING_UNKNOWN
import org.koitharu.kotatsu.parsers.model.SortOrder
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.io.PrintWriter
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * JSON-lines bridge for Fyodor.
 *
 * One request JSON object per stdin line → one response JSON object on stdout.
 * GPL-3.0 (inherits kotatsu-parsers / kotatsu-dl).
 */
fun main(args: Array<String>) {
	if (args.isNotEmpty() && args[0] != "serve") {
		System.err.println("Usage: kotatsu-bridge serve")
		kotlin.system.exitProcess(2)
	}
	// Always speak UTF-8 on the wire — Windows defaults to a legacy code page and
	// source titles (CJK, etc.) would break Rust's UTF-8 stdout reader otherwise.
	val out = PrintWriter(OutputStreamWriter(System.out, Charsets.UTF_8), true)
	val context = MangaLoaderContextImpl()
	val reader = BufferedReader(InputStreamReader(System.`in`, Charsets.UTF_8))
	while (true) {
		val line = reader.readLine() ?: break
		if (line.isBlank()) continue
		val response = try {
			handle(context, JSONObject(line))
		} catch (t: Throwable) {
			JSONObject()
				.put("id", tryParseId(line))
				.put("ok", false)
				.put("error", t.message ?: t::class.java.simpleName)
		}
		out.println(response.toString())
		out.flush()
	}
}

private fun tryParseId(line: String): Any? =
	try {
		JSONObject(line).opt("id")
	} catch (_: Throwable) {
		null
	}

private fun handle(context: MangaLoaderContextImpl, req: JSONObject): JSONObject {
	val id = req.opt("id")
	val op = req.getString("op")
	val out = JSONObject().put("id", id).put("ok", true)
	return when (op) {
		"ping" -> out.put("pong", true)
		"list_sources" -> out.put("sources", listSources(context))
		"search" -> out.put("results", search(context, req))
		"search_many" -> searchMany(context, req, out)
		"details" -> out.put("details", details(context, req))
		"chapters" -> out.put("chapters", chapters(context, req))
		"pages" -> out.put("pages", pages(context, req))
		else -> out.put("ok", false).put("error", "Unknown op: $op")
	}
}

private fun listSources(context: MangaLoaderContextImpl): JSONArray {
	val arr = JSONArray()
	for (source in MangaParserSource.entries) {
		val parser = try {
			context.newParserInstance(source)
		} catch (_: Throwable) {
			null
		}
		arr.put(
			JSONObject()
				.put("name", source.name)
				.put("title", source.title)
				.put("locale", source.locale)
				.put("contentType", source.contentType.name)
				.put("broken", source.isBroken)
				.put("domain", parser?.domain ?: JSONObject.NULL),
		)
	}
	return arr
}

private fun resolveSource(name: String): MangaParserSource {
	return MangaParserSource.entries.firstOrNull { it.name.equals(name, ignoreCase = true) }
		?: error("Unknown source: $name")
}

private fun search(context: MangaLoaderContextImpl, req: JSONObject): JSONArray {
	val source = resolveSource(req.getString("source"))
	val query = req.getString("query")
	val limit = req.optInt("limit", 24).coerceIn(1, 50)
	return searchSource(context, source, query, limit)
}

/**
 * Parallel multi-source search with a hard per-source wall clock.
 * Uses dedicated threads (not Dispatchers.IO) so Future.get(timeout) cannot deadlock
 * the coroutine pool while parsers do blocking HTTP.
 */
private fun searchMany(context: MangaLoaderContextImpl, req: JSONObject, out: JSONObject): JSONObject {
	val query = req.getString("query")
	val limit = req.optInt("limit", 8).coerceIn(1, 30)
	val timeoutMs = req.optLong("timeoutMs", 10_000L).coerceIn(2_000L, 30_000L)
	val sourcesJson = req.optJSONArray("sources") ?: JSONArray()
	val sourceNames = buildList {
		for (i in 0 until sourcesJson.length()) {
			val name = sourcesJson.optString(i).trim()
			if (name.isNotEmpty()) add(name)
		}
	}.distinct().take(12)

	val results = JSONArray()
	val errors = JSONArray()
	if (sourceNames.isEmpty()) {
		return out.put("results", results).put("errors", errors.put("No sources provided"))
	}

	val poolSize = sourceNames.size.coerceAtMost(4)
	val pool = Executors.newFixedThreadPool(poolSize) { runnable ->
		Thread(runnable, "kotatsu-search").apply { isDaemon = true }
	}
	try {
		val futures = sourceNames.map { sourceName ->
			sourceName to pool.submit<Triple<String, JSONArray, String?>> {
				try {
					val source = resolveSource(sourceName)
					Triple(sourceName, searchSource(context, source, query, limit), null)
				} catch (error: Throwable) {
					Triple(sourceName, JSONArray(), error.message ?: error::class.java.simpleName)
				}
			}
		}
		// Shared deadline. Do NOT use invokeAll(timeout): it waits for interrupted
		// tasks to finish, and Kotatsu parsers often ignore thread interrupts.
		val deadlineNanos = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs)
		for ((sourceName, future) in futures) {
			val remainingMs = TimeUnit.NANOSECONDS.toMillis(deadlineNanos - System.nanoTime())
			if (remainingMs <= 0L) {
				future.cancel(true)
				errors.put("$sourceName: timeout after ${timeoutMs}ms")
				continue
			}
			try {
				val (_, hits, error) = future.get(remainingMs, TimeUnit.MILLISECONDS)
				for (i in 0 until hits.length()) {
					results.put(hits.getJSONObject(i))
				}
				if (error != null) errors.put("$sourceName: $error")
			} catch (_: java.util.concurrent.TimeoutException) {
				future.cancel(true)
				errors.put("$sourceName: timeout after ${timeoutMs}ms")
			} catch (error: Throwable) {
				val root = generateSequence(error) { it.cause }.last()
				errors.put("$sourceName: ${root.message ?: "search failed"}")
			}
		}
	} finally {
		// Abandon hung parser threads; daemon workers will die with the process.
		pool.shutdownNow()
	}
	return out.put("results", results).put("errors", errors)
}

private fun searchSource(
	context: MangaLoaderContextImpl,
	source: MangaParserSource,
	query: String,
	limit: Int,
): JSONArray {
	val parser = context.newParserInstance(source)
	val order = parser.availableSortOrders.firstOrNull() ?: SortOrder.POPULARITY
	val list = runBlocking {
		parser.getList(0, order, MangaListFilter(query = query))
	}.take(limit)
	val arr = JSONArray()
	for (manga in list) {
		arr.put(mangaToJson(manga, source.name))
	}
	return arr
}

private fun seedManga(context: MangaLoaderContextImpl, req: JSONObject): Pair<MangaParserSource, Manga> {
	val source = resolveSource(req.getString("source"))
	val url = req.getString("url")
	val title = req.optString("title", "Manga")
	val publicUrl = req.optString("publicUrl", "https://${context.newParserInstance(source).domain}$url")
	val id = req.optLong("mangaId", url.hashCode().toLong())
	val cover = req.optString("coverUrl").ifBlank { null }
	val manga = Manga(
		id = id,
		title = title,
		altTitles = emptySet(),
		url = url,
		publicUrl = publicUrl,
		rating = RATING_UNKNOWN,
		contentRating = null,
		coverUrl = cover,
		tags = emptySet(),
		state = null,
		authors = emptySet(),
		source = source,
	)
	return source to manga
}

private fun details(context: MangaLoaderContextImpl, req: JSONObject): JSONObject {
	val (source, seed) = seedManga(context, req)
	val parser = context.newParserInstance(source)
	val manga = runBlocking { parser.getDetails(seed) }
	return mangaToJson(manga, source.name)
		.put("description", manga.description)
		.put("largeCoverUrl", manga.largeCoverUrl)
		.put("authors", JSONArray(manga.authors.toList()))
		.put("chapterCount", manga.chapters?.size ?: 0)
}

private fun chapters(context: MangaLoaderContextImpl, req: JSONObject): JSONArray {
	val (source, seed) = seedManga(context, req)
	val parser = context.newParserInstance(source)
	val manga = runBlocking { parser.getDetails(seed) }
	val arr = JSONArray()
	manga.chapters.orEmpty().forEachIndexed { index, ch ->
		arr.put(
			JSONObject()
				.put("id", ch.id.toString())
				.put("url", ch.url)
				.put("title", ch.title ?: "Chapter ${ch.number}")
				.put("number", ch.number.takeIf { it > 0 })
				.put("scanlator", ch.scanlator)
				.put("branch", ch.branch)
				.put("uploadDate", ch.uploadDate.takeIf { it > 0 })
				.put("sortIndex", index),
		)
	}
	return arr
}

private fun pages(context: MangaLoaderContextImpl, req: JSONObject): JSONArray {
	val source = resolveSource(req.getString("source"))
	val parser = context.newParserInstance(source)
	val chapterUrl = req.getString("chapterUrl")
	val chapterId = req.optLong("chapterId", chapterUrl.hashCode().toLong())
	val mangaUrl = req.optString("mangaUrl", "")
	val chapterTitle = req.optString("title").ifBlank { null }
	val chapter = org.koitharu.kotatsu.parsers.model.MangaChapter(
		id = chapterId,
		title = chapterTitle,
		number = req.optDouble("number", 0.0).toFloat(),
		volume = 0,
		url = chapterUrl,
		scanlator = null,
		uploadDate = 0L,
		branch = null,
		source = source,
	)
	// Some parsers ignore manga linkage on getPages; pass chapter only.
	val pages = runBlocking { parser.getPages(chapter) }
	val arr = JSONArray()
	for (page in pages) {
		val direct = runBlocking {
			try {
				parser.getPageUrl(page)
			} catch (_: Throwable) {
				page.url
			}
		}
		arr.put(
			JSONObject()
				.put("id", page.id.toString())
				.put("url", page.url)
				.put("preview", page.preview)
				.put("imageUrl", direct),
		)
	}
	// silence unused
	mangaUrl.hashCode()
	return arr
}

private fun mangaToJson(manga: Manga, sourceName: String): JSONObject =
	JSONObject()
		.put("source", sourceName)
		.put("mangaId", manga.id)
		.put("title", manga.title)
		.put("altTitles", JSONArray(manga.altTitles.toList()))
		.put("url", manga.url)
		.put("publicUrl", manga.publicUrl)
		.put("coverUrl", manga.coverUrl)
		.put("largeCoverUrl", manga.largeCoverUrl)
		.put("description", manga.description)
		.put("rating", manga.rating.takeIf { manga.hasRating })
		.put("state", manga.state?.name)
		.put("isAdult", manga.contentRating?.name == "ADULT")
		.put("authors", JSONArray(manga.authors.toList()))
		.put("genres", JSONArray(manga.tags.map { it.title }))
		.put("chapterCount", manga.chapters?.size)
