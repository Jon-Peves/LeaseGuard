import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { latestInvite } from '../../data/demoStore';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'InviteEmail'>;

export default function InviteEmailScreen({ navigation }: Props) {
  const invite = latestInvite();
  const place = [invite.street, `Unit ${invite.unit}`].join(', ');

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Invite email"
        subtitle="Demo preview of the email your tenant receives."
        onBack={() => navigation.goBack()}
      />
      <View style={styles.email}>
        <View style={styles.header}>
          <Text style={styles.inbox}>INBOX</Text>
          <Text accessibilityRole="header" style={styles.subject}>
            {`${invite.landlordName} invited you to LeaseGuard`}
          </Text>
          <View style={styles.from}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>LG</Text>
            </View>
            <View>
              <Text style={styles.sender}>LeaseGuard</Text>
              <Text style={styles.to}>{`to ${invite.email}`}</Text>
            </View>
          </View>
        </View>
        <View style={styles.body}>
          <Text style={styles.paragraph}>Hi,</Text>
          <Text style={styles.paragraph}>
            {invite.landlordName} added you as the tenant for{' '}
            <Text style={styles.bold}>{place}</Text>
            {invite.city ? ` in ${invite.city}.` : '.'}
          </Text>
          <Text style={styles.paragraph}>
            LeaseGuard keeps a shared record of your unit's condition, so
            move-in and move-out are fair for both of you.
          </Text>
          <View style={styles.note}>
            <Text style={styles.noteTitle}>Sign up with this email</Text>
            <Text style={styles.noteBody}>
              That's how we link your account to Unit {invite.unit}.
            </Text>
          </View>
          <ActionButton
            title="Accept invite"
            onPress={() => navigation.navigate('RegisterInvite')}
          />
          <Text style={styles.fine}>
            Not expecting this? You can ignore this email. Nothing is shared
            until you create an account.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  email: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  header: {
    gap: 8,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  inbox: {
    fontSize: 11,
    fontWeight: typography.semibold,
    letterSpacing: 0.6,
    color: colors.muted,
  },
  subject: { fontSize: 19, fontWeight: typography.bold, color: colors.ink },
  from: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: typography.bold,
    color: colors.white,
  },
  sender: { fontSize: 13, fontWeight: typography.semibold, color: colors.ink },
  to: { fontSize: 12, color: colors.muted },
  body: { gap: 14, padding: 18 },
  paragraph: { fontSize: 15, lineHeight: 22, color: colors.ink },
  bold: { fontWeight: typography.bold },
  note: {
    gap: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  noteBody: { fontSize: 13, color: colors.muted },
  fine: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
