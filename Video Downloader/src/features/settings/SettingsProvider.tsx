import { useMemo } from 'react';

import { useSettingsStore } from '@/src/store/settings-store';
import { getColors } from '@/src/theme/colors';

export function useSettings() {
  const theme = useSettingsStore((state) => state.theme);
  const colors = useMemo(() => getColors(theme === 'dark'), [theme]);
  const settings = useMemo(() => ({ theme }), [theme]);

  return { settings, colors };
}
