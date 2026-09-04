import { z } from "zod";
import { BRAND, DEFAULT_OFFER_BODY } from "@/lib/brand";
import { OPT_IN_SOURCES } from "@/lib/customers/opt-in";
import {
  APPROVED_TEMPLATES,
  DEFAULT_CTA_LABEL,
  DEFAULT_MEDIA_CAPTION,
  OPTIN_TEMPLATE,
} from "@/lib/whatsapp/constants";

const approvedTemplateNames = APPROVED_TEMPLATES.map((template) => template.name) as [
  string,
  ...string[],
];
export const e164PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Telefone deve estar em E.164, ex: +5511999998888");

export const recencySegmentSchema = z.enum([
  "ativos",
  "em_risco",
  "inativos",
  "perdidos",
]);

export const createAudienceSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    minDays: z.number().int().min(0).max(120),
    maxDays: z.number().int().min(0).max(120),
  })
  .refine((value) => value.maxDays >= value.minDays, {
    message: "A faixa de dias está invertida.",
    path: ["maxDays"],
  });

export const updateAudienceSchema = z
  .object({
    name: z.string().trim().min(2).max(40).optional(),
    minDays: z.number().int().min(0).max(120).optional(),
    maxDays: z.number().int().min(0).max(120).optional(),
  })
  .refine(
    (value) =>
      value.minDays === undefined ||
      value.maxDays === undefined ||
      value.maxDays >= value.minDays,
    {
      message: "A faixa de dias está invertida.",
      path: ["maxDays"],
    },
  );

export const createCampaignSchema = z.object({
  name: z.string().min(3).max(80),
  audienceId: z.string().min(1).optional(),
  segment: recencySegmentSchema.optional(),
  templateName: z.enum(approvedTemplateNames).default(OPTIN_TEMPLATE.name),
  templateLanguage: z.string().default(OPTIN_TEMPLATE.language),
  establishmentName: z.string().min(2).max(60),
  promoCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,16}$/, "Cupom público inválido")
    .default(BRAND.promoCode),
  discountLabel: z.string().min(1).max(40).default(BRAND.discountLabel),
  offerBody: z.string().min(10).max(900).default(DEFAULT_OFFER_BODY),
  mediaType: z.enum(["image", "video"]).optional(),
  mediaUrl: z.string().optional(),
  mediaCaption: z.string().max(200).optional().default(DEFAULT_MEDIA_CAPTION),
  ctaUrl: z.string().optional(),
  ctaLabel: z.string().min(1).max(20).default(DEFAULT_CTA_LABEL),
  startsAt: z.string().optional(),
}).refine((value) => Boolean(value.audienceId || value.segment), {
  message: "Escolha um público da base de clientes.",
  path: ["audienceId"],
});

export const redeemCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{3,20}$/, "Cupom inválido"),
});

export const embeddedSignupSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1).optional(),
  phoneNumberId: z.string().min(1).optional(),
});

export const storeProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().max(60).default(""),
  menuUrl: z.string().trim().max(300).default(""),
  address: z.string().trim().max(160).default(""),
  hoursText: z.string().trim().max(160).default(""),
});

export const upsertCustomerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(8).max(24),
    segment: recencySegmentSchema.optional(),
    lastVisitAt: z.string().trim().max(40).optional(),
    orderCount: z.coerce.number().int().min(0).max(100_000).optional(),
    optIn: z.boolean(),
    optInSource: z.enum(OPT_IN_SOURCES).optional(),
    optInProof: z.string().trim().max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.optIn) return;
    if (!value.optInSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a origem do opt-in.",
        path: ["optInSource"],
      });
    }
    if (!value.optInProof?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o comprovante do opt-in (nº pedido, reserva, etc.).",
        path: ["optInProof"],
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const signupSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  storeName: z.string().trim().min(2, "Nome da loja muito curto").max(80),
  city: z.string().trim().min(2, "Informe a cidade").max(60),
});

export const onboardingSchema = signupSchema.pick({ storeName: true, city: true });

export const recoverPasswordSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirme a senha"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
