import { LegalLayout } from "@/components/legal/LegalLayout";
import { BRAND } from "@/lib/brand";

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de privacidade">
      <p>
        O {BRAND.productName} trata dados de restaurantes (conta, loja, WhatsApp Business) e de
        clientes da loja (nome, telefone, recência de visita, opt-in e cupons) para disparar
        campanhas oficiais na Cloud API da Meta.
      </p>
      <p>
        Base legal: execução de contrato com o lojista e consentimento do cliente final (opt-in
        com origem e comprovante). Não vendemos lista. Tokens da WABA ficam cifrados no servidor.
      </p>
      <p>
        O lojista pode exportar os dados da loja no painel e apagar um cliente. Pedidos de exclusão
        do usuário Meta usam o callback de Data Deletion. Logs de mensagem são anonimizados após
        30 dias.
      </p>
      <p>Contato do controlador: o e-mail da conta do lojista cadastrado neste app.</p>
    </LegalLayout>
  );
}
