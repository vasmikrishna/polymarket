'use client';

import React from 'react';
import { MarketData } from '@/lib/types/market';

interface MarketDataDisplayProps {
  marketData: MarketData | null;
  isLoading?: boolean;
  error?: string | null;
}

export function MarketDataDisplay({ marketData, isLoading, error }: MarketDataDisplayProps) {
  if (isLoading) {
    return (
      <div className="p-6 border rounded-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border rounded-lg bg-red-50">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!marketData) {
    return (
      <div className="p-6 border rounded-lg bg-gray-50">
        <p className="text-gray-500">Enter a market slug to fetch market data</p>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-2">{marketData.question}</h2>
        {marketData.image && (
          <img src={marketData.image} alt={marketData.question} className="w-full h-48 object-cover rounded-lg mb-4" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Outcomes</p>
          <div className="mt-1 space-y-2">
            {marketData.outcomes.map((outcome, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="font-medium">{outcome}</span>
                <span className="text-blue-600 font-semibold">
                  {parseFloat(marketData.outcomePrices[index] || '0').toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-600">Market Stats</p>
          <div className="mt-1 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Volume:</span>
              <span className="font-medium">{parseFloat(marketData.volume).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Liquidity:</span>
              <span className="font-medium">{parseFloat(marketData.liquidity).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Best Bid:</span>
              <span className="font-medium">{marketData.bestBid.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>Best Ask:</span>
              <span className="font-medium">{marketData.bestAsk.toFixed(3)}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-600 mb-1">Description</p>
        <p className="text-sm text-gray-700">{marketData.description}</p>
      </div>

      <div className="pt-4 border-t">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Start Date:</span>
            <p className="font-medium">{new Date(marketData.startDate).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-gray-600">End Date:</span>
            <p className="font-medium">{new Date(marketData.endDate).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm text-gray-600 mb-2">Token IDs</p>
        <div className="space-y-1">
          {marketData.clobTokenIds.map((tokenId, index) => (
            <div key={index} className="text-xs font-mono break-all bg-gray-50 p-2 rounded">
              {marketData.outcomes[index]}: {tokenId}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

