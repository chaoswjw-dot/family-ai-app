// 附件类型
export interface Attachment {
  id: string           // UUID
  type: 'image'        // 附件类型
  filename: string     // 原始文件名
  url: string          // 访问URL
  mimeType: string     // MIME类型
  size: number         // 文件大小(bytes)
  uploadedAt: number   // 上传时间戳
}

// 消息类型
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  imageUrl?: string           // 生成的图片 (保留)
  attachments?: Attachment[]  // 上传的附件 [NEW]
}

// 会话类型
export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

// 聊天请求
export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  conversationId?: string
}

// 图片生成请求
export interface ImageRequest {
  prompt: string
}

// 图片分析请求
export interface AnalyzeRequest {
  prompt: string
  imageUrl: string
}

// 上传响应
export interface UploadResponse {
  success: boolean
  attachment?: Attachment
  error?: string
}

// 分析响应
export interface AnalyzeResponse {
  success: boolean
  text?: string
  error?: string
}
