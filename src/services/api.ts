import axios from 'axios'
import md5 from 'crypto-js/md5'
import { v4 as uuidv4 } from 'uuid'

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
    'Content-Type': 'application/json'
  },
  timeout: 300000
})

const generateFuxiHeaders = (appId: string, appKey: string) => {
  const nonce = uuidv4().slice(0, 10)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const str2Sign = `appId=${appId}&nonce=${nonce}&timestamp=${timestamp}&appkey=${appKey}`
  const sign = md5(str2Sign).toString().toUpperCase()

  return {
    'appId': appId,
    'nonce': nonce,
    'timestamp': timestamp,
    'sign': sign,
    'version': 'v2'
  }
}

export const setApiKey = (apiKey: string) => {
  const baseUrl = api.defaults.baseURL;
  if (baseUrl?.includes('azure.com')) {
    api.defaults.headers.common['api-key'] = apiKey;
  } else if (baseUrl?.includes('danlu.netease.com')) {
    const [appId, appKey] = apiKey.split(':');
    const fuxiHeaders = generateFuxiHeaders(appId, appKey);
    Object.entries(fuxiHeaders).forEach(([key, value]) => {
      api.defaults.headers.common[key] = value;
    });
  } else {
    api.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
  }
}

export const setApiBaseUrl = (baseUrl: string) => {
  api.defaults.baseURL = baseUrl
}

export const sendMessage = async (
  messages: ChatMessage[],
  model: string = 'deepseek-chat',
  onStream?: (content: string, reasoningContent?: string) => void
): Promise<ChatResponse> => {
  const startTime = Date.now();
  console.log(`[${new Date().toLocaleString()}] 开始请求 DeepSeek API\n模型: ${model}\n输入消息:`, JSON.stringify(messages, null, 2));
  try {
    // 清理消息中的reasoning_content字段，确保历史消息中的思维链不会被拼接到下一轮对话
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
    // 根据API类型映射模型名称
    let mappedModel = model;
    if (api.defaults.baseURL?.includes('danlu.netease.com')) {
      mappedModel = model === 'deepseek-reasoner' ? 'deepseek-r1' : 'deepseek-v3';
    }

    if (onStream) {
      console.log('发起流式请求，URL:', api.defaults.baseURL);
      console.log('请求头:', api.defaults.headers);
      const endpoint = api.defaults.baseURL?.includes('danlu.netease.com') ? '/chat' : '/chat/completions';
      const response = await api.post(endpoint, {
        model: mappedModel,
        messages,
        stream: true,
        max_tokens: model === 'deepseek-reasoner' ? 4000 : 2000
      }, {
        responseType: 'text',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        validateStatus: function (status) {
          if (status >= 400) {
            console.error('API请求失败，状态码:', status);
          }
          return status >= 200 && status < 500;
        },
        maxRedirects: 5
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
          // 处理伏羲API的响应格式
          let delta: StreamDelta = {}
          if (api.defaults.baseURL?.includes('danlu.netease.com')) {
            // 伏羲API的响应格式
            if (data.detail?.choices?.[0]?.message) {
              delta.content = data.detail.choices[0].message.content
              if (data.detail.choices[0].message.reasoning_content) {
                delta.reasoning_content = data.detail.choices[0].message.reasoning_content
              }
            }
          } else {
            // 处理Azure API和标准API的响应格式
            delta = data.choices?.[0]?.delta || data.delta || {}
          }
          
          if (delta.content) {
            content += delta.content
            onStream(delta.content, undefined)
          }
          if (delta.reasoning_content) {
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
      console.log(`[${new Date().toLocaleString()}] DeepSeek API 流式请求完成\n耗时: ${endTime - startTime}ms\n输出结果:`, JSON.stringify(response_data, null, 2));
      return response_data
    } else {
      const endpoint = api.defaults.baseURL?.includes('danlu.netease.com') ? '/chat' : '/chat/completions';
      const response = await api.post(endpoint, {
        model: mappedModel,
        messages,
        max_tokens: model === 'deepseek-reasoner' ? 4000 : 2000
      })
      const response_data = api.defaults.baseURL?.includes('danlu.netease.com') ? response.data.detail : response.data;
      const endTime = Date.now();
      console.log(`[${new Date().toLocaleString()}] DeepSeek API 请求完成\n耗时: ${endTime - startTime}ms\n输出结果:`, JSON.stringify(response_data, null, 2));
      return response_data;
    }
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

export type { ChatMessage, ChatResponse }