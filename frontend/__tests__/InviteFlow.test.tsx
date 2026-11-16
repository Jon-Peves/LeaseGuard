import React from 'react';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, Image, Text, TextInput } from 'react-native';
import { AuthProvider } from '../src/context/AuthContext';
import { resetDemoStore } from '../src/data/demoStore';
import RootNavigator from '../src/navigation/RootNavigator';
import { launchCamera } from 'react-native-image-picker';
import * as auth from '../src/services/authService';
import type { User } from '../src/types/user';
import AddPropertyScreen from '../src/screens/landlord/AddPropertyScreen';
import EditUnitScreen from '../src/screens/landlord/EditUnitScreen';
import RegisterScreen from '../src/screens/auth/RegisterScreen';
import RegisterFromInviteScreen from '../src/screens/auth/RegisterFromInviteScreen';
import TenantDashboardScreen from '../src/screens/tenant/TenantDashboardScreen';

jest.mock('../src/services/authService');

const landlord: User = {
  id: 'landlord-1',
  name: 'Marcus Reed',
  email: 'marcus@example.com',
  role: 'landlord',
};
const newTenant: User = {
  id: 'tenant-new',
  name: 'Jordan Lee',
  email: 'jordan.lee@example.com',
  role: 'tenant',
};

let app: ReactTestRenderer;
const navigation =
  createNavigationContainerRef<Record<string, object | undefined>>();

beforeEach(() => {
  resetDemoStore();
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(auth.logout).mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
  if (app) await act(async () => app.unmount());
  jest.useRealTimers();
});

async function mount(user: User | null) {
  jest.mocked(auth.getSession).mockResolvedValue(user);
  await act(async () => {
    app = create(
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer ref={navigation}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>,
    );
  });
  await act(async () => app.root.findByType(Image).props.onLoadEnd());
  await act(async () => jest.advanceTimersByTime(1500));
}
const json = () => JSON.stringify(app.toJSON());
const route = () => navigation.getCurrentRoute()?.name;

async function press(label: string, scope: ReactTestInstance = app.root) {
  const target = scope
    .findAll(n => typeof n.props.onPress === 'function')
    .find(
      n =>
        n.props.accessibilityLabel === label ||
        n
          .findAllByType(Text)
          .some(t => [t.props.children].flat(Infinity).join('') === label),
    );
  if (!target) throw new Error(`No pressable "${label}" on ${route()}`);
  await act(async () => {
    target!.props.onPress();
  });
}
async function fill(scope: ReactTestInstance, values: Record<string, string>) {
  await act(async () => {
    for (const [label, value] of Object.entries(values)) {
      scope
        .findAllByType(TextInput)
        .find(n => n.props.accessibilityLabel === label)!
        .props.onChangeText(value);
    }
  });
}
async function acceptConsent() {
  await press('I agree to the privacy and consent policy.');
  await press('Accept and continue');
}
async function logOut() {
  await press('Settings');
  await press('Log out');
}
async function inviteFromLandlord(email: string, street: string) {
  await mount(landlord);
  await acceptConsent();
  await press('+ Add property');
  await fill(app.root.findByType(AddPropertyScreen), {
    'Property address': street,
    Unit: '1A',
    Bedrooms: '2',
    Bathrooms: '1',
    'Tenant email': email,
  });
  await press('Save & send invite');
  await logOut();
}
async function signIn(user: User) {
  jest.mocked(auth.login).mockResolvedValueOnce(user);
  await fill(app.root, { Email: user.email, Password: 'fixture-password' });
  await press('Login');
}

