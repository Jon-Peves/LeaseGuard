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
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { AuthProvider } from '../src/context/AuthContext';
import { getLandlord, resetDemoStore } from '../src/data/demoStore';
import RootNavigator from '../src/navigation/RootNavigator';
import type { LandlordStackParamList } from '../src/navigation/types';
import type { User } from '../src/types/user';
import * as auth from '../src/services/authService';
import { ApiError } from '../src/services/api';
import Button from '../src/components/Button';
import Header from '../src/components/Header';
import BackButton from '../src/components/BackButton';
import NotificationBell from '../src/components/NotificationBell';
import BottomNavigation from '../src/components/BottomNavigation';
import UnitChip from '../src/components/UnitChip';
import LoginScreen from '../src/screens/auth/LoginScreen';
import LandlordDashboardScreen from '../src/screens/landlord/LandlordDashboardScreen';
import AddPropertyScreen from '../src/screens/landlord/AddPropertyScreen';
import EditUnitScreen from '../src/screens/landlord/EditUnitScreen';
import AddAreaSheet from '../src/screens/landlord/AddAreaSheet';
import ScheduleInspectionScreen from '../src/screens/landlord/ScheduleInspectionScreen';
import AIInspectionReviewScreen from '../src/screens/landlord/AIInspectionReviewScreen';
import ConditionHistoryScreen from '../src/screens/landlord/ConditionHistoryScreen';
import NotificationsScreen from '../src/screens/shared/NotificationsScreen';
import SettingsScreen from '../src/screens/shared/SettingsScreen';
import {
  bedroomCountError,
  bathroomCountError,
  inspectionDateError,
  formatLocalDate,
} from '../src/utils/landlordValidation';

jest.mock('../src/services/authService');
const landlord: User = {
  id: '000000000000000000000002',
  name: 'Alex Owner',
  email: 'owner@example.com',
  role: 'landlord',
};
const tenant: User = {
  id: '000000000000000000000001',
  name: 'Test Tenant',
  email: 'tenant@example.com',
  role: 'tenant',
};
let app: ReactTestRenderer;
let navigation: ReturnType<
  typeof createNavigationContainerRef<LandlordStackParamList>
