import { groupSearchResults, normalizeQuery } from './normalize'
import type {
  DiscoverySearchReport,
  MangaProvider,
  ProviderSearchOutcome,
} from './types'

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_CONCURRENCY = 4
const PROVIDER_TIMEOUT_MS: Record<string, number> = {
  // Persistent JVM bridge + parallel source fan-out.
  kotatsu: 25_000,
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let index = 0

  async function run() {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await worker(items[current])
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  await Promise.all(runners)
  return results
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Search cancelled', 'AbortError'))
      return
    }

    const timer = window.setTimeout(() => {
      reject(new DOMException('Provider timed out', 'TimeoutError'))
    }, timeoutMs)

    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Search cancelled', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })

    promise
      .then((value) => {
        window.clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(value)
      })
      .catch((error: unknown) => {
        window.clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(error)
      })
  })
}

export async function searchProviders(options: {
  query: string
  providers: MangaProvider[]
  signal?: AbortSignal
  timeoutMs?: number
  concurrency?: number
}): Promise<DiscoverySearchReport> {
  const query = normalizeQuery(options.query)
  const startedAt = new Date().toISOString()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY

  if (!query) {
    return {
      query,
      startedAt,
      finishedAt: new Date().toISOString(),
      outcomes: [],
      groups: [],
      cancelled: false,
    }
  }

  const searchable = options.providers.filter((provider) => provider.info.capabilities.search)

  const outcomes = await mapPool(searchable, concurrency, async (provider) => {
    const started = performance.now()
    const providerTimeoutMs = PROVIDER_TIMEOUT_MS[provider.info.id] ?? timeoutMs
    const outcome: ProviderSearchOutcome = {
      providerId: provider.info.id,
      providerName: provider.info.name,
      ok: false,
      results: [],
      durationMs: 0,
    }

    try {
      if (options.signal?.aborted) {
        throw new DOMException('Search cancelled', 'AbortError')
      }
      const results = await withTimeout(
        provider.search(query, { signal: options.signal, timeoutMs: providerTimeoutMs }),
        providerTimeoutMs,
        options.signal,
      )
      outcome.ok = true
      outcome.results = results
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const name = error instanceof Error ? error.name : ''
      outcome.cancelled = name === 'AbortError' || /cancel/i.test(message)
      outcome.timedOut = name === 'TimeoutError' || /timed out/i.test(message)
      outcome.error = message
    } finally {
      outcome.durationMs = Math.round(performance.now() - started)
    }

    return outcome
  })

  const cancelled = Boolean(options.signal?.aborted) || outcomes.some((item) => item.cancelled)
  const combined = outcomes.flatMap((item) => (item.ok ? item.results : []))
  const capabilityLookup = Object.fromEntries(
    searchable.map((provider) => [provider.info.id, provider.info.capabilities]),
  )

  return {
    query,
    startedAt,
    finishedAt: new Date().toISOString(),
    outcomes,
    groups: groupSearchResults(combined, capabilityLookup),
    cancelled,
  }
}
