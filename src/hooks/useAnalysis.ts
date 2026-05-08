import { useState } from 'react';

interface AnalysisResponse {
  analysis: string;
  isPaywalled?: boolean;
}

export const useAnalysis = () => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const analyze = async (url: string) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setPaywallVisible(false);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        // This is the logic that was floating at the top of your file
        if (response.status === 402 || (data.error && data.error.includes('quota_exceeded'))) {
          setPaywallVisible(true);
          throw new Error('Quota exceeded');
        }
        throw new Error(data.error || 'Failed to analyze');
      }

      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    analysis,
    loading,
    error,
    paywallVisible,
    setPaywallVisible,
    analyze
  };
};