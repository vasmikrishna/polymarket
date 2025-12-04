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
import { ethers } from 'ethers';
import { createClobClient, placeOrder } from '@/lib/polymarket/clob-client';

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
    if (!walletState.signer || !marketData) {
      showToast('Wallet not connected or market data missing', 'error');
      return;
    }

    setIsPlacingOrder(true);

    try {
      // Step 1: Sign order with builder credentials
      const signResponse = await fetch('/api/builder/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderParams),
      });

      if (!signResponse.ok) {
        const errorData = await signResponse.json();
        throw new Error(errorData.error || 'Failed to sign order');
      }

      const signedOrder = await signResponse.json();

      // Step 2: Place order via CLOB client
      if (!walletState.signer || !('provider' in walletState.signer)) {
        throw new Error('Invalid signer type');
      }
      const clobClient = createClobClient(walletState.signer as ethers.JsonRpcSigner);
      const result = await placeOrder(clobClient, signedOrder);

      showToast('Order placed successfully', 'success');
      
      // Reset form
      setMarketData(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      showToast(errorMessage, 'error');
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
