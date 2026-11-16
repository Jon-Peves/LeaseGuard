import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import Field from '../../components/Field';
import Icon from '../../components/Icon';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { acceptInvite, latestInvite, saveTenant } from '../../data/demoStore';
import type { AuthStackParamList } from '../../navigation/types';
import { login, register } from '../../services/authService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useAuthRequest } from '../../utils/useAuthRequest';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterInvite'>;

export default function RegisterFromInviteScreen({ navigation }: Props) {
  const invite = latestInvite();
  const { completeSignIn } = useAuth();
  const request = useAuthRequest();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    name:
      !name.trim() || name.trim().length > 150
        ? 'Enter your full name (up to 150 characters).'
        : undefined,
    password:
      password.length < 8
        ? 'Use at least 8 characters.'
        : password.length > 4096
        ? 'Use no more than 4096 characters.'
        : undefined,
    confirm: !confirmPassword
      ? 'Confirm your password.'
      : password !== confirmPassword
      ? 'Passwords do not match.'
      : undefined,
  };
  const show = (error?: string) => (submitted ? error : undefined);

  function submit() {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    Keyboard.dismiss();
    request.run(
      async signal => {
        await register(
          {
            name,
            email: invite.email,
            password,
            confirmPassword,
            role: 'tenant',
          },
          signal,
        );
        return login(invite.email, password, signal);
      },
      user => {
        acceptInvite(invite, name);
        saveTenant(user.id, { consented: false, welcomed: false });
        completeSignIn(user);
      },
    );
  }

  return (
    <ScreenContainer style={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.brand}>LeaseGuard</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Create your account
        </Text>
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Icon name="home" size={16} color={colors.brand} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.bannerTitle}>
            Invited as tenant by {invite.landlordName}
          </Text>
          <Text style={styles.bannerDetail}>
            {invite.street} • Unit {invite.unit}
          </Text>
        </View>
      </View>

      <Field
        label="Full name"
        placeholder="Your full name"
        value={name}
        onChangeText={setName}
        error={show(errors.name)}
        autoCapitalize="words"
        autoComplete="name"
      />
      <View style={styles.locked}>
        <Field
          label="Email"
          value={invite.email}
          editable={false}
          hint={`From your invite. This links your account to Unit ${invite.unit}.`}
          style={styles.lockedInput}
        />
      </View>
      <Field
        label="Password"
        placeholder="Create a password"
        value={password}
        onChangeText={setPassword}
        error={show(errors.password)}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
      />
      <Field
        label="Confirm password"
        placeholder="Confirm your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={show(errors.confirm)}
        secureTextEntry
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={submit}
      />

      {request.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {request.error}
        </Text>
      ) : null}

      <ActionButton
        title={request.loading ? 'Creating account…' : 'Create account'}
        disabled={request.loading}
        onPress={submit}
        style={styles.submit}
      />
      <View style={styles.signIn}>
        <Text style={styles.signInText}>Already have an account? </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          onPress={() => navigation.popTo('Login')}
        >
          <Text style={styles.signInLink}>Sign in</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    gap: 16,
  },
  heading: { gap: 2 },
  brand: { fontSize: 20, fontWeight: typography.bold, color: colors.navy },
  title: {
    fontSize: 26,
    fontWeight: typography.bold,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  bannerTitle: {
    fontSize: 13,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  bannerDetail: { fontSize: 12, color: colors.muted },
  locked: { opacity: 1 },
  lockedInput: { backgroundColor: '#EEF1F5', color: colors.muted },
  error: { fontSize: 13, lineHeight: 18, color: colors.error },
  submit: { marginTop: 6 },
  signIn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: { fontSize: 13, color: colors.muted },
  signInLink: {
    fontSize: 13,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
});
