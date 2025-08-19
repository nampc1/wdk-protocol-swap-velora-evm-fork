// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { constructSimpleSDK, SwapSide } from '@velora-dex/sdk'
import { JsonRpcProvider, BrowserProvider, Contract } from 'ethers'

import { SwapProtocol } from '@wdk/wallet/protocols'
import { WalletAccountEvm } from '@wdk/wallet-evm'
import { WalletAccountEvmErc4337 } from '@wdk/wallet-evm-erc-4337'

/** @typedef {import('@wdk/wallet/protocols').SwapOptions} SwapOptions */
/** @typedef {import('@wdk/wallet/protocols').SwapProtocolConfig} SwapProtocolConfig */
/** @typedef {import('@wdk/wallet/protocols').SwapResult} SwapResult */

/** @typedef {import('@wdk/wallet-evm-erc-4337').EvmErc4337WalletConfig} EvmErc4337WalletConfig */

/**
 * @template {WalletAccountEvm | WalletAccountEvmErc4337} T
 * @typedef {Pick<SwapProtocolConfig, 'swapMaxFee'> & (T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, 'paymasterToken'> : {})} SwapConfigOverride
 */

/**
 * @template {WalletAccountEvm | WalletAccountEvmErc4337} T
 * @typedef {(T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, 'paymasterToken'> : {})} QuoteSwapConfigOverride
 */

/**
 * @template {WalletAccountEvm | WalletAccountEvmErc4337} T
 */
export default class ParaSwapProtocolEVM extends SwapProtocol {
  /**
   * Creates a new interface to the paraswap protocol for evm blockchains.`
   *
   * @param {T} account - The wallet account to use to interact with the protocol.
   * @param {SwapProtocolConfig} [config] - The swap protocol configuration.
   */
  constructor (account, config) {
    super(account, config)

    if (account._config.provider) {
      this._provider = typeof account._config.provider === 'string'
        ? new JsonRpcProvider(account._config.provider)
        : new BrowserProvider(account._config.provider)
    }

    /**
     * @private
     * @type {Promise<import('@velora-dex/sdk').SimpleFetchSDK>}
     */
    this._veloraSdkPromise = (async () => {
      const chainId = (await this._provider?.getNetwork())?.chainId

      return constructSimpleSDK({
        fetch,
        chainId: Number(chainId)
      })
    })()
  }

  /** @private */
  async _getSwapTransactions (options) {
    const { tokenIn, tokenOut, tokenInAmount, tokenOutAmount, to } = options

    if (tokenIn === tokenOut) {
      throw new Error("'tokenIn' and 'tokenOut' cannot be equal.")
    }

    if (!tokenInAmount && !tokenOutAmount) {
      throw new Error("A valid 'tokenInAmount' or 'tokenOutAmount' must be passed.")
    }

    if (tokenInAmount && tokenOutAmount) {
      throw new Error("Cannot use both 'tokenInAmount' and 'tokenOutAmount' arguments.")
    }

    const veloraSdk = await this._veloraSdkPromise

    const side = tokenInAmount ? SwapSide.SELL : SwapSide.BUY
    const amount = tokenInAmount || tokenOutAmount

    const priceRoute = await veloraSdk.swap.getRate({
      srcToken: tokenIn,
      destToken: tokenOut,
      amount: amount.toString(),
      side
    })

    const address = await this._account.getAddress()

    const swapTx = await veloraSdk.swap.buildTx({
      partner: 'wdk',
      srcToken: priceRoute.srcToken,
      destToken: priceRoute.destToken,
      srcAmount: priceRoute.srcAmount,
      destAmount: priceRoute.destAmount,
      userAddress: address,
      priceRoute,
      receiver: to
    }, {
      ignoreChecks: true
    })

    const tokenInContract = new Contract(
      tokenIn,
      ['function approve(address,uint256)']
    )

    const approvalTx = {
      to: tokenIn,
      value: 0n,
      data: await tokenInContract.interface.encodeFunctionData('approve', [swapTx.to, priceRoute.srcAmount]),
      from: address
    }

    return {
      approvalTx,
      swapTx,
      tokenInAmount: +priceRoute.srcAmount,
      tokenOutAmount: +priceRoute.destAmount
    }
  }

  /**
   * Swaps a pair of tokens.
   *
   * @abstract
   * @param {SwapOptions} options - The swap's options.
   * @param {SwapConfigOverride<T>} [config] - If set, overrides the 'swapMaxFee' and 'paymasterToken' options defined in the manager configuration.
   * @returns {Promise<SwapResult>} The swap's result.
   */
  async swap (options, config) {
    if (!(this._account instanceof WalletAccountEvm) && !(this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('Swap operation cannot be performed with a read-only account.')
    }

    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to swap.')
    }

    const { approvalTx, swapTx, tokenInAmount, tokenOutAmount } = await this._getSwapTransactions(options)

    const { swapMaxFee, paymasterToken } = config ?? this._config

    if (this._account instanceof WalletAccountEvmErc4337) {
      const { fee } = await this._account.quoteSendTransaction([approvalTx, swapTx], {
        paymasterToken
      })

      if (swapMaxFee && fee > swapMaxFee) {
        throw new Error('Exceeded maximum fee cost for swap operation.')
      }

      const { hash } = await this._account.sendTransaction([approvalTx, swapTx], {
        paymasterToken
      })

      return {
        hash,
        fee,
        tokenInAmount,
        tokenOutAmount
      }
    }

    const { fee: approvalFee } = await this._account.quoteSendTransaction(approvalTx)
    const { fee: swapFee } = await this._account.quoteSendTransaction(swapTx)

    if (swapMaxFee && (approvalFee + swapFee) > swapMaxFee) {
      throw new Error('Exceeded maximum fee cost for swap operation.')
    }

    const { hash: approvalHash } = await this._account.sendTransaction(approvalTx)
    const { hash: swapHash } = await this._account.sendTransaction(swapTx)

    return {
      hash: swapHash,
      fee: swapFee + approvalFee,
      approvalHash,
      tokenInAmount,
      tokenOutAmount
    }
  }

  /**
   * Quotes the costs of a swap operation.
   *
   * @param {SwapOptions} options - The swap's options.
   * @returns {Promise<Omit<SwapResult, 'hash'>>} The swap's quotes.
   */
  async quoteSwap (options) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to quote swap.')
    }

    const { approvalTx, swapTx, tokenInAmount, tokenOutAmount } = await this._getSwapTransactions(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      const { fee } = await this._account.quoteSendTransaction([approvalTx, swapTx])

      return { fee, tokenInAmount, tokenOutAmount }
    }

    const { fee: approvalFee } = await this._account.quoteSendTransaction(approvalTx)

    const { fee: swapFee } = await this._account.quoteSendTransaction(swapTx)

    return {
      fee: swapFee + approvalFee,
      tokenInAmount,
      tokenOutAmount
    }
  }
}
