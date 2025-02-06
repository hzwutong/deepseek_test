import { ChakraProvider } from '@chakra-ui/react'
import theme from './theme'
import Chat from './components/Chat'

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Chat />
    </ChakraProvider>
  )
}

export default App
