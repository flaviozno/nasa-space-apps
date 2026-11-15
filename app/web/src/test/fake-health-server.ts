import type { HealthFetcher } from '@/lib/api'

/** Stands in for the backends' `/health` endpoints in tests. */
export class FakeHealthServer {
  private readonly responses = new Map<string, Response | Error>()
  readonly requestedUrls: string[] = []

  respondOk(url: string, service: string): this {
    this.responses.set(url, Response.json({ service, status: 'ok' }))
    return this
  }

  respondStatus(url: string, status: number): this {
    this.responses.set(url, new Response(null, { status }))
    return this
  }

  failWith(url: string, error: Error): this {
    this.responses.set(url, error)
    return this
  }

  readonly fetch: HealthFetcher = async (url) => {
    this.requestedUrls.push(url)
    const response = this.responses.get(url)
    if (response === undefined) throw new Error(`FakeHealthServer: no response for url=${url}`)
    if (response instanceof Error) throw response
    return response
  }
}
