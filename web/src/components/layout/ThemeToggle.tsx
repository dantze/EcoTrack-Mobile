/**
 * Light / dark / system, in the top bar.
 *
 * Three states rather than a two-way switch: "system" is the setting most
 * people actually want, and a toggle that silently pins the theme is why an
 * app stops following a laptop's sunset switch.
 */

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Luminos', icon: Sun },
  { value: 'dark', label: 'Întunecat', icon: Moon },
  { value: 'system', label: 'Ca sistemul', icon: Monitor },
];

export function ThemeToggle() {
  const { preference, scheme, setPreference } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Temă: ${OPTIONS.find((o) => o.value === preference)?.label}`}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {scheme === 'dark' ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Temă</DropdownMenuLabel>
        <DropdownMenuGroup>
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem key={option.value} onSelect={() => setPreference(option.value)}>
                <Icon />
                <span className="flex-1">{option.label}</span>
                {preference === option.value && <Check className="size-3.5 opacity-70" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
