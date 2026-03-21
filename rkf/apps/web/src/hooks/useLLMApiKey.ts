import { useState } from 'react';

const STORAGE_KEY = 'rkf-anthropic-api-key';

export function useLLMApiKey() {
  const [apiKey, setApiKeyState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  );

  const setApiKey = (key: string) => {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setApiKeyState(key);
  };

  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  const hasKey = isDemo || apiKey.length > 0;

  return { apiKey, setApiKey, hasKey, isDemo };
}
