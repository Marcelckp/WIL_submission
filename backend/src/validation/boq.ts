import { z } from 'zod';

export const BoqItemSchema = z.object({
  sapNumber: z.string().min(1),
  shortDescription: z.string().min(1),
  rate: z.string().regex(/^[-+]?[0-9]*[.,]?[0-9]+$/),
  unit: z.string().min(1),
  category: z.string().optional(),
});

export type BoqItem = z.infer<typeof BoqItemSchema>;

export type BoqValidationIssue = {
  row: number;
  column?: string;
  message: string;
};

export type BoqValidationResult = {
  items: BoqItem[];
  issues: BoqValidationIssue[];
  counts: { totalRows: number; ok: number; errors: number; duplicates: number };
};

export const REQUIRED_HEADERS = ['SAP #', 'SHORT DESCRIPTION', 'RATE', 'UNIT'];