it('links a tenant who registers from the landlord invite and shows them as joined', async () => {
  await mount(landlord);
  await acceptConsent();
  await press('+ Add property');
  await fill(app.root.findByType(AddPropertyScreen), {
    'Property address': '44 Maple St, Hicksville, NY',
    Unit: '2B',
    Bedrooms: '2',
    Bathrooms: '1',
    'Tenant email': newTenant.email,
  });
  await press('Save & send invite');
  expect(json()).toContain('PENDING');
  await logOut();
  expect(route()).toBe('Login');

  await press('Open invite email (demo)');
  expect(route()).toBe('InviteEmail');
  expect(json()).toContain('Marcus Reed invited you to LeaseGuard');
  expect(json()).toContain(newTenant.email);
  await press('Accept invite');
  expect(route()).toBe('RegisterInvite');

  const form = app.root.findByType(RegisterFromInviteScreen);
  expect(
    form
      .findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === 'Email')!.props.editable,
  ).toBe(false);
  await press('Create account', form);
  expect(json()).toContain('Enter your full name');
  jest.mocked(auth.register).mockResolvedValueOnce(newTenant);
  jest.mocked(auth.login).mockResolvedValueOnce(newTenant);
  await fill(form, {
    'Full name': 'Jordan Lee',
    Password: 'longpassword',
    'Confirm password': 'longpassword',
  });
  await press('Create account', form);
  expect(auth.register).toHaveBeenCalledWith(
    expect.objectContaining({ email: newTenant.email, role: 'tenant' }),
    expect.anything(),
  );

  expect(route()).toBe('TenantWelcome');
  expect(json()).toContain("You're all set, Jordan");
  expect(json()).toContain('44 Maple St, Hicksville');
  expect(json()).toContain('2 beds, 1 bath');
  await press('Continue');
  expect(route()).toBe('TenantConsent');
  await acceptConsent();
  expect(route()).toBe('Home');
  expect(json()).toContain('44 Maple St • Unit 2B');
  expect(json()).toContain('Move-in baseline coming soon');
  expect(json()).toContain('Nothing here yet');

  await logOut();
  await signIn(landlord);
  expect(route()).toBe('Dashboard');
  expect(json()).toContain('JOINED');
  expect(json()).toContain('Jordan Lee joined Unit 2B');
});

it('shows a tenant without an invite the waiting screen until one arrives', async () => {
  const loner: User = {
    ...newTenant,
    id: 'tenant-2',
    email: 'sam@example.com',
    name: 'Sam Park',
  };
  jest.mocked(auth.register).mockResolvedValueOnce(loner);
  await mount(null);
  await press('Register');
  await press('Tenant');
  await fill(app.root.findByType(RegisterScreen), {
    'Full name': 'Sam Park',
    Email: loner.email,
    Password: 'longpassword',
    'Confirm password': 'longpassword',
  });
  await press('Create account');
  await press('Back to sign in');
  await signIn(loner);
  await acceptConsent();
  const dashboard = app.root.findByType(TenantDashboardScreen);
  expect(json()).toContain('No unit linked yet');
  expect(json()).toContain(loner.email);
  await press('Check again', dashboard);
  expect(json()).toContain('No invite yet for this email.');
  await press('Sign in with another email', dashboard);
  expect(route()).toBe('Login');

  await signIn(landlord);
  await acceptConsent();
  await press('+ Add property');
  await fill(app.root.findByType(AddPropertyScreen), {
    'Property address': '9 Elm Rd',
    Unit: '3',
    Bedrooms: '1',
    Bathrooms: '1',
    'Tenant email': loner.email,
  });
  await press('Save & send invite');
  await logOut();

  await signIn(loner);
  expect(route()).toBe('TenantInvite');
  await press('Accept invite');
  expect(route()).toBe('TenantWelcome');
  expect(json()).toContain("You're all set, Sam");
});

it('lets the landlord fix a typo in a pending invite, resend it, and cancel it', async () => {
  await mount(landlord);
  await acceptConsent();
  await press('+ Add property');
  await fill(app.root.findByType(AddPropertyScreen), {
    'Property address': '18 Cedar Ave, Farmingdale, NY',
    Unit: '1A',
    Bedrooms: '1',
    Bathrooms: '1',
    'Tenant email': 'jordan.le@example.com',
  });
  await press('Save & send invite');
  await press('Open 18 Cedar Ave');
  const screen = app.root.findByType(EditUnitScreen);
  expect(json()).toContain('Fix a typo here');
  await fill(screen, { 'Invited email': 'not-an-email' });
  await press('Save changes', screen);
  expect(route()).toBe('EditUnit');
  await fill(screen, { 'Invited email': newTenant.email });
  await press('Save changes', screen);
  expect(route()).toBe('Dashboard');
  expect(json()).toContain(`Unit 1A • ${newTenant.email}`);
  expect(json()).not.toContain('jordan.le@example.com');
  await logOut();
  await press('Open invite email (demo)');
  expect(json()).toContain(`to ${newTenant.email}`);
});

