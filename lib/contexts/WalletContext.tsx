'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletState } from '@/lib/wallet/providers';

interface WalletContextType {
  walletState: WalletState;
  setWalletState: (state: WalletState) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletState, setWalletState] = useState<WalletState>({
    provider: null,
    address: null,
    signer: null,
    providerInstance: null,
    accounts: [],
    isConnected: false,
  });

  // Load wallet state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('walletState');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Note: We can't store signer/provider instances, so we'll need to reconnect
        setWalletState({
          ...parsed,
          signer: null,
          providerInstance: null,
        });
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Save wallet state to localStorage
  useEffect(() => {
    if (walletState.isConnected && walletState.address) {
      localStorage.setItem('walletState', JSON.stringify({
        provider: walletState.provider,
        address: walletState.address,
        accounts: walletState.accounts,
        isConnected: walletState.isConnected,
      }));
    } else {
      localStorage.removeItem('walletState');
    }
  }, [walletState]);

  return (
    <WalletContext.Provider value={{ walletState, setWalletState }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}

