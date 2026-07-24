import { getCurrentWindow } from '@tauri-apps/api/window';

export function setupWindowControls(): () => void {
  const handleEscapeKey = async (event: KeyboardEvent): Promise<void> => {
    if (event.key === 'Escape') {
      event.preventDefault();
      try {
        await getCurrentWindow().minimize();
      } catch (error) {
        console.error('Failed to minimize window:', error);
      }
    }
  };

  window.addEventListener('keydown', handleEscapeKey);

  return () => {
    window.removeEventListener('keydown', handleEscapeKey);
  };
}
