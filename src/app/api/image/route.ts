import { NextRequest } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const PROXY_URL = process.env.HTTPS_PROXY || 'http://192.168.50.2:7890'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return Response.json(
        { error: '请提供图片描述' },
        { status: 400 }
      )
    }

    // 创建代理 agent
    const proxyAgent = new HttpsProxyAgent(PROXY_URL)
    const nodeFetch = (await import('node-fetch')).default

    // 使用 Gemini 3 Pro Image (Nano Banana Pro)
    // 新一代图像生成，支持推理+精细编辑+文本排版+2K-4K分辨率
    const model = 'gemini-3-pro-image-preview'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

    const response = await nodeFetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        }
      }),
      agent: proxyAgent,
    })

    if (response.ok) {
      const data = await response.json() as any
      const parts = data.candidates?.[0]?.content?.parts

      if (parts) {
        for (const part of parts) {
          if (part.inlineData) {
            return Response.json({
              imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              model: 'gemini-3-pro-image',
            })
          }
        }
      }
    }

    // 解析错误信息
    const errorData = await response.json().catch(() => ({})) as any
    const errorMessage = errorData.error?.message || `API 错误 (${response.status})`
    console.error('Gemini 3 Pro Image error:', response.status, errorMessage)

    return Response.json(
      { error: `图片生成失败: ${errorMessage}` },
      { status: 500 }
    )

  } catch (error: any) {
    console.error('Image generation error:', error)
    return Response.json(
      { error: '图片生成失败: ' + (error.message || '未知错误') },
      { status: 500 }
    )
  }
}