>;
let alert: jest.SpyInstance;
beforeEach(() => {
  resetDemoStore();
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(auth.getSession).mockReset();
  jest.mocked(auth.logout).mockReset().mockResolvedValue(undefined);
  navigation = createNavigationContainerRef<LandlordStackParamList>();
  alert = jest.spyOn(Alert, 'alert');
});
afterEach(async () => {
  if (app) await act(async () => app.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});
async function mount(user: User | null = landlord, consent = true) {
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
  if (consent && user?.role) await acceptConsent();
}
async function acceptConsent() {
  await press('I agree to the privacy and consent policy.');
  await press('Accept and continue');
}
async function go(route: keyof LandlordStackParamList) {
  await act(async () => navigation.navigate(route as never));
}
async function addSampleProperty(email = 'alyssa.patel@example.com') {
  await press('+ Add property');
  const form = app.root.findByType(AddPropertyScreen);
  await fill(form, {
    'Property address': '18 Cedar Ave, Farmingdale, NY',
    Unit: '1A',
    Bedrooms: '1',
    Bathrooms: '1',
    'Tenant email': email,
  });
  await press(email ? 'Save & send invite' : 'Save property', form);
}
function json() {
  return JSON.stringify(app.toJSON());
}
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
  expect(target).toBeDefined();
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

it('asks a landlord for consent before showing the empty dashboard', async () => {
  await mount(null);
  jest.mocked(auth.login).mockResolvedValueOnce(landlord);
  const login = app.root.findByType(LoginScreen);
  await fill(login, { Email: landlord.email, Password: 'fixture-password' });
  await act(async () => login.findByType(Button).props.onPress());
  expect(navigation.getCurrentRoute()?.name).toBe('Consent');
  const accept = app.root
    .findAll(n => n.props.accessibilityLabel === 'Accept and continue')
    .find(n => n.props.accessibilityState);
  expect(accept?.props.accessibilityState.disabled).toBe(true);
  await acceptConsent();
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
  expect(json()).toContain('Welcome, Alex');
  expect(json()).toContain('Add your first property');
  expect(json()).not.toContain('Marcus');
  expect(navigation.canGoBack()).toBe(false);
  expect(
    app.root
      .findByType(LandlordDashboardScreen)
      .findAllByType(NotificationBell),
  ).toHaveLength(1);
});
it('falls back safely when the account name is blank', async () => {
  await mount({ ...landlord, name: '  ' });
  expect(json()).toContain(`Welcome, ${landlord.email}`);
});
it.each([landlord, tenant])(
  'restores $role sessions and preserves role-specific navbar items',
  async user => {
    await mount(user);
    const bar = app.root.findByType(BottomNavigation);
    expect(bar.props.role).toBe(user.role);
    expect(bar.props.state.routes.map((r: { name: string }) => r.name)).toEqual(
      user.role === 'landlord'
        ? ['HomeStack', 'History', 'Settings']
        : ['Home', 'Inspections', 'Settings'],
    );
    expect(bar.props.state.index).toBe(0);
    await press('Settings');
    expect(app.root.findByType(BottomNavigation).props.state.index).toBe(2);
    const settings = app.root.findByType(SettingsScreen);
    expect(settings.findByType(Header).props.onBack).toBeUndefined();
    expect(settings.findAllByType(BackButton)).toHaveLength(0);
  },
);
it('validates property fields before saving', async () => {
  await mount();
  await press('+ Add property');
  const form = app.root.findByType(AddPropertyScreen);
  await press('Save property', form);
  expect(json()).toContain('Enter the property address');
  expect(json()).toContain('Enter a unit name');
  await fill(form, {
    'Property address': '18 Example St',
    Unit: '1A',
    Bedrooms: '1.5',
    Bathrooms: '1.25',
    'Tenant email': 'invalid',
  });
  await press('Save & send invite', form);
  expect(json()).toContain('nonnegative whole number');
  expect(json()).toContain('half increments');
  expect(navigation.getCurrentRoute()?.name).toBe('AddProperty');
  await press('Cancel', form);
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
  expect(json()).toContain('Add your first property');
});
it('adds a property, invites the tenant, and walks the dashboard states', async () => {
  await mount();
  await addSampleProperty();
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
  expect(json()).toContain('Unit 1A added. Invite sent.');
  expect(json()).toContain('18 Cedar Ave');
  expect(json()).toContain('PENDING');
  expect(json()).toContain('Next: record the move-in baseline');
  await press('Dismiss');
  expect(json()).not.toContain('Invite sent.');
  await press('Demo: simulate Alyssa joining');
  expect(json()).toContain('JOINED');
  expect(json()).toContain('Alyssa Patel joined Unit 1A');
  expect(json()).not.toContain('Schedule inspection');
  let shot = 0;
  jest.mocked(launchCamera).mockImplementation(async () => ({
    assets: [{ uri: `file://photo-${++shot}.jpg` }],
  }));
  await press('Record baseline');
  expect(navigation.getCurrentRoute()?.name).toBe('MoveInTour');
  expect(json()).toContain('4 areas');
  await press('Start tour');
  expect(json()).toContain('Step 1 of 4');
  expect(json()).toContain('No baseline yet');
  await press('Rename "Living room wall"');
  await fill(app.root, { 'Area name': 'Kitchen sink' });
  expect(json()).toContain('Another area already has this name.');
  await fill(app.root, { 'Area name': 'Front wall' });
  await press('Save name');
  expect(json()).toContain('Step 1 of 4 • Front wall');
  await fill(app.root, { 'Move-in note (optional)': 'Scuff by the outlet' });
  for (let i = 0; i < 4; i++) await press('Capture photo');
  expect(navigation.getCurrentRoute()?.name).toBe('ReviewBaseline');
  expect(json()).toContain('4 of 4 areas done');
  expect(json()).toContain('Front wall');
  expect(
    getLandlord(landlord.id)?.properties[0].units[0].baselineNotes,
  ).toEqual({ 'Front wall': 'Scuff by the outlet' });
  await press('Retake Kitchen sink');
  expect(navigation.getCurrentRoute()?.name).toBe('BaselineCapture');
  await press('Retake photo');
  expect(navigation.getCurrentRoute()?.name).toBe('ReviewBaseline');
  expect(launchCamera).toHaveBeenCalledTimes(5);
  jest.mocked(launchImageLibrary).mockResolvedValue({
    assets: [{ uri: 'file://library-photo.jpg' }],
  });
  await press('Retake Kitchen sink');
  await press('Choose from library');
  expect(navigation.getCurrentRoute()?.name).toBe('ReviewBaseline');
  expect(json()).toContain('file://library-photo.jpg');
  await press('Save baseline');
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
  expect(json()).toContain('Move-in baseline saved.');
  expect(json()).not.toContain('Next: record the move-in baseline');
  const saved = getLandlord(landlord.id)!.properties[0];
  await act(async () =>
    navigation.navigate('EditUnit', {
      propertyId: saved.id,
      unitId: saved.units[0].id,
    }),
  );
  await press('Rename Front wall');
  await fill(app.root, { 'Rename Front wall': 'Entry wall' });
  await press('Save name');
  const renamed = getLandlord(landlord.id)!.properties[0].units[0];
  expect(renamed.areas[0]).toBe('Entry wall');
  expect(renamed.baselinePhotos?.['Entry wall']).toBeDefined();
  expect(renamed.baselineNotes).toEqual({
    'Entry wall': 'Scuff by the outlet',
  });
  await act(async () => navigation.goBack());
  await press('Schedule inspection');
  expect(navigation.getCurrentRoute()?.name).toBe('ScheduleInspection');
});
it('saves a property without a tenant as vacant', async () => {
  await mount();
  await addSampleProperty('');
  expect(json()).toContain('VACANT');
  expect(json()).toContain('Unit 1A added.');
});
it('edits unit areas with the add-area sheet and enforces the minimum', async () => {
  await mount();
  await addSampleProperty();
  await press('Open 18 Cedar Ave');
  expect(navigation.getCurrentRoute()?.name).toBe('EditUnit');
  const screen = app.root.findByType(EditUnitScreen);
  expect(json()).toContain('4 of 10');
  await press('+ Add area', screen);
  const sheet = app.root.findByType(AddAreaSheet);
  expect(sheet.props.visible).toBe(true);
  await press('Add area', sheet);
  expect(json()).toContain('Enter an area name.');
  await press('Entry door', sheet);
  await press('Add area', sheet);
  expect(app.root.findByType(AddAreaSheet).props.visible).toBe(false);
  expect(json()).toContain('5 of 10');
  for (const area of [
    'Entry door',
    'Living room wall',
    'Kitchen sink',
    'Bathroom ceiling',
  ])
    await press(`Remove ${area}`, screen);
  await press('Save changes', screen);
  expect(json()).toContain('Keep at least 2 areas.');
  expect(navigation.getCurrentRoute()?.name).toBe('EditUnit');
});
it('saves unit edits back to the dashboard', async () => {
  await mount();
  await addSampleProperty();
  await press('Open 18 Cedar Ave');
  const screen = app.root.findByType(EditUnitScreen);
  await fill(screen, { Unit: '2B' });
  await press('Move Kitchen sink up', screen);
  await press('Save changes', screen);
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
  expect(json()).toContain('Unit 2B');
  expect(json()).toContain('Unit saved.');
});
it('validates the schedule form and schedules a remote inspection', async () => {
  let shot = 0;
  jest.mocked(launchCamera).mockImplementation(async () => ({
    assets: [{ uri: `file://photo-${++shot}.jpg` }],
  }));
  await mount();
  await addSampleProperty();
  await press('Demo: simulate Alyssa joining');
  await press('Record baseline');
  await press('Start tour');
  for (let i = 0; i < 4; i++) await press('Capture photo');
  await press('Save baseline');
  await press('Schedule inspection');
  const form = app.root.findByType(ScheduleInspectionScreen);
  expect(json()).toContain('18 Cedar Ave • Unit 1A • Alyssa Patel');
  await fill(form, { 'Due date': '2027-02-30' });
  await press('Schedule & notify Alyssa', form);
  expect(json()).toContain('valid calendar date');
  await fill(form, { 'Due date': '2000-01-01' });
  await press('Schedule & notify Alyssa', form);
  expect(json()).toContain('today or a future date');
  const future = new Date();
  future.setDate(future.getDate() + 7);
  await fill(form, { 'Due date': formatLocalDate(future) });
  for (const area of [
    'Living room wall',
    'Kitchen sink',
    'Bathroom ceiling',
    'Bedroom floor',
  ])
    await press(area, form);
  await press('Schedule & notify Alyssa', form);
  expect(json()).toContain('Pick at least one area.');
  await press('Kitchen sink', form);
  expect(json()).toContain('1 of 4 selected');
  await press('Schedule & notify Alyssa', form);
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
  expect(json()).toContain('Inspection scheduled.');
  expect(json()).toContain('Inspection due');
  expect(json()).not.toContain('Schedule inspection');
});
it('gives distinct AI demo decisions, opens History, and returns through the nested stack', async () => {
  await mount();
  await go('AIInspectionReview');
  const screen = app.root.findByType(AIInspectionReviewScreen);
  expect(json()).toContain('PLACEHOLDER');
  expect(json()).toContain('sample findings');
  for (const [label, feedback] of [
    ['Confirm damage', 'Damage confirmation preview'],
    ['Dismiss', 'Dismissal preview'],
    ['Resolved', 'Resolution preview'],
  ]) {
    await press(label, screen);
    expect(alert).toHaveBeenLastCalledWith(
      feedback,
      expect.stringContaining('No decision was saved'),
    );
    expect(navigation.getCurrentRoute()?.name).toBe('AIInspectionReview');
  }
  await press('Open unit history', screen);
  expect(navigation.getCurrentRoute()?.name).toBe('History');
  const history = app.root.findByType(ConditionHistoryScreen);
  expect(
    history
      .findAllByType(UnitChip)
      .every(
        chip =>
          chip.findAll(n => typeof n.props.onPress === 'function').length === 0,
      ),
  ).toBe(true);
  await press('Back to dashboard', history);
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
});
it.each([landlord, tenant])(
  'opens shared Notifications from the $role bell and returns correctly',
  async user => {
    await mount(user);
    const bell = app.root.findByType(NotificationBell);
    if (user.role === 'tenant')
      expect(bell.props.unreadCount).toBeGreaterThan(0);
    await act(async () => bell.props.onPress());
    expect(navigation.getCurrentRoute()?.name).toBe('Notifications');
    const screen = app.root.findByType(NotificationsScreen);
    expect(
      screen
        .findAll(n => n.props.testID === 'notification-1')
        .some(n => n.props.accessibilityValue?.text === 'Unread'),
    ).toBe(true);
    expect(
      screen
        .findAll(n => n.props.testID === 'notification-1')
        .every(n => n.props.onPress === undefined),
    ).toBe(true);
    await press('Mark all as read', screen);
    for (const id of ['1', '2', '3', '4'])
      expect(
        screen
          .findAll(n => n.props.testID === `notification-${id}`)
          .every(n => n.props.accessibilityValue.text === 'Read'),
      ).toBe(true);
    await press('Go back', screen);
    expect(navigation.getCurrentRoute()?.name).toBe(
      user.role === 'landlord' ? 'Dashboard' : 'Home',
    );
  },
);
it('keeps settings switches local, marks unsupported rows unavailable, and handles failed logout', async () => {
  await mount();
  await press('Settings');
  const settings = app.root.findByType(SettingsScreen);
  const getSwitch = () =>
    settings
      .findAllByProps({ accessibilityLabel: 'Inspection Reminders' })
      .find(n => n.props.onValueChange)!;
  await act(async () => getSwitch().props.onValueChange(false));
  expect(getSwitch().props.value).toBe(false);
  const profile = settings.findAllByProps({
    accessibilityLabel: 'Profile, unavailable in prototype',
  });
  expect(
    profile.every(
      n => n.props.onPress === undefined && n.props.accessibilityState.disabled,
    ),
  ).toBe(true);
  jest
    .mocked(auth.logout)
    .mockRejectedValueOnce(new ApiError('Logout unavailable'));
  await press('Log out', settings);
  expect(json()).toContain('Logout unavailable');
  // Settings is a nested stack for landlords; its first screen is SettingsHome.
  expect(navigation.getCurrentRoute()?.name).toBe('SettingsHome');
  let resolve!: () => void;
  jest.mocked(auth.logout).mockImplementationOnce(
    () =>
      new Promise(accept => {
        resolve = accept;
      }),
  );
  await press('Log out', settings);
  expect(settings.findByType(Button).props.loading).toBe(true);
  await act(async () => resolve());
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
  expect(navigation.canGoBack()).toBe(false);
});
it('shared Header back button returns from inspection results', async () => {
  await mount();
  await go('AIInspectionReview');
  await press('Go back', app.root.findByType(AIInspectionReviewScreen));
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
});
describe('landlord numeric and calendar validation', () => {
  it.each(['-1', '1.5', 'NaN', '', '9007199254740992'])(
    'rejects invalid bedroom count %s',
    value => expect(bedroomCountError(value)).toBeDefined(),
  );
  it.each(['0', '2', ' 3 '])('accepts bedroom count %s', value =>
    expect(bedroomCountError(value)).toBeUndefined(),
  );
  it.each(['0', '0.5', '1', '1.0', '2.5'])(
    'accepts half-step bathrooms %s',
    value => expect(bathroomCountError(value)).toBeUndefined(),
  );
  it.each(['-0.5', '1.25', '', '1.1'])('rejects invalid bathrooms %s', value =>
    expect(bathroomCountError(value)).toBeDefined(),
  );
  it.each([
    '2027-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '10/18/2026',
    '2026-10-16',
  ])('rejects invalid or past date %s', value =>
    expect(inspectionDateError(value, new Date(2026, 9, 17))).toBeDefined(),
  );
  it.each(['2026-10-17', '2026-10-18', '2028-02-29'])(
    'accepts today/future date %s',
    value =>
      expect(inspectionDateError(value, new Date(2026, 9, 17))).toBeUndefined(),
  );
});
