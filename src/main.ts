import './features/auth/presentation/login.css';
import { mountLoginView, unmountLoginView } from './features/auth/presentation/login-view';
import { observeAuth, isAuthenticated, logout } from './features/auth/application/auth-service';
import {
  installAbastecimentosBridge,
  loadAbastecimentosIntoPanel,
} from './features/abastecimentos/presentation/panel-bridge';
import {
  installManutencoesBridge,
  loadManutencoesIntoPanel,
} from './features/manutencoes/presentation/panel-bridge';
import {
  installFaturamentoBridge,
  loadFaturamentoIntoPanel,
} from './features/faturamento/presentation/panel-bridge';
import {
  installRotasBridge,
  loadRotasIntoPanel,
} from './features/rotas/presentation/panel-bridge';

// Chaves de estado local do painel (hoje ele guarda os dados em localStorage).
const PANEL_STATE_KEYS = ['motoboy-front-etapa1-v2-clean'];
// Marca de quem é o dono dos dados locais atualmente no aparelho.
const OWNER_UID_KEY = 'motoboy-owner-uid';

/**
 * RD-05: um usuário nunca pode ver os dados do usuário anterior.
 * Como o painel ainda guarda estado em localStorage (global), garantimos o
 * isolamento por uid:
 *  - dono anterior é o mesmo uid  → mantém os dados;
 *  - primeiro dono (marca vazia)  → adota os dados existentes como dele;
 *  - dono diferente               → limpa os dados locais e recarrega limpo.
 * Retorna true quando fez uma limpeza que exige recarregar a página.
 */
function ensureLocalIsolation(uid: string): boolean {
  let previousOwner: string | null = null;
  try {
    previousOwner = localStorage.getItem(OWNER_UID_KEY);
  } catch {
    return false;
  }

  if (previousOwner === uid) return false;

  try {
    if (previousOwner !== null) {
      // Troca de usuário: apaga os dados locais do dono anterior.
      PANEL_STATE_KEYS.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(OWNER_UID_KEY, uid);
      return true; // recarrega para o painel reiniciar sem dados do anterior
    }
    // Primeiro login neste aparelho: adota o estado atual como deste usuário.
    localStorage.setItem(OWNER_UID_KEY, uid);
  } catch {
    /* se o storage falhar, seguimos sem isolamento local */
  }
  return false;
}

// Pontes de persistência do painel legado (write-through para o Firestore).
installAbastecimentosBridge();
installManutencoesBridge();
installFaturamentoBridge();
installRotasBridge();

// Mostra o login imediatamente, cobrindo o painel — assim ninguém vê o painel
// antes de checarmos a sessão (RF-10).
mountLoginView();

// RF-05 / RF-10 / RD-05.
observeAuth((user) => {
  if (isAuthenticated(user) && user) {
    if (ensureLocalIsolation(user.uid)) {
      window.location.reload();
      return;
    }
    unmountLoginView();
    // Carrega os dados do dono no Firestore e injeta no painel.
    void loadAbastecimentosIntoPanel();
    void loadManutencoesIntoPanel();
    void loadFaturamentoIntoPanel();
    void loadRotasIntoPanel();
  } else {
    mountLoginView();
  }
});

// RF-09: função de sair disponível para o painel.
// Enquanto o botão "Sair" não é adicionado ao menu, dá para encerrar a sessão
// chamando window.motoboyLogout() (ex.: pelo console).
declare global {
  interface Window {
    motoboyLogout: () => Promise<void>;
  }
}
window.motoboyLogout = logout;

// RF-09: botão "Sair" do menu do painel.
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  // fecha o menu (cosmético) e encerra a sessão; o observador reexibe o login.
  document.getElementById('drawer')?.classList.remove('open');
  document.getElementById('backdrop')?.classList.remove('open');
  logout().catch(() => {
    /* ignora falha ao sair */
  });
});
