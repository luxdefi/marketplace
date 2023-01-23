import { setParams } from '@reservoir0x/reservoir-sdk'
import type { NextApiRequest, NextApiResponse } from 'next'
import supportedChains, { DefaultChain } from 'utils/chains'

// A proxy API endpoint to redirect all requests to `/api/reservoir/*` to
// MAINNET: https://api.reservoir.tools/{endpoint}/{query-string}
// RINKEBY: https://api-rinkeby.reservoir.tools/{endpoint}/{query-string}
// and attach the `x-api-key` header to the request. This way the
// Reservoir API key is not exposed to the client.

// https://nextjs.org/docs/api-routes/dynamic-api-routes#catch-all-api-routes
const proxy = async (req: NextApiRequest, res: NextApiResponse) => {
  const { query, body, method, headers: reqHeaders } = req
  const { slug } = query

  // Isolate the query object
  delete query.slug

  let endpoint: string = ''

  // convert the slug array into a path string: [a, b] -> 'a/b'
  if (typeof slug === 'string') {
    endpoint = slug
  } else {
    endpoint = (slug || ['']).join('/')
  }

  const chainPrefix = endpoint.split('/')[0]
  const chain =
    supportedChains.find((chain) => chain.routePrefix === chainPrefix) ||
    DefaultChain

  const url = new URL(endpoint.replace(chainPrefix, ''), chain.reservoirBaseUrl)
  setParams(url, query)

  // Redirect logo
  if (/reservoir.hub\/logo/.exec(url.href)) {
    res.redirect('https://i.seadn.io/gcs/files/9f3da7948bc4386d93117131dd525bf9.png?w=500&auto=format')
    return
  }

  if (endpoint.includes('redirect/')) {
    res.redirect(url.href)
    return
  }

  try {
    const options: RequestInit | undefined = {
      method,
    }

    const headers = new Headers()

    if (chain.apiKey) headers.set('x-api-key', chain.apiKey)

    if (typeof body === 'object') {
      headers.set('Content-Type', 'application/json')
      options.body = JSON.stringify(body)
    }

    if (
      reqHeaders['x-rkc-version'] &&
      typeof reqHeaders['x-rkc-version'] === 'string'
    ) {
      headers.set('x-rkc-version', reqHeaders['x-rkc-version'])
    }

    if (
      reqHeaders['x-rkui-version'] &&
      typeof reqHeaders['x-rkui-version'] === 'string'
    ) {
      headers.set('x-rkui-version', reqHeaders['x-rkui-version'])
    }

    options.headers = headers

    const response = await fetch(url.href, options)

    let data: any

    const contentType = response.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    if (!response.ok) throw data

    if (contentType?.includes('image/')) {
      res.setHeader('Content-Type', 'text/html')
      res.status(200).send(Buffer.from(data))
    } else {
      res.status(200).json(data)
    }
  } catch (error) {
    res.status(400).json(error)
  }
}

export default proxy
