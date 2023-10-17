import figlet from 'figlet'
import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

const app = new Hono()
app.use('*', prettyJSON())
app.use('*', secureHeaders())
// app.use('*', logger())
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const end = Date.now()
  c.res.headers.set('X-Response-Time', `${end - start}`)
})

app.onError((err, c) => {
  console.error(`${err}`)
  return c.text('Custom Error Message', 500)
})

const sign =
  figlet.textSync('PII API', {
    horizontalLayout: 'fitted',
  }) + '\nMade for Voiceflow | Powered by Microsoft Presidio\n'

console.log(sign)

app.get('/', (c) => {
  return c.text(sign)
})

app.post('/anonymize', async (c) => {
  try {
    const body = await c.req.json()
    const analyzer_results = await analyze(body.text, body.language || 'en')
    const anonymizer_results = await anonymize(
      body.text,
      analyzer_results,
      body.anonymizers,
      body.score || null,
      body.exclude || null
    )
    return c.json(anonymizer_results, 200)
  } catch (error) {
    console.log(error.message)
    return c.json({ error: error.message }, 400)
  }
})

async function analyze(text, language) {
  let url = Bun.env.ANALYZE_ENDPOINT
  let options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  }

  const response = await fetch(url, options)
  if (!response.ok) {
    const errorData = await response.json()
    console.error(
      `Analyze failed with status: ${response.status}, message: ${errorData.error}`
    )
    throw new Error(errorData.error)
  }
  return response.json()
}

async function anonymize(text, analyzer_results, anonymizers, score, exclude) {
  let url = Bun.env.ANONYMIZE_ENDPOINT

  score = score || Bun.env.SCORE
  if (exclude && exclude.length > 0) {
    exclude = exclude.map((item) => item.toLowerCase()) || []
  } else {
    exclude = []
  }

  analyzer_results = analyzer_results.filter((item) => {
    let entityText = text.substring(item.start, item.end).toLowerCase()
    return item.score >= score && !exclude.includes(entityText)
  })
  let body = anonymizers
    ? { text, analyzer_results, anonymizers }
    : { text, analyzer_results }

  let options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
  const response = await fetch(url, options)
  if (!response.ok) {
    const errorData = await response.json()
    console.error(
      `Anonymize failed with status: ${response.status}, message: ${errorData.error}`
    )
    throw new Error(errorData.error)
  }
  return response.json()
}

export default {
  port: Bun.env.PORT || 3006,
  fetch: app.fetch,
}
console.log(`Presidio API listening on port: ${Bun.env.PORT}\n\n`)
