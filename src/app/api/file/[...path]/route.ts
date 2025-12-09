import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import path from 'path'

// MIME 类型映射
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // 获取文件路径
    const filePath = params.path.join('/')

    // 安全检查：防止路径遍历攻击
    if (filePath.includes('..') || filePath.includes('~')) {
      return NextResponse.json(
        { error: '无效路径' },
        { status: 400 }
      )
    }

    // 只允许访问 uploads 目录
    if (!filePath.startsWith('uploads/')) {
      return NextResponse.json(
        { error: '禁止访问' },
        { status: 403 }
      )
    }

    // 构建完整文件路径
    const fullPath = path.join(process.cwd(), 'public', filePath)

    // 检查文件是否存在
    try {
      await stat(fullPath)
    } catch {
      return NextResponse.json(
        { error: '文件不存在' },
        { status: 404 }
      )
    }

    // 读取文件
    const fileBuffer = await readFile(fullPath)

    // 获取 MIME 类型
    const ext = path.extname(fullPath).toLowerCase()
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

    // 返回文件
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('File read error:', error)
    return NextResponse.json(
      { error: '读取文件失败' },
      { status: 500 }
    )
  }
}
