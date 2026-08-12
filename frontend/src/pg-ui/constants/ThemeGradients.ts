import type { ColorTheme } from '@/app/providers/theme-provider'

export type GradientVariant = 'ad' | 'banner'

interface GradientConfig {
  light: string
  dark: string
}

const adGradients: Record<ColorTheme, GradientConfig> = {
  default: {
    light: 'bg-gradient-to-r from-blue-100/90 via-indigo-100/90 to-blue-100/90',
    dark: 'bg-gradient-to-r from-blue-950/50 via-indigo-950/50 to-blue-950/50',
  },
  red: {
    light: 'bg-gradient-to-r from-red-100/90 via-rose-100/90 to-red-100/90',
    dark: 'bg-gradient-to-r from-red-950/50 via-rose-950/50 to-red-950/50',
  },
  rose: {
    light: 'bg-gradient-to-r from-rose-100/90 via-pink-100/90 to-rose-100/90',
    dark: 'bg-gradient-to-r from-rose-950/50 via-pink-950/50 to-rose-950/50',
  },
  orange: {
    light: 'bg-gradient-to-r from-orange-100/90 via-amber-100/90 to-orange-100/90',
    dark: 'bg-gradient-to-r from-orange-950/50 via-amber-950/50 to-orange-950/50',
  },
  green: {
    light: 'bg-gradient-to-r from-green-100/90 via-emerald-100/90 to-green-100/90',
    dark: 'bg-gradient-to-r from-green-950/50 via-emerald-950/50 to-green-950/50',
  },
  blue: {
    light: 'bg-gradient-to-r from-blue-100/90 via-cyan-100/90 to-blue-100/90',
    dark: 'bg-gradient-to-r from-blue-950/50 via-cyan-950/50 to-blue-950/50',
  },
  yellow: {
    light: 'bg-gradient-to-r from-yellow-100/90 via-amber-100/90 to-yellow-100/90',
    dark: 'bg-gradient-to-r from-yellow-950/50 via-amber-950/50 to-yellow-950/50',
  },
  violet: {
    light: 'bg-gradient-to-r from-violet-100/90 via-purple-100/90 to-violet-100/90',
    dark: 'bg-gradient-to-r from-violet-950/50 via-purple-950/50 to-violet-950/50',
  },
  purple: { light: 'from-purple-500/15 via-purple-400/10 to-transparent', dark: 'from-purple-400/20 via-purple-500/10 to-transparent' },
  zinc: { light: 'from-zinc-500/15 via-zinc-400/10 to-transparent', dark: 'from-zinc-400/20 via-zinc-500/10 to-transparent' },
  neutral: { light: 'from-neutral-500/15 via-neutral-400/10 to-transparent', dark: 'from-neutral-400/20 via-neutral-500/10 to-transparent' },
  slate: { light: 'from-slate-500/15 via-slate-400/10 to-transparent', dark: 'from-slate-400/20 via-slate-500/10 to-transparent' },
  stone: { light: 'from-stone-500/15 via-stone-400/10 to-transparent', dark: 'from-stone-400/20 via-stone-500/10 to-transparent' },
}

