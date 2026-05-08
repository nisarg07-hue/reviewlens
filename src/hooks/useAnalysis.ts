if (error.status === 402 || error.message.includes('quota_exceeded')) {
      setPaywallVisible(true);
    }