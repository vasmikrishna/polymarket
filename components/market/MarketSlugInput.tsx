'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface MarketSlugInputProps {
  onFetch: (slug: string) => void;
  isLoading?: boolean;
}

export function MarketSlugInput({ onFetch, isLoading = false }: MarketSlugInputProps) {
  const [slug, setSlug] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (slug.trim()) {
      onFetch(slug.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Market Slug"
        placeholder="e.g., bitcoin-up-or-down-on-december-4"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        disabled={isLoading}
      />
      <Button type="submit" isLoading={isLoading} className="w-full">
        Fetch Market Data
      </Button>
    </form>
  );
}