const bannerGradients: Record<ColorTheme, GradientConfig> = {
  default: {
    light: 'bg-gradient-to-r from-blue-50/95 via-indigo-50/95 to-blue-50/95 border-blue-500/30',
    dark: 'bg-gradient-to-r from-blue-950/60 via-indigo-950/60 to-blue-950/60 border-blue-400/30',
  },
  red: {
    light: 'bg-gradient-to-r from-red-50/95 via-rose-50/95 to-red-50/95 border-red-500/30',
    dark: 'bg-gradient-to-r from-red-950/60 via-rose-950/60 to-red-950/60 border-red-400/30',
  },
  rose: {
    light: 'bg-gradient-to-r from-rose-50/95 via-pink-50/95 to-rose-50/95 border-rose-500/30',
    dark: 'bg-gradient-to-r from-rose-950/60 via-pink-950/60 to-rose-950/60 border-rose-400/30',
  },
  orange: {
    light: 'bg-gradient-to-r from-orange-50/95 via-amber-50/95 to-orange-50/95 border-orange-500/30',
    dark: 'bg-gradient-to-r from-orange-950/60 via-amber-950/60 to-orange-950/60 border-orange-400/30',
  },
  green: {
    light: 'bg-gradient-to-r from-green-50/95 via-emerald-50/95 to-green-50/95 border-green-500/30',
    dark: 'bg-gradient-to-r from-green-950/60 via-emerald-950/60 to-green-950/60 border-green-400/30',
  },
  blue: {
    light: 'bg-gradient-to-r from-blue-50/95 via-cyan-50/95 to-blue-50/95 border-blue-500/30',
    dark: 'bg-gradient-to-r from-blue-950/60 via-cyan-950/60 to-blue-950/60 border-blue-400/30',
  },
  yellow: {
    light: 'bg-gradient-to-r from-yellow-50/95 via-amber-50/95 to-yellow-50/95 border-yellow-500/30',
    dark: 'bg-gradient-to-r from-yellow-950/60 via-amber-950/60 to-yellow-950/60 border-yellow-400/30',
  },
  violet: {
    light: 'bg-gradient-to-r from-violet-50/95 via-purple-50/95 to-violet-50/95 border-violet-500/30',
    dark: 'bg-gradient-to-r from-violet-950/60 via-purple-950/60 to-violet-950/60 border-violet-400/30',
  },
  purple: { light: 'from-purple-500/10 via-purple-400/10 to-transparent', dark: 'from-purple-400/15 via-purple-500/10 to-transparent' },
  zinc: { light: 'from-zinc-500/10 via-zinc-400/10 to-transparent', dark: 'from-zinc-400/15 via-zinc-500/10 to-transparent' },
  neutral: { light: 'from-neutral-500/10 via-neutral-400/10 to-transparent', dark: 'from-neutral-400/15 via-neutral-500/10 to-transparent' },
  slate: { light: 'from-slate-500/10 via-slate-400/10 to-transparent', dark: 'from-slate-400/15 via-slate-500/10 to-transparent' },
  stone: { light: 'from-stone-500/10 via-stone-400/10 to-transparent', dark: 'from-stone-400/15 via-stone-500/10 to-transparent' },
}

const indicatorColors: Record<ColorTheme, GradientConfig> = {
  default: { light: 'bg-blue-500', dark: 'bg-blue-400' },
  red: { light: 'bg-red-500', dark: 'bg-red-400' },
  rose: { light: 'bg-rose-500', dark: 'bg-rose-400' },
  orange: { light: 'bg-orange-500', dark: 'bg-orange-400' },
  green: { light: 'bg-green-500', dark: 'bg-green-400' },
  blue: { light: 'bg-blue-500', dark: 'bg-blue-400' },
  yellow: { light: 'bg-yellow-500', dark: 'bg-yellow-400' },
  violet: { light: 'bg-violet-500', dark: 'bg-violet-400' },
  purple: { light: 'bg-purple-500', dark: 'bg-purple-400' },
  zinc: { light: 'bg-zinc-500', dark: 'bg-zinc-400' },
  neutral: { light: 'bg-neutral-500', dark: 'bg-neutral-400' },
  slate: { light: 'bg-slate-500', dark: 'bg-slate-400' },
  stone: { light: 'bg-stone-500', dark: 'bg-stone-400' },
}

/**
 * Get gradient classes based on color theme and variant
 * @param colorTheme - The color theme to use
 * @param isDark - Whether dark mode is active
 * @param variant - The gradient variant ('ad' for topbar ads, 'banner' for version banners)
 * @returns Tailwind CSS classes for the gradient
 */
export function getGradientByColorTheme(colorTheme: ColorTheme, isDark: boolean, variant: GradientVariant = 'ad'): string {
  const gradients = variant === 'ad' ? adGradients : bannerGradients
  return isDark ? gradients[colorTheme].dark : gradients[colorTheme].light
}

/**
 * Get indicator color class based on color theme
 * @param colorTheme - The color theme to use
 * @param isDark - Whether dark mode is active
 * @returns Tailwind CSS class for the indicator color
 */
export function getIndicatorColorByTheme(colorTheme: ColorTheme, isDark: boolean): string {
  return isDark ? indicatorColors[colorTheme].dark : indicatorColors[colorTheme].light
}
