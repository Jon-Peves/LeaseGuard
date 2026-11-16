import { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import Field from '../../components/Field';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useLandlordDemo } from '../../context/LandlordDemoContext';
import type { LandlordStackParamList } from '../../navigation/types';
import {
  bathroomCountError,
  bedroomCountError,
} from '../../utils/landlordValidation';
import { emailError } from '../../utils/validation';

type Props = NativeStackScreenProps<LandlordStackParamList, 'AddProperty'>;

export default function AddPropertyScreen({ navigation }: Props) {
  const { addProperty } = useLandlordDemo();
  const [address, setAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    address: address.trim() ? undefined : 'Enter the property address.',
    unit: unit.trim() ? undefined : 'Enter a unit name or number.',
    bedrooms: bedroomCountError(bedrooms),
    bathrooms: bathroomCountError(bathrooms),
    tenantEmail: tenantEmail.trim() ? emailError(tenantEmail) : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (error?: string) => (submitted ? error : undefined);

  function save() {
    setSubmitted(true);
    if (hasErrors) return;
    Keyboard.dismiss();
    addProperty({ address, unit, bedrooms, bathrooms, tenantEmail });
    navigation.popTo('Dashboard');
  }

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Add property"
        subtitle="Create the property and unit, then invite your tenant."
        onBack={() => navigation.popTo('Dashboard')}
      />
      <Field
        label="Property address"
        placeholder="18 Cedar Ave, Farmingdale, NY"
        value={address}
        onChangeText={setAddress}
        error={show(errors.address)}
        autoCapitalize="words"
        autoComplete="street-address"
      />
      <Field
        label="Unit"
        placeholder="1A"
        value={unit}
        onChangeText={setUnit}
        error={show(errors.unit)}
        autoCapitalize="characters"
      />
      <View style={styles.row}>
        <Field
          label="Bedrooms"
          placeholder="1"
          value={bedrooms}
          onChangeText={setBedrooms}
          error={show(errors.bedrooms)}
          keyboardType="number-pad"
          containerStyle={styles.half}
        />
        <Field
          label="Bathrooms"
          placeholder="1"
          value={bathrooms}
          onChangeText={setBathrooms}
          error={show(errors.bathrooms)}
          keyboardType="decimal-pad"
          containerStyle={styles.half}
        />
      </View>
      <Field
        label="Tenant email"
        placeholder="tenant@example.com"
        value={tenantEmail}
        onChangeText={setTenantEmail}
        error={show(errors.tenantEmail)}
        hint="Optional. We'll email an invite, and they'll be linked to this unit when they sign up."
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <View style={styles.actions}>
        <ActionButton
          title={tenantEmail.trim() ? 'Save & send invite' : 'Save property'}
          onPress={save}
        />
        <ActionButton
          title="Cancel"
          variant="secondary"
          onPress={() => navigation.popTo('Dashboard')}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  actions: { gap: 10, marginTop: 16 },
});
