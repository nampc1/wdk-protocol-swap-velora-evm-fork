import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import * as ethers from 'ethers'

import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '@wdk/wallet-evm'
import { WalletAccountEvmErc4337, WalletAccountReadOnlyEvmErc4337 } from '@wdk/wallet-evm-erc-4337'

const TOKEN_ADDRESS_1 = '0x1111111111111111111111111111111111111111'
const TOKEN_ADDRESS_2 = '0x2222222222222222222222222222222222222222'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const ABSTRACTED_ADDRESS = '0x120Ac3c0B46fBAf2e8452A23BD61a2Da9B139551'

const CHAIN_ID = 1

const EXPECTED_SWAP_RESULT = {
  hash: '0x1234567890',
  approvalHash: '0x1234567890',
  fee: 1000000,
  tokenInAmount: 1000000,
  tokenOutAmount: 1000
}

const SWAP_OPTIONS = {
  tokenIn: TOKEN_ADDRESS_1,
  tokenOut: TOKEN_ADDRESS_2,
  tokenInAmount: EXPECTED_SWAP_RESULT.tokenInAmount
}

const VELORA_SDK_MOCK = Promise.resolve({
  swap: {
    getRate: jest.fn().mockResolvedValue({
      srcToken: TOKEN_ADDRESS_1,
      destToken: TOKEN_ADDRESS_2,
      srcAmount: EXPECTED_SWAP_RESULT.tokenInAmount.toString(),
      destAmount: EXPECTED_SWAP_RESULT.tokenOutAmount.toString()
    }),
    buildTx: jest.fn().mockResolvedValue({
      to: '0x6a000f20005980200259b80c5102003040001068',
      data: '0x1234567890'
    })
  }
})

await jest.unstable_mockModule('ethers', async () => {
  return {
    ...ethers,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(CHAIN_ID) })
    }))
  }
})

const { default: ParaSwapProtocolEVM } = await import('../index.js')

