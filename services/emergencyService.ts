import { Alert, Linking } from 'react-native';
export interface EmergencyContact {
  name: string;
  number: string;
  description: string;
}


export const getEmergencyNumbers = (): EmergencyContact[] => {
  // UK emergency numbers - customize based on user location
  return [
    {
      name: 'Emergency Services',
      number: '999',
      description: 'Police, Fire, Ambulance',
    },
    {
      name: 'Police Non-Emergency',
      number: '101',
      description: 'Report non-urgent crime',
    },
    {
      name: 'NHS 111',
      number: '111',
      description: 'Medical advice and support',
    },
  ];
};

export const callEmergency = async (number: string): Promise<void> => {
  try {
    const url = `tel:${number}`;
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      Alert.alert(
        'Call Emergency Services',
        `Are you sure you want to call ${number}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Call',
            style: 'destructive',
            onPress: () => Linking.openURL(url),
          },
        ]
      );
    } else {
      Alert.alert('Error', 'Cannot make phone calls on this device');
    }
  } catch (error) {
    console.error('Error making emergency call:', error);
    Alert.alert('Error', 'Failed to initiate call');
  }
};