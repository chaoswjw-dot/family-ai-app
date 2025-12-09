import { NextRequest } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const PROXY_URL = process.env.HTTPS_PROXY || 'http://192.168.50.6:7890'

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: '消息格式错误' },
        { status: 400 }
      )
    }

    if (!GEMINI_API_KEY) {
      return Response.json(
        { error: 'API Key 未配置' },
        { status: 500 }
      )
    }

    // 创建代理 agent
    const proxyAgent = new HttpsProxyAgent(PROXY_URL)
    const nodeFetch = (await import('node-fetch')).default

    // 转换消息格式为 Gemini 格式
    const geminiMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))

    // 添加系统指令
    const systemInstruction = '你是一个友好的家庭AI助手。请用中文回答问题，保持回答简洁有帮助。'

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

    const response = await nodeFetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: geminiMessages,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
      agent: proxyAgent,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error:', response.status, errorText)
      return Response.json(
        { error: '服务暂时不可用' },
        { status: response.status }
      )
    }

    const data = await response.json() as any
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // 返回 SSE 格式（与前端兼容）
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json(
      { error: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    )
  }
}
