import z4 from 'zod/v4'
import { createZodDto } from 'nestjs-zod'

// ==================== Deposit (PayOS) ====================
export const DepositBodySchema = z4.object({
  packageVnd: z4.coerce
    .number()
    .int()
    .refine((v) => [5000, 10000, 50000, 100000].includes(v), {
      message: 'Gói nạp không hợp lệ. Chọn 5000, 10000, 50000 hoặc 100000 VND',
    }),
  returnUrl: z4.string().url().optional(),
  cancelUrl: z4.string().url().optional(),
})

export type DepositBodyType = z4.infer<typeof DepositBodySchema>
export class DepositBodyDTO extends createZodDto(DepositBodySchema) {}

// ==================== Purchase Chapter ====================
export const PurchaseChapterBodySchema = z4.object({
  storyId: z4.string().min(1),
  chapterId: z4.string().min(1),
})

export type PurchaseChapterBodyType = z4.infer<typeof PurchaseChapterBodySchema>
export class PurchaseChapterBodyDTO extends createZodDto(PurchaseChapterBodySchema) {}

// ==================== Donate ====================
export const DonateBodySchema = z4.object({
  toUserId: z4.string().min(1),
  storyId: z4.string().optional(),
  amount: z4.coerce.number().int().min(1, 'Tối thiểu 1 xu'),
  message: z4.string().max(500).optional(),
  isAnonymous: z4.boolean().default(false),
})

export type DonateBodyType = z4.infer<typeof DonateBodySchema>
export class DonateBodyDTO extends createZodDto(DonateBodySchema) {}

// ==================== Withdraw ====================
export const WithdrawBodySchema = z4.object({
  amount: z4.coerce.number().int().min(200, 'Tối thiểu 200 xu để rút'),
  bankName: z4.string().min(2, 'Tên ngân hàng không hợp lệ'),
  accountNumber: z4.string().min(5, 'Số tài khoản không hợp lệ'),
  accountName: z4.string().min(2, 'Tên chủ tài khoản không hợp lệ'),
})

export type WithdrawBodyType = z4.infer<typeof WithdrawBodySchema>
export class WithdrawBodyDTO extends createZodDto(WithdrawBodySchema) {}
