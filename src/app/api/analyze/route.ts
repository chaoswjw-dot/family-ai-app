import { NextRequest } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fs from 'fs'
import path from 'path'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const PROXY_URL = process.env.HTTPS_PROXY || 'http://192.168.50.2:7890'

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageUrl } = await request.json()

    if (!imageUrl) {
      return Response.json(
        { success: false, error: '请提供图片' },
        { status: 400 }
      )
    }

    // 读取本地图片转为 base64
    const filePath = path.join(process.cwd(), 'public', imageUrl)

    if (!fs.existsSync(filePath)) {
      return Response.json(
        { success: false, error: '图片文件不存在' },
        { status: 404 }
      )
    }

    const imageBuffer = fs.readFileSync(filePath)
    const base64Image = imageBuffer.toString('base64')

    // 获取 MIME 类型
    const ext = imageUrl.split('.').pop()?.toLowerCase()
    const mimeTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    }
    const mimeType = mimeTypeMap[ext || ''] || 'image/jpeg'

    // 创建代理 agent
    const proxyAgent = new HttpsProxyAgent(PROXY_URL)
    const nodeFetch = (await import('node-fetch')).default

    // 使用 Banana Pro (Gemini 3 Pro Image) - 同时支持生成和理解
    const model = 'gemini-3-pro-image-preview'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

    const response = await nodeFetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt || '请用中文详细描述这张图片的内容，包括主要元素、场景、颜色等信息。' },
            {
              inlineData: {
                mimeType,
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      }),
      agent: proxyAgent,
    })

    if (response.ok) {
      const data = await response.json() as any
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (text) {
        return Response.json({ success: true, text })
      }
    }

    // 解析错误信息
    const errorData = await response.json().catch(() => ({})) as any
    const errorMessage = errorData.error?.message || `API 错误 (${response.status})`
    console.error('Gemini analyze error:', response.status, errorMessage)

    return Response.json(
      { success: false, error: `图片分析失败: ${errorMessage}` },
      { status: 500 }
    )

  } catch (error: any) {
    console.error('Analyze error:', error)
    return Response.json(
      { success: false, error: '图片分析失败: ' + (error.message || '未知错误') },
      { status: 500 }
    )
  }
}
