'use client';

import React, { useState, useEffect } from 'react';
import { MarketData } from '@/lib/types/market';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { OrderParams } from '@/lib/types/order';

interface OrderFormProps {
  marketData: MarketData | null;
  onPlaceOrder: (order: OrderParams) => Promise<void>;
  isLoading?: boolean;
}

export function OrderForm({ marketData, onPlaceOrder, isLoading = false }: OrderFormProps) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedOutcome, setSelectedOutcome] = useState<number>(0);
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [errors, setErrors] = useState<{ price?: string; size?: string }>({});

  useEffect(() => {
    if (marketData && marketData.outcomePrices.length > 0) {
      // Set default price to current market price
      const currentPrice = marketData.outcomePrices[selectedOutcome];
      setPrice(parseFloat(currentPrice).toFixed(3));
    }
  }, [marketData, selectedOutcome]);

  const validateForm = (): boolean => {
    const newErrors: { price?: string; size?: string } = {};

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0 || parseFloat(price) > 1) {
      newErrors.price = 'Price must be between 0 and 1';
    }

    if (!size || isNaN(parseFloat(size)) || parseFloat(size) < (marketData?.orderMinSize || 5)) {
      newErrors.size = `Size must be at least ${marketData?.orderMinSize || 5}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!marketData || !validateForm()) {
      return;
    }

    const tokenId = marketData.clobTokenIds[selectedOutcome];
    if (!tokenId) {
      alert('Invalid token ID');
      return;
    }

    const orderParams: OrderParams = {
      tokenId,
      price,
      size,
      side,
    };

    await onPlaceOrder(orderParams);
  };

  if (!marketData) {
    return (
      <div className="p-6 border rounded-lg bg-gray-50">
        <p className="text-gray-500">Please fetch market data first</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold mb-4">Place Order</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Side</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSide('BUY')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              side === 'BUY'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide('SELL')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              side === 'SELL'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Sell
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Outcome</label>
        <select
          value={selectedOutcome}
          onChange={(e) => setSelectedOutcome(parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {marketData.outcomes.map((outcome, index) => (
            <option key={index} value={index}>
              {outcome} (Price: {parseFloat(marketData.outcomePrices[index] || '0').toFixed(3)})
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Price"
        type="number"
        step="0.001"
        min="0"
        max="1"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        error={errors.price}
        required
      />

      <Input
        label={`Size (Min: ${marketData.orderMinSize})`}
        type="number"
        step="0.01"
        min={marketData.orderMinSize}
        value={size}
        onChange={(e) => setSize(e.target.value)}
        error={errors.size}
        required
      />

      <Button type="submit" isLoading={isLoading} className="w-full">
        Place Order
      </Button>
    </form>
  );
}

