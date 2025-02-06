import axios from 'axios'

const API_BASE_URL = 'https://api.deepseek.com/v1'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string
}

interface ChatResponse {
  id: string
  choices: Array<{
    message: {
      role: 'assistant'
      content: string
      reasoning_content?: string
    }
    finish_reason: string
  }>
}

interface StreamDelta {
  content?: string
  reasoning_content?: string
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000,
})

export const setApiKey = (apiKey: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`
}

export const sendMessage = async (
  messages: ChatMessage[],
  model: string = 'deepseek-chat',
  onStream?: (content: string, reasoningContent?: string) => void
): Promise<ChatResponse> => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] 开始请求 DeepSeek API\n模型: ${model}\n输入消息:`, JSON.stringify(messages, null, 2));
  try {
    // 清理消息中的reasoning_content字段
    const cleanedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // 对于deepseek-reasoner模型，确保消息序列是交替的
    if (model === 'deepseek-reasoner') {
      const processedMessages: ChatMessage[] = [];
      let lastRole: string | null = null;
      
      for (const msg of cleanedMessages) {
        if (lastRole === msg.role && msg.role !== 'system') {
          // 如果连续两条消息角色相同（除了system角色），插入一个空的对话
          processedMessages.push({
            role: msg.role === 'user' ? 'assistant' : 'user',
            content: '继续'
          });
        }
        processedMessages.push(msg);
        lastRole = msg.role;
      }
      messages = processedMessages;
    } else {
      messages = cleanedMessages;
    }
    if (onStream) {
      const response = await api.post('/chat/completions', {
        model,
        messages,
        stream: true,
        max_tokens: model === 'deepseek-reasoner' ? 4000 : 2000
      }, {
        responseType: 'text',
        headers: {
          'Accept': 'text/event-stream'
        }
      })

      let content = ''
      let reasoningContent = ''
      const lines = response.data.split('\n')

      for (const line of lines) {
        if (line.trim() === '' || line === 'data: [DONE]') continue
        
        // 过滤掉keep-alive消息
        if (line.includes(': keep-alive')) continue
        
        const cleanedLine = line.replace(/^data: /, '')
        if (!cleanedLine) continue
        
        try {
          const data = JSON.parse(cleanedLine)
          const delta: StreamDelta = data.choices?.[0]?.delta || {}
          
          if (delta.content !== undefined) {
            content += delta.content
            onStream(delta.content, undefined)
          }
          if (delta.reasoning_content !== undefined) {
            reasoningContent += delta.reasoning_content
            onStream(undefined, delta.reasoning_content)
          }
        } catch (e) {
          console.error('Error parsing stream line:', cleanedLine, e)
        }
      }



      const response_data = {
        id: 'stream-response',
        choices: [{
          message: {
            role: 'assistant',
            content,
            reasoning_content: reasoningContent
          },
          finish_reason: 'stop'
        }]
      };
      const endTime = Date.now();
      console.log(`[${new Date().toISOString()}] DeepSeek API 流式请求完成\n耗时: ${endTime - startTime}ms\n输出结果:`, JSON.stringify(response_data, null, 2));
      return response_data
    } else {
      const response = await api.post('/chat/completions', {
        model,
        messages,
        max_tokens: model === 'deepseek-reasoner' ? 4000 : 2000
      })
      const response_data = response.data;
      const endTime = Date.now();
      console.log(`[${new Date().toISOString()}] DeepSeek API 请求完成\n耗时: ${endTime - startTime}ms\n输出结果:`, JSON.stringify(response_data, null, 2));
      return response_data;
    }
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

export type { ChatMessage, ChatResponse }