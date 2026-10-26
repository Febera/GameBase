import type { AdultMode } from '@rj/shared';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

const STORAGE_KEY = 'ocultarConteudoAdulto';

interface PreferencesValue {
  /** Ocultar jogos com foco em conteúdo sexual. Ligado por padrão. */
  hideAdult: boolean;
  setHideAdult: (value: boolean) => void;
  /** Valor pronto para o parâmetro `adult` da API. */
  adultMode: AdultMode;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

function readHideAdult(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [hideAdult, setState] = useState(readHideAdult);

  const setHideAdult = useCallback((value: boolean) => {
    setState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Sem armazenamento: a escolha vale só nesta visita.
    }
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ hideAdult, setHideAdult, adultMode: hideAdult ? 'hide' : 'show' }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences precisa estar dentro de <PreferencesProvider>.');
  return value;
}