it('cancels a pending invite so the unit shows as vacant', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount(landlord);
  await acceptConsent();
  await press('+ Add property');
  await fill(app.root.findByType(AddPropertyScreen), {
    'Property address': '18 Cedar Ave',
    Unit: '1A',
    Bedrooms: '1',
    Bathrooms: '1',
    'Tenant email': newTenant.email,
  });
  await press('Save & send invite');
  await press('Open 18 Cedar Ave');
  await press('Cancel invite', app.root.findByType(EditUnitScreen));
  const buttons = alert.mock.calls[0][2]!;
  await act(async () =>
    buttons.find(b => b.text === 'Cancel invite')!.onPress!(),
  );
  expect(json()).toContain('Tenant email');
  await act(async () => navigation.goBack());
  expect(json()).toContain('VACANT');
});

it('asks an existing tenant to accept an invite before linking them', async () => {
  const cruz: User = {
    id: 'tenant-cruz',
    name: 'Cruz Diaz',
    email: 'cruz@example.com',
    role: 'tenant',
  };
  await inviteFromLandlord('Cruz@Example.com', '12 Crossroad Ln');

  await signIn(cruz);
  expect(route()).toBe('TenantInvite');
  expect(json()).toContain("You've been invited");
  expect(json()).toContain(
    'Marcus Reed added you as the tenant for 12 Crossroad Ln, Unit 1A.',
  );
  await press('Accept invite');
  expect(route()).toBe('TenantWelcome');
  await press('Continue');
  await acceptConsent();
  expect(json()).toContain('12 Crossroad Ln • Unit 1A');
  expect(json()).not.toContain('Kitchen sink leak');

  await logOut();
  await signIn(landlord);
  expect(json()).toContain('JOINED');
  expect(json()).toContain('Unit 1A • Cruz Diaz');
});

it('lets an existing tenant decline, and shows the landlord it was declined', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const cruz: User = {
    id: 'tenant-cruz',
    name: 'Cruz Diaz',
    email: 'cruz@example.com',
    role: 'tenant',
  };
  await inviteFromLandlord(cruz.email, '12 Crossroad Ln');
  await signIn(cruz);
  expect(route()).toBe('TenantInvite');
  await press('Decline');
  const buttons = alert.mock.calls[alert.mock.calls.length - 1][2]!;
  await act(async () => buttons.find(b => b.text === 'Decline')!.onPress!());
  expect(route()).toBe('TenantConsent');
  await acceptConsent();
  expect(json()).not.toContain('12 Crossroad Ln');

  await logOut();
  await signIn(landlord);
  expect(json()).toContain('DECLINED');
  expect(json()).toContain('Cruz Diaz declined the invite for Unit 1A');
  await press('Open 12 Crossroad Ln');
  expect(json()).toContain('Check the email and resend');
});

it('shares the landlord baseline photos with the tenant and saves their own photos', async () => {
  let shot = 0;
  jest.mocked(launchCamera).mockImplementation(async () => ({
    assets: [{ uri: `file://photo-${++shot}.jpg` }],
  }));
  await mount(landlord);
  await acceptConsent();
  await press('+ Add property');
  await fill(app.root.findByType(AddPropertyScreen), {
    'Property address': '44 Maple St, Hicksville, NY',
    Unit: '2B',
    Bedrooms: '2',
    Bathrooms: '1',
    'Tenant email': newTenant.email,
  });
  await press('Save & send invite');
  await press('Record baseline');
  await press('Start tour');
  for (let i = 0; i < 4; i++) await press('Capture photo');
  await press('Save baseline');
  await logOut();

  await signIn(newTenant);
  await press('Accept invite');
  await press('Continue');
  await acceptConsent();
  expect(json()).toContain('Review your move-in baseline');
  await press('Review baseline');
  expect(route()).toBe('TenantBaseline');
  expect(json()).toContain('Recorded by Marcus Reed');
  expect(
    app.root.findAll(n => n.props.accessibilityLabel === 'Kitchen sink photo')
      .length,
  ).toBeGreaterThan(0);
  await press('Add my own photos');
  expect(json()).toContain('FOR YOUR RECORDS');
  await press('Capture photo');
  expect(json()).toContain('Step 2 of 4');
  await press('Finish later');
  expect(route()).toBe('Home');
  expect(json()).toContain('Review your move-in baseline');
  await press('Review baseline');
  await press('Looks right');
  expect(json()).toContain('Move-in baseline reviewed');
  expect(json()).toContain('You added 1 photo for your records');
});
