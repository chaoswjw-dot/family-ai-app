import { Conversation, Message } from './types'

const STORAGE_KEY = 'family-ai-conversations'

export function getConversations(): Conversation[] {
  if (typeof window === 'undefined') return []

  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveConversation(conversation: Conversation): void {
  if (typeof window === 'undefined') return

  const conversations = getConversations()
  const existingIndex = conversations.findIndex(c => c.id === conversation.id)

  if (existingIndex >= 0) {
    conversations[existingIndex] = conversation
  } else {
    conversations.unshift(conversation)
  }

  // 只保留最近50个会话
  const trimmed = conversations.slice(0, 50)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

export function deleteConversation(id: string): void {
  if (typeof window === 'undefined') return

  const conversations = getConversations()
  const filtered = conversations.filter(c => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

export function generateTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user')
  if (!firstUserMessage) return '新对话'

  const content = firstUserMessage.content
  // 截取前20个字符作为标题
  return content.length > 20 ? content.slice(0, 20) + '...' : content
}
