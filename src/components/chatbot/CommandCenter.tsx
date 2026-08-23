"use client";

import { useState } from "react";
import { BrandDnaForm } from "@/components/chatbot/BrandDnaForm";
import { ChannelStatusPanel } from "@/components/chatbot/ChannelStatusPanel";
import { PersonalityPreview } from "@/components/chatbot/PersonalityPreview";
import { WhatsAppConnectPanel } from "@/components/integracao/WhatsAppConnectPanel";
import type { BrandDna } from "@/lib/chatbot/dna";
import type { StorePanel } from "@/types/store";

export function CommandCenter({ store }: { store: StorePanel }) {
  const [dna, setDna] = useState<BrandDna>(store.chatbot);
  const [focusDna, setFocusDna] = useState(store.whatsapp.connected);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <WhatsAppConnectPanel
          connection={store.whatsapp}
          onConnected={() => {
            setFocusDna(true);
            document.getElementById("dna-marca")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
        />
        <BrandDnaForm dna={dna} onChange={setDna} highlight={focusDna} />
      </div>

      <div className="space-y-4 lg:sticky lg:top-20">
        <PersonalityPreview
          dna={dna}
          storeName={store.storeName}
          facts={{ hoursText: store.hoursText, menuUrl: store.menuUrl, address: store.address }}
        />
        <ChannelStatusPanel connection={store.whatsapp} />
      </div>
    </div>
  );
}
