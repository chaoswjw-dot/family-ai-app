import { NextRequest } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fs from 'fs'
import path from 'path'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const PROXY_URL = process.env.HTTPS_PROXY || 'http://192.168.50.2:7890'

export async function POST(request: NextRequest) {
  try {
    const { prompt, sourceImageUrl } = await request.json()

    if (!prompt) {
      return Response.json(
        { error: '请提供图片描述' },
        { status: 400 }
      )
    }

    // 创建代理 agent
    const proxyAgent = new HttpsProxyAgent(PROXY_URL)
    const nodeFetch = (await import('node-fetch')).default

    // 使用 Nano Banana Pro (gemini-3-pro-image-preview) 进行图片生成/编辑
    // 支持2K/4K输出、多图合成、文字渲染、角色一致性
    const model = 'gemini-3-pro-image-preview'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

    // 构建请求内容
    const parts: any[] = []

    // 如果有源图片，添加到请求中
    if (sourceImageUrl) {
      try {
        // sourceImageUrl 格式: /api/file/uploads/xxx.jpg 或 /uploads/xxx.jpg
        // 提取实际的文件路径
        let relativePath = sourceImageUrl
        if (relativePath.startsWith('/api/file/')) {
          relativePath = relativePath.replace('/api/file/', '')
        }
        const filePath = path.join(process.cwd(), 'public', relativePath)

        if (fs.existsSync(filePath)) {
          const imageBuffer = fs.readFileSync(filePath)
          const base64Image = imageBuffer.toString('base64')

          // 根据扩展名确定 MIME 类型
          const ext = path.extname(sourceImageUrl).toLowerCase()
          const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
          }
          const mimeType = mimeTypes[ext] || 'image/jpeg'

          parts.push({
            inlineData: {
              mimeType,
              data: base64Image,
            }
          })
        }
      } catch (err) {
        console.error('读取源图片失败:', err)
      }
    }

    // 添加文字提示
    parts.push({ text: prompt })

    const response = await nodeFetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts,
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        }
      }),
      agent: proxyAgent,
    })

    if (response.ok) {
      const data = await response.json() as any
      const responseParts = data.candidates?.[0]?.content?.parts

      if (responseParts) {
        for (const part of responseParts) {
          if (part.inlineData) {
            return Response.json({
              imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              model: 'nano-banana-pro',
            })
          }
        }
      }

      // 如果没有图片返回，可能是文字回复
      return Response.json(
        { error: '未能生成图片，请尝试不同的描述' },
        { status: 500 }
      )
    }

    // 解析错误信息
    const errorData = await response.json().catch(() => ({})) as any
    const errorMessage = errorData.error?.message || `API 错误 (${response.status})`
    console.error('Banana Pro error:', response.status, errorMessage)

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
