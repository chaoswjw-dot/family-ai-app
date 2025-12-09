import { NextRequest } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const PROXY_URL = process.env.HTTPS_PROXY || 'http://192.168.50.6:7890'

// 统一使用 Gemini 3 Pro (Banana Pro) - 同时支持文字对话和图片生成/理解
const MODEL = 'gemini-3-pro-image-preview'

export async function POST(request: NextRequest) {
  try {
    const { messages, generateImage, analyzeImage, imageUrl } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: '消息格式错误' }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      return Response.json({ error: 'API Key 未配置' }, { status: 500 })
    }

    const proxyAgent = new HttpsProxyAgent(PROXY_URL)
    const nodeFetch = (await import('node-fetch')).default

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

    // 构建请求内容
    const parts: any[] = []

    // 如果有源图片(分析或编辑)，添加到请求
    if (imageUrl) {
      const base64Data = await loadImage(imageUrl)
      if (base64Data) {
        parts.push({ inlineData: base64Data })
      }
    }

    // 获取最后一条用户消息
    const lastMessage = messages[messages.length - 1]
    let userContent = lastMessage?.content || ''

    // 如果是分析图片且没有提示，使用默认提示
    if (analyzeImage && !userContent) {
      userContent = '请用中文详细描述这张图片的内容，包括主要元素、场景、颜色等信息。'
    }

    // 添加系统提示到用户消息
    const systemPrompt = '你是一个友好的家庭AI助手。请用中文回答问题，保持回答简洁有帮助。'
    parts.push({ text: `${systemPrompt}\n\n用户: ${userContent}` })

    // 配置生成参数
    const generationConfig: any = {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }

    // 如果是生成图片，添加图片输出模式
    if (generateImage) {
      generationConfig.responseModalities = ['TEXT', 'IMAGE']
    }

    const response = await nodeFetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig
      }),
      agent: proxyAgent,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as any
      const errorMessage = errorData.error?.message || `API 错误 (${response.status})`
      console.error('Gemini API Error:', response.status, errorMessage)
      return Response.json({ error: `请求失败: ${errorMessage}` }, { status: 500 })
    }

    const data = await response.json() as any
    const responseParts = data.candidates?.[0]?.content?.parts

    if (responseParts) {
      for (const part of responseParts) {
        // 如果返回图片
        if (part.inlineData && generateImage) {
          const savedUrl = await saveGeneratedImage(part.inlineData)
          if (savedUrl) {
            return Response.json({ imageUrl: savedUrl, model: 'gemini-3-pro' })
          }
        }
        // 如果返回文字
        if (part.text) {
          if (analyzeImage) {
            // 图片分析返回 JSON
            return Response.json({ success: true, text: part.text })
          }
          // 普通对话返回 SSE 格式
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`))
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
        }
      }
    }

    return Response.json({ error: '未能生成内容，请尝试不同的描述' }, { status: 500 })

  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json({ error: '服务暂时不可用，请稍后重试' }, { status: 500 })
  }
}

// 加载图片为 base64
async function loadImage(imageUrl: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    // base64 格式
    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        return { mimeType: matches[1], data: matches[2] }
      }
    }

    // 文件路径
    let relativePath = imageUrl
    if (relativePath.startsWith('/api/file/')) {
      relativePath = relativePath.replace('/api/file/', '')
    }
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.slice(1)
    }

    const filePath = path.join(process.cwd(), 'public', relativePath)
    if (fs.existsSync(filePath)) {
      const imageBuffer = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
      }
      return {
        mimeType: mimeTypes[ext] || 'image/jpeg',
        data: imageBuffer.toString('base64')
      }
    }
  } catch (err) {
    console.error('加载图片失败:', err)
  }
  return null
}

// 保存生成的图片
async function saveGeneratedImage(inlineData: { mimeType?: string; data: string }): Promise<string | null> {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'generated', String(year), month)

    fs.mkdirSync(uploadDir, { recursive: true })

    const mimeType = inlineData.mimeType || 'image/png'
    const extMap: Record<string, string> = {
      'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
    }
    const ext = extMap[mimeType] || '.png'
    const filename = `${uuidv4()}${ext}`
    const filePath = path.join(uploadDir, filename)

    fs.writeFileSync(filePath, Buffer.from(inlineData.data, 'base64'))
    console.log('图片已保存:', filePath)

    return `/api/file/uploads/generated/${year}/${month}/${filename}`
  } catch (err) {
    console.error('保存图片失败:', err)
    return null
  }
}
