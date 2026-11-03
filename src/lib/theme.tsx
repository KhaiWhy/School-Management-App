import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Light / dark / follow the device. Saved per browser; index.html applies it before
// React loads so the page never flashes the wrong colours.
export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'schooling.theme';

function readChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && systemDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

const ThemeContext = createContext<{
  choice: ThemeChoice;
  resolved: 'light' | 'dark';
  setChoice: (choice: ThemeChoice) => void;
  toggle: () => void;
}>({ choice: 'system', resolved: 'light', setChoice: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    apply(choice);
    setResolved(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    if (choice !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      apply('system');
      setResolved(media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [choice]);

  function setChoice(next: ThemeChoice) {
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the choice still applies until the page reloads.
    }
    setChoiceState(next);
  }

  return (
    <ThemeContext.Provider
      value={{ choice, resolved, setChoice, toggle: () => setChoice(resolved === 'dark' ? 'light' : 'dark') }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
