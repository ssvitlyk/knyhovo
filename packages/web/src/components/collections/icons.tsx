import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  Flame,
  Sparkles,
  BadgePercent,
  TrendingDown,
  Bookmark,
  ArrowDownToLine,
  Swords,
  Brain,
  BookOpen,
  ChartColumn,
  Rocket,
  Landmark,
  Palette,
  Microscope,
  Coffee,
  Moon,
  Compass,
  Plane,
  Lightbulb,
  Clock,
  Award,
  Heart,
  Eye,
  Search,
  Ghost,
  Feather,
  Star,
  TrendingUp,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Library,
  X,
  Book,
  ArrowUpDown,
  Check,
} from 'lucide-react';

/**
 * Frozen icon names from the design reference (`DynIcon`/`CNavIcon` in
 * collections-app.jsx / collections-nav.jsx) mapped to the closest
 * lucide-react line icon. Kept as a single lookup so every Collections
 * component references icons by the same frozen vocabulary.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  flame: Flame,
  sparkles: Sparkles,
  'badge-percent': BadgePercent,
  'trending-down': TrendingDown,
  bookmark: Bookmark,
  'arrow-down-to-line': ArrowDownToLine,
  swords: Swords,
  brain: Brain,
  'book-open': BookOpen,
  'chart-column': ChartColumn,
  rocket: Rocket,
  landmark: Landmark,
  palette: Palette,
  microscope: Microscope,
  coffee: Coffee,
  moon: Moon,
  compass: Compass,
  plane: Plane,
  lightbulb: Lightbulb,
  clock: Clock,
  award: Award,
  heart: Heart,
  eye: Eye,
  search: Search,
  ghost: Ghost,
  feather: Feather,
  star: Star,
  'trending-up': TrendingUp,
  'arrow-right': ArrowRight,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  library: Library,
  x: X,
  book: Book,
  'arrow-up-down': ArrowUpDown,
  check: Check,
};

export type CollectionIconName = keyof typeof ICONS;

export interface CollectionIconProps extends Omit<LucideProps, 'ref'> {
  readonly name: string;
}

/**
 * `<CollectionIcon name size />` — line-icon wrapper reused across every
 * Collections component so the frozen icon vocabulary lives in one place.
 * Unknown names render nothing rather than throwing (defensive against
 * backend-supplied icon slugs that don't have a mapped glyph yet).
 */
export function CollectionIcon({ name, size = 18, strokeWidth = 2, ...rest }: CollectionIconProps): React.JSX.Element | null {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" {...rest} />;
}
