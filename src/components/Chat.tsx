import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  useToast,
  Textarea,
  FormControl,
  FormLabel,
  IconButton,
  useDisclosure,
  Collapse,
  Select,
} from '@chakra-ui/react'
import { ChatMessage, sendMessage, setApiKey, setApiBaseUrl } from '../services/api'
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons'

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState<string>('')
  const [streamingReasoningMessage, setStreamingReasoningMessage] = useState<string>('')
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKeyState] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('deepseek-chat')
  const [isStreaming, setIsStreaming] = useState(false)
  const [apiUrl, setApiUrl] = useState('https://api.deepseek.com/v1')
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: true })
  const toast = useToast()

  useEffect(() => {
    const savedApiKey = localStorage.getItem('apiKey')
    const savedSystemPrompt = localStorage.getItem('systemPrompt')
    const savedModel = localStorage.getItem('model')
    const savedApiUrl = localStorage.getItem('apiUrl')
    if (savedApiKey) {
      setApiKeyState(savedApiKey)
      setApiKey(savedApiKey)
    }
    if (savedSystemPrompt) {
      setSystemPrompt(savedSystemPrompt)
    }
    if (savedModel) {
      setModel(savedModel)
    }
    if (savedApiUrl) {
      setApiUrl(savedApiUrl)
      setApiBaseUrl(savedApiUrl)
    }
  }, [])

  const handleApiKeyChange = (value: string) => {
    setApiKeyState(value)
    setApiKey(value)
    localStorage.setItem('apiKey', value)
  }

  const handleSystemPromptChange = (value: string) => {
    setSystemPrompt(value)
    localStorage.setItem('systemPrompt', value)
  }

  const handleModelChange = (value: string) => {
    setModel(value)
    localStorage.setItem('model', value)
  }

  const handleSend = async () => {
    if (!input.trim()) return
    if (!apiKey) {
      toast({
        title: '请设置API Key',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
    }

    setMessages([...messages, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // 对于 deepseek-reasoner 模型，确保消息序列是交替的
      let processedMessages = []
      if (systemPrompt) {
        processedMessages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      // 添加历史消息
      for (const msg of messages) {
        processedMessages.push(msg)
      }
      processedMessages.push(userMessage)

      setStreamingMessage('')
      const response = await sendMessage(
        processedMessages,
        model,
        isStreaming ? (content, reasoningContent) => {
          if (content) {
            setStreamingMessage(prev => prev + content)
          }
          if (reasoningContent) {
            setStreamingReasoningMessage(prev => prev + reasoningContent)
          }
        } : undefined
      )
      const assistantMessage = response.choices[0].message
      setStreamingMessage('')
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      toast({
        title: '发送消息失败',
        description: '请检查网络连接或API密钥是否正确',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container h="100vh" py={4}>
      <VStack h="full" spacing={4}>
        <Box w="full">
          <HStack mb={2} justify="space-between">
            <Text fontSize="lg" fontWeight="bold">配置</Text>
            <IconButton
              aria-label="Toggle config"
              icon={isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
              onClick={onToggle}
              variant="ghost"
              size="sm"
            />
          </HStack>
          <Collapse in={isOpen}>
            <VStack spacing={4} p={4} bg="white" borderRadius="md" boxShadow="sm" border="1px" borderColor="gray.200">
              <FormControl>
                <FormLabel>API URL</FormLabel>
                <Select
                  value={apiUrl}
                  onChange={(e) => {
                    setApiUrl(e.target.value)
                    setApiBaseUrl(e.target.value)
                    localStorage.setItem('apiUrl', e.target.value)
                    // 清空API Key
                    handleApiKeyChange('')
                  }}
                  placeholder="请选择或输入API URL"
                  size="md"
                >
                  <option value="https://api.deepseek.com/v1">DeepSeek API</option>
                  <option value="https://DeepSeek-R1-yunxin.eastus.models.ai.azure.com">Azure API</option>
                  <option value="http://ai-text-service-test.apps-hangyan.danlu.netease.com/api/v2/text">伏羲 API</option>
                  <option value="custom">自定义</option>
                </Select>
                {apiUrl === 'custom' && (
                  <Input
                    mt={2}
                    value={apiUrl === 'custom' ? '' : apiUrl}
                    onChange={(e) => {
                      const value = e.target.value;
                      setApiUrl(value)
                      setApiBaseUrl(value)
                      localStorage.setItem('apiUrl', value)
                      handleApiKeyChange('')
                    }}
                    placeholder="请输入自定义API URL"
                    size="md"
                  />
                )}
              </FormControl>
              <FormControl>
                <FormLabel>API Key</FormLabel>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="请输入您的API Key"
                  size="md"
                />
              </FormControl>
              <FormControl>
                <FormLabel>系统Prompt</FormLabel>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => handleSystemPromptChange(e.target.value)}
                  placeholder="请输入系统Prompt"
                  rows={3}
                  size="md"
                  resize="vertical"
                />
              </FormControl>
              <FormControl>
                <FormLabel>模型</FormLabel>
                <Select
                  value={model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  size="md"
                >
                  <option value="deepseek-chat">DeepSeek Chat</option>
                  <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>流式响应</FormLabel>
                <Select
                  value={isStreaming ? 'true' : 'false'}
                  onChange={(e) => setIsStreaming(e.target.value === 'true')}
                  size="md"
                >
                  <option value="false">关闭</option>
                  <option value="true">开启</option>
                </Select>
              </FormControl>
            </VStack>
          </Collapse>
        </Box>
        <Box
          flex={1}
          w="full"
          bg="white"
          p={4}
          borderRadius="md"
          overflowY="auto"
          boxShadow="sm"
        >
          {messages.map((msg, index) => (
            <Box
              key={index}
              bg={msg.role === 'user' ? 'blue.50' : 'gray.50'}
              p={3}
              borderRadius="md"
              mb={2}
            >
              <Text>{msg.content}</Text>
            </Box>
          ))}
          {streamingMessage && (
            <Box
              bg="gray.50"
              p={3}
              borderRadius="md"
              mb={2}
            >
              <Text>{streamingMessage}</Text>
              {streamingReasoningMessage && (
                <Text mt={2} color="gray.600" fontSize="sm">
                  推理过程：{streamingReasoningMessage}
                </Text>
              )}
            </Box>
          )}
        </Box>
        <HStack w="full">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button
            colorScheme="blue"
            onClick={handleSend}
            isLoading={isLoading}
          >
            发送
          </Button>
        </HStack>
      </VStack>
    </Container>
  )
}