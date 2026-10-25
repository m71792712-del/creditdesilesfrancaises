import { z } from 'zod';

export const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/;

const name = z.string().trim().min(2, 'v.name').max(60, 'v.name');
const email = z.string().trim().toLowerCase().email('v.email').max(254, 'v.email');
const password = z
  .string()
  .min(8, 'v.password.min')
  .max(72, 'v.password.max')
  .regex(/[A-Za-z]/, 'v.password.letter')
  .regex(/\d/, 'v.password.digit');
const demoColor = z.string().trim().min(1, 'v.required').max(30, 'v.max');
const demoCity = z.string().trim().min(1, 'v.required').max(60, 'v.max');
const phone = z.string().trim().regex(PHONE_RE, 'v.phone');

export const registerSchema = z.object({
  lastName: name,
  firstName: name,
  phone,
  email,
  demoColor,
  demoCity,
  
  password,
  terms: z.literal('on', { errorMap: () => ({ message: 'v.terms' }) }),
});

export const loginSchema = z.object({ email, password: z.string().min(1, 'v.required').max(72, 'v.password.max') });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ password });

export const profileSchema = z.object({
  lastName: name,
  firstName: name,
  phone,
  demoColor: demoColor.or(z.literal('')),
  demoCity: demoCity.or(z.literal('')),
  demoDigit: z.string().regex(/^[0-9]?$/, 'v.digit'),
});