import { usePreferences } from '../../app/preferences';
import { Switch } from '../ui/Switch';
import { PanelShell } from './PanelShell';

export function OptionsPanel({ onClose }: { onClose: () => void }) {
  const { hideAdult, setHideAdult } = usePreferences();
  return (
    <PanelShell id="painel-opcoes" title="Opções" onClose={onClose}>
      <Switch
        id="opcao-ocultar-adulto"
        checked={hideAdult}
        onChange={setHideAdult}
        label="Ocultar jogos com foco em conteúdo sexual"
        description="Vale para todas as listas, a busca e as recomendações. Fica salvo neste navegador."
      />
    </PanelShell>
  );
}
