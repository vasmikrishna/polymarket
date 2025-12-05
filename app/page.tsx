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
      const { ensurePolygon, signTypedDataWithWallet } = await import('@/lib/wallet/wallet-manager');

      if (!walletState.provider || !walletState.address) {
        throw new Error('Please connect your wallet first');
      }

      const provider = walletState.provider;

      if (!walletState.signer) {
        throw new Error('Selected wallet does not support signing operations');
      }

      // Ensure we're on Polygon chain
      showToast('Checking network...', 'info');

      // Use window.ethereum for better chain switching compatibility
      const effectiveProvider = (window as any).ethereum || provider;

      const switched = await ensurePolygon(effectiveProvider);
      if (!switched) {
        throw new Error('Please switch your wallet to Polygon (MATIC) network manually.');
      }

      // Build EIP-712 typed data
      const { buildOrderTypedData } = await import('@/lib/utils/eip712');
      const { getProviderForWallet } = await import('@/lib/wallet/wallet-manager');
      const { createRelayerClient, getExpectedSafeAddress } = await import('@/lib/polymarket/relayer-client');

      // Get the actual provider object for the connected wallet
      const actualProvider = getProviderForWallet(walletState.provider as any);
      if (!actualProvider) {
        throw new Error('Could not find provider for connected wallet');
      }

      // Get the actual signer address (EOA - used for signing only)
      const accounts = await actualProvider.request({ method: 'eth_requestAccounts' });
      const eoaAddress = accounts[0];

      // Get Safe wallet address (maker/funder - holds the funds)
      showToast('Getting Safe wallet address...', 'info');
      let safeAddress: string | null = null;

      // Try localStorage first
      safeAddress = localStorage.getItem(`safe_${eoaAddress}`);

      // If not in localStorage, derive it
      if (!safeAddress && walletState.signer) {
        try {
          const relayerClient = await createRelayerClient(walletState.signer, undefined);
          safeAddress = await getExpectedSafeAddress(relayerClient, eoaAddress);
        } catch (err) {
          console.error('Error getting Safe address:', err);
        }
      }

      if (!safeAddress) {
        throw new Error('Safe wallet not found. Please deploy your Safe wallet first.');
      }

      // Build typed data with Safe as maker
      const typedData = buildOrderTypedData({
        price: orderParams.price,
        size: orderParams.size,
        side: orderParams.side,
        tokenID: orderParams.tokenId,
        maker: safeAddress, // Safe wallet (holds funds)
      });

      // Sign using the EOA (MetaMask)
      showToast('Please sign the order in your wallet...', 'info');
      const signature = await signTypedDataWithWallet(actualProvider, eoaAddress, typedData);

      // Send to server API
      showToast('Placing order...', 'info');
      const response = await fetch('/api/placeOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenID: orderParams.tokenId,
          price: orderParams.price,
          size: orderParams.size,
          side: orderParams.side,
          userSignature: signature,
          userAddress: safeAddress, // Safe address (maker/funder)
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to place order');
      }

      showToast('Order placed successfully!', 'success');
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
