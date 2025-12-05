'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { connectMetaMask, disconnectWallet, getAvailableAccounts, type WalletState } from '@/lib/wallet/providers';
import { WalletSelector } from './WalletSelector';
import { AccountSwitcher } from './AccountSwitcher';
import { AccountSelector } from './AccountSelector';
import { ethers } from 'ethers';

interface WalletConnectorProps {
  onWalletConnected: (walletState: WalletState) => void;
  onWalletDisconnected: () => void;
}

export function WalletConnector({ onWalletConnected, onWalletDisconnected }: WalletConnectorProps) {
  const [walletState, setWalletState] = useState<WalletState>({
    provider: null,
    address: null,
    signer: null,
    providerInstance: null,
    accounts: [],
    isConnected: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account selection state
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(false);

  const handleConnect = async (provider: 'metamask' | 'phantom') => {
    setIsFetchingAccounts(true);
    setError(null);

    try {
      // For now, we'll use the generic connectWallet function which handles both
      // But we might want to add specific logic for each provider later if needed
      const { connectWallet } = await import('@/lib/wallet/providers');

      // Note: We're skipping the account selection UI for now to simplify the flow
      // and because connectWallet handles the connection directly
      const state = await connectWallet(provider);
      setWalletState(state);
      onWalletConnected(state);
      setIsFetchingAccounts(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Error connecting wallet:', err);
      setIsFetchingAccounts(false);
    }
  };

  const handleAccountConnect = async () => {
    // Legacy function - kept if we want to re-enable account selection later
    if (!selectedAddress) return;
  };

  const handleAccountSelectCancel = () => {
    setShowAccountSelector(false);
    setAvailableAccounts([]);
    setSelectedAddress(null);
    setError(null);
  };

  const handleDisconnect = async () => {
    try {
      const state = await disconnectWallet();
      setWalletState(state);
      onWalletDisconnected();

      // Force reload to clear all state
      window.location.reload();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect wallet';
      setError(errorMessage);
    }
  };

  const handleAccountSwitch = async (accountIndex: number) => {
    if (!walletState.providerInstance) return;

    try {
      const accounts = await walletState.providerInstance.listAccounts();
      if (accountIndex >= accounts.length) {
        throw new Error('Account index out of range');
      }

      const signer = await walletState.providerInstance.getSigner(accounts[accountIndex].address);
      const address = await signer.getAddress();

      const state: WalletState = {
        provider: 'metamask',
        address,
        signer,
        providerInstance: walletState.providerInstance,
        accounts: accounts.map((acc) => acc.address),
        isConnected: true,
      };

      setWalletState(state);
      onWalletConnected(state);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch account';
      setError(errorMessage);
    }
  };

  if (walletState.isConnected && walletState.address) {
    return (
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Connected Wallet</span>
            <Button variant="secondary" onClick={handleDisconnect} className="text-xs">
              Disconnect
            </Button>
          </div>
          <p className="text-sm text-gray-600 break-all">{walletState.address}</p>
        </div>

        {walletState.accounts.length > 1 && (
          <AccountSwitcher
            accounts={walletState.accounts}
            currentAddress={walletState.address}
            onSwitch={handleAccountSwitch}
          />
        )}

        {error && (
          <div className="p-2 bg-red-50 text-red-600 text-sm rounded">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Show account selector if accounts are available
  if (showAccountSelector && availableAccounts.length > 0) {
    return (
      <div className="space-y-4">
        <AccountSelector
          accounts={availableAccounts}
          selectedAddress={selectedAddress}
          onSelect={setSelectedAddress}
          onConnect={handleAccountConnect}
          onCancel={handleAccountSelectCancel}
          isLoading={isConnecting}
        />
        {error && (
          <div className="p-2 bg-red-50 text-red-600 text-sm rounded">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WalletSelector onSelect={handleConnect} isLoading={isFetchingAccounts} />
      {error && (
        <div className="p-2 bg-red-50 text-red-600 text-sm rounded">
          {error}
        </div>
      )}
    </div>
  );
}

