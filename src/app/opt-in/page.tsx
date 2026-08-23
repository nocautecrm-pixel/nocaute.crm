import { LegalLayout } from "@/components/legal/LegalLayout";

export default function OptInPage() {
  return (
    <LegalLayout title="Texto de opt-in no caixa">
      <p>Leia (ou mostre) isto antes de gravar o WhatsApp do cliente:</p>
      <blockquote className="rounded-lg border border-[#E9EDEF] bg-[#F0F2F5] px-4 py-3 text-[#111B21]">
        “Posso cadastrar seu WhatsApp para enviar ofertas desta loja, com cupom exclusivo? Você
        pode pedir para sair quando quiser. Não compartilhamos seu número com outras empresas.”
      </blockquote>
      <p>
        No sistema, grave origem (balcão, delivery, reserva…) e um comprovante (nº do pedido,
        comanda, reserva). Sem isso a campanha não dispara — a Meta exige prova de consentimento.
      </p>
      <p>
        Cliente que quiser sair: peça para responder a uma campanha ou apague o contato no painel.
        Exclusão da conta Facebook/Instagram passa pelo callback de Data Deletion da Meta.
      </p>
    </LegalLayout>
  );
}
