import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// 允许的文件类型
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
// 最大文件大小 10MB
const MAX_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    // 验证文件存在
    if (!file) {
      return NextResponse.json(
        { success: false, error: '请选择文件' },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '不支持的文件类型，仅支持 PNG, JPG, GIF, WebP' },
        { status: 400 }
      )
    }

    // 验证文件大小
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: '文件过大，最大支持 10MB' },
        { status: 400 }
      )
    }

    // 生成存储路径
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')

    // 获取文件扩展名
    const originalName = file.name
    const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg'
    const uuid = uuidv4()
    const filename = `${uuid}.${ext}`

    // 创建上传目录
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', String(year), month)
    await mkdir(uploadDir, { recursive: true })

    // 保存文件
    const filePath = path.join(uploadDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    // 生成访问URL（通过 API 路由访问，解决 standalone 模式下静态文件问题）
    const url = `/api/file/uploads/${year}/${month}/${filename}`

    // 返回成功响应
    return NextResponse.json({
      success: true,
      attachment: {
        id: uuid,
        type: 'image',
        filename: originalName,
        url,
        mimeType: file.type,
        size: file.size,
        uploadedAt: Date.now()
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { success: false, error: '上传失败，请稍后重试' },
      { status: 500 }
    )
  }
}
