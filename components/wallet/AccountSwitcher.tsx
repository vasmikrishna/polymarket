'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface AccountSwitcherProps {
  accounts: string[];
  currentAddress: string;
  onSwitch: (accountIndex: number) => void;
}

export function AccountSwitcher({ accounts, currentAddress, onSwitch }: AccountSwitcherProps) {
  if (accounts.length <= 1) return null;

  return (
    <div className="p-4 border rounded-lg">
      <h4 className="text-sm font-medium mb-2">Switch Account</h4>
      <div className="space-y-2">
        {accounts.map((account, index) => (
          <button
            key={account}
            onClick={() => onSwitch(index)}
            className={`w-full text-left p-2 rounded text-sm transition-colors ${
              account.toLowerCase() === currentAddress.toLowerCase()
                ? 'bg-blue-100 text-blue-800'
                : 'hover:bg-gray-100'
            }`}
          >
            <div className="font-mono text-xs break-all">
              {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

