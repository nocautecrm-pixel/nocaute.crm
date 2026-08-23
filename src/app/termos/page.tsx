import { LegalLayout } from "@/components/legal/LegalLayout";
import { BRAND } from "@/lib/brand";

export default function TermosPage() {
  return (
    <LegalLayout title="Termos de uso">
      <p>
        O {BRAND.productName} é uma ferramenta de CRM para restaurantes dispararem templates
        aprovados no WhatsApp Cloud API. O lojista é responsável pela base (opt-in real, sem lista
        fria) e pelo conteúdo das campanhas.
      </p>
      <p>
        A franquia de leads limita o uso da ferramenta, não o WhatsApp da Meta. Cobrança recorrente
        (cartão/Pix) ainda não está no ar: o piloto usa o plano combinado no WhatsApp.
      </p>
      <p>
        Podemos suspender o disparo se a Meta restringir a WABA, se faltar opt-in auditável ou se
        o uso violar a política da Cloud API.
      </p>
    </LegalLayout>
  );
}
