'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface AccountSelectorProps {
  accounts: string[];
  selectedAddress: string | null;
  onSelect: (address: string) => void;
  onConnect: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AccountSelector({
  accounts,
  selectedAddress,
  onSelect,
  onConnect,
  onCancel,
  isLoading = false,
}: AccountSelectorProps) {
  if (accounts.length === 0) {
    return (
      <div className="p-4 border rounded-lg">
        <p className="text-sm text-gray-600">No accounts found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Select Account to Connect</h3>
        <p className="text-sm text-gray-600 mb-3">Choose which MetaMask account you want to use:</p>
        <h4 className="text-sm font-medium mb-3">Available Accounts</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {accounts.map((account) => {
            const isSelected = selectedAddress?.toLowerCase() === account.toLowerCase();
            return (
              <button
                key={account}
                onClick={() => onSelect(account)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-mono text-sm break-all">
                      {account.slice(0, 6)}...{account.slice(-4)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {account}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="ml-2">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onCancel}
          variant="secondary"
          className="flex-1"
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={onConnect}
          className="flex-1"
          disabled={!selectedAddress || isLoading}
          isLoading={isLoading}
        >
          Connect
        </Button>
      </div>
    </div>
  );
}

