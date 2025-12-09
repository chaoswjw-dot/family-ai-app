import { NextRequest } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

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
        let base64Image: string | null = null
        let mimeType = 'image/png'

        // 检查是否是 base64 格式（之前生成的图片）
        if (sourceImageUrl.startsWith('data:')) {
          // 解析 data URL: data:image/png;base64,xxxxx
          const matches = sourceImageUrl.match(/^data:([^;]+);base64,(.+)$/)
          if (matches) {
            mimeType = matches[1]
            base64Image = matches[2]
          }
        } else {
          // 文件路径格式: /api/file/uploads/xxx.jpg 或 /uploads/xxx.jpg
          let relativePath = sourceImageUrl
          if (relativePath.startsWith('/api/file/')) {
            relativePath = relativePath.replace('/api/file/', '')
          }
          if (relativePath.startsWith('/')) {
            relativePath = relativePath.slice(1)
          }
          const filePath = path.join(process.cwd(), 'public', relativePath)

          if (fs.existsSync(filePath)) {
            const imageBuffer = fs.readFileSync(filePath)
            base64Image = imageBuffer.toString('base64')

            // 根据扩展名确定 MIME 类型
            const ext = path.extname(filePath).toLowerCase()
            const mimeTypes: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
            }
            mimeType = mimeTypes[ext] || 'image/jpeg'
          }
        }

        if (base64Image) {
          parts.push({
            inlineData: {
              mimeType,
              data: base64Image,
            }
          })
          console.log('源图片已添加, mimeType:', mimeType, 'base64长度:', base64Image.length)
        }
      } catch (err) {
        console.error('读取源图片失败:', err)
      }
    }

    // 添加文字提示
    parts.push({ text: prompt })

    console.log('发送请求到 Gemini, parts 数量:', parts.length)

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
            // 保存生成的图片到文件
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'generated', String(year), month)

            // 确保目录存在
            fs.mkdirSync(uploadDir, { recursive: true })

            // 确定文件扩展名
            const mimeType = part.inlineData.mimeType || 'image/png'
            const extMap: Record<string, string> = {
              'image/png': '.png',
              'image/jpeg': '.jpg',
              'image/gif': '.gif',
              'image/webp': '.webp',
            }
            const ext = extMap[mimeType] || '.png'

            // 生成文件名并保存
            const filename = `${uuidv4()}${ext}`
            const filePath = path.join(uploadDir, filename)
            const imageBuffer = Buffer.from(part.inlineData.data, 'base64')
            fs.writeFileSync(filePath, imageBuffer)

            // 返回文件 URL
            const fileUrl = `/api/file/uploads/generated/${year}/${month}/${filename}`

            console.log('图片已保存:', filePath)

            return Response.json({
              imageUrl: fileUrl,
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
