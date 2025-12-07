'use client';

import React, { useState } from 'react';
import { WalletConnector } from '@/components/wallet/WalletConnector';
import { ProxyWalletDisplay } from '@/components/proxy/ProxyWalletDisplay';
import { MarketSlugInput } from '@/components/market/MarketSlugInput';
import { MarketDataDisplay } from '@/components/market/MarketDataDisplay';
import { OrderForm } from '@/components/market/OrderForm';
import { useWallet } from '@/lib/contexts/WalletContext';
import { useToast } from '@/components/ui/Toast';
import { MarketData } from '@/lib/types/market';
import { OrderParams } from '@/lib/types/order';


export default function Home() {
  const { walletState, setWalletState } = useWallet();
  const { showToast } = useToast();
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(null);

  const handleWalletConnected = (state: any) => {
    setWalletState(state);
    showToast('Wallet connected successfully', 'success');
  };

  const handleWalletDisconnected = () => {
    setWalletState({
      provider: null,
      address: null,
      signer: null,
      providerInstance: null,
      accounts: [],
      isConnected: false,
    });
    showToast('Wallet disconnected', 'info');
  };

  const handleFetchMarket = async (slug: string) => {
    setIsLoadingMarket(true);
    setMarketError(null);

    try {
      const response = await fetch(`/api/markets/${slug}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch market data');
      }

      const data: MarketData = await response.json();
      setMarketData(data);
      showToast('Market data fetched successfully', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch market data';
      setMarketError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoadingMarket(false);
    }
  };

  const handlePlaceOrder = async (orderParams: OrderParams) => {
    if (!walletState.address || !marketData) {
      showToast('Wallet not connected or market data missing', 'error');
      return;
    }

    setIsPlacingOrder(true);

    try {
      // Step 1: Get the provider for the connected wallet
      const { getProviderForWallet, ensurePolygon, signTypedDataWithWallet, WalletKind } = await import('@/lib/wallet/wallet-manager');

      if (!walletState.provider) {
        throw new Error('No wallet provider selected');
      }

      const provider = getProviderForWallet(walletState.provider as any);

      // Handle null provider gracefully
      if (!provider) {
        const walletName = walletState.provider.charAt(0).toUpperCase() + walletState.provider.slice(1);
        throw new Error(`${walletName} wallet not found. Please make sure it's installed and enabled.`);
      }

      // Validate provider has request method
      if (typeof provider.request !== 'function') {
        throw new Error('Selected wallet does not support signing operations');
      }

      // Step 2: Ensure we're on Polygon chain
      showToast('Checking network...', 'info');
      try {
        await ensurePolygon(provider);
      } catch (chainError: any) {
        if (chainError.message?.includes('User rejected')) {
          throw new Error('Network switch rejected. Please switch to Polygon manually.');
        }
        throw chainError;
      }

      // Step 3: Build complete order structure with nonce and expiration
      // Generate nonce (using timestamp for uniqueness)
      const nonce = Math.floor(Date.now() / 1000);
      // Set expiration to 1 hour from now
      const expiration = Math.floor(Date.now() / 1000) + 3600;

      // Build order for user authorization
      // If proxy wallet is being used, MAKER must be the PROXY address (funder)
      // Otherwise, MAKER is the EOA address (signer)
      const makerAddress = proxyWalletAddress || walletState.address;

      const completeOrder = {
        maker: makerAddress,
        tokenID: orderParams.tokenId,
        price: orderParams.price,
        size: orderParams.size,
        side: orderParams.side,
        nonce,
        expiration,
        feeRateBps: 0,
      };

      // Step 4: Build EIP-712 typed data with complete order structure
      const { buildOrderTypedData } = await import('@/lib/utils/eip712');

      const typedData = buildOrderTypedData({
        price: orderParams.price,
        size: orderParams.size,
        side: orderParams.side,
        tokenID: orderParams.tokenId,
        maker: makerAddress,
        nonce,
        expiration,
      });

      // Step 5: Sign using the wallet manager (with validation)
      showToast('Please sign the order in your wallet...', 'info');
      const signature = await signTypedDataWithWallet(provider, walletState.address, typedData);

      // Step 6: Send complete order + signature to server API
      showToast('Placing order...', 'info');
      const response = await fetch('/api/placeOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: completeOrder,
          signature,
          signerAddress: walletState.address,
          typedData,
          proxyWalletAddress: proxyWalletAddress || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to place order');
      }

      showToast('Order placed successfully!', 'success');

      // Reset form
      setMarketData(null);
    } catch (error: any) {
      console.error('Order placement error:', error);

      // User-friendly error messages
      if (error.message?.includes('wallet not found')) {
        showToast(error.message, 'error');
      } else if (error.message?.includes('User rejected')) {
        showToast('Signature rejected by user', 'error');
      } else if (error.message?.includes('Network switch rejected')) {
        showToast(error.message, 'error');
      } else if (error.message?.includes('not connected to the requested chain')) {
        showToast('Please switch to Polygon network', 'error');
      } else if (error.message?.includes('missing required fields')) {
        showToast('Invalid order data. Please try again.', 'error');
      } else if (error.message?.includes('does not support signing')) {
        showToast(error.message, 'error');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
        showToast(errorMessage, 'error');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PolyMarket Builder Trading App
          </h1>
          <p className="text-gray-600">
            Trade on PolyMarket with gasless transactions using the Builder Program
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Wallet Connection */}
            <section className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Wallet Connection</h2>
              <WalletConnector
                onWalletConnected={handleWalletConnected}
                onWalletDisconnected={handleWalletDisconnected}
              />
            </section>

            {/* Proxy Wallet */}
            <section className="bg-white p-6 rounded-lg shadow">
              <ProxyWalletDisplay
                userAddress={walletState.address}
                signer={walletState.signer}
                onProxyAddressFound={setProxyWalletAddress}
              />
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Market Input */}
            <section className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Market Data</h2>
              <MarketSlugInput
                onFetch={handleFetchMarket}
                isLoading={isLoadingMarket}
              />
            </section>

            {/* Market Display */}
            <section className="bg-white p-6 rounded-lg shadow">
              <MarketDataDisplay
                marketData={marketData}
                isLoading={isLoadingMarket}
                error={marketError}
              />
            </section>

            {/* Order Form */}
            <section className="bg-white p-6 rounded-lg shadow">
              <OrderForm
                marketData={marketData}
                onPlaceOrder={handlePlaceOrder}
                isLoading={isPlacingOrder}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
