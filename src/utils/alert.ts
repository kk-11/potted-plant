import { Alert, Platform } from 'react-native';

export const showAlert = (
  title: string,
  message?: string,
  buttons?: Array<{ text: string; style?: string; onPress?: () => void }>
) => {
  if (Platform.OS === 'web') {
    const fullMessage = message ? `${title}\n\n${message}` : title;

    if (buttons && buttons.length > 1) {
      // Use confirm for dialogs with multiple buttons
      const confirmed = window.confirm(fullMessage);
      if (confirmed) {
        // Find the action button (not cancel)
        const actionButton = buttons.find(b => b.style !== 'cancel' && b.onPress);
        if (actionButton?.onPress) {
          actionButton.onPress();
        }
      }
    } else {
      // Use alert for single button dialogs
      window.alert(fullMessage);
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};
