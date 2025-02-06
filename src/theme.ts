import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.800',
      },
    },
  },
  components: {
    Container: {
      baseStyle: {
        maxW: 'container.xl',
        px: 4,
      },
    },
    FormControl: {
      baseStyle: {
        label: {
          fontSize: 'sm',
          fontWeight: 'medium',
          color: 'gray.700',
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            bg: 'white',
            borderColor: 'gray.200',
            _hover: {
              borderColor: 'gray.300',
            },
            _focus: {
              borderColor: 'blue.500',
              boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
            },
          },
        },
      },
    },
    Textarea: {
      variants: {
        outline: {
          bg: 'white',
          borderColor: 'gray.200',
          _hover: {
            borderColor: 'gray.300',
          },
          _focus: {
            borderColor: 'blue.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
          },
        },
      },
    },
  },
})

export default theme