describe('ParaSwapProtocolEVM', () => {
  let accountEvm
  let paraswapProtocolEvm

  let accountEvmErc4337
  let paraswapProtocolEvmErc4337

  describe('WalletAccountEvm', () => {
    beforeEach(() => {
      accountEvm = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", { provider: 'https://mock-rpc-url.com' })

      const sendTransactionFee = EXPECTED_SWAP_RESULT.fee / 2 // fee is halved because there are two transactions: approval and bridge

      accountEvm.quoteSendTransaction = jest.fn().mockResolvedValue({
        fee: sendTransactionFee
      })

      accountEvm.sendTransaction = jest.fn().mockImplementation((tx) => ({
        fee: sendTransactionFee,
        hash: tx.to === TOKEN_ADDRESS_1 ? EXPECTED_SWAP_RESULT.approvalHash : EXPECTED_SWAP_RESULT.hash
      }))

      paraswapProtocolEvm = new ParaSwapProtocolEVM(accountEvm)

      paraswapProtocolEvm._veloraSdkPromise = VELORA_SDK_MOCK
    })

    describe('quoteSwap', () => {
      test('should return the expected quote result', async () => {
        const qoute = await paraswapProtocolEvm.quoteSwap(SWAP_OPTIONS)

        expect(qoute.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(qoute.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(qoute.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw when tokenIn and tokenOut are equal', async () => {
        const INVALID_SWAP_OPTIOONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_1,
          tokenInAmount: EXPECTED_SWAP_RESULT.tokenInAmount
        }

        await expect(paraswapProtocolEvm.quoteSwap(INVALID_SWAP_OPTIOONS)).rejects.toThrow("'tokenIn' and 'tokenOut' cannot be equal.")
      })

      test('should throw when neither tokenInAmount nor tokenOutAmount is provided', async () => {
        const INVALID_SWAP_OPTIOONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2
        }

        await expect(paraswapProtocolEvm.quoteSwap(INVALID_SWAP_OPTIOONS)).rejects.toThrow("A valid 'tokenInAmount' or 'tokenOutAmount' must be passed.")
      })

      test('should throw when both tokenInAmount and tokenOutAmount are provided', async () => {
        const INVALID_SWAP_OPTIOONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2,
          tokenInAmount: EXPECTED_SWAP_RESULT.tokenInAmount,
          tokenOutAmount: EXPECTED_SWAP_RESULT.tokenOutAmount
        }

        await expect(paraswapProtocolEvm.quoteSwap(INVALID_SWAP_OPTIOONS)).rejects.toThrow("Cannot use both 'tokenInAmount' and 'tokenOutAmount' arguments.")
      })

      test('should work with tokenOutAmount provided', async () => {
        const SWAP_OPTIOONS_WITH_TOKEN_OUT_AMOUNT = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2,
          tokenOutAmount: EXPECTED_SWAP_RESULT.tokenOutAmount
        }

        const quote = await paraswapProtocolEvm.quoteSwap(SWAP_OPTIOONS_WITH_TOKEN_OUT_AMOUNT)

        expect(quote.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(quote.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(quote.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw if the account is not connected to a provider', async () => {
        const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")
        const usdt0ProtocolEvm = new ParaSwapProtocolEVM(account)

        await expect(usdt0ProtocolEvm.quoteSwap(SWAP_OPTIONS)).rejects.toThrow('The wallet must be connected to a provider to quote swap.')
      })
    })

    describe('swap', () => {
      test('should return the expected swap result', async () => {
        const result = await paraswapProtocolEvm.swap(SWAP_OPTIONS)

        expect(result.hash).toBe(EXPECTED_SWAP_RESULT.hash)
        expect(result.approvalHash).toBe(EXPECTED_SWAP_RESULT.approvalHash)
        expect(result.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(result.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(result.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw when tokenIn and tokenOut are equal', async () => {
        const INVALID_SWAP_OPTIONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_1,
          tokenInAmount: EXPECTED_SWAP_RESULT.tokenInAmount
        }

        await expect(paraswapProtocolEvm.swap(INVALID_SWAP_OPTIONS)).rejects.toThrow("'tokenIn' and 'tokenOut' cannot be equal.")
      })

      test('should throw when neither tokenInAmount nor tokenOutAmount is provided', async () => {
        const INVALID_SWAP_OPTIONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2
        }

        await expect(paraswapProtocolEvm.swap(INVALID_SWAP_OPTIONS)).rejects.toThrow("A valid 'tokenInAmount' or 'tokenOutAmount' must be passed.")
      })

      test('should throw when both tokenInAmount and tokenOutAmount are provided', async () => {
        const INVALID_SWAP_OPTIONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2,
          tokenInAmount: EXPECTED_SWAP_RESULT.tokenInAmount,
          tokenOutAmount: EXPECTED_SWAP_RESULT.tokenOutAmount
        }

        await expect(paraswapProtocolEvm.swap(INVALID_SWAP_OPTIONS)).rejects.toThrow("Cannot use both 'tokenInAmount' and 'tokenOutAmount' arguments.")
      })

      test('should swap with tokenOutAmount provided', async () => {
        const SWAP_OPTIONS_WITH_TOKEN_OUT_AMOUNT = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2,
          tokenOutAmount: EXPECTED_SWAP_RESULT.tokenOutAmount
        }

        const result = await paraswapProtocolEvm.swap(SWAP_OPTIONS_WITH_TOKEN_OUT_AMOUNT)

        expect(result.hash).toBe(EXPECTED_SWAP_RESULT.hash)
        expect(result.approvalHash).toBe(EXPECTED_SWAP_RESULT.approvalHash)
        expect(result.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(result.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(result.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw if the account is not connected to a provider', async () => {
        const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")
        const usdt0ProtocolEvm = new ParaSwapProtocolEVM(account)

        await expect(usdt0ProtocolEvm.swap(SWAP_OPTIONS)).rejects.toThrow('The wallet must be connected to a provider to swap.')
      })

      test('should throw when swapMaxFee is exceeded', async () => {
        const config = { swapMaxFee: EXPECTED_SWAP_RESULT.fee - 1 }

        await expect(paraswapProtocolEvm.swap(SWAP_OPTIONS, config)).rejects.toThrow('Exceeded maximum fee cost for swap operation.')
      })

      test('should work when swapMaxFee is not exceeded', async () => {
        const config = { swapMaxFee: EXPECTED_SWAP_RESULT.fee + 1 }

        const result = await paraswapProtocolEvm.swap(SWAP_OPTIONS, config)

        expect(result.hash).toBe(EXPECTED_SWAP_RESULT.hash)
        expect(result.approvalHash).toBe(EXPECTED_SWAP_RESULT.approvalHash)
        expect(result.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(result.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(result.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw if the account is read only', async () => {
        const readOnlyAccount = new WalletAccountReadOnlyEvm(ABSTRACTED_ADDRESS, { provider: 'https://mock-rpc-url.com' })

        const readOnlyProtocolEvm = new ParaSwapProtocolEVM(readOnlyAccount)

        await expect(readOnlyProtocolEvm.swap(SWAP_OPTIONS)).rejects.toThrow('Swap operation cannot be performed with a read-only account.')
      })
    })
  })

  describe('WalletAccountEvmErc4337', () => {
    beforeEach(() => {
      accountEvmErc4337 = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", { provider: 'https://mock-rpc-url.com', chainId: CHAIN_ID })

      accountEvmErc4337.quoteSendTransaction = jest.fn().mockResolvedValue({
        fee: EXPECTED_SWAP_RESULT.fee
      })

      accountEvmErc4337.sendTransaction = jest.fn().mockImplementation((tx) => ({
        fee: EXPECTED_SWAP_RESULT.fee,
        hash: EXPECTED_SWAP_RESULT.hash
      }))

      paraswapProtocolEvmErc4337 = new ParaSwapProtocolEVM(accountEvm)

      paraswapProtocolEvmErc4337._veloraSdkPromise = VELORA_SDK_MOCK
    })

    describe('quoteSwap', () => {
      test('should return the expected quote result', async () => {
        const qoute = await paraswapProtocolEvmErc4337.quoteSwap(SWAP_OPTIONS)

        expect(qoute.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(qoute.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(qoute.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw when tokenIn and tokenOut are equal', async () => {
        const INVALID_SWAP_OPTIONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_1,
          tokenInAmount: EXPECTED_SWAP_RESULT.tokenInAmount
        }

        await expect(paraswapProtocolEvmErc4337.quoteSwap(INVALID_SWAP_OPTIONS)).rejects.toThrow("'tokenIn' and 'tokenOut' cannot be equal.")
      })

      test('should throw when neither tokenInAmount nor tokenOutAmount is provided', async () => {
        const INVALID_SWAP_OPTIONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2
        }

        await expect(paraswapProtocolEvmErc4337.quoteSwap(INVALID_SWAP_OPTIONS)).rejects.toThrow("A valid 'tokenInAmount' or 'tokenOutAmount' must be passed.")
      })

      test('should throw when both tokenInAmount and tokenOutAmount are provided', async () => {
        const INVALID_SWAP_OPTIONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2,
          tokenInAmount: EXPECTED_SWAP_RESULT.tokenInAmount,
          tokenOutAmount: EXPECTED_SWAP_RESULT.tokenOutAmount
        }

        await expect(paraswapProtocolEvmErc4337.quoteSwap(INVALID_SWAP_OPTIONS)).rejects.toThrow("Cannot use both 'tokenInAmount' and 'tokenOutAmount' arguments.")
      })

      test('should work with tokenOutAmount provided', async () => {
        const SWAP_OPTIONS_WITH_TOKEN_OUT_AMOUNT = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2,
          tokenOutAmount: EXPECTED_SWAP_RESULT.tokenOutAmount
        }

        const quote = await paraswapProtocolEvmErc4337.quoteSwap(SWAP_OPTIONS_WITH_TOKEN_OUT_AMOUNT)

        expect(quote.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(quote.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(quote.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw if the account is not connected to a provider', async () => {
        const account = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", { chainId: CHAIN_ID })
        const usdt0ProtocolEvm = new ParaSwapProtocolEVM(account)

        await expect(usdt0ProtocolEvm.quoteSwap(SWAP_OPTIONS)).rejects.toThrow('The wallet must be connected to a provider to quote swap.')
      })
    })

    describe('swap', () => {
      test('should return the expected swap result', async () => {
        const result = await paraswapProtocolEvmErc4337.swap(SWAP_OPTIONS)

        expect(result.hash).toBe(EXPECTED_SWAP_RESULT.hash)
        expect(result.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(result.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(result.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw when tokenIn and tokenOut are equal', async () => {
        const INVALID_SWAP_OPTIONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_1,
          tokenInAmount: EXPECTED_SWAP_RESULT.tokenInAmount
        }

        await expect(paraswapProtocolEvmErc4337.swap(INVALID_SWAP_OPTIONS)).rejects.toThrow("'tokenIn' and 'tokenOut' cannot be equal.")
      })

      test('should throw when neither tokenInAmount nor tokenOutAmount is provided', async () => {
        const INVALID_SWAP_OPTIONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2
        }

        await expect(paraswapProtocolEvmErc4337.swap(INVALID_SWAP_OPTIONS)).rejects.toThrow("A valid 'tokenInAmount' or 'tokenOutAmount' must be passed.")
      })

      test('should throw when both tokenInAmount and tokenOutAmount are provided', async () => {
        const INVALID_SWAP_OPTIONS = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2,
          tokenInAmount: EXPECTED_SWAP_RESULT.tokenInAmount,
          tokenOutAmount: EXPECTED_SWAP_RESULT.tokenOutAmount
        }

        await expect(paraswapProtocolEvmErc4337.swap(INVALID_SWAP_OPTIONS)).rejects.toThrow("Cannot use both 'tokenInAmount' and 'tokenOutAmount' arguments.")
      })

      test('should swap with tokenOutAmount provided', async () => {
        const SWAP_OPTIONS_WITH_TOKEN_OUT_AMOUNT = {
          tokenIn: TOKEN_ADDRESS_1,
          tokenOut: TOKEN_ADDRESS_2,
          tokenOutAmount: EXPECTED_SWAP_RESULT.tokenOutAmount
        }

        const result = await paraswapProtocolEvmErc4337.swap(SWAP_OPTIONS_WITH_TOKEN_OUT_AMOUNT)

        expect(result.hash).toBe(EXPECTED_SWAP_RESULT.hash)
        expect(result.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(result.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(result.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw if the account is not connected to a provider', async () => {
        const account = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", { chainId: CHAIN_ID })
        const usdt0ProtocolEvm = new ParaSwapProtocolEVM(account)

        await expect(usdt0ProtocolEvm.swap(SWAP_OPTIONS)).rejects.toThrow('The wallet must be connected to a provider to swap.')
      })

      test('should throw when swapMaxFee is exceeded', async () => {
        const config = { swapMaxFee: EXPECTED_SWAP_RESULT.fee - 1 }

        await expect(paraswapProtocolEvmErc4337.swap(SWAP_OPTIONS, config)).rejects.toThrow('Exceeded maximum fee cost for swap operation.')
      })

      test('should work when swapMaxFee is not exceeded', async () => {
        const config = { swapMaxFee: EXPECTED_SWAP_RESULT.fee + 1 }

        const result = await paraswapProtocolEvmErc4337.swap(SWAP_OPTIONS, config)

        expect(result.hash).toBe(EXPECTED_SWAP_RESULT.hash)
        expect(result.fee).toBe(EXPECTED_SWAP_RESULT.fee)
        expect(result.tokenInAmount).toBe(EXPECTED_SWAP_RESULT.tokenInAmount)
        expect(result.tokenOutAmount).toBe(EXPECTED_SWAP_RESULT.tokenOutAmount)
      })

      test('should throw if the account is read only', async () => {
        const readOnlyAccount = new WalletAccountReadOnlyEvmErc4337(ABSTRACTED_ADDRESS, { chainId: CHAIN_ID })

        const readOnlyProtocolEvm = new ParaSwapProtocolEVM(readOnlyAccount)

        await expect(readOnlyProtocolEvm.swap(SWAP_OPTIONS)).rejects.toThrow('Swap operation cannot be performed with a read-only account.')
      })
    })
  })
})